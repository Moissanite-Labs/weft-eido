/**
 * WEFT-EIDO // Unified Zero-DOM WebGPU Shader Core (eido_core.wgsl)
 *
 * Every pixel on screen is a pure mathematical function f(p, I, B, G, S1, C, O):
 *   - p:  2D/3D spatial coordinate field
 *   - I:  Real-time user input kinematics (pointer position, velocity, click ripples, scroll phase)
 *   - B:  Barycentric Aesthetic Chromosome vector (rounding, density, circular S^1 hue, contrast)
 *   - G:  Geolocation, IP entropy seed, local solar zenith angle & network RTT
 *   - S1: Calibrated System-1 probabilities from TypeSafe Jev (`jev-latest`) / OpenAI Decisions (`gpt-6-luna`) / Laya
 *   - C:  3D Morphogenetic Fractal Ray-Marcher (`deFractalOrganism` from `attempt/demo.md`)
 *   - O:  5D Organizational Telemetry (Active Nodes, Tension, Gini Concentration, Owner Ratio, Capture Gravity)
 */

struct EidoUniforms {
    // vec4[0]: Core Organizational & Temporal Telemetry
    active_nodes: f32,
    org_tension: f32,
    system_time: f32,
    gini_concentration: f32,

    // vec4[1]: Barycentric Aesthetic Chromosome Vector
    user_rounding: f32,
    user_density: f32,
    user_hue_shift: f32,
    user_contrast: f32,

    // vec4[2]: User Input Kinematics & System-1 Decision Probabilities (Jev / Laya)
    pointer_x: f32,
    pointer_y: f32,
    organic_reading_score: f32,
    frustration_score: f32,

    // vec4[3]: Viewport & Active Chromosome Slider Weights
    aspect_ratio: f32,
    weight_0: f32,
    weight_1: f32,
    weight_2: f32,

    // vec4[4]: Geolocation, IP Entropy, Solar Zenith & Network RTT Variables
    geo_lat_norm: f32,
    geo_lon_norm: f32,
    solar_zenith: f32,
    ip_entropy_hash: f32,

    // vec4[5]: 3D Morphogenetic Fractal Blend, Scroll Phase, Owner Ratio & Capture Gravity
    fractal_morph_blend: f32,
    scroll_phase: f32,
    owner_ratio: f32,
    contributor_capture: f32
};

struct TextLinePack {
    chars: array<u32, 8>
};

@group(0) @binding(0) var<uniform> u : EidoUniforms;
@group(0) @binding(1) var<storage, read> labelData : array<TextLinePack>;

struct VertexOutput {
    @builtin(position) position: vec4f,
    @location(0) uv: vec2f
};

// =====================================================================
// 1. ZERO-INPUT FULL-SCREEN TRIANGLE VERTEX PASS
// =====================================================================
@vertex
fn vertex_main(@builtin(vertex_index) vertex_id: u32) -> VertexOutput {
    var out: VertexOutput;
    let x = f32(i32(vertex_id << 1u) & 2) - 1.0;
    let y = f32(i32(vertex_id & 2u)) - 1.0;
    out.position = vec4f(x, y, 0.0, 1.0);
    out.uv = vec2f(x * 0.5 + 0.5, 1.0 - (y * 0.5 + 0.5));
    return out;
}

// =====================================================================
// 2. PROCEDURAL 5x7 BITMASK TYPOGRAPHY & DECIMAL GLYPH ENGINE
// =====================================================================
fn getASCIIBitmask(ascii_char: u32) -> u32 {
    switch (ascii_char) {
        case 65u: { return 114881646u; }  // A
        case 66u: { return 474403183u; }  // B
        case 67u: { return 242225431u; }  // C
        case 68u: { return 440930607u; }  // D
        case 69u: { return 502419743u; }  // E
        case 70u: { return 502419512u; }  // F
        case 71u: { return 242258215u; }  // G
        case 72u: { return 323924340u; }  // H
        case 73u: { return 142674238u; }  // I
        case 74u: { return 136384878u; }  // J
        case 75u: { return 324151604u; }  // K
        case 76u: { return 225448191u; }  // L
        case 77u: { return 324867444u; }  // M
        case 78u: { return 324659572u; }  // N
        case 79u: { return 114884974u; }  // O
        case 80u: { return 474403128u; }  // P
        case 81u: { return 114885022u; }  // Q
        case 82u: { return 474403188u; }  // R
        case 83u: { return 242395454u; }  // S
        case 84u: { return 505291038u; }  // T
        case 85u: { return 322965870u; }  // U
        case 86u: { return 322965800u; }  // V
        case 87u: { return 322979189u; }  // W
        case 88u: { return 323863892u; }  // X
        case 89u: { return 323859746u; }  // Y
        case 90u: { return 504443199u; }  // Z
        case 45u: { return 33792u;     }  // -
        case 48u: { return 315999966u; }  // 0
        case 49u: { return 132640812u; }  // 1
        case 50u: { return 491404127u; }  // 2
        case 51u: { return 491131231u; }  // 3
        case 52u: { return 324911140u; }  // 4
        case 53u: { return 500330847u; }  // 5
        case 54u: { return 500343135u; }  // 6
        case 55u: { return 503484436u; }  // 7
        case 56u: { return 315999583u; }  // 8
        case 57u: { return 315999551u; }  // 9
        default:  { return 0u;         }  // Space
    }
}

fn drawGlyph(p: vec2f, ascii: u32) -> f32 {
    if (p.x < 0.0 || p.x > 1.0 || p.y < 0.0 || p.y > 1.0) { return 0.0; }
    let col = i32(floor(p.x * 5.0));
    let row = i32(floor((1.0 - p.y) * 7.0));
    let bit_status = (getASCIIBitmask(ascii) >> (34u - u32(row * 5 + col))) & 1u;
    return f32(bit_status);
}

fn renderLabel8(p: vec2f, slot_idx: u32) -> f32 {
    let stride = 0.122;
    var intensity = 0.0;
    for (var i = 0u; i < 8u; i = i + 1u) {
        let char_p = p - vec2f(f32(i) * stride, 0.0);
        let ascii_val = labelData[slot_idx].chars[i];
        intensity += drawGlyph(char_p / vec2f(0.095, 1.0), ascii_val);
    }
    return clamp(intensity, 0.0, 1.0);
}

fn renderDecimalMetric(p: vec2f, val: f32) -> f32 {
    let clamped = clamp(val, 0.0, 9.99);
    let d0 = u32(floor(clamped)) + 48u;
    let d1 = (u32(floor(clamped * 10.0)) % 10u) + 48u;
    let d2 = (u32(floor(clamped * 100.0)) % 10u) + 48u;

    var out = 0.0;
    out += drawGlyph(p / vec2f(0.22, 1.0), d0);
    if (p.x >= 0.24 && p.x <= 0.28 && p.y >= 0.0 && p.y <= 0.14) { out += 1.0; }
    out += drawGlyph((p - vec2f(0.32, 0.0)) / vec2f(0.22, 1.0), d1);
    out += drawGlyph((p - vec2f(0.58, 0.0)) / vec2f(0.22, 1.0), d2);
    return clamp(out, 0.0, 1.0);
}

// =====================================================================
// 3. PROCEDURAL NOISE, SDF GEOMETRY & 3D MORPHOGENETIC FRACTAL ENGINE
// =====================================================================
fn randomNoise2D(st: vec2f, seed: f32) -> f32 {
    return fract(sin(dot(st.xy, vec2f(12.9898, 78.233))) * 43758.5453123 + seed);
}

fn smin(a: f32, b: f32, k: f32) -> f32 {
    let h = max(k - abs(a - b), 0.0) / k;
    return min(a, b) - h * h * h * k * (1.0 / 6.0);
}

fn sdRoundedBox(p: vec2f, b: vec2f, r: f32) -> f32 {
    let q = abs(p) - b + vec2f(r);
    return min(max(q.x, q.y), 0.0) + length(max(q, vec2f(0.0))) - r;
}

fn rotate2D(p: vec2f, a: f32) -> vec2f {
    let c = cos(a);
    let s = sin(a);
    return vec2f(p.x * c - p.y * s, p.x * s + p.y * c);
}

// 3D Morphogenetic Fractal SDF driven by Geo Latitude, IP Entropy, Scroll Phase & System-1 State
fn deFractalOrganism(pos: vec3f) -> vec4f {
    var p = pos;
    let time_wave = u.system_time * (0.35 + u.org_tension * 0.45) + u.scroll_phase * 0.5;
    let distortion = 0.18 + u.org_tension * 0.35 + u.frustration_score * 0.25;

    p.x += sin(p.z * 2.0 + time_wave + u.ip_entropy_hash * 6.28) * distortion * 0.2;
    p.y += cos(p.x * 2.0 + time_wave + u.geo_lon_norm * 6.28) * distortion * 0.2;

    var scale = 1.0;
    var orbit_glow = 0.0;
    let coriolis_lat = (u.geo_lat_norm - 0.5) * 0.65;

    for (var i = 0; i < 5; i = i + 1) {
        p = abs(p) - vec3f(0.28 + u.ip_entropy_hash * 0.06, 0.38, 0.30);
        let r_xy = rotate2D(p.xy, 0.38 + coriolis_lat + time_wave * 0.08);
        p.x = r_xy.x; p.y = r_xy.y;
        let r_yz = rotate2D(p.yz, 0.22 - coriolis_lat + time_wave * 0.05);
        p.y = r_yz.x; p.z = r_yz.y;

        let dot_p = dot(p, p);
        let factor = 1.35 / clamp(dot_p, 0.03, 1.0);
        p = p * factor;
        scale = scale * factor;
        orbit_glow += exp(-dot_p * 7.5);
    }

    let d_box = (length(max(abs(p) - vec3f(0.38), vec3f(0.0))) - 0.02) / scale;
    let d_inner = (length(p) - 0.1) / scale;
    return vec4f(p.x, p.y, orbit_glow, max(d_box, -d_inner));
}

fn palette(t: f32) -> vec3f {
    let angle = (t + u.user_hue_shift + u.ip_entropy_hash * 0.15) * 6.28318530718;
    return vec3f(
        cos(angle) * 0.42 + 0.52,
        sin(angle * 1.25) * 0.40 + 0.55,
        cos(angle + 2.094) * 0.36 + 0.60
    );
}

@fragment
fn fragment_main(in: VertexOutput) -> @location(0) vec4f {
    var p = in.uv * 2.0 - 1.0;
    let raw_p = p;
    p.x *= u.aspect_ratio;

    let pointer_ndc = vec2f((u.pointer_x * 2.0 - 1.0) * u.aspect_ratio, u.pointer_y * 2.0 - 1.0);
    let dist_to_pointer = length(p - pointer_ndc);

    // 1. ANTI-TAMPER STANDING WAVE WATERMARK + PROCEDURAL NOISE GRAIN (`feeed.md`)
    let ripple = sin(dist_to_pointer * 26.0 - u.system_time * 4.5) * exp(-dist_to_pointer * 3.2) * 0.14;
    let wave_freq = 48.0 + u.ip_entropy_hash * 14.0;
    let wave_calc = sin((raw_p.x + ripple) * wave_freq + u.system_time + u.scroll_phase) *
                    cos((raw_p.y + ripple) * wave_freq - u.system_time * 0.45);
    let grid_lines = smoothstep(0.014, 0.0, abs(wave_calc) - 0.002);

    let raw_static = randomNoise2D(in.uv * (1.0 + u.system_time * 0.1), u.system_time);
    let active_noise_envelope = raw_static * u.org_tension * 0.09;

    // Modulate background luminance by both Barycentric contrast and real-world Solar Zenith angle
    let diurnal_luma = mix(0.006, 0.028, u.solar_zenith * 0.4 + u.user_contrast * 0.6);
    var bg_rgb = vec3f(diurnal_luma + active_noise_envelope) +
                 vec3f(grid_lines * mix(0.006, 0.032, u.org_tension));

    // 2. 3D MORPHOGENETIC FRACTAL RAY-MARCHING LAYER (`attempt/demo.md`)
    if (u.fractal_morph_blend > 0.02) {
        let ro = vec3f((u.pointer_x - 0.5) * 0.35, (u.pointer_y - 0.5) * 0.35, -1.85);
        let rd = normalize(vec3f(p.x, p.y, 1.15));
        var depth = 0.0;
        var acc_glow = 0.0;
        var sample_v = vec4f(0.0);
        for (var st = 0; st < 32; st = st + 1) {
            let pos3 = ro + rd * depth;
            sample_v = deFractalOrganism(pos3);
            let d3 = sample_v.w;
            acc_glow += sample_v.z * exp(-abs(d3) * 4.5);
            if (d3 < 0.002 || depth > 4.0) { break; }
            depth += d3 * 0.85;
        }
        let fractal_col = palette(acc_glow * 0.03 + u.system_time * 0.04) * acc_glow * 0.018;
        bg_rgb = mix(bg_rgb, bg_rgb + fractal_col, u.fractal_morph_blend);
    }

    // 3. SYSTEM-1 FOVEATED FOCUS FIELD GLOW (Reading Reward Loop)
    // Dilates soothing sage/cream luminescence around the user's gaze/cursor when organic reading is high
    let pulse = sin(u.system_time * 2.0) * 0.05 + 0.95;
    let focus_glow = smoothstep(1.15, 0.12, dist_to_pointer) * u.organic_reading_score * pulse;
    let sage_reward_tint = vec3f(0.05, 0.17, 0.14);
    bg_rgb = mix(bg_rgb, bg_rgb + sage_reward_tint, focus_glow * 0.68);

    // 4. BARYCENTRIC CHROMATIC PALETTE
    let active_palette = mix(
        palette(0.0),
        vec3f(0.92, 0.25, 0.18),
        clamp(u.frustration_score * 0.85, 0.0, 1.0)
    );

    // 5. 5D TELEMETRY REPOSITORY CELL MATRIX (`build.md`, `core.md`, `done.md`)
    // Foveated typographic relaxation expands grid breathing room when organic_reading_score -> 1.0
    let spacing_factor = mix(0.40, 0.68, clamp(u.user_density + u.organic_reading_score * 0.10, 0.0, 1.0));
    let grid_spacing = vec2f(spacing_factor, spacing_factor * 0.72);
    let grid_origin = p - vec2f(0.22, -0.06);
    let cell_id = floor((grid_origin + grid_spacing * 0.5) / grid_spacing);
    var local_p = (grid_origin + grid_spacing * 0.5) - cell_id * grid_spacing - grid_spacing * 0.5;

    var final_rgb = bg_rgb;

    let col_idx = i32(cell_id.x) + 1;
    let row_idx = i32(cell_id.y) + 1;
    if (col_idx >= 0 && col_idx < 4 && row_idx >= 0 && row_idx < 2) {
        let u_index = u32(row_idx * 4 + col_idx);
        if (f32(u_index) < u.active_nodes) {
            let cell_hash = fract(sin(dot(cell_id, vec2f(12.9898, 78.233))) * 43758.5453);
            let cell_pulse = sin(u.system_time * (2.0 + cell_hash * 3.0)) * 0.008 * (1.0 - u.organic_reading_score * 0.5);

            // Contributor Capture gravitational well sag (`build.md`)
            local_p.y += sin(p.x * 2.5 + u.scroll_phase) * (u.contributor_capture * 0.025);

            // Magnetic pull toward pointer when frustrated or hovering nearby (`alive.md`)
            let cell_center_world = vec2f(0.22, -0.06) + cell_id * grid_spacing;
            let to_cursor = pointer_ndc - cell_center_world;
            let cursor_pull = exp(-length(to_cursor) * 3.8) * (0.016 + u.frustration_score * 0.04);
            local_p -= normalize(to_cursor + vec2f(1e-4)) * cursor_pull;

            // High-frequency tension wave distortion
            if (u.org_tension > 0.02 || u.frustration_score > 0.05) {
                let total_stress = clamp(u.org_tension + u.frustration_score * 0.7, 0.0, 1.0);
                local_p.x += sin(p.y * 42.0 + u.system_time * 24.0) * (total_stress * 0.012);
            }

            // Ownership dynamic controls width-to-height aspect ratio (`build.md`)
            let width_bias = mix(0.13, 0.185, u.owner_ratio);
            let box_dim = vec2f(width_bias, 0.108) * (spacing_factor * 1.75) + vec2f(cell_pulse);
            let corner_r = mix(0.002, 0.048, u.user_rounding);
            let d_card = sdRoundedBox(local_p, box_dim, corner_r);

            // Polynomial smooth minimum (smin) neighbor bridging under tension (`done.md`)
            let neighbor_bridge = sdRoundedBox(local_p - vec2f(grid_spacing.x, 0.0), box_dim, corner_r);
            let d_fused = smin(d_card, neighbor_bridge, mix(0.001, 0.085, u.org_tension));

            // Gini Concentration swells border stroke thickness (`feeed.md`)
            let stroke_w = mix(0.002, 0.013, u.gini_concentration);
            let border = smoothstep(0.004, 0.0, abs(d_fused) - stroke_w);
            let glow = exp(-abs(d_fused) * mix(38.0, 18.0, u.org_tension));

            // Render 8-char ASCII node title + live procedural decimal metric inside each cell
            let text_uv = (local_p - vec2f(-box_dim.x * 0.78, -box_dim.y * 0.45)) / vec2f(box_dim.x * 1.56, box_dim.y * 0.42);
            let text_mask = renderLabel8(text_uv, u_index);

            let num_uv = (local_p - vec2f(-box_dim.x * 0.45, box_dim.y * 0.12)) / vec2f(box_dim.x * 0.90, box_dim.y * 0.34);
            let metric_val = clamp(u.organic_reading_score * (0.7 + cell_hash * 0.3), 0.0, 0.99);
            let num_mask = renderDecimalMetric(num_uv, metric_val);

            let card_fill = smoothstep(0.004, -0.004, d_card);
            let interior_rgb = mix(bg_rgb, active_palette * 0.22, card_fill * 0.86);
            final_rgb = mix(interior_rgb, active_palette, border + glow * 0.28);
            final_rgb += vec3f(0.94, 0.98, 1.0) * (text_mask + num_mask * 0.75) * card_fill;
        }
    }

    // 6. PURE SHADER-RENDERED CONTROL HUD (BOTTOM-LEFT UV REGION)
    let hud_uv = in.uv;
    if (hud_uv.x >= 0.025 && hud_uv.x <= 0.315 && hud_uv.y >= 0.48 && hud_uv.y <= 0.96) {
        let hud_local = (hud_uv - vec2f(0.17, 0.72)) / vec2f(0.145, 0.24);
        let d_hud = sdRoundedBox(hud_local, vec2f(0.96, 0.96), mix(0.02, 0.12, u.user_rounding));
        if (d_hud < 0.02) {
            final_rgb = mix(final_rgb, vec3f(0.03, 0.04, 0.07), 0.91);
            let hud_border = smoothstep(0.015, 0.0, abs(d_hud) - 0.005);
            final_rgb = mix(final_rgb, active_palette * 0.85, hud_border);

            // 6 interactive shader sliders: Tension, Gini, 3 Chromosomes, and 3D Fractal Morph Blend
            let slider_values = array<f32, 6>(
                u.org_tension,
                u.gini_concentration,
                u.weight_0,
                u.weight_1,
                u.weight_2,
                u.fractal_morph_blend
            );

            for (var s = 0u; s < 6u; s = s + 1u) {
                let row_y = 0.54 + f32(s) * 0.068;
                let bar_uv = (hud_uv - vec2f(0.045, row_y)) / vec2f(0.24, 0.015);
                if (bar_uv.x >= 0.0 && bar_uv.x <= 1.0 && bar_uv.y >= 0.0 && bar_uv.y <= 1.0) {
                    let val = slider_values[s];
                    let is_filled = select(0.0, 1.0, bar_uv.x <= val);
                    final_rgb = mix(vec3f(0.10, 0.12, 0.18), active_palette, is_filled);
                }
                let lbl_uv = (hud_uv - vec2f(0.045, row_y - 0.025)) / vec2f(0.18, 0.019);
                let lbl_mask = renderLabel8(lbl_uv, 8u + s);
                final_rgb += vec3f(0.84, 0.90, 0.97) * lbl_mask;
            }
        }
    }

    return vec4f(final_rgb, 1.0);
}
