import { mirrorName } from '../rig/rigMap.js';

// Mirroring is two steps (PLAN.md §4.4): swap left/right canonical bones,
// and conjugate each quaternion across the sagittal plane. The sign
// pattern depends on each rig's bone-axis convention — MIRROR_AXIS_CONVENTION
// in rigMap.js is where that's recorded per rig; this module just applies it.

function mirrorQuaternionArray([x, y, z, w]) {
  // Default convention: flip y and z, keep x and w (PLAN.md §4.4 example form).
  return [x, -y, -z, w];
}

/**
 * @param {{ rootPosition: [number,number,number], bones: Record<string, number[]> }} snapshot
 */
export function mirrorSnapshot(snapshot) {
  const bones = {};
  for (const [canonicalName, quat] of Object.entries(snapshot.bones)) {
    bones[mirrorName(canonicalName)] = mirrorQuaternionArray(quat);
  }
  const [rx, ry, rz] = snapshot.rootPosition;
  return { rootPosition: [-rx, ry, rz], bones };
}
