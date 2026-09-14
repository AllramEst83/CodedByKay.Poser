import { describe, expect, it } from 'vitest';
import { buildNameTable, mapBoneName, mirrorName } from './rigMap.js';

describe('mapBoneName', () => {
  it('maps Mixamo-prefixed vendor names', () => {
    expect(mapBoneName('mixamorig:Hips')).toBe('hips');
    expect(mapBoneName('mixamorig:LeftArm')).toBe('leftUpperArm');
    expect(mapBoneName('mixamorig:LeftForeArm')).toBe('leftLowerArm');
    expect(mapBoneName('mixamorig:RightUpLeg')).toBe('rightUpperLeg');
    expect(mapBoneName('mixamorig:RightFoot')).toBe('rightFoot');
  });

  it('maps unprefixed Ready Player Me / Mixamo-style names', () => {
    expect(mapBoneName('LeftHand')).toBe('leftHand');
    expect(mapBoneName('Spine1')).toBe('chest');
    expect(mapBoneName('Neck')).toBe('neck');
  });

  it('maps Blender/Rigify-style dotted suffix names', () => {
    expect(mapBoneName('upper_arm.L')).toBe('leftUpperArm');
    expect(mapBoneName('forearm.R')).toBe('rightLowerArm');
    expect(mapBoneName('thigh.L')).toBe('leftUpperLeg');
    expect(mapBoneName('shin.R')).toBe('rightLowerLeg');
  });

  it('throws, not warns, on an unmapped name', () => {
    expect(() => mapBoneName('LeftPinky3')).toThrow(/unmapped/);
  });

  it('throws on an empty name', () => {
    expect(() => mapBoneName('')).toThrow();
  });
});

describe('buildNameTable', () => {
  it('separates mapped bones from unmapped ones instead of throwing', () => {
    const { mapped, unmapped } = buildNameTable(['mixamorig:Hips', 'mixamorig:LeftHandThumb1']);
    expect(mapped.get('hips')).toBe('mixamorig:Hips');
    expect(unmapped).toEqual(['mixamorig:LeftHandThumb1']);
  });
});

describe('mirrorName', () => {
  it('swaps left and right', () => {
    expect(mirrorName('leftUpperArm')).toBe('rightUpperArm');
    expect(mirrorName('rightFoot')).toBe('leftFoot');
  });

  it('is identity for center bones', () => {
    expect(mirrorName('hips')).toBe('hips');
    expect(mirrorName('spine')).toBe('spine');
  });

  it('is its own inverse', () => {
    for (const name of ['leftHand', 'rightUpperLeg', 'hips']) {
      expect(mirrorName(mirrorName(name))).toBe(name);
    }
  });
});
