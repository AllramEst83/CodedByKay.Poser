import GUI from 'lil-gui';
import { lightingPresets, applyLightingPreset } from '../viewer/lighting.js';
import { listPoses, loadPose, savePose } from '../storage/poseLibrary.js';

/**
 * @param {object} deps
 * @param {ReturnType<typeof import('../app/state.js').createState>} deps.state
 * @param {ReturnType<typeof import('../app/commands.js').createCommandStack>} deps.commandStack
 * @param {import('three').Scene} deps.scene
 * @param {string} deps.modelId
 * @param {() => void} deps.invalidate
 */
export function createGui({ state, commandStack, scene, modelId, invalidate }) {
  const gui = new GUI({ title: 'Pose Tool' });

  const poseFolder = gui.addFolder('Pose');
  poseFolder.add({ undo: () => commandStack.undo() && invalidate() }, 'undo').name('Undo (Ctrl+Z)');
  poseFolder.add({ redo: () => commandStack.redo() && invalidate() }, 'redo').name('Redo (Ctrl+Shift+Z)');
  poseFolder
    .add({ reset: () => state.resetToBindPose() }, 'reset')
    .name('Reset to bind pose');

  const libraryState = { name: 'pose', saved: '(none)' };
  const libraryFolder = gui.addFolder('Pose library');
  libraryFolder.add(libraryState, 'name').name('Name');
  libraryFolder.add(
    {
      save: async () => {
        await savePose(libraryState.name, state.getSnapshot(), modelId);
        await refreshPoseList();
      },
    },
    'save',
  ).name('Save current pose');

  let poseController = null;
  const poseOptions = { selected: '' };
  async function refreshPoseList() {
    const poses = await listPoses();
    const options = Object.fromEntries(poses.map((p) => [p.name, p.id]));
    if (poseController) libraryFolder.remove(poseController);
    poseController = libraryFolder
      .add(poseOptions, 'selected', poses.length ? options : { '(none saved)': '' })
      .name('Load pose')
      .onChange(async (id) => {
        if (!id) return;
        const { snapshot } = await loadPose(id);
        state.applySnapshot(snapshot);
      });
  }
  refreshPoseList();

  const lightingFolder = gui.addFolder('Lighting');
  const lightingState = { preset: 'studio' };
  lightingFolder
    .add(lightingState, 'preset', Object.keys(lightingPresets))
    .name('Preset')
    .onChange((preset) => {
      applyLightingPreset(scene, preset);
      invalidate();
    });

  return gui;
}
