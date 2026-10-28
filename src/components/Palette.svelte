<script>
  // A row of choice chips with an optional Custom chip that reveals a text box.
  // `value` is the chosen string; a value not in `items` counts as custom.
  let {
    label,
    items,
    value = $bindable(''),
    allowCustom = true,
    customPlaceholder = 'Type a name',
    hint = '',
    error = '',
    onpick = () => {},
  } = $props();

  const options = $derived(items.map((i) => (typeof i === 'string' ? { value: i, label: i || 'None' } : i)));
  const known = $derived(options.some((o) => o.value === value));
  let customOpen = $state(false);
  let ownValue = value; // last value this palette set itself
  const custom = $derived(allowCustom && (customOpen || !known));
  const id = `pal-${Math.random().toString(36).slice(2, 8)}`;
  let customInput = $state();

  // A value set from outside (e.g. a tag was read) closes a Custom box
  // that was only open by choice
  $effect(() => {
    if (value !== ownValue) {
      ownValue = value;
      customOpen = false;
    }
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
    onpick(value, true);
    queueMicrotask(() => customInput?.focus());
  }

  function typed() {
    ownValue = value;
    onpick(value, true);
  }
</script>

<div class="field" role="group" aria-labelledby={id}>
  <span class="label" {id}>{label}</span>
  <div class="chips">
    {#each options as o (o.value)}
      <button type="button" class="chip" aria-pressed={!custom && value === o.value} onclick={() => pick(o.value)}>
        {o.label}
      </button>
    {/each}
    {#if allowCustom}
      <button type="button" class="chip" aria-pressed={custom} onclick={pickCustom}>Custom</button>
    {/if}
  </div>
  {#if custom}
    <input
      bind:this={customInput}
      type="text"
      bind:value
      placeholder={customPlaceholder}
      aria-label={`Custom ${label.toLowerCase()}`}
      aria-invalid={!!error}
      maxlength="40"
      oninput={typed}
    />
  {/if}
  {#if error}<p class="error-text">{error}</p>{:else if hint}<p class="hint">{hint}</p>{/if}
</div>

<style>
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
  .chip[aria-pressed='true'] {
    background: var(--ink);
    color: var(--bg);
    font-weight: 600;
  }
</style>
