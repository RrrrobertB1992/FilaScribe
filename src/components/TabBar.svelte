<script>
  // The three screens, as a bar along the bottom where a thumb reaches.
  // The write buttons sit just above it (see --tabbar-h in app.css).
  let { mode, onswitch } = $props();
  const tabs = [
    { id: 'tag', label: 'Tag' },
    { id: 'filaments', label: 'Filaments' },
    { id: 'settings', label: 'Settings' },
  ];
</script>

<nav class="tabbar" aria-label="Screens">
  <div class="inner" role="tablist">
    {#each tabs as t (t.id)}
      <button type="button" role="tab" aria-selected={mode === t.id} onclick={() => onswitch(t.id)}>
        <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          {#if t.id === 'tag'}
            <path d="M6 8.32a7.43 7.43 0 0 1 0 7.36" /><path d="M9.46 6.21a11.76 11.76 0 0 1 0 11.58" /><path d="M12.91 4.1a15.91 15.91 0 0 1 .01 15.8" /><path d="M16.37 2a20.16 20.16 0 0 1 0 20" />
          {:else if t.id === 'filaments'}
            <circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="3" />
          {:else}
            <path d="M21 4h-7M10 4H3M21 12h-9M8 12H3M21 20h-5M12 20H3M14 2v4M8 10v4M16 18v4" />
          {/if}
        </svg>
        <span>{t.label}</span>
      </button>
    {/each}
  </div>
</nav>

<style>
  .tabbar {
    position: fixed;
    left: 0;
    right: 0;
    bottom: 0;
    z-index: 10;
    height: var(--tabbar-h);
    padding-bottom: env(safe-area-inset-bottom);
    background: var(--bg);
    border-top: 1px solid var(--line);
  }
  .inner { display: flex; max-width: 560px; height: 60px; margin: 0 auto; }
  button {
    flex: 1;
    display: grid;
    place-items: center;
    align-content: center;
    gap: 2px;
    border: 0;
    background: transparent;
    font-family: var(--font-label);
    font-weight: 600;
    font-size: 0.75rem;
    color: var(--muted);
  }
  button[aria-selected='true'] { color: var(--action); }
</style>
