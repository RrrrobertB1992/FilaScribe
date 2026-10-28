<script>
  // Saved colors for the current brand + material (the "Saved" panel of the
  // color section), with the same behavior as PrintTag-Web-Rrrrobert: pick
  // one to fill the colors, rename it, edit its colors (in the Custom panel),
  // remove a variant or the whole row. Colors are saved automatically after
  // a successful write.
  import { Capacitor } from '@capacitor/core';
  import * as SC from '../lib/savedColors.js';

  let {
    brand = '',
    type = '',
    variant = '',
    colors = $bindable(['FFFFFF']),
    colorType = $bindable('1'),
    count = $bindable(0), // saved colors for this brand + material
    pickedName = $bindable(null), // the picked saved color's name ('' if unnamed), or null
    editing = $bindable(false), // its colors are being edited in the Custom panel
    onchange = () => {},
    onstatus = () => {},
    onpick = () => {}, // a saved color was picked (Brand colors lets go of its pick)
  } = $props();

  let all = $state(SC.load());
  let shown = $state(SC.PAGE_SIZE);
  let selected = $state(null); // entry id
  let snapshot = null; // colors before a saved color was picked
  let renaming = $state(false);
  let renameText = $state('');
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
      renaming = false;
      editing = false;
      shown = SC.PAGE_SIZE;
    }
  });
  // A saved color that was removed is no longer selected
  $effect(() => {
    if (selected && !selectedEntry) {
      selected = null;
      renaming = false;
      editing = false;
    }
  });
  $effect(() => {
    count = entries.length;
    pickedName = selectedEntry ? selectedEntry.name : null;
  });
  // The colors were changed elsewhere (another list, the pickers): let go of
  // the pick, unless they're being edited for it
  $effect(() => {
    if (!selectedEntry || editing) return;
    if (SC.idFor(colors.map((c) => c.toUpperCase()), style) !== SC.entryId(selectedEntry)) {
      selected = null;
      snapshot = null;
      renaming = false;
    }
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
    renaming = false;
    editing = false;
    apply(entry);
    onpick();
  }

  function deselect() {
    selected = null;
    renaming = false;
    editing = false;
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

  function removeRow(entry) {
    const what = entry.colors.join(' + ') + (entry.name ? ` (${entry.name})` : '');
    if (!confirm(`Remove saved color ${what}?`)) return;
    const id = SC.entryId(entry);
    persist(SC.removeEntry(all, key, id));
    if (selected === id) deselect();
  }

  function removeVariant(entry) {
    const id = SC.entryId(entry);
    persist(SC.removeVariant(all, key, id, variant));
    if (!SC.entriesFor(all, key).some((e) => SC.entryId(e) === id)) deselect();
  }

  function startRename() {
    renameText = selectedEntry?.name || '';
    renaming = true;
  }

  function saveRename() {
    persist(SC.rename(all, key, selected, renameText));
    renaming = false;
  }

  export function saveEdit() {
    const r = SC.replaceColors(all, key, selected, colors, style);
    persist(r.all);
    selected = r.id;
    editing = false;
  }

  export function cancelEdit() {
    if (selectedEntry) apply(selectedEntry);
    editing = false;
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
    editing = false;
    persist(SC.save(all, key, colors, style, variant, name));
    selectMatching();
  }

  /** Let go of the pick without changing the colors (another list picked them). */
  export function release() {
    selected = null;
    snapshot = null;
    renaming = false;
    editing = false;
  }

  /** After a tag is loaded: forget the old pick, then mark matching colors. */
  export function afterLoad() {
    selected = null;
    snapshot = null;
    renaming = false;
    editing = false;
    queueMicrotask(selectMatching);
  }

  function selectMatching() {
    if (!key) return;
    const id = SC.idFor(colors, style);
    if (!SC.entriesFor(all, key).some((e) => SC.entryId(e) === id)) return;
    if (!selected) snapshot = { colors: [...colors], colorType };
    selected = id;
    renaming = false;
    editing = false;
  }

  // --- Backup ---

  let importInput = $state();

  /** Open the file picker for importing saved colors. */
  export function openImport() {
    importInput?.click();
  }

  async function exportAll() {
    const json = JSON.stringify(all, null, 2);
    if (Capacitor.isNativePlatform()) {
      try {
        await navigator.clipboard.writeText(json);
        onstatus('Saved colors copied. Paste them somewhere safe, or into a .json file.');
      } catch {
        onstatus('Couldn’t copy the saved colors.', true);
      }
      return;
    }
    const url = URL.createObjectURL(new Blob([json], { type: 'application/json' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = 'filascribe-saved-colors.json';
    a.click();
    URL.revokeObjectURL(url);
  }

  async function importFile(e) {
    const file = e.currentTarget.files?.[0];
    e.currentTarget.value = '';
    if (!file) return;
    try {
      const r = SC.importInto(all, JSON.parse(await file.text()));
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
        {entries.length} saved {entries.length === 1 ? 'color' : 'colors'} for {label}. The current variant is highlighted.
      {:else}
        Nothing saved for {label} yet. Colors are saved here when you write a tag, or with Save in Custom.
      {/if}
    </p>

    {#if entries.length}
      <div class="grid">
        {#each entries.slice(0, shown) as entry (SC.entryId(entry))}
          {@const isSel = selectedEntry === entry}
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
            <span class="vars">
              {#each entry.variants as v, i}{#if i}{', '}{/if}<span class:current={v === variant}>{v || 'No variant'}</span>{/each}
            </span>
          </button>
        {/each}
      </div>
      {#if entries.length > shown}
        {@const left = entries.length - shown}
        <button type="button" class="btn small quiet" onclick={() => (shown += SC.PAGE_SIZE)}>
          Show {Math.min(SC.PAGE_SIZE, left)} more ({left} left)
        </button>
      {/if}
    {/if}

    {#if selectedEntry}
      <div class="actions">
        {#if renaming}
          <input
            type="text"
            bind:value={renameText}
            placeholder="Color name"
            maxlength="32"
            aria-label="Saved color name"
            onkeydown={(e) => {
              if (e.key === 'Enter') { e.preventDefault(); saveRename(); }
              if (e.key === 'Escape') { e.preventDefault(); renaming = false; }
            }}
          />
          <button type="button" class="btn small" onclick={saveRename}>Save name</button>
          <button type="button" class="btn small quiet" onclick={() => (renaming = false)}>Cancel</button>
        {:else}
          <button type="button" class="btn small" onclick={startRename}>Rename</button>
          <button type="button" class="btn small" onclick={() => { renaming = false; editing = true; }}>Edit colors</button>
          {#if selectedEntry.variants.includes(variant)}
            <button type="button" class="btn small danger" onclick={() => removeVariant(selectedEntry)}>Remove “{variant || 'No variant'}”</button>
          {/if}
          <button type="button" class="btn small danger" onclick={() => removeRow(selectedEntry)}>Remove color</button>
        {/if}
      </div>
    {/if}

    <div class="backup">
      {#if entries.length}
        <button type="button" class="btn small quiet danger" onclick={clearAll}>Clear {label}</button>
      {/if}
      <button type="button" class="btn small quiet" onclick={exportAll}>Export all saved colors</button>
      <button type="button" class="btn small quiet" onclick={openImport}>Import</button>
      <input bind:this={importInput} type="file" accept="application/json,.json" class="visually-hidden" tabindex="-1" onchange={importFile} />
    </div>
  </div>
{/if}

<style>
  .saved { display: grid; gap: var(--s2); }
  .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(96px, 1fr)); gap: var(--s2); }
  .tile {
    display: grid;
    gap: 3px;
    padding: var(--s2);
    border-radius: 8px;
    border: 2px solid transparent;
    background: var(--bg);
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
  .name { font-size: 0.8125rem; font-weight: 700; line-height: 1.2; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .hex { font-family: var(--font-label); font-size: 0.8125rem; white-space: pre-line; line-height: 1.2; letter-spacing: 0.04em; color: var(--muted); }
  .vars { font-size: 0.6875rem; color: var(--muted); line-height: 1.25; }
  .vars .current { color: var(--action); font-weight: 700; }
  .saved > .hint { margin: 0; }
  .actions, .backup { display: flex; flex-wrap: wrap; align-items: center; gap: var(--s2); }
  .backup { padding-top: var(--s1); border-top: 1px solid var(--line); }
  .actions input { flex: 1 1 100%; }
</style>
