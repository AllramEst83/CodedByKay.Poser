// Keyboard shortcuts: Ctrl/Cmd+Z undo, Ctrl/Cmd+Shift+Z (or Ctrl+Y) redo.
export function installShortcuts({ commandStack, invalidate }) {
  function onKeyDown(event) {
    const mod = event.ctrlKey || event.metaKey;
    if (!mod || event.key.toLowerCase() !== 'z') return;
    event.preventDefault();
    const changed = event.shiftKey ? commandStack.redo() : commandStack.undo();
    if (changed) invalidate();
  }
  window.addEventListener('keydown', onKeyDown);
  return () => window.removeEventListener('keydown', onKeyDown);
}
