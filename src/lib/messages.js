// The messages above the bottom buttons: a short list kept in the order things
// happened (oldest on top). Anything that isn't an error fades by itself after
// AUTO_MS; an error stays until you dismiss it or start something new. Kept apart
// from the screen so the rules can be tested.
export const AUTO_MS = 5000;
// Most fading messages shown at once, so a burst can't fill the screen. Errors are never cut.
export const MAX_SHOWN = 3;

export const autoDismisses = (kind) => kind !== 'error';

/** Add a message ({ id, text, kind }) at the end. The same text again moves up to the end instead of piling up. */
export function push(list, msg) {
  const next = [...list.filter((m) => !(m.text === msg.text && m.kind === msg.kind)), msg];
  let extra = next.filter((m) => autoDismisses(m.kind)).length - MAX_SHOWN;
  if (extra <= 0) return next;
  return next.filter((m) => !(autoDismisses(m.kind) && extra-- > 0));
}

export const drop = (list, id) => list.filter((m) => m.id !== id);
