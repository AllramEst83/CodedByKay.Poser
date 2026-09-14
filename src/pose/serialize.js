// Versioned pose schema (PLAN.md §6.6). Local quaternions, not Euler and
// not world-space: they compose cleanly, avoid gimbal lock, and stay valid
// when a rig's rest pose differs from another rig's.
export const SCHEMA_VERSION = 1;

/**
 * @param {{ rootPosition: number[], bones: Record<string, number[]> }} snapshot
 * @param {string} modelId
 */
export function toPoseDocument(snapshot, modelId) {
  return {
    schema: SCHEMA_VERSION,
    model: modelId,
    rootPosition: snapshot.rootPosition,
    bones: snapshot.bones,
  };
}

// One migration function per schema version bump: (doc at version N) -> (doc at version N+1).
const MIGRATIONS = {
  // 1: (doc) => ({ ...doc, schema: 2, newField: default }),
};

function migrate(doc) {
  let current = doc;
  while (current.schema < SCHEMA_VERSION) {
    const step = MIGRATIONS[current.schema];
    if (!step) {
      throw new Error(`serialize: no migration from schema ${current.schema} to ${SCHEMA_VERSION}`);
    }
    current = step(current);
  }
  return current;
}

/**
 * Parses and migrates a pose document to the current schema.
 * @param {object} doc - already-parsed JSON (call JSON.parse() first for a string)
 * @returns {{ model: string, rootPosition: number[], bones: Record<string, number[]> }}
 */
export function fromPoseDocument(doc) {
  if (typeof doc.schema !== 'number') throw new Error('serialize: missing schema field');
  if (doc.schema > SCHEMA_VERSION) {
    throw new Error(`serialize: pose schema ${doc.schema} is newer than this app supports (${SCHEMA_VERSION})`);
  }
  const migrated = migrate(doc);
  return { model: migrated.model, rootPosition: migrated.rootPosition, bones: migrated.bones };
}

export function serializePoseToJSON(snapshot, modelId) {
  return JSON.stringify(toPoseDocument(snapshot, modelId), null, 2);
}

export function parsePoseFromJSON(json) {
  return fromPoseDocument(JSON.parse(json));
}
