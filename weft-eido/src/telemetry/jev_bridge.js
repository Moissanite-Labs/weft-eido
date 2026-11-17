/**
 * WEFT-EIDO // TypeSafe Jev & OpenAI Decisions API Bridge + Geo/IP/Env Sensor
 *
 * Connects live user kinematics, IP/geolocation/solar telemetry, and hardware vitals to:
 *   1. TypeSafe AI's Jev System-1 Model (`POST https://api.typesafe.ai/v1/systemone`, `jev-latest`)
 *      - Uses Choice, Score, and Noul primitives in a single parallel non-autoregressive pass (~70-114ms).
 *   2. OpenAI's Decisions API (`POST https://api.openai.com/v1/decisions`, `gpt-6-luna`)
 *      - Uses choice, score, and predicate primitives (~10x faster than chat completions).
 *   3. Sub-millisecond Local Analytical Reflex Fallback when no API key is configured.
 */

export class JevSystemOneBridge {
    constructor(options = {}) {
        this.jevApiKey = options.jevApiKey || localStorage.getItem("WEFT_JEV_API_KEY") || "";
        this.openaiApiKey = options.openaiApiKey || localStorage.getItem("WEFT_OPENAI_API_KEY") || "";
        this.jevEndpoint = options.jevEndpoint || "https://api.typesafe.ai/v1/systemone";
        this.openaiEndpoint = options.openaiEndpoint || "https://api.openai.com/v1/decisions";
        this.provider = this.jevApiKey ? "jev" : (this.openaiApiKey ? "openai" : "local");

        // Environmental, Geolocation, IP & Hardware Vector
        this.env = {
            ipHash: 0.42,          // Deterministic [0, 1] hash from IP octets or locale fingerprint
            latitude: 29.7604,     // Default: Houston, TX (updated via live IP/geo lookup or timezone)
            longitude: -95.3698,
            latNorm: 0.665,        // Normalized [-90, 90] -> [0, 1]
            lonNorm: 0.235,        // Normalized [-180, 180] -> [0, 1]
            solarZenith: 0.5,      // Continuous [-1, 1] diurnal sun elevation factor
            networkRttNorm: 0.15,  // Normalized connection RTT [0, 1]
            hardwareCoresNorm: Math.min(1.0, (navigator.hardwareConcurrency || 8) / 16.0),
            city: "LOCAL-SILICON",
            country: "SOVEREIGN"
        };

        // Last calibrated System-1 judgment from Jev / OpenAI Decisions
        this.lastDecision = {
            cognitive_mode: "deep_focus",
            mode_probabilities: {
                deep_focus: 0.70,
                exploratory_flow: 0.20,
                rapid_scanning: 0.07,
                frustrated_overload: 0.03
            },
            structural_tension: 0.15,
            fractal_morph_blend: 0.35, // 0.0 = Pure 2D SDF Grid, 1.0 = Full 3D Raymarched Fractal Crystal
            foveated_relaxation: 0.82,
            confidence: 0.94,
            latencyMs: 0.4,
            source: "LOCAL-S1"
        };

        this.inFlight = false;
        this.lastCallTime = 0;
        this.minIntervalMs = options.minIntervalMs || 1800; // Poll external System-1 API every ~1.8s on state shift
    }

    setApiKeys({ jevApiKey, openaiApiKey }) {
        if (typeof jevApiKey === "string") {
            this.jevApiKey = jevApiKey.trim();
            if (this.jevApiKey) localStorage.setItem("WEFT_JEV_API_KEY", this.jevApiKey);
            else localStorage.removeItem("WEFT_JEV_API_KEY");
        }
        if (typeof openaiApiKey === "string") {
            this.openaiApiKey = openaiApiKey.trim();
            if (this.openaiApiKey) localStorage.setItem("WEFT_OPENAI_API_KEY", this.openaiApiKey);
            else localStorage.removeItem("WEFT_OPENAI_API_KEY");
        }
        this.provider = this.jevApiKey ? "jev" : (this.openaiApiKey ? "openai" : "local");
    }

    /**
     * Resolves visitor IP / Geolocation / Timezone / Solar angle & Network vitals
     * so every pixel equation reflects where and how the user is connecting.
     */
    async bootstrapEnvironmentContext() {
        this.updateSolarAndNetworkMetrics();

        // Derive deterministic baseline from timezone + locale before network returns
        const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || "America/Chicago";
        this.env.ipHash = this.hashStringToUnitFloat(tz + (navigator.language || "en-US"));

        try {
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), 2500);
            const res = await fetch("https://ipwho.is/", { signal: controller.signal });
            clearTimeout(timeout);

            if (res.ok) {
                const data = await res.json();
                if (data && data.success !== false) {
                    if (typeof data.latitude === "number") this.env.latitude = data.latitude;
                    if (typeof data.longitude === "number") this.env.longitude = data.longitude;
                    if (data.ip) this.env.ipHash = this.hashStringToUnitFloat(data.ip);
                    if (data.city) this.env.city = String(data.city).toUpperCase().slice(0, 8);
                    if (data.country_code) this.env.country = String(data.country_code).toUpperCase();
                }
            }
        } catch (_) {
            // Privacy blocker or offline mode: keep deterministic timezone-derived coordinates
        }

        this.env.latNorm = Math.max(0.0, Math.min(1.0, (this.env.latitude + 90.0) / 180.0));
        this.env.lonNorm = Math.max(0.0, Math.min(1.0, (this.env.longitude + 180.0) / 360.0));
        this.updateSolarAndNetworkMetrics();
        return this.env;
    }

    updateSolarAndNetworkMetrics() {
        const now = new Date();
        const fractionalHours = now.getHours() + now.getMinutes() / 60.0 + now.getSeconds() / 3600.0;
        // Continuous diurnal wave: +1.0 at solar noon (12:00), -1.0 at midnight (00:00), mapped to [0, 1]
        const rawCos = -Math.cos((fractionalHours / 24.0) * Math.PI * 2.0);
        this.env.solarZenith = rawCos * 0.5 + 0.5;

        const conn = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
        if (conn && typeof conn.rtt === "number") {
            this.env.networkRttNorm = Math.min(1.0, conn.rtt / 500.0);
        }
    }

    hashStringToUnitFloat(str) {
        let h = 2166136261 >>> 0;
        for (let i = 0; i < str.length; i++) {
            h ^= str.charCodeAt(i);
            h = Math.imul(h, 16777619) >>> 0;
        }
        return (h % 100000) / 100000.0;
    }

    /**
     * Triggers an non-blocking System-1 evaluation via TypeSafe Jev (`jev-latest`)
     * or OpenAI Decisions API (`gpt-6-luna`) when an API key is available.
     */
    async maybeEvaluateLiveState(telemetryState) {
        this.updateSolarAndNetworkMetrics();
        const now = performance.now();

        if (this.provider === "local" || this.inFlight || (now - this.lastCallTime < this.minIntervalMs)) {
            return this.lastDecision;
        }

        this.inFlight = true;
        this.lastCallTime = now;
        const t0 = performance.now();

        const statePayload = {
            telemetry: telemetryState.telemetrySnapshot,
            kinematics: {
                pointer_x: Number(telemetryState.pointer.x.toFixed(3)),
                pointer_y: Number(telemetryState.pointer.y.toFixed(3)),
                pointer_speed: Number(telemetryState.pointer.speed.toFixed(3)),
                dwell_seconds: Number((telemetryState.dwellSeconds || 0).toFixed(1))
            },
            environment: {
                latitude: this.env.latitude,
                longitude: this.env.longitude,
                solar_zenith: Number(this.env.solarZenith.toFixed(3)),
                ip_entropy_seed: Number(this.env.ipHash.toFixed(3)),
                network_rtt_norm: Number(this.env.networkRttNorm.toFixed(3))
            }
        };

        try {
            if (this.provider === "jev") {
                await this.callTypeSafeJev(statePayload, t0);
            } else if (this.provider === "openai") {
                await this.callOpenAIDecisions(statePayload, t0);
            }
        } catch (err) {
            console.warn("[WEFT-EIDO // System-1 Bridge] Remote call fell back to local reflex:", err.message);
        } finally {
            this.inFlight = false;
        }

        return this.lastDecision;
    }

    /**
     * Calls TypeSafe AI's System One endpoint (`POST https://api.typesafe.ai/v1/systemone`)
     * using Jev's native `choice`, `score`, and `noul` primitives.
     */
    async callTypeSafeJev(statePayload, t0) {
        const res = await fetch(this.jevEndpoint, {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${this.jevApiKey}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                model: "jev-latest",
                state: statePayload,
                questions: {
                    cognitive_mode: {
                        type: "choice",
                        instructions: "Classify the visitor's real-time interaction state from their pointer kinematics, scroll velocity, dwell time, and environment.",
                        options: ["deep_focus", "exploratory_flow", "rapid_scanning", "frustrated_overload"]
                    },
                    structural_tension: {
                        type: "score",
                        instructions: "Score the interface tension and chaotic energy level required for the shader field.",
                        levels: ["homeostatic", "active", "strained", "critical_fracture"]
                    },
                    visual_topology: {
                        type: "choice",
                        instructions: "Select the optimal mathematical shader topology for the current interaction rhythm.",
                        options: ["sdf_matrix_grid", "hybrid_membrane", "morphogenetic_fractal"]
                    },
                    foveated_relaxation: {
                        type: "noul",
                        instructions: "Should the shader dilate typographic spacing and emit a calming Focus Field glow to reward steady reading?"
                    }
                }
            })
        });

        if (!res.ok) throw new Error(`Jev HTTP ${res.status}`);
        const data = await res.json();
        const answers = data.answers || data;

        if (answers.cognitive_mode?.probabilities) {
            this.lastDecision.mode_probabilities = answers.cognitive_mode.probabilities;
            this.lastDecision.cognitive_mode = answers.cognitive_mode.choice || "deep_focus";
            this.lastDecision.confidence = answers.cognitive_mode.confidence ?? 0.95;
        }
        if (typeof answers.structural_tension?.score === "number") {
            // Normalize score across 4 levels (0..3 or 0..1)
            const rawScore = answers.structural_tension.score;
            this.lastDecision.structural_tension = rawScore > 1.0 ? Math.min(1.0, rawScore / 3.0) : rawScore;
        }
        if (answers.visual_topology?.probabilities) {
            const pFractal = answers.visual_topology.probabilities.morphogenetic_fractal || 0.0;
            const pHybrid = answers.visual_topology.probabilities.hybrid_membrane || 0.0;
            this.lastDecision.fractal_morph_blend = Math.min(1.0, pFractal + pHybrid * 0.5);
        }
        if (typeof answers.foveated_relaxation?.noul === "number") {
            this.lastDecision.foveated_relaxation = answers.foveated_relaxation.noul;
        }

        this.lastDecision.latencyMs = Math.round(performance.now() - t0);
        this.lastDecision.source = "JEV-1.14";
    }

    /**
     * Calls OpenAI's Decisions API (`POST https://api.openai.com/v1/decisions`)
     * using `gpt-6-luna` with `choice`, `score`, and `predicate` question types.
     */
    async callOpenAIDecisions(statePayload, t0) {
        const res = await fetch(this.openaiEndpoint, {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${this.openaiApiKey}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                model: "gpt-6-luna",
                input: JSON.stringify(statePayload),
                questions: {
                    cognitive_mode: {
                        type: "choice",
                        instructions: "Classify the user's real-time cognitive interaction mode.",
                        options: ["deep_focus", "exploratory_flow", "rapid_scanning", "frustrated_overload"]
                    },
                    structural_tension: {
                        type: "score",
                        instructions: "Evaluate the kinetic stress and interface tension.",
                        levels: ["homeostatic", "active", "strained", "critical_fracture"]
                    },
                    foveated_relaxation: {
                        type: "predicate",
                        instructions: "Is the user exhibiting calm, steady reading or exploratory flow that merits typographic relaxation?"
                    }
                }
            })
        });

        if (!res.ok) throw new Error(`OpenAI Decisions HTTP ${res.status}`);
        const data = await res.json();
        const answers = data.answers || data.decisions || data;

        if (answers.cognitive_mode?.probabilities) {
            this.lastDecision.mode_probabilities = answers.cognitive_mode.probabilities;
            this.lastDecision.cognitive_mode = answers.cognitive_mode.choice || "deep_focus";
        }
        if (typeof answers.structural_tension?.score === "number") {
            const rawScore = answers.structural_tension.score;
            this.lastDecision.structural_tension = rawScore > 1.0 ? Math.min(1.0, rawScore / 3.0) : rawScore;
        }
        if (typeof answers.foveated_relaxation?.probability === "number") {
            this.lastDecision.foveated_relaxation = answers.foveated_relaxation.probability;
        }

        this.lastDecision.latencyMs = Math.round(performance.now() - t0);
        this.lastDecision.source = "GPT6-LUNA";
    }
}
