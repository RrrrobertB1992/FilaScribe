<script>
  // The one look for "nothing here": a short title and a line on what fills the
  // place (full), or just a line with an optional button (compact, for search
  // misses and small lists). Words follow the same rule everywhere: say what is
  // missing and how it gets filled.
  let { title = '', compact = false, children, action } = $props();
</script>

<div class="empty-state" class:compact>
  {#if !compact}
    <span class="mark" aria-hidden="true">
      <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3 3 8l9 5 9-5-9-5z" /><path d="m3 13 9 5 9-5" /></svg>
    </span>
    {#if title}<h3>{title}</h3>{/if}
  {/if}
  <p class="body">{@render children?.()}</p>
  {#if action}<div class="act">{@render action()}</div>{/if}
</div>

<style>
  .empty-state {
    display: grid;
    justify-items: center;
    gap: var(--s2);
    padding: var(--s5) var(--s4);
    border: 1px solid var(--line);
    border-radius: var(--r-card);
    background: var(--surface);
    text-align: center;
  }
  .mark {
    display: grid;
    place-items: center;
    width: 44px;
    height: 44px;
    border-radius: 50%;
    background: var(--chip);
    color: var(--action);
  }
  h3 { margin: 0; font-family: var(--font-label); font-weight: 700; font-size: 1.0625rem; }
  .body { margin: 0; max-width: 40ch; color: var(--muted); font-size: 0.9375rem; }
  .act { margin-top: var(--s2); }
  .act :global(.btn) { min-height: var(--h-control); }
  .compact {
    grid-auto-flow: column;
    grid-template-columns: 1fr auto;
    justify-items: stretch;
    align-items: center;
    gap: var(--s3);
    padding: var(--s3);
    background: var(--bg);
    text-align: left;
  }
  .compact .body { max-width: none; font-size: 0.875rem; }
  .compact .act { margin: 0; }
  .compact .act :global(.btn) { min-height: var(--h-small); }
  .compact:not(:has(.act)) { grid-template-columns: 1fr; }
</style>
