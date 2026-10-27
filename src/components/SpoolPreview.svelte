<script>
  // The spool as it will be described by the tag.
  let { colors = ['FFFFFF'], gradient = false, type = '', brand = '', variant = '', nozzle = '', bytes = 0, capacity = 0, capacityLabel = '' } = $props();

  const fill = $derived.by(() => {
    const list = colors.map((c) => `#${c}`);
    if (list.length === 1) return list[0];
    if (gradient) return `conic-gradient(from -90deg, ${list.join(', ')})`;
    const step = 360 / list.length;
    return `conic-gradient(from -90deg, ${list.map((c, i) => `${c} ${i * step}deg ${(i + 1) * step}deg`).join(', ')})`;
  });

  // How the U1 / Snapmaker Orca names it: <brand> <type> <subtype>
  const name = $derived([brand, type, variant].filter(Boolean).join(' '));
  const pct = $derived(capacity ? Math.min(100, Math.round((bytes / capacity) * 100)) : 0);
  const over = $derived(capacity > 0 && bytes > capacity);
</script>

<section class="spool" aria-label="Tag preview">
  <div class="reel" aria-hidden="true">
    <div class="filament" style:background={fill}></div>
    <div class="hub"></div>
  </div>
  <div class="facts">
    <p class="type">{type || 'No material'}</p>
    <p class="name">{name || 'Pick a brand and material'}</p>
    {#if nozzle}<p class="meta">Nozzle {nozzle} °C</p>{/if}
    {#if colors.length > 1}<p class="meta">{colors.length} colors, {gradient ? 'gradient' : 'segments'}</p>{/if}
    <div class="size" class:over>
      <div class="bar"><span style:width={`${pct}%`}></span></div>
      <p class="meta">
        {bytes} of {capacity} bytes{capacityLabel ? ` on ${capacityLabel}` : ''}{over ? ': too big' : ''}
      </p>
    </div>
  </div>
</section>

<style>
  .spool {
    display: grid;
    grid-template-columns: auto 1fr;
    gap: var(--s5);
    align-items: center;
    padding: var(--s5) 0 var(--s4);
  }
  .reel {
    position: relative;
    width: 132px;
    aspect-ratio: 1;
    border-radius: 50%;
    background: var(--ink);
    padding: 7px;
  }
  .filament {
    width: 100%;
    height: 100%;
    border-radius: 50%;
    /* the wound filament: a thick ring */
    mask: radial-gradient(circle, transparent 37%, #000 38%, #000 100%);
    -webkit-mask: radial-gradient(circle, transparent 37%, #000 38%, #000 100%);
    box-shadow: inset 0 0 0 1px rgba(0, 0, 0, 0.2);
  }
  .hub {
    position: absolute;
    inset: 34%;
    border-radius: 50%;
    border: 6px solid var(--ink);
    background: var(--bg);
  }
  .facts { min-width: 0; display: grid; gap: 2px; }
  .facts p { margin: 0; }
  .type {
    font-family: var(--font-label);
    font-weight: 700;
    font-size: clamp(2.25rem, 9vw, 3.25rem);
    line-height: 1;
    letter-spacing: -0.01em;
    overflow-wrap: anywhere;
  }
  .name { font-family: var(--font-label); font-weight: 500; font-size: 1.25rem; overflow-wrap: anywhere; }
  .meta { color: var(--muted); font-size: 0.875rem; }
  .size { margin-top: var(--s2); display: grid; gap: var(--s1); }
  .bar { height: 6px; border-radius: 3px; background: var(--chip); overflow: hidden; }
  .bar span { display: block; height: 100%; background: var(--brass); }
  .over .bar span { background: var(--danger); }
  .over .meta { color: var(--danger); }
  @media (max-width: 360px) {
    .reel { width: 104px; }
  }
</style>
