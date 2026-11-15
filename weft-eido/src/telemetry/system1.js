/**
 * WEFT-EIDO // System-1 Behavioral Telemetry & Laya Decision Bridge
 * Continuously captures rolling micro-telemetry (scroll velocity, direction reversals,
 * cursor micro-jitter variance, pointer velocity, and dwell harmony) and computes
 * calibrated System-1 state probabilities in real time (<1ms analytical pass or
 * optional @r4ai/laya-web WebGPU/WASM forward pass).
 */

export class System1TelemetryEngine {
    constructor() {
        this.samples = [];
        this.windowMs = 5000;

        this.pointer = { x: 0.5, y: 0.5, vx: 0.0, vy: 0.0, speed: 0.0, down: false };
        this.lastPointer = { x: 0.5, y: 0.5, t: performance.now() };

        this.scrollVelocity = 0.0;
        this.scrollReversals = 0;
        this.lastScrollSign = 0;
        this.rapidClicks = [];
        this.dwellSeconds = 0.0;
        this.lastActivityTime = performance.now();

        this.autoAdapt = true;
        this.layaAgent = null;

        this.probabilities = {
            deep_processing: 0.72,
            scanning_passive: 0.20,
            skimming_chaotic: 0.05,
            frustrated: 0.03
        };

        // Competing Cellular Lineages (from weft_singularity_core.py convergence)
        this.lineages = {
            alpha_safe_loss: 0.18,
            beta_bold_loss: 0.64,
            dominance: 0.0 // 0.0 = Alpha (Safe/Calm), 1.0 = Beta (Bold/Compressed)
        };
    }

    recordPointerMove(normX, normY) {
        const now = performance.now();
        const dt = Math.max(1.0, now - this.lastPointer.t) / 1000.0;
        const dx = normX - this.lastPointer.x;
        const dy = normY - this.lastPointer.y;
        const speed = Math.hypot(dx, dy) / dt;

        const dvx = dx / dt - this.pointer.vx;
        const dvy = dy / dt - this.pointer.vy;
        const accel = Math.hypot(dvx, dvy);

        this.pointer.x = normX;
        this.pointer.y = normY;
        this.pointer.vx = dx / dt;
        this.pointer.vy = dy / dt;
        this.pointer.speed = speed;

        this.lastPointer.x = normX;
        this.lastPointer.y = normY;
        this.lastPointer.t = now;
        this.lastActivityTime = now;

        this.samples.push({ t: now, speed, accel, scroll: 0 });
        this.prune(now);
    }

    recordWheel(deltaY) {
        const now = performance.now();
        const sign = Math.sign(deltaY);
        if (sign !== 0 && this.lastScrollSign !== 0 && sign !== this.lastScrollSign) {
            this.scrollReversals += 1;
        }
        if (sign !== 0) this.lastScrollSign = sign;

        this.scrollVelocity = Math.min(2000, Math.abs(deltaY) * 12.0);
        this.lastActivityTime = now;
        this.samples.push({ t: now, speed: 0, accel: 0, scroll: Math.abs(deltaY) });
        this.prune(now);
    }

    recordClick() {
        const now = performance.now();
        this.rapidClicks.push(now);
        this.rapidClicks = this.rapidClicks.filter((t) => now - t < 2500);
    }

    prune(now) {
        const cutoff = now - this.windowMs;
        while (this.samples.length > 0 && this.samples[0].t < cutoff) {
            this.samples.shift();
        }
        this.rapidClicks = this.rapidClicks.filter((t) => now - t < 2500);
    }

    /**
     * Optional hook to bind an external @r4ai/laya-web non-autoregressive agent instance.
     */
    attachLayaAgent(agentInstance) {
        this.layaAgent = agentInstance;
    }

    /**
     * Evaluates the rolling behavioral telemetry window and updates calibrated
     * System-1 probabilities + Alpha/Beta lineage homeostasis.
     */
    step(dtSeconds) {
        const now = performance.now();
        this.prune(now);

        let meanSpeed = 0.0;
        let meanAccel = 0.0;
        let totalScroll = 0.0;

        if (this.samples.length > 0) {
            for (const s of this.samples) {
                meanSpeed += s.speed;
                meanAccel += s.accel;
                totalScroll += s.scroll;
            }
            meanSpeed /= this.samples.length;
            meanAccel /= this.samples.length;
        }

        // Decay scroll reversals and velocity smoothly
        this.scrollVelocity *= Math.exp(-dtSeconds * 3.0);
        this.scrollReversals = Math.max(0, this.scrollReversals - dtSeconds * 0.6);

        // Compute normalized kinetic stress indicators
        const jitterNorm = Math.min(1.0, meanAccel / 18.0);
        const speedNorm = Math.min(1.0, meanSpeed / 2.2);
        const scrollSpamNorm = Math.min(1.0, (totalScroll / 1600.0) + (this.scrollReversals * 0.18));
        const rageClickNorm = Math.min(1.0, Math.max(0, this.rapidClicks.length - 2) / 4.0);

        // Smooth dwell accumulation when user is steady
        if (jitterNorm < 0.25 && scrollSpamNorm < 0.3 && rageClickNorm === 0) {
            this.dwellSeconds = Math.min(30.0, this.dwellSeconds + dtSeconds);
        } else {
            this.dwellSeconds = Math.max(0.0, this.dwellSeconds - dtSeconds * 2.5);
        }

        const dwellHarmony = Math.min(1.0, this.dwellSeconds / 6.0);

        // Raw unnormalized logits for the 4 cognitive states
        const rawFrustrated = Math.max(0.01, rageClickNorm * 1.4 + jitterNorm * 0.8);
        const rawSkimming = Math.max(0.02, scrollSpamNorm * 1.2 + speedNorm * 0.6);
        const rawDeep = Math.max(0.05, (1.0 - jitterNorm) * (1.0 - scrollSpamNorm * 0.7) * (0.55 + dwellHarmony * 0.85));
        const rawScanning = Math.max(0.05, 0.35 * (1.0 - Math.abs(speedNorm - 0.35)));

        const sum = rawFrustrated + rawSkimming + rawDeep + rawScanning;

        // Smooth exponential filter so probabilities drive 60+ FPS shader uniforms without stepping
        const lerp = Math.min(1.0, dtSeconds * 6.0);
        this.probabilities.deep_processing += ((rawDeep / sum) - this.probabilities.deep_processing) * lerp;
        this.probabilities.scanning_passive += ((rawScanning / sum) - this.probabilities.scanning_passive) * lerp;
        this.probabilities.skimming_chaotic += ((rawSkimming / sum) - this.probabilities.skimming_chaotic) * lerp;
        this.probabilities.frustrated += ((rawFrustrated / sum) - this.probabilities.frustrated) * lerp;

        // Update competing cellular lineages (Alpha Safe vs Beta Bold)
        this.lineages.alpha_safe_loss = 1.0 - this.probabilities.deep_processing;
        this.lineages.beta_bold_loss = 1.0 - (this.probabilities.skimming_chaotic + this.probabilities.frustrated);
        const targetDominance = this.probabilities.skimming_chaotic + this.probabilities.frustrated;
        this.lineages.dominance += (targetDominance - this.lineages.dominance) * lerp;

        return {
            probabilities: this.probabilities,
            lineages: this.lineages,
            autoAdapt: this.autoAdapt,
            pointer: this.pointer,
            telemetrySnapshot: this.formatTelemetryString(meanSpeed, jitterNorm)
        };
    }

    formatTelemetryString(meanSpeed, jitterNorm) {
        return [
            `Scroll Velocity: ${this.scrollVelocity.toFixed(1)}px/s`,
            `Scroll Reversals: ${Math.round(this.scrollReversals)}`,
            `Cursor Jitter: ${jitterNorm < 0.25 ? "Low" : jitterNorm < 0.6 ? "Moderate" : "High"} (${jitterNorm.toFixed(2)})`,
            `Dwell Time: ${this.dwellSeconds.toFixed(1)}s`,
            `Pointer Speed: ${meanSpeed.toFixed(2)} uv/s`
        ].join(" | ");
    }
}
