"""Standalone scientific trace of measured canonical motion; no gameplay writes."""
import json
import math
from pathlib import Path
import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt

base = Path(__file__).resolve().parents[3] / "docs/match-motion-continuity/final"
selected = json.loads((base / "trajectory-selection.json").read_text(encoding="utf-8"))
before = [p for p in json.loads((base / "measurements/before/trajectory-7.json").read_text(encoding="utf-8")) if p["id"] == selected["id"]]
after = [p for p in json.loads((base / "delivery-motion/trajectory-7.json").read_text(encoding="utf-8")) if p["id"] == selected["id"]]
fig, ax = plt.subplots(figsize=(12, 4.8), layout="constrained")
ax.plot([p["tick"] * .05 for p in before], [p["speed"] for p in before], color="#2271b2", label="Before: actual displacement speed", linewidth=1.5)
ax.plot([p["tick"] * .05 for p in before], [math.hypot(p["vx"], p["vy"]) for p in before], color="#db7c1e", linestyle="--", label="Before: stored velocity", linewidth=1.2)
ax.plot([p["tick"] * .05 for p in after], [p["speed"] for p in after], color="#1a8c58", label="After: actual displacement speed", linewidth=1.5)
ax.set(xlabel="Canonical time (seconds)", ylabel="Speed (metres/second)", xlim=(20, 40), ylim=(0, 8))
ax.set_title(f"Case 7 / seed 83731708 — {selected['name']} ({selected['role']})\nMeasured 50ms samples; same fixture/seed, with decisions diverging after motion changes", fontsize=12)
ax.grid(alpha=.2)
ax.legend(loc="upper right", fontsize=8)
fig.savefig(base / "trajectory.svg")
fig.savefig(base / "trajectory.png", dpi=160)
plt.close(fig)
