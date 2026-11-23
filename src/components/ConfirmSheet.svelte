<script>
  // The bottom sheet for every "Are you sure?" in the app (see lib/confirmSheet.svelte.js).
  // Cancel has the focus, so a stray tap can't remove anything; Escape and a tap
  // on the dim area outside the sheet also say No.
  import { confirmState, answer } from '../lib/confirmSheet.svelte.js';
  let cancelBtn = $state();
  const request = $derived(confirmState.request);
  $effect(() => { if (request) cancelBtn?.focus(); });
</script>

<svelte:window onkeydown={(e) => request && e.key === 'Escape' && answer(false)} />
{#if request}
  <div class="scrim" role="presentation" onclick={(e) => e.target === e.currentTarget && answer(false)}>
    <div class="sheet" role="dialog" aria-modal="true" aria-labelledby="confirm-sheet-title">
      {#if request.kicker}<p class="kicker" class:danger={request.danger}>{request.kicker}</p>{/if}
      <h2 id="confirm-sheet-title">{request.title}</h2>
      {#if request.text}<p class="muted">{request.text}</p>{/if}
      <div class="actions">
        <button bind:this={cancelBtn} type="button" class="btn" onclick={() => answer(false)}>Cancel</button>
        <button type="button" class="btn" class:danger={request.danger} class:primary={!request.danger} onclick={() => answer(true)}>{request.confirm}</button>
      </div>
    </div>
  </div>
{/if}

<style>
  .scrim {
    position: fixed;
    inset: 0;
    z-index: 30;
    display: grid;
    align-items: end;
    background: rgba(10, 14, 20, 0.45);
  }
  .sheet {
    display: grid;
    gap: var(--s3);
    max-width: 560px;
    width: 100%;
    margin: 0 auto;
    padding: var(--s5) var(--s5) calc(var(--s5) + env(safe-area-inset-bottom));
    border-radius: 16px 16px 0 0;
    background: var(--surface);
  }
  .sheet p { margin: 0; }
  .kicker {
    font-family: var(--font-label);
    font-weight: 700;
    font-size: 0.75rem;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--action);
  }
  .kicker.danger { color: var(--danger); }
  h2 { font-size: 1.25rem; overflow-wrap: anywhere; }
  .muted { color: var(--muted); font-size: 0.875rem; }
  .actions { display: flex; gap: var(--s2); }
  .actions .btn { flex: 1; }
  .actions .danger { border-color: var(--danger); }
</style>
