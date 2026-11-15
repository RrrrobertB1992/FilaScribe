<script>
  // The sheet that opens before a tag is erased: says what is on the tag and
  // that the same tag has to be held to the phone. Cancel has the focus, so a
  // stray tap can't wipe a tag.
  let { name = '', details = '', swatch = '', onerase = () => {}, oncancel = () => {} } = $props();
  let cancelBtn = $state();
  $effect(() => { cancelBtn?.focus(); });
</script>

<!-- Tapping the dim area outside the sheet (or Escape) is the same as Cancel -->
<svelte:window onkeydown={(e) => e.key === 'Escape' && oncancel()} />
<div class="scrim" role="presentation" onclick={(e) => e.target === e.currentTarget && oncancel()}>
  <div class="sheet" role="dialog" aria-modal="true" aria-labelledby="erase-title">
    <p class="kicker">Erase a tag</p>
    <div class="who">
      {#if swatch}<span class="dot" style:background={swatch} aria-hidden="true"></span>{/if}
      <div>
        <h2 id="erase-title">{name}</h2>
        {#if details}<p class="muted">{details}</p>{/if}
      </div>
    </div>
    <p class="muted">Everything on this tag is removed so it can be written again. Hold the same tag to your phone.</p>
    <div class="actions">
      <button bind:this={cancelBtn} type="button" class="btn" onclick={oncancel}>Cancel</button>
      <button type="button" class="btn danger" onclick={onerase}>Erase tag</button>
    </div>
  </div>
</div>

<style>
  .scrim {
    position: fixed;
    inset: 0;
    z-index: 20;
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
    color: var(--danger);
  }
  .who { display: flex; align-items: center; gap: var(--s3); }
  .dot { flex: none; width: 38px; height: 38px; border-radius: 50%; border: 1px solid var(--line); }
  h2 { font-size: 1.25rem; overflow-wrap: anywhere; }
  .muted { color: var(--muted); font-size: 0.875rem; }
  .actions { display: flex; gap: var(--s2); }
  .actions .btn { flex: 1; }
  .actions .danger { border-color: var(--danger); }
</style>
