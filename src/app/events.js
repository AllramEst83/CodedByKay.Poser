// Tiny pub/sub. Drives the render-on-demand loop (PLAN.md §6.1) and any UI
// that needs to react to state changes without polling it every frame.
export function createEmitter() {
  const listeners = new Set();
  return {
    subscribe(fn) {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
    emit(payload) {
      for (const fn of listeners) fn(payload);
    },
  };
}
