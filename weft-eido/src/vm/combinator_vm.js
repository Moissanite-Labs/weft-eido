/**
 * WEFT-EIDO // Lafont Interaction Combinator VM (C3) & 85/15 Metabolic Excision Valve (C5)
 * Synthesized from `/Users/kethuda/Documents/exo/weft/corpus/design/attempt/again/story.md`.
 *
 * Implements a zero-allocation 32-byte contiguous node arena for Lafont graph reduction
 * (`ERA`, `CON`, `DUP`, `VLV`, `FRC`, `SUP`), Frobenius Invariant Gate auditing, and
 * 85% Weaver / 15% Burn metabolic excision particle dynamics.
 */

export const OP = {
    ERA: 0, // Erasure Node
    CON: 1, // Constructor Node
    DUP: 2, // Duplicator Node
    VLV: 3, // Metabolic Valve (85/15 Invariant Gate)
    FRC: 4, // Fracture Monitor (85.0% Tension Halt)
    SUP: 5  // Superposition Node (Speculative Alpha/Beta Branch)
};

export class FlatCombinatorVM {
    constructor(maxNodes = 256) {
        this.maxNodes = maxNodes;
        this.arena = new ArrayBuffer(maxNodes * 32);
        this.view = new DataView(this.arena);

        this.x = new Float32Array(maxNodes);
        this.y = new Float32Array(maxNodes);
        this.vx = new Float32Array(maxNodes);
        this.vy = new Float32Array(maxNodes);
        this.active = new Uint8Array(maxNodes);

        this.nodeCount = 0;
        this.activePairs = [];
        this.frobeniusRadius = 120.0;
        this.candidateDrift = 18.0;

        this.metabolicMetrics = {
            excisionCount: 0,
            weaverAllocated: 0.0,
            burnedTissue: 0.0
        };
    }

    seedDefaultTopology(cx = 0.0, cy = 0.0) {
        this.active.fill(0);
        this.nodeCount = 0;
        this.activePairs = [];

        const n1 = this.allocateNode(OP.CON, cx - 0.25, cy - 0.1);
        const n2 = this.allocateNode(OP.DUP, cx + 0.25, cy - 0.1);
        const vlv = this.allocateNode(OP.VLV, cx, cy + 0.22);
        const frc = this.allocateNode(OP.FRC, cx - 0.35, cy + 0.20);

        this.link(n1, 0, n2, 0);
        this.link(n1, 1, vlv, 0);
        this.link(n2, 1, frc, 0);
    }

    allocateNode(op, x, y, meta = 0) {
        for (let i = 0; i < this.maxNodes; i++) {
            if (!this.active[i]) {
                const offset = i * 32;
                this.view.setUint8(offset + 0, op);
                this.view.setUint8(offset + 1, 0);
                this.view.setUint16(offset + 2, meta, true);
                this.view.setInt32(offset + 4, -1, true);
                this.view.setInt32(offset + 8, -1, true);
                this.view.setInt32(offset + 12, -1, true);

                this.x[i] = x;
                this.y[i] = y;
                this.vx[i] = 0;
                this.vy[i] = 0;
                this.active[i] = 1;
                this.nodeCount++;
                return i;
            }
        }
        return -1;
    }

    link(nodeA, portA, nodeB, portB) {
        if (nodeA < 0 || nodeB < 0) return;
        const offsetA = nodeA * 32 + 4 + (portA * 4);
        const offsetB = nodeB * 32 + 4 + (portB * 4);
        this.view.setInt32(offsetA, nodeB, true);
        this.view.setInt32(offsetB, nodeA, true);

        if (portA === 0 && portB === 0) {
            this.activePairs.push({ a: nodeA, b: nodeB });
        }
    }

    /**
     * Executes a single Lafont interaction combinator reduction step & 85/15 Metabolic Valve split.
     */
    stepReduction(systemicTensionPct = 18.5, budgetInvoice = 2.5) {
        // Frobenius drift update
        this.candidateDrift = Math.min(160.0, systemicTensionPct * 1.35);
        const frobeniusPassed = this.candidateDrift <= this.frobeniusRadius;

        if (this.activePairs.length === 0) {
            this.seedDefaultTopology();
        }

        const pair = this.activePairs.shift();
        if (!pair) return { event: "IDLE", frobeniusPassed };

        const { a, b } = pair;
        if (!this.active[a] || !this.active[b]) return { event: "STALE", frobeniusPassed };

        const opA = this.view.getUint8(a * 32);
        const opB = this.view.getUint8(b * 32);

        if ((opA === OP.FRC || opB === OP.FRC) && systemicTensionPct >= 85.0) {
            return { event: "FRACTURE_HALT", frobeniusPassed: false };
        }

        // Execute 85% Weaver / 15% Burn Metabolic Excision Valve
        const weaverShare = (budgetInvoice * 8500) / 10000;
        const burnShare = budgetInvoice - weaverShare;
        this.metabolicMetrics.excisionCount += 1;
        this.metabolicMetrics.weaverAllocated += weaverShare;
        this.metabolicMetrics.burnedTissue += burnShare;

        if (opA === opB && opA === OP.CON) {
            this.active[a] = 0;
            this.active[b] = 0;
            this.nodeCount -= 2;
            return { event: "ANNIHILATION", frobeniusPassed, metrics: this.metabolicMetrics };
        }

        if ((opA === OP.DUP && opB === OP.CON) || (opA === OP.CON && opB === OP.DUP)) {
            const cx = (this.x[a] + this.x[b]) * 0.5;
            const cy = (this.y[a] + this.y[b]) * 0.5;
            const nCon1 = this.allocateNode(OP.CON, cx - 0.08, cy - 0.08);
            const nCon2 = this.allocateNode(OP.CON, cx - 0.08, cy + 0.08);
            const nDup1 = this.allocateNode(OP.DUP, cx + 0.08, cy - 0.08);
            const nDup2 = this.allocateNode(OP.DUP, cx + 0.08, cy + 0.08);
            this.link(nCon1, 0, nDup1, 1);
            this.link(nCon2, 0, nDup2, 1);
            this.link(nCon1, 1, nDup2, 0);
            this.link(nCon2, 1, nDup1, 0);
            this.active[a] = 0;
            this.active[b] = 0;
            this.nodeCount -= 2;
            return { event: "COMMUTATION", frobeniusPassed, metrics: this.metabolicMetrics };
        }

        return { event: "REDUCTION", frobeniusPassed, metrics: this.metabolicMetrics };
    }
}
