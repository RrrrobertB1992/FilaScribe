<script>
  // Saved colors for the current brand + material (the "Saved" panel of the
  // color section): pick one to fill the colors. Each tile has an Edit button
  // that opens an editor under the grid: name, a picker for each of its colors
  // (kept apart from the form until Save), and Remove. Colors are saved
  // automatically after a successful write. Saved colors belong to a brand +
  // material only, not to a variant. (The variants are still recorded, but
  // nothing here uses them.)
  import { exportJson, readJsonFile } from '../lib/backup.js';
  import HsvPicker from './HsvPicker.svelte';
  import { normalizeHex } from '../lib/formats/openspool.js';
  import { onMount } from 'svelte';
  import * as SC from '../lib/savedColors.js';
  import { canonicalBrand } from '../lib/brandColors.js';
  import { loadBrandColors } from '../lib/brandColorsData.js';

  let {
    brand = '',
    type = '',
    variant = '',
    colors = $bindable(['FFFFFF']),
    colorType = $bindable('1'),
    count = $bindable(0), // saved colors for this brand + material
    pickedName = $bindable(null), // the picked saved color's name ('' if unnamed), or null
    onchange = () => {},
    onstatus = () => {},
    onpick = () => {}, // a saved color was picked (Brand colors lets go of its pick)
    max = 5, // most colors one saved color can have
  } = $props();

  let all = $state(SC.load());
  let shown = $state(SC.PAGE_SIZE);
  let selected = $state(null); // entry id
  let snapshot = null; // colors before a saved color was picked
  let editor = $state(null); // { id, name, colors, type, active } while a saved color's editor is open
  let hexText = $state('');
  let userPicked = false; // picked by tapping it (not by a write, read or save)
  let currentKey = null;

  const key = $derived(SC.keyFor(brand, type));
  const entries = $derived(SC.entriesFor(all, key));
  const style = $derived(colors.length > 1 && colorType === '0' ? '0' : '1');
  const selectedEntry = $derived(entries.find((e) => SC.entryId(e) === selected) || null);
  const label = $derived(key ? key.replace('|', ' ') : '');

  // A new brand or material starts fresh
  $effect(() => {
    if (key !== currentKey) {
      currentKey = key;
      selected = null;
      snapshot = null;
      editor = null;
      shown = SC.PAGE_SIZE;
    }
  });
  // A saved color that was removed is no longer selected
  $effect(() => {
    if (selected && !selectedEntry) {
      selected = null;
      editor = null;
    }
  });
  $effect(() => {
    count = entries.length;
    pickedName = selectedEntry ? selectedEntry.name : null;
  });
  // The colors changed somewhere else (Custom, a brand color): the pick is let go
  $effect(() => {
    if (!selectedEntry) return;
    if (SC.idFor(colors.map((c) => c.toUpperCase()), style) !== SC.entryId(selectedEntry)) {
      selected = null;
      snapshot = null;
      editor = null;
      userPicked = false;
    }
  });
  // Saved colors under an old spelling of a database brand ("eSun|PLA")
  // move to its database name ("eSUN 3D|PLA"), the name the form now uses
  onMount(async () => {
    const db = await loadBrandColors().catch(() => null);
    if (!db) return;
    const next = SC.renameBrands(all, (b) => canonicalBrand(db, b));
    if (next !== all) persist(next);
  });

  function persist(next) {
    all = next;
    SC.store(next);
  }

  function apply(entry) {
    colors = [...entry.colors];
    if (entry.colors.length > 1) colorType = entry.colorType === '0' ? '0' : '1';
    onchange();
  }

  function select(entry) {
    // Keep the first snapshot when switching between saved colors
    if (!selected) snapshot = { colors: [...colors], colorType };
    selected = SC.entryId(entry);
    userPicked = true;
    if (editor && editor.id !== selected) editor = null;
    apply(entry);
    onpick();
  }

  function deselect() {
    selected = null;
    editor = null;
    if (snapshot) {
      colors = snapshot.colors;
      colorType = snapshot.colorType;
      snapshot = null;
      onchange();
    }
  }

  /** Save the current colors (the Custom panel's Save button). */
  export function saveCurrent() {
    if (!key) return;
    persist(SC.save(all, key, colors, style, variant));
    onstatus('Colors saved');
    selectMatching();
  }

  /** Save these colors as a new saved color (Clone on a brand color) and pick it. */
  export function addColor(newColors, newStyle, name = '') {
    if (!key) return;
    const id = SC.idFor(newColors, newStyle);
    persist(SC.save(all, key, newColors, newStyle, variant, name));
    if (name) persist(SC.rename(all, key, id, name)); // the name typed in Clone wins
    const entry = SC.entriesFor(all, key).find((e) => SC.entryId(e) === id);
    if (entry) select(entry);
    onstatus('Saved as a new color');
  }

  function removeRow(entry) {
    const what = entry.colors.join(' + ') + (entry.name ? ` (${entry.name})` : '');
    if (!confirm(`Remove saved color ${what}?`)) return;
    const id = SC.entryId(entry);
    persist(SC.removeEntry(all, key, id));
    if (selected === id) deselect();
  }

  // --- The editor under the grid ---
  function toggleEditor(entry) {
    const id = SC.entryId(entry);
    if (editor?.id === id) {
      editor = null;
      return;
    }
    if (selected !== id) select(entry);
    editor = { id, name: entry.name, colors: [...entry.colors], type: entry.colorType, active: 0 };
  }
  // Keep the hex box in step with the active color (not while typing a partial value)
  $effect(() => {
    const current = editor?.colors[editor.active];
    if (current && normalizeHex(hexText) !== current) hexText = current;
  });
  // The picker works on its own copy, as in the Custom panel, so the two never fight
  let pickerHex = $state('FFFFFF');
  $effect(() => {
    if (editor) pickerHex = editor.colors[editor.active];
  });
  $effect(() => {
    if (editor && normalizeHex(pickerHex) && pickerHex !== editor.colors[editor.active]) editor.colors[editor.active] = pickerHex;
  });
  function typedHex(e) {
    hexText = e.currentTarget.value;
    const hex = normalizeHex(hexText);
    if (hex && editor) editor.colors[editor.active] = hex;
  }
  function saveEditor() {
    const ed = editor;
    const entry = entries.find((e) => SC.entryId(e) === ed?.id);
    editor = null;
    if (!entry) return;
    const newColors = ed.colors.map((c) => c.toUpperCase());
    const type = newColors.length > 1 ? ed.type || '1' : undefined;
    let r = SC.replaceColors(all, key, ed.id, newColors, type);
    if (ed.name.trim() !== (entry.name || '')) r = { ...r, all: SC.rename(r.all, key, r.id, ed.name) };
    persist(r.all);
    selected = r.id;
    apply({ colors: newColors, colorType: type });
    onstatus('Saved color updated');
  }
  function removeFromEditor() {
    const entry = entries.find((e) => SC.entryId(e) === editor?.id);
    if (!entry) return;
    removeRow(entry);
    if (!entries.some((e) => SC.entryId(e) === editor?.id)) editor = null;
  }
  // + adds a color (a copy of the last one, ready to change); − drops the last one
  function addToEditor() {
    if (!editor || editor.colors.length >= max) return;
    editor.colors.push(editor.colors[editor.colors.length - 1]);
    editor.active = editor.colors.length - 1;
    if (editor.colors.length > 1 && !editor.type) editor.type = '1';
  }
  function dropFromEditor() {
    if (!editor || editor.colors.length < 2) return;
    editor.colors.pop();
    editor.active = Math.min(editor.active, editor.colors.length - 1);
    if (editor.colors.length < 2) editor.type = undefined;
  }
  function clearAll() {
    if (!confirm(`Remove all saved colors for ${label}?`)) return;
    persist(SC.clearKey(all, key));
    deselect();
  }

  // --- Called by the app ---

  /**
   * After a successful write: save the colors and mark them picked. A name
   * (from a brand color) is given to a new saved color.
   */
  export function afterWrite(name = '') {
    if (!key) return;
    editor = null;
    userPicked = false;
    persist(SC.save(all, key, colors, style, variant, name));
    selectMatching();
  }

  /** Let go of the pick without changing the colors (another list picked them). */
  export function release() {
    userPicked = false;
    selected = null;
    snapshot = null;
    editor = null;
  }

  /** After a tag is loaded: forget the old pick, then mark matching colors. */
  export function afterLoad() {
    userPicked = false;
    selected = null;
    snapshot = null;
    editor = null;
    queueMicrotask(selectMatching);
  }

  function selectMatching() {
    if (!key) return;
    const id = SC.idFor(colors, style);
    if (!SC.entriesFor(all, key).some((e) => SC.entryId(e) === id)) return;
    if (!selected) snapshot = { colors: [...colors], colorType };
    selected = id;
    userPicked = false;
    editor = null;
  }

  // --- Backup ---

  let importInput = $state();

  /** Open the file picker for importing saved colors. */
  export function openImport() {
    importInput?.click();
  }

  async function exportAll() {
    const r = await exportJson(all, 'filascribe-saved-colors.json');
    if (r.message) onstatus(r.ok ? `Saved colors copied. ${r.message.replace(/^Copied\. /, '')}` : 'Couldn’t copy the saved colors.', !r.ok);
  }

  async function importFile(e) {
    const file = e.currentTarget.files?.[0];
    e.currentTarget.value = '';
    if (!file) return;
    try {
      const r = SC.importInto(all, await readJsonFile(file));
      persist(r.all);
      onstatus(r.added ? `Imported ${r.added} saved ${r.added === 1 ? 'color' : 'colors'}.` : 'Nothing new to import.');
    } catch {
      onstatus('That file isn’t a saved-colors export.', true);
    }
  }

  function bar(entry) {
    const list = entry.colors.map((h) => `#${h}`);
    if (list.length > 1 && entry.colorType === '0') return `linear-gradient(to right, ${list.join(', ')})`;
    return null;
  }

  function tileTitle(entry) {
    let t = entry.colors.map((h) => '#' + h).join(' + ');
    if (entry.colors.length > 1) t += entry.colorType === '0' ? ', gradient' : ', segments';
    if (entry.name) t += `, ${entry.name}`;
    return t;
  }
</script>

{#if key}
  <div class="saved">
    <p class="hint">
      {#if entries.length}
        {entries.length} saved {entries.length === 1 ? 'color' : 'colors'} for {label}.
      {:else}
        Nothing saved for {label} yet. Colors are saved here when you write a tag, or with Save in Custom.
      {/if}
    </p>

    {#if entries.length}
      <div class="grid">
        {#each entries.slice(0, shown) as entry (SC.entryId(entry))}
          {@const isSel = selectedEntry === entry}
          {@const isOpen = editor?.id === SC.entryId(entry)}
          <div class="cell" class:on={isSel}>
            <button
              type="button"
              class="tile"
              aria-pressed={isSel}
              title={tileTitle(entry)}
              onclick={() => (isSel ? deselect() : select(entry))}
            >
              <span class="bar" style:background={bar(entry)} aria-hidden="true">
                {#if !bar(entry)}{#each entry.colors as h}<span style:background={`#${h}`}></span>{/each}{/if}
              </span>
              <span class="name">{entry.name || ' '}</span>
              <span class="hex">{entry.colors.join('\n')}</span>
            </button>
            <button type="button" class="edit-btn" class:open={isOpen} aria-expanded={isOpen} aria-label={`Edit ${entry.name || entry.colors.join(' + ')}`} onclick={() => toggleEditor(entry)}>Edit</button>
          </div>
        {/each}
      </div>
      {#if entries.length > shown}
        {@const left = entries.length - shown}
        <button type="button" class="btn small" onclick={() => (shown += SC.PAGE_SIZE)}>
          Show {Math.min(SC.PAGE_SIZE, left)} more ({left} left)
        </button>
      {/if}
    {/if}

    {#if editor}
      <div class="editor" role="group" aria-label="Edit saved color">
        <label class="field">
          <span class="lab">Name</span>
          <input type="text" bind:value={editor.name} maxlength="32" placeholder="Color name" autocomplete="off" />
        </label>
        <div class="field">
          <span class="lab" id="saved-edit-colors">{editor.colors.length > 1 ? 'Colors (tap one to change it)' : 'Color'}</span>
          <div class="chips" role="group" aria-labelledby="saved-edit-colors">
            {#each editor.colors as hex, i}
              <button type="button" class="chip" aria-pressed={i === editor.active} aria-label={`Color ${i + 1}, #${hex}${i === editor.active ? ', editing' : ''}`} onclick={() => (editor.active = i)}>
                <span class="dot" style:background={`#${hex}`}></span>#{hex}
              </button>
            {/each}
            <span class="pm">
              <button type="button" class="round" onclick={addToEditor} disabled={editor.colors.length >= max} aria-label="Add a color">+</button>
              {#if editor.colors.length > 1}
                <button type="button" class="round" onclick={dropFromEditor} aria-label="Remove the last color">−</button>
              {/if}
            </span>
          </div>
        </div>
        {#if editor.colors.length > 1}
          <div class="field">
            <span class="lab" id="saved-edit-style">Multi-color style</span>
            <div class="chips" role="group" aria-labelledby="saved-edit-style">
              <button type="button" class="chip style" aria-pressed={editor.type !== '0'} onclick={() => (editor.type = '1')}>Segments</button>
              <button type="button" class="chip style" aria-pressed={editor.type === '0'} onclick={() => (editor.type = '0')}>Gradient</button>
            </div>
          </div>
        {/if}
        <HsvPicker bind:hex={pickerHex} label={`Color ${editor.active + 1}`} />
        <label class="field">
          <span class="lab">Hex</span>
          <input type="text" class="hexbox" value={hexText} oninput={typedHex} maxlength="7" autocapitalize="characters" autocomplete="off" spellcheck="false" aria-label={`Hex for color ${editor.active + 1}`} />
        </label>
        <div class="actions">
          <button type="button" class="btn small danger" onclick={removeFromEditor}>Remove</button>
          <span class="spacer"></span>
          <button type="button" class="btn small" onclick={() => (editor = null)}>Cancel</button>
          <button type="button" class="btn small primary" onclick={saveEditor}>Save</button>
        </div>
      </div>
    {/if}

    <div class="backup">
      {#if entries.length}
        <button type="button" class="btn small danger" onclick={clearAll}>Clear {label}</button>
      {/if}
      <button type="button" class="btn small" onclick={exportAll}>Export all saved colors</button>
      <button type="button" class="btn small" onclick={openImport}>Import</button>
      <input bind:this={importInput} type="file" accept="application/json,.json" class="visually-hidden" tabindex="-1" onchange={importFile} />
    </div>
  </div>
{/if}

<style>
  .saved { display: grid; gap: var(--s2); }
  .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(96px, 1fr)); gap: var(--s2); }
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
  .tile {
    display: grid;
    align-content: start;
    gap: 3px;
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
  .editor {
    display: grid;
    gap: var(--s3);
    padding: var(--s3);
    border: 1px solid var(--line);
    border-radius: var(--r-card);
    background: var(--bg);
  }
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
  .pm { display: flex; gap: var(--s2); }
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
  .chip.style { padding: 0 var(--s4); }
  .chip.style[aria-pressed='true'] { background: var(--ink); border-color: var(--ink); color: var(--bg); }
  .round {
    flex: none;
    width: var(--h-small);
    height: var(--h-small);
    border: 1px solid var(--line);
    border-radius: 50%;
    background: none;
    color: var(--ink);
    font-size: 1.25rem;
    line-height: 1;
    cursor: pointer;
  }
  .round:disabled { opacity: 0.4; cursor: default; }
  .actions .spacer { flex: 1; }
  .bar {
    display: flex;
    height: 22px;
    border-radius: 4px;
    overflow: hidden;
    box-shadow: inset 0 0 0 1px rgba(0, 0, 0, 0.2);
  }
  .bar span { flex: 1; }
  .name { font-size: 0.8125rem; font-weight: 700; line-height: 1.2; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .hex { font-family: var(--font-label); font-size: 0.8125rem; white-space: pre-line; line-height: 1.2; letter-spacing: 0.04em; color: var(--muted); }
  .saved > .hint { margin: 0; }
  .actions, .backup { display: flex; flex-wrap: wrap; align-items: center; gap: var(--s2); }
  .backup { padding-top: var(--s1); border-top: 1px solid var(--line); }
</style>
