# Model licenses

Record source, author, license, and URL for every `.glb` added to this
directory (PLAN.md §5). Nothing is committed here yet:

The current build uses a procedurally-generated placeholder rig
(`src/rig/testRig.js`) instead of an imported `.glb`, so Phase 1/2 have
something to load, pick, and pose with no external asset and no license
entanglement while a real character is sourced.

## Adding a real model

1. Source it from Ready Player Me (direct GLB export, best Phase 1 fit) or
   Sketchfab filtered to downloadable + CC0/CC-BY ("human base mesh
   rigged"). Do not commit Mixamo characters here — their terms cover use,
   not redistribution.
2. Drop the `.glb` in this directory; it's served at `/models/<file>.glb`.
3. Add a row below with source, author, license, and URL.
4. Point `main.js` at it via `loadRig('/models/<file>.glb')` instead of
   `createTestRig()`.
5. Check the console on load: `rigMap.js` logs any bone that had no
   canonical mapping. Zero unmapped joints is Phase 1's done bar.

| File | Source | Author | License | URL |
|---|---|---|---|---|
| _(none yet)_ | | | | |
