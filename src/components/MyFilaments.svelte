<script>
  // The "My filaments" card on Create: your saved spools. Tap one to fill the
  // form; search narrows the list; the list scrolls inside the card.
  import Fold from './Fold.svelte';
  import * as Filaments from '../lib/filaments.js';

  let { list = [], current = '', onuse = () => {}, onremove = () => {} } = $props();

  let query = $state('');
  const shown = $derived(Filaments.search(list, query));

  const summary = $derived(list.length ? `${list.length} saved` : 'None yet');

  // The swatch: one color, or the colors side by side (a gradient blends)
  function swatch(e) {
    const c = e.colors.map((h) => `#${h}`);
    if (c.length === 1) return c[0];
    if (e.colorType === '0') return `linear-gradient(to right, ${c.join(', ')})`;
    const step = 100 / c.length;
    return `linear-gradient(to right, ${c.map((x, i) => `${x} ${i * step}% ${(i + 1) * step}%`).join(', ')})`;
  }

  function remove(e) {
    if (!confirm(`Remove ${Filaments.title(e)} · ${Filaments.colorLabel(e)} from My filaments?`)) return;
    onremove(e);
  }
</script>

<Fold id="filaments" title="My filaments" {summary} cls="filaments">
  {#if list.length}
    {#if list.length > 1}
      <input
        type="search"
        class="find"
        placeholder="Search your filaments"
        aria-label="Search your filaments"
        bind:value={query}
        autocomplete="off"
        autocapitalize="off"
        spellcheck="false"
      />
    {/if}
    {#if shown.length}
      <ul class="rows" aria-label="Saved filaments">
        {#each shown as e (Filaments.keyOf(e))}
          <li class:on={Filaments.keyOf(e) === current}>
            <button type="button" class="use" onclick={() => onuse(e)} aria-label={`Use ${Filaments.title(e)}, ${Filaments.colorLabel(e)}`}>
              <span class="dot" style:background={swatch(e)} aria-hidden="true"></span>
              <span class="text">
                <span class="name">{Filaments.title(e)} · {Filaments.colorLabel(e)}</span>
                <span class="meta">{Filaments.meta(e)}</span>
              </span>
            </button>
            <button type="button" class="x" aria-label={`Remove ${Filaments.title(e)}, ${Filaments.colorLabel(e)}`} onclick={() => remove(e)}>×</button>
          </li>
        {/each}
      </ul>
    {:else}
      <p class="hint">No filament matches “{query}”.</p>
    {/if}
    <p class="hint">Tap one to fill the form. Brand, material, variant, colors and temperatures are used.</p>
  {:else}
    <p class="hint">Fill in the form, then tap “Save this spool as a filament” at the bottom. Writing a tag can offer to save it too.</p>
  {/if}
</Fold>

<style>
  .find {
    width: 100%;
    min-height: 44px;
    padding: 0 var(--s3);
    border: 1px solid var(--line);
    border-radius: 10px;
    background: var(--bg);
    color: var(--ink);
    font: inherit;
  }
  .rows {
    list-style: none;
    margin: 0;
    padding: 0;
    border: 1px solid var(--line);
    border-radius: 12px;
    background: var(--bg);
    /* About five rows, then it scrolls inside the card */
    max-height: 21rem;
    overflow-y: auto;
    overscroll-behavior: contain;
  }
  li {
    display: flex;
    align-items: stretch;
    border-top: 1px solid var(--line);
  }
  li:first-child { border-top: 0; }
  li.on { background: color-mix(in srgb, var(--action) 14%, var(--bg)); }
  .use {
    flex: 1;
    min-width: 0;
    display: flex;
    align-items: center;
    gap: var(--s3);
    padding: var(--s2) var(--s2) var(--s2) var(--s3);
    min-height: 56px;
    border: 0;
    background: none;
    color: inherit;
    font: inherit;
    text-align: left;
    cursor: pointer;
  }
  .dot {
    flex: none;
    width: 38px;
    height: 38px;
    border-radius: 50%;
    border: 1px solid var(--line);
  }
  .text { display: grid; min-width: 0; }
  .name {
    font-family: var(--font-label);
    font-weight: 700;
    font-size: 1.0625rem;
    line-height: 1.15;
    overflow-wrap: anywhere;
  }
  .meta { color: var(--muted); font-size: 0.8125rem; }
  .x {
    flex: none;
    width: 48px;
    border: 0;
    background: none;
    color: var(--muted);
    font-size: 1.375rem;
    cursor: pointer;
  }
  .x:hover { color: var(--danger); }
  .hint { margin: 0; }
</style>
