<script>
  import { untrack } from 'svelte';
  import HsvPicker from './HsvPicker.svelte';
  import Palette from './Palette.svelte';
  import { normalizeHex } from '../lib/formats/openspool.js';
  import { COLOR_TYPES } from '../lib/catalog.js';

  // colors: hex strings (no '#'); color 1 is the main color.
  let { colors = $bindable(['FFFFFF']), colorType = $bindable('1'), max = 5, onchange = () => {} } = $props();

  let active = $state(0);
  let text = $state('');
  let touched = $state(false);

  const shown = $derived(colors.slice(0, max));
  $effect(() => {
    if (active >= shown.length) active = Math.max(0, shown.length - 1);
  });
  // Keep the hex box in step with the active color (but don't fight typing:
  // this only runs when the color or the active slot changes)
  $effect(() => {
    const current = colors[active];
    untrack(() => {
      if (normalizeHex(text) !== current) text = current || '';
    });
  });

  const textError = $derived(touched && !normalizeHex(text) ? 'Use 3 or 6 hex digits, like F80 or FF8800.' : '');

  function setColor(i, hex) {
    const next = [...colors];
    next[i] = hex;
    colors = next;
    onchange();
  }

  function typed() {
    const hex = normalizeHex(text);
    if (hex) setColor(active, hex);
  }

  function add() {
    if (colors.length >= max) return;
    colors = [...colors, colors[colors.length - 1] || 'FFFFFF'];
    active = colors.length - 1;
    touched = false;
    onchange();
  }

  function remove(i) {
    if (colors.length < 2) return;
    if (!confirm(`Remove color ${i + 1} (#${colors[i]})?`)) return;
    colors = colors.filter((_, j) => j !== i);
    active = Math.min(i, colors.length - 1);
    onchange();
  }

  let pickerHex = $state('FFFFFF');
  $effect(() => { pickerHex = colors[active] || 'FFFFFF'; });
  $effect(() => {
    if (pickerHex !== colors[active] && normalizeHex(pickerHex)) setColor(active, pickerHex);
  });
</script>

<div class="field">
  <span class="label" id="colors-label">{max > 1 ? 'Colors' : 'Color'}</span>
  <div class="slots" role="group" aria-labelledby="colors-label">
    {#each shown as hex, i}
      <button
        type="button"
        class="slot"
        aria-pressed={i === active}
        aria-label={`Color ${i + 1}, #${hex}${i === active ? ', editing' : ''}`}
        onclick={() => { active = i; touched = false; }}
      >
        <span class="swatch" style:background={`#${hex}`}></span>
        <span class="num">{i + 1}</span>
      </button>
    {/each}
    {#if shown.length < max}
      <button type="button" class="slot add" onclick={add} aria-label="Add a color">
        <span class="plus" aria-hidden="true">+</span>
        <span class="num">Add</span>
      </button>
    {/if}
  </div>

  <div class="editor">
    <div class="hexrow">
      <label class="hexlabel" for="hex-input">Color {active + 1}</label>
      <span class="hash" aria-hidden="true">#</span>
      <input
        id="hex-input"
        type="text"
        inputmode="text"
        autocapitalize="characters"
        autocomplete="off"
        spellcheck="false"
        maxlength="7"
        bind:value={text}
        oninput={typed}
        onblur={() => (touched = true)}
        aria-invalid={!!textError}
      />
      {#if shown.length > 1}
        <button type="button" class="btn small quiet danger" onclick={() => remove(active)}>Remove</button>
      {/if}
    </div>
    {#if textError}<p class="error-text">{textError}</p>{/if}
    <HsvPicker bind:hex={pickerHex} label={`Color ${active + 1}`} />
  </div>

  {#if max > 1 && shown.length > 1}
    <Palette
      label="Multi-color style"
      items={COLOR_TYPES}
      bind:value={colorType}
      allowCustom={false}
      hint="Gradient: the colors blend into each other. Segments: each color is a solid stretch."
      onpick={onchange}
    />
  {/if}
</div>

<style>
  .slots { display: flex; flex-wrap: wrap; gap: var(--s2); }
  .slot {
    display: grid;
    justify-items: center;
    gap: 2px;
    width: 56px;
    padding: 6px 0 4px;
    border: 2px solid transparent;
    border-radius: 8px;
    background: transparent;
  }
  .slot[aria-pressed='true'] { border-color: var(--ink); }
  .swatch, .plus {
    width: 36px;
    height: 36px;
    border-radius: 50%;
    box-shadow: inset 0 0 0 1px rgba(0, 0, 0, 0.25);
  }
  .plus {
    display: grid;
    place-items: center;
    font-size: 1.5rem;
    line-height: 1;
    box-shadow: inset 0 0 0 2px var(--line);
    color: var(--muted);
  }
  .num { font-family: var(--font-label); font-size: 0.875rem; color: var(--muted); }
  .editor { display: grid; gap: var(--s3); padding-top: var(--s2); }
  .hexrow { display: flex; align-items: center; gap: var(--s2); }
  .hexlabel { font-family: var(--font-label); font-weight: 600; min-width: 4.5em; }
  .hash { color: var(--muted); font-family: var(--font-label); font-size: 1.125rem; }
  .hexrow input {
    flex: 0 1 9em;
    font-family: var(--font-label);
    font-size: 1.125rem;
    letter-spacing: 0.06em;
    font-variant-numeric: tabular-nums;
    text-transform: uppercase;
  }
</style>
