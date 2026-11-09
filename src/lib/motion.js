// Folding: anything that makes the page below it move up or down eases instead of jumping.
// One speed for everything, chosen in Settings (Fast, Normal or Slow; lib/motionSpeed.js).
// When the phone asks for reduced motion the duration is 0, so nothing animates (this is
// also what keeps the browser tests from waiting).
//
// - fold: a Svelte transition for a block that appears or disappears ({#if}, list rows).
// - morph: for a change that swaps content of a different height (a tab, a filter, Show more):
//   it measures before and after and eases the container between the two heights.
// Closable cards (<details>) fold with plain CSS in app.css.
import { slide } from 'svelte/transition';
import { tick } from 'svelte';
import * as Speed from './motionSpeed.js';

let level = Speed.load();
// The closable cards (<details>) fold with CSS, which reads the speed from here
const publish = () => globalThis.document?.documentElement.style.setProperty('--fold-ms', `${Speed.msFor(level)}ms`);
publish();

export const getSpeed = () => level;

export function setSpeed(value) {
  level = Speed.clean(value);
  Speed.store(level);
  publish();
}

const reduced = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
// Opening takes the full time; closing takes 70% of it (also in app.css), because a fold that
// is going away feels slower than one that is arriving, and drags if it takes as long.
const CLOSE = 0.7;
const duration = (closing = false) => (reduced() ? 0 : Math.round(Speed.msFor(level) * (closing ? CLOSE : 1)));

export function fold(node, params, options) {
  return slide(node, { duration: duration(options?.direction === 'out') });
}

/** Run `change` (which updates state), then ease `el` from its old height to its new one. */
export async function morph(el, change) {
  const before = el ? el.offsetHeight : 0;
  await change();
  if (!el || reduced() || typeof el.animate !== 'function') return;
  await tick();
  const after = el.offsetHeight;
  if (before === after) return;
  el.animate(
    [
      { height: `${before}px`, overflow: 'hidden' },
      { height: `${after}px`, overflow: 'hidden' },
    ],
    { duration: duration(after < before), easing: 'ease' },
  );
}
