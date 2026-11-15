<script>
  // A row of choices that show what they do: each button draws a sample spool
  // (three colors) in that style. Used for the swatch looks in Settings →
  // Appearance. `shape` says how to draw it: 'circle', 'bar' (a color tile) or
  // 'small' / 'medium' / 'large' (the circle on a tile, at that size).
  let { label, items, value = '', onpick = () => {} } = $props();
  const id = `swp-${Math.random().toString(36).slice(2, 8)}`;
</script>

<div class="field">
  <span class="label" id={id}>{label}</span>
  <div class="row" role="radiogroup" aria-labelledby={id}>
    {#each items as item (item.value)}
      <button type="button" role="radio" aria-checked={value === item.value} class="opt" onclick={() => onpick(item.value)}>
        <span class="stage">
          <span class="sample {item.shape}" style:background={item.fill} aria-hidden="true"></span>
        </span>
        <span class="name">{item.label}</span>
      </button>
    {/each}
  </div>
</div>

<style>
  .field { display: grid; gap: var(--s2); margin-top: var(--s3); }
  .label { font-family: var(--font-label); font-size: 0.75rem; font-weight: 700; letter-spacing: 0.02em; color: var(--action); }
  .row { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: var(--s2); }
  .opt {
    display: grid;
    grid-template-rows: 1fr auto;
    gap: var(--s1);
    padding: var(--s2);
    border: 1px solid var(--line);
    border-radius: var(--r-control);
    background: none;
    color: var(--ink);
    font: inherit;
    cursor: pointer;
  }
  .opt[aria-checked='true'] { padding: calc(var(--s2) - 1px); border: 2px solid var(--action); }
  .stage { display: grid; place-items: center; min-height: 44px; }
  .name { font-size: 0.8125rem; line-height: 1.2; }
  .sample { display: block; box-shadow: inset 0 0 0 1px rgba(0, 0, 0, 0.25); }
  .circle { width: 40px; height: 40px; border-radius: 50%; }
  .bar { width: 100%; height: 26px; border-radius: 6px; }
  .small { width: 28px; height: 28px; border-radius: 50%; }
  .medium { width: calc(14px + 50%); aspect-ratio: 1; border-radius: 50%; }
  .large { width: 100%; aspect-ratio: 1; border-radius: 50%; }
</style>
