// {do, undo} stack. A drag (many mousemove events) coalesces into exactly
// one entry, pushed once dragging ends — not per mousemove (PLAN.md §Phase 2).
// A drag may move more than one bone at once (an IK goal drag rotates both
// link bones in a chain — PLAN.md §Phase 3), so beginBoneDrag/endBoneDrag
// accept either a single name or an array of names and always push exactly
// one combined undo entry.
export function createCommandStack(state) {
  const undoStack = [];
  const redoStack = [];
  let dragBefore = null; // [{ name, quaternion }] captured at drag start

  function beginBoneDrag(names) {
    const list = Array.isArray(names) ? names : [names];
    dragBefore = list.map((name) => ({ name, quaternion: state.getBoneQuaternion(name) }));
  }

  function endBoneDrag() {
    if (!dragBefore) return;
    const before = dragBefore;
    dragBefore = null;
    const changes = before
      .map(({ name, quaternion }) => ({ name, before: quaternion, after: state.getBoneQuaternion(name) }))
      .filter(({ before: b, after: a }) => !b.equals(a));
    if (!changes.length) return; // no-op drag: nothing to undo
    push({
      undo: () => changes.forEach((c) => state.setBoneQuaternion(c.name, c.before)),
      redo: () => changes.forEach((c) => state.setBoneQuaternion(c.name, c.after)),
    });
  }

  function push(command) {
    undoStack.push(command);
    redoStack.length = 0;
  }

  function undo() {
    const command = undoStack.pop();
    if (!command) return false;
    command.undo();
    redoStack.push(command);
    return true;
  }

  function redo() {
    const command = redoStack.pop();
    if (!command) return false;
    command.redo();
    undoStack.push(command);
    return true;
  }

  function canUndo() {
    return undoStack.length > 0;
  }

  function canRedo() {
    return redoStack.length > 0;
  }

  return { beginBoneDrag, endBoneDrag, push, undo, redo, canUndo, canRedo };
}
