// The color database update flow that App (the notices at the bottom) and
// Settings (the Color database card) share, so a download started in one is
// seen in the other. The decisions are in colorDatabase.js (bootPlan and the
// cache); this holds what is on screen and runs the steps.
import * as ColorDb from './colorDatabase.js';
import * as Auto from './colorAutoUpdate.js';
import { loadSource, reloadBrandColors } from './brandColorsData.js';
import { getEdits } from './manualColorsStore.svelte.js';

let auto = $state(Auto.load());
// raw: these hold a whole database, which must not be wrapped in reactive proxies
let waiting = $state.raw(null); // a downloaded update that isn't installed: { status: 'update', ... }
let notice = $state.raw(null); // the notice at the bottom: { kind: 'offer' | 'downloading' | 'ready' | 'pending', days? }
let progress = $state.raw(null); // while downloading: { stage, loaded, total, wire }
let jump = $state(0);
let jumpDone = 0;

export const getAuto = () => auto;
export function setAuto(on) {
  auto = !!on;
  Auto.store(auto);
}
export const getWaiting = () => waiting;
export const setWaiting = (update) => (waiting = update);
export const getNotice = () => notice;
export const getProgress = () => progress;
export const setProgress = (p) => (progress = p);
/** Hides the notice for this session. A waiting update stays kept for the next start. */
export const closeNotice = () => (notice = null);

/** Settings: has "See changes" been asked for since it last looked? */
export const getJump = () => jump;
export function takeJump() {
  if (jump === jumpDone) return false;
  jumpDone = jump;
  return true;
}
/** Ask Settings to open Color database with the changes shown. */
export function requestChanges() {
  jump++;
}

const errorText = (e, fallback) => (e instanceof ColorDb.UpdateError ? e.message : fallback);

/**
 * Put the waiting update in use. Returns the database date; throws an
 * UpdateError if it couldn't be saved (nothing is changed then).
 */
export async function install(onbranddata) {
  if (!waiting) return '';
  const date = waiting.info.date;
  await ColorDb.applyUpdate(waiting.next);
  onbranddata(await reloadBrandColors());
  waiting = null;
  notice = null;
  return date;
}

/**
 * "Download update" on the notice. Returns { message, kind } for the app to
 * say when there is something to say.
 */
export async function download() {
  const before = notice;
  notice = { kind: 'downloading' };
  try {
    const result = await ColorDb.checkAndRemember(await loadSource(), { edits: getEdits(), onProgress: (p) => (progress = p) });
    if (result.status === 'update') {
      waiting = result;
      notice = { kind: 'ready' };
      return null;
    }
    notice = null;
    return { message: 'You have the newest database.', kind: 'ok' };
  } catch (e) {
    notice = before;
    return { message: errorText(e, 'Couldn’t check for updates. Try again.'), kind: 'error' };
  } finally {
    progress = null;
  }
}

/**
 * At app start. Uses no network unless Update automatically is on and the
 * database is old enough. Returns { message, kind } for the app to say, or null.
 */
export async function boot(onbranddata) {
  const current = await loadSource();
  const edits = getEdits();
  const age = ColorDb.ageSince(current.colors.source?.date, ColorDb.loadSeen().at);
  const saved = await ColorDb.loadPending(current, { edits });
  const plan = ColorDb.bootPlan({ age, auto, pending: !!saved });
  try {
    if (plan === 'install-pending') {
      waiting = saved;
      return await installed(onbranddata);
    }
    if (plan === 'show-pending') {
      waiting = saved;
      notice = { kind: 'pending' };
    } else if (plan === 'offer-download') {
      notice = { kind: 'offer', days: age };
    } else if (plan === 'auto-update') {
      const result = await ColorDb.checkAndRemember(current, { edits });
      if (result.status === 'update') {
        waiting = result;
        return await installed(onbranddata);
      }
    }
  } catch {
    // An automatic check that fails says nothing; the next start tries again
  }
  return null;
}

async function installed(onbranddata) {
  const date = await install(onbranddata);
  return { message: `Brand colors updated to ${date}.`, kind: 'ok' };
}
