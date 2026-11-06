<script>
  // Read & update: change the weight or the nozzle temperatures with one tap.
  // The values are the form's own fields (the cards below show the same
  // numbers); this card also lists what changed since the tag was read, with
  // a way back. Nothing is written until Update tag.
  import { bump, changes } from '../lib/quickEdits.js';

  // form: the fields to edit. before: what the tag held when it was read.
  // showWeight: weight is a Snapmaker U1 field. errors: { field: message }.
  let { form, before, showWeight = true, errors = {}, onset = () => {}, onundo = () => {} } = $props();

  const list = $derived(changes(before, form).filter((c) => showWeight || c.field !== 'weight'));
  const empty = (f) => String(form[f] ?? '').trim() === '';
</script>

{#snippet stepper(field, label, down, up)}
  <div class="row">
    {#each down as [d, glyph] (d)}
      <button type="button" class="step" aria-label={`${label} minus ${-d}`} disabled={empty(field)} onclick={() => onset(field, bump(field, form[field], d))}>{glyph}</button>
    {/each}
    <input
      type="text"
      inputmode="numeric"
      aria-label={label}
      placeholder="not set"
      value={form[field]}
      aria-invalid={!!errors[field]}
      oninput={(e) => onset(field, e.currentTarget.value)}
    />
    {#each up as [d, glyph] (d)}
      <button type="button" class="step" aria-label={`${label} plus ${d}`} onclick={() => onset(field, bump(field, form[field], d))}>{glyph}</button>
    {/each}
  </div>
  {#if errors[field]}<p class="error-text">{errors[field]}</p>{/if}
{/snippet}

<section class="quick" aria-label="Quick edits">
  <div class="head">
    <h2>Quick edits</h2>
    {#if list.length}<button type="button" class="btn small quiet" onclick={onundo}>Undo changes</button>{/if}
  </div>

  {#if showWeight}
    <div class="group">
      <span class="label">Weight, g</span>
      {@render stepper('weight', 'Weight', [[-50, '−−'], [-10, '−']], [[10, '+'], [50, '++']])}
      <p class="hint">− and + change it by 10 g, −− and ++ by 50 g. Tap the number to type one.</p>
    </div>
  {:else}
    <p class="hint">Turn on Snapmaker U1 fields to edit the weight.</p>
  {/if}

  <div class="group">
    <span class="label">Nozzle temperature, °C</span>
    <div class="pair">
      <div class="half">
        <span class="mini">Min</span>
        {@render stepper('minTemp', 'Nozzle min', [[-5, '−']], [[5, '+']])}
      </div>
      <div class="half">
        <span class="mini">Max</span>
        {@render stepper('maxTemp', 'Nozzle max', [[-5, '−']], [[5, '+']])}
      </div>
    </div>
    <p class="hint">Each tap changes it by 5 °C.</p>
  </div>

  {#if list.length}
    <ul class="changes" aria-label="Changes">
      {#each list as c (c.field)}
        <li><span>{c.label}</span><span><b>{c.now}</b> <span class="was">was {c.was}</span></span></li>
      {/each}
    </ul>
  {/if}
</section>

<style>
  .quick {
    display: grid;
    gap: var(--s4);
    padding: var(--s3) var(--s4) var(--s4);
    border: 1px solid var(--line);
    border-radius: 14px;
    background: var(--surface);
  }
  .head { display: flex; align-items: center; justify-content: space-between; min-height: 36px; }
  h2 {
    margin: 0;
    font-family: var(--font-label);
    font-weight: 700;
    font-size: 0.8125rem;
    letter-spacing: 0.09em;
    text-transform: uppercase;
    color: var(--action);
  }
  .group { display: grid; gap: var(--s2); }
  .label, .mini { font-size: 0.875rem; color: var(--muted); }
  .mini { font-size: 0.75rem; }
  .row { display: flex; align-items: center; gap: var(--s1); }
  .row input { flex: 1; min-width: 0; text-align: center; font-size: 1.25rem; font-weight: 700; font-variant-numeric: tabular-nums; min-height: 48px; }
  .step {
    flex: none;
    min-width: 44px;
    min-height: 48px;
    border: 1px solid var(--line);
    border-radius: 10px;
    background: var(--surface);
    color: var(--ink);
    font-family: var(--font-label);
    font-size: 1.25rem;
    font-weight: 700;
    cursor: pointer;
  }
  .step:disabled { opacity: 0.4; cursor: default; }
  .pair { display: grid; grid-template-columns: 1fr 1fr; gap: var(--s3); }
  .half { display: grid; gap: var(--s1); }
  .half .step { min-width: 40px; }
  .hint { margin: 0; font-size: 0.8125rem; color: var(--muted); }
  .error-text { margin: 0; font-size: 0.875rem; color: var(--danger); }
  .changes { list-style: none; margin: 0; padding: var(--s3) 0 0; border-top: 1px solid var(--line); display: grid; gap: var(--s1); }
  .changes li { display: flex; justify-content: space-between; gap: var(--s3); }
  .was { color: var(--muted); font-size: 0.875rem; }
</style>
