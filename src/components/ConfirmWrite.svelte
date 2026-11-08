<script>
  // The sheet that opens when you tap a filament on the Filaments tab: shows
  // what will be written, then Write tag (which opens the hold-the-tag sheet)
  // or Cancel. It stops a stray tap from writing a tag.
  let { name = '', details = '', defaults = '', swatch = '', onwrite = () => {}, oncancel = () => {} } = $props();
  let writeBtn = $state();
  $effect(() => { writeBtn?.focus(); });
</script>

<div class="scrim">
  <div class="sheet" role="dialog" aria-modal="true" aria-labelledby="confirm-title">
    <p class="kicker">Write a tag</p>
    <div class="who">
      <span class="dot" style:background={swatch} aria-hidden="true"></span>
      <div>
        <h2 id="confirm-title">{name}</h2>
        {#if details}<p class="muted">{details}</p>{/if}
      </div>
    </div>
    <p class="muted">{defaults}</p>
    <div class="actions">
      <button type="button" class="btn" onclick={oncancel}>Cancel</button>
      <button bind:this={writeBtn} type="button" class="btn primary wide" onclick={onwrite}>Write tag</button>
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
    color: var(--action);
  }
  .who { display: flex; align-items: center; gap: var(--s3); }
  .dot { flex: none; width: 38px; height: 38px; border-radius: 50%; border: 1px solid var(--line); }
  h2 { font-size: 1.25rem; overflow-wrap: anywhere; }
  .muted { color: var(--muted); font-size: 0.875rem; }
  .actions { display: flex; gap: var(--s2); }
  .wide { flex: 2; }
</style>
