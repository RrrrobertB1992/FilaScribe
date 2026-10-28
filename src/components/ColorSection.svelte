<script>
  // The colors part of the form: a summary of the current colors, then three
  // sources to pick from, one at a time:
  //   Brand  – the brand's colors from the Open Filament Database (default)
  //   Saved  – colors saved for this brand + material (off when there are none)
  //   Custom – the color pickers, with Save
  // All three panels stay mounted (only hidden), so picks, searches and the
  // after-read / after-write matching keep working whichever one is open.
  import { tick } from 'svelte';
  import BrandColors from './BrandColors.svelte';
  import SavedColors from './SavedColors.svelte';
  import ColorEditor from './ColorEditor.svelte';
  import { loadBrandColors } from '../lib/brandColorsData.js';

  let {
    brand = '',
    type = '',
    variant = '',
    canSetVariant = false,
    max = 5,
    colors = $bindable(['FFFFFF']),
    colorType = $bindable('1'),
    getTemps = () => ({}),
    setTemps = () => {},
    setVariant = () => {},
    onstatus = () => {},
    errors = [],
  } = $props();

  let brandList = $state();
  let savedList = $state();

  let brandAvailable = $state(false);
  let brandCount = $state(0);
  let brandName = $state('');
  let brandLine = $state('');
  let savedCount = $state(0);
  let savedName = $state(null);
  let editing = $state(false);

  let tab = $state('brand');
  let userChose = false; // the user picked a tab for this brand + material
  let lastKey = null;
  let lastBrandAvailable = null;

  const tabs = $derived([
    { id: 'brand', label: 'Brand', count: brandAvailable ? brandCount : null, disabled: !brandAvailable },
    { id: 'saved', label: 'Saved', count: savedCount || null, disabled: !savedCount && !editing },
    { id: 'custom', label: 'Custom', count: null, disabled: false },
  ]);
  const preferred = $derived(brandAvailable ? 'brand' : savedCount ? 'saved' : 'custom');

  // A new brand or material (or the brand's colors arriving) opens the first
  // source that has something, unless the user already chose one
  $effect(() => {
    const key = `${brand}|${type}`;
    const keyChanged = key !== lastKey;
    if (keyChanged || brandAvailable !== lastBrandAvailable) {
      if (keyChanged) userChose = false;
      lastKey = key;
      lastBrandAvailable = brandAvailable;
      if (!userChose) tab = preferred;
    }
  });
  // A source that empties out (the last saved color removed) closes
  $effect(() => {
    if (tabs.find((t) => t.id === tab)?.disabled) tab = tabs.find((t) => !t.disabled).id;
  });
  // Editing a saved color's colors happens in Custom
  $effect(() => {
    if (editing) tab = 'custom';
  });

  function choose(id) {
    if (id === tab) return;
    if (editing) savedList?.cancelEdit();
    tab = id;
    userChose = true;
  }

  const style = $derived(colors.length > 1 && colorType === '0' ? 'Gradient' : 'Segments');
  const swatch = $derived.by(() => {
    const list = colors.slice(0, max).map((h) => `#${h}`);
    if (list.length < 2) return list[0] || '#FFFFFF';
    if (style === 'Gradient') return `linear-gradient(135deg, ${list.join(', ')})`;
    const step = 100 / list.length;
    return `linear-gradient(135deg, ${list.map((c, i) => `${c} ${i * step}% ${(i + 1) * step}%`).join(', ')})`;
  });
  const summary = $derived.by(() => {
    if (brandName) return { name: brandName, from: `Brand color · ${brandLine}` };
    if (savedName !== null) return { name: savedName || 'Saved color', from: editing ? 'Saved color · editing' : 'Saved color' };
    return { name: 'Custom colors', from: 'Made with the color picker' };
  });
  const hexes = $derived(colors.slice(0, max).map((h) => `#${h}`).join(' + '));

  function saveCurrent() {
    savedList?.saveCurrent();
    userChose = true;
  }

  function saveEdit() {
    savedList?.saveEdit();
    tab = 'saved';
  }

  function cancelEdit() {
    savedList?.cancelEdit();
    tab = 'saved';
  }

  // --- Called by the app ---

  /** After a successful write: save the colors (named after a picked brand color). */
  export function afterWrite() {
    savedList?.afterWrite(brandName);
  }

  /** After a tag is read: mark what its colors match and open that source. */
  export async function afterLoad() {
    savedList?.afterLoad();
    brandList?.afterLoad();
    await loadBrandColors().catch(() => {});
    await tick();
    await tick();
    tab = brandName ? 'brand' : savedName !== null ? 'saved' : 'custom';
    if (tabs.find((t) => t.id === tab)?.disabled) tab = 'custom';
    userChose = true;
  }
</script>

<div class="colorsec" role="group" aria-labelledby="colorsec-label">
  <div class="current">
    <span class="swatch" style:background={swatch} aria-hidden="true"></span>
    <div class="what">
      <span class="label" id="colorsec-label">{max > 1 ? 'Colors' : 'Color'}</span>
      <span class="now-name">{summary.name}</span>
      <span class="now-from">{summary.from}</span>
      <span class="now-hex">{hexes}{colors.length > 1 && max > 1 ? ` · ${style}` : ''}</span>
    </div>
  </div>

  <div class="tabs" role="group" aria-label="Color source">
    {#each tabs as t (t.id)}
      <button type="button" class="tab" aria-pressed={tab === t.id} disabled={t.disabled} onclick={() => choose(t.id)}>
        <span>{t.label}</span>
        {#if t.count != null}<span class="count">{t.count}</span>{/if}
      </button>
    {/each}
  </div>

  <div class="panel" hidden={tab !== 'brand'}>
    <BrandColors
      bind:this={brandList}
      {brand}
      {type}
      {variant}
      {canSetVariant}
      bind:colors
      bind:colorType
      bind:available={brandAvailable}
      bind:count={brandCount}
      bind:pickedName={brandName}
      bind:pickedLine={brandLine}
      {getTemps}
      {setTemps}
      {setVariant}
      onedit={() => { tab = 'custom'; userChose = true; }}
    />
  </div>

  <div class="panel" hidden={tab !== 'saved'}>
    <SavedColors
      bind:this={savedList}
      {brand}
      {type}
      {variant}
      bind:colors
      bind:colorType
      bind:count={savedCount}
      bind:pickedName={savedName}
      bind:editing
      {onstatus}
    />
  </div>

  <div class="panel" hidden={tab !== 'custom'}>
    <ColorEditor bind:colors bind:colorType {max} showLabel={false} />
    {#if editing}
      <div class="editbar">
        <span>Editing saved color <strong>{savedName || hexes}</strong></span>
        <div class="row">
          <button type="button" class="btn small" onclick={saveEdit}>Save colors</button>
          <button type="button" class="btn small quiet" onclick={cancelEdit}>Cancel</button>
        </div>
      </div>
    {:else}
      <div class="row">
        <button type="button" class="btn small" onclick={saveCurrent} disabled={!brand || !type}>Save colors</button>
        <button type="button" class="btn small quiet" onclick={() => savedList?.openImport()}>Import saved colors</button>
      </div>
      <p class="hint">Saved colors are kept for {[brand, type].filter(Boolean).join(' ') || 'this brand and material'}. Colors are also saved when you write a tag.</p>
    {/if}
  </div>

  {#each errors as e}<p class="error-text">{e.message}</p>{/each}
</div>

<style>
  .colorsec {
    display: grid;
    gap: var(--s3);
    padding: var(--s3);
    border: 1px solid var(--line);
    border-radius: 14px;
    background: var(--surface);
  }
  .current { display: flex; align-items: center; gap: var(--s3); }
  .swatch {
    flex: none;
    width: 64px;
    height: 64px;
    border-radius: 50%;
    box-shadow: inset 0 0 0 1px rgba(0, 0, 0, 0.25), 0 0 0 4px var(--bg);
    position: relative;
  }
  .swatch::after {
    content: '';
    position: absolute;
    inset: 24px;
    border-radius: 50%;
    background: var(--surface);
    box-shadow: inset 0 0 0 1px rgba(0, 0, 0, 0.25);
  }
  .what { display: grid; gap: 1px; min-width: 0; }
  .what .label { margin: 0; }
  .now-name { font-family: var(--font-label); font-weight: 700; font-size: 1.25rem; line-height: 1.15; overflow-wrap: anywhere; }
  .now-from { font-size: 0.8125rem; color: var(--muted); }
  .now-hex { font-family: var(--font-label); font-size: 0.875rem; letter-spacing: 0.04em; color: var(--muted); overflow-wrap: anywhere; }

  .tabs {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 4px;
    padding: 4px;
    border-radius: 999px;
    background: var(--chip);
  }
  .tab {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    min-height: 40px;
    padding: 0 var(--s2);
    border: 0;
    border-radius: 999px;
    background: transparent;
    font-family: var(--font-label);
    font-weight: 500;
    font-size: 1rem;
    color: var(--ink);
  }
  .tab[aria-pressed='true'] { background: var(--ink); color: var(--bg); font-weight: 600; }
  .tab:disabled { opacity: 0.4; cursor: not-allowed; }
  .count {
    min-width: 1.6em;
    padding: 0 6px;
    border-radius: 999px;
    background: var(--bg);
    color: var(--muted);
    font-size: 0.8125rem;
    font-weight: 600;
    line-height: 1.5;
  }
  .tab[aria-pressed='true'] .count { background: var(--muted); color: var(--bg); }

  .panel { display: grid; gap: var(--s3); }
  .panel[hidden] { display: none; }
  .row { display: flex; flex-wrap: wrap; align-items: center; gap: var(--s2); }
  .panel > .hint { margin: 0; }
  .editbar {
    display: grid;
    gap: var(--s2);
    padding: var(--s3);
    border-radius: 10px;
    background: var(--bg);
    border-left: 4px solid var(--action);
  }
  .error-text { margin: 0; }
</style>
