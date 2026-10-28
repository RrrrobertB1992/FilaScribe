<script>
  // Shown while waiting for a tag.
  let { mode = 'read', wrongUid = '', oncancel = () => {} } = $props();
  let cancelBtn = $state();
  $effect(() => { cancelBtn?.focus(); });
</script>

<div class="scrim">
  <div class="sheet" role="dialog" aria-modal="true" aria-labelledby="sheet-title" aria-describedby="sheet-text">
    <div class="pulse" aria-hidden="true"><span></span></div>
    <h2 id="sheet-title">{mode === 'write' ? 'Ready to write' : 'Ready to read'}</h2>
    <p id="sheet-text">
      Hold the tag flat against the back of your phone and keep it there until this closes.
    </p>
    {#if wrongUid}
      <p class="warn" role="alert">That’s a different tag ({wrongUid}). Use the tag you read, or cancel and read this one first.</p>
    {/if}
    <button bind:this={cancelBtn} type="button" class="btn" onclick={oncancel}>Cancel</button>
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
    justify-items: center;
    gap: var(--s3);
    max-width: 560px;
    width: 100%;
    margin: 0 auto;
    padding: var(--s6) var(--s5) calc(var(--s5) + env(safe-area-inset-bottom));
    border-radius: 16px 16px 0 0;
    background: var(--surface);
    text-align: center;
  }
  .sheet p { margin: 0; max-width: 34ch; }
  .sheet .btn { min-width: 12em; margin-top: var(--s2); }
  h2 { font-size: 1.75rem; }
  .warn { color: var(--danger); }
  .pulse {
    position: relative;
    width: 88px;
    height: 88px;
    display: grid;
    place-items: center;
  }
  .pulse::before,
  .pulse span {
    content: '';
    position: absolute;
    inset: 0;
    border-radius: 50%;
    border: 4px solid var(--brass);
  }
  .pulse span { animation: ring 1.6s ease-out infinite; }
  .pulse::after {
    content: '';
    width: 30px;
    height: 30px;
    border-radius: 50%;
    background: var(--brass);
  }
  @keyframes ring {
    from { transform: scale(1); opacity: 0.9; }
    to { transform: scale(1.6); opacity: 0; }
  }
</style>
