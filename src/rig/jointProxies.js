import { Mesh, MeshBasicMaterial, SphereGeometry } from 'three';

// One small pickable sphere per posable joint, parented to its bone.
// Raycast against these, never against bones (a Bone is a bare Object3D —
// it has no geometry and can never be hit) and never against the skinned
// mesh itself, which always raycasts the bind pose (PLAN.md §1.2).
const RADIUS = 0.025;

const geometry = new SphereGeometry(RADIUS, 12, 8);

function proxyMaterial(color) {
  return new MeshBasicMaterial({ color, depthTest: false, transparent: true, opacity: 0.9 });
}

const COLOR_DEFAULT = 0xffd23f;
const COLOR_SELECTED = 0xff5757;

/**
 * @param {Map<string, import('three').Bone>} bonesByName
 * @returns {{ proxies: Map<string, import('three').Mesh>, setSelected: (name: string|null) => void }}
 */
export function createJointProxies(bonesByName) {
  const proxies = new Map();
  for (const [name, bone] of bonesByName) {
    const mesh = new Mesh(geometry, proxyMaterial(COLOR_DEFAULT));
    mesh.renderOrder = 999;
    mesh.name = `joint:${name}`;
    mesh.userData.canonicalBone = name;
    bone.add(mesh);
    proxies.set(name, mesh);
  }

  let selected = null;
  function setSelected(name) {
    if (selected) proxies.get(selected)?.material.color.set(COLOR_DEFAULT);
    selected = name;
    if (selected) proxies.get(selected)?.material.color.set(COLOR_SELECTED);
  }

  return { proxies, setSelected };
}
