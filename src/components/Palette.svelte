<script>
  // A row of choice chips with an optional Custom chip that reveals a text box.
  // `value` is the chosen string; a value not in `items` counts as custom.
  // With `suggest`, the text box offers matches while typing and only sets
  // `value` when the text is done (a match tapped, Enter, or leaving the box),
  // passing it through `commit` (e.g. to fix the spelling).
  // With `onsave`, a Save button by the text box keeps the typed value as a
  // chip; chips in `removable` (the saved ones) can be removed again.
  let {
    label,
    items,
    value = $bindable(''),
    allowCustom = true,
    customPlaceholder = 'Type a name',
    hint = '',
    error = '',
    onpick = () => {},
    suggest = null, // (text) => matching names, best first
    commit = (text) => text.trim(),
    onsave = null, // (value) => keep it as a chip
    removable = [], // saved chips that can be removed
    onremove = () => {},
    outlined = null, // chips with a dashed outline (default: `removable`)
    customLabel = 'Custom', // "Other…" makes it a smaller, quieter chip
  } = $props();

  const dashed = $derived(outlined ?? removable);
  const boxLabel = $derived(`${customLabel.replace(/…$/, '')} ${label.toLowerCase()}`);
  const options = $derived(items.map((i) => (typeof i === 'string' ? { value: i, label: i || 'None' } : i)));
  const known = $derived(options.some((o) => o.value === value));
  let customOpen = $state(false);
  let ownValue = value; // last value this palette set itself
  const custom = $derived(allowCustom && (customOpen || !known));
  const id = `pal-${Math.random().toString(36).slice(2, 8)}`;
  let customInput = $state();
  let draft = $state(value); // the text box while typing (with `suggest`)
  let typing = $state(false);
  let focused = $state(false); // the text box has focus
  const matches = $derived(suggest && typing ? suggest(draft).filter((m) => m !== draft) : []);

  // A value set from outside (e.g. a tag was read) closes a Custom box
  // that was only open by choice
  $effect(() => {
    if (value !== ownValue) {
      ownValue = value;
      customOpen = false;
      draft = value;
      typing = false;
    }
  });

  // A Custom value that became a chip (saved after a write) shows as that
  // chip, unless the box is being typed in
  $effect(() => {
    if (customOpen && value && known && !focused) customOpen = false;
  });

  function pick(v) {
    customOpen = false;
    ownValue = v;
    value = v;
    onpick(v, false);
  }

  function pickCustom() {
    customOpen = true;
    if (known) value = '';
    ownValue = value;
    draft = value;
    onpick(value, true);
    queueMicrotask(() => customInput?.focus());
  }

  function typed(e) {
    if (suggest) {
      typing = true;
      return;
    }
    // Set `value` and `ownValue` together, so the effect above doesn't take
    // a typed value for one set from outside ("PLA" on the way to "PLA+"
    // used to close the box and pick the PLA chip)
    value = e.currentTarget.value;
    ownValue = value;
    onpick(value, true);
  }

  function done(text = draft) {
    typing = false;
    const v = commit(text);
    draft = v;
    if (v === value) return;
    // Asked before `value` changes: a parent that adds the selected value to
    // its chips (a built-in material read from a tag) would answer differently after
    const isChip = options.some((o) => o.value === v);
    ownValue = v;
    value = v;
    // A typed name that is one of the chips becomes that chip
    if (isChip) customOpen = false;
    onpick(v, !isChip);
  }

  const typedText = $derived((suggest ? draft : value) ?? '');

  function save() {
    if (suggest) done();
    const v = String(value ?? '').trim();
    if (!v) return;
    onsave(v);
    customOpen = false; // it's a chip now
  }

  function keydown(e) {
    if (!suggest) return;
    if (e.key === 'Enter') {
      e.preventDefault();
      done();
    } else if (e.key === 'Escape') {
      typing = false;
    }
  }
</script>

{#snippet saveButton()}
  {#if onsave}
    <!-- mousedown: keep the box focused so its text is saved as typed -->
    <button
      type="button"
      class="btn small save"
      disabled={!typedText.trim()}
      aria-label={`Save ${label.toLowerCase()} as a chip`}
      onmousedown={(e) => e.preventDefault()}
      onclick={save}
    >Save</button>
  {/if}
{/snippet}

<div class="field" role="group" aria-labelledby={id}>
  <div class="head">
    <span class="label" {id}>{label}</span>
    {#if hint && !error}<span class="hint">– {hint}</span>{/if}
  </div>
  <div class="chips">
    {#each options as o (o.value)}
      <button type="button" class="chip" class:saved={dashed.includes(o.value)} aria-pressed={!custom && value === o.value} onclick={() => pick(o.value)}>
        {o.label}
      </button>
    {/each}
    {#if allowCustom}
      <button type="button" class="chip" class:other={customLabel !== 'Custom'} aria-pressed={custom} onclick={pickCustom}>{customLabel}</button>
    {/if}
  </div>
  {#if custom}
    {#if suggest}
      <div class="customrow">
      <input
        bind:this={customInput}
        type="text"
        bind:value={draft}
        placeholder={customPlaceholder}
        aria-label={boxLabel}
        aria-invalid={!!error}
        maxlength="40"
        autocomplete="off"
        oninput={typed}
        onkeydown={keydown}
        onfocus={() => (focused = true)}
        onblur={() => { focused = false; done(); }}
      />
      {@render saveButton()}
      </div>
      {#if matches.length}
        <div class="matches" role="group" aria-label="Suggestions">
          {#each matches as m (m)}
            <!-- mousedown: pick before the box's blur commits the half-typed text -->
            <button type="button" class="match" onmousedown={(e) => e.preventDefault()} onclick={() => done(m)}>{m}</button>
          {/each}
        </div>
      {/if}
    {:else}
      <div class="customrow">
      <input
        bind:this={customInput}
        type="text"
        {value}
        placeholder={customPlaceholder}
        aria-label={boxLabel}
        aria-invalid={!!error}
        maxlength="40"
        oninput={typed}
        onfocus={() => (focused = true)}
        onblur={() => (focused = false)}
      />
      {@render saveButton()}
      </div>
    {/if}
  {:else if removable.includes(value)}
    <button type="button" class="btn small quiet danger remove" onclick={() => onremove(value)}>Remove “{value}” from your chips</button>
  {/if}
  {#if error}<p class="error-text">{error}</p>{/if}
</div>

<style>
  .head { display: flex; flex-wrap: wrap; align-items: baseline; column-gap: var(--s2); }
  .head .hint { margin: 0; }
  .chips { display: flex; flex-wrap: wrap; gap: var(--s2); }
  .chip {
    min-height: 40px;
    padding: 0 var(--s3);
    border-radius: 999px;
    border: 1px solid transparent;
    background: var(--chip);
    font-family: var(--font-label);
    font-weight: 500;
    font-size: 1rem;
  }
  .customrow { display: flex; gap: var(--s2); align-items: center; }
  .customrow input { flex: 1; min-width: 0; }
  .save { flex: none; min-height: 44px; }
  .remove { justify-self: start; }
  .matches { display: flex; flex-wrap: wrap; gap: var(--s1); }
  .match {
    min-height: 34px;
    padding: 0 var(--s3);
    border-radius: 999px;
    border: 1px dashed var(--line);
    background: transparent;
    font-family: var(--font-label);
    font-size: 0.9375rem;
  }
  .chip[aria-pressed='true'] {
    background: var(--ink);
    color: var(--bg);
    font-weight: 600;
  }
  /* "Other…": a quieter chip for anything not in the row */
  .chip.other:not([aria-pressed='true']) {
    background: transparent;
    border-color: var(--line);
    color: var(--muted);
    font-size: 0.9375rem;
  }
  /* Your own chips (saved Custom values): a dashed outline, as in PrintTag-Web-Rrrrobert */
  .chip.saved {
    border: 2px dashed var(--muted);
    padding: 0 calc(var(--s3) - 1px);
  }
  .chip.saved[aria-pressed='true'] { border-color: var(--bg); box-shadow: 0 0 0 2px var(--ink); }
</style>
