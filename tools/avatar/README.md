# Avatar pipeline (MPFB2)

Builds the 3D bodies in `assets/avatar/` from MPFB2 (MakeHuman Plugin for Blender 2), headless.

```bash
pip install bpy==5.2.3 numpy        # Blender as a Python module (needs Python 3.13)
git clone https://github.com/makehumancommunity/mpfb2 /tmp/mpfb2
python3 tools/avatar/build_avatars.py --mpfb /tmp/mpfb2/src/mpfb --out assets/avatar
python3 tools/avatar/preview.py assets/avatar/male.glb /tmp/male.png   # optional visual check (matplotlib)
```

The script also runs inside Blender itself: `blender -b --python tools/avatar/build_avatars.py -- --mpfb … --out …`.

| File | Purpose |
|---|---|
| `build_avatars.py` | MPFB2 → `male.glb`, `female.glb`, `neutral.glb` + `manifest.json` |
| `preview.py` | Renders parts, zones and sample morphs of a GLB to a PNG |
| `service/server.py` | Optional HTTP service: one personalised body per request |
| `service/Dockerfile` | Container for the service (`docker build -f tools/avatar/service/Dockerfile -t spotme-avatar tools/avatar`) |

What's in each GLB and how the app uses it: [`docs/BODY_TRACKER.md`](../../docs/BODY_TRACKER.md).
Run `bun run test` after rebuilding: `src/features/body/avatar/avatar.test.ts` checks the models load and calibrate.
