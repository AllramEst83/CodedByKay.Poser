// Render-on-demand loop (PLAN.md §6.1). A posing tool is static most of the
// time; an unconditional rAF render burns battery for nothing. Call
// `invalidate()` any time something visible changed — OrbitControls'
// 'change' event and state.subscribe() both wire into this.
export function createRenderLoop(renderer, scene, camera) {
  let dirty = true;
  let running = false;

  function invalidate() {
    dirty = true;
  }

  function frame() {
    if (!running) return;
    requestAnimationFrame(frame);
    if (dirty) {
      renderer.render(scene, camera);
      dirty = false;
    }
  }

  function start() {
    if (running) return;
    running = true;
    dirty = true;
    requestAnimationFrame(frame);
  }

  function stop() {
    running = false;
  }

  return { invalidate, start, stop };
}
