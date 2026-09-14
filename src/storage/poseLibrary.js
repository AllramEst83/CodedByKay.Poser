import { createStore, del, entries, get, set } from 'idb-keyval';
import { toPoseDocument, fromPoseDocument } from '../pose/serialize.js';

// Pose library persistence. IndexedDB, not localStorage (PLAN.md §6.5):
// localStorage caps at ~5MB and stores strings, so a base64 thumbnail costs
// ~33% overhead — a library of dozens of poses throws QuotaExceededError
// mid-save. IndexedDB has no such ceiling and stores thumbnails as Blobs.
const store = createStore('pose-tool', 'poses');

function makeId() {
  return crypto.randomUUID();
}

/**
 * @param {string} name
 * @param {{ rootPosition: number[], bones: Record<string, number[]> }} snapshot
 * @param {string} modelId
 * @param {Blob} [thumbnail]
 */
export async function savePose(name, snapshot, modelId, thumbnail) {
  const id = makeId();
  const record = {
    id,
    name,
    createdAt: Date.now(),
    thumbnail: thumbnail ?? null,
    doc: toPoseDocument(snapshot, modelId),
  };
  await set(id, record, store);
  return id;
}

export async function loadPose(id) {
  const record = await get(id, store);
  if (!record) throw new Error(`poseLibrary: no pose with id "${id}"`);
  return { ...record, snapshot: fromPoseDocument(record.doc) };
}

export async function deletePose(id) {
  await del(id, store);
}

/** Returns library entries newest-first, without decoding full pose data. */
export async function listPoses() {
  const all = await entries(store);
  return all
    .map(([id, record]) => ({
      id,
      name: record.name,
      createdAt: record.createdAt,
      thumbnail: record.thumbnail,
      modelId: record.doc?.model,
    }))
    .sort((a, b) => b.createdAt - a.createdAt);
}

/** Exports a single pose as a downloadable JSON string (PLAN.md §Phase 4 import/export). */
export async function exportPoseJSON(id) {
  const record = await get(id, store);
  if (!record) throw new Error(`poseLibrary: no pose with id "${id}"`);
  return JSON.stringify(record.doc, null, 2);
}
