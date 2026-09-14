import { Bone, Group, MathUtils, Matrix4, Mesh, MeshBasicMaterial, SphereGeometry, Vector3 } from 'three';
import { CCDIKSolver } from 'three/addons/animation/CCDIKSolver.js';
import { TransformControls } from 'three/addons/controls/TransformControls.js';
import { AXIS_VECTORS, getLimit } from '../rig/limits.js';

// Phase 3 — IK layer. Uses three's own CCDIKSolver rather than the
// abandoned `three-ik` (PLAN.md §1.1). Its `iks` config addresses
// `target`/`effector` as bone *indices* into `skeleton.bones`, not
// Object3Ds, so a goal bone is appended to the skeleton once here at
// setup — never per-frame (PLAN.md §1.1, §Phase 3).
const DEG = MathUtils.DEG2RAD;

const CHAINS = [
  { name: 'leftArm', root: 'leftUpperArm', mid: 'leftLowerArm', effector: 'leftHand' },
  { name: 'rightArm', root: 'rightUpperArm', mid: 'rightLowerArm', effector: 'rightHand' },
  { name: 'leftLeg', root: 'leftUpperLeg', mid: 'leftLowerLeg', effector: 'leftFoot' },
  { name: 'rightLeg', root: 'rightUpperLeg', mid: 'rightLowerLeg', effector: 'rightFoot' },
];

// Reuse rig/limits.js as the solver's rotationMin/rotationMax so an IK
// elbow/knee can't invert (PLAN.md §Phase 3) — one limit table shared by
// FK's clampQuaternion and IK's native link constraints, rather than two
// definitions that could drift apart. CCDIKSolver's `limitation` is its
// own native single-axis hinge constraint; for our hinges (elbow, knee)
// that's a closer match than approximating one with a ball clamp.
function ikLinkConfig(canonicalName, boneIndex) {
  const limit = getLimit(canonicalName);
  const config = { index: boneIndex };
  if (!limit) return config;
  if (limit.type === 'hinge') {
    const axis = AXIS_VECTORS[limit.axis];
    config.limitation = axis.clone();
    config.rotationMin = axis.clone().multiplyScalar(limit.min * DEG);
    config.rotationMax = axis.clone().multiplyScalar(limit.max * DEG);
  } else {
    config.rotationMin = new Vector3(limit.min[0] * DEG, limit.min[1] * DEG, limit.min[2] * DEG);
    config.rotationMax = new Vector3(limit.max[0] * DEG, limit.max[1] * DEG, limit.max[2] * DEG);
  }
  return config;
}

function makeGoalMarker() {
  return new Mesh(
    new SphereGeometry(0.03, 12, 8),
    new MeshBasicMaterial({ color: 0x57ff9e, depthTest: false, transparent: true, opacity: 0.9 }),
  );
}

/**
 * @param {object} deps
 * @param {import('three').Scene} deps.scene
 * @param {import('three').Camera} deps.camera
 * @param {import('three').WebGLRenderer} deps.renderer
 * @param {import('three').Object3D} deps.orbitControls
 * @param {import('../rig/load.js').Rig} deps.rig
 * @param {ReturnType<typeof import('../app/state.js').createState>} deps.state
 * @param {ReturnType<typeof import('../app/commands.js').createCommandStack>} deps.commandStack
 * @param {() => void} deps.invalidate
 * @param {Set<string>} [deps.ikLockedBones] - canonical bone names FK should ignore while their chain is IK-driven
 * @param {boolean} [deps.debug] - add CCDIKHelper visualization
 */
export function createIkController({
  scene,
  camera,
  renderer,
  orbitControls,
  rig,
  state,
  commandStack,
  invalidate,
  ikLockedBones = new Set(),
  debug = false,
}) {
  const { object: rigObject, skeleton, mesh, bonesByName } = rig;
  rigObject.updateMatrixWorld(true); // fresh world matrices before reading bind-pose positions (PLAN.md §6.8)

  const bones = skeleton.bones;
  const goalsGroup = new Group();
  goalsGroup.name = 'ik-goals';
  scene.add(goalsGroup);

  const iks = [];
  const chains = new Map();

  for (const chain of CHAINS) {
    const effectorBone = bonesByName.get(chain.effector);
    const midBone = bonesByName.get(chain.mid);
    const rootBone = bonesByName.get(chain.root);
    const effectorIndex = bones.indexOf(effectorBone);
    const midIndex = bones.indexOf(midBone);
    const rootIndex = bones.indexOf(rootBone);

    const goal = new Bone();
    goal.name = `ikGoal:${chain.name}`;
    const worldPos = new Vector3();
    effectorBone.getWorldPosition(worldPos);
    goal.position.copy(worldPos);
    const marker = makeGoalMarker();
    marker.visible = false;
    goal.add(marker);
    goalsGroup.add(goal);

    const targetIndex = bones.length;
    bones.push(goal);
    skeleton.boneInverses.push(new Matrix4());

    const config = {
      target: targetIndex,
      effector: effectorIndex,
      links: [ikLinkConfig(chain.mid, midIndex), ikLinkConfig(chain.root, rootIndex)],
      iteration: 6,
    };
    iks.push(config);

    const transformControls = new TransformControls(camera, renderer.domElement);
    transformControls.setMode('translate');
    transformControls.size = 0.6;
    transformControls.enabled = false;
    scene.add(transformControls.getHelper());

    const entry = {
      config,
      goal,
      marker,
      transformControls,
      effectorBone,
      midBone,
      rootBone,
      midName: chain.mid,
      rootName: chain.root,
      enabled: false,
    };
    chains.set(chain.name, entry);

    transformControls.addEventListener('dragging-changed', (event) => {
      orbitControls.enabled = !event.value;
      if (event.value) {
        commandStack.beginBoneDrag([entry.midName, entry.rootName]);
      } else {
        commandStack.endBoneDrag();
      }
    });
    transformControls.addEventListener('objectChange', () => solveAndSync(chain.name));
  }

  // Re-init once after every goal bone is appended — this resizes the
  // skeleton's bone-matrix buffer and forces one material recompile,
  // which is the accepted one-time cost from PLAN.md §1.1. Never call
  // this per-frame.
  skeleton.init();

  const solver = new CCDIKSolver(mesh, iks);

  function solveAndSync(chainName) {
    const entry = chains.get(chainName);
    entry.goal.updateMatrixWorld(true); // the goal just moved this tick — stale-matrix gotcha, §6.8
    solver.updateOne(entry.config);
    state.setBoneQuaternion(entry.midName, entry.midBone.quaternion);
    state.setBoneQuaternion(entry.rootName, entry.rootBone.quaternion);
    invalidate();
  }

  /**
   * Move a chain's goal to a world position and re-solve, as one undoable
   * step — the same operation a TransformControls drag performs, exposed
   * directly for scripted posing (and for testing the solver wiring
   * without simulating a 3D gizmo drag).
   * @param {string} chainName
   * @param {import('three').Vector3} worldPosition
   */
  function moveGoalTo(chainName, worldPosition) {
    const entry = chains.get(chainName);
    if (!entry) throw new Error(`ik: unknown chain "${chainName}"`);
    commandStack.beginBoneDrag([entry.midName, entry.rootName]);
    entry.goal.position.copy(worldPosition);
    solveAndSync(chainName);
    commandStack.endBoneDrag();
  }

  /**
   * Per-limb FK/IK toggle (PLAN.md §Phase 3). Enabling snaps the goal to
   * the limb's current position so it doesn't jump. Disabling just stops
   * driving the chain — state.js already holds the last-solved rotations
   * (solveAndSync writes through on every drag step, not only at drag
   * end), so switching back to FK picks up exactly where IK left off
   * instead of snapping back to a stale FK value.
   */
  function setChainEnabled(name, enabled) {
    const entry = chains.get(name);
    if (!entry || entry.enabled === enabled) return;
    entry.enabled = enabled;

    if (enabled) {
      const worldPos = new Vector3();
      entry.effectorBone.getWorldPosition(worldPos);
      entry.goal.position.copy(worldPos);
      entry.goal.updateMatrixWorld(true);
      entry.transformControls.attach(entry.goal);
      entry.transformControls.enabled = true;
      entry.marker.visible = true;
      ikLockedBones.add(entry.midName);
      ikLockedBones.add(entry.rootName);
    } else {
      entry.transformControls.detach();
      entry.transformControls.enabled = false;
      entry.marker.visible = false;
      ikLockedBones.delete(entry.midName);
      ikLockedBones.delete(entry.rootName);
    }
    invalidate();
  }

  function isChainEnabled(name) {
    return chains.get(name)?.enabled ?? false;
  }

  function dispose() {
    for (const entry of chains.values()) {
      entry.transformControls.dispose();
    }
    scene.remove(goalsGroup);
  }

  return {
    chainNames: CHAINS.map((c) => c.name),
    setChainEnabled,
    isChainEnabled,
    moveGoalTo,
    dispose,
  };
}
