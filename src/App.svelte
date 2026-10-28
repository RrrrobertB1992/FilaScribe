<script>
  import { onMount, tick } from 'svelte';
  import Palette from './components/Palette.svelte';
  import ColorSection from './components/ColorSection.svelte';
  import SpoolPreview from './components/SpoolPreview.svelte';
  import NfcSheet from './components/NfcSheet.svelte';
  import TagDetails from './components/TagDetails.svelte';
  import * as OpenSpool from './lib/formats/openspool.js';
  import { MATERIALS, BRANDS, VARIANTS } from './lib/catalog.js';
  import { encodeMessage, mimeRecord, maxMessageSize, NTAG, TNF } from './lib/ndef.js';
  import { getNfc } from './lib/nfc/index.js';
  import { variantChoices, carryVariant, materialChoices, carryMaterial } from './lib/brandColors.js';
  import { loadBrandColors } from './lib/brandColorsData.js';

  const nfc = getNfc();
  const version = `${__APP_VERSION__}${__BUILD_ID__ !== 'dev' ? ` (${__BUILD_ID__})` : ''}`;

  let mode = $state('create'); // 'create' | 'update'
  let form = $state(OpenSpool.emptyForm('u1'));
  let loaded = $state(null); // { tag, raw, unknownKeys, notes } after a read
  let nfcState = $state({ available: true, enabled: true });
  let sheet = $state(null); // { mode: 'read' | 'write', wrongUid }
  let status = $state(null); // { kind: 'ok' | 'error' | 'info', text }
  let showErrors = $state(false);
  let colorSection = $state();

  // Variant chips: the groups this brand has for this material, in its own
  // words; the full default list until the data loads or for other brands
  let brandData = $state(null);
  const variantItems = $derived(variantChoices(brandData, form.brand, form.type));
  // The materials the brand has colors for (every material for Generic or a brand not in the database)
  const materialItems = $derived(materialChoices(brandData, form.brand, form.type));
  const materialsFiltered = $derived(materialItems.length < Object.keys(MATERIALS).length);

  onMount(async () => {
    nfcState = await nfc.status();
  });
  onMount(async () => {
    brandData = await loadBrandColors();
  });

  const u1 = $derived(form.profile === 'u1');
  const errors = $derived(OpenSpool.validate(form));
  const errorFor = (field) => (showErrors ? errors.find((e) => e.field === field)?.message || '' : '');
  const colorErrors = $derived(showErrors ? errors.filter((e) => e.field.startsWith('color')) : []);

  // What goes on the tag, and how much room it takes
  const data = $derived(errors.some((e) => e.field.startsWith('color')) ? null : OpenSpool.build(form));
  const payload = $derived(data ? new TextEncoder().encode(JSON.stringify(data)) : new Uint8Array(0));
  const message = $derived(data ? encodeMessage([mimeRecord(OpenSpool.MIME_TYPE, payload)]) : new Uint8Array(0));
  // Room on the tag for an NDEF message: what the phone reported, else an
  // NTAG215 (the smallest tag OpenSpool supports)
  const capacity = $derived(
    loaded?.tag?.maxNdefSize ?? maxMessageSize((NTAG[loaded?.tag?.chip] || NTAG.NTAG215).userBytes),
  );
  const capacityLabel = $derived(loaded?.tag?.maxNdefSize != null ? 'this tag' : NTAG[loaded?.tag?.chip] ? loaded.tag.chip : 'NTAG215');

  const visibleColors = $derived(OpenSpool.usedColors(form).map((c, i) => c || form.colors[i] || 'FFFFFF'));
  const gradient = $derived(u1 && visibleColors.length > 1 && form.colorType === '0');

  // Changing the brand or material keeps the variant only if it still fits:
  // a chip the new brand has, or its word for the same kind; otherwise None.
  // (Reading a tag never changes it.)
  function keepVariantFitting() {
    form.subtype = carryVariant(brandData, form.subtype, form.brand, form.type);
  }

  // A new brand that doesn't make the material switches to PLA (or the
  // brand's first material), with its temperatures
  function pickBrand() {
    const type = carryMaterial(brandData, form.brand, form.type);
    if (type !== form.type) {
      form.type = type;
      fillTemps(type);
    }
    keepVariantFitting();
  }

  function pickMaterial(value, custom) {
    keepVariantFitting();
    if (!custom) fillTemps(value);
  }

  function fillTemps(type) {
    const preset = MATERIALS[type];
    if (preset) {
      form.minTemp = String(preset.minTemp);
      form.maxTemp = String(preset.maxTemp);
      form.bedMinTemp = String(preset.bedMinTemp);
      form.bedMaxTemp = String(preset.bedMaxTemp);
    }
  }

  function say(text, kind = 'info') {
    status = text ? { text, kind } : null;
  }

  function startOver() {
    form = OpenSpool.emptyForm(form.profile);
    showErrors = false;
    say(null);
  }

  function switchMode(next) {
    if (next === mode) return;
    mode = next;
    say(null);
  }

  async function focusFirstError() {
    await tick();
    const el = document.querySelector('[aria-invalid="true"]');
    if (el) {
      el.focus();
      el.scrollIntoView({ block: 'center' });
    }
  }

  async function cancelNfc() {
    await nfc.cancel();
    sheet = null;
  }

  async function readTag() {
    say(null);
    sheet = { mode: 'read', wrongUid: '' };
    let result;
    try {
      result = await nfc.read();
    } catch (e) {
      sheet = null;
      if (e.code !== 'CANCELLED') say(e.message, 'error');
      return;
    }
    sheet = null;

    const json = result.records.filter((r) => r.tnf === TNF.MIME && r.type.toLowerCase() === OpenSpool.MIME_TYPE);
    let parsed = null;
    let problem = '';
    for (const r of json) {
      try {
        parsed = OpenSpool.decode(r.payload);
        break;
      } catch (e) {
        problem = e.message;
      }
    }

    if (!parsed) {
      loaded = { tag: result.tag, raw: null, unknownKeys: [], notes: [], empty: true };
      if (result.unreadable) say('This tag couldn’t be read as NDEF. It may be blank, locked or another kind of tag.', 'error');
      else if (!result.records.length) say('This tag is blank. Use Create to write a new OpenSpool tag to it.', 'info');
      else say(problem || 'This tag doesn’t hold an OpenSpool record.', 'error');
      return;
    }

    form = parsed.form;
    loaded = { tag: result.tag, raw: parsed.raw, unknownKeys: parsed.unknownKeys, notes: parsed.notes, empty: false };
    showErrors = true;
    mode = 'update';
    // The saved-colors panel may only now be on screen; let it mount first
    await tick();
    colorSection?.afterLoad();
    say('Tag read. Change what you need, then update the tag.', 'ok');
  }

  async function writeTag() {
    showErrors = true;
    if (errors.length) {
      say(`Fix ${errors.length === 1 ? 'the highlighted field' : `the ${errors.length} highlighted fields`} first.`, 'error');
      focusFirstError();
      return;
    }
    if (message.length > capacity) {
      say(`The data is ${message.length} bytes, more than the ${capacity} that fit on ${capacityLabel}. Remove some colors or fields.`, 'error');
      return;
    }
    say(null);
    const updating = mode === 'update' && loaded && !loaded.empty;
    sheet = { mode: 'write', wrongUid: '' };
    try {
      const record = mimeRecord(OpenSpool.MIME_TYPE, payload);
      const r = nfc.kind === 'native'
        ? await nfc.write(message, {
            expectedUid: updating ? loaded.tag.uid : '',
            onWrongTag: (uid) => { if (sheet) sheet.wrongUid = uid; },
          })
        : await nfc.write([record]);
      sheet = null;
      // The colors are now a picked saved color (named after the brand color)
      colorSection?.afterWrite();
      if (nfc.kind === 'native' && !r.verified) {
        say('Tag written, but reading it back didn’t match. Read the tag to check it.', 'error');
      } else {
        say(nfc.kind === 'native' ? 'Tag written and checked.' : 'Tag written.', 'ok');
      }
      if (updating) loaded = { ...loaded, raw: data, unknownKeys: [], notes: [], tag: { ...loaded.tag, ...(r.tag?.uid ? r.tag : {}) } };
    } catch (e) {
      sheet = null;
      if (e.code !== 'CANCELLED') say(e.message, 'error');
    }
  }
</script>

<div class="page">
  <header>
    <h1>FilaScribe</h1>
    <div class="modes" role="tablist" aria-label="Mode">
      <button type="button" role="tab" aria-selected={mode === 'create'} onclick={() => switchMode('create')}>Create</button>
      <button type="button" role="tab" aria-selected={mode === 'update'} onclick={() => switchMode('update')}>Read & update</button>
    </div>
  </header>

  {#if !nfcState.available || nfcState.enabled === false}
    <div class="banner" role="status">
      <p>{nfcState.reason}</p>
      {#if nfcState.available && nfcState.enabled === false}
        <button type="button" class="btn small" onclick={async () => { await nfc.openSettings(); }}>Open NFC settings</button>
        <button type="button" class="btn small quiet" onclick={async () => { nfcState = await nfc.status(); }}>Check again</button>
      {/if}
    </div>
  {/if}

  {#if mode === 'update' && (!loaded || loaded.empty)}
    <section class="empty">
      <h2>Read a tag to change it</h2>
      <p>Tap Read tag, then hold an OpenSpool tag to your phone. Its details load here so you can edit and write them back.</p>
      {#if loaded?.tag}<TagDetails tag={loaded.tag} />{/if}
    </section>
  {:else}
    <SpoolPreview
      colors={visibleColors}
      {gradient}
      type={form.type}
      brand={form.brand}
      variant={u1 ? form.subtype : ''}
      nozzle={form.minTemp && form.maxTemp ? `${form.minTemp}–${form.maxTemp}` : form.minTemp || form.maxTemp}
      bytes={message.length}
      {capacity}
      {capacityLabel}
    />

    <form class="form" onsubmit={(e) => { e.preventDefault(); writeTag(); }} novalidate>
      <Palette
        label="Fields"
        items={Object.entries(OpenSpool.PROFILES).map(([value, p]) => ({ value, label: p.label }))}
        bind:value={form.profile}
        allowCustom={false}
        hint={u1
          ? 'Adds the Snapmaker U1 fields: extra colors, variant, bed temperatures and spool details.'
          : 'Only the fields in the OpenSpool spec. Extra colors, variant and bed temperatures aren’t written.'}
      />

      <Palette label="Brand" items={BRANDS} bind:value={form.brand} customPlaceholder="e.g. Elegoo" onpick={pickBrand} />
      <Palette
        label="Material"
        items={materialItems}
        bind:value={form.type}
        onpick={pickMaterial}
        customPlaceholder="e.g. PLA+"
        error={errorFor('type')}
        hint={materialsFiltered ? `The materials ${form.brand} makes. Custom for anything else.` : ''}
      />
      {#if u1}
        <Palette
          label="Variant"
          items={variantItems}
          bind:value={form.subtype}
          customPlaceholder="e.g. Rapid"
          hint={variantItems === VARIANTS ? 'Written as subtype. None leaves it out.' : `The variants ${form.brand} makes in ${form.type}. Written as subtype. None leaves it out.`}
        />
      {/if}

      <ColorSection
        bind:this={colorSection}
        brand={form.brand}
        type={form.type}
        variant={u1 ? form.subtype : ''}
        canSetVariant={u1}
        max={u1 ? OpenSpool.MAX_COLORS : 1}
        bind:colors={form.colors}
        bind:colorType={form.colorType}
        getTemps={() => ({ minTemp: form.minTemp, maxTemp: form.maxTemp, bedMinTemp: form.bedMinTemp, bedMaxTemp: form.bedMaxTemp })}
        setTemps={(t) => Object.assign(form, t)}
        setVariant={(v) => (form.subtype = v)}
        onstatus={(t, isError) => say(t, isError ? 'error' : 'ok')}
        errors={colorErrors}
      />

      <fieldset>
        <legend class="label">Nozzle temperature, °C</legend>
        <div class="pair">
          <label>Min <input type="text" inputmode="numeric" bind:value={form.minTemp} aria-invalid={!!errorFor('minTemp')} /></label>
          <label>Max <input type="text" inputmode="numeric" bind:value={form.maxTemp} aria-invalid={!!errorFor('maxTemp')} /></label>
        </div>
        {#if errorFor('minTemp') || errorFor('maxTemp')}<p class="error-text">{errorFor('minTemp') || errorFor('maxTemp')}</p>{/if}
      </fieldset>

      {#if u1}
        <fieldset>
          <legend class="label">Bed temperature, °C</legend>
          <div class="pair">
            <label>Min <input type="text" inputmode="numeric" bind:value={form.bedMinTemp} aria-invalid={!!errorFor('bedMinTemp')} /></label>
            <label>Max <input type="text" inputmode="numeric" bind:value={form.bedMaxTemp} aria-invalid={!!errorFor('bedMaxTemp')} /></label>
          </div>
          {#if errorFor('bedMinTemp') || errorFor('bedMaxTemp')}<p class="error-text">{errorFor('bedMinTemp') || errorFor('bedMaxTemp')}</p>{/if}
        </fieldset>

        <details class="more" open={!!(form.weight || form.diameter || form.alpha !== 'FF')}>
          <summary>Spool details</summary>
          <div class="trio">
            <label>Weight, g <input type="text" inputmode="numeric" bind:value={form.weight} placeholder="1000" aria-invalid={!!errorFor('weight')} /></label>
            <label>Diameter, mm <input type="text" inputmode="decimal" bind:value={form.diameter} placeholder="1.75" aria-invalid={!!errorFor('diameter')} /></label>
            <label>Opacity (hex) <input type="text" bind:value={form.alpha} maxlength="2" autocapitalize="characters" aria-invalid={!!errorFor('alpha')} /></label>
          </div>
          {#each ['weight', 'diameter', 'alpha'] as f}{#if errorFor(f)}<p class="error-text">{errorFor(f)}</p>{/if}{/each}
          <p class="hint">Leave a box empty to leave it off the tag. Opacity FF means fully opaque and isn’t written.</p>
        </details>
      {/if}

      <details class="more">
        <summary>Tag data ({message.length} bytes)</summary>
        <pre>{data ? JSON.stringify(data, null, 2) : 'Fix the colors to see the data.'}</pre>
      </details>

      {#if mode === 'update' && loaded && !loaded.empty}
        <TagDetails tag={loaded.tag} raw={loaded.raw} unknownKeys={loaded.unknownKeys} notes={loaded.notes} />
      {/if}

      {#if mode === 'create'}
        <button type="button" class="btn quiet start-over" onclick={startOver}>Start over</button>
      {/if}
    </form>
  {/if}

  <footer>
    <p>FilaScribe {version}. Writes <a href="https://openspool.io/rfid.html">OpenSpool</a> tags{nfc.kind === 'web' ? ' with Web NFC' : ''}.</p>
  </footer>
</div>

<div class="dock">
  <div class="dock-inner">
    {#if status}
      <p class="status {status.kind}" role={status.kind === 'error' ? 'alert' : 'status'}>{status.text}</p>
    {/if}
    <div class="dock-actions">
      {#if mode === 'create'}
        <button type="button" class="btn primary wide" onclick={writeTag} disabled={!nfcState.available || nfcState.enabled === false}>Write tag</button>
      {:else if !loaded || loaded.empty}
        <button type="button" class="btn primary wide" onclick={readTag} disabled={!nfcState.available || nfcState.enabled === false}>Read tag</button>
      {:else}
        <button type="button" class="btn" onclick={readTag} disabled={!nfcState.available || nfcState.enabled === false}>Read another</button>
        <button type="button" class="btn primary wide" onclick={writeTag} disabled={!nfcState.available || nfcState.enabled === false}>Update tag</button>
      {/if}
    </div>
  </div>
</div>

{#if sheet}
  <NfcSheet mode={sheet.mode} wrongUid={sheet.wrongUid} oncancel={cancelNfc} />
{/if}

<style>
  .page {
    max-width: 560px;
    margin: 0 auto;
    padding: calc(var(--s4) + env(safe-area-inset-top)) var(--s4) 180px;
  }
  header { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: var(--s3); }
  h1 { font-size: 1.5rem; font-weight: 700; letter-spacing: 0.01em; }
  .modes { display: inline-flex; padding: 3px; border-radius: 8px; background: var(--chip); }
  .modes button {
    min-height: 40px;
    padding: 0 var(--s3);
    border: 0;
    border-radius: 6px;
    background: transparent;
    font-family: var(--font-label);
    font-weight: 600;
    font-size: 1rem;
    color: var(--muted);
  }
  .modes button[aria-selected='true'] { background: var(--surface); color: var(--ink); }

  .banner {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--s2);
    margin-top: var(--s4);
    padding: var(--s3) var(--s4);
    border-left: 4px solid var(--danger);
    background: var(--surface);
  }
  .banner p { margin: 0; flex: 1 1 100%; }

  .empty { display: grid; gap: var(--s3); padding: var(--s6) 0; }
  .empty h2 { font-size: 2rem; }
  .empty p { margin: 0; max-width: 46ch; }

  .form { display: grid; gap: var(--s5); }
  fieldset { border: 0; margin: 0; padding: 0; display: grid; gap: var(--s2); }
  legend { padding: 0; margin-bottom: var(--s2); }
  .pair { display: grid; grid-template-columns: 1fr 1fr; gap: var(--s3); }
  .trio { display: grid; grid-template-columns: repeat(3, 1fr); gap: var(--s3); margin-top: var(--s3); }
  .pair label, .trio label { display: grid; gap: var(--s1); font-size: 0.875rem; color: var(--muted); }
  .pair input, .trio input { color: var(--ink); font-variant-numeric: tabular-nums; }
  .more summary { font-family: var(--font-label); font-weight: 600; cursor: pointer; min-height: 32px; }
  .more .hint { margin-top: var(--s2); }
  pre {
    margin: var(--s2) 0 0;
    padding: var(--s3);
    background: var(--surface);
    border-radius: 6px;
    overflow-x: auto;
    font-size: 0.8125rem;
  }
  .start-over { justify-self: start; }

  footer { margin-top: var(--s6); color: var(--muted); font-size: 0.8125rem; }
  footer a { color: inherit; }

  .dock {
    position: fixed;
    left: 0;
    right: 0;
    bottom: 0;
    z-index: 10;
    background: color-mix(in srgb, var(--bg) 92%, transparent);
    border-top: 1px solid var(--line);
    backdrop-filter: blur(8px);
  }
  .dock-inner {
    max-width: 560px;
    margin: 0 auto;
    padding: var(--s3) var(--s4) calc(var(--s3) + env(safe-area-inset-bottom));
    display: grid;
    gap: var(--s2);
  }
  .dock-actions { display: flex; gap: var(--s2); }
  .wide { flex: 1; min-height: 52px; font-size: 1.125rem; }
  .dock-actions .btn:not(.wide) { min-height: 52px; }
  .status { margin: 0; font-size: 0.9375rem; }
  .status.ok { color: var(--ok); }
  .status.error { color: var(--danger); }
  .status.info { color: var(--muted); }

  @media (max-width: 380px) {
    .trio { grid-template-columns: 1fr 1fr; }
  }
</style>
