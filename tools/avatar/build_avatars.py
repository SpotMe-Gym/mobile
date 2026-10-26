# SPDX-License-Identifier: MIT
"""
SpotMe — MPFB2 avatar pipeline
==============================

Builds the 3D body models used by the Body screen, headless and reproducibly:

    python3 build_avatars.py --mpfb /path/to/mpfb2/src/mpfb --out ../../assets/avatar

Requirements: Blender as a Python module (``pip install bpy``, matching the Python version
it ships for) and a checkout of MPFB2 (https://github.com/makehumancommunity/mpfb2). The same
script also runs inside Blender (``blender -b --python build_avatars.py -- --mpfb … --out …``)
and powers the optional generation service in ``service/``.

For each gender (male / female / neutral) it:

1. creates the MPFB2 base human (MakeHuman hm08 topology) with mid-range phenotype;
2. bakes macro morphs (height, weight, muscle — up and down) and circumference morphs
   (MPFB2 ``measure-*`` / muscle targets, split per side for limbs);
3. measures every circumference on the mesh — the MakeHuman ruler loops where MakeHuman
   defines one, otherwise a tape-measure slice (convex hull of the body cross-section) —
   with each morph off and fully on, giving a calibration matrix in **cm per unit morph**;
4. estimates body mass from mesh volume for the weight solve;
5. classifies every vertex into a body part (nearest bone) and builds one highlight zone per
   measurement (a soft band around where the tape goes);
6. writes ``<gender>.glb``: base mesh + sparse morph targets + a ``SPOTME_body`` extension
   holding calibration, zones and parts. The app (``src/features/body/avatar``) reads it.

Coordinates in the GLB are glTF: metres, +Y up, the body faces +Z, feet at y = 0.

MakeHuman / MPFB2 assets (base mesh, targets) are CC0. The ruler vertex loops below are the
measurement definitions from MakeHuman 1.x (plugins/0_modeling_a_measurement.py).
"""

from __future__ import annotations

import argparse
import importlib
import json
import math
import os
import struct
import sys

import numpy as np

try:
    import bpy  # noqa: F401
    import addon_utils
except ImportError:  # pragma: no cover
    sys.exit("Blender's bpy module is required (pip install bpy, or run inside Blender).")

FORMAT_VERSION = 1
BODY_VERTS = 13380  # hm08: vertices 0..13379 are skin; the rest are helpers / joint cubes
BODY_DENSITY = 985.0  # kg/m³, whole body including lungs

GENDERS = {"male": 1.0, "female": 0.0, "neutral": 0.5}

BASE_PHENOTYPE = {
    "age": 0.5,  # 25 years
    "muscle": 0.5,
    "weight": 0.5,
    "height": 0.5,
    "proportions": 0.5,
    "cupsize": 0.5,
    "firmness": 0.5,
    "race": {"caucasian": 1 / 3, "asian": 1 / 3, "african": 1 / 3},
}

MACROS = ("height", "weight", "muscle")

# Measurement key → MPFB2 target stem(s) (``<stem>-incr`` / ``<stem>-decr``) and side.
# ``side`` None = whole target; "L"/"R" = keep only that side of a symmetric target.
MORPHS = {
    "neck": {"stems": ["measure-neck-circ"]},
    "shoulders": {"stems": ["l-upperarm-shoulder-muscle", "r-upperarm-shoulder-muscle"]},
    "chest": {"stems": ["measure-bust-circ"]},
    "waist": {"stems": ["measure-waist-circ"]},
    "hips": {"stems": ["measure-hips-circ"]},
    "upperAbdomen": {"stems": ["measure-underbust-circ"]},
    "lowerAbdomen": {"stems": ["stomach-pregnant"]},
    "bicepsL": {"stems": ["measure-upperarm-circ"], "side": "L"},
    "bicepsR": {"stems": ["measure-upperarm-circ"], "side": "R"},
    "forearmL": {"stems": ["l-lowerarm-muscle"], "side": "L"},
    "forearmR": {"stems": ["r-lowerarm-muscle"], "side": "R"},
    "wristL": {"stems": ["measure-wrist-circ"], "side": "L"},
    "wristR": {"stems": ["measure-wrist-circ"], "side": "R"},
    "thighL": {"stems": ["measure-thigh-circ"], "side": "L"},
    "thighR": {"stems": ["measure-thigh-circ"], "side": "R"},
    "kneeL": {"stems": ["measure-knee-circ"], "side": "L"},
    "kneeR": {"stems": ["measure-knee-circ"], "side": "R"},
    "calfL": {"stems": ["measure-calf-circ"], "side": "L"},
    "calfR": {"stems": ["measure-calf-circ"], "side": "R"},
    "ankleL": {"stems": ["measure-ankle-circ"], "side": "L"},
    "ankleR": {"stems": ["measure-ankle-circ"], "side": "R"},
}

# MakeHuman 1.x ruler loops (hm08 vertex indices), one side for limbs.
RULER = {
    "neck": [7514, 10358, 7631, 7496, 7488, 7489, 7474, 7475, 7531, 7537, 7543, 7549, 7555, 7561, 7743, 7722, 856, 1030, 1051, 850, 844, 838, 832, 826, 820, 756, 755, 770, 769, 777, 929, 3690, 804, 800, 808, 801, 799, 803, 7513, 7515, 7521, 7514],
    "biceps": [8383, 8393, 8392, 8391, 8390, 8394, 8395, 8399, 10455, 10516, 8396, 8397, 8398, 8388, 8387, 8386, 10431, 8385, 8384, 8389],
    "wrist": [10208, 10211, 10212, 10216, 10471, 10533, 10213, 10214, 10215, 10205, 10204, 10203, 10437, 10202, 10201, 10206, 10200, 10210, 10209, 10208],
    "chest": [8439, 8455, 8462, 8446, 8478, 8494, 8557, 8510, 8526, 8542, 10720, 10601, 10603, 10602, 10612, 10611, 10610, 10613, 10604, 10605, 10606, 3942, 3941, 3940, 3950, 3947, 3948, 3949, 3938, 3939, 3937, 4065, 1870, 1854, 1838, 1885, 1822, 1806, 1774, 1790, 1783, 1767, 1799, 8471],
    "underbust": [10750, 10744, 10724, 10725, 10748, 10722, 10640, 10642, 10641, 10651, 10650, 10649, 10652, 10643, 10644, 10645, 10646, 10647, 10648, 3988, 3987, 3986, 3985, 3984, 3983, 3982, 3992, 3989, 3990, 3991, 3980, 3981, 3979, 4067, 4098, 4073, 4072, 4094, 4100, 4082, 4088, 4088],
    "waist": [4121, 10760, 10757, 10777, 10776, 10779, 10780, 10778, 10781, 10771, 10773, 10772, 10775, 10774, 10814, 10834, 10816, 10817, 10818, 10819, 10820, 10821, 4181, 4180, 4179, 4178, 4177, 4176, 4175, 4196, 4173, 4131, 4132, 4129, 4130, 4128, 4138, 4135, 4137, 4136, 4133, 4134, 4108, 4113, 4118, 4121],
    "hips": [4341, 10968, 10969, 10971, 10970, 10967, 10928, 10927, 10925, 10926, 10923, 10924, 10868, 10875, 10861, 10862, 4228, 4227, 4226, 4242, 4234, 4294, 4293, 4296, 4295, 4297, 4298, 4342, 4345, 4346, 4344, 4343, 4361, 4341],
    "thigh": [11071, 11080, 11081, 11086, 11076, 11077, 11074, 11075, 11072, 11073, 11069, 11070, 11087, 11085, 11084, 12994, 11083, 11082, 11079, 11071],
    "calf": [11339, 11336, 11353, 11351, 11350, 13008, 11349, 11348, 11345, 11337, 11344, 11346, 11347, 11352, 11342, 11343, 11340, 11341, 11338, 11339],
    "ankle": [11460, 11464, 11458, 11459, 11419, 11418, 12958, 12965, 12960, 12963, 12961, 12962, 12964, 12927, 13028, 12957, 11463, 11461, 11457, 11460],
    "knee": [11223, 11230, 11232, 11233, 11238, 11228, 11229, 11226, 11227, 11224, 11225, 11221, 11222, 11239, 11237, 11236, 13002, 11235, 11234, 11223],
}

# Body parts (nearest bone). Order = id stored per vertex in the GLB (_PART attribute).
PARTS = [
    "head", "neck", "torso",
    "upperarmL", "forearmL", "handL", "upperarmR", "forearmR", "handR",
    "thighL", "shinL", "footL", "thighR", "shinR", "footR",
]
SEGMENT_OF_PART = {
    "head": "trunk", "neck": "trunk", "torso": "trunk",
    "upperarmL": "armL", "forearmL": "armL", "handL": "armL",
    "upperarmR": "armR", "forearmR": "armR", "handR": "armR",
    "thighL": "legL", "shinL": "legL", "footL": "legL",
    "thighR": "legR", "shinR": "legR", "footR": "legR",
}

# Which parts each highlight zone may colour, and the band half-width (m).
ZONES = {
    "neck": (["neck"], 0.035),
    "shoulders": (["torso", "upperarmL", "upperarmR"], 0.05),
    "chest": (["torso"], 0.05),
    "upperAbdomen": (["torso"], 0.04),
    "waist": (["torso"], 0.045),
    "lowerAbdomen": (["torso"], 0.04),
    "hips": (["torso", "thighL", "thighR"], 0.05),
    "bicepsL": (["upperarmL"], 0.05), "bicepsR": (["upperarmR"], 0.05),
    "forearmL": (["forearmL"], 0.045), "forearmR": (["forearmR"], 0.045),
    "wristL": (["forearmL", "handL"], 0.025), "wristR": (["forearmR", "handR"], 0.025),
    "thighL": (["thighL"], 0.06), "thighR": (["thighR"], 0.06),
    "kneeL": (["thighL", "shinL"], 0.035), "kneeR": (["thighR", "shinR"], 0.035),
    "calfL": (["shinL"], 0.05), "calfR": (["shinR"], 0.05),
    "ankleL": (["shinL", "footL"], 0.03), "ankleR": (["shinR", "footR"], 0.03),
}

HS = TS = HOP = None  # MPFB2 services, set by bootstrap_mpfb()


def log(msg: str) -> None:
    print(f"[avatar] {msg}", flush=True)


# ---------------------------------------------------------------------------
# MPFB2 bootstrap
# ---------------------------------------------------------------------------

def bootstrap_mpfb(mpfb_dir: str) -> None:
    """Install MPFB2 as a user extension (symlink) and enable it, so its services import."""
    global HS, TS, HOP
    ext_root = bpy.utils.user_resource("EXTENSIONS", path="user_default", create=True)
    link = os.path.join(ext_root, "mpfb")
    if not os.path.exists(link):
        os.symlink(os.path.abspath(mpfb_dir), link)
    pkg = "bl_ext.user_default.mpfb"
    addon_utils.enable(pkg, default_set=True, handle_error=lambda e: sys.exit(f"MPFB2 failed to load: {e}"))
    HS = importlib.import_module(pkg + ".services.humanservice").HumanService
    TS = importlib.import_module(pkg + ".services.targetservice").TargetService
    HOP = importlib.import_module(pkg + ".entities.objectproperties").HumanObjectProperties
    log("MPFB2 ready")


# ---------------------------------------------------------------------------
# Mesh access
# ---------------------------------------------------------------------------

def coords(obj) -> np.ndarray:
    """All vertex positions (incl. helpers) with shape keys applied, in glTF axes."""
    dg = bpy.context.evaluated_depsgraph_get()
    ev = obj.evaluated_get(dg)
    mesh = ev.to_mesh()
    arr = np.empty(len(mesh.vertices) * 3, dtype=np.float64)
    mesh.vertices.foreach_get("co", arr)
    ev.to_mesh_clear()
    arr = arr.reshape(-1, 3)
    # Blender: Z up, body faces -Y  →  glTF: Y up, body faces +Z
    return np.stack([arr[:, 0], arr[:, 2], -arr[:, 1]], axis=1)


def set_macro(obj, name: str, value: float) -> None:
    HOP.set_value(name, float(value), entity_reference=obj)
    TS.reapply_macro_details(obj, remove_zero_weight_targets=True)


def target_delta(obj, stem: str, direction: str, base: np.ndarray) -> np.ndarray:
    name = f"{stem}-{direction}"
    path = TS.target_full_path(name)
    if not path:
        raise FileNotFoundError(f"MPFB2 target not found: {name}")
    key = TS.load_target(obj, path, weight=1.0, name=name)
    delta = coords(obj) - base
    obj.shape_key_remove(key)
    return delta


def body_triangles(obj) -> np.ndarray:
    tris = []
    for poly in obj.data.polygons:
        v = list(poly.vertices)
        if max(v) >= BODY_VERTS:
            continue
        for i in range(1, len(v) - 1):
            tris.append((v[0], v[i], v[i + 1]))
    return np.asarray(tris, dtype=np.int64)


# ---------------------------------------------------------------------------
# Geometry: joints, parts, measurements
# ---------------------------------------------------------------------------

JOINT_INDICES: dict[str, np.ndarray] = {}


def load_joint_indices(mpfb_dir: str) -> None:
    """Joint helper cubes from MPFB2's hm08 vertex-group table (ranges [start, end])."""
    with open(os.path.join(mpfb_dir, "data", "mesh_metadata", "basemesh_vertex_groups.json"), encoding="utf-8") as fh:
        groups = json.load(fh)
    for name, ranges in groups.items():
        if name.startswith("joint-"):
            idx = np.concatenate([np.arange(a, b + 1) for a, b in ranges])
            JOINT_INDICES[name[6:]] = idx


def joint_positions(pts: np.ndarray) -> dict[str, np.ndarray]:
    return {k: pts[v].mean(axis=0) for k, v in JOINT_INDICES.items()}


def left_sign(j: dict[str, np.ndarray]) -> float:
    """+1 if the character's left side is +x in glTF space, else -1."""
    return 1.0 if j["l-shoulder"][0] > 0 else -1.0


def bones(j: dict[str, np.ndarray]) -> list[tuple[str, np.ndarray, np.ndarray]]:
    spine = sorted([j["pelvis"], j["spine-4"], j["spine-3"], j["spine-2"], j["spine-1"], j["neck"]], key=lambda p: p[1])
    out = [("torso", spine[i], spine[i + 1]) for i in range(len(spine) - 1)]
    out += [("neck", j["neck"], j["head"]), ("head", j["head"], j["head-2"])]
    for s, side in (("l", "L"), ("r", "R")):
        out += [
            ("torso", j["neck"], j[f"{s}-clavicle"]),
            ("torso", j[f"{s}-clavicle"], j[f"{s}-shoulder"] * 0.5 + j[f"{s}-clavicle"] * 0.5),
            ("torso", j["pelvis"], j[f"{s}-upper-leg"]),
            (f"upperarm{side}", j[f"{s}-shoulder"], j[f"{s}-elbow"]),
            (f"forearm{side}", j[f"{s}-elbow"], j[f"{s}-hand"]),
            (f"hand{side}", j[f"{s}-hand"], j[f"{s}-hand-3"]),
            (f"thigh{side}", j[f"{s}-upper-leg"], j[f"{s}-knee"]),
            (f"shin{side}", j[f"{s}-knee"], j[f"{s}-ankle"]),
            (f"foot{side}", j[f"{s}-ankle"], j[f"{s}-foot-2"]),
        ]
    return out


def seg_dist(p: np.ndarray, a: np.ndarray, b: np.ndarray) -> np.ndarray:
    ab = b - a
    t = np.clip(((p - a) @ ab) / max(ab @ ab, 1e-12), 0.0, 1.0)
    return np.linalg.norm(p - (a + t[:, None] * ab), axis=1)


def classify_parts(pts: np.ndarray, j) -> np.ndarray:
    bl = bones(j)
    dist = np.stack([seg_dist(pts, a, b) for _, a, b in bl], axis=1)
    nearest = dist.argmin(axis=1)
    return np.asarray([PARTS.index(bl[k][0]) for k in nearest], dtype=np.uint8)


def loop_length(pts: np.ndarray, loop: list[int]) -> float:
    p = pts[loop]
    return float(np.linalg.norm(np.diff(p, axis=0), axis=1).sum())


def hull_perimeter(points2d: np.ndarray) -> float:
    pts = sorted(set(map(tuple, np.round(points2d, 6))))
    if len(pts) < 3:
        return 0.0

    def cross(o, a, b):
        return (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0])

    lower, upper = [], []
    for p in pts:
        while len(lower) >= 2 and cross(lower[-2], lower[-1], p) <= 0:
            lower.pop()
        lower.append(p)
    for p in reversed(pts):
        while len(upper) >= 2 and cross(upper[-2], upper[-1], p) <= 0:
            upper.pop()
        upper.append(p)
    hull = np.asarray(lower[:-1] + upper[:-1])
    return float(np.linalg.norm(hull - np.roll(hull, -1, axis=0), axis=1).sum())


def slice_loops(pts: np.ndarray, tris: np.ndarray, origin: np.ndarray, normal: np.ndarray):
    """Cross-section of the mesh with a plane → list of connected point sets."""
    n = normal / np.linalg.norm(normal)
    d = (pts[:BODY_VERTS] - origin) @ n
    s = d[tris] > 0
    crossing = tris[(s.any(axis=1)) & (~s.all(axis=1))]
    points: dict[tuple[int, int], np.ndarray] = {}
    parent: dict[tuple[int, int], tuple[int, int]] = {}

    def find(x):
        while parent[x] != x:
            parent[x] = parent[parent[x]]
            x = parent[x]
        return x

    for tri in crossing:
        keys = []
        for a, b in ((tri[0], tri[1]), (tri[1], tri[2]), (tri[2], tri[0])):
            if (d[a] > 0) == (d[b] > 0):
                continue
            k = (min(a, b), max(a, b))
            if k not in points:
                t = d[a] / (d[a] - d[b])
                points[k] = pts[a] + t * (pts[b] - pts[a])
                parent[k] = k
            keys.append(k)
        for k in keys[1:]:
            ra, rb = find(keys[0]), find(k)
            if ra != rb:
                parent[ra] = rb
    groups: dict = {}
    for k, p in points.items():
        groups.setdefault(find(k), []).append(p)
    return [np.asarray(g) for g in groups.values()], n


def plane_basis(n: np.ndarray):
    a = np.array([1.0, 0.0, 0.0]) if abs(n[0]) < 0.9 else np.array([0.0, 1.0, 0.0])
    u = np.cross(n, a)
    u /= np.linalg.norm(u)
    return u, np.cross(n, u)


def tape(pts, tris, origin, normal, anchor, union_radius: float | None = None) -> tuple[float, np.ndarray]:
    """Tape-measure circumference: convex hull of the cross-section loop nearest `anchor`."""
    loops, n = slice_loops(pts, tris, origin, normal)
    if not loops:
        return 0.0, np.empty((0, 3))
    if union_radius is not None:
        chosen = np.concatenate([lp for lp in loops if np.linalg.norm(lp.mean(axis=0) - anchor) < union_radius])
    else:
        chosen = min(loops, key=lambda lp: np.linalg.norm(lp.mean(axis=0) - anchor))
    u, v = plane_basis(n)
    rel = chosen - origin
    return hull_perimeter(np.stack([rel @ u, rel @ v], axis=1)), chosen


class Measurer:
    """Measures every circumference (cm) on an arbitrary pose of the same topology."""

    def __init__(self, obj, base: np.ndarray, tris: np.ndarray, mirror: np.ndarray):
        self.obj, self.tris, self.mirror = obj, tris, mirror
        j = joint_positions(base)
        self.j = j
        self.lsign = left_sign(j)
        # Which side the MakeHuman ruler loops are on, per limb loop.
        self.ruler_side = {
            k: ("L" if np.sign(base[RULER[k]][:, 0].mean()) == self.lsign else "R")
            for k in ("biceps", "wrist", "thigh", "calf", "ankle", "knee")
        }

    def ruler(self, key: str, side: str | None) -> list[int]:
        loop = RULER[key]
        if side is None or self.ruler_side[key] == side:
            return loop
        return [int(self.mirror[i]) for i in loop]

    def measure(self, pts: np.ndarray, with_loops: bool = False):
        j = joint_positions(pts)
        out: dict[str, float] = {}
        loops: dict[str, np.ndarray] = {}

        def put(key, cm, loop_pts):
            out[key] = round(cm * 100.0, 3)
            loops[key] = loop_pts

        for key, rk in (("neck", "neck"), ("chest", "chest"), ("waist", "waist"), ("hips", "hips")):
            loop = self.ruler(rk, None)
            put(key, loop_length(pts, loop), pts[loop])
        for side in ("L", "R"):
            for key, rk in (("biceps", "biceps"), ("wrist", "wrist"), ("thigh", "thigh"),
                            ("calf", "calf"), ("ankle", "ankle"), ("knee", "knee")):
                loop = self.ruler(rk, side)
                put(f"{key}{side}", loop_length(pts, loop), pts[loop])
        up = np.array([0.0, 1.0, 0.0])
        # Shoulders: horizontal tape over both deltoids, just below the shoulder joints.
        ls, rs = j["l-shoulder"], j["r-shoulder"]
        y = (ls[1] + rs[1]) / 2 - 0.035
        origin = np.array([0.0, y, (ls[2] + rs[2]) / 2])
        half = abs(ls[0] - rs[0]) / 2 + 0.12
        loops_s, _ = slice_loops(pts, self.tris, origin, up)
        sel = np.concatenate([lp for lp in loops_s if abs(lp.mean(axis=0)[0]) < half]) if loops_s else np.empty((0, 3))
        put("shoulders", hull_perimeter(sel[:, [0, 2]]) if len(sel) else 0.0, sel)
        # Abdomen: horizontal tapes between underbust ↔ waist and waist ↔ hips loops.
        yu = pts[RULER["underbust"]][:, 1].mean()
        yw = pts[RULER["waist"]][:, 1].mean()
        yh = pts[RULER["hips"]][:, 1].mean()
        zc = pts[RULER["waist"]][:, 2].mean()
        for key, yy in (("upperAbdomen", (yu + yw) / 2), ("lowerAbdomen", (yw + yh) / 2)):
            o = np.array([0.0, yy, zc])
            cm, lp = tape(pts, self.tris, o, up, o)
            put(key, cm, lp)
        # Forearms: perpendicular to the forearm, a third of the way from the elbow.
        for s, side in (("l", "L"), ("r", "R")):
            e, h = j[f"{s}-elbow"], j[f"{s}-hand"]
            o = e + (h - e) * 0.3
            cm, lp = tape(pts, self.tris, o, h - e, o)
            put(f"forearm{side}", cm, lp)
        return (out, loops) if with_loops else out


def mesh_volume(pts: np.ndarray, tris: np.ndarray) -> float:
    a, b, c = pts[tris[:, 0]], pts[tris[:, 1]], pts[tris[:, 2]]
    return float(abs(np.einsum("ij,ij->i", a, np.cross(b, c)).sum()) / 6.0)


# ---------------------------------------------------------------------------
# GLB writer (positions, indices, sparse morph targets, SPOTME_body extension)
# ---------------------------------------------------------------------------

class GlbWriter:
    def __init__(self):
        self.bin = bytearray()
        self.views: list[dict] = []
        self.accessors: list[dict] = []

    def _view(self, data: bytes, target: int | None = None) -> int:
        while len(self.bin) % 4:
            self.bin.append(0)
        view = {"buffer": 0, "byteOffset": len(self.bin), "byteLength": len(data)}
        if target:
            view["target"] = target
        self.bin.extend(data)
        self.views.append(view)
        return len(self.views) - 1

    def accessor(self, arr: np.ndarray, ctype: int, atype: str, target: int | None = None, minmax=False, normalized=False) -> int:
        acc = {"bufferView": self._view(arr.tobytes(), target), "componentType": ctype, "count": int(arr.shape[0]), "type": atype}
        if minmax:
            acc["min"] = arr.min(axis=0).tolist()
            acc["max"] = arr.max(axis=0).tolist()
        if normalized:
            acc["normalized"] = True
        self.accessors.append(acc)
        return len(self.accessors) - 1

    def sparse_vec3(self, delta: np.ndarray, count: int) -> int:
        idx = np.nonzero(np.abs(delta).max(axis=1) > 1e-6)[0].astype(np.uint16)
        vals = delta[idx].astype(np.float32)
        acc = {"componentType": 5126, "count": count, "type": "VEC3",
               "min": (vals.min(axis=0) if len(vals) else np.zeros(3)).tolist(),
               "max": (vals.max(axis=0) if len(vals) else np.zeros(3)).tolist()}
        if len(idx):
            acc["sparse"] = {
                "count": int(len(idx)),
                "indices": {"bufferView": self._view(idx.tobytes()), "componentType": 5123},
                "values": {"bufferView": self._view(vals.tobytes())},
            }
        self.accessors.append(acc)
        return len(self.accessors) - 1

    def write(self, path: str, gltf: dict) -> int:
        gltf["buffers"] = [{"byteLength": len(self.bin)}]
        gltf["bufferViews"] = self.views
        gltf["accessors"] = self.accessors
        js = json.dumps(gltf, separators=(",", ":")).encode("utf-8")
        js += b" " * ((4 - len(js) % 4) % 4)
        binary = bytes(self.bin) + b"\0" * ((4 - len(self.bin) % 4) % 4)
        total = 12 + 8 + len(js) + 8 + len(binary)
        with open(path, "wb") as f:
            f.write(struct.pack("<III", 0x46546C67, 2, total))
            f.write(struct.pack("<II", len(js), 0x4E4F534A) + js)
            f.write(struct.pack("<II", len(binary), 0x004E4942) + binary)
        return total


# ---------------------------------------------------------------------------
# Build one gender
# ---------------------------------------------------------------------------

def side_mask(pts: np.ndarray, side: str, lsign: float) -> np.ndarray:
    x = pts[:, 0] * lsign * (1.0 if side == "L" else -1.0)
    return np.clip((x + 0.01) / 0.02, 0.0, 1.0)


def build(gender: str, out_dir: str, mirror: np.ndarray, phenotype_override: dict | None = None) -> dict:
    for o in list(bpy.data.objects):
        bpy.data.objects.remove(o, do_unlink=True)
    pheno = {**BASE_PHENOTYPE, **(phenotype_override or {}), "gender": GENDERS.get(gender, 0.5)}
    log(f"{gender}: creating MPFB2 human")
    obj = HS.create_human(mask_helpers=False, detailed_helpers=False, extra_vertex_groups=True,
                          feet_on_ground=False, scale=0.1, macro_detail_dict=pheno)
    for mod in list(obj.modifiers):
        obj.modifiers.remove(mod)

    raw = coords(obj)
    # Feet on the ground, centred on the vertical axis.
    shift = np.array([-raw[:BODY_VERTS, 0].mean(), -raw[:BODY_VERTS, 1].min(), -raw[:BODY_VERTS, 2].mean()])
    base = raw + shift
    tris = body_triangles(obj)
    m = Measurer(obj, base, tris, mirror)
    base_cm, base_loops = m.measure(base, with_loops=True)
    height_m = float(base[:BODY_VERTS, 1].max())
    volume = mesh_volume(base[:BODY_VERTS], tris)
    log(f"{gender}: height {height_m * 100:.1f} cm, mass ≈ {volume * BODY_DENSITY:.1f} kg, waist {base_cm['waist']:.1f} cm")

    morphs: list[tuple[str, np.ndarray]] = []
    for macro in MACROS:
        for name, value in (("up", 1.0), ("down", 0.0)):
            set_macro(obj, macro, value)
            morphs.append((f"macro_{macro}_{name}", coords(obj) + shift - base))
        set_macro(obj, macro, pheno[macro])
    drift = np.abs(coords(obj) + shift - base).max()
    assert drift < 1e-4, f"macro reset drifted by {drift}"

    for key, cfg in MORPHS.items():
        for direction in ("incr", "decr"):
            delta = np.zeros_like(base)
            for stem in cfg["stems"]:
                delta += target_delta(obj, stem, direction, raw)
            if cfg.get("side"):
                delta *= side_mask(base, cfg["side"], m.lsign)[:, None]
            morphs.append((f"{key}_{direction}", delta))

    # Calibration: every morph's effect on every measurement + height + mass.
    calibration = {}
    for name, delta in morphs:
        pts = base + delta
        cm = m.measure(pts)
        effects = {k: round(cm[k] - base_cm[k], 3) for k in base_cm if abs(cm[k] - base_cm[k]) > 0.05}
        calibration[name] = {
            "cm": effects,
            "heightCm": round((pts[:BODY_VERTS, 1].max() - height_m) * 100, 3),
            "massKg": round((mesh_volume(pts[:BODY_VERTS], tris) - volume) * BODY_DENSITY, 3),
        }
        log(f"  {name:24s} " + ", ".join(f"{k}{v:+.1f}" for k, v in list(effects.items())[:4]))

    # Parts + zones (soft band around each tape position, limited to allowed parts).
    body = base[:BODY_VERTS]
    parts = classify_parts(body, m.j)
    zones = {}
    for key, (allowed, width) in ZONES.items():
        loop = base_loops[key]
        if len(loop) == 0:
            continue
        mask = np.isin(parts, [PARTS.index(p) for p in allowed])
        idx = np.nonzero(mask)[0]
        d = np.full(len(idx), np.inf)
        for chunk in np.array_split(loop, max(1, len(loop) // 64)):
            dd = np.linalg.norm(body[idx][:, None, :] - chunk[None, :, :], axis=2).min(axis=1)
            d = np.minimum(d, dd)
        w = np.exp(-((d / width) ** 2))
        keep = w > 0.04
        zones[key] = (idx[keep].astype(np.uint16), np.round(w[keep] * 255).astype(np.uint8))

    # GLB
    g = GlbWriter()
    pos = body.astype(np.float32)
    attributes = {
        "POSITION": g.accessor(pos, 5126, "VEC3", 34962, minmax=True),
        "_PART": g.accessor(parts, 5121, "SCALAR", 34962),
    }
    indices = g.accessor(tris.astype(np.uint16).reshape(-1), 5123, "SCALAR", 34963)
    targets = [{"POSITION": g.sparse_vec3(delta[:BODY_VERTS], BODY_VERTS)} for _, delta in morphs]
    zone_ext = {
        key: {"indices": g.accessor(i, 5123, "SCALAR"), "weights": g.accessor(w, 5121, "SCALAR", normalized=True)}
        for key, (i, w) in zones.items()
    }
    ext = {
        "version": FORMAT_VERSION,
        "gender": gender,
        "phenotype": pheno,
        "units": "m",
        "base": {
            "heightCm": round(height_m * 100, 3),
            "massKg": round(volume * BODY_DENSITY, 3),
            "measurementsCm": base_cm,
        },
        "morphs": calibration,
        "zones": zone_ext,
        "parts": PARTS,
        "segments": SEGMENT_OF_PART,
        "source": "MPFB2 (makehumancommunity/mpfb2), MakeHuman hm08 base mesh and targets (CC0)",
    }
    gltf = {
        "asset": {"version": "2.0", "generator": "SpotMe build_avatars.py"},
        "extensionsUsed": ["SPOTME_body"],
        "scene": 0,
        "scenes": [{"nodes": [0]}],
        "nodes": [{"name": f"SpotMe_{gender}", "mesh": 0}],
        "meshes": [{
            "name": f"body_{gender}",
            "primitives": [{"attributes": attributes, "indices": indices, "targets": targets, "mode": 4,
                            "extensions": {"SPOTME_body": ext}}],
            "weights": [0.0] * len(targets),
            "extras": {"targetNames": [n for n, _ in morphs]},
        }],
    }
    os.makedirs(out_dir, exist_ok=True)
    path = os.path.join(out_dir, f"{gender}.glb")
    size = g.write(path, gltf)
    log(f"{gender}: wrote {path} ({size / 1024:.0f} KiB, {len(morphs)} morphs, {len(tris)} triangles)")
    return {"gender": gender, "file": os.path.basename(path), "bytes": size, "base": ext["base"]}


def load_mirror(mpfb_dir: str) -> np.ndarray:
    mirror = np.arange(20000)
    with open(os.path.join(mpfb_dir, "data", "mesh_metadata", "hm08.mirror"), encoding="utf-8") as fh:
        for line in fh:
            parts = line.split()
            if len(parts) >= 2:
                mirror[int(parts[0])] = int(parts[1])
    return mirror


def main(argv: list[str]) -> None:
    ap = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    ap.add_argument("--mpfb", required=True, help="path to mpfb2/src/mpfb")
    ap.add_argument("--out", required=True, help="output directory for <gender>.glb")
    ap.add_argument("--genders", default="male,female,neutral")
    ap.add_argument("--phenotype", default=None, help="JSON overrides for the MPFB2 macro phenotype")
    args = ap.parse_args(argv)
    bootstrap_mpfb(args.mpfb)
    load_joint_indices(args.mpfb)
    mirror = load_mirror(args.mpfb)
    override = json.loads(args.phenotype) if args.phenotype else None
    summary = [build(g.strip(), args.out, mirror, override) for g in args.genders.split(",") if g.strip()]
    with open(os.path.join(args.out, "manifest.json"), "w", encoding="utf-8") as fh:
        json.dump({"version": FORMAT_VERSION, "avatars": summary}, fh, indent=2)
    log("done")


if __name__ == "__main__":
    argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else sys.argv[1:]
    main(argv)
