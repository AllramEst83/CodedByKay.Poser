import {
  ACESFilmicToneMapping,
  Mesh,
  MeshStandardMaterial,
  PCFShadowMap,
  PerspectiveCamera,
  PlaneGeometry,
  Scene,
  SRGBColorSpace,
  WebGLRenderer,
} from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { applyLightingPreset } from './lighting.js';

// Scene, camera, renderer, ground, orbit controls. Color pipeline is set
// correctly from the start (PLAN.md §Phase 1) — retrofitting it later
// changes every lighting preset already tuned.
export function createViewer(container) {
  const scene = new Scene();

  const camera = new PerspectiveCamera(
    45,
    container.clientWidth / container.clientHeight,
    0.05,
    100,
  );
  camera.position.set(1.6, 1.5, 2.4);

  const renderer = new WebGLRenderer({
    antialias: true,
    preserveDrawingBuffer: true, // required for screenshot export, §6.4
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(container.clientWidth, container.clientHeight);
  renderer.outputColorSpace = SRGBColorSpace;
  renderer.toneMapping = ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = PCFShadowMap;
  container.appendChild(renderer.domElement);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.target.set(0, 1, 0);
  controls.enableDamping = true;
  controls.minDistance = 0.5;
  controls.maxDistance = 10;
  controls.update();

  applyLightingPreset(scene, 'studio');

  const ground = new Mesh(
    new PlaneGeometry(10, 10),
    new MeshStandardMaterial({ color: 0x2a2a2e, roughness: 1 }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);

  function resize() {
    const { clientWidth: w, clientHeight: h } = container;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h);
  }

  const resizeObserver = new ResizeObserver(resize);
  resizeObserver.observe(container);

  function dispose() {
    resizeObserver.disconnect();
    controls.dispose();
    renderer.dispose();
    container.removeChild(renderer.domElement);
  }

  return { scene, camera, renderer, controls, ground, resize, dispose };
}
