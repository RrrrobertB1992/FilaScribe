// Folding: anything that makes the page below it move up or down eases instead of jumping.
// One speed for everything (DURATION). When the phone asks for reduced motion the duration
// is 0, so nothing animates (this is also what keeps the browser tests from waiting).
//
// - fold: a Svelte transition for a block that appears or disappears ({#if}, list rows).
// - morph: for a change that swaps content of a different height (a tab, a filter, Show more):
//   it measures before and after and eases the container between the two heights.
// Closable cards (<details>) fold with plain CSS in app.css.
import { slide } from 'svelte/transition';
import { tick } from 'svelte';

export const DURATION = 200;

const reduced = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

export function fold(node) {
  return slide(node, { duration: reduced() ? 0 : DURATION });
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
    { duration: DURATION, easing: 'ease' },
  );
}
