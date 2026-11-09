<script>
  // The one look for a message about what just happened (written, saved, failed,
  // NFC off). Same strip on every tab: an icon in the kind's color, the text in
  // the normal ink, and a × to dismiss it. `actions` are buttons under the text.
  let { kind = 'info', cls = '', ondismiss, children, actions } = $props();
</script>

<div class="message {kind} {cls}" role={kind === 'error' ? 'alert' : 'status'}>
  <span class="mark" aria-hidden="true">
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
      {#if kind === 'ok'}<path d="M5 12.5 10 17.5 19 7" />
      {:else if kind === 'error'}<path d="M12 6.5v7" /><path d="M12 17.5h.01" />
      {:else}<path d="M12 10.5v7" /><path d="M12 6.5h.01" />{/if}
    </svg>
  </span>
  <div class="text">
    <p>{@render children?.()}</p>
    {#if actions}<div class="acts">{@render actions()}</div>{/if}
  </div>
  {#if ondismiss}
    <button type="button" class="x" aria-label="Dismiss message" onclick={ondismiss}>
      <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18" /></svg>
    </button>
  {/if}
</div>

<style>
  .message {
    --tone: var(--muted);
    display: flex;
    align-items: center;
    gap: var(--s3);
    padding: var(--s1) var(--s1) var(--s1) var(--s3);
    border: 1px solid var(--line);
    border-radius: var(--r-card);
    background: var(--surface);
    color: var(--ink);
    font-size: 0.9375rem;
    line-height: 1.35;
  }
  .ok { --tone: var(--ok); }
  .error { --tone: var(--danger); }
  .mark {
    flex: none;
    display: grid;
    place-items: center;
    width: 24px;
    height: 24px;
    border-radius: 50%;
    color: var(--tone);
    background: color-mix(in srgb, var(--tone) 18%, var(--surface));
  }
  .text { flex: 1; min-width: 0; display: grid; gap: var(--s2); padding: var(--s1) 0; align-self: center; }
  p { margin: 0; overflow-wrap: anywhere; }
  .acts { display: flex; flex-wrap: wrap; gap: var(--s2); }
  .x {
    flex: none;
    display: grid;
    place-items: center;
    width: 36px;
    height: 36px;
    border: 0;
    border-radius: var(--r-control);
    background: none;
    color: var(--muted);
    cursor: pointer;
  }
</style>
