// The "opening a card" choice as shared state, plus the little that cards share
// when it is on: a signal that a card was just opened (the others close), and
// the scroll that brings it to the top. Settings changes the choice; the cards
// on Create and Read & update and in Settings all follow it without a reload.
import * as OpenMode from './openMode.js';
import { foldMs } from './motion.js';

let mode = $state(OpenMode.load());
let opened = $state({ id: null, n: 0 });

export const getOpenMode = () => mode;
export const closesOthers = () => mode === 'close';
/** The last card opened: { id, n } (n counts up so a repeat is noticed). */
export const getOpened = () => opened;

export function setOpenMode(value) {
  mode = OpenMode.clean(value);
  OpenMode.store(mode);
}

/** A card was opened (by a tap or by itself): the other cards close and it scrolls to the top. */
export function cardOpened(id, el) {
  if (mode !== 'close') return;
  opened = { id, n: opened.n + 1 };
  if (el) bringToTop(el);
}

const TOP_GAP = 8;

// Follow the card up the screen while the cards above it fold shut, so it
// arrives at the top as they finish rather than jumping afterwards
function bringToTop(el) {
  const ms = foldMs();
  if (!ms) {
    requestAnimationFrame(() => window.scrollBy(0, el.getBoundingClientRect().top - TOP_GAP));
    return;
  }
  const end = performance.now() + ms;
  let last = performance.now();
  const step = (now) => {
    const remaining = end - now;
    const dt = now - last;
    last = now;
    const share = remaining <= dt ? 1 : dt / remaining;
    window.scrollBy(0, (el.getBoundingClientRect().top - TOP_GAP) * share);
    if (remaining > 0) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}
