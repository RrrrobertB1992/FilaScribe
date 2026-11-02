<script>
  // Brand colors (the "Brand" panel of the color section): the brand's named
  // colors for the picked material, narrowed by the variant (see
  // lib/brandColors.js). Works like Saved colors but read-only: pick a color
  // to fill the colors (and the line's temperatures); tap it again to put
  // back what was there. "Edit colors" keeps them and opens the pickers.
  import { onMount } from 'svelte';
  import * as BC from '../lib/brandColors.js';
  import { loadBrandColors } from '../lib/brandColorsData.js';
  import ColorPopup from './ColorPopup.svelte';
  import { normalizeHex } from '../lib/formats/openspool.js';
  import * as Manual from '../lib/manualColors.js';
  import { getEdits, setEdit, removeEdit, withManual } from '../lib/manualColorsStore.svelte.js';

  let {
    brand = '',
    type = '',
    variant = '', // '' when the form has no variant (standard fields)
    canSetVariant = false,
    colors = $bindable(['FFFFFF']),
    colorType = $bindable('1'),
    count = $bindable(0), // colors shown for this brand + material + variant
    available = $bindable(false), // the brand has colors for this material
    pickedName = $bindable(''), // name of the picked color, for Saved colors
    pickedLine = $bindable(''), // its filament line
    pickedOriginal = $bindable(''), // the database's hex for it, when you overrode it ('' when not)
    getTemps = () => ({}),
    setTemps = () => {},
    setVariant = () => {},
    onpick = () => {}, // a brand color was picked (Saved colors lets go of its pick)
    onchange = () => {},
    onedit = () => {}, // Edit colors: the app opens the pickers
  } = $props();

  const PAGE = 30;
  // The database with your overrides on top (Settings lists them)
  let rawDb = $state(null);
  const db = $derived(rawDb && withManual(rawDb));
  let showAll = $state(false);
  let lineFilter = $state(''); // Show all: a line name, or '' for every line
  let search = $state('');
  let shown = $state(PAGE);
  let picked = $state(null); // { id, lineName }
  let snapshot = null; // form values before a brand color was picked
  let currentKey = null;

  let matchWhenLoaded = false; // a tag was loaded before the data arrived

  onMount(async () => {
    rawDb = await loadBrandColors();
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
  // The override box belongs to the picked color
  $effect(() => {
    if (!pickedTile) { editor = null; popup = null; }
  });
  $effect(() => {
    available = !!db && result.total > 0;
    count = colorCount;
    pickedName = pickedTile ? pickedTile.info.name : '';
    pickedLine = pickedTile ? pickedTile.line.name : '';
    pickedOriginal = pickedTile?.info.original ? pickedTile.info.original.map((h) => `#${h}`).join(' + ') : '';
  });
  // The colors were changed elsewhere (Saved colors, the pickers): let go of the pick
  $effect(() => {
    if (!pickedTile) return;
    const now = colors.map((c) => c.toUpperCase()).join(',');
    if (now !== pickedTile.info.colors.map((c) => c.toUpperCase()).join(',')) {
      picked = null;
      snapshot = null;
    }
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
    onedit();
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

  // --- Overriding a color's hex ---

  let popup = $state(null); // index of the color being picked in the pop-up, or null
  let editor = $state(null); // { hexes: ['212121'], all: false, error: '' } while the override box is open
  // The override on the picked color (its line's own, or the all-lines one)
  const pickedEdit = $derived.by(() => {
    if (!pickedTile || !db) return null;
    return Manual.find(getEdits(), { brand: dbBrandName, material: materialOf(pickedTile.line), line: pickedTile.line.name, color: pickedTile.info.name });
  });
  const dbBrandName = $derived(BC.findBrand(db, brand)?.name || '');

  function materialOf(line) {
    const b = BC.findBrand(db, brand);
    return Object.entries(b?.materials || {}).find(([, lines]) => lines.includes(line))?.[0] || '';
  }

  // The tile for a color name in a line, after the database changed under it
  function tileNamed(lineName, colorName) {
    for (const line of linesAll()) {
      if (line.name !== lineName) continue;
      const entry = line.colors.find((c) => c[0] === colorName);
      if (entry) return { line, entry, id: BC.colorId(line, entry), info: BC.colorInfo(entry) };
    }
    return null;
  }
  const linesAll = () => (db ? BC.linesForMaterial(db, brand, type) : []);

  // Keep the pick, with the colors the override gave it
  function repick(lineName, colorName) {
    const tile = tileNamed(lineName, colorName);
    if (!tile) return;
    picked = { id: tile.id, lineName };
    apply(tile);
  }

  function openEditor() {
    if (!pickedTile) return;
    editor = { hexes: [...pickedTile.info.colors], all: pickedEdit?.line === Manual.ALL_LINES, error: '' };
  }

  function saveEditor() {
    const tile = pickedTile;
    if (!tile || !editor) return;
    const hexes = editor.hexes.map((h) => normalizeHex(h));
    if (hexes.some((h) => !h)) {
      editor.error = 'Each color needs 6 hex digits, like 212121.';
      return;
    }
    const { name } = tile.info;
    setEdit({
      brand: dbBrandName,
      material: materialOf(tile.line),
      line: editor.all ? Manual.ALL_LINES : tile.line.name,
      color: name,
      hex: hexes.join(','),
      was: (tile.info.original || tile.info.colors).join(','),
    });
    editor = null;
    repick(tile.line.name, name);
  }

  function resetEditor() {
    const tile = pickedTile;
    const edit = pickedEdit;
    if (!tile || !edit) return;
    const orig = (tile.info.original || tile.info.colors).map((h) => `#${h}`).join(' + ');
    const where = edit.line === Manual.ALL_LINES ? ` in every ${label} line` : '';
    if (!confirm(`Put ${tile.info.name}${where} back to the database color ${orig}?`)) return;
    const name = tile.info.name;
    removeEdit(edit);
    editor = null;
    repick(tile.line.name, name);
  }

  function setHex(i, value) {
    editor.hexes[i] = value.replace(/[^0-9a-fA-F#]/g, '').replace('#', '').slice(0, 6).toUpperCase();
    editor.error = '';
  }

  const previewHex = (h) => (normalizeHex(h) ? `#${normalizeHex(h)}` : 'transparent');

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
    {#if result.filter === 'nomatch'}
      <p class="hint">{label} has no {groupName} colors.</p>
    {:else}
      <p class="hint">Showing {filterNote()}.</p>
    {/if}

    {#if result.filter !== 'all' || showAll || pickedTile}
      <div class="filters">
        {#if result.filter !== 'all' || showAll}
          <button type="button" class="btn small" onclick={() => { showAll = !showAll; lineFilter = ''; shown = PAGE; }}>
            {showAll ? `Show only ${groupName}` : `Show all ${label} lines`}
          </button>
        {/if}
        {#if pickedTile}
          <button type="button" class="btn small" aria-expanded={!!editor} onclick={() => (editor ? (editor = null) : openEditor())}>
            {pickedEdit ? 'Edit override' : 'Override'}
          </button>
          <button type="button" class="btn small" onclick={editColors}>Edit colors</button>
        {/if}
      </div>
    {/if}

    {#if editor && pickedTile}
      <div class="override" role="group" aria-label="Override this color">
        <p class="what">
          <strong>{pickedTile.info.name}</strong>, {pickedTile.line.name}
          <span class="db">Database: {(pickedTile.info.original || pickedTile.info.colors).map((h) => `#${h}`).join(' + ')}</span>
        </p>
        {#each editor.hexes as h, i}
          <div class="hexrow">
            <span class="chip" style:background={previewHex(h)} aria-hidden="true"></span>
            <label>
              {editor.hexes.length > 1 ? `Color ${i + 1}` : 'Hex'}
              <span class="hexbox">#<input type="text" value={h} maxlength="7" autocapitalize="characters" spellcheck="false" aria-label={editor.hexes.length > 1 ? `Color ${i + 1} hex` : 'Override hex'} oninput={(e) => setHex(i, e.currentTarget.value)} /></span>
            </label>
            <button type="button" class="btn small" aria-label={editor.hexes.length > 1 ? `Pick color ${i + 1}` : 'Pick a color'} onclick={() => (popup = i)}>Pick</button>
          </div>
        {/each}
        {#if result.lines.length > 1 || allLines.length > 1}
          <label class="all">
            <input type="checkbox" bind:checked={editor.all} />
            <span>Also change “{pickedTile.info.name}” in the other {label} lines</span>
          </label>
        {/if}
        {#if editor.error}<p class="error-text">{editor.error}</p>{/if}
        <div class="actions">
          <button type="button" class="btn small primary" onclick={saveEditor}>Save override</button>
          <button type="button" class="btn small quiet" onclick={() => (editor = null)}>Cancel</button>
          {#if pickedEdit}<button type="button" class="btn small quiet danger" onclick={resetEditor}>Reset to database</button>{/if}
        </div>
      </div>
    {/if}

    {#if popup !== null && editor}
      <ColorPopup
        hex={editor.hexes[popup]}
        label={editor.hexes.length > 1 ? `Color ${popup + 1}` : 'Override color'}
        onuse={(h) => { setHex(popup, h); popup = null; }}
        oncancel={() => (popup = null)}
      />
    {/if}

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
      <input type="search" class="search" bind:value={search} placeholder="Search colors" aria-label="Search brand colors" oninput={() => (shown = PAGE)} />
      <div class="grid">
        {#each tiles.slice(0, shown) as tile (tile.id)}
          {@const isPicked = picked?.id === tile.id}
          <button
            type="button"
            class="tile"
            class:edited={!!tile.info.original}
            aria-pressed={isPicked}
            title={`${tile.info.name}, ${[tile.line.name, ...tile.alsoIn].join(' / ')}: ${tile.info.colors.map((h) => '#' + h).join(' + ')}${tile.info.original ? ` (your override; database: ${tile.info.original.map((h) => '#' + h).join(' + ')})` : ''}`}
            onclick={() => (isPicked ? unpick() : pick(tile))}
          >
            <span class="bar" style:background={bar(tile.info)} aria-hidden="true">
              {#if !bar(tile.info)}{#each tile.info.colors as h}<span style:background={`#${h}`}></span>{/each}{/if}
            </span>
            <span class="name">{tile.info.name}</span>
            <span class="hex">{tile.info.colors.join('\n')}</span>
            {#if tile.info.original}<span class="edited-tag">Edited</span>{/if}
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

    {#if pickedTile && suggestion && suggestion !== variant}
      <div class="actions">
        <button type="button" class="btn small" onclick={() => setVariant(suggestion)}>Set variant to {suggestion}</button>
      </div>
    {/if}

    <p class="credit">
      Colors from the <a href="https://openfilamentdatabase.org/" target="_blank" rel="noopener">Open Filament Database</a>
      ({db.source?.date || 'snapshot'}). Shades are approximate.
    </p>
  </div>
{/if}

<style>
  .brand { display: grid; gap: var(--s2); }
  .brand > .hint { margin: 0; }
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
    background: var(--bg);
    text-align: center;
  }
  .tile[aria-pressed='true'] { border-color: var(--ink); }
  /* A color you overrode: a dashed outline, like your own chips */
  .tile.edited { border-style: dashed; border-color: var(--action); }
  .tile.edited[aria-pressed='true'] { border-color: var(--ink); }
  .edited-tag { font-size: 0.6875rem; font-weight: 700; color: var(--action); line-height: 1.2; }
  .override {
    display: grid;
    gap: var(--s2);
    padding: var(--s3);
    border: 1px dashed var(--action);
    border-radius: 10px;
    background: var(--bg);
  }
  .override .what { margin: 0; }
  .override .db { display: block; color: var(--muted); font-size: 0.8125rem; }
  .hexrow { display: flex; align-items: center; gap: var(--s3); }
  .hexrow .chip { flex: none; width: 34px; height: 34px; border-radius: 8px; box-shadow: inset 0 0 0 1px rgba(0, 0, 0, 0.25); }
  .hexrow label { flex: 1; display: grid; gap: 2px; font-size: 0.8125rem; color: var(--muted); }
  .hexbox { display: flex; align-items: center; gap: 2px; font-family: var(--font-label); font-size: 1.0625rem; color: var(--ink); }
  .hexbox input { flex: 1; min-width: 0; min-height: 40px; letter-spacing: 0.06em; }
  .all { display: flex; gap: var(--s2); align-items: flex-start; font-size: 0.9375rem; }
  .all input { width: 20px; height: 20px; margin-top: 2px; flex: none; accent-color: var(--action); }
  .bar {
    display: flex;
    height: 22px;
    border-radius: 4px;
    overflow: hidden;
    box-shadow: inset 0 0 0 1px rgba(0, 0, 0, 0.2);
  }
  .bar span { flex: 1; }
  .name { font-size: 0.8125rem; font-weight: 700; line-height: 1.2; overflow-wrap: anywhere; }
  .hex { font-family: var(--font-label); font-size: 0.8125rem; white-space: pre-line; line-height: 1.2; letter-spacing: 0.04em; color: var(--muted); }
  .line-name { font-size: 0.6875rem; color: var(--muted); line-height: 1.2; }
  .multi { font-size: 0.6875rem; font-weight: 700; color: var(--action); line-height: 1.2; }
  .credit { margin: 0; padding-top: var(--s1); border-top: 1px solid var(--line); font-size: 0.75rem; color: var(--muted); }
  .credit a { color: inherit; }
</style>
