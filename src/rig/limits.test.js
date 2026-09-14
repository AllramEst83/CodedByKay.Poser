import { MathUtils, Quaternion } from 'three';
import { describe, expect, it } from 'vitest';
import { clampQuaternion, getLimit } from './limits.js';

function quatFromAxisAngleDeg(axis, deg) {
  return new Quaternion().setFromAxisAngle(axis, MathUtils.degToRad(deg));
}

describe('clampQuaternion — hinge (knee/elbow)', () => {
  it('leaves an in-range angle effectively unchanged', () => {
    expect(getLimit('leftLowerLeg')).toMatchObject({ type: 'hinge', axis: 'x' });
    const q = quatFromAxisAngleDeg({ x: 1, y: 0, z: 0 }, 45);
    const clamped = clampQuaternion('leftLowerLeg', q);
    expect(clamped.angleTo(q)).toBeLessThan(1e-6);
  });

  it('clamps an out-of-range angle to the max', () => {
    const q = quatFromAxisAngleDeg({ x: 1, y: 0, z: 0 }, 179);
    const clamped = clampQuaternion('leftLowerLeg', q);
    const expected = quatFromAxisAngleDeg({ x: 1, y: 0, z: 0 }, 150); // knee max
    expect(clamped.angleTo(expected)).toBeLessThan(1e-6);
  });

  it('is idempotent: clamping a clamped value returns the same value', () => {
    const q = quatFromAxisAngleDeg({ x: 1, y: 0, z: 0 }, 179);
    const once = clampQuaternion('leftLowerLeg', q);
    const twice = clampQuaternion('leftLowerLeg', once);
    expect(twice.angleTo(once)).toBeLessThan(1e-6);
  });

  it('disallows hyperextension (negative below min)', () => {
    const q = quatFromAxisAngleDeg({ x: 1, y: 0, z: 0 }, -30);
    const clamped = clampQuaternion('rightLowerLeg', q);
    const expected = new Quaternion(); // min is 0
    expect(clamped.angleTo(expected)).toBeLessThan(1e-6);
  });
});

describe('clampQuaternion — ball joint', () => {
  it('is idempotent for an out-of-range rotation', () => {
    const q = quatFromAxisAngleDeg({ x: 0, y: 1, z: 0 }, 179);
    const once = clampQuaternion('leftUpperArm', q);
    const twice = clampQuaternion('leftUpperArm', once);
    expect(twice.angleTo(once)).toBeLessThan(1e-6);
  });

  it('passes bones with no configured limit through unchanged', () => {
    const q = quatFromAxisAngleDeg({ x: 1, y: 1, z: 0 }, 999); // nonsense angle, doesn't matter
    expect(getLimit('unknownBone')).toBeNull();
    const clamped = clampQuaternion('unknownBone', q);
    expect(clamped.equals(q)).toBe(true);
  });
});
