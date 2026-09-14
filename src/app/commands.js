// {do, undo} stack. A drag (many mousemove events) coalesces into exactly
// one entry, pushed once dragging ends — not per mousemove (PLAN.md §Phase 2).
export function createCommandStack(state) {
  const undoStack = [];
  const redoStack = [];
  let dragBefore = null; // { name, quaternion } captured at drag start

  function beginBoneDrag(name) {
    dragBefore = { name, quaternion: state.getBoneQuaternion(name) };
  }

  function endBoneDrag() {
    if (!dragBefore) return;
    const { name, quaternion: before } = dragBefore;
    const after = state.getBoneQuaternion(name);
    dragBefore = null;
    if (before.equals(after)) return; // no-op drag: nothing to undo
    push({
      undo: () => state.setBoneQuaternion(name, before),
      redo: () => state.setBoneQuaternion(name, after),
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
