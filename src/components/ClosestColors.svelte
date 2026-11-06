<script>
  // The closest brand colors for colors that aren't a brand color: a few
  // tiles to tap, or, once one is picked, a way back to the color it replaced.
  // Used in the Colors card (Create) and in Quick edits (Read & update); the
  // matching itself is in BrandColors.svelte.
  //   suggestions: null (nothing to offer), [] (nothing is close), or the tiles
  //   backTo: the colors a picked suggestion replaced, as text ("" when none)
  //   label: "Bambu Lab PLA Basic", for the title
  //   mine: the current colors as text, for the hint (optional)
  let { suggestions = null, backTo = '', label = '', mine = '', onuse = () => {}, onback = () => {} } = $props();

  const swatchOf = (cols, gradient) => {
    const list = cols.map((h) => `#${h}`);
    if (list.length < 2) return list[0] || '#FFFFFF';
    if (gradient) return `linear-gradient(135deg, ${list.join(', ')})`;
    const step = 100 / list.length;
    return `linear-gradient(135deg, ${list.map((c, i) => `${c} ${i * step}% ${(i + 1) * step}%`).join(', ')})`;
  };
</script>

{#if backTo}
  <div class="back">
    <span>Was your color {backTo}</span>
    <button type="button" class="btn small quiet" onclick={onback}>Back to my color</button>
  </div>
{:else if suggestions?.length}
  <div class="suggest" role="group" aria-label="Closest brand colors">
    <p class="s-title">Closest {label} colors</p>
    {#each suggestions as s (s.id)}
      <button type="button" class="s-tile" aria-label={`Use ${s.name}, ${s.line}, ${s.label}`} onclick={() => onuse(s.id)}>
        <span class="s-swatch" style:background={swatchOf(s.colors, s.gradient)} aria-hidden="true"></span>
        <span class="s-what"><span class="s-name">{s.name}</span><span class="s-line">{s.line}</span></span>
        <span class="s-close" class:very={s.label === 'Very close'}>{s.label}</span>
      </button>
    {/each}
    <p class="hint">{mine ? `Your color is ${mine}. Tap one to use it instead.` : 'Tap one to use it. Your color stays here until you do.'}</p>
  </div>
{:else if suggestions}
  <p class="hint no-close">No {label} color is close to this one.</p>
{/if}

<style>
  .suggest { display: grid; gap: var(--s2); }
  .s-title { margin: 0; font-size: 0.875rem; color: var(--muted); }
  .s-tile {
    display: flex;
    align-items: center;
    gap: var(--s3);
    min-height: 56px;
    padding: var(--s1) var(--s3);
    border: 1px solid var(--line);
    border-radius: 10px;
    background: var(--bg);
    color: var(--ink);
    text-align: left;
    cursor: pointer;
  }
  .s-swatch { flex: none; width: 34px; height: 34px; border-radius: 50%; box-shadow: inset 0 0 0 1px rgba(0, 0, 0, 0.25); }
  .s-what { display: grid; flex: 1; min-width: 0; line-height: 1.25; }
  .s-name { font-weight: 700; overflow-wrap: anywhere; }
  .s-line { font-size: 0.8125rem; color: var(--muted); overflow-wrap: anywhere; }
  .s-close { flex: none; font-size: 0.8125rem; font-weight: 700; color: var(--muted); }
  .s-close.very { color: var(--ok); }
  .back { display: flex; align-items: center; justify-content: space-between; gap: var(--s3); font-size: 0.9375rem; color: var(--muted); }
  .no-close, .suggest .hint { margin: 0; }
</style>
