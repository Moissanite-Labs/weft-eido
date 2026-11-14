/**
 * WEFT-EIDO // Sovereign Mathematical Web Runtime (src/main.js)
 *
 * Binds all 4 layers of the Weft-Eido organism into a 96-byte (24-float) WebGPU uniform bus:
 *   1. User Kinematics & Behavioral Telemetry (`System1TelemetryEngine`)
 *   2. Geolocation, IP Entropy, Solar Zenith & System-1 Decision Bridge (`JevSystemOneBridge`:
 *      TypeSafe AI's `jev-latest` + OpenAI's `gpt-6-luna` Decisions API + Local Reflex)
 *   3. Barycentric Aesthetic Chromosome Mixer (`BarycentricMixer`)
 *   4. Lafont Interaction Combinator VM & 85/15 Metabolic Valve (`FlatCombinatorVM`)
 */

import { BarycentricMixer } from "./mixer/barycentric.js";
import { System1TelemetryEngine } from "./telemetry/system1.js";
import { JevSystemOneBridge } from "./telemetry/jev_bridge.js";
import { FlatCombinatorVM } from "./vm/combinator_vm.js";

function encodeASCII8(str) {
    const padded = (str || "").toUpperCase().padEnd(8, " ").slice(0, 8);
    const out = new Array(8);
    for (let i = 0; i < 8; i++) {
        const code = padded.charCodeAt(i);
        out[i] = code === 32 ? 60 : code;
    }
    return out;
}

export class WeftEidoRuntime {
    constructor() {
        this.canvas = document.getElementById("eidoCanvas");
        this.mixer = new BarycentricMixer();
        this.telemetryEngine = new System1TelemetryEngine();
        this.jevBridge = new JevSystemOneBridge();
        this.combinatorVM = new FlatCombinatorVM(256);
        this.combinatorVM.seedDefaultTopology();

        this.state = {
            active_nodes: 8.0,
            org_tension: 0.15,
            system_time: 0.0,
            gini_concentration: 0.42,
            fractal_morph_blend: 0.35,
            scroll_phase: 0.0,
            owner_ratio: 0.72,
            contributor_capture: 0.31
        };

        // 8 Repository node labels + 6 HUD slider labels packed into GPU storage buffer
        this.labels = [
            "WEFT-COR", "EIDO-SDF", "JEV-SYS1", "BARY-MIX",
            "SYNB-NCA", "LAFONT-C", "ZERO-DOM", "GEO-SOLR",
            "TENSION ", "GINI-RSK", "MITHRAX ", "AIRYNEON", "SAGECALM", "FRACTAL3"
        ];

        this.activeSlider = -1;
        this.startTime = performance.now();
        this.lastFrameTime = this.startTime;

        this.device = null;
        this.context = null;
        this.uniformBuffer = null;
        this.storageBuffer = null;
        this.renderPipeline = null;
        this.bindGroup = null;
        this.fallbackCtx = null;
    }

    async boot() {
        this.bindEvents();
        this.resizeCanvas();

        // Non-blocking bootstrap of IP, Geolocation, Solar Zenith & Network vitals
        this.jevBridge.bootstrapEnvironmentContext().then((env) => {
            if (env.city && env.city !== "LOCAL-SILICON") {
                this.labels[7] = env.city.slice(0, 8);
                this.uploadStorageLabels();
            }
        });

        if (navigator.gpu) {
            try {
                const adapter = await navigator.gpu.requestAdapter();
                if (adapter) {
                    this.device = await adapter.requestDevice();
                    await this.initWebGPU();
                    requestAnimationFrame(() => this.loop());
                    return;
                }
            } catch (err) {
                console.warn("WebGPU unavailable, engaging mathematical Canvas2D SDF fallback:", err);
            }
        }

        this.fallbackCtx = this.canvas.getContext("2d");
        requestAnimationFrame(() => this.loop());
    }

    uploadStorageLabels() {
        if (!this.device || !this.storageBuffer) return;
        const packedChars = new Uint32Array(this.labels.flatMap((lbl) => encodeASCII8(lbl)));
        this.device.queue.writeBuffer(this.storageBuffer, 0, packedChars);
    }

    async initWebGPU() {
        this.context = this.canvas.getContext("webgpu");
        const format = navigator.gpu.getPreferredCanvasFormat();
        this.context.configure({
            device: this.device,
            format,
            alphaMode: "opaque"
        });

        const response = await fetch("./src/shaders/eido_core.wgsl");
        const wgslCode = await response.text();
        const shaderModule = this.device.createShaderModule({ code: wgslCode });

        // 24 floats * 4 bytes = 96-byte uniform buffer (6 vec4f blocks)
        this.uniformBuffer = this.device.createBuffer({
            size: 96,
            usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
        });

        const packedChars = new Uint32Array(this.labels.flatMap((lbl) => encodeASCII8(lbl)));
        this.storageBuffer = this.device.createBuffer({
            size: packedChars.byteLength,
            usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST
        });
        this.device.queue.writeBuffer(this.storageBuffer, 0, packedChars);

        this.renderPipeline = this.device.createRenderPipeline({
            layout: "auto",
            vertex: { module: shaderModule, entryPoint: "vertex_main" },
            fragment: { module: shaderModule, entryPoint: "fragment_main", targets: [{ format }] },
            primitive: { topology: "triangle-list" }
        });

        this.bindGroup = this.device.createBindGroup({
            layout: this.renderPipeline.getBindGroupLayout(0),
            entries: [
                { binding: 0, resource: { buffer: this.uniformBuffer } },
                { binding: 1, resource: { buffer: this.storageBuffer } }
            ]
        });
    }

    resizeCanvas() {
        const dpr = window.devicePixelRatio || 1;
        this.canvas.width = Math.floor(window.innerWidth * dpr);
        this.canvas.height = Math.floor(window.innerHeight * dpr);
    }

    /**
     * Pure coordinate hit-testing against the 6 shader-rendered slider bars in bottom-left UV space.
     */
    hitTestShaderHUD(uvX, uvY) {
        if (uvX < 0.040 || uvX > 0.295) return -1;
        for (let s = 0; s < 6; s++) {
            const rowY = 0.54 + s * 0.068;
            if (uvY >= rowY - 0.015 && uvY <= rowY + 0.025) {
                return s;
            }
        }
        return -1;
    }

    applyShaderSliderValue(sliderIndex, uvX) {
        const value = Math.max(0.0, Math.min(1.0, (uvX - 0.045) / 0.24));
        if (sliderIndex === 0) {
            this.state.org_tension = value;
        } else if (sliderIndex === 1) {
            this.state.gini_concentration = value;
        } else if (sliderIndex >= 2 && sliderIndex <= 4) {
            this.mixer.setWeight(sliderIndex - 2, value);
        } else if (sliderIndex === 5) {
            this.state.fractal_morph_blend = value;
        }
    }

    bindEvents() {
        window.addEventListener("resize", () => this.resizeCanvas());

        window.addEventListener("pointerdown", (e) => {
            const uvX = e.clientX / window.innerWidth;
            const uvY = e.clientY / window.innerHeight;
            this.telemetryEngine.recordClick();
            const hit = this.hitTestShaderHUD(uvX, uvY);
            if (hit !== -1) {
                this.activeSlider = hit;
                this.applyShaderSliderValue(hit, uvX);
            }
        });

        window.addEventListener("pointermove", (e) => {
            const uvX = e.clientX / window.innerWidth;
            const uvY = e.clientY / window.innerHeight;
            this.telemetryEngine.recordPointerMove(uvX, uvY);
            if (this.activeSlider !== -1) {
                this.applyShaderSliderValue(this.activeSlider, uvX);
            }
        });

        window.addEventListener("pointerup", () => {
            this.activeSlider = -1;
        });

        window.addEventListener("wheel", (e) => {
            this.telemetryEngine.recordWheel(e.deltaY);
            this.state.scroll_phase += e.deltaY * 0.0025;
            this.combinatorVM.stepReduction(this.state.org_tension * 100.0, 2.5);
        }, { passive: true });

        window.addEventListener("keydown", (e) => {
            if (e.key === " ") {
                this.telemetryEngine.autoAdapt = !this.telemetryEngine.autoAdapt;
            } else if (e.key === "1" || e.key === "2" || e.key === "3") {
                const idx = parseInt(e.key, 10) - 1;
                this.mixer.slices.forEach((s, i) => { s.weight = i === idx ? 1.0 : 0.0; });
            } else if (e.key.toLowerCase() === "k") {
                // Zero-DOM API Key binding for TypeSafe Jev or OpenAI Decisions API
                const inputKey = window.prompt(
                    "Enter TypeSafe Jev API Key (or prefix with 'openai:' for OpenAI Decisions API):",
                    this.jevBridge.jevApiKey || ""
                );
                if (inputKey !== null) {
                    if (inputKey.startsWith("openai:")) {
                        this.jevBridge.setApiKeys({ jevApiKey: "", openaiApiKey: inputKey.slice(7) });
                    } else {
                        this.jevBridge.setApiKeys({ jevApiKey: inputKey, openaiApiKey: "" });
                    }
                }
            }
        });
    }

    loop() {
        const now = performance.now();
        const dt = Math.min(0.1, (now - this.lastFrameTime) / 1000.0);
        this.lastFrameTime = now;
        this.state.system_time = (now - this.startTime) / 1000.0;

        const sys1 = this.telemetryEngine.step(dt);

        // Trigger non-blocking Jev (`jev-latest`) or OpenAI Decisions (`gpt-6-luna`) judgment when configured
        if (this.jevBridge.provider !== "local") {
            this.jevBridge.maybeEvaluateLiveState(sys1);
            const jd = this.jevBridge.lastDecision;
            const blend = Math.min(1.0, dt * 4.0);
            sys1.probabilities.deep_processing += ((jd.mode_probabilities.deep_focus || 0.5) - sys1.probabilities.deep_processing) * blend;
            sys1.probabilities.frustrated += ((jd.mode_probabilities.frustrated_overload || 0.05) - sys1.probabilities.frustrated) * blend;
            this.state.org_tension += (jd.structural_tension - this.state.org_tension) * (blend * 0.5);
        }

        const style = this.mixer.compileUnifiedVector(sys1);
        const aspect = this.canvas.width / Math.max(1, this.canvas.height);
        const env = this.jevBridge.env;

        if (this.device && this.renderPipeline) {
            const uniformArray = new Float32Array([
                // vec4[0]
                this.state.active_nodes,
                this.state.org_tension,
                this.state.system_time,
                this.state.gini_concentration,
                // vec4[1]
                style.rounding,
                style.density,
                style.hue_shift,
                style.contrast,
                // vec4[2]
                sys1.pointer.x,
                sys1.pointer.y,
                sys1.probabilities.deep_processing,
                sys1.probabilities.frustrated,
                // vec4[3]
                aspect,
                this.mixer.slices[0].weight,
                this.mixer.slices[1].weight,
                this.mixer.slices[2].weight,
                // vec4[4]: Geo, IP, Solar & Network variables
                env.latNorm,
                env.lonNorm,
                env.solarZenith,
                env.ipHash,
                // vec4[5]: 3D Fractal Morph, Scroll Phase, Ownership & Capture Gravity
                this.state.fractal_morph_blend,
                this.state.scroll_phase,
                this.state.owner_ratio,
                this.state.contributor_capture
            ]);
            this.device.queue.writeBuffer(this.uniformBuffer, 0, uniformArray);

            const encoder = this.device.createCommandEncoder();
            const pass = encoder.beginRenderPass({
                colorAttachments: [{
                    view: this.context.getCurrentTexture().createView(),
                    loadOp: "clear",
                    storeOp: "store"
                }]
            });
            pass.setPipeline(this.renderPipeline);
            pass.setBindGroup(0, this.bindGroup);
            pass.draw(3, 1, 0, 0);
            pass.end();
            this.device.queue.submit([encoder.finish()]);
        } else if (this.fallbackCtx) {
            this.renderCanvas2DFallback(style, sys1);
        }

        requestAnimationFrame(() => this.loop());
    }

    renderCanvas2DFallback(style, sys1) {
        const ctx = this.fallbackCtx;
        const w = this.canvas.width;
        const h = this.canvas.height;
        const env = this.jevBridge.env;

        const bgLuma = Math.floor((0.008 + style.contrast * 0.03 + env.solarZenith * 0.015) * 255);
        ctx.fillStyle = `rgb(${bgLuma}, ${bgLuma + 2}, ${bgLuma + 6})`;
        ctx.fillRect(0, 0, w, h);

        const hueDeg = Math.floor(((style.hue_shift + env.ipHash * 0.15) % 1.0) * 360);
        const cols = 4;
        const rows = 2;
        const spacingX = w * (0.14 + style.density * 0.06);
        const spacingY = h * (0.18 + style.density * 0.06);
        const startX = w * 0.42;
        const startY = h * 0.34;

        for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols; c++) {
                const idx = r * cols + c;
                const jitter = Math.sin(this.state.system_time * 16 + idx) * this.state.org_tension * 8;
                const cx = startX + c * spacingX + jitter;
                const cy = startY + r * spacingY + Math.sin(this.state.scroll_phase + c) * (this.state.contributor_capture * 14);
                const bw = spacingX * (0.68 + this.state.owner_ratio * 0.18);
                const bh = spacingY * 0.72;
                const radius = Math.min(bw, bh) * 0.4 * style.rounding;

                ctx.strokeStyle = `hsl(${hueDeg}, 75%, 58%)`;
                ctx.lineWidth = 1.5 + this.state.gini_concentration * 5.0;
                ctx.beginPath();
                ctx.roundRect(cx - bw / 2, cy - bh / 2, bw, bh, radius);
                ctx.stroke();

                ctx.fillStyle = "#f0f6ff";
                ctx.font = `${Math.floor(bh * 0.20)}px monospace`;
                ctx.fillText(this.labels[idx], cx - bw * 0.38, cy);
                ctx.fillText(sys1.probabilities.deep_processing.toFixed(2), cx - bw * 0.22, cy + bh * 0.28);
            }
        }
    }
}

window.addEventListener("DOMContentLoaded", () => {
    const runtime = new WeftEidoRuntime();
    runtime.boot();
});
