# Pose Reference Tool — Project Plan

A browser-based 3D pose reference tool: load a rigged humanoid, pose it by hand (FK + IK),
save/load/mirror poses, and export reference-sheet screenshots. Three.js + vanilla ES modules,
built with Vite. No backend, no paid services.

---

## 1. Stack

Versions verified against the npm registry on 2026-09-14.

| Package | Version | License | Role | Status |
|---|---|---|---|---|
| `three` | 0.186.0 | MIT | Core engine + addons | Active |
| `lil-gui` | 0.21.0 | MIT | UI panels/sliders | Active |
| `vite` | 7.x | MIT | Dev server + build | Active |
| `idb-keyval` | 6.x | Apache-2.0 | IndexedDB pose library | Active |
| `three-mesh-bvh` | 0.9.15 | MIT | Fast raycasting | **Deferred** — see §1.2 |
| `three-ik` | 0.1.0 | MIT | IK | **Dropped** — see §1.1 |

```bash
npm create vite@latest pose-tool -- --template vanilla
cd pose-tool
npm install three lil-gui idb-keyval
npm install -D vitest
```

### 1.1 Why `three-ik` is dropped

`three-ik` has exactly **one** published version, `0.1.0`, released **2018-04-23**, with no
release since. Its peer range is `three: "*"`, which is a promise it cannot keep — it predates
three's ESM migration, the `Controls` base class, color-management changes, and eight years of
`SkinnedMesh` internals. Building Phase 3 on it means debugging a dead library instead of the app.

**Use `CCDIKSolver` instead — it ships inside three itself:**

```js
import { CCDIKSolver, CCDIKHelper } from 'three/addons/animation/CCDIKSolver.js';
```

It is maintained alongside the engine, designed for `SkinnedMesh`, and supports per-link rotation
limits (`rotationMin` / `rotationMax` / `limitation` axis) — which is exactly the joint-clamping
Phase 2 needs, so FK limits and IK limits can share one config.

**Its one sharp edge:** in the `iks` config, `target` and `effector` are **bone indices into
`skeleton.bones`**, not arbitrary `Object3D`s. A stock Mixamo/RPM rig has no target bones, so an
IK goal must be *added to the skeleton* at load time (append `Bone` + identity `Matrix4` to
`skeleton.bones` / `skeleton.boneInverses`, then re-init the skeleton — this changes the bone
count and forces a material recompile, so do it once at load, never per-frame).

Budget one spike day for this. If it fights you, the fallback is not another dependency — a CCD
solver for a 2-link limb chain is ~100 lines of quaternion math, takes plain `Object3D` targets,
and is far easier to debug than a decade-old package. Decide from the spike, then commit.

### 1.2 Why `three-mesh-bvh` is deferred

A BVH is built over **static** `BufferGeometry`. A `SkinnedMesh` is skinned on the GPU: its
geometry attributes stay in bind pose forever, so a BVH raycast against a posed character hits the
T-pose, not what is on screen. It is the wrong tool for bone picking.

Phase 2 picks joints with small proxy spheres (§4.2) — trivial, exact, and it doubles as the
visual joint UI. `three-mesh-bvh` only earns its place for self-collision checks against a
*CPU-baked* posed mesh, which is a Phase 5+ stretch goal at best. Do not install it in Phase 1.

---

## 2. Architecture

The original file list had no shared state module, which is the one structural gap worth fixing
before writing code: `boneControls.js`, `ik.js`, and `poseStore.js` all mutate the same bone
rotations. Without a single owner they will disagree, and **undo/redo becomes impossible to retrofit**.
For a posing tool undo is not polish — it is the difference between usable and unusable — and it is
nearly free if state is centralised from day one.

**Rule: nothing writes `bone.quaternion` directly except the state module.** Everything else
dispatches a command; the state module applies it and notifies subscribers.

```
pose-tool/
├── index.html
├── vite.config.js            <- required, not optional (§6.3)
├── public/
│   └── models/               <- .glb assets, served at /models/*.glb
│       └── LICENSES.md       <- per-model source + license (§5)
└── src/
    ├── main.js               <- wiring only
    ├── app/
    │   ├── state.js          <- single source of truth: canonicalBone -> Quaternion, root position
    │   ├── commands.js       <- {do, undo} stack, coalesces a drag into one entry
    │   └── events.js         <- tiny pub/sub; drives render-on-demand
    ├── viewer/
    │   ├── scene.js          <- camera, lights, ground, renderer
    │   ├── render.js         <- render-on-demand loop (§6.1)
    │   └── lighting.js       <- presets
    ├── rig/
    │   ├── load.js           <- GLTFLoader wrapper, normalisation on load
    │   ├── rigMap.js         <- vendor bone names -> canonical humanoid names (§2.1)
    │   ├── limits.js         <- per-canonical-joint rotation limits
    │   └── jointProxies.js   <- pickable spheres parented to bones
    ├── pose/
    │   ├── fk.js             <- TransformControls rotate mode
    │   ├── ik.js             <- CCDIKSolver chains + goals
    │   ├── mirror.js         <- L/R flip (§4.4)
    │   └── serialize.js      <- versioned pose JSON
    ├── storage/
    │   └── poseLibrary.js    <- IndexedDB via idb-keyval
    └── ui/
        ├── gui.js            <- lil-gui panels
        └── shortcuts.js      <- keyboard (undo, reset, presets)
```

### 2.1 `rigMap.js` — build this in Phase 1, not later

The plan's own endgame is "swap in a nicer mesh later". That only works if no other module ever
sees a vendor bone name. Mixamo prefixes every bone `mixamorig:` (`mixamorig:LeftForeArm`);
Ready Player Me does not (`LeftForeArm`); a Sketchfab CC0 rig may use `forearm.L` or `upper_arm_R`.

Map every rig to one canonical humanoid vocabulary at load (`hips`, `spine`, `leftUpperArm`,
`leftLowerArm`, `leftHand`, …) and key **all** state, limits, IK chains, mirror pairs, and saved
poses by the canonical name. Adding a new rig then costs one table entry instead of a refactor,
and poses become portable between models. This is ~60 lines and saves a rewrite.

---

## 3. Phase 0 — Spike (½–1 day, do this first)

Before any structure exists, prove the two risky things from the console:

1. Load a `.glb`, find a named bone, set `bone.quaternion` by hand, see the mesh deform.
2. Stand up one `CCDIKSolver` chain on one arm — including adding the target bone to the skeleton.

**Done when:** an arm bends from a dragged goal, and you have a written verdict on
`CCDIKSolver` vs. a hand-rolled CCD. Throw the spike code away.

This retires the project's largest unknown on day one, while it is still cheap to change course.

---

## 4. Phased build

Each phase has an explicit definition of done. Don't start the next until it passes.

### Phase 1 — Viewer foundation
- Scene, perspective camera, `OrbitControls`, 3-point lighting, ground plane with shadow.
- `GLTFLoader` → rigged model; `SkeletonHelper` for a visual sanity check (debug-only — its lines
  are 1px and unpickable, so it is not the posing UI).
- `rigMap.js` normalisation; log any unmapped bones loudly.
- Correct colour pipeline from the start: `renderer.outputColorSpace = THREE.SRGBColorSpace`,
  `renderer.toneMapping = THREE.ACESFilmicToneMapping`. Retrofitting this changes every lighting
  preset you have tuned.
- Render-on-demand loop (§6.1).

**Done when:** model loads, orbits at 60fps, idles at ~0 GPU, and the console prints the canonical
bone table with zero unmapped joints.

### Phase 2 — Bone picking & FK posing
- `jointProxies.js`: one small sphere per posable joint, parented to its bone, `renderOrder` high,
  `depthTest: false` so joints stay visible through the mesh. Raycast against *these*, never the bones
  (a `Bone` is a bare `Object3D` with no geometry — it can never be hit by a raycaster) and never the
  skinned mesh (§1.2).
- On click: attach `TransformControls` in `'rotate'` mode to the selected bone.
- Per-joint limits from `limits.js` (e.g. knee: hinge on X, 0…150°; no hyperextension).
- `state.js` + `commands.js` land here. Every drag = one undo entry, pushed on
  `dragging-changed → false`, not per mousemove.

**Done when:** any joint is clickable, rotates within its limits, and ctrl+Z reverses exactly one
gesture.

### Phase 3 — IK layer
- Chains: arm `upperArm → lowerArm → hand`, leg `upperLeg → lowerLeg → foot`.
- Draggable goal per limb; `solver.update()` on drag, then write results back through `state.js`
  so IK and undo stay consistent.
- Per-limb FK/IK toggle. Switching IK→FK must bake the solved rotations into state, or the pose
  snaps back the next time FK writes.
- Reuse `limits.js` as the solver's `rotationMin`/`rotationMax` so an IK elbow can't invert.
- `CCDIKHelper` behind a debug flag.

**Done when:** dragging a hand goal bends the elbow the anatomically correct way, and toggling
FK/IK twice leaves the pose unchanged.

### Phase 4 — Pose management
- Versioned JSON (§6.6): canonical bone → quaternion, plus root position, model id, schema version.
- Pose library: name + thumbnail, stored in **IndexedDB** (not localStorage — §6.5).
- Save / load / reset-to-bind-pose (`skeleton.pose()`) / mirror (§4.4).
- Import/export `.json` so poses survive a cleared browser profile.

**Done when:** a pose round-trips through save → reload page → load with bit-identical bone
rotations, and mirror-then-mirror is a no-op.

### Phase 4.4 — Mirror, specifically
Mirroring is the single most rig-dependent operation here and deserves its own note. It is *two*
steps: swap left/right canonical bones, **and** conjugate each quaternion across the sagittal plane.
For a rig whose left/right bone rest orientations are true mirrors, `(x, y, z, w) → (x, -y, -z, w)`
is the usual form, but the sign pattern depends on each rig's bone axis convention — Mixamo and
RPM do not agree with a Blender-exported rig here.

Don't guess: derive it empirically per rig in the spike, store the axis convention in `rigMap.js`
alongside the name table, and cover it with a unit test (mirror twice == identity) so a rig swap
can't silently break it.

### Phase 5 — Polish
- Camera presets (front / side / three-quarter / back) with smooth tweens.
- Screenshot export (§6.4) at a configurable multiplier (2×/4×) for print-usable reference sheets.
- Lighting presets: studio, rim, silhouette.
- Optional: multiple characters for group reference. **Note the cost:** a second character makes
  selection, state keying, and the pose schema instance-scoped. If this is wanted at all, key state
  by `(instanceId, canonicalBone)` from Phase 2 — cheap now, invasive later.

---

## 5. Base models

**Recommendation changed from the first draft: start with Ready Player Me, not Mixamo.**
Rationale: RPM exports GLB directly, so Phase 1 needs no Blender round-trip and no FBX→glTF
conversion step blocking first light. The Mixamo naming convention that IK tutorials assume is
worth nothing once `rigMap.js` exists (§2.1).

1. **Ready Player Me** — free rigged avatars, direct glTF/GLB export. Best Phase 1 starting point.
2. **Sketchfab** — filter downloadable + CC0/CC-BY, "human base mesh rigged". Best *committable*
   asset: CC0 means the `.glb` can live in the repo with no licence anxiety.
3. **Mixamo** — good rigs and auto-rigging for custom meshes, but: FBX export only (Blender
   conversion required), Adobe account required, and Adobe has not meaningfully maintained it in
   years. Verify it is still up before planning around it, and **do not commit Mixamo characters to
   a public repo** — their terms cover use, not redistribution of the asset.

Keep `public/models/LICENSES.md` recording source, author, licence, and URL for every model added.
This costs one line per model now and avoids an unpickable mess if the tool is ever shared.

---

## 6. Known gotchas (each cost someone a day)

### 6.1 Render on demand
A posing tool is static most of the time. An unconditional `requestAnimationFrame` render burns
battery for nothing. Render only when something changed:

```js
let dirty = true;
const invalidate = () => { dirty = true; };
controls.addEventListener('change', invalidate);   // OrbitControls
state.subscribe(invalidate);
function loop() { requestAnimationFrame(loop); if (dirty) { renderer.render(scene, camera); dirty = false; } }
```
Retrofitting this later means auditing every mutation site. Do it in Phase 1.

### 6.2 TransformControls is not an Object3D
Since r169 it extends `Controls`, so `scene.add(transformControls)` silently adds nothing:
```js
scene.add(transformControls.getHelper());   // <- the gizmo
```
And it will fight OrbitControls unless you disarm orbit during a drag:
```js
transformControls.addEventListener('dragging-changed', e => { orbit.enabled = !e.value; });
```

### 6.3 Vite config is required, not optional
GitHub Pages serves this repo from a subpath, so the default `base: '/'` yields 404s on every asset:
```js
// vite.config.js
export default { base: '/CodedByKay.Poser/' };
```
Netlify/Cloudflare Pages serve from root and want `base: '/'` — pick the target before Phase 5 and
drive it from an env var if you want both.

### 6.4 Screenshots need `preserveDrawingBuffer` (or same-frame capture)
The drawing buffer is cleared after compositing, so a `toDataURL()` on a later tick returns a blank
image. Either construct the renderer with `preserveDrawingBuffer: true` (small perf cost, simplest),
or call `renderer.render()` and capture in the same frame. Prefer `canvas.toBlob()` over
`toDataURL()` for 4× exports — a base64 string of a 4K canvas is many MB of main-thread work.

### 6.5 IndexedDB, not localStorage
localStorage caps at ~5MB **and** stores strings, so a base64 thumbnail costs ~33% overhead. A
pose library with 128px thumbnails hits the quota in dozens of poses and throws `QuotaExceededError`
mid-save. Use IndexedDB (via `idb-keyval`) and store thumbnails as `Blob`s. The original plan's
"localStorage or IndexedDB" is a decision, and IndexedDB wins outright.

### 6.6 Versioned pose schema
Write the version field before you have saved poses to migrate:
```json
{
  "schema": 1,
  "model": "rpm-female-a",
  "rootPosition": [0, 0, 0],
  "bones": { "leftUpperArm": [0.0, 0.0, 0.0, 1.0] }
}
```
Local quaternions (not Euler, not world-space): they compose cleanly, avoid gimbal lock, and stay
valid when the rig's rest pose differs.

### 6.7 Clamping is Euler-shaped, state is quaternion-shaped
Joint limits are naturally expressed as Euler ranges, but Euler clamping is order-dependent and
lossy around ±90°. Keep quaternions canonical in state; convert to Euler with one **documented,
fixed** order per joint for clamping only, then convert back. Hinges (knee, elbow) are better handled
as swing-twist: project onto the hinge axis, clamp the angle, discard the rest. Start with Euler for
ball joints and swing-twist for the four hinges.

### 6.8 Stale world matrices
Bone world matrices update during render. Reading `bone.matrixWorld` right after setting a rotation
gives you last frame's value — a classic source of "IK is one frame behind". Call
`bone.updateWorldMatrix(true, false)` (or `scene.updateMatrixWorld()`) before any read in the same tick.

### 6.9 Import paths
Use the `three/addons/*` export (present in three's package exports map) rather than the older
`three/examples/jsm/*` spelling. Both resolve today; `addons` is the documented one.
```js
import { GLTFLoader }       from 'three/addons/loaders/GLTFLoader.js';
import { OrbitControls }    from 'three/addons/controls/OrbitControls.js';
import { TransformControls } from 'three/addons/controls/TransformControls.js';
```

---

## 7. Testing

Most of the hard logic is pure and needs no WebGL, so it is cheap to test — and these are precisely
the functions that break silently when a rig is swapped:

- `rigMap` — every vendor name maps; unmapped names throw, not warn.
- `mirror` — mirror∘mirror == identity, on fixtures from each supported rig.
- `serialize` — round-trip fidelity; schema-version migration.
- `limits` — clamping is idempotent; a clamped value stays in range.

`vitest` for those. One Playwright smoke test (`npx playwright test`, Chromium is already available)
that loads the page and asserts the model appears catches integration breaks. Skip WebGL
pixel-diffing — high maintenance, low yield at this scale.

---

## 8. Deployment

`npm run build` → static `dist/`. GitHub Pages via Actions (`actions/deploy-pages`), with the `base`
from §6.3. No backend, no environment secrets, no runtime cost.

---

## 9. Risks & cut lines

| Risk | Mitigation | Cut line |
|---|---|---|
| IK is the hardest part and the least certain | Phase 0 spike decides solver before structure exists | Ship FK-only; IK is additive |
| Rig-specific bone conventions break on model swap | `rigMap.js` from Phase 1 + unit tests | Support exactly one rig |
| Joint limits are fiddly to tune per rig | Data-driven `limits.js`, tune without code changes | Ship unclamped; clamp the 4 hinges only |
| Scope creep into an animation tool | Timeline/keyframes are explicitly out of scope | — |
| Multi-character reworks state keying | Key state by `(instanceId, bone)` from Phase 2 | Single character forever |

**Out of scope, deliberately:** animation timelines, keyframing, retargeting, cloth/muscle sim,
custom mesh import, anything server-side.

---

## Appendix — What changed from the first draft

1. **`three-ik` dropped** — one release, 2018, never updated. Replaced with three's own
   `CCDIKSolver`, plus a documented fallback and the bone-index gotcha that decides between them.
2. **`three-mesh-bvh` deferred** — a BVH over a `SkinnedMesh` raycasts the bind pose, not the posed
   mesh. Proxy spheres are the correct Phase 2 mechanism.
3. **Central state + command stack added** — undo/redo is essential for a posing tool and cannot be
   retrofitted once three modules mutate bones independently.
4. **`rigMap.js` added to Phase 1** — makes "swap in a nicer mesh later" a one-line change.
5. **Starting model changed to Ready Player Me** — direct GLB export, no Blender round-trip; the
   Mixamo naming advantage disappears once bone names are normalised. Mixamo licence caution added.
6. **Definitions of done per phase**, plus a Phase 0 spike that retires the IK risk on day one.
7. **Gotchas made explicit** — `getHelper()`, orbit/gizmo conflict, `preserveDrawingBuffer`,
   Vite `base`, stale world matrices, Euler-vs-quaternion clamping.
8. **localStorage → IndexedDB** decided rather than left open (quota + thumbnails).
9. **Testing, deployment, risks, and out-of-scope** sections added.
