"""
===================================================================================
   MODULE: SYNBIOS_HARVEST // SERVERLESS SYM-2P TELEMETRY & GINI HARVESTER
===================================================================================
Synthesized from `feeed.md` and `build.md`.
Calculates the 5-dimensional organizational telemetry metrics (including the economic
Gini Concentration index) and emits position-checked `SYM-2P` lines with SHA-256 hashes.
===================================================================================
"""
import os
import json
import hashlib
import urllib.request

def calculate_gini(contributions):
    scores = sorted([float(c) for c in contributions if c > 0])
    n = len(scores)
    if n <= 1 or sum(scores) == 0:
        return 0.0
    diff_sum = sum(abs(x_i - x_j) for x_i in scores for x_j in scores)
    return min(1.0, max(0.0, diff_sum / (2.0 * n * sum(scores))))

def synthesize_sym2p_packet(active_nodes=8.0, tension=0.18, gini=0.42, owner_ratio=0.72, resonance=0.64, capture=0.31):
    payload = (
        f"[s-exp (active_nodes {active_nodes:.1f}) "
        f"(tension {tension:.4f}) "
        f"(con {gini:.4f}) "
        f"(owner {owner_ratio:.2f}) "
        f"(res {resonance:.2f}) "
        f"(cap {capture:.2f})]"
    )
    packet_hash = hashlib.sha256(payload.encode("utf-8")).hexdigest()
    return f":01:03:0042{payload}{packet_hash}"

if __name__ == "__main__":
    sample_commits = [320, 85, 42, 19, 8]
    gini_val = calculate_gini(sample_commits)
    line = synthesize_sym2p_packet(active_nodes=8.0, tension=0.18, gini=gini_val)
    out_dir = os.path.join(os.path.dirname(__file__), "..", "data")
    os.makedirs(out_dir, exist_ok=True)
    with open(os.path.join(out_dir, "telemetry.jsonl"), "w", encoding="utf-8") as f:
        f.write(line + "\n")
    print(f" ✅ [SYM-2P Telemetry Ledger Updated]: {line}")
