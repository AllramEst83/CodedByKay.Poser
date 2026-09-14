# CodedByKay.Poser

A browser-based 3D pose reference tool: load a rigged humanoid, pose it by hand (FK, with IK
planned), save/load/mirror poses, and export reference-sheet screenshots. Three.js + vanilla ES
modules, built with Vite. No backend, no paid services.

See [`PLAN.md`](./PLAN.md) for the full project plan, architecture, and phased build order.

## Status

- **Phase 0 (spike):** done — bone rotation deforms the mesh; verdict recorded in `PLAN.md` §1.1
  (`CCDIKSolver` over `three-ik`, which is dead).
- **Phase 1 (viewer foundation):** done — scene, camera, orbit controls, lighting, ground plane,
  correct color pipeline, render-on-demand loop, rig loading + canonical bone-name normalisation.
- **Phase 2 (FK posing):** done — click a joint, drag to rotate (`TransformControls`), per-joint
  limits, undo/redo.
- **Phase 3 (IK):** not started — see `src/pose/ik.js`.
- **Phase 4 (pose management):** partial — versioned pose schema, save/load via IndexedDB. Mirror
  and import/export JSON are implemented as pure functions but not yet wired into the UI.
- **Phase 5 (polish):** not started.

The app currently poses a procedurally-generated placeholder rig (`src/rig/testRig.js`) instead of
an imported `.glb`, so there's something to load and pose with no external asset dependency or
license entanglement. See `public/models/LICENSES.md` for how to swap in a real model.

## Development

```bash
npm install
npm run dev       # dev server
npm test          # unit tests (vitest)
npm run test:e2e  # Playwright smoke test (loads the page, asserts the model appears)
npm run build     # production build -> dist/
```

## Deployment

`npm run build` (with `DEPLOY_TARGET=gh-pages` to pick up the GitHub Pages base path — see
`vite.config.js` and `PLAN.md` §6.3) produces a static `dist/`, deployed via
`.github/workflows/deploy.yml` on push to `main`.
