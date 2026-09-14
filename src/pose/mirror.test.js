import { describe, expect, it } from 'vitest';
import { mirrorSnapshot } from './mirror.js';

const sample = {
  rootPosition: [0.1, 1.0, -0.2],
  bones: {
    hips: [0, 0, 0, 1],
    spine: [0.05, 0.1, -0.02, 0.99],
    leftUpperArm: [0.1, 0.2, 0.3, 0.9],
    rightUpperArm: [0.4, 0.1, -0.1, 0.9],
    leftHand: [0, 0.5, 0, 0.86],
  },
};

describe('mirrorSnapshot', () => {
  it('swaps left/right bone keys and negates root x', () => {
    const mirrored = mirrorSnapshot(sample);
    expect(mirrored.bones.rightUpperArm).toEqual([0.1, -0.2, -0.3, 0.9]);
    expect(mirrored.bones.leftUpperArm).toEqual([0.4, -0.1, 0.1, 0.9]);
    expect(mirrored.rootPosition).toEqual([-0.1, 1.0, -0.2]);
  });

  it('conjugates center-bone quaternions in place (no key swap)', () => {
    const mirrored = mirrorSnapshot(sample);
    expect(mirrored.bones.spine).toEqual([0.05, -0.1, 0.02, 0.99]);
  });

  it('mirror twice is the identity (PLAN.md §Phase 4 done-when)', () => {
    const twice = mirrorSnapshot(mirrorSnapshot(sample));
    expect(twice).toEqual(sample);
  });
});
