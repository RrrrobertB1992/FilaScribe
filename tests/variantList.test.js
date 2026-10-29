import { describe, it, expect } from 'vitest';
import * as VL from '../src/lib/variantList.js';
import * as BC from '../src/lib/brandColors.js';
import { VARIANTS } from '../src/lib/catalog.js';
import snapshot from '../src/data/brand-colors.json' with { type: 'json' };

const memory = () => {
  const m = new Map();
  return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, String(v)) };
};

describe('hidden variants', () => {
  it('start with nothing hidden', () => {
    expect(VL.load(memory())).toEqual([]);
  });

  it('hides and shows variants, in the order hidden', () => {
    let h = [];
    h = VL.hide(h, ' Glow ');
    h = VL.hide(h, 'Rainbow');
    expect(h).toEqual(['Glow', 'Rainbow']);
    expect(VL.hide(h, 'glow')).toBe(h);
    expect(VL.hide(h, '')).toBe(h);
    expect(VL.hide(h, 'x'.repeat(41))).toBe(h);
    h = VL.show(h, 'Glow');
    expect(h).toEqual(['Rainbow']);
    expect(VL.show(h, 'nope')).toBe(h);
  });

  it('hides by kind: a brand’s own word for the same variant goes too', () => {
    const h = VL.hide([], 'Metallic');
    expect(VL.isHidden(h, 'Metal')).toBe(true);
    expect(VL.hide(h, 'Metal')).toBe(h);
    expect(VL.isHidden(h, 'Matte')).toBe(false);
    expect(VL.show(h, 'Metal')).toEqual([]);
    // shore hardness is its own kind
    expect(VL.isHidden(['95A'], '95A HF')).toBe(false);
    expect(VL.isHidden(['95A'], '95a')).toBe(true);
  });

  it('stores what Settings chose', () => {
    const st = memory();
    VL.store(['Glow', 'glow', '', 3, 'Rainbow'], st);
    expect(VL.load(st)).toEqual(['Glow', 'Rainbow']);
    VL.store([], st);
    expect(VL.load(st)).toEqual([]);
  });

  it('falls back to nothing hidden on junk', () => {
    const st = memory();
    st.setItem(VL.STORAGE_KEY, 'not json');
    expect(VL.load(st)).toEqual([]);
    st.setItem(VL.STORAGE_KEY, JSON.stringify({ hidden: 'nope' }));
    expect(VL.load(st)).toEqual([]);
  });
});

describe('variant row', () => {
  const choices = ['', 'Basic', 'Matte', 'Glow', 'Metal'];

  it('leaves out hidden variants but never None', () => {
    expect(VL.visible(choices, [])).toBe(choices);
    expect(VL.visible(choices, ['Glow', 'Metallic'])).toEqual(['', 'Basic', 'Matte']);
    expect(VL.visible(choices, ['Basic', 'Matte', 'Glow', 'Metal'])).toEqual(['']);
  });

  it('keeps the selected variant, even hidden', () => {
    expect(VL.visible(choices, ['Glow', 'Matte'], 'Glow')).toEqual(['', 'Basic', 'Glow', 'Metal']);
    expect(VL.visible(choices, ['Glow'], 'Custom thing')).toEqual(['', 'Basic', 'Matte', 'Metal']);
  });

  it('a Custom name that is only the same kind does not bring the chip back', () => {
    expect(VL.visible(choices, ['Matte'], 'Matt')).toEqual(['', 'Basic', 'Glow', 'Metal']);
    expect(VL.visible(choices, ['Matte'], 'matte')).toEqual(['', 'Basic', 'Matte', 'Glow', 'Metal']); // the name itself, any case
  });

  it('finds variants to hide: starts with, not hidden yet, at most 12', () => {
    const names = ['Basic', 'Matte', 'Metal', 'Metallic', 'Marble', 'Glow'];
    expect(VL.find(names, [], 'ma')).toEqual(['Matte', 'Marble']);
    expect(VL.find(names, ['Metallic'], 'me')).toEqual([]); // Metal is the same kind as the hidden Metallic
    expect(VL.find(names, [], '')).toEqual([]);
    expect(VL.find(names, [], 'm', 2)).toHaveLength(2);
  });
});

describe('variants in the brand data', () => {
  it('lists every variant name a chip can have, default list first', () => {
    const names = BC.variantNames(snapshot);
    expect(names.slice(0, VARIANTS.filter(Boolean).length)).toEqual(VARIANTS.filter(Boolean));
    expect(names).toEqual(expect.arrayContaining(['Metal', 'High Speed', '85A']));
    expect(new Set(names).size).toBe(names.length);
    expect(names).not.toContain('');
    expect(BC.variantNames(null)).toEqual(VARIANTS.filter(Boolean));
  });

  it('sameVariant: the same chip, or the same kind', () => {
    expect(BC.sameVariant('Matte', 'matt')).toBe(true);
    expect(BC.sameVariant('Metallic', 'Metal')).toBe(true);
    expect(BC.sameVariant('Matte', 'Silk')).toBe(false);
    expect(BC.sameVariant('', '')).toBe(false);
  });

  it('a brand switch does not land on a hidden variant', () => {
    // Bambu "Metal" -> Polymaker "Metallic" normally; with it hidden: None
    expect(BC.carryVariant(snapshot, 'Metal', 'Polymaker', 'PLA')).toBe('Metallic');
    expect(BC.carryVariant(snapshot, 'Metal', 'Polymaker', 'PLA', [], ['Metallic'])).toBe('');
    // the selected variant itself stays if the brand has it
    expect(BC.carryVariant(snapshot, 'Matte', 'Bambu Lab', 'PLA', [], ['Matte'])).toBe('Matte');
  });
});
