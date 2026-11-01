<script>
  // A card on the Create screen that folds shut, like the cards in Settings.
  // The heading is a small accent title; while the card is shut, `summary`
  // shows what's inside on a second line (and is hidden once it's open).
  // `head` replaces the whole heading (Colors uses its swatch and name).
  // Open or shut is remembered per `id` (lib/folds.js). `forceOpen` opens it
  // when something inside needs attention (an error, a value set by a tag
  // read), without changing what is remembered.
  import * as Folds from '../lib/folds.js';

  let { id, title = '', summary = '', defaultOpen = false, forceOpen = false, cls = '', head = null, children } = $props();

  let isOpen = $state(Folds.isOpen(id, defaultOpen));
  $effect(() => {
    if (forceOpen) isOpen = true;
  });

  function toggled(e) {
    const v = e.currentTarget.open;
    if (v === isOpen) return;
    isOpen = v;
    Folds.set(id, v);
  }
</script>

<details class={`fold ${cls}`} open={isOpen} ontoggle={toggled} data-fold={id}>
  <summary>
    {#if head}
      {@render head()}
    {:else}
      <span class="titles">
        <span class="title">{title}</span>
        {#if summary}<span class="sum">{summary}</span>{/if}
      </span>
    {/if}
  </summary>
  <div class="body">{@render children()}</div>
</details>

<style>
  .fold {
    padding: 0 var(--s4);
    border: 1px solid var(--line);
    border-radius: 14px;
    background: var(--surface);
  }
  summary {
    display: flex;
    align-items: center;
    gap: var(--s3);
    min-height: 56px;
    padding: var(--s2) 0;
    cursor: pointer;
    list-style: none;
  }
  summary::-webkit-details-marker { display: none; }
  summary::after {
    content: '';
    flex: none;
    margin-left: auto;
    width: 9px;
    height: 9px;
    border-right: 2px solid var(--muted);
    border-bottom: 2px solid var(--muted);
    transform: rotate(45deg) translate(-2px, -2px);
    transition: transform 0.15s ease;
  }
  details[open] > summary::after { transform: rotate(-135deg) translate(-2px, -2px); }
  .titles { display: grid; gap: 2px; min-width: 0; }
  .title {
    font-family: var(--font-label);
    font-weight: 700;
    font-size: 0.8125rem;
    letter-spacing: 0.09em;
    text-transform: uppercase;
    color: var(--action);
  }
  .sum { font-family: var(--font-label); font-weight: 700; font-size: 1.0625rem; overflow-wrap: anywhere; }
  details[open] .sum { display: none; }
  .body { display: grid; gap: var(--s4); padding-bottom: var(--s4); }
</style>
