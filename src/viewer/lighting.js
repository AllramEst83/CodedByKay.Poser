import { AmbientLight, DirectionalLight, Group } from 'three';

// Lighting presets. Each returns a Group of lights ready to add to the scene.
// Phase 5 will expose these as a picker; Phase 1 just needs "studio" so the
// model is readable.

function makeKeyFillRim() {
  const group = new Group();
  group.name = 'lighting';

  const key = new DirectionalLight(0xffffff, 3);
  key.position.set(3, 5, 4);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  key.shadow.camera.near = 0.5;
  key.shadow.camera.far = 20;
  key.shadow.camera.left = -3;
  key.shadow.camera.right = 3;
  key.shadow.camera.top = 3;
  key.shadow.camera.bottom = -3;
  key.shadow.bias = -0.0005;

  const fill = new DirectionalLight(0xaecbff, 1);
  fill.position.set(-4, 2, 2);

  const rim = new DirectionalLight(0xffffff, 1.5);
  rim.position.set(0, 4, -5);

  const ambient = new AmbientLight(0xffffff, 0.35);

  group.add(key, fill, rim, ambient);
  return group;
}

export const lightingPresets = {
  studio: makeKeyFillRim,
};

export function applyLightingPreset(scene, name = 'studio') {
  const existing = scene.getObjectByName('lighting');
  if (existing) scene.remove(existing);
  const factory = lightingPresets[name] ?? lightingPresets.studio;
  const group = factory();
  scene.add(group);
  return group;
}
