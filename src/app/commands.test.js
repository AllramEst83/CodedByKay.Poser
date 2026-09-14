import { Quaternion } from 'three';
import { beforeEach, describe, expect, it } from 'vitest';
import { createCommandStack } from './commands.js';

// A minimal state double: just enough of state.js's surface for the
// command stack, without needing a real rig/skeleton.
function fakeState(initial) {
  const rotations = new Map(Object.entries(initial));
  return {
    getBoneQuaternion: (name) => rotations.get(name).clone(),
    setBoneQuaternion: (name, q) => rotations.set(name, q.clone()),
    _rotations: rotations,
  };
}

const IDENTITY = new Quaternion();
const QUARTER_X = new Quaternion().setFromAxisAngle({ x: 1, y: 0, z: 0 }, Math.PI / 2);
const QUARTER_Y = new Quaternion().setFromAxisAngle({ x: 0, y: 1, z: 0 }, Math.PI / 2);

describe('createCommandStack — single-bone drag', () => {
  let state;
  let commands;

  beforeEach(() => {
    state = fakeState({ leftUpperArm: IDENTITY });
    commands = createCommandStack(state);
  });

  it('undo restores the pre-drag value; redo re-applies it', () => {
    commands.beginBoneDrag('leftUpperArm');
    state.setBoneQuaternion('leftUpperArm', QUARTER_X);
    commands.endBoneDrag();

    expect(commands.undo()).toBe(true);
    expect(state.getBoneQuaternion('leftUpperArm').equals(IDENTITY)).toBe(true);

    expect(commands.redo()).toBe(true);
    expect(state.getBoneQuaternion('leftUpperArm').equals(QUARTER_X)).toBe(true);
  });

  it('a no-op drag pushes nothing to undo', () => {
    commands.beginBoneDrag('leftUpperArm');
    commands.endBoneDrag(); // no change made
    expect(commands.canUndo()).toBe(false);
  });

  it('undo/redo report false on an empty stack', () => {
    expect(commands.undo()).toBe(false);
    expect(commands.redo()).toBe(false);
  });

  it('a new drag clears the redo stack', () => {
    commands.beginBoneDrag('leftUpperArm');
    state.setBoneQuaternion('leftUpperArm', QUARTER_X);
    commands.endBoneDrag();
    commands.undo();
    expect(commands.canRedo()).toBe(true);

    commands.beginBoneDrag('leftUpperArm');
    state.setBoneQuaternion('leftUpperArm', QUARTER_Y);
    commands.endBoneDrag();
    expect(commands.canRedo()).toBe(false);
  });
});

describe('createCommandStack — multi-bone drag (IK)', () => {
  it('undoes/redoes every bone moved in one drag as a single entry', () => {
    const state = fakeState({ leftUpperArm: IDENTITY, leftLowerArm: IDENTITY });
    const commands = createCommandStack(state);

    commands.beginBoneDrag(['leftUpperArm', 'leftLowerArm']);
    state.setBoneQuaternion('leftUpperArm', QUARTER_X);
    state.setBoneQuaternion('leftLowerArm', QUARTER_Y);
    commands.endBoneDrag();

    expect(commands.undo()).toBe(true);
    expect(state.getBoneQuaternion('leftUpperArm').equals(IDENTITY)).toBe(true);
    expect(state.getBoneQuaternion('leftLowerArm').equals(IDENTITY)).toBe(true);
    expect(commands.canUndo()).toBe(false); // both bones undone by one entry

    expect(commands.redo()).toBe(true);
    expect(state.getBoneQuaternion('leftUpperArm').equals(QUARTER_X)).toBe(true);
    expect(state.getBoneQuaternion('leftLowerArm').equals(QUARTER_Y)).toBe(true);
  });

  it('drops only the bones that actually changed', () => {
    const state = fakeState({ leftUpperArm: IDENTITY, leftLowerArm: IDENTITY });
    const commands = createCommandStack(state);

    commands.beginBoneDrag(['leftUpperArm', 'leftLowerArm']);
    state.setBoneQuaternion('leftUpperArm', QUARTER_X); // only this one changes
    commands.endBoneDrag();

    commands.undo();
    expect(state.getBoneQuaternion('leftUpperArm').equals(IDENTITY)).toBe(true);
    expect(state.getBoneQuaternion('leftLowerArm').equals(IDENTITY)).toBe(true);
  });
});
