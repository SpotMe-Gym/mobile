# SPDX-License-Identifier: MIT
"""
SpotMe avatar service — builds one MPFB2 body per request.

    POST /avatar   {"gender": "male|female|neutral", "heightCm": 182, "weightKg": 84}
      → model/gltf-binary, same format as the bundled assets/avatar/*.glb
    GET  /health

The phenotype (MPFB2 height / weight macros) is solved for the request and baked into the
mesh, so the returned body already has the person's proportions; the app's solver then only
fine-tunes. Each build runs build_avatars.py in a subprocess (Blender's context is only
reliable in a fresh process) and is cached on disk by (gender, height, weight) in whole units.

Standard-library HTTP server: put it behind a TLS-terminating proxy and an auth layer
before exposing it. One build at a time per container; scale with more containers.
"""

from __future__ import annotations

import json
import os
import struct
import subprocess
import sys
from http.server import BaseHTTPRequestHandler, HTTPServer

HERE = os.path.dirname(os.path.abspath(__file__))
BUILD_SCRIPT = os.path.join(HERE, "..", "build_avatars.py")
MPFB_DIR = os.environ.get("MPFB_DIR", "/opt/mpfb2/src/mpfb")
CACHE_DIR = os.environ.get("AVATAR_CACHE", "/var/cache/spotme-avatar")
PORT = int(os.environ.get("PORT", "8080"))
GENDERS = ("male", "female", "neutral")


def log(msg: str) -> None:
    print(f"[avatar-service] {msg}", flush=True)


def run_build(gender: str, out_dir: str, phenotype: dict | None = None) -> str:
    cmd = [sys.executable, BUILD_SCRIPT, "--mpfb", MPFB_DIR, "--out", out_dir, "--genders", gender]
    if phenotype:
        cmd += ["--phenotype", json.dumps(phenotype)]
    subprocess.run(cmd, check=True, stdout=subprocess.DEVNULL, stderr=subprocess.PIPE, timeout=600)
    return os.path.join(out_dir, f"{gender}.glb")


def read_ext(path: str) -> dict:
    with open(path, "rb") as fh:
        data = fh.read()
    js_len = struct.unpack("<I", data[12:16])[0]
    gltf = json.loads(data[20:20 + js_len])
    return gltf["meshes"][0]["primitives"][0]["extensions"]["SPOTME_body"]


def macro_value(target: float, base: float, up: float, down: float) -> float:
    """MPFB2 macro value (0–1) that moves `base` to `target`, linear in each direction."""
    diff = target - base
    step = diff / up if diff >= 0 and up > 0 else (-(diff / down) if down < 0 else 0.0)
    return min(1.0, max(0.0, 0.5 + 0.5 * step))


def phenotype_for(gender: str, height_cm: float, weight_kg: float) -> dict:
    """Maps height / weight to MPFB2 macros with the base model's calibration."""
    base_dir = os.path.join(CACHE_DIR, "_base")
    base_glb = os.path.join(base_dir, f"{gender}.glb")
    if not os.path.exists(base_glb):
        run_build(gender, base_dir)
    ext = read_ext(base_glb)
    base, morphs = ext["base"], ext["morphs"]
    height = macro_value(height_cm, base["heightCm"], morphs["macro_height_up"]["heightCm"], morphs["macro_height_down"]["heightCm"])
    h_step = (height - 0.5) / 0.5
    mass = base["massKg"] + abs(h_step) * morphs["macro_height_up" if h_step >= 0 else "macro_height_down"]["massKg"]
    weight = macro_value(weight_kg, mass, morphs["macro_weight_up"]["massKg"], morphs["macro_weight_down"]["massKg"])
    return {"height": round(height, 3), "weight": round(weight, 3)}


def build_for(gender: str, height_cm: float, weight_kg: float) -> bytes:
    out_dir = os.path.join(CACHE_DIR, f"{gender}-{round(height_cm)}-{round(weight_kg)}")
    path = os.path.join(out_dir, f"{gender}.glb")
    if not os.path.exists(path):
        phenotype = phenotype_for(gender, height_cm, weight_kg)
        log(f"building {gender} {height_cm:.0f} cm {weight_kg:.0f} kg → {phenotype}")
        run_build(gender, out_dir, phenotype)
    with open(path, "rb") as fh:
        return fh.read()


class Handler(BaseHTTPRequestHandler):
    def _send(self, code: int, body: bytes, ctype: str = "application/json") -> None:
        self.send_response(code)
        self.send_header("Content-Type", ctype)
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self) -> None:  # noqa: N802
        self._send(200, b'{"ok":true}') if self.path == "/health" else self._send(404, b'{"error":"not found"}')

    def do_POST(self) -> None:  # noqa: N802
        if self.path != "/avatar":
            self._send(404, b'{"error":"not found"}')
            return
        try:
            length = int(self.headers.get("Content-Length", "0"))
            if length > 4096:
                raise ValueError("request too large")
            req = json.loads(self.rfile.read(length) or b"{}")
            gender = req.get("gender")
            if gender not in GENDERS:
                raise ValueError("gender must be male, female or neutral")
            height = float(req.get("heightCm", 0))
            weight = float(req.get("weightKg", 0))
            if not (120 <= height <= 230 and 30 <= weight <= 250):
                raise ValueError("heightCm 120-230 and weightKg 30-250 required")
        except (ValueError, TypeError, json.JSONDecodeError) as exc:
            self._send(400, json.dumps({"error": str(exc)}).encode())
            return
        try:
            self._send(200, build_for(gender, height, weight), "model/gltf-binary")
        except subprocess.CalledProcessError as exc:
            log(f"build failed: {exc.stderr.decode(errors='replace')[-2000:]}")
            self._send(500, b'{"error":"build failed"}')


if __name__ == "__main__":
    os.makedirs(CACHE_DIR, exist_ok=True)
    log(f"listening on :{PORT}")
    HTTPServer(("0.0.0.0", PORT), Handler).serve_forever()
