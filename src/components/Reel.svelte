<script>
  // The round spool picture: the spool's colors in a disc with a small hub in the middle.
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
    background: var(--reel-edge);
    padding: 3px;
  }
  .reel.edited { outline: 2px dashed var(--muted); outline-offset: 3px; }
  /* The colors fill the whole disc, so as much of them shows as possible */
  .filament {
    width: 100%;
    height: 100%;
    border-radius: 50%;
    box-shadow: inset 0 0 0 1px rgba(0, 0, 0, 0.2);
  }
  .hub {
    position: absolute;
    inset: 36%;
    border-radius: 50%;
    border: 2px solid var(--reel-edge);
    background: var(--surface);
  }
</style>
