<script>
  // The round spool picture: a ring of the spool's colors with a hub in the middle.
  // The Tag preview and the Colors card header both use it, so they always look alike.
  // `edited` adds a dashed ring around it (a brand color you overrode).
  let { fill, edited = false } = $props();
</script>

<div class="reel" class:edited aria-hidden="true">
  <div class="filament" style:background={fill}></div>
  <div class="hub"></div>
</div>

<style>
  .reel {
    position: relative;
    flex: none;
    width: 68px;
    aspect-ratio: 1;
    border-radius: 50%;
    background: var(--ink);
    padding: 4px;
  }
  .reel.edited { outline: 2px dashed var(--muted); outline-offset: 3px; }
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
    border: 4px solid var(--ink);
    background: var(--surface);
  }
</style>
