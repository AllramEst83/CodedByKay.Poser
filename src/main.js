import { createState } from './app/state.js';
import { createCommandStack } from './app/commands.js';
import { createViewer } from './viewer/scene.js';
import { createRenderLoop } from './viewer/render.js';
import { createTestRig } from './rig/testRig.js';
import { createJointProxies } from './rig/jointProxies.js';
import { createFkController } from './pose/fk.js';
import { createGui } from './ui/gui.js';
import { installShortcuts } from './ui/shortcuts.js';

const MODEL_ID = 'test-rig-v1'; // swap for a real model id once public/models/*.glb is added

const container = document.getElementById('app');
const { scene, camera, renderer, controls: orbitControls } = createViewer(container);
const renderLoop = createRenderLoop(renderer, scene, camera);

// Placeholder rig (src/rig/testRig.js) until a licensed .glb is sourced —
// see public/models/LICENSES.md. Swapping in a real model only means
// replacing this with `await loadRig('/models/<file>.glb')`.
const rig = createTestRig();
scene.add(rig.object);

const state = createState();
state.init(rig);

const commandStack = createCommandStack(state);
const { proxies, setSelected } = createJointProxies(rig.bonesByName);

const fk = createFkController({
  camera,
  renderer,
  scene,
  orbitControls,
  bonesByName: rig.bonesByName,
  proxies,
  setSelected,
  state,
  commandStack,
  invalidate: renderLoop.invalidate,
});

createGui({ state, commandStack, scene, modelId: MODEL_ID, invalidate: renderLoop.invalidate });
installShortcuts({ commandStack, invalidate: renderLoop.invalidate });

orbitControls.addEventListener('change', renderLoop.invalidate);
state.subscribe(renderLoop.invalidate);

window.addEventListener('resize', () => renderLoop.invalidate());

renderLoop.start();
