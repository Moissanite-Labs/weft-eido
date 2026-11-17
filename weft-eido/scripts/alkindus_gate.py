"""
===================================================================================
   MODULE: ALKINDUS_GATE // WEFT-EIDO ARCHITECTURAL FALSIFIER ENGINE
===================================================================================
Functional Role: Strict code-purity validation for serverless single-canvas nodes.
Operational Rule: Fail closed if archaic Web2 DOM layout elements are detected in index.html.
Synthesized from `/Users/kethuda/Documents/exo/weft/corpus/design/attempt/gate.md`.
===================================================================================
"""
import sys
import re

def execute_architectural_purity_audit(target_file="index.html"):
    print(f" 🛡️ [ALKINDUS AUDIT] Initiating static analysis on structural anchor: {target_file}")

    try:
        with open(target_file, "r", encoding="utf-8") as f:
            content = f.read()
    except FileNotFoundError:
        print(f" ❌ [CRITICAL FAULT] Structural target file missing: {target_file}")
        sys.exit(2)

    forbidden_dom_patterns = [
        (r"<div[\s>]", "HTML <div> Block Element"),
        (r"<span[\s>]", "HTML <span> Inline Element"),
        (r"<section[\s>]", "HTML <section> Layout Element"),
        (r"<table[\s>]", "HTML <table> Grid Element"),
        (r"<ul[\s>]|<ol[\s>]", "HTML List Structure Element"),
        (r"display:\s*(flex|grid)", "CSS Box Model Engine (Flex/Grid)"),
        (r"tailwindcss|bootstrap", "Extractive Third-Party UI Stylesheet Framework")
    ]

    violations_detected = []

    for pattern, descriptor in forbidden_dom_patterns:
        matches = re.findall(pattern, content, re.IGNORECASE)
        if matches:
            violations_detected.append(f"Smuggled Web2 Infrastructure Detected: {descriptor} (Count: {len(matches)})")

    canvas_count = len(re.findall(r"<canvas[\s>]", content, re.IGNORECASE))
    if canvas_count == 0:
        violations_detected.append("Sovereign Viewport Missing: HTML5 <canvas> render target not discovered.")
    elif canvas_count > 1:
        violations_detected.append(f"Structural Redundancy Fault: Discovered {canvas_count} canvas anchors. Exactly ONE allowed.")

    if violations_detected:
        print("=" * 85)
        print(" ❌ [ARCHITECTURAL CONTAMINATION DETECTED] FALSIFIER CLOSING GATE")
        print("=" * 85)
        for error in violations_detected:
            print(f"  ⚠️ [INFRACTION] -> {error}")
        print("=" * 85)
        sys.exit(1)

    print(" ✅ [AUDIT PASS] Structural integrity verified. Zero DOM layout blocks; single sovereign <canvas> confirmed.")
    sys.exit(0)

if __name__ == "__main__":
    target = sys.argv[1] if len(sys.argv) > 1 else "index.html"
    execute_architectural_purity_audit(target)
