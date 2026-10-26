# Body tracker: 3D body, measurements and BIA

The **Body** card on Home expands into `/body`: a 3D body built from MPFB2 that takes the
user's gender, height, weight and tape measurements, plus green / red highlights on the
regions that changed.

---

## 1. Pipeline at a glance

```
onboarding (gender, height)   weight log   tape sessions   BIA reports (future)
            └──────────────┬──────┴──────────────┴──────────────┘
                           ▼
          buildSnapshots()  →  BodySnapshot (current) + BodySnapshot (baseline)
                           │                            │
         avatarGenerator.load(gender)                   │
         (bundled GLB · or remote service)              │
                           ▼                            ▼
                  solveMorphs(calibration, current)   measurementDeltas / segmentDeltas
                           ▼                            ▼
                  applyMorphs → positions        zoneHighlights / segmentHighlights → colours
                           └──────────────┬─────────────┘
                                          ▼
                       BodyViewer (expo-gl + three + react-three-fiber)
```

| Step | File |
|---|---|
| Data model | `src/features/body/types.ts` |
| Measurement catalogue (labels, ranges, goal direction, BIA segment) | `src/features/body/measurementCatalog.ts` |
| Store (tape sessions, BIA reports; AsyncStorage) | `src/features/body/bodyStore.ts` |
| Snapshots and deltas | `src/features/body/snapshots.ts` |
| GLB reader | `src/features/body/avatar/glb.ts` |
| Morph solver | `src/features/body/avatar/solveMorphs.ts` |
| Mesh deformation | `src/features/body/avatar/applyMorphs.ts` |
| Highlight colours | `src/features/body/avatar/zoneColors.ts` |
| Model source (bundled / remote) | `src/features/body/avatar/avatarGenerator.ts` |
| Hook gluing it together | `src/features/body/hooks/useBodyAvatar.ts` |
| Viewer and camera | `src/features/body/components/BodyViewer.tsx`, `orbit.ts` |
| Screen | `src/app/body/index.tsx` |
| BIA import contract | `src/features/body/bia.ts` |
| MPFB2 build script, preview, service | `tools/avatar/` |

---

## 2. MPFB2 → app

MPFB2 is a Blender add-on, so it can't run on a phone. `tools/avatar/build_avatars.py` runs it
headless (Blender as a Python module) and bakes everything the phone needs into one GLB per
gender:

- **Base body:** MPFB2 human at gender 1.0 (male), 0.0 (female) or 0.5 (neutral). Other
  macros are at mid-range (age 25, muscle / weight / height / proportions 0.5, even ethnic
  blend). The output is metres, Y up, facing +Z, feet at y = 0, with 13,380 skin vertices
  and 26,756 triangles.
- **Morph targets (48), sparse:**
  - `macro_{height,weight,muscle}_{up,down}`: MPFB2 macro at 1.0 / 0.0, as a delta from 0.5.
  - `<key>_{incr,decr}` for every measurement key: the MPFB2 target in the table below.
    Limb targets are split per side, so left and right are independent.
- **`SPOTME_body` extension:**
  - **Calibration:** base height, mass (mesh volume × 985 kg/m³) and every circumference.
    It also records each morph's effect at weight 1.0 on every circumference, on height and
    on mass.
  - **Zones:** one soft band per measurement around where the tape goes, as sparse vertex
    weights.
  - **Parts:** each vertex's body part (nearest bone), mapped to the BIA segments arm L/R,
    trunk and leg L/R.

**How circumferences are measured on the mesh:**
- Where MakeHuman defines a ruler loop, it's used: neck, chest, waist, hips, biceps, wrist,
  thigh, knee, calf, ankle. These are the loops MakeHuman's own measure targets were made
  for.
- Everything else uses a tape-measure slice: the convex hull of the body's cross-section.
  - Shoulders: horizontal, over both deltoids.
  - Upper / lower abdomen: horizontal, between the ruler loops.
  - Forearms: perpendicular to the forearm, ⅓ of the way from the elbow.

| Key | MPFB2 target(s) | Side split |
|---|---|---|
| neck | `measure-neck-circ` | – |
| shoulders | `l/r-upperarm-shoulder-muscle` | – |
| chest | `measure-bust-circ` | – |
| waist | `measure-waist-circ` | – |
| hips | `measure-hips-circ` | – |
| upperAbdomen | `measure-underbust-circ` | – |
| lowerAbdomen | `stomach-pregnant` | – |
| bicepsL/R | `measure-upperarm-circ` | ✓ |
| forearmL/R | `l/r-lowerarm-muscle` | own side |
| wristL/R | `measure-wrist-circ` | ✓ |
| thighL/R | `measure-thigh-circ` | ✓ |
| kneeL/R | `measure-knee-circ` | ✓ |
| calfL/R | `measure-calf-circ` | ✓ |
| ankleL/R | `measure-ankle-circ` | ✓ |

Base bodies as built (Oct 2026):

| | Height | Mass | Chest | Waist | Hips |
|---|---|---|---|---|---|
| male | 173.0 | 62.3 kg | 96.1 | 76.8 | 93.3 |
| female | 159.1 | 47.3 kg | – | 71.2 | – |
| neutral | 165.9 | 54.1 kg | – | 72.7 | – |

(see `assets/avatar/manifest.json` for all values)

### Generation modes

`avatarGenerator.ts` hides where the model comes from:

- **`BundledAvatarGenerator`** (default): the three GLBs in `assets/avatar`. The app adapts
  them to the person (§3). It's offline and instant, and nothing leaves the device.
- **`RemoteAvatarGenerator(url)`**: calls `tools/avatar/service`.
  - Request: `POST /avatar` with `{ gender, heightCm, weightKg }`.
  - Response: a GLB in the same format, with that person's MPFB2 height and weight macros
    baked in.
  - Results are cached on the device, and it falls back to the bundled model when offline.
  - To turn it on, set `avatarGenerator = new RemoteAvatarGenerator('https://…')`.
  - **Privacy:** height and weight are sent to that server, so it needs TLS, auth and a
    privacy-policy update first.

---

## 3. From snapshot to mesh (`solveMorphs`)

1. **Height:** the MPFB2 height macro moves the body toward the target. A uniform scale then
   lands the exact height, so any height works and proportions still change the way
   MakeHuman's do.
2. **Muscle:** taken from BIA skeletal muscle mass ÷ weight against a reference ratio
   (0.42 male, 0.34 female, 0.38 neutral); neutral when there's no BIA.
3. **Weight:** the weight macro matches the body mass (calibrated mass × scale³). MPFB2's
   weight macro is gentle (≈ ±6 kg on the base male), so it's allowed to extrapolate to ×2.
   Past that, logged circumferences shape the body.
4. **Circumferences:** bounded least squares (coordinate descent, ridge λ = 0.5, weights
   0–1.5) over the 42 measure morphs, against every logged measurement.
   - Couplings are in the calibration and are used, not fought. For example, the waist morph
     also moves the upper abdomen.
   - Unmeasured regions keep the model's value. The screen shows those values with a "model"
     tag.

`applyMorphs` deforms the mesh on the CPU (base + Σ w·Δ, then the scale) once per change.
Normals are recomputed. There are no GPU morph targets, which keeps it portable on mobile GL.

---

## 4. Green / red highlighting

- **Baseline:** the session before the latest one (**Previous**) or the very first one
  (**First**). Values carry forward, so measuring only your arms today keeps last week's
  waist.
- **Two modes:**
  - **Progress:** green when a region moved the way the goal wants (`measurementCatalog`
    `progress`: e.g. waist ↓ on *lose*, biceps ↑ on *gain*), red otherwise. Regions the goal
    doesn't care about stay skin-coloured.
  - **Change:** green = grew, red = shrank.
- **Strength:** changes under 0.3 cm count as noise. The tint reaches full strength at
  2.5 cm. It's painted through the zone weights; overlaps keep the strongest tint per vertex.
- **BIA segments:** future segmental lean / fat changes tint the whole arm, leg or trunk
  (fainter than tape zones) through the per-vertex part ids.

---

## 5. Viewer

- **Rendering:** `@react-three/fiber/native` on `expo-gl`, on demand: nothing is drawn while
  the body and camera are still.
- **Gestures (Gesture Handler):** one-finger drag orbits (360° azimuth with a damped coast),
  pinch zooms, double tap resets.
- **Clamping (`orbit.ts`):**
  - **Tilt:** limited from 20° above the head to just below the horizon, and never under the
    floor.
  - **Zoom:**
    - minimum 0.62 × height: the A-pose arms reach ≈ 0.47 × height, so the camera can't
      enter the mesh
    - maximum 3.2 × height
    - the look-at point rises toward the chest as you zoom in
- **Timing:** the canvas mounts after the card has finished expanding, so GL setup doesn't
  cost frames during the morph.

---

## 6. BIA (future smart-scale import)

The data model and plumbing are ready; only importers are missing.

- `BiaReport` covers:
  - body-fat %, fat mass, skeletal muscle mass, visceral fat level, total body water,
    ECW/TBW, BMR
  - segmental lean / fat mass for arm L/R, trunk and leg L/R
- To add a source:
  1. Implement `BiaImporter` (`canParse`, `parse` → `BiaInput[]`).
  2. Add it to `BIA_IMPORTERS`.
  3. Call `useBiaImport()(inputs)`.
- Reports are validated (implausible fields dropped), stored in `bodyStore.biaReports`, and
  their weight goes into the weight log.
- Everything downstream already reacts:
  - snapshots pick the latest report as `composition`
  - the solver drives the muscle macro from it
  - `segmentDeltas` → `segmentHighlights` colour the segments

**Next steps when importers arrive:**
- Map fat-mass distribution to MPFB2 `*-fat-*` targets (e.g. `l-upperarm-fat-incr`).
- Bake those as extra morphs in `build_avatars.py`; the format already supports any morph
  names.

---

## 7. Rebuilding the models

See `tools/avatar/README.md`. After a rebuild:
- Run `bun run test`. `avatar.test.ts` checks that the models parse, that the base body needs
  no morphs, and that the solver hits target circumferences and height.
- Commit the new GLBs and `manifest.json`.

Licences: MakeHuman / MPFB2 assets (base mesh, targets) are CC0. MPFB2's code (GPL-3) is only
used by the build tool, which isn't shipped in the app.
