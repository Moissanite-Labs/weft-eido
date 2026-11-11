/**
 * WEFT-EIDO // Barycentric Aesthetic Mixing Engine
 * Implements a Normalized Weight Vector Matrix with Unit-Circle Angular Hue Blending.
 * Guarantees that any number of simultaneous design chromosomes sum strictly to 1.0 (100%).
 */

export class BarycentricMixer {
    constructor(initialSlices = null) {
        this.slices = initialSlices || [
            {
                id: "MITHRAX-BRUTAL",
                weight: 0.75,
                rounding: 0.02,
                density: 0.24,
                hue_shift: 0.54, // Deep cyber teal
                contrast: 0.04
            },
            {
                id: "SAINT-AIRY-NEON",
                weight: 0.25,
                rounding: 0.92,
                density: 0.82,
                hue_shift: 0.82, // Electric violet-magenta
                contrast: 0.26
            },
            {
                id: "SAGE-HOMEOSIS",
                weight: 0.00,
                rounding: 0.65,
                density: 0.90,
                hue_shift: 0.34, // Soothing organic sage
                contrast: 0.14
            }
        ];
    }

    setWeight(index, weight) {
        if (index >= 0 && index < this.slices.length) {
            this.slices[index].weight = Math.max(0.0, Math.min(1.0, weight));
        }
    }

    getNormalizedWeights() {
        let total = 0.0;
        for (const s of this.slices) {
            total += s.weight;
        }
        if (total <= 1e-6) {
            return this.slices.map((_, i) => (i === 0 ? 1.0 : 0.0));
        }
        return this.slices.map((s) => s.weight / total);
    }

    /**
     * Computes the unified aesthetic vector and returns normalized parameters
     * ready for direct packing into the 64-byte WebGPU uniform buffer.
     * Optionally blends in Lineage Alpha (Safe/Calm) and Lineage Beta (Bold/Dense)
     * from the System-1 behavioral telemetry loop.
     */
    compileUnifiedVector(system1State = null) {
        let totalRawWeight = 0.0;
        for (const slice of this.slices) {
            totalRawWeight += slice.weight;
        }

        if (totalRawWeight <= 1e-6) {
            this.slices[0].weight = 1.0;
            totalRawWeight = 1.0;
        }

        let rounding = 0.0;
        let density = 0.0;
        let contrast = 0.0;
        let sinHue = 0.0;
        let cosHue = 0.0;

        for (const slice of this.slices) {
            const nw = slice.weight / totalRawWeight;
            rounding += slice.rounding * nw;
            density += slice.density * nw;
            contrast += slice.contrast * nw;

            const angle = slice.hue_shift * Math.PI * 2.0;
            sinHue += Math.sin(angle) * nw;
            cosHue += Math.cos(angle) * nw;
        }

        let hueShift = Math.atan2(sinHue, cosHue) / (Math.PI * 2.0);
        if (hueShift < 0.0) hueShift += 1.0;

        // If System-1 autonomous behavioral adaptation is active, modulate the vector
        // via competing Lineage Alpha (deep reading relaxation) vs Lineage Beta (high-density triage)
        if (system1State && system1State.autoAdapt) {
            const organic = system1State.probabilities.deep_processing;
            const chaotic = system1State.probabilities.skimming_chaotic + system1State.probabilities.frustrated * 0.5;

            // Lineage Alpha expands density (breathing room) and softens rounding
            rounding = Math.min(1.0, Math.max(0.0, rounding + organic * 0.18 - chaotic * 0.15));
            density = Math.min(1.0, Math.max(0.0, density + organic * 0.20 - chaotic * 0.22));
            contrast = Math.min(1.0, Math.max(0.0, contrast + organic * 0.08));
        }

        return {
            rounding,
            density,
            hue_shift: hueShift,
            contrast,
            normalizedWeights: this.getNormalizedWeights()
        };
    }

    /**
     * Exports the current compound aesthetic state as a portable SYM-2P strand.
     */
    exportSYM2PStrand() {
        const vec = this.compileUnifiedVector();
        return `SYM-2P::R${vec.rounding.toFixed(3)}:D${vec.density.toFixed(3)}:H${vec.hue_shift.toFixed(3)}:C${vec.contrast.toFixed(3)}`;
    }
}
