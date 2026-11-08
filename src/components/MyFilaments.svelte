<script>
  // The Filaments tab: your saved spools as a plain list (no card around it, so
  // each row gets the full width). Tap one to write a tag with it (App.svelte
  // asks first); search narrows the list. Each row
  // has a star (pin to the top) and ⋯ (name, note and remove). Name, note and
  // pin stay on this device: they are never written to a tag.
  import { fold } from '../lib/motion.js';
  import * as Filaments from '../lib/filaments.js';

  let { list = [], current = '', onuse = () => {}, onremove = () => {}, onchange = () => {} } = $props();

  // Searching only helps once there are clearly more rows than fit on a screen
  const SEARCH_FROM = 8;
  let query = $state('');
  const searchable = $derived(list.length >= SEARCH_FROM);
  const shown = $derived(Filaments.ordered(searchable ? Filaments.search(list, query) : list));

  const pinnedCount = $derived(list.filter((e) => e.pinned).length);
  const summary = $derived(list.length ? `${list.length} saved${pinnedCount ? ` · ${pinnedCount} pinned` : ''}` : 'None yet');

  // The row whose editor is open (one at a time)
  let editing = $state('');
  const toggleEdit = (e) => (editing = editing === Filaments.keyOf(e) ? '' : Filaments.keyOf(e));
  const label = (e) => e.name || `${Filaments.title(e)}, ${Filaments.colorLabel(e)}`;

  const swatch = Filaments.swatch;

  function remove(e) {
    if (!confirm(`Remove ${Filaments.title(e)} · ${Filaments.colorLabel(e)} from My filaments?`)) return;
    editing = '';
    onremove(e);
  }
</script>

<section class="filaments" data-fold="filaments">
  <h2 class="head"><span class="title">My filaments</span><span class="sum">{summary}</span></h2>
  {#if list.length}
    {#if searchable}
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
          <li class:on={Filaments.keyOf(e) === current} transition:fold>
            <div class="row">
              <button type="button" class="use" onclick={() => onuse(e)} aria-label={`Use ${label(e)}${Filaments.isCustom(e) ? ' (custom color)' : ''}`}>
                <span class="dot" style:background={swatch(e)} aria-hidden="true"></span>
                <span class="text">
                  <span class="name">{e.name || `${Filaments.title(e)} · ${Filaments.colorLabel(e)}`}</span>
                  <span class="meta">{#if e.name}{Filaments.title(e)} · {Filaments.colorLabel(e)}{#if Filaments.meta(e)}{' · '}{/if}{/if}{#if Filaments.isCustom(e) && !e.name}<span class="custom">Custom color</span>{/if}{Filaments.meta(e)}</span>
                  {#if e.note}<span class="note">{e.note}</span>{/if}
                </span>
              </button>
              <button type="button" class="ic star" class:pinned={e.pinned} aria-pressed={!!e.pinned} aria-label={`Pin ${label(e)}`} onclick={() => onchange(e, { pinned: !e.pinned })}>{e.pinned ? '★' : '☆'}</button>
              <button type="button" class="ic" aria-expanded={editing === Filaments.keyOf(e)} aria-label={`Edit ${label(e)}`} onclick={() => toggleEdit(e)}>⋯</button>
            </div>
            {#if editing === Filaments.keyOf(e)}
              <div class="edit" transition:fold>
                <label>
                  <span class="lab">Name</span>
                  <input type="text" value={e.name || ''} maxlength={Filaments.NAME_MAX} placeholder={`${Filaments.title(e)} · ${Filaments.colorLabel(e)}`} oninput={(ev) => onchange(e, { name: ev.currentTarget.value })} autocomplete="off" />
                </label>
                <label>
                  <span class="lab">Note</span>
                  <textarea rows="2" value={e.note || ''} maxlength={Filaments.NOTE_MAX} oninput={(ev) => onchange(e, { note: ev.currentTarget.value })}></textarea>
                </label>
                <p class="count"><span>Stays on this device. Never written to a tag.</span><span>{(e.note || '').length}/{Filaments.NOTE_MAX}</span></p>
                <div class="actions">
                  <button type="button" class="done" onclick={() => (editing = '')}>Done</button>
                  <button type="button" class="del" onclick={() => remove(e)}>Remove</button>
                </div>
              </div>
            {/if}
          </li>
        {/each}
      </ul>
    {:else}
      <p class="hint">No filament matches “{query}”.</p>
    {/if}
    <p class="hint">Tap one to write a tag with it. Brand, material, variant, colors and temperatures are used; weight and diameter come from your defaults for new tags.</p>
  {:else}
    <p class="hint">On Create, fill in the form, then tap “Save this spool as a filament” at the bottom. Writing a tag can offer to save it too.</p>
  {/if}
</section>

<style>
  .filaments { display: grid; gap: var(--s3); }
  .head {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    gap: var(--s3);
    margin: 0;
  }
  .title {
    font-family: var(--font-label);
    font-weight: 700;
    font-size: 0.75rem;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--action);
  }
  .sum { color: var(--muted); font-size: 0.875rem; font-weight: 400; }
  .find {
    width: 100%;
    min-height: var(--h-control);
    padding: 0 var(--s3);
    border: 1px solid var(--line);
    border-radius: var(--r-control);
    background: var(--bg);
    color: var(--ink);
    font: inherit;
  }
  .rows {
    list-style: none;
    margin: 0;
    padding: 0;
    border-top: 1px solid var(--line);
  }
  li {
    border-bottom: 1px solid var(--line);
  }
  .row { display: flex; align-items: stretch; }
  li.on { background: color-mix(in srgb, var(--action) 14%, var(--bg)); }
  .use {
    flex: 1;
    min-width: 0;
    display: flex;
    align-items: center;
    gap: var(--s3);
    padding: var(--s2) var(--s2) var(--s2) var(--s3);
    min-height: var(--h-row);
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
  .custom {
    display: inline-block;
    margin-right: var(--s2);
    padding: 0 var(--s2);
    border: 1px solid var(--line);
    border-radius: var(--r-pill);
    font-size: 0.75rem;
    font-weight: 700;
    color: var(--ink);
  }
  .note {
    color: var(--muted);
    font-size: 0.8125rem;
    font-style: italic;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .ic {
    flex: none;
    width: 44px;
    border: 0;
    background: none;
    color: var(--muted);
    font-size: 1.25rem;
    cursor: pointer;
  }
  .ic.pinned, .ic[aria-pressed='true'] { color: var(--action); }
  .ic[aria-expanded='true'] { color: var(--ink); }
  .edit {
    display: grid;
    gap: var(--s2);
    padding: var(--s2) var(--s3) var(--s3);
    background: var(--surface);
    border-top: 1px solid var(--line);
  }
  .edit label { display: grid; gap: var(--s1); }
  .lab { font-family: var(--font-label); font-weight: 600; font-size: 0.8125rem; }
  .edit input, .edit textarea {
    width: 100%;
    box-sizing: border-box;
    min-height: var(--h-control);
    padding: var(--s2) var(--s3);
    border: 1px solid var(--line);
    border-radius: var(--r-control);
    background: var(--bg);
    color: var(--ink);
    font: inherit;
    resize: none;
  }
  .count { display: flex; justify-content: space-between; gap: var(--s2); margin: 0; color: var(--muted); font-size: 0.75rem; }
  .actions { display: flex; justify-content: space-between; gap: var(--s2); }
  .actions button {
    min-height: var(--h-control);
    padding: 0 var(--s4);
    border: 1px solid var(--line);
    border-radius: var(--r-control);
    background: none;
    color: var(--ink);
    font-family: var(--font-label);
    font-weight: 600;
    cursor: pointer;
  }
  .actions .del { color: var(--danger); }
  .hint { margin: 0; }
</style>
