<script>
  // The Settings tab: defaults for new tags, your chips and saved colors,
  // appearance, and about.
  import Palette from './Palette.svelte';
  import { fold, getSpeed, setSpeed } from '../lib/motion.js';
  import * as OpenSpool from '../lib/formats/openspool.js';
  import * as Defaults from '../lib/defaults.js';
  import * as CustomChips from '../lib/customChips.js';
  import * as SC from '../lib/savedColors.js';
  import * as Filaments from '../lib/filaments.js';
  import * as Manual from '../lib/manualColors.js';
  import { getEdits, removeEdit, clearEdits, importEdits, replaceEdits } from '../lib/manualColorsStore.svelte.js';
  import * as Theme from '../lib/theme.js';
  import { getSuggestionCount, setSuggestionCount } from '../lib/suggestionCountStore.svelte.js';
  import { getCloseness, setCloseness } from '../lib/suggestionClosenessStore.svelte.js';
  import { exportJson, readJsonFile } from '../lib/backup.js';
  import * as Backup from '../lib/backup.js';
  import { Capacitor } from '@capacitor/core';
  import { buildParts } from '../lib/buildInfo.js';
  import * as BrandList from '../lib/brandList.js';
  import * as MaterialList from '../lib/materialList.js';
  import * as VariantList from '../lib/variantList.js';
  import { MATERIALS, VARIANT_INFO } from '../lib/catalog.js';
  import { findBrands, canonicalBrand, findBrand, variantKinds } from '../lib/brandColors.js';
  import * as ColorDb from '../lib/colorDatabase.js';
  import { loadSource, reloadBrandColors } from '../lib/brandColorsData.js';

  let {
    form, // the form on screen (Create or a read tag), for "Use the form"
    defaults = $bindable({}),
    chips = $bindable({ brands: [], materials: [], variants: {} }),
    shownBrands = $bindable([...BrandList.DEFAULT]),
    shownMaterials = $bindable([...MaterialList.DEFAULT]),
    hiddenVariants = $bindable([]),
    filaments = $bindable([]),
    autoFilaments = $bindable(false),
    brandData = null,
    onbranddata = () => {}, // the database in use changed (updated or back to built-in)
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

  // --- Variants ---

  let findVariant = $state('');
  // One card per kind of variant your enabled brands make in the materials you
  // show (worked out when the card is open). Already-hidden ones are always listed.
  const kinds = $derived(
    brandData && group === 'form' && open.includes('variants') ? variantKinds(brandData, shownBrands, shownMaterials, hiddenVariants) : [],
  );
  const kindMatch = (k) => {
    const q = findVariant.trim().toLowerCase();
    return !q || [k.main, ...k.others].some((n) => n.toLowerCase().includes(q));
  };
  const kindCards = $derived(kinds.filter((k) => !k.hardness && kindMatch(k)));
  const hardnessChips = $derived(kinds.filter((k) => k.hardness && kindMatch(k)));
  const hiddenCount = $derived(kinds.filter((k) => VariantList.isHidden(hiddenVariants, k.main)).length);
  const hasOwnBrand = $derived(shownBrands.some((b) => brandData && findBrand(brandData, b)));

  function setHiddenVariants(next) {
    if (next === hiddenVariants) return;
    hiddenVariants = next;
    VariantList.store(hiddenVariants);
  }

  // The brands' own words, without any the description already says (Glass Fiber under GF)
  const othersOf = (k) => k.others.filter((o) => !(VARIANT_INFO[k.main] || '').toLowerCase().startsWith(o.toLowerCase()));
  const toggleVariant = (k) => setHiddenVariants(VariantList.toggle(hiddenVariants, k.main));
  const hideEveryVariant = () => setHiddenVariants(VariantList.hideAll(hiddenVariants, kinds.map((k) => k.main)));
  const showEveryVariant = () => setHiddenVariants([]);

  // --- Groups: Settings opens to a short menu, and a group opens its cards ---

  const GROUPS = [
    { id: 'form', title: 'Your choices on the form', cards: 'Defaults, Brands, Materials, Variants, Your chips' },
    { id: 'data', title: 'Your saved data', cards: 'My filaments, Saved colors, Backup' },
    { id: 'colors', title: 'Brand colors', cards: 'Color database, Color overrides, Closest brand colors' },
    { id: 'app', title: 'App', cards: 'Appearance, About' },
  ];
  let group = $state(null); // the group on screen; null is the menu

  function showGroup(id) {
    group = id;
    restoring = null; // a half-finished restore doesn't wait behind another page
    // The new page starts at the top, not where the menu was scrolled to
    globalThis.scrollTo?.(0, 0);
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

  // --- Color overrides ---

  let overridesInput = $state();
  const overrides = $derived(Manual.report(brandData, getEdits()));
  const describeOverride = (o) => (o.line === Manual.ALL_LINES ? `${o.brand} · ${o.material} · all lines · ${o.color}` : `${o.brand} · ${o.material} · ${o.line} · ${o.color}`);
  const hexText = (h) => h.split(',').map((x) => `#${x}`).join(' + ');
  // Several colors side by side in one dot, like the Saved colors rows
  const dot = (h) => {
    const list = h.split(',').map((x) => `#${x}`);
    if (list.length === 1) return list[0];
    const step = 100 / list.length;
    return `linear-gradient(to right, ${list.map((c, i) => `${c} ${i * step}% ${(i + 1) * step}%`).join(', ')})`;
  };

  function resetOverride(o) {
    if (!confirm(`Put ${describeOverride(o)} back to the database color ${hexText(o.was)}?`)) return;
    removeEdit(o);
  }

  function clearOverrides() {
    const n = getEdits().length;
    if (!confirm(`Remove all ${n} color ${n === 1 ? 'override' : 'overrides'} and go back to the database colors?`)) return;
    clearEdits();
  }

  async function exportOverrides() {
    const r = await exportJson(getEdits(), 'filascribe-color-overrides.json');
    if (r.message) onstatus(r.ok ? `Color overrides copied. ${r.message.replace(/^Copied\. /, '')}` : 'Couldn’t copy the color overrides.', !r.ok);
  }

  async function importOverrides(e) {
    const file = e.currentTarget.files?.[0];
    e.currentTarget.value = '';
    if (!file) return;
    try {
      const added = importEdits(await readJsonFile(file));
      onstatus(added ? `Imported ${added} color ${added === 1 ? 'override' : 'overrides'}.` : 'Nothing new to import.');
    } catch {
      onstatus('That file isn’t a color overrides export.', true);
    }
  }

  // --- Color database ---

  let dbBusy = $state(false);
  // raw: it holds a whole database, which must not be wrapped in reactive proxies (it is saved to the device as it is)
  let dbCheck = $state.raw(null); // the last check: { status: 'current' } or { status: 'update', ... }
  let dbError = $state('');
  let dbShowChanges = $state(false);
  let dbChecked = $state(ColorDb.loadChecked());
  const dbInfo = $derived(brandData?.info || null);
  const dbOld = $derived(!!dbInfo && ColorDb.isOld(dbInfo.date));
  const dbSummary = $derived(dbCheck?.status === 'update' ? ColorDb.summarize(dbCheck.changes) : null);
  const plural = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
  const dbWhen = (iso) => (iso ? new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }) : 'Never');

  const dbSummaryText = $derived.by(() => {
    if (!dbSummary) return '';
    const s = dbSummary;
    return [
      s.newBrands && plural(s.newBrands, 'new brand'),
      s.added && plural(s.added, 'new color'),
      s.changed && plural(s.changed, 'color') + ' changed',
      (s.removed || s.goneBrands) && `${s.removed} removed`,
    ]
      .filter(Boolean)
      .join(', ') || 'Brand names changed';
  });

  const overridesText = $derived.by(() => {
    const o = dbCheck?.overrides;
    if (!o || (!o.changed && !o.gone)) return '';
    const parts = [o.changed && `${o.changed} with a new database color`, o.gone && `${o.gone} no longer in the database`].filter(Boolean);
    return `${plural(o.changed + o.gone, 'color override affected', 'color overrides affected')}: ${parts.join(', ')}. They stay as they are.`;
  });

  // "See changes": brands that changed, each with its colors (capped so it stays quick)
  const BRAND_LIMIT = 60;
  const COLOR_LIMIT = 40;
  const changeList = $derived.by(() => {
    if (dbCheck?.status !== 'update') return { brands: [], more: 0 };
    const all = [...dbCheck.changes.brands].sort((a, b) => a[0].localeCompare(b[0], 'en', { sensitivity: 'base' }));
    const brands = all.slice(0, BRAND_LIMIT).map(([name, c]) => {
      const rows = [
        ...c.added.map((x) => ({ kind: 'New', text: `${x.name} (${x.where})` })),
        ...c.changed.map((x) => ({ kind: 'Changed', text: `${x.name} (${x.where}): ${x.oldHex ? hexText(x.oldHex) : 'no color'} → ${x.hex ? hexText(x.hex) : 'no color'}` })),
        ...c.removed.map((x) => ({ kind: 'Removed', text: `${x.name} (${x.where})` })),
      ];
      return { name, count: rows.length, rows: rows.slice(0, COLOR_LIMIT), more: Math.max(0, rows.length - COLOR_LIMIT) };
    });
    return { brands, more: Math.max(0, all.length - BRAND_LIMIT) };
  });

  async function checkDatabase() {
    if (dbBusy) return;
    dbBusy = true;
    dbError = '';
    dbShowChanges = false;
    dbCheck = null;
    try {
      dbCheck = await ColorDb.checkForUpdate(await loadSource(), { edits: getEdits() });
      dbChecked = new Date().toISOString();
      ColorDb.storeChecked(dbChecked);
    } catch (e) {
      dbError = e instanceof ColorDb.UpdateError ? e.message : 'Couldn’t check for updates. Try again.';
    } finally {
      dbBusy = false;
    }
  }

  async function updateDatabase() {
    if (dbBusy || dbCheck?.status !== 'update') return;
    dbBusy = true;
    dbError = '';
    const date = dbCheck.info.date;
    try {
      await ColorDb.applyUpdate(dbCheck.next);
      onbranddata(await reloadBrandColors());
      dbCheck = null;
      dbShowChanges = false;
      onstatus(`Brand colors updated to ${date}.`);
    } catch (e) {
      dbError = e instanceof ColorDb.UpdateError ? e.message : 'Couldn’t update. Nothing was changed.';
    } finally {
      dbBusy = false;
    }
  }

  async function goBackToBuiltIn() {
    if (dbBusy || !confirm('Go back to the brand colors built into the app? Your saved colors and color overrides stay.')) return;
    dbBusy = true;
    dbError = '';
    try {
      await ColorDb.useBuiltIn();
      onbranddata(await reloadBrandColors());
      dbCheck = null;
      dbShowChanges = false;
      onstatus('Using the brand colors built into the app.');
    } catch (e) {
      dbError = e instanceof ColorDb.UpdateError ? e.message : 'Couldn’t go back. Try again.';
    } finally {
      dbBusy = false;
    }
  }

  // --- My filaments ---

  let filamentsInput = $state();

  function setAuto(e) {
    autoFilaments = e.currentTarget.checked;
    Filaments.storeAuto(autoFilaments);
  }

  function clearFilaments() {
    if (!confirm(`Remove all ${filaments.length} saved ${filaments.length === 1 ? 'filament' : 'filaments'} from My filaments?`)) return;
    filaments = [];
    Filaments.store(filaments);
  }

  async function exportFilaments() {
    const r = await exportJson(filaments, 'filascribe-my-filaments.json');
    if (r.message) onstatus(r.ok ? `My filaments copied. ${r.message.replace(/^Copied\. /, '')}` : 'Couldn’t copy My filaments.', !r.ok);
  }

  async function importFilaments(e) {
    const file = e.currentTarget.files?.[0];
    e.currentTarget.value = '';
    if (!file) return;
    try {
      const r = Filaments.importInto(filaments, await readJsonFile(file));
      filaments = r.list;
      Filaments.store(filaments);
      onstatus(r.added ? `Imported ${r.added} ${r.added === 1 ? 'filament' : 'filaments'}.` : 'Nothing new to import.');
    } catch {
      onstatus('That file isn’t a My filaments export.', true);
    }
  }

  // --- Backup ---

  let backupInput = $state();
  let restoring = $state(null); // { name, rows, data } once a backup file is chosen
  const counts = $derived(Backup.totals({ filaments, savedColors: saved, colorOverrides: getEdits(), customChips: chips }));

  async function saveBackup() {
    const r = await Backup.saveBackup();
    if (!r.ok) onstatus(r.message, true);
    else if (!Capacitor.isNativePlatform()) onstatus('Backup saved to your downloads.');
  }

  async function chooseBackup(e) {
    const file = e.currentTarget.files?.[0];
    e.currentTarget.value = '';
    if (!file) return;
    try {
      const data = Backup.parse(await readJsonFile(file));
      restoring = { name: file.name, rows: Backup.summary(Backup.snapshot(), data), data };
    } catch (err) {
      restoring = null;
      onstatus(err?.message === 'Newer backup' ? 'That backup is from a newer version of FilaScribe. Update the app first.' : 'That file isn’t a FilaScribe backup.', true);
    }
  }

  // Put a snapshot on screen: everything shown here and on the other tabs is held in state
  function showRestored(d) {
    filaments = d.filaments;
    autoFilaments = d.autoFilaments;
    saved = d.savedColors;
    replaceEdits(d.colorOverrides);
    chips = d.customChips;
    shownBrands = d.brands;
    shownMaterials = d.materials;
    hiddenVariants = d.hiddenVariants;
    defaults = d.defaults;
    suggestCount = String(d.closestColors);
    setSuggestionCount(d.closestColors);
    closeness = d.closestCloseness;
    setCloseness(d.closestCloseness);
    theme = d.theme;
    Theme.apply(d.theme);
    speed = d.motionSpeed;
    setSpeed(d.motionSpeed);
  }

  function restore(replace) {
    if (!restoring) return;
    if (replace && !confirm('Replace everything on this device with this backup? Your filaments, saved colors, color overrides, chips and settings now will be deleted. This can’t be undone.')) return;
    const data = replace ? restoring.data : Backup.merge(Backup.snapshot(), restoring.data);
    Backup.apply(data);
    showRestored(Backup.snapshot());
    const added = restoring.rows.reduce((n, r) => n + r.added, 0);
    restoring = null;
    onstatus(replace ? 'Backup restored. Everything now matches it.' : added ? `Backup restored. Added ${added} new ${added === 1 ? 'item' : 'items'}.` : 'Backup restored. Nothing was new.');
  }

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
  let speed = $state(getSpeed());
  const SPEED_ITEMS = [
    { value: 'fast', label: 'Fast' },
    { value: 'normal', label: 'Normal' },
    { value: 'slow', label: 'Slow' },
  ];

  // --- Closest brand colors ---

  let suggestCount = $state(String(getSuggestionCount()));
  const SUGGEST_ITEMS = [
    { value: '0', label: 'Off' },
    ...[1, 2, 3, 4, 5].map((n) => ({ value: String(n), label: String(n) })),
  ];
  const pickSuggestCount = (v) => setSuggestionCount(Number(v));
  let closeness = $state(getCloseness());
  const CLOSENESS_ITEMS = [
    { value: 'strict', label: 'Strict' },
    { value: 'normal', label: 'Normal' },
    { value: 'loose', label: 'Loose' },
  ];

  // --- About ---

  const build = buildParts(__BUILD__);
  const repo = __BUILD__.repo || 'RrrrobertB1992/FilaScribe';
  const ofd = $derived(brandData?.source || {});
  const orca = $derived({ source: { repo: dbInfo?.orcaRepo, commit: dbInfo?.orcaCommit, date: dbInfo?.orcaDate } });
  const short = (sha) => String(sha || '').slice(0, 7);
</script>

<div class="settings">
  {#if !group}
    <nav class="menu" aria-label="Settings groups">
      {#each GROUPS as g (g.id)}
        <button type="button" class="menu-row" onclick={() => showGroup(g.id)}>
          <span class="menu-text">
            <strong>{g.title}{#if g.id === 'colors' && dbOld}<span class="tag">Out of date</span>{/if}</strong>
            <span class="hint small">{g.cards}</span>
          </span>
        </button>
      {/each}
    </nav>
  {:else}
    <button type="button" class="btn small back" onclick={() => showGroup(null)}>‹ Settings</button>
    <h2 class="group-title" id="set-group">{GROUPS.find((g) => g.id === group)?.title}</h2>
    {#if group === 'form'}
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
      <button type="button" class="btn small" onclick={resetDefaults} disabled={!hasDefaults}>Reset to built-in</button>
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
      <button type="button" class="btn small" onclick={resetBrands}>Show the default brands</button>
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
      <button type="button" class="btn small" onclick={resetMaterials}>Show the default materials</button>
    </div>
    </div>
  </details>

  <details class="card" open={open.includes('variants')} ontoggle={(e) => toggled('variants', e)}>
    <summary><h2 id="set-variants">Variants</h2></summary>
    <div class="body">
    <p class="hint">The variants your brands make, in the materials you show. Tap a tile to hide it from the Variant row, or to show it again. A tile is one kind: the names under it are the brands’ own words for it, so they hide together. Generic and brands not in the database always show the default variants. None, your saved variants and Custom aren’t affected.</p>
    {#if !brandData}
      <p class="hint">Loading the variant list…</p>
    {:else if !kinds.length}
      <p class="hint">{hasOwnBrand ? 'Your brands have no variants in the materials you show.' : 'None of your brands has variants of its own yet. Add a brand under Brands, and the variants it makes are listed here.'}</p>
    {:else}
      <input type="search" bind:value={findVariant} placeholder="Find a variant" aria-label="Find a variant" autocomplete="off" />
      <div class="actions">
        <button type="button" class="btn small" onclick={showEveryVariant} disabled={!hiddenVariants.length}>Show all</button>
        <button type="button" class="btn small" onclick={hideEveryVariant} disabled={hiddenCount === kinds.length}>Hide all</button>
      </div>
      <p class="hint small" aria-live="polite">{kinds.length} {kinds.length === 1 ? 'kind' : 'kinds'} · {hiddenCount} hidden</p>
      <div class="vcards" role="group" aria-label="Variants">
        {#each kindCards as k (k.main)}
          {@const off = VariantList.isHidden(hiddenVariants, k.main)}
          <button type="button" class="vcard" class:off aria-pressed={!off} aria-label={k.main} aria-description={[VARIANT_INFO[k.main], ...othersOf(k)].filter(Boolean).join(', ')} onclick={() => toggleVariant(k)}>
            <span class="vtop">
              <span class="vswitch" aria-hidden="true"><span class="knob"></span></span>
              <span class="vstate">{off ? 'Hidden' : 'Shown'}</span>
            </span>
            <span class="vmain">{k.main}</span>
            {#if VARIANT_INFO[k.main]}<span class="vinfo">{VARIANT_INFO[k.main]}</span>{/if}
            {#each othersOf(k) as o (o)}<span class="vsub">{o}</span>{/each}
            {#if k.unused}<span class="vsub note">None of your brands make it</span>{/if}
          </button>
        {/each}
        {#if !kindCards.length && !hardnessChips.length}
          <p class="hint">No variants match “{findVariant.trim()}”.</p>
        {/if}
      </div>
      {#if hardnessChips.length}
        <div class="group" role="group" aria-label="TPU hardness">
          <span class="label">Hardness</span>
          <div class="chips">
            {#each hardnessChips as k (k.main)}
              {@const off = VariantList.isHidden(hiddenVariants, k.main)}
              <button type="button" class="hchip" class:off aria-pressed={!off} aria-label={k.main} onclick={() => toggleVariant(k)}>{k.main}</button>
            {/each}
          </div>
        </div>
      {/if}
    {/if}
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
        <button type="button" class="btn small danger" onclick={clearChips}>Remove all your chips</button>
      </div>
    {:else}
      <p class="hint">None yet. Tap Save next to a Custom variant, or write a tag with one. Brands and materials are above.</p>
    {/if}
    </div>
  </details>
    {:else if group === 'data'}
  <details class="card" open={open.includes('filaments')} ontoggle={(e) => toggled('filaments', e)}>
    <summary><h2 id="set-filaments">My filaments</h2></summary>
    <div class="body">
    <p class="hint">
      {filaments.length ? `${filaments.length} saved ${filaments.length === 1 ? 'filament' : 'filaments'}. ` : 'None yet. '}They are listed on Create, where you can search them, fill the form from one, or remove it.
    </p>
    <label class="check">
      <input type="checkbox" checked={autoFilaments} onchange={setAuto} />
      <span>
        <strong>Save every write automatically</strong>
        <span class="hint small">Adds the spool after each written tag, skipping one you already have. Off: you are asked after each write.</span>
      </span>
    </label>
    <div class="actions">
      <button type="button" class="btn small" onclick={exportFilaments} disabled={!filaments.length}>Export My filaments</button>
      <button type="button" class="btn small" onclick={() => filamentsInput?.click()}>Import My filaments</button>
      {#if filaments.length}<button type="button" class="btn small danger" onclick={clearFilaments}>Clear all</button>{/if}
      <input bind:this={filamentsInput} type="file" accept="application/json,.json" class="visually-hidden" tabindex="-1" aria-label="My filaments file" onchange={importFilaments} />
    </div>
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
            <button type="button" class="btn small danger" aria-label={`Clear ${g.label}`} onclick={() => clearSaved(g.key)}>Clear</button>
          </li>
        {/each}
      </ul>
    {:else}
      <p class="hint">None yet. Colors are saved when you write a tag, or with Save colors under Custom.</p>
    {/if}
    <div class="actions">
      <button type="button" class="btn small" onclick={exportSaved} disabled={!savedCount}>Export saved colors</button>
      <button type="button" class="btn small" onclick={() => importInput?.click()}>Import saved colors</button>
      {#if savedCount}<button type="button" class="btn small danger" onclick={clearAllSaved}>Clear all</button>{/if}
      <input bind:this={importInput} type="file" accept="application/json,.json" class="visually-hidden" tabindex="-1" aria-label="Saved colors file" onchange={importSaved} />
    </div>
    </div>
  </details>

  <details class="card" open={open.includes('backup')} ontoggle={(e) => toggled('backup', e)}>
    <summary><h2 id="set-backup">Backup</h2></summary>
    <div class="body">
    <p class="hint">Everything you’ve set up in one file: keep it safe, or move it to another phone.</p>
    {#if restoring}
      <p class="backup-file"><strong>{restoring.name}</strong></p>
      <ul class="backup-list">
        {#each restoring.rows as r (r.label)}
          <li><span>{r.label}</span><span>{r.total}{r.added ? ` (${r.added} new)` : ''}</span></li>
        {/each}
        <li><span>Settings and theme</span><span>from the file</span></li>
      </ul>
      <div class="actions">
        <button type="button" class="btn small primary" onclick={() => restore(false)}>Add what’s new</button>
        <button type="button" class="btn small" onclick={() => (restoring = null)}>Cancel</button>
        <button type="button" class="btn small danger" onclick={() => restore(true)}>Replace everything</button>
      </div>
      <p class="hint small">Add what’s new keeps everything you have. Replace everything deletes what’s on this device first, and asks you to confirm.</p>
    {:else}
      <ul class="backup-list">
        {#each counts as r (r.label)}
          <li><span>{r.label}</span><span>{r.total}</span></li>
        {/each}
        <li><span>Brands, materials, variants</span><span>your choices</span></li>
        <li><span>Defaults and other settings</span><span>yes</span></li>
      </ul>
      <div class="actions">
        <button type="button" class="btn small primary" onclick={saveBackup}>Save backup</button>
        <button type="button" class="btn small" onclick={() => backupInput?.click()}>Restore backup</button>
        <input bind:this={backupInput} type="file" accept="application/json,.json" class="visually-hidden" tabindex="-1" aria-label="Backup file" onchange={chooseBackup} />
      </div>
      <p class="hint small">App: opens the share sheet, so you can save it to Files or Drive. Website: downloads a file.</p>
    {/if}
    </div>
  </details>
    {:else if group === 'colors'}
  <details class="card" open={open.includes('colordb')} ontoggle={(e) => toggled('colordb', e)}>
    <summary><h2 id="set-colordb">Color database</h2>{#if dbOld}<span class="tag">Out of date</span>{/if}</summary>
    <div class="body">
    {#if !dbInfo}
      <p class="hint">Loading…</p>
    {:else}
      <div class="tiles">
        <div class="tile"><span class="note">Brands</span><strong>{dbInfo.brands.toLocaleString()}</strong></div>
        <div class="tile"><span class="note">Colors</span><strong>{dbInfo.colors.toLocaleString()}</strong></div>
      </div>
      <dl class="rows">
        <div><dt>Database date</dt><dd>{dbInfo.date || 'Unknown'}</dd></div>
        <div><dt>Using</dt><dd>{dbInfo.origin === 'downloaded' ? 'Downloaded copy' : 'Built into the app'}</dd></div>
        <div><dt>Brand names</dt><dd>OrcaSlicer, {dbInfo.orcaDate || 'unknown'}</dd></div>
        <div><dt>Last checked</dt><dd>{dbWhen(dbChecked)}</dd></div>
      </dl>
      {#if dbOld}
        <p class="error-text" transition:fold role="alert">The brand colors are over {ColorDb.MAX_AGE_DAYS} days old. Check for updates.</p>
      {/if}
    {/if}
    {#if dbError}<p class="error-text" transition:fold role="alert">{dbError}</p>{/if}
    {#if dbCheck?.status === 'current'}
      <p class="hint" role="status">You have the newest database.</p>
    {:else if dbCheck?.status === 'update'}
      <div class="notice" role="status">
        <strong>Newer database available</strong>
        <span>{dbCheck.info.date}: {dbSummaryText}</span>
        {#if overridesText}<span class="note warn">{overridesText}</span>{/if}
      </div>
      <div class="actions">
        <button type="button" class="btn small" aria-expanded={dbShowChanges} onclick={() => (dbShowChanges = !dbShowChanges)}>{dbShowChanges ? 'Hide changes' : 'See changes'}</button>
        <button type="button" class="btn small primary" onclick={updateDatabase} disabled={dbBusy}>{dbBusy ? 'Updating…' : 'Update now'}</button>
      </div>
      {#if dbShowChanges}
        <div class="changes">
          {#if dbCheck.changes.newBrands.length}<p class="note">New brands: {dbCheck.changes.newBrands.join(', ')}</p>{/if}
          {#if dbCheck.changes.goneBrands.length}<p class="note">Removed brands: {dbCheck.changes.goneBrands.join(', ')}</p>{/if}
          {#if dbCheck.names.added.length || dbCheck.names.removed.length}
            <p class="note">Brand names: {[dbCheck.names.added.length && `${dbCheck.names.added.length} added`, dbCheck.names.removed.length && `${dbCheck.names.removed.length} removed`].filter(Boolean).join(', ')}</p>
          {/if}
          {#each changeList.brands as b (b.name)}
            <details class="change">
              <summary>{b.name} <span class="note">{plural(b.count, 'change')}</span></summary>
              <ul>
                {#each b.rows as r}<li><span class="kind">{r.kind}</span> {r.text}</li>{/each}
                {#if b.more}<li class="note">and {b.more} more</li>{/if}
              </ul>
            </details>
          {/each}
          {#if changeList.more}<p class="note">and {plural(changeList.more, 'more brand')}</p>{/if}
        </div>
      {/if}
    {/if}
    <div class="actions">
      <button type="button" class="btn small" onclick={checkDatabase} disabled={dbBusy}>{dbBusy && !dbCheck ? 'Checking…' : 'Check for updates'}</button>
      {#if dbInfo?.origin === 'downloaded'}<button type="button" class="btn small" onclick={goBackToBuiltIn} disabled={dbBusy}>Go back to the built-in copy</button>{/if}
    </div>
    <p class="hint small">Your saved colors and color overrides are never changed by an update.</p>
    </div>
  </details>

  <details class="card" open={open.includes('overrides')} ontoggle={(e) => toggled('overrides', e)}>
    <summary><h2 id="set-overrides">Color overrides</h2></summary>
    <div class="body">
    {#if overrides.length}
      <p class="hint">{overrides.length} brand {overrides.length === 1 ? 'color' : 'colors'} with your own hex. Yours always wins over the database.</p>
      <ul class="saved-list">
        {#each overrides as o (describeOverride(o))}
          <li>
            <span class="swatches pair" aria-hidden="true">
              <span style:background={dot(o.was)}></span>
              <span style:background={dot(o.hex)}></span>
            </span>
            <span class="what">
              {describeOverride(o)}
              <span class="note">{hexText(o.was)} → {hexText(o.hex)}</span>
              {#if o.state === 'changed'}<span class="note warn">The database now says {hexText(o.dbNow)}</span>{/if}
              {#if o.state === 'missing'}<span class="note warn">No longer in the database. Reset to remove it.</span>{/if}
            </span>
            <button type="button" class="btn small danger" aria-label={`Reset ${describeOverride(o)}`} onclick={() => resetOverride(o)}>Reset</button>
          </li>
        {/each}
      </ul>
    {:else}
      <p class="hint">None yet. On Create, pick a brand color and tap Override this color to give it your own hex.</p>
    {/if}
    <div class="actions">
      <button type="button" class="btn small" onclick={exportOverrides} disabled={!overrides.length}>Export color overrides</button>
      <button type="button" class="btn small" onclick={() => overridesInput?.click()}>Import color overrides</button>
      {#if overrides.length}<button type="button" class="btn small danger" onclick={clearOverrides}>Clear all</button>{/if}
      <input bind:this={overridesInput} type="file" accept="application/json,.json" class="visually-hidden" tabindex="-1" aria-label="Color overrides file" onchange={importOverrides} />
    </div>
    </div>
  </details>

  <details class="card" open={open.includes('closest')} ontoggle={(e) => toggled('closest', e)}>
    <summary><h2 id="set-closest">Closest brand colors</h2></summary>
    <div class="body">
      <p class="hint">When a color isn’t a brand color, suggest the nearest ones from the brand you picked. Colors from a different color family, like blue and violet, are never suggested, so fewer than this may show.</p>
      <Palette label="How many to show" items={SUGGEST_ITEMS} bind:value={suggestCount} allowCustom={false} onpick={pickSuggestCount} />
      <Palette label="How close" items={CLOSENESS_ITEMS} bind:value={closeness} allowCustom={false} onpick={setCloseness} />
      <p class="hint small">Normal suggests shades that are clearly alike. Strict only suggests near-identical ones. Loose also suggests shades that are a little different.</p>
    </div>
  </details>
    {:else if group === 'app'}
  <details class="card" open={open.includes('look')} ontoggle={(e) => toggled('look', e)}>
    <summary><h2 id="set-look">Appearance</h2></summary>
    <div class="body">
    <Palette label="Theme" items={THEME_ITEMS} bind:value={theme} allowCustom={false} onpick={pickTheme} />
    <Palette label="Animation speed" items={SPEED_ITEMS} bind:value={speed} allowCustom={false} onpick={setSpeed} />
    <p class="hint">How fast cards and editors fold open and shut. Nothing moves if your phone is set to reduce motion.</p>
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
    {/if}
  {/if}
</div>

<style>
  .settings { display: grid; gap: var(--s3); margin-top: var(--s4); }
  .card {
    padding: 0 var(--s4);
    border: 1px solid var(--line);
    border-radius: var(--r-card);
    background: var(--surface);
  }
  summary {
    display: flex;
    align-items: center;
    min-height: var(--h-row);
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
  .menu { display: grid; gap: var(--s3); }
  .menu-row {
    display: flex;
    align-items: center;
    gap: var(--s3);
    width: 100%;
    min-height: 64px;
    padding: var(--s3) var(--s4);
    border: 1px solid var(--line);
    border-radius: var(--r-card);
    background: var(--surface);
    color: var(--ink);
    font: inherit;
    text-align: left;
    cursor: pointer;
  }
  .menu-row::after {
    content: '';
    margin-left: auto;
    flex: none;
    width: 9px;
    height: 9px;
    border-right: 2px solid var(--muted);
    border-bottom: 2px solid var(--muted);
    transform: rotate(-45deg);
  }
  .menu-text { display: grid; gap: 2px; }
  .menu-text strong { font-family: var(--font-label); font-size: 1.25rem; font-weight: 600; }
  .back { justify-self: start; }
  .group-title { font-size: 1.5rem; }
  .small { font-size: 0.8125rem; }
  .check { display: flex; gap: var(--s3); align-items: flex-start; cursor: pointer; }
  .check input { width: 22px; height: 22px; margin-top: 2px; flex: none; accent-color: var(--action); }
  .check span { display: grid; gap: 2px; }
  .backup-file { margin: 0 0 var(--s2); overflow-wrap: anywhere; }
  .backup-list { list-style: none; margin: 0 0 var(--s3); padding: 0; }
  .backup-list li { display: flex; justify-content: space-between; gap: var(--s3); padding: var(--s1) 0; border-bottom: 1px solid var(--line); font-size: 0.9375rem; }
  .backup-list li span:last-child { color: var(--muted); }
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
    min-height: var(--h-small);
    padding: 0 2px 0 var(--s3);
    border: 2px dashed var(--muted);
    border-radius: var(--r-pill);
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
    min-height: var(--h-small);
    padding: 0 var(--s3);
    border: 2px solid var(--line);
    border-radius: var(--r-pill);
    background: transparent;
    font: inherit;
    font-family: var(--font-label);
    font-weight: 500;
    color: var(--ink);
  }
  .chip-add span { color: var(--action); font-weight: 700; }

  .vcards { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: var(--s2); }
  @media (min-width: 640px) { .vcards { grid-template-columns: repeat(3, minmax(0, 1fr)); } }
  .vcard {
    display: grid;
    align-content: start;
    gap: 3px;
    min-width: 0;
    padding: var(--s2) var(--s3) var(--s3);
    border: 2px solid var(--action);
    border-radius: var(--r-card);
    background: var(--surface);
    text-align: left;
    font: inherit;
    color: var(--ink);
  }
  .vtop { display: flex; align-items: center; gap: var(--s2); margin-bottom: 2px; }
  .vswitch {
    position: relative;
    flex: none;
    width: 40px;
    height: 24px;
    border-radius: var(--r-pill);
    background: var(--action);
    transition: background 0.15s;
  }
  .knob {
    position: absolute;
    top: 3px;
    left: 19px;
    width: 18px;
    height: 18px;
    border-radius: 50%;
    background: var(--action-ink);
    transition: left 0.15s;
  }
  .vmain { font-family: var(--font-label); font-weight: 700; font-size: 1.125rem; overflow-wrap: anywhere; }
  .vinfo { font-size: 0.8125rem; line-height: 1.25; color: var(--ink); opacity: 0.85; margin-bottom: 2px; overflow-wrap: anywhere; }
  .vsub { font-size: 0.875rem; color: var(--muted); overflow-wrap: anywhere; }
  .vsub.note { font-style: italic; }
  .vstate { font-family: var(--font-label); font-weight: 700; font-size: 0.8125rem; color: var(--action); }
  .vcard.off { border-style: dashed; border-color: var(--line); background: transparent; opacity: 0.75; }
  .vcard.off .vswitch { background: var(--muted); }
  .vcard.off .knob { left: 3px; }
  .vcard.off .vmain { text-decoration: line-through; }
  .vcard.off .vstate { color: var(--muted); }
  .hchip {
    min-height: var(--h-small);
    padding: 0 var(--s3);
    border: 2px solid var(--action);
    border-radius: var(--r-pill);
    background: var(--surface);
    font: inherit;
    font-family: var(--font-label);
    font-weight: 700;
    color: var(--ink);
  }
  .hchip.off { border-style: dashed; border-color: var(--line); background: transparent; opacity: 0.75; text-decoration: line-through; font-weight: 500; }

  .brand-list { list-style: none; margin: 0; padding: 0; display: grid; }
  .brand-row {
    display: flex;
    align-items: center;
    gap: var(--s3);
    width: 100%;
    min-height: var(--h-control);
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
  .note { display: block; font-family: var(--font-body, inherit); font-weight: 400; font-size: 0.8125rem; color: var(--muted); }
  .note.warn { color: var(--highlight); }
  .swatches.pair span:first-child { outline: 1px dashed var(--muted); outline-offset: 1px; }
  .n { margin-left: 4px; padding: 0 6px; border-radius: var(--r-pill); background: var(--chip); color: var(--muted); font-size: 0.8125rem; }

  .tiles { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: var(--s2); }
  .tile { display: grid; gap: 2px; padding: var(--s2) var(--s3); border: 1px solid var(--line); border-radius: var(--r-control); }
  .tile strong { font-family: var(--font-label); font-size: 1.375rem; }
  .tag { margin-left: var(--s2); padding: 2px 8px; border-radius: var(--r-pill); border: 1px solid var(--danger); color: var(--danger); font-size: 0.75rem; }
  .notice { display: grid; gap: 2px; padding: var(--s3); border: 1px solid var(--action); border-radius: var(--r-control); }
  .changes { display: grid; gap: var(--s2); }
  .changes p { margin: 0; }
  .change { border: 1px solid var(--line); border-radius: var(--r-control); padding: 0 var(--s3); }
  .change summary { min-height: var(--h-control); gap: var(--s2); }
  .change ul { margin: 0 0 var(--s2); padding-left: 1.1em; display: grid; gap: 2px; font-size: 0.875rem; }
  .kind { font-weight: 700; }
  .sources { margin: 0; padding-left: 1.2em; display: grid; gap: var(--s1); color: var(--muted); }
</style>
