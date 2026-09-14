// Maps vendor bone names (Mixamo, Ready Player Me, Blender/Rigify exports,
// ...) to one canonical humanoid vocabulary. Every other module — state,
// limits, IK chains, mirror pairs, saved poses — is keyed by the canonical
// name and never sees a vendor name again (PLAN.md §2.1). Adding a new rig
// costs one table entry here, not a refactor.

// canonical base word -> compact aliases seen across rigs (already
// lowercased, with separators stripped, in normalizeVendorName()).
const BASE_ALIASES = {
  Hips: ['hips', 'pelvis'],
  Spine: ['spine'],
  Chest: ['spine1', 'spine2', 'chest', 'upperchest'],
  Neck: ['neck'],
  Head: ['head'],
  Shoulder: ['shoulder', 'clavicle'],
  UpperArm: ['arm', 'upperarm'],
  LowerArm: ['forearm', 'lowerarm'],
  Hand: ['hand'],
  UpperLeg: ['upleg', 'upperleg', 'thigh'],
  LowerLeg: ['leg', 'lowerleg', 'shin', 'calf'],
  Foot: ['foot'],
};

// center (unsided) canonical bones vs. sided ones — used by mirror.js to
// know which names come in left/right pairs.
export const CENTER_BONES = new Set(['hips', 'spine', 'chest', 'neck', 'head']);

const compactToBase = new Map();
for (const [base, aliases] of Object.entries(BASE_ALIASES)) {
  for (const alias of aliases) compactToBase.set(alias, base);
}

function lowerFirst(str) {
  return str.charAt(0).toLowerCase() + str.slice(1);
}

// Empirically-derived per-rig sign convention for mirroring a quaternion
// across the sagittal (left-right) plane — PLAN.md §4.4. Default is the
// common case for rigs whose left/right rest bones are true mirrors on X.
// Verify against a fresh rig in the Phase 0 spike before trusting it.
export const MIRROR_AXIS_CONVENTION = { flip: ['y', 'z'] };

/**
 * Normalize one vendor bone name to its canonical humanoid name, or throw.
 * Pure function — the loader decides whether to log-and-skip or hard-fail.
 * @param {string} vendorName
 * @returns {string} canonical name, e.g. "leftUpperArm", "hips"
 */
export function mapBoneName(vendorName) {
  if (!vendorName) throw new Error('rigMap: empty bone name');

  let name = vendorName.replace(/^mixamorig[:_]?/i, '').toLowerCase();

  let side = null;
  if (/^left[_\s]?/.test(name)) {
    side = 'left';
    name = name.replace(/^left[_\s]?/, '');
  } else if (/^right[_\s]?/.test(name)) {
    side = 'right';
    name = name.replace(/^right[_\s]?/, '');
  } else if (/[._]l$/.test(name)) {
    side = 'left';
    name = name.replace(/[._]l$/, '');
  } else if (/[._]r$/.test(name)) {
    side = 'right';
    name = name.replace(/[._]r$/, '');
  }

  const compact = name.replace(/[._\s]/g, '');
  const base = compactToBase.get(compact);
  if (!base) {
    throw new Error(`rigMap: unmapped bone "${vendorName}" (normalized "${compact}")`);
  }

  return side ? side + base : lowerFirst(base);
}

/**
 * Build a full name table for a skeleton, tolerating unmapped bones (some
 * rigs carry extra fingers/twist bones this tool doesn't pose). Returns
 * { mapped: Map<canonical, vendorName>, unmapped: string[] }.
 * @param {string[]} vendorNames
 */
export function buildNameTable(vendorNames) {
  const mapped = new Map();
  const unmapped = [];
  for (const vendorName of vendorNames) {
    try {
      const canonical = mapBoneName(vendorName);
      mapped.set(canonical, vendorName);
    } catch {
      unmapped.push(vendorName);
    }
  }
  return { mapped, unmapped };
}

/** Given a canonical name, return its mirror-pair canonical name (identity for center bones). */
export function mirrorName(canonical) {
  if (canonical.startsWith('left')) return 'right' + canonical.slice(4);
  if (canonical.startsWith('right')) return 'left' + canonical.slice(5);
  return canonical;
}
