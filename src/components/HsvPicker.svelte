<script>
  // Saturation/brightness area plus a hue slider. Works with touch, mouse
  // and keyboard (arrow keys move the marker; Shift moves faster).
  let { hex = $bindable('FFFFFF'), label = 'Color' } = $props();

  function toHsv(h6) {
    const r = parseInt(h6.slice(0, 2), 16) / 255, g = parseInt(h6.slice(2, 4), 16) / 255, b = parseInt(h6.slice(4, 6), 16) / 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min;
    let h = 0;
    if (d) {
      if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) * 60;
      else if (max === g) h = ((b - r) / d + 2) * 60;
      else h = ((r - g) / d + 4) * 60;
    }
    return { h, s: max ? d / max : 0, v: max };
  }

  function toHex(h, s, v) {
    const f = (n) => {
      const k = (n + h / 60) % 6;
      return Math.round((v - v * s * Math.max(0, Math.min(k, 4 - k, 1))) * 255);
    };
    return [f(5), f(3), f(1)].map((c) => c.toString(16).padStart(2, '0')).join('').toUpperCase();
  }

  let hue = $state(0), sat = $state(0), val = $state(1);
  let lastHex = '';

  // Follow outside changes without losing the hue of greys
  $effect(() => {
    if (/^[0-9A-F]{6}$/.test(hex) && hex !== lastHex) {
      const c = toHsv(hex);
      if (c.s > 0 && c.v > 0) hue = c.h;
      sat = c.s;
      val = c.v;
      lastHex = hex;
    }
  });

  function commit() {
    lastHex = toHex(hue, sat, val);
    hex = lastHex;
  }

  let area;
  function fromPointer(e) {
    const r = area.getBoundingClientRect();
    sat = Math.min(1, Math.max(0, (e.clientX - r.left) / r.width));
    val = 1 - Math.min(1, Math.max(0, (e.clientY - r.top) / r.height));
    commit();
  }
  function down(e) {
    area.setPointerCapture(e.pointerId);
    fromPointer(e);
  }
  function move(e) {
    if (area.hasPointerCapture(e.pointerId)) fromPointer(e);
  }
  function key(e) {
    const step = e.shiftKey ? 0.1 : 0.02;
    const moves = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, step], ArrowDown: [0, -step] };
    const m = moves[e.key];
    if (!m) return;
    e.preventDefault();
    sat = Math.min(1, Math.max(0, sat + m[0]));
    val = Math.min(1, Math.max(0, val + m[1]));
    commit();
  }
</script>

<div class="picker">
  <div
    class="area"
    bind:this={area}
    style:--hue={`hsl(${hue} 100% 50%)`}
    role="slider"
    tabindex="0"
    aria-label={`${label} saturation and brightness`}
    aria-valuetext={`saturation ${Math.round(sat * 100)}%, brightness ${Math.round(val * 100)}%`}
    aria-valuenow={Math.round(sat * 100)}
    onpointerdown={down}
    onpointermove={move}
    onkeydown={key}
  >
    <span class="marker" style:left={`${sat * 100}%`} style:top={`${(1 - val) * 100}%`} style:background={`#${hex}`}></span>
  </div>
  <input
    class="hue"
    type="range"
    min="0"
    max="359"
    step="1"
    bind:value={hue}
    oninput={commit}
    aria-label={`${label} hue`}
  />
</div>

<style>
  .picker { display: grid; gap: var(--s3); }
  .area {
    position: relative;
    height: 160px;
    border-radius: 6px;
    background:
      linear-gradient(to top, #000, transparent),
      linear-gradient(to right, #fff, transparent),
      var(--hue);
    touch-action: none;
    cursor: crosshair;
  }
  .marker {
    position: absolute;
    width: 26px;
    height: 26px;
    margin: -13px 0 0 -13px;
    border-radius: 50%;
    border: 3px solid #fff;
    box-shadow: 0 0 0 1px rgba(0, 0, 0, 0.5);
    pointer-events: none;
  }
  .hue {
    width: 100%;
    height: 28px;
    margin: 0;
    appearance: none;
    border-radius: 14px;
    background: linear-gradient(to right, #f00, #ff0, #0f0, #0ff, #00f, #f0f, #f00);
  }
  .hue::-webkit-slider-thumb {
    appearance: none;
    width: 28px;
    height: 28px;
    border-radius: 50%;
    background: #fff;
    border: 1px solid rgba(0, 0, 0, 0.5);
  }
  .hue::-moz-range-thumb {
    width: 26px;
    height: 26px;
    border-radius: 50%;
    background: #fff;
    border: 1px solid rgba(0, 0, 0, 0.5);
  }
</style>
