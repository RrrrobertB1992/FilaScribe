<script>
  // The color box at the top of a Brand or Saved color tile. One color is always
  // a plain box. With more than one, it follows Settings → Appearance: vertical or
  // angled bands, or a circle (Around) at the chosen size.
  import { around, tileFill } from '../lib/swatch.js';
  import { getTileStyle, getTileSize } from '../lib/swatchStyleStore.svelte.js';

  let { colors, gradient = false } = $props();
  const round = $derived(getTileStyle() === 'around' && colors.length > 1);
</script>

{#if round}
  <span class="bar round" aria-hidden="true">
    <span class="disc {getTileSize()}" style:background={around(colors, gradient)}></span>
  </span>
{:else}
  <span class="bar" style:background={tileFill(colors, gradient, getTileStyle())} aria-hidden="true"></span>
{/if}

<style>
  .bar {
    display: block;
    height: 44px;
    border-radius: 6px;
    overflow: hidden;
    box-shadow: inset 0 0 0 1px rgba(0, 0, 0, 0.2);
  }
  /* The circle sits on the tile itself, so the box's own look goes */
  .bar.round { display: grid; place-items: center; height: auto; min-height: 44px; overflow: visible; box-shadow: none; }
  .disc { display: block; aspect-ratio: 1; border-radius: 50%; box-shadow: inset 0 0 0 1px rgba(0, 0, 0, 0.25); }
  .disc.small { width: 44px; }
  .disc.medium { width: 50%; }
  .disc.large { width: 100%; }
</style>
