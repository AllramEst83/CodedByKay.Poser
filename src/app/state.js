import { Quaternion, Vector3 } from 'three';
import { createEmitter } from './events.js';

// Single source of truth for the pose: canonicalBone name -> Quaternion,
// plus root position. Nothing outside this module writes `bone.quaternion`
// directly (PLAN.md §2) — every mutation goes through setBoneQuaternion /
// setRootPosition so undo, IK, and FK never disagree.
export function createState() {
  const emitter = createEmitter();
  /** @type {Map<string, import('three').Bone>} */
  let bonesByName = new Map();
  /** @type {Map<string, Quaternion>} */
  const rotations = new Map();
  /** @type {import('three').Object3D | null} */
  let root = null;
  const rootPosition = new Vector3();

  function init(rig) {
    bonesByName = rig.bonesByName;
    root = rig.root;
    rotations.clear();
    for (const [name, bone] of bonesByName) {
      rotations.set(name, bone.quaternion.clone());
    }
    if (root) rootPosition.copy(root.position);
    emitter.emit({ type: 'init' });
  }

  function getBoneNames() {
    return [...bonesByName.keys()];
  }

  function getBoneQuaternion(name) {
    const q = rotations.get(name);
    if (!q) throw new Error(`state: unknown canonical bone "${name}"`);
    return q.clone();
  }

  function setBoneQuaternion(name, quaternion) {
    const bone = bonesByName.get(name);
    if (!bone) throw new Error(`state: unknown canonical bone "${name}"`);
    rotations.set(name, quaternion.clone());
    bone.quaternion.copy(quaternion);
    emitter.emit({ type: 'bone', name });
  }

  function setRootPosition(vec3) {
    rootPosition.copy(vec3);
    if (root) root.position.copy(vec3);
    emitter.emit({ type: 'root' });
  }

  function getRootPosition() {
    return rootPosition.clone();
  }

  function resetToBindPose() {
    for (const [name, bone] of bonesByName) {
      const identity = bone.userData.bindQuaternion
        ? bone.userData.bindQuaternion.clone()
        : new Quaternion();
      setBoneQuaternion(name, identity);
    }
    setRootPosition(new Vector3(0, 0, 0));
  }

  function getSnapshot() {
    const bones = {};
    for (const [name, q] of rotations) {
      bones[name] = [q.x, q.y, q.z, q.w];
    }
    return { rootPosition: rootPosition.toArray(), bones };
  }

  function applySnapshot(snapshot) {
    for (const [name, arr] of Object.entries(snapshot.bones)) {
      if (!bonesByName.has(name)) continue; // unknown-to-this-rig bone: skip, don't throw
      setBoneQuaternion(name, new Quaternion(...arr));
    }
    if (snapshot.rootPosition) setRootPosition(new Vector3(...snapshot.rootPosition));
  }

  return {
    init,
    getBoneNames,
    getBoneQuaternion,
    setBoneQuaternion,
    setRootPosition,
    getRootPosition,
    resetToBindPose,
    getSnapshot,
    applySnapshot,
    subscribe: emitter.subscribe,
  };
}
