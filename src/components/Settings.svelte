<script>
  // The Settings tab: defaults for new tags, your chips and saved colors,
  // appearance, and about.
  import Palette from './Palette.svelte';
  import * as OpenSpool from '../lib/formats/openspool.js';
  import * as Defaults from '../lib/defaults.js';
  import * as CustomChips from '../lib/customChips.js';
  import * as SC from '../lib/savedColors.js';
  import * as Theme from '../lib/theme.js';
  import { exportJson, readJsonFile } from '../lib/backup.js';
  import { buildParts } from '../lib/buildInfo.js';
  import * as BrandList from '../lib/brandList.js';
  import * as MaterialList from '../lib/materialList.js';
  import { MATERIALS } from '../lib/catalog.js';
  import { findBrands, canonicalBrand, findBrand } from '../lib/brandColors.js';
  import orca from '../data/orca-vendors.json';

  let {
    form, // the form on screen (Create or a read tag), for "Use the form"
    defaults = $bindable({}),
    chips = $bindable({ brands: [], materials: [], variants: {} }),
    shownBrands = $bindable([...BrandList.DEFAULT]),
    shownMaterials = $bindable([...MaterialList.DEFAULT]),
    brandData = null,
    onstatus = () => {},
  } = $props();

  // --- Defaults for new tags ---

  const shown = $derived(Defaults.newForm(defaults));
  const hasDefaults = $derived(Object.keys(defaults).length > 0);
  const temps = (a, b) => (a && b ? `${a}–${b} °C` : a || b ? `${a || b} °C` : 'not set');
  const rows = $derived.by(() => {
    const u1 = shown.profile === 'u1';
    const r = [
      ['Fields', OpenSpool.PROFILES[shown.profile]?.label || shown.profile],
      ['Brand', shown.brand || 'not set'],
      ['Material', shown.type || 'not set'],
    ];
    if (u1) r.push(['Variant', shown.subtype || 'None']);
    r.push(['Nozzle', temps(shown.minTemp, shown.maxTemp)]);
    if (u1) {
      r.push(['Bed', temps(shown.bedMinTemp, shown.bedMaxTemp)]);
      if (shown.weight) r.push(['Weight', `${shown.weight} g`]);
      if (shown.diameter) r.push(['Diameter', `${shown.diameter} mm`]);
      if (shown.alpha && shown.alpha.toUpperCase() !== 'FF') r.push(['Opacity', shown.alpha]);
    }
    return r;
  });

  function useForm() {
    defaults = Defaults.fromForm(form);
    Defaults.store(defaults);
    onstatus('Saved. New tags start like this.');
  }

  function resetDefaults() {
    defaults = {};
    Defaults.store(defaults);
    onstatus('New tags start with the built-in defaults again.');
  }

  // --- Brands ---

  let find = $state('');
  const known = (b) => !!(brandData && findBrand(brandData, b));
  const hasColors = (b) => Object.keys(findBrand(brandData, b)?.materials || {}).length > 0;
  // Brands starting with what's typed (nothing until something is), not
  // the ones already on the form
  const results = $derived(findBrands(brandData, find, { limit: 12, exclude: shownBrands }));
  // A typed name nobody lists (nothing starts with it) can be added as your own
  const addOwn = $derived.by(() => {
    const q = find.trim();
    if (q.length < 2 || q.length > 40 || q.toLowerCase() === 'generic' || known(q) || results.length) return '';
    return shownBrands.includes(q) ? '' : q;
  });

  function setBrands(next) {
    if (next === shownBrands) return;
    shownBrands = next;
    BrandList.store(shownBrands);
  }

  function addBrand(name) {
    setBrands(BrandList.add(shownBrands, name));
  }

  function addOwnBrand() {
    addBrand(addOwn);
    find = '';
  }

  // --- Materials ---

  let findMaterial = $state('');
  const isOwnMaterial = (m) => !(m in MATERIALS);
  // Built-in materials that aren't on the row, narrowed by what's typed
  const hiddenMaterials = $derived(
    MaterialList.hidden(shownMaterials).filter((m) => m.toLowerCase().includes(findMaterial.trim().toLowerCase())),
  );
  // A typed name that isn't a built-in material can be added as your own
  const addOwnMaterial = $derived.by(() => {
    const q = MaterialList.canonical(findMaterial);
    if (!q || q.length > 40 || !isOwnMaterial(q)) return '';
    return shownMaterials.includes(q) ? '' : q;
  });

  function setMaterials(next) {
    if (next === shownMaterials) return;
    shownMaterials = next;
    MaterialList.store(shownMaterials);
  }

  function addMaterial(name) {
    setMaterials(MaterialList.add(shownMaterials, name));
  }

  function addOwnMaterialNow() {
    addMaterial(addOwnMaterial);
    findMaterial = '';
  }

  function resetMaterials() {
    if (!confirm('Show the default materials again? Materials you turned on are turned off.')) return;
    setMaterials([...MaterialList.DEFAULT]);
  }

  // --- Collapsible cards (closed to start; which are open is remembered) ---

  const OPEN_KEY = 'filascribe-settings-open';
  let open = $state(loadOpen());
  function loadOpen() {
    try {
      const v = JSON.parse(localStorage.getItem(OPEN_KEY) || '[]');
      return Array.isArray(v) ? v.filter((x) => typeof x === 'string') : [];
    } catch {
      return [];
    }
  }
  function toggled(id, e) {
    const isOpen = e.currentTarget.open;
    if (isOpen === open.includes(id)) return;
    open = isOpen ? [...open, id] : open.filter((x) => x !== id);
    try {
      localStorage.setItem(OPEN_KEY, JSON.stringify(open));
    } catch {
      // not remembered
    }
  }

  function resetBrands() {
    if (!confirm('Show the default brands again? Brands you turned on are turned off.')) return;
    setBrands([...BrandList.DEFAULT]);
  }

  // --- Your chips ---

  const variantGroups = $derived(Object.entries(chips.variants).map(([key, list]) => ({ key, label: key.replace('|', ' '), list })));
  const chipCount = $derived(variantGroups.reduce((n, g) => n + g.list.length, 0));

  function removeChip(kind, value, key = '') {
    const [brand, type] = key ? key.split('|') : ['', ''];
    chips = CustomChips.remove(chips, kind, value, { brand, type });
    CustomChips.store(chips);
  }

  function clearChips() {
    if (!confirm('Remove all your chips? Built-in chips stay.')) return;
    chips = { ...chips, variants: {} };
    CustomChips.store(chips);
  }

  // --- Saved colors ---

  let saved = $state(SC.load());
  let importInput = $state();
  const savedGroups = $derived(Object.entries(saved).map(([key, list]) => ({ key, label: key.replace('|', ' '), list })));
  const savedCount = $derived(savedGroups.reduce((n, g) => n + g.list.length, 0));

  function persistSaved(next) {
    saved = next;
    SC.store(next);
  }

  function clearSaved(key) {
    if (!confirm(`Remove all saved colors for ${key.replace('|', ' ')}?`)) return;
    persistSaved(SC.clearKey(saved, key));
  }

  function clearAllSaved() {
    if (!confirm('Remove every saved color, for every brand and material?')) return;
    persistSaved({});
  }

  async function exportSaved() {
    const r = await exportJson(saved, 'filascribe-saved-colors.json');
    if (r.message) onstatus(r.ok ? `Saved colors copied. ${r.message.replace(/^Copied\. /, '')}` : 'Couldn’t copy the saved colors.', !r.ok);
  }

  async function importSaved(e) {
    const file = e.currentTarget.files?.[0];
    e.currentTarget.value = '';
    if (!file) return;
    try {
      const r = SC.importInto(saved, await readJsonFile(file));
      persistSaved(r.all);
      onstatus(r.added ? `Imported ${r.added} saved ${r.added === 1 ? 'color' : 'colors'}.` : 'Nothing new to import.');
    } catch {
      onstatus('That file isn’t a saved-colors export.', true);
    }
  }

  const bar = (entry) => {
    const list = entry.colors.map((h) => `#${h}`);
    if (list.length === 1) return list[0];
    if (entry.colorType === '0') return `linear-gradient(to right, ${list.join(', ')})`;
    const step = 100 / list.length;
    return `linear-gradient(to right, ${list.map((c, i) => `${c} ${i * step}% ${(i + 1) * step}%`).join(', ')})`;
  };

  // --- Appearance ---

  let theme = $state(Theme.load());
  const THEME_ITEMS = [
    { value: 'system', label: 'Follow the system' },
    { value: 'light', label: 'Light' },
    { value: 'dark', label: 'Dark' },
  ];
  function pickTheme(t) {
    Theme.apply(t);
    Theme.store(t);
  }

  // --- About ---

  const build = buildParts(__BUILD__);
  const repo = __BUILD__.repo || 'RrrrobertB1992/FilaScribe';
  const ofd = $derived(brandData?.source || {});
  const short = (sha) => String(sha || '').slice(0, 7);
</script>

<div class="settings">
  <details class="card" open={open.includes('defaults')} ontoggle={(e) => toggled('defaults', e)}>
    <summary><h2 id="set-defaults">Defaults for new tags</h2></summary>
    <div class="body">
    <p class="hint">What Create starts with, and what Start over goes back to. Colors aren’t included; they start white.</p>
    <dl class="rows">
      {#each rows as [k, v]}
        <div><dt>{k}</dt><dd>{v}</dd></div>
      {/each}
    </dl>
    <p class="hint small">{hasDefaults ? 'Your defaults.' : 'The built-in defaults.'}</p>
    <div class="actions">
      <button type="button" class="btn small" onclick={useForm}>Use the form as it is now</button>
      <button type="button" class="btn small quiet" onclick={resetDefaults} disabled={!hasDefaults}>Reset to built-in</button>
    </div>
    </div>
  </details>

  <details class="card" open={open.includes('brands')} ontoggle={(e) => toggled('brands', e)}>
    <summary><h2 id="set-brands">Brands</h2></summary>
    <div class="body">
    <p class="hint">The brands on the Brand row: × removes one, and Find a brand adds more. Anything else can be typed with Other… on the form.</p>
    <div class="group" role="group" aria-label="Brands on the form">
      <div class="chips">
        <span class="mine fixed">Generic</span>
        {#each shownBrands as b (b)}
          <span class="mine b" class:own={!known(b)}>{b}<button type="button" class="x" aria-label={`Hide ${b}`} onclick={() => setBrands(BrandList.remove(shownBrands, b))}>×</button></span>
        {/each}
      </div>
    </div>
    <input type="search" bind:value={find} placeholder="Find a brand to add" aria-label="Find a brand" autocomplete="off" />
    {#if find.trim()}
      {#if !brandData}
        <p class="hint">Loading the brand list…</p>
      {:else if results.length}
        <ul class="brand-list" aria-label="Brands to add">
          {#each results as b (b)}
            <li>
              <button type="button" class="brand-row" aria-label={`Add ${b}`} onclick={() => addBrand(b)}>
                <span class="plus" aria-hidden="true">+</span>
                <span class="bname">{b}</span>
                {#if hasColors(b)}<span class="tagline">colors</span>{/if}
              </button>
            </li>
          {/each}
        </ul>
      {:else}
        <p class="hint">No other brands start with “{find.trim()}”.</p>
      {/if}
      {#if addOwn}
        <button type="button" class="btn small" onclick={addOwnBrand}>Add “{addOwn}” as your own brand</button>
      {/if}
    {/if}
    <p class="hint small">“colors” brands have colors under Brand in the color card.</p>
    <div class="actions">
      <button type="button" class="btn small quiet" onclick={resetBrands}>Show the default brands</button>
    </div>
    </div>
  </details>

  <details class="card" open={open.includes('materials')} ontoggle={(e) => toggled('materials', e)}>
    <summary><h2 id="set-materials">Materials</h2></summary>
    <div class="body">
    <p class="hint">The materials on the Material row: × removes one, and the + chips add one back. With a brand picked, the row also leaves out the materials that brand doesn’t make. Anything else can be typed with Other… on the form.</p>
    <div class="group" role="group" aria-label="Materials on the form">
      <div class="chips">
        {#each shownMaterials as m (m)}
          <span class="mine b" class:own={isOwnMaterial(m)}>{m}<button type="button" class="x" aria-label={`Hide ${m}`} onclick={() => setMaterials(MaterialList.remove(shownMaterials, m))}>×</button></span>
        {:else}
          <span class="hint">None. The row only has Other….</span>
        {/each}
      </div>
    </div>
    <input type="search" bind:value={findMaterial} placeholder="Find a material to add" aria-label="Find a material" autocomplete="off" />
    {#if hiddenMaterials.length}
      <div class="group" role="group" aria-label="Materials to add">
        <div class="chips">
          {#each hiddenMaterials as m (m)}
            <button type="button" class="chip-add" aria-label={`Add ${m}`} onclick={() => addMaterial(m)}><span aria-hidden="true">+</span> {m}</button>
          {/each}
        </div>
      </div>
    {:else if findMaterial.trim()}
      <p class="hint">No other materials match “{findMaterial.trim()}”.</p>
    {/if}
    {#if addOwnMaterial}
      <button type="button" class="btn small" onclick={addOwnMaterialNow}>Add “{addOwnMaterial}” as your own material</button>
    {/if}
    <div class="actions">
      <button type="button" class="btn small quiet" onclick={resetMaterials}>Show the default materials</button>
    </div>
    </div>
  </details>

  <details class="card" open={open.includes('chips')} ontoggle={(e) => toggled('chips', e)}>
    <summary><h2 id="set-chips">Your chips</h2></summary>
    <div class="body">
    {#if chipCount}
      <p class="hint">Variants you saved. Tap × to remove one.</p>
      {#each variantGroups as g (g.key)}
        <div class="group" role="group" aria-label={`Your variants for ${g.label}`}>
          <span class="label">Variants for {g.label}</span>
          <div class="chips">
            {#each g.list as v (v)}
              <span class="mine">{v}<button type="button" class="x" aria-label={`Remove ${v}`} onclick={() => removeChip('variant', v, g.key)}>×</button></span>
            {/each}
          </div>
        </div>
      {/each}
      <div class="actions">
        <button type="button" class="btn small quiet danger" onclick={clearChips}>Remove all your chips</button>
      </div>
    {:else}
      <p class="hint">None yet. Tap Save next to a Custom variant, or write a tag with one. Brands and materials are above.</p>
    {/if}
    </div>
  </details>

  <details class="card" open={open.includes('saved')} ontoggle={(e) => toggled('saved', e)}>
    <summary><h2 id="set-saved">Saved colors</h2></summary>
    <div class="body">
    {#if savedCount}
      <p class="hint">{savedCount} saved {savedCount === 1 ? 'color' : 'colors'}, kept per brand and material.</p>
      <ul class="saved-list">
        {#each savedGroups as g (g.key)}
          <li>
            <span class="swatches" aria-hidden="true">
              {#each g.list.slice(0, 6) as e}<span style:background={bar(e)}></span>{/each}
            </span>
            <span class="what">{g.label} <span class="n">{g.list.length}</span></span>
            <button type="button" class="btn small quiet danger" aria-label={`Clear ${g.label}`} onclick={() => clearSaved(g.key)}>Clear</button>
          </li>
        {/each}
      </ul>
    {:else}
      <p class="hint">None yet. Colors are saved when you write a tag, or with Save colors under Custom.</p>
    {/if}
    <div class="actions">
      <button type="button" class="btn small" onclick={exportSaved} disabled={!savedCount}>Export saved colors</button>
      <button type="button" class="btn small" onclick={() => importInput?.click()}>Import saved colors</button>
      {#if savedCount}<button type="button" class="btn small quiet danger" onclick={clearAllSaved}>Clear all</button>{/if}
      <input bind:this={importInput} type="file" accept="application/json,.json" class="visually-hidden" tabindex="-1" aria-label="Saved colors file" onchange={importSaved} />
    </div>
    <p class="hint small">Import also takes a list exported from PrintTag-Web-Rrrrobert.</p>
    </div>
  </details>

  <details class="card" open={open.includes('look')} ontoggle={(e) => toggled('look', e)}>
    <summary><h2 id="set-look">Appearance</h2></summary>
    <div class="body">
    <Palette label="Theme" items={THEME_ITEMS} bind:value={theme} allowCustom={false} onpick={pickTheme} />
    </div>
  </details>

  <details class="card about" open={open.includes('about')} ontoggle={(e) => toggled('about', e)}>
    <summary><h2 id="set-about">About</h2></summary>
    <div class="body">
    <p>
      <strong>FilaScribe {__APP_VERSION__}</strong>{#if build.length}{' '}(<span>{#each build as part}{#if part.href}<a href={part.href} target="_blank" rel="noopener">{part.text}</a>{:else}{part.text}{/if}{/each}</span>){/if}
    </p>
    <p>Writes <a href="https://openspool.io/rfid.html" target="_blank" rel="noopener">OpenSpool</a> NFC filament tags, with the <a href="https://github.com/paxx12/SnapmakerU1-Extended-Firmware/blob/main/docs/design/openspool.md" target="_blank" rel="noopener">Snapmaker U1 extended fields</a>.</p>
    <ul class="sources">
      <li>
        Brand colors: <a href={ofd.repo || 'https://github.com/OpenFilamentCollective/open-filament-database'} target="_blank" rel="noopener">Open Filament Database</a>
        {#if ofd.commit}(<a href={`${ofd.repo}/commit/${ofd.commit}`} target="_blank" rel="noopener">{short(ofd.commit)}</a>, {ofd.date}){/if}
      </li>
      <li>
        Brand names: <a href="https://github.com/SoftFever/OrcaSlicer/tree/main/resources/profiles" target="_blank" rel="noopener">OrcaSlicer’s filament profiles</a>
        {#if orca.source?.commit}(<a href={`https://github.com/${orca.source.repo}/commit/${orca.source.commit}`} target="_blank" rel="noopener">{short(orca.source.commit)}</a>, {orca.source.date}){/if}
      </li>
      <li>Source code: <a href={`https://github.com/${repo}`} target="_blank" rel="noopener">{repo}</a></li>
    </ul>
    </div>
  </details>
</div>

<style>
  .settings { display: grid; gap: var(--s3); margin-top: var(--s4); }
  .card {
    padding: 0 var(--s4);
    border: 1px solid var(--line);
    border-radius: 14px;
    background: var(--surface);
  }
  summary {
    display: flex;
    align-items: center;
    min-height: 56px;
    cursor: pointer;
    list-style: none;
  }
  summary::-webkit-details-marker { display: none; }
  summary::after {
    content: '';
    margin-left: auto;
    width: 9px;
    height: 9px;
    border-right: 2px solid var(--muted);
    border-bottom: 2px solid var(--muted);
    transform: rotate(45deg) translate(-2px, -2px);
    transition: transform 0.15s ease;
  }
  details[open] > summary::after { transform: rotate(-135deg) translate(-2px, -2px); }
  .body { display: grid; gap: var(--s3); padding-bottom: var(--s4); }
  h2 { margin: 0; font-family: var(--font-label); font-size: 1.25rem; }
  .body > .hint, .body > p { margin: 0; }
  .small { font-size: 0.8125rem; }
  .actions { display: flex; flex-wrap: wrap; gap: var(--s2); align-items: center; }

  .rows { display: grid; gap: 2px; margin: 0; }
  .rows div { display: flex; justify-content: space-between; gap: var(--s3); padding: 6px 0; border-bottom: 1px solid var(--line); }
  .rows div:last-child { border-bottom: 0; }
  dt { color: var(--muted); }
  dd { margin: 0; font-family: var(--font-label); font-weight: 600; text-align: right; overflow-wrap: anywhere; }

  .group { display: grid; gap: var(--s1); }
  .chips { display: flex; flex-wrap: wrap; gap: var(--s2); }
  .mine {
    display: inline-flex;
    align-items: center;
    gap: 2px;
    min-height: 36px;
    padding: 0 2px 0 var(--s3);
    border: 2px dashed var(--muted);
    border-radius: 999px;
    font-family: var(--font-label);
    font-weight: 500;
  }
  .mine.fixed { padding-right: var(--s3); border-style: solid; border-color: var(--line); color: var(--muted); }
  .mine.b:not(.own) { border-style: solid; border-color: var(--line); }
  .x {
    width: 32px;
    height: 32px;
    border: 0;
    border-radius: 50%;
    background: transparent;
    color: var(--muted);
    font-size: 1.25rem;
    line-height: 1;
  }

  .chip-add {
    min-height: 36px;
    padding: 0 var(--s3);
    border: 2px solid var(--line);
    border-radius: 999px;
    background: transparent;
    font: inherit;
    font-family: var(--font-label);
    font-weight: 500;
    color: var(--ink);
  }
  .chip-add span { color: var(--action); font-weight: 700; }

  .brand-list { list-style: none; margin: 0; padding: 0; display: grid; }
  .brand-row {
    display: flex;
    align-items: center;
    gap: var(--s3);
    width: 100%;
    min-height: 44px;
    padding: 0 var(--s1);
    border: 0;
    border-bottom: 1px solid var(--line);
    background: transparent;
    text-align: left;
    font: inherit;
    color: var(--ink);
  }
  .plus {
    display: grid;
    place-items: center;
    flex: none;
    width: 26px;
    height: 26px;
    border-radius: 50%;
    background: var(--chip);
    color: var(--action);
    font-size: 1.125rem;
    font-weight: 700;
    line-height: 1;
  }
  .bname { flex: 1; min-width: 0; font-family: var(--font-label); font-weight: 600; overflow-wrap: anywhere; }
  .tagline { font-size: 0.75rem; color: var(--muted); }

  .saved-list { list-style: none; margin: 0; padding: 0; display: grid; gap: var(--s1); }
  .saved-list li { display: flex; align-items: center; gap: var(--s3); padding: 4px 0; border-bottom: 1px solid var(--line); }
  .saved-list li:last-child { border-bottom: 0; }
  .swatches { display: flex; flex: none; }
  .swatches span {
    width: 18px;
    height: 18px;
    border-radius: 50%;
    margin-right: -5px;
    box-shadow: 0 0 0 2px var(--surface), inset 0 0 0 1px rgba(0, 0, 0, 0.2);
  }
  .what { flex: 1; min-width: 0; padding-left: 6px; font-family: var(--font-label); font-weight: 600; overflow-wrap: anywhere; }
  .n { margin-left: 4px; padding: 0 6px; border-radius: 999px; background: var(--chip); color: var(--muted); font-size: 0.8125rem; }

  .about a { color: var(--action); }
  .sources { margin: 0; padding-left: 1.2em; display: grid; gap: var(--s1); color: var(--muted); }
</style>
