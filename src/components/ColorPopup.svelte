<script>
  // The app's color picker in a bottom sheet. Changes show on the swatch while
  // you drag; Use this color applies them, Cancel (or Escape / the dim area) drops them.
  import HsvPicker from './HsvPicker.svelte';
  import { normalizeHex } from '../lib/formats/openspool.js';

  let { hex = '000000', label = 'Color', onuse = () => {}, oncancel = () => {} } = $props();

  let picked = $state(normalizeHex(hex) || '000000');
  let text = $state(normalizeHex(hex) || '000000');
  let doneBtn = $state();
  $effect(() => { doneBtn?.focus(); });

  // The picker moves the text; typing moves the picker (once it is a full hex)
  $effect(() => { text = picked; });
  function typed(e) {
    text = e.currentTarget.value.replace(/[^0-9a-fA-F]/g, '').slice(0, 6).toUpperCase();
    const n = normalizeHex(text);
    if (n) picked = n;
  }
  const valid = $derived(!!normalizeHex(text) && text.length === 6);

  function keydown(e) {
    if (e.key === 'Escape') oncancel();
  }
</script>

<svelte:window onkeydown={keydown} />

<div class="scrim" role="presentation" onclick={(e) => e.target === e.currentTarget && oncancel()}>
  <div class="sheet" role="dialog" aria-modal="true" aria-label={`Pick ${label}`}>
    <div class="top">
      <span class="swatch" style:background={`#${picked}`} aria-hidden="true"></span>
      <label>
        {label}
        <span class="hexbox">#<input type="text" value={text} oninput={typed} maxlength="6" autocapitalize="characters" autocomplete="off" spellcheck="false" aria-label={`${label} hex`} /></span>
      </label>
    </div>
    <HsvPicker bind:hex={picked} {label} />
    <div class="actions">
      <button bind:this={doneBtn} type="button" class="btn primary" disabled={!valid} onclick={() => onuse(picked)}>Use this color</button>
      <button type="button" class="btn quiet" onclick={oncancel}>Cancel</button>
    </div>
  </div>
</div>

<style>
  .scrim {
    position: fixed;
    inset: 0;
    z-index: 30;
    display: grid;
    align-items: end;
    background: rgba(10, 14, 20, 0.45);
  }
  .sheet {
    display: grid;
    gap: var(--s3);
    max-width: 560px;
    width: 100%;
    max-height: 92vh;
    overflow-y: auto;
    margin: 0 auto;
    padding: var(--s4) var(--s4) calc(var(--s4) + env(safe-area-inset-bottom));
    border-radius: 16px 16px 0 0;
    background: var(--surface);
  }
  .top { display: flex; align-items: center; gap: var(--s3); }
  .swatch { flex: none; width: 48px; height: 48px; border-radius: 50%; box-shadow: inset 0 0 0 1px rgba(0, 0, 0, 0.25); }
  label { flex: 1; display: grid; gap: 2px; font-size: 0.8125rem; color: var(--muted); }
  .hexbox { display: flex; align-items: center; gap: 2px; font-family: var(--font-label); font-size: 1.125rem; color: var(--ink); }
  .hexbox input {
    flex: 1;
    min-width: 0;
    min-height: 40px;
    padding: 0 var(--s2);
    border: 1px solid var(--line);
    border-radius: 8px;
    background: var(--bg);
    color: var(--ink);
    font: inherit;
    letter-spacing: 0.04em;
  }
  .actions { display: grid; gap: var(--s2); }
</style>
