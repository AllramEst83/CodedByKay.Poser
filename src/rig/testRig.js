import {
  BoxGeometry,
  BufferAttribute,
  Bone,
  Group,
  Matrix4,
  MeshStandardMaterial,
  Quaternion,
  Skeleton,
  SkinnedMesh,
  Uint16BufferAttribute,
  Vector3,
} from 'three';
import { buildRig } from './load.js';

// A procedural rigged humanoid, built entirely from three.js primitives —
// no external .glb, so it carries no license entanglement (PLAN.md §5) and
// needs no network access. It exists to:
//   1. Stand in for the Phase 0 spike ("set bone.quaternion by hand, see the
//      mesh deform") without needing an asset first.
//   2. Give Phase 1/2 something real to load, pick, and pose while a proper
//      Ready Player Me / Sketchfab asset is sourced (see public/models/LICENSES.md).
//
// Bones use Mixamo-style vendor names on purpose, so it also exercises
// rigMap.js's normalisation path exactly like a real imported rig would.
//
// Each visual segment is a rigid box, fully skin-weighted (1.0) to a single
// bone — no smooth blending between segments. That's intentionally cheap:
// this rig's job is to prove the bone -> mesh deformation pipeline, not to
// look good.

// [boneName (vendor), parentBoneName|null, localOffset from parent]
const BONES = [
  ['mixamorig:Hips', null, [0, 1.0, 0]],
  ['mixamorig:Spine', 'mixamorig:Hips', [0, 0.15, 0]],
  ['mixamorig:Spine1', 'mixamorig:Spine', [0, 0.2, 0]],
  ['mixamorig:Neck', 'mixamorig:Spine1', [0, 0.2, 0]],
  ['mixamorig:Head', 'mixamorig:Neck', [0, 0.1, 0]],
  ['mixamorig:LeftShoulder', 'mixamorig:Spine1', [0.12, 0.03, 0]],
  ['mixamorig:LeftArm', 'mixamorig:LeftShoulder', [0.06, -0.01, 0]],
  ['mixamorig:LeftForeArm', 'mixamorig:LeftArm', [0.24, 0, 0]],
  ['mixamorig:LeftHand', 'mixamorig:LeftForeArm', [0.22, 0, 0]],
  ['mixamorig:RightShoulder', 'mixamorig:Spine1', [-0.12, 0.03, 0]],
  ['mixamorig:RightArm', 'mixamorig:RightShoulder', [-0.06, -0.01, 0]],
  ['mixamorig:RightForeArm', 'mixamorig:RightArm', [-0.24, 0, 0]],
  ['mixamorig:RightHand', 'mixamorig:RightForeArm', [-0.22, 0, 0]],
  ['mixamorig:LeftUpLeg', 'mixamorig:Hips', [0.1, -0.02, 0]],
  ['mixamorig:LeftLeg', 'mixamorig:LeftUpLeg', [0, -0.45, 0]],
  ['mixamorig:LeftFoot', 'mixamorig:LeftLeg', [0, -0.45, 0]],
  ['mixamorig:RightUpLeg', 'mixamorig:Hips', [-0.1, -0.02, 0]],
  ['mixamorig:RightLeg', 'mixamorig:RightUpLeg', [0, -0.45, 0]],
  ['mixamorig:RightFoot', 'mixamorig:RightLeg', [0, -0.45, 0]],
];

// [boneName to skin the segment to, endBoneName (defines the far point), thickness]
const SEGMENTS = [
  ['mixamorig:Spine', 'mixamorig:Neck', 0.28],
  ['mixamorig:Neck', 'mixamorig:Head', 0.1],
  ['mixamorig:Head', null, 0.18], // head "cap", uses a fixed length below
  ['mixamorig:LeftArm', 'mixamorig:LeftForeArm', 0.07],
  ['mixamorig:LeftForeArm', 'mixamorig:LeftHand', 0.06],
  ['mixamorig:LeftHand', null, 0.06],
  ['mixamorig:RightArm', 'mixamorig:RightForeArm', 0.07],
  ['mixamorig:RightForeArm', 'mixamorig:RightHand', 0.06],
  ['mixamorig:RightHand', null, 0.06],
  ['mixamorig:LeftUpLeg', 'mixamorig:LeftLeg', 0.11],
  ['mixamorig:LeftLeg', 'mixamorig:LeftFoot', 0.09],
  ['mixamorig:LeftFoot', null, 0.08],
  ['mixamorig:RightUpLeg', 'mixamorig:RightLeg', 0.11],
  ['mixamorig:RightLeg', 'mixamorig:RightFoot', 0.09],
  ['mixamorig:RightFoot', null, 0.08],
];

function boxBetween(a, b, thickness) {
  const geometry = new BoxGeometry(thickness, a.distanceTo(b), thickness);
  const mid = new Vector3().addVectors(a, b).multiplyScalar(0.5);
  const dir = new Vector3().subVectors(b, a).normalize();
  const quaternion = new Quaternion().setFromUnitVectors(new Vector3(0, 1, 0), dir);
  const matrix = new Matrix4().compose(mid, quaternion, new Vector3(1, 1, 1));
  geometry.applyMatrix4(matrix);
  return geometry;
}

function capAt(point, thickness, dir = new Vector3(0, -1, 0)) {
  const geometry = new BoxGeometry(thickness, thickness, thickness);
  const mid = new Vector3().copy(point).addScaledVector(dir, thickness * 0.5);
  geometry.translate(mid.x, mid.y, mid.z);
  return geometry;
}

/** Builds the procedural rig and returns it already normalised via buildRig(). */
export function createTestRig() {
  const group = new Group();
  group.name = 'test-rig';

  const bonesByVendorName = new Map();
  const bones = [];
  for (const [name, parentName, offset] of BONES) {
    const bone = new Bone();
    bone.name = name;
    bone.position.set(...offset);
    bonesByVendorName.set(name, bone);
    bones.push(bone);
    const parent = parentName ? bonesByVendorName.get(parentName) : group;
    parent.add(bone);
  }

  // World bind positions, needed to author segment geometry in bind pose.
  group.updateMatrixWorld(true);
  const worldPos = (name) => bonesByVendorName.get(name).getWorldPosition(new Vector3());

  const skeleton = new Skeleton(bones);
  const material = new MeshStandardMaterial({ color: 0x8fa3c4, roughness: 0.6 });

  for (const [boneName, endBoneName, thickness] of SEGMENTS) {
    const boneIndex = bones.indexOf(bonesByVendorName.get(boneName));
    const geometry = endBoneName
      ? boxBetween(worldPos(boneName), worldPos(endBoneName), thickness)
      : capAt(worldPos(boneName), thickness, boneName.includes('Head') ? new Vector3(0, 1, 0) : new Vector3(0, -1, 0));

    const vertexCount = geometry.attributes.position.count;
    const skinIndices = new Uint16Array(vertexCount * 4);
    const skinWeights = new Float32Array(vertexCount * 4);
    for (let i = 0; i < vertexCount; i++) {
      skinIndices[i * 4] = boneIndex;
      skinWeights[i * 4] = 1;
    }
    geometry.setAttribute('skinIndex', new Uint16BufferAttribute(skinIndices, 4));
    geometry.setAttribute('skinWeight', new BufferAttribute(skinWeights, 4));

    const mesh = new SkinnedMesh(geometry, material);
    mesh.bind(skeleton);
    mesh.frustumCulled = false;
    group.add(mesh);
  }

  return buildRig(group);
}
