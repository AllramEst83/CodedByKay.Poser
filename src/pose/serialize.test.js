import { describe, expect, it } from 'vitest';
import {
  SCHEMA_VERSION,
  fromPoseDocument,
  parsePoseFromJSON,
  serializePoseToJSON,
  toPoseDocument,
} from './serialize.js';

const snapshot = {
  rootPosition: [0, 0, 0],
  bones: { hips: [0, 0, 0, 1], leftUpperArm: [0.1, 0.2, 0.3, 0.9] },
};

describe('serialize', () => {
  it('round-trips through JSON with bit-identical bone rotations', () => {
    const json = serializePoseToJSON(snapshot, 'rpm-female-a');
    const parsed = parsePoseFromJSON(json);
    expect(parsed.bones).toEqual(snapshot.bones);
    expect(parsed.rootPosition).toEqual(snapshot.rootPosition);
    expect(parsed.model).toBe('rpm-female-a');
  });

  it('stamps the current schema version', () => {
    const doc = toPoseDocument(snapshot, 'rpm-female-a');
    expect(doc.schema).toBe(SCHEMA_VERSION);
  });

  it('rejects a document with no schema field', () => {
    expect(() => fromPoseDocument({ model: 'x', bones: {} })).toThrow(/schema/);
  });

  it('rejects a document from a newer, unsupported schema', () => {
    expect(() => fromPoseDocument({ schema: SCHEMA_VERSION + 1, bones: {} })).toThrow(/newer/);
  });
});
