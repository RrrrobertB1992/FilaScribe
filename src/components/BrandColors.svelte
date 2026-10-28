<script>
  // Brand colors: the brand's named colors for the picked material, narrowed
  // by the variant (see lib/brandColors.js). Works like Saved colors but
  // read-only: pick a color to fill the colors (and the line's temperatures);
  // the pickers hide while it's picked; tap it again to put back what was
  // there. "Edit colors" copies it into the pickers to adjust.
  import { onMount } from 'svelte';
  import * as BC from '../lib/brandColors.js';
  import { loadBrandColors } from '../lib/brandColorsData.js';

  let {
    brand = '',
    type = '',
    variant = '', // '' when the form has no variant (standard fields)
    canSetVariant = false,
    colors = $bindable(['FFFFFF']),
    colorType = $bindable('1'),
    pickersHidden = $bindable(false),
    pickedName = $bindable(''), // name of the picked color, for Saved colors
    getTemps = () => ({}),
    setTemps = () => {},
    setVariant = () => {},
    onpick = () => {}, // a brand color was picked (Saved colors lets go of its pick)
    onchange = () => {},
  } = $props();

  const PAGE = 30;
  let db = $state(null);
  let expanded = $state(false);
  let showAll = $state(false);
  let lineFilter = $state(''); // Show all: a line name, or '' for every line
  let search = $state('');
  let shown = $state(PAGE);
  let picked = $state(null); // { id, lineName }
  let snapshot = null; // form values before a brand color was picked
  let currentKey = null;

  let matchWhenLoaded = false; // a tag was loaded before the data arrived

  onMount(async () => {
    db = await loadBrandColors();
    if (matchWhenLoaded) {
      matchWhenLoaded = false;
      selectMatching();
    }
  });

  const key = $derived(`${brand}|${type}|${variant}`);
  const result = $derived(db ? BC.linesFor(db, { brand, type, variant, showAll }) : { lines: [], filter: 'all', total: 0 });
  const allLines = $derived(db ? BC.linesForMaterial(db, brand, type) : []);
  const visibleLines = $derived(showAll && lineFilter ? result.lines.filter((l) => l.name === lineFilter) : result.lines);
  // Grouped view: look-alikes from different lines merged; Show all: every color
  const allTiles = $derived(BC.tilesFor(visibleLines, { merge: !showAll }));
  const tiles = $derived.by(() => {
    const q = search.trim().toLowerCase();
    if (!q) return allTiles;
    return allTiles.filter((t) => t.entry[0].toLowerCase().includes(q) || t.line.name.toLowerCase().includes(q));
  });
  const colorCount = $derived(BC.tilesFor(result.lines, { merge: !showAll }).length);
  // The chip's own wording ("Metal") when there is one
  const groupName = $derived(variant || result.group || 'Basic');
  const label = $derived([BC.findBrand(db, brand)?.name ? brand : '', type].filter(Boolean).join(' '));
  const pickedTile = $derived(picked ? findTile(picked.id) : null);
  // Offer the picked line's group as the variant (not "Basic" when there's no variant)
  const suggestion = $derived.by(() => {
    if (!canSetVariant || !pickedTile) return '';
    const g = BC.suggestedVariant(pickedTile.line, db, brand, type);
    return g === variant || (g === 'Basic' && !variant) ? '' : g;
  });

  function findTile(id) {
    for (const line of allLines) {
      for (const entry of line.colors) {
        if (BC.colorId(line, entry) === id) return { line, entry, id, info: BC.colorInfo(entry) };
      }
    }
    return null;
  }

  // A new brand, material or variant starts fresh (a pick stays if it still exists)
  $effect(() => {
    if (key !== currentKey) {
      const brandType = currentKey ? currentKey.split('|').slice(0, 2).join('|') : null;
      currentKey = key;
      shown = PAGE;
      lineFilter = '';
      search = '';
      if (brandType !== `${brand}|${type}`) {
        showAll = false;
        picked = null;
        snapshot = null;
      }
    }
  });
  $effect(() => {
    pickersHidden = !!pickedTile;
    pickedName = pickedTile ? pickedTile.info.name : '';
  });

  function apply(tile) {
    colors = [...tile.info.colors];
    if (tile.info.colors.length > 1) colorType = tile.info.gradient ? '0' : '1';
    const [minT, maxT, bedMin, bedMax] = tile.line.temps;
    const temps = {};
    if (minT != null) temps.minTemp = String(minT);
    if (maxT != null) temps.maxTemp = String(maxT);
    if (bedMin != null) temps.bedMinTemp = String(bedMin);
    if (bedMax != null) temps.bedMaxTemp = String(bedMax);
    setTemps(temps);
    onchange();
  }

  function pick(tile) {
    // Keep the first snapshot when switching between brand colors
    if (!picked) snapshot = { colors: [...colors], colorType, temps: { ...getTemps() } };
    picked = { id: tile.id, lineName: tile.line.name };
    apply(tile);
    onpick();
  }

  function unpick() {
    picked = null;
    if (snapshot) {
      colors = snapshot.colors;
      colorType = snapshot.colorType;
      setTemps(snapshot.temps);
      snapshot = null;
      onchange();
    }
  }

  /** Keep the colors but let go of the pick, so they can be changed. */
  function editColors() {
    picked = null;
    snapshot = null;
  }

  // --- Called by the app ---

  /** Let go of the pick without changing anything (Saved colors picked). */
  export function release() {
    picked = null;
    snapshot = null;
  }

  /** After a tag is loaded: mark the brand color it matches, if any. */
  export function afterLoad() {
    picked = null;
    snapshot = null;
    queueMicrotask(() => {
      if (db) selectMatching();
      else matchWhenLoaded = true;
    });
  }

  function selectMatching() {
    const hit = BC.findColor(db, { brand, type, variant }, colors);
    if (!hit) return;
    // Show its line even if the variant would hide it
    if (!BC.linesFor(db, { brand, type, variant }).lines.includes(hit.line)) showAll = true;
    snapshot = { colors: [...colors], colorType, temps: { ...getTemps() } };
    picked = { id: BC.colorId(hit.line, hit.entry), lineName: hit.line.name };
  }

  function bar(info) {
    const list = info.colors.map((h) => `#${h}`);
    if (list.length > 1 && info.gradient) return `linear-gradient(to right, ${list.join(', ')})`;
    return null;
  }

  function filterNote() {
    const lines = `${result.lines.length} ${result.lines.length === 1 ? 'line' : 'lines'}`;
    if (result.filter === 'group') return `${groupName}: ${colorCount} colors from ${lines}`;
    if (result.filter === 'basic') return `Basic (no variant): ${colorCount} colors from ${lines}`;
    if (result.filter === 'name') return `lines named “${variant}”: ${colorCount} colors from ${lines}`;
    return `every line (${result.total}), nothing merged`;
  }
</script>

{#if db && result.total > 0}
  <div class="brand">
    <div class="head">
      <span class="label">Brand colors for {label}{variant ? ` ${variant}` : ''} ({colorCount})</span>
      {#if pickedTile && !expanded}
        <span class="bar picked" style:background={bar(pickedTile.info)} aria-hidden="true">
          {#if !bar(pickedTile.info)}{#each pickedTile.info.colors as h}<span style:background={`#${h}`}></span>{/each}{/if}
        </span>
      {/if}
      <button type="button" class="btn small quiet" aria-expanded={expanded} onclick={() => (expanded = !expanded)}>
        {expanded ? 'Hide' : 'Show'}
      </button>
    </div>

    {#if pickedTile}
      <p class="picked-name">{pickedTile.info.name} <span class="hint">{pickedTile.line.name}</span></p>
    {/if}

    {#if expanded}
      {#if result.filter === 'nomatch'}
        <p class="hint">{label} has no {groupName} colors.</p>
      {:else}
        <p class="hint">Showing {filterNote()}.</p>
      {/if}
      <div class="filters">
        {#if result.filter !== 'all' || showAll}
          <button type="button" class="btn small" onclick={() => { showAll = !showAll; lineFilter = ''; shown = PAGE; }}>
            {showAll ? `Show only ${groupName}` : `Show all ${label} lines`}
          </button>
        {/if}
      </div>

      {#if showAll && result.lines.length > 1}
        <div class="lines" role="group" aria-label="Filament lines">
          <button type="button" class="line" aria-pressed={!lineFilter} onclick={() => { lineFilter = ''; shown = PAGE; }}>All</button>
          {#each result.lines as line (line.name)}
            <button type="button" class="line" aria-pressed={lineFilter === line.name} onclick={() => { lineFilter = line.name; shown = PAGE; }}>
              {line.name}
            </button>
          {/each}
        </div>
      {/if}

      {#if result.lines.length}
        <input type="text" class="search" bind:value={search} placeholder="Search colors" aria-label="Search brand colors" oninput={() => (shown = PAGE)} />
        <div class="grid">
          {#each tiles.slice(0, shown) as tile (tile.id)}
            {@const isPicked = picked?.id === tile.id}
            <button
              type="button"
              class="tile"
              aria-pressed={isPicked}
              title={`${tile.info.name}, ${[tile.line.name, ...tile.alsoIn].join(' / ')}: ${tile.info.colors.map((h) => '#' + h).join(' + ')}`}
              onclick={() => (isPicked ? unpick() : pick(tile))}
            >
              <span class="bar" style:background={bar(tile.info)} aria-hidden="true">
                {#if !bar(tile.info)}{#each tile.info.colors as h}<span style:background={`#${h}`}></span>{/each}{/if}
              </span>
              <span class="name">{tile.info.name}</span>
              <span class="hex">{tile.info.colors.join('\n')}</span>
              {#if tile.info.colors.length > 1}<span class="multi">{tile.info.colors.length} colors{tile.info.gradient ? ', gradient' : ''}</span>{/if}
              {#if !lineFilter && result.lines.length > 1}
                <span class="line-name">{tile.line.name}{tile.alsoIn.length ? ` +${tile.alsoIn.length}` : ''}</span>
              {/if}
            </button>
          {/each}
        </div>
        {#if !tiles.length}<p class="hint">No colors match “{search}”.</p>{/if}
        {#if tiles.length > shown}
          {@const left = tiles.length - shown}
          <button type="button" class="btn small quiet" onclick={() => (shown += PAGE)}>Show {Math.min(PAGE, left)} more ({left} left)</button>
        {/if}
      {/if}
    {/if}

    {#if pickedTile}
      <div class="actions">
        <button type="button" class="btn small" onclick={editColors}>Edit colors</button>
        {#if suggestion && suggestion !== variant}
          <button type="button" class="btn small" onclick={() => setVariant(suggestion)}>Set variant to {suggestion}</button>
        {/if}
      </div>
    {/if}

    {#if expanded}
      <p class="credit">
        Colors from the <a href="https://openfilamentdatabase.org/" target="_blank" rel="noopener">Open Filament Database</a>
        ({db.source?.date || 'snapshot'}). Shades are approximate.
      </p>
    {/if}
  </div>
{/if}

<style>
  .brand { display: grid; gap: var(--s2); }
  .head { display: flex; align-items: center; gap: var(--s2); }
  .head .label { flex: 1; }
  .picked-name { margin: 0; font-family: var(--font-label); font-weight: 600; }
  .picked-name .hint { font-family: var(--font-body); font-weight: 400; margin-left: var(--s1); }
  .filters, .actions { display: flex; flex-wrap: wrap; gap: var(--s2); }
  .lines { display: flex; flex-wrap: wrap; gap: var(--s1); }
  .line {
    min-height: 34px;
    padding: 0 var(--s3);
    border-radius: 999px;
    border: 1px solid var(--line);
    background: transparent;
    font-family: var(--font-label);
    font-size: 0.9375rem;
  }
  .line[aria-pressed='true'] { background: var(--ink); color: var(--bg); border-color: var(--ink); }
  .search { min-height: 40px; }
  .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(96px, 1fr)); gap: var(--s2); }
  .tile {
    display: grid;
    gap: 3px;
    align-content: start;
    padding: var(--s2);
    border-radius: 8px;
    border: 2px solid transparent;
    background: var(--surface);
    text-align: center;
  }
  .tile[aria-pressed='true'] { border-color: var(--ink); }
  .bar {
    display: flex;
    height: 22px;
    border-radius: 4px;
    overflow: hidden;
    box-shadow: inset 0 0 0 1px rgba(0, 0, 0, 0.2);
  }
  .bar span { flex: 1; }
  .bar.picked { width: 44px; height: 18px; flex: none; }
  .name { font-size: 0.8125rem; font-weight: 700; line-height: 1.2; overflow-wrap: anywhere; }
  .hex { font-family: var(--font-label); font-size: 0.8125rem; white-space: pre-line; line-height: 1.2; letter-spacing: 0.04em; color: var(--muted); }
  .line-name { font-size: 0.6875rem; color: var(--muted); line-height: 1.2; }
  .multi { font-size: 0.6875rem; font-weight: 700; color: var(--action); line-height: 1.2; }
  .credit { margin: 0; font-size: 0.75rem; color: var(--muted); }
  .credit a { color: inherit; }
</style>
