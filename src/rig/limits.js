import { Euler, MathUtils, Quaternion, Vector3 } from 'three';

// Per-canonical-joint rotation limits, data-driven so tuning never touches
// code (PLAN.md §Phase 2, §9). Keyed by the *unsided* base name — the same
// limit applies to both left and right.
//
// Clamping is Euler-shaped but state is quaternion-shaped (§6.7): ball
// joints clamp via a fixed, documented Euler order; the four hinges
// (elbow, knee) use swing-twist so only the hinge axis matters and any
// off-axis wobble from numerical drift is discarded, never accumulated.

const DEG = MathUtils.DEG2RAD;

/** @typedef {{ type: 'hinge', axis: 'x'|'y'|'z', min: number, max: number }} HingeLimit */
/** @typedef {{ type: 'ball', order: string, min: [number,number,number], max: [number,number,number] }} BallLimit */

/** @type {Record<string, HingeLimit | BallLimit>} */
export const LIMITS = {
  hips: ball([-45, -80, -45], [45, 80, 45]),
  spine: ball([-40, -30, -25], [60, 30, 25]),
  chest: ball([-30, -30, -20], [50, 30, 20]),
  neck: ball([-40, -50, -30], [40, 50, 30]),
  head: ball([-40, -60, -30], [40, 60, 30]),
  shoulder: ball([-20, -15, -30], [20, 40, 15]),
  upperArm: ball([-90, -90, -100], [180, 90, 50]),
  lowerArm: hinge('y', -10, 150), // elbow: hinge about the forearm's bend axis
  hand: ball([-60, -30, -80], [60, 30, 80]),
  upperLeg: ball([-110, -45, -30], [50, 45, 30]),
  lowerLeg: hinge('x', 0, 150), // knee: no hyperextension
  foot: ball([-50, -20, -30], [35, 20, 30]),
};

function ball(minDeg, maxDeg, order = 'XYZ') {
  return { type: 'ball', order, min: minDeg, max: maxDeg };
}

function hinge(axis, minDeg, maxDeg) {
  return { type: 'hinge', axis, min: minDeg, max: maxDeg };
}

/** "leftUpperArm" -> "upperArm", "hips" -> "hips" */
export function baseNameOf(canonical) {
  if (canonical.startsWith('left')) return lowerFirst(canonical.slice(4));
  if (canonical.startsWith('right')) return lowerFirst(canonical.slice(5));
  return canonical;
}

function lowerFirst(str) {
  return str.charAt(0).toLowerCase() + str.slice(1);
}

/** Returns the limit config for a canonical bone name, or null if unclamped. */
export function getLimit(canonicalName) {
  return LIMITS[baseNameOf(canonicalName)] ?? null;
}

const AXIS_VECTORS = { x: new Vector3(1, 0, 0), y: new Vector3(0, 1, 0), z: new Vector3(0, 0, 1) };

function clampHinge(quaternion, limit) {
  const axis = AXIS_VECTORS[limit.axis];
  const projLen = quaternion.x * axis.x + quaternion.y * axis.y + quaternion.z * axis.z;
  const angle = 2 * Math.atan2(projLen, quaternion.w);
  const clamped = MathUtils.clamp(angle, limit.min * DEG, limit.max * DEG);
  const half = clamped / 2;
  const s = Math.sin(half);
  return new Quaternion(axis.x * s, axis.y * s, axis.z * s, Math.cos(half));
}

function clampBall(quaternion, limit) {
  const euler = new Euler().setFromQuaternion(quaternion, limit.order);
  euler.x = MathUtils.clamp(euler.x, limit.min[0] * DEG, limit.max[0] * DEG);
  euler.y = MathUtils.clamp(euler.y, limit.min[1] * DEG, limit.max[1] * DEG);
  euler.z = MathUtils.clamp(euler.z, limit.min[2] * DEG, limit.max[2] * DEG);
  return new Quaternion().setFromEuler(euler);
}

/**
 * Clamp a *local* joint quaternion (relative to bind pose) to its limit.
 * Idempotent: clamping an already-clamped value returns the same value.
 * Bones with no configured limit pass through unchanged.
 */
export function clampQuaternion(canonicalName, quaternion) {
  const limit = getLimit(canonicalName);
  if (!limit) return quaternion.clone();
  return limit.type === 'hinge' ? clampHinge(quaternion, limit) : clampBall(quaternion, limit);
}
