<script>
  // Brand colors (the "Brand" panel of the color section): the brand's named
  // colors for the picked material, narrowed by the variant (see
  // lib/brandColors.js). Works like Saved colors but read-only: pick a color
  // to fill the colors (and the line's temperatures); tap it again to put
  // back what was there. Every tile has an Edit button: it opens an editor right
  // under that tile's row, with Override (change the color's hex everywhere you
  // use it) and Clone (save a copy of it as a saved color).
  import { onMount, untrack } from 'svelte';
  import * as BC from '../lib/brandColors.js';
  import * as CM from '../lib/colorMatch.js';
  import { loadBrandColors } from '../lib/brandColorsData.js';
  import HsvPicker from './HsvPicker.svelte';
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
    max = 5, // most colors a tag can hold (1 when the profile only has one)
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
    onclone = () => {}, // Clone: save these colors (hexes, name, color type) as a new saved color
    suggestLimit = 0, // how many closest brand colors to suggest (Settings); 0 is off
    suggestMaxDelta = 12, // how far apart (CIEDE2000) a suggestion may be (Settings: How close)
    suggestions = $bindable(null), // null: none to offer here; [] = nothing close; else the closest colors
    backTo = $bindable(''), // after picking a suggestion: the custom color it replaced, as text
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
  // The editor belongs to the picked color
  $effect(() => {
    if (!pickedTile) editor = null;
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

  // Closest brand colors: for colors that aren't a brand color, the nearest of
  // the colors the variant shows (the whole material when there's no variant)
  let cameFrom = $state(''); // the colors a picked suggestion replaced
  const knownColor = $derived(db && result.total > 0 ? !!BC.findColor(db, { brand, type, variant }, colors) : false);
  const candidateTiles = $derived.by(() => {
    if (!db) return [];
    const lines = variant ? BC.linesFor(db, { brand, type, variant }).lines : allLines;
    return BC.tilesFor(lines);
  });
  $effect(() => {
    const mine = colors.slice(0, max);
    if (!db || result.total === 0 || knownColor || suggestLimit < 1 || cameFrom || mine.some((h) => !CM.parseHex(h))) {
      suggestions = null;
      return;
    }
    suggestions = CM.nearest(candidateTiles, mine, suggestLimit, suggestMaxDelta).map((s) => ({
      id: s.tile.id,
      name: s.tile.info.name,
      line: s.tile.line.name,
      colors: s.tile.info.colors,
      gradient: s.tile.info.gradient,
      label: s.label,
    }));
  });
  $effect(() => {
    if (!pickedTile) cameFrom = '';
  });
  $effect(() => {
    backTo = cameFrom && pickedTile ? cameFrom : '';
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

  // --- Called by the app ---

  /** Use a suggested color, like picking it in this list (its line shows even if the variant would hide it). */
  export function pickSuggestion(id) {
    const tile = findTile(id);
    if (!tile) return;
    if (!BC.linesFor(db, { brand, type, variant }).lines.includes(tile.line)) showAll = true;
    cameFrom = colors.slice(0, max).map((h) => `#${h}`).join(' + ');
    pick(tile);
  }

  /** Put back the custom color a suggestion replaced. */
  export function backToMine() {
    unpick();
    cameFrom = '';
  }

  /** Let go of the pick without changing anything (Saved colors picked). */
  export function release() {
    picked = null;
    snapshot = null;
  }

  /**
   * On opening the app (and Start over): pick White, else Black, else the first
   * color in the list, so the form starts on a brand color. The colors are set
   * but the temperatures are left as they are.
   */
  export function autoPick() {
    if (picked || !db || !tiles.length) return;
    if (colors.length !== 1 || colors[0].toUpperCase() !== 'FFFFFF') return; // already changed
    const named = (n) => tiles.find((t) => t.info.name.trim().toLowerCase() === n);
    const tile = named('white') || named('black') || tiles[0];
    snapshot = { colors: [...colors], colorType, temps: { ...getTemps() } };
    picked = { id: tile.id, lineName: tile.line.name };
    colors = [...tile.info.colors];
    if (tile.info.colors.length > 1) colorType = tile.info.gradient ? '0' : '1';
    onchange();
    onpick();
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

  // --- Editing a color: Override its hex, or Clone it as a saved color ---

  let editor = $state(null); // { id, hexes: ['212121'], active: 0, all: false } while the editor is open under a tile
  let hexText = $state('');
  let pickerHex = $state('FFFFFF');
  const editFor = (tile) => Manual.find(getEdits(), { brand: dbBrandName, material: materialOf(tile.line), line: tile.line.name, color: tile.info.name });
  // The override on the picked color (its line's own, or the all-lines one)
  const pickedEdit = $derived(pickedTile && db ? editFor(pickedTile) : null);
  const dbBrandName = $derived(BC.findBrand(db, brand)?.name || '');
  const hexError = $derived(editor && !normalizeHex(hexText) ? 'Use 3 or 6 hex digits, like F80 or FF8800.' : '');

  // Keep the hex box in step with the active color. It must not read hexText
  // as a dependency, or erasing or half-typing a value would be put straight back.
  $effect(() => {
    const current = editor?.hexes[editor.active];
    untrack(() => {
      if (current && normalizeHex(hexText) !== current) hexText = current;
    });
  });
  // The picker works on its own copy so the two never fight
  $effect(() => {
    if (editor) pickerHex = editor.hexes[editor.active];
  });
  $effect(() => {
    if (editor && normalizeHex(pickerHex) && pickerHex !== editor.hexes[editor.active]) editor.hexes[editor.active] = pickerHex;
  });
  function typedHex(e) {
    hexText = e.currentTarget.value;
    const hex = normalizeHex(hexText);
    if (hex && editor) editor.hexes[editor.active] = hex;
  }
  // Scroll the editor into view when it opens under a tile
  const reveal = (node) => {
    node.scrollIntoView({ block: 'nearest' });
  };

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

  // Edit picks the tile too (so Clone and Override work on the color you see)
  function toggleEditor(tile) {
    if (editor?.id === tile.id) {
      editor = null;
      return;
    }
    if (picked?.id !== tile.id) pick(tile);
    editor = { id: tile.id, hexes: [...tile.info.colors], active: 0, all: editFor(tile)?.line === Manual.ALL_LINES };
  }

  // The colors in the editor, when every one is a real hex
  function editorHexes() {
    if (!editor || hexError) return null;
    const hexes = editor.hexes.map((h) => normalizeHex(h));
    return hexes.every(Boolean) ? hexes : null;
  }

  // Save the colors as a new saved color named after the brand color, keeping its style
  function saveClone() {
    const tile = pickedTile;
    const hexes = editorHexes();
    if (!tile || !hexes) return;
    const name = tile.info.name.trim().slice(0, 32);
    const style = tile.info.gradient ? '0' : '1';
    editor = null;
    picked = null;
    snapshot = null;
    onclone(hexes.slice(0, max), name, style);
  }

  function saveEditor() {
    const tile = pickedTile;
    const hexes = editorHexes();
    if (!tile || !hexes) return;
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

    {#if result.filter !== 'all' || showAll}
      <div class="filters">
        <button type="button" class="btn small" onclick={() => { showAll = !showAll; lineFilter = ''; shown = PAGE; }}>
          {showAll ? `Show only ${groupName}` : `Show all ${label} lines`}
        </button>
      </div>
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
          {@const isOpen = editor?.id === tile.id}
          <div class="cell" class:on={isPicked} class:edited={!!tile.info.original}>
            <button
              type="button"
              class="tile"
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
            <button type="button" class="edit-btn" class:open={isOpen} aria-expanded={isOpen} aria-label={`Edit ${tile.info.name}${!lineFilter && result.lines.length > 1 ? `, ${tile.line.name}` : ''}`} onclick={() => toggleEditor(tile)}>Edit</button>
          </div>
          {#if isOpen && editor}
            <div class="editor" role="group" aria-label="Edit brand color" use:reveal>
              <p class="what">
                <strong>{tile.info.name}</strong>, {tile.line.name}
                <span class="db">Database: {(tile.info.original || tile.info.colors).map((h) => `#${h}`).join(' + ')}</span>
              </p>
              <div class="field">
                <span class="lab" id="brand-edit-colors">{editor.hexes.length > 1 ? 'Colors (tap one to change it)' : 'Color'}</span>
                <div class="chips" role="group" aria-labelledby="brand-edit-colors">
                  {#each editor.hexes as hex, i}
                    <button type="button" class="chip" aria-pressed={i === editor.active} aria-label={`Color ${i + 1}, #${hex}${i === editor.active ? ', editing' : ''}`} onclick={() => (editor.active = i)}>
                      <span class="dot" style:background={`#${hex}`}></span>#{hex}
                    </button>
                  {/each}
                </div>
              </div>
              <HsvPicker bind:hex={pickerHex} label={`Color ${editor.active + 1}`} />
              <label class="field">
                <span class="lab">Hex</span>
                <input type="text" class="hexbox" value={hexText} oninput={typedHex} maxlength="7" autocapitalize="characters" autocomplete="off" spellcheck="false" aria-label={`Hex for color ${editor.active + 1}`} />
              </label>
              {#if hexError}<p class="error-text">{hexError}</p>{/if}
              {#if result.lines.length > 1 || allLines.length > 1}
                <label class="all">
                  <input type="checkbox" bind:checked={editor.all} />
                  <span>Also change “{tile.info.name}” in the other {label} lines</span>
                </label>
              {/if}
              <div class="actions">
                <button type="button" class="btn small primary" onclick={saveEditor}>Override</button>
                <button type="button" class="btn small" onclick={saveClone}>Clone</button>
                <button type="button" class="btn small" onclick={() => (editor = null)}>Cancel</button>
              </div>
              {#if pickedEdit}
                <div class="actions"><button type="button" class="btn small danger" onclick={resetEditor}>Reset to database</button></div>
              {/if}
            </div>
          {/if}
        {/each}
      </div>
      {#if !tiles.length}<p class="hint">No colors match “{search}”.</p>{/if}
      {#if tiles.length > shown}
        {@const left = tiles.length - shown}
        <button type="button" class="btn small" onclick={() => (shown += PAGE)}>Show {Math.min(PAGE, left)} more ({left} left)</button>
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
    min-height: var(--h-small);
    padding: 0 var(--s3);
    border-radius: var(--r-pill);
    border: 1px solid transparent;
    background: var(--chip);
    font-family: var(--font-label);
    font-size: 0.9375rem;
  }
  .line[aria-pressed='true'] { background: var(--ink); color: var(--bg); font-weight: 600; }
  .search { min-height: var(--h-chip); }
  /* dense: the tiles after the edited one fill its row, and the editor opens right under that row */
  .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(96px, 1fr)); grid-auto-flow: dense; gap: var(--s2); }
  /* The cell is the box (so the picked outline wraps the Edit button too) */
  .cell {
    display: grid;
    grid-template-rows: 1fr auto;
    gap: var(--s1);
    padding: var(--s2);
    border-radius: var(--r-control);
    border: 2px solid transparent;
    background: var(--bg);
    text-align: center;
  }
  .cell.on { border-color: var(--action); }
  /* A color you overrode: a dashed outline, like your own chips */
  .cell.edited { border-style: dashed; border-color: var(--muted); }
  .cell.edited.on { border-color: var(--action); }
  .tile {
    display: grid;
    gap: 3px;
    align-content: start;
    padding: 0;
    border: 0;
    background: none;
    color: inherit;
    font: inherit;
    text-align: center;
    cursor: pointer;
  }
  /* Neutral on purpose: orange means "picked", and this must not be mistaken for it */
  .edit-btn {
    min-height: var(--h-small);
    border: 1px solid var(--line);
    border-radius: var(--r-control);
    background: none;
    color: var(--ink);
    font-family: var(--font-label);
    font-weight: 600;
    font-size: 0.875rem;
    cursor: pointer;
  }
  .edit-btn.open { background: var(--ink); border-color: var(--ink); color: var(--bg); }
  .edited-tag { font-size: 0.6875rem; font-weight: 700; color: var(--muted); line-height: 1.2; }
  .editor {
    grid-column: 1 / -1;
    display: grid;
    gap: var(--s3);
    padding: var(--s3);
    border: 1px solid var(--line);
    border-radius: var(--r-card);
    background: var(--bg);
  }
  .editor .what { margin: 0; }
  .editor .db { display: block; color: var(--muted); font-size: 0.8125rem; }
  .field { display: grid; gap: var(--s1); }
  .lab { font-family: var(--font-label); font-weight: 600; font-size: 0.8125rem; }
  .editor input[type='text'] {
    width: 100%;
    box-sizing: border-box;
    min-height: var(--h-control);
    padding: 0 var(--s3);
    border: 1px solid var(--line);
    border-radius: var(--r-control);
    background: var(--surface);
    color: var(--ink);
    font: inherit;
  }
  .hexbox { font-family: monospace; text-transform: uppercase; }
  .chips { display: flex; flex-wrap: wrap; align-items: center; gap: var(--s2); }
  .chip {
    display: inline-flex;
    align-items: center;
    gap: var(--s2);
    min-height: var(--h-chip);
    padding: 0 var(--s2) 0 var(--s1);
    border: 1px solid var(--line);
    border-radius: var(--r-pill);
    background: none;
    color: inherit;
    font: inherit;
    font-size: 0.8125rem;
    cursor: pointer;
  }
  .chip[aria-pressed='true'] { border: 2px solid var(--action); }
  .chip .dot { width: 24px; height: 24px; border-radius: 50%; border: 1px solid var(--line); }
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
</style>
