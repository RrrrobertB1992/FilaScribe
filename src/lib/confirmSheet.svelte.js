// A confirm sheet in the app's own style, in place of the browser's confirm()
// pop-up. `ask()` opens it and gives back a promise: true for the confirm
// button, false for Cancel, Escape or a tap outside the sheet. The sheet
// itself is ConfirmSheet.svelte, mounted once in App.svelte.

export const confirmState = $state({ request: null });

/**
 * Ask a yes/no question. `kicker` is the small title above, `title` the question,
 * `text` an optional line under it, `confirm` the button's words (the action
 * itself, such as "Remove all"), and `danger` makes the button red for things
 * that delete data.
 */
export function ask({ kicker = '', title, text = '', confirm, danger = false }) {
  // A second question while one is open turns the first into a No
  confirmState.request?.resolve(false);
  return new Promise((resolve) => {
    confirmState.request = { kicker, title, text, confirm, danger, resolve };
  });
}

export function answer(yes) {
  const r = confirmState.request;
  if (!r) return;
  confirmState.request = null;
  r.resolve(yes);
}
