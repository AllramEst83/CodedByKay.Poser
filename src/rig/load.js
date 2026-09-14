import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { buildNameTable } from './rigMap.js';

/**
 * @typedef {Object} Rig
 * @property {import('three').Object3D} object   - the loaded scene graph, ready to add
 * @property {import('three').Object3D} root      - hips-equivalent root for position control
 * @property {import('three').Skeleton} skeleton
 * @property {import('three').SkinnedMesh} mesh   - one representative skinned mesh, for CCDIKSolver
 * @property {Map<string, import('three').Bone>} bonesByName - canonical name -> Bone
 * @property {string[]} unmapped - vendor bone names that had no canonical mapping
 */

const loader = new GLTFLoader();

/**
 * Load a rigged .glb and normalise its bone names to the canonical
 * humanoid vocabulary (PLAN.md §2.1). Unmapped bones (fingers, twist
 * bones, ...) are logged loudly, not thrown — Phase 1's "done" bar is
 * *zero* unmapped bones for the joints this tool actually poses, but a
 * rig with extra bones this tool ignores should still load.
 * @param {string} url
 * @returns {Promise<Rig>}
 */
export async function loadRig(url) {
  const gltf = await loader.loadAsync(url);
  return buildRig(gltf.scene);
}

/** Shared by loadRig() and the procedural test rig (rig/testRig.js). */
export function buildRig(object) {
  /** @type {import('three').Skeleton | null} */
  let skeleton = null;
  /** @type {import('three').SkinnedMesh | null} */
  let mesh = null;
  object.traverse((node) => {
    if (node.isSkinnedMesh && !skeleton) {
      skeleton = node.skeleton;
      mesh = node;
    }
    if (node.isMesh) {
      node.castShadow = true;
      node.receiveShadow = true;
    }
  });
  if (!skeleton) throw new Error('load.js: no SkinnedMesh found in loaded scene');

  const vendorNames = skeleton.bones.map((b) => b.name);
  const { mapped, unmapped } = buildNameTable(vendorNames);

  const bonesByName = new Map();
  for (const [canonical, vendorName] of mapped) {
    const bone = skeleton.bones.find((b) => b.name === vendorName);
    bone.userData.bindQuaternion = bone.quaternion.clone();
    bonesByName.set(canonical, bone);
  }

  if (unmapped.length) {
    console.warn(
      `[rig] ${unmapped.length} bone(s) had no canonical mapping (ignored, not posable):`,
      unmapped,
    );
  }
  console.info(`[rig] canonical bone table (${bonesByName.size} bones):`, [...bonesByName.keys()]);

  const root = bonesByName.get('hips') ?? skeleton.bones[0];

  return { object, root, skeleton, mesh, bonesByName, unmapped };
}
