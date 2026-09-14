// Phase 3 — not yet implemented. Deliberately deferred past Phase 1/2 per
// PLAN.md's risk table ("IK is the hardest part and least certain — ship
// FK-only, IK is additive").
//
// Planned approach (PLAN.md §1.1, §Phase 3): three's own CCDIKSolver
// (`three/addons/animation/CCDIKSolver.js`), not the abandoned `three-ik`
// package. Its `iks` config addresses `target`/`effector` as bone *indices*
// into `skeleton.bones`, not arbitrary Object3Ds — a goal bone must be
// appended to the skeleton at load time (once, not per-frame; see PLAN.md
// §3 for the Phase 0 spike that should be run before building this out).
//
// Chains needed: arm (upperArm -> lowerArm -> hand), leg (upperLeg ->
// lowerLeg -> foot). Reuse rig/limits.js as the solver's
// rotationMin/rotationMax so an IK elbow/knee can't invert. Switching
// IK -> FK must bake solved rotations into state.js or the pose snaps back
// the next time FK writes (PLAN.md §Phase 3 done-when).

export function createIkController() {
  throw new Error('ik.js: Phase 3 not yet implemented — see PLAN.md §Phase 3');
}
