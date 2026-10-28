<script>
  // What was read from the tag, beyond the form.
  let { tag, raw = null, unknownKeys = [], notes = [] } = $props();

  const pages = $derived.by(() => {
    if (!tag?.pages) return [];
    const rows = [];
    for (let i = 0; i < tag.pages.length; i += 4) {
      const b = [...tag.pages.subarray(i, i + 4)];
      rows.push({
        page: i / 4,
        hex: b.map((x) => x.toString(16).padStart(2, '0').toUpperCase()).join(' '),
        text: b.map((x) => (x >= 32 && x < 127 ? String.fromCharCode(x) : '.')).join(''),
      });
    }
    return rows;
  });

  const facts = $derived(
    [
      tag?.chip && ['Chip', tag.chip],
      tag?.uid && ['UID', tag.uid],
      typeof tag?.maxNdefSize === 'number' && ['Space for data', `${tag.maxNdefSize} bytes`],
      tag && tag.writable === false && ['Locked', 'Yes, read-only'],
    ].filter(Boolean),
  );
</script>

<section class="details" aria-label="Tag details">
  {#if unknownKeys.length}
    <div class="notice">
      <p><strong>Not in the spec:</strong> {unknownKeys.join(', ')}.</p>
      <p>These fields are shown below but won’t be written back when you update the tag.</p>
    </div>
  {/if}
  {#each notes as n}<p class="hint">{n}</p>{/each}

  {#if facts.length}
    <dl>
      {#each facts as [k, v]}<dt>{k}</dt><dd>{v}</dd>{/each}
    </dl>
  {/if}

  {#if raw}
    <details>
      <summary>Data on the tag</summary>
      <pre>{JSON.stringify(raw, null, 2)}</pre>
    </details>
  {/if}

  {#if pages.length}
    <details>
      <summary>Raw pages ({pages.length})</summary>
      <table>
        <thead><tr><th scope="col">Page</th><th scope="col">Bytes</th><th scope="col">Text</th></tr></thead>
        <tbody>
          {#each pages as r}<tr><td>{r.page}</td><td>{r.hex}</td><td>{r.text}</td></tr>{/each}
        </tbody>
      </table>
    </details>
  {/if}
</section>

<style>
  .details { display: grid; gap: var(--s3); }
  .notice { border-left: 4px solid var(--brass); padding: var(--s1) var(--s3); }
  .notice p { margin: 0; }
  dl { display: grid; grid-template-columns: max-content 1fr; gap: var(--s1) var(--s4); margin: 0; }
  dt { font-family: var(--font-label); font-weight: 600; }
  dd { margin: 0; overflow-wrap: anywhere; font-variant-numeric: tabular-nums; }
  summary { font-family: var(--font-label); font-weight: 600; cursor: pointer; min-height: 32px; }
  pre {
    margin: var(--s2) 0 0;
    padding: var(--s3);
    background: var(--surface);
    border-radius: 6px;
    overflow-x: auto;
    font-size: 0.8125rem;
  }
  table { width: 100%; border-collapse: collapse; font-size: 0.8125rem; font-variant-numeric: tabular-nums; margin-top: var(--s2); }
  th { text-align: left; font-family: var(--font-label); color: var(--muted); font-weight: 600; }
  td { padding: 1px var(--s2) 1px 0; white-space: pre; font-family: ui-monospace, 'Cascadia Mono', monospace; }
</style>
