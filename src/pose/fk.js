import { Raycaster, Vector2 } from 'three';
import { TransformControls } from 'three/addons/controls/TransformControls.js';
import { clampQuaternion } from '../rig/limits.js';

// FK posing: click a joint proxy, drag it with TransformControls in
// 'rotate' mode. TransformControls is the one sanctioned exception to
// "nothing writes bone.quaternion directly except state.js" (PLAN.md §2) —
// it's the manipulation UI itself. Every drag still ends by writing the
// final value back through state.setBoneQuaternion() and commandStack, so
// undo and IK see one consistent source of truth.
//
// See PLAN.md §6.2: since r169 TransformControls extends Controls, not
// Object3D — scene.add(controls) adds nothing; you must add controls.getHelper().

/**
 * @param {object} deps
 * @param {import('three').Camera} deps.camera
 * @param {import('three').WebGLRenderer} deps.renderer
 * @param {import('three').Scene} deps.scene
 * @param {import('three').Object3D} deps.orbitControls
 * @param {Map<string, import('three').Bone>} deps.bonesByName
 * @param {Map<string, import('three').Mesh>} deps.proxies
 * @param {(name: string|null) => void} deps.setSelected
 * @param {ReturnType<typeof import('../app/state.js').createState>} deps.state
 * @param {ReturnType<typeof import('../app/commands.js').createCommandStack>} deps.commandStack
 * @param {() => void} deps.invalidate
 */
export function createFkController({
  camera,
  renderer,
  scene,
  orbitControls,
  bonesByName,
  proxies,
  setSelected,
  state,
  commandStack,
  invalidate,
}) {
  const transformControls = new TransformControls(camera, renderer.domElement);
  transformControls.setMode('rotate');
  transformControls.setSpace('local');
  scene.add(transformControls.getHelper());

  let selectedName = null;

  transformControls.addEventListener('dragging-changed', (event) => {
    orbitControls.enabled = !event.value;
    if (event.value) {
      commandStack.beginBoneDrag(selectedName);
    } else {
      finalizeDrag();
    }
  });

  transformControls.addEventListener('objectChange', () => {
    if (!selectedName) return;
    const bone = bonesByName.get(selectedName);
    bone.quaternion.copy(clampQuaternion(selectedName, bone.quaternion));
    invalidate();
  });

  function finalizeDrag() {
    if (!selectedName) return;
    const bone = bonesByName.get(selectedName);
    state.setBoneQuaternion(selectedName, bone.quaternion);
    commandStack.endBoneDrag();
    invalidate();
  }

  function select(name) {
    selectedName = name;
    setSelected(name);
    if (name) {
      transformControls.attach(bonesByName.get(name));
    } else {
      transformControls.detach();
    }
    invalidate();
  }

  const raycaster = new Raycaster();
  const pointer = new Vector2();
  const proxyMeshes = [...proxies.values()];

  function onPointerDown(event) {
    if (transformControls.dragging) return;
    const rect = renderer.domElement.getBoundingClientRect();
    pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    raycaster.setFromCamera(pointer, camera);
    const hits = raycaster.intersectObjects(proxyMeshes, false);
    if (hits.length) {
      select(hits[0].object.userData.canonicalBone);
    }
  }

  renderer.domElement.addEventListener('pointerdown', onPointerDown);

  function dispose() {
    renderer.domElement.removeEventListener('pointerdown', onPointerDown);
    transformControls.dispose();
  }

  return { select, getSelected: () => selectedName, dispose };
}
