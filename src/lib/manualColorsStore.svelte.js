// The color overrides in use, shared by everything that shows brand colors
// (the Brand panel, the form, Settings). Reading `withManual(db)` inside a
// $derived re-runs it when an override changes.
import * as Manual from './manualColors.js';

let edits = $state.raw(Manual.load());
let cache = { db: null, edits: null, out: null };

export const getEdits = () => edits;

function update(next) {
  edits = next;
  Manual.store(next);
}

export const setEdit = (edit) => update(Manual.set(edits, edit));
export const removeEdit = (edit) => update(Manual.remove(edits, edit));
export const clearEdits = () => update([]);
// A restored backup: set the list in use (the backup already wrote it to storage)
export const replaceEdits = (list) => { edits = list; };

export function importEdits(incoming) {
  const r = Manual.importInto(edits, incoming);
  update(r.edits);
  return r.added;
}

/** The database with your overrides applied. */
export function withManual(db) {
  const current = edits; // read here so a $derived calling this tracks it
  if (cache.db === db && cache.edits === current) return cache.out;
  const out = Manual.apply(db, current);
  cache = { db, edits: current, out };
  return out;
}
