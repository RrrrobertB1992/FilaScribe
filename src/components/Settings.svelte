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
  import { suggestBrands, canonicalBrand, findBrand } from '../lib/brandColors.js';
  import orca from '../data/orca-vendors.json';

  let {
    form, // the form on screen (Create or a read tag), for "Use the form"
    defaults = $bindable({}),
    chips = $bindable({ brands: [], materials: [], variants: {} }),
    shownBrands = $bindable([...BrandList.DEFAULT]),
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

  const PAGE = 30;
  let find = $state('');
  let listed = $state(PAGE);
  const known = (b) => !!(brandData && findBrand(brandData, b));
  const hasColors = (b) => Object.keys(findBrand(brandData, b)?.materials || {}).length > 0;
  const allBrands = $derived(
    brandData ? [...brandData.brands.map((b) => b.name)].sort((a, b) => a.localeCompare(b, 'en', { sensitivity: 'base' })) : [],
  );
  const results = $derived.by(() => {
    const q = find.trim();
    if (!q) return allBrands;
    const own = shownBrands.filter((b) => !known(b) && b.toLowerCase().includes(q.toLowerCase()));
    return [...new Set([...suggestBrands(brandData, q, 40), ...own])];
  });
  // A typed name nobody lists can be added as your own
  const addOwn = $derived.by(() => {
    const q = find.trim();
    if (!q || q.length > 40 || q.toLowerCase() === 'generic') return '';
    const name = canonicalBrand(brandData, q);
    return results.includes(name) || shownBrands.includes(name) ? '' : name;
  });

  function setBrands(next) {
    if (next === shownBrands) return;
    shownBrands = next;
    BrandList.store(shownBrands);
  }

  function addOwnBrand() {
    setBrands(BrandList.add(shownBrands, addOwn));
    find = '';
  }

  function resetBrands() {
    if (!confirm('Show the default brands again? Brands you turned on are turned off.')) return;
    setBrands([...BrandList.DEFAULT]);
  }

  // --- Your chips ---

  const variantGroups = $derived(Object.entries(chips.variants).map(([key, list]) => ({ key, label: key.replace('|', ' '), list })));
  const chipCount = $derived(chips.materials.length + variantGroups.reduce((n, g) => n + g.list.length, 0));

  function removeChip(kind, value, key = '') {
    const [brand, type] = key ? key.split('|') : ['', ''];
    chips = CustomChips.remove(chips, kind, value, { brand, type });
    CustomChips.store(chips);
  }

  function clearChips() {
    if (!confirm('Remove all your chips? Built-in chips stay.')) return;
    chips = { ...chips, materials: [], variants: {} };
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
  <section class="card" aria-labelledby="set-defaults">
    <h2 id="set-defaults">Defaults for new tags</h2>
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
  </section>

  <section class="card" aria-labelledby="set-brands">
    <h2 id="set-brands">Brands</h2>
    <p class="hint">The brands on the Brand row. Anything else can be typed with Other… on the form.</p>
    <div class="group" role="group" aria-label="Brands on the form">
      <div class="chips">
        <span class="mine fixed">Generic</span>
        {#each shownBrands as b (b)}
          <span class="mine b" class:own={!known(b)}>{b}<button type="button" class="x" aria-label={`Hide ${b}`} onclick={() => setBrands(BrandList.remove(shownBrands, b))}>×</button></span>
        {/each}
      </div>
    </div>
    <input type="search" bind:value={find} placeholder="Find a brand" aria-label="Find a brand" autocomplete="off" oninput={() => (listed = PAGE)} />
    {#if !brandData}
      <p class="hint">Loading the brand list…</p>
    {:else if results.length}
      <ul class="brand-list" aria-label="All brands">
        {#each results.slice(0, listed) as b (b)}
          {@const on = shownBrands.includes(b)}
          <li>
            <button type="button" class="brand-row" role="switch" aria-checked={on} onclick={() => setBrands(BrandList.toggle(shownBrands, b))}>
              <span class="switch" aria-hidden="true"></span>
              <span class="bname">{b}</span>
              {#if known(b) && hasColors(b)}<span class="tagline">colors</span>{:else if !known(b)}<span class="tagline">yours</span>{/if}
            </button>
          </li>
        {/each}
      </ul>
      {#if results.length > listed}
        <button type="button" class="btn small quiet" onclick={() => (listed += PAGE)}>Show {Math.min(PAGE, results.length - listed)} more ({results.length - listed} left)</button>
      {/if}
    {:else}
      <p class="hint">No brands match “{find}”.</p>
    {/if}
    {#if addOwn}
      <button type="button" class="btn small" onclick={addOwnBrand}>Add “{addOwn}” as your own brand</button>
    {/if}
    <p class="hint small">“colors” brands have colors under Brand in the color card.</p>
    <div class="actions">
      <button type="button" class="btn small quiet" onclick={resetBrands}>Show the default brands</button>
    </div>
  </section>

  <section class="card" aria-labelledby="set-chips">
    <h2 id="set-chips">Your chips</h2>
    {#if chipCount}
      <p class="hint">Custom values you saved. Tap × to remove one.</p>
      {#each [['Materials', 'material', chips.materials]] as [title, kind, list]}
        {#if list.length}
          <div class="group" role="group" aria-label={`Your ${title.toLowerCase()}`}>
            <span class="label">{title}</span>
            <div class="chips">
              {#each list as v (v)}
                <span class="mine">{v}<button type="button" class="x" aria-label={`Remove ${v}`} onclick={() => removeChip(kind, v)}>×</button></span>
              {/each}
            </div>
          </div>
        {/if}
      {/each}
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
      <p class="hint">None yet. Tap Save next to a Custom material or variant, or write a tag with one. Brands are above.</p>
    {/if}
  </section>

  <section class="card" aria-labelledby="set-saved">
    <h2 id="set-saved">Saved colors</h2>
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
  </section>

  <section class="card" aria-labelledby="set-look">
    <h2 id="set-look">Appearance</h2>
    <Palette label="Theme" items={THEME_ITEMS} bind:value={theme} allowCustom={false} onpick={pickTheme} />
  </section>

  <section class="card about" aria-labelledby="set-about">
    <h2 id="set-about">About</h2>
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
  </section>
</div>

<style>
  .settings { display: grid; gap: var(--s4); margin-top: var(--s4); }
  .card {
    display: grid;
    gap: var(--s3);
    padding: var(--s4);
    border: 1px solid var(--line);
    border-radius: 14px;
    background: var(--surface);
  }
  h2 { margin: 0; font-family: var(--font-label); font-size: 1.25rem; }
  .card > .hint, .card > p { margin: 0; }
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
  .switch {
    position: relative;
    flex: none;
    width: 38px;
    height: 22px;
    border-radius: 999px;
    background: var(--chip);
    box-shadow: inset 0 0 0 1px var(--line);
    transition: background 0.15s ease;
  }
  .switch::after {
    content: '';
    position: absolute;
    top: 3px;
    left: 3px;
    width: 16px;
    height: 16px;
    border-radius: 50%;
    background: var(--muted);
    transition: transform 0.15s ease, background 0.15s ease;
  }
  .brand-row[aria-checked='true'] .switch { background: var(--action); box-shadow: none; }
  .brand-row[aria-checked='true'] .switch::after { transform: translateX(16px); background: var(--action-ink); }
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
