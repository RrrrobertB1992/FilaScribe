import { describe, it, expect } from 'vitest';
import * as VL from '../src/lib/variantList.js';
import * as BC from '../src/lib/brandColors.js';
import { VARIANTS, VARIANT_INFO } from '../src/lib/catalog.js';
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

  it('toggles a kind, and hides several at once', () => {
    let h = VL.toggle([], 'Metallic');
    expect(h).toEqual(['Metallic']);
    expect(VL.toggle(h, 'Metal')).toEqual([]); // the same kind
    expect(VL.hideAll(['Glow'], ['Matte', 'Glow', 'Silk'])).toEqual(['Glow', 'Matte', 'Silk']);
  });
});

describe('variants in the brand data', () => {
  const kinds = (brands, materials) => BC.variantKinds(snapshot, brands, materials);
  const describeKind = (k) => `${k.main}${k.others.length ? ': ' + k.others.join(', ') : ''}`;

  it('lists one kind per card, the usual name first and the brands’ words A to Z', () => {
    const all = kinds(snapshot.brands.map((b) => b.name)).map(describeKind);
    expect(all).toContain('Metallic: Metal');
    expect(all).toContain('HF: High Speed, HS, Hyper, Rapid');
    expect(all).toContain('Lightweight: Aero, Air, Light Weight, LW');
    expect(all).toContain('Matte: Matt');
    expect(all.find((l) => l.startsWith('Multi-color'))).toBe('Multi-color: Gradient, Rainbow'); // no spelling-only duplicates
    // usual order: Basic, Plus, Matte, then SnapSpeed...
    expect(all.slice(0, 4).map((l) => l.split(':')[0])).toEqual(['Basic', 'Plus', 'Matte', 'SnapSpeed']);
    // shore hardness is last, one kind each
    const last = BC.variantKinds(snapshot, snapshot.brands.map((b) => b.name)).slice(-3);
    expect(last.every((k) => k.hardness)).toBe(true);
  });

  it('only lists what the enabled brands make', () => {
    const one = kinds(['Bambu Lab'], ['PLA']).map((k) => k.main);
    expect(one).toEqual(expect.arrayContaining(['Basic', 'Matte', 'Silk']));
    expect(one).not.toContain('SnapSpeed'); // Snapmaker's
    const bambuMetal = kinds(['Bambu Lab'], ['PLA']).find((k) => k.main === 'Metallic');
    expect(bambuMetal.others).toEqual(['Metal']);
    // Generic, a brand the database doesn't know, or no brands: nothing of their own
    expect(kinds(['Zephyr'], ['PLA'])).toEqual([]);
    expect(kinds([], ['PLA'])).toEqual([]);
    expect(kinds(['Generic'], ['PLA'])).toEqual([]);
  });

  it('only lists the materials shown: hardness comes with TPU', () => {
    expect(kinds(['Bambu Lab'], ['PLA']).some((k) => k.hardness)).toBe(false);
    expect(kinds(['Bambu Lab'], ['PLA', 'TPU']).some((k) => k.hardness)).toBe(true);
    expect(kinds(['Bambu Lab'], ['PLA', 'PLA+']).length).toBe(kinds(['Bambu Lab'], ['PLA']).length); // your own material adds nothing
  });

  it('always lists what is already hidden, flagged when no enabled brand has it', () => {
    const k = BC.variantKinds(snapshot, ['Bambu Lab'], ['PLA'], ['Rainbow', 'Matte']);
    expect(k.find((c) => c.main === 'Multi-color')).toMatchObject({ unused: true });
    expect(k.find((c) => c.main === 'Matte').unused).toBeUndefined();
    expect(BC.variantKinds(snapshot, [], [], ['Glow'])).toEqual([{ main: 'Glow', others: [], hardness: false, unused: true }]);
  });
});

describe('the default list', () => {
  it('a brand switch to Generic keeps the variant even when hidden', () => {
    expect(BC.carryVariant(snapshot, 'Matte', 'Generic', 'PLA', [], ['Matte'])).toBe('Matte');
    expect(BC.carryVariant(snapshot, 'Metal', 'Zephyr', 'PLA', [], ['Metallic'])).toBe('Metallic'); // the default list's word, not blanked by the hidden one
  });
});

describe('same kind', () => {
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

describe('what each kind is', () => {
  const all = BC.variantKinds(snapshot, snapshot.brands.map((b) => b.name)).filter((k) => !k.hardness);

  it('the short names (CF, GF, FR, HT, ESD, HF) say what they are', () => {
    for (const n of ['CF', 'GF', 'FR', 'HT', 'ESD', 'HF']) expect(VARIANT_INFO[n]).toBeTruthy();
    expect(VARIANT_INFO.CF).toMatch(/carbon fiber/i);
    expect(VARIANT_INFO.GF).toMatch(/glass fiber/i);
    expect(VARIANT_INFO.FR).toMatch(/flame retardant/i);
  });

  it('every description belongs to a kind that is listed', () => {
    const mains = all.map((k) => k.main);
    for (const name of Object.keys(VARIANT_INFO)) expect(mains).toContain(name);
  });

  it('is one short line', () => {
    for (const text of Object.values(VARIANT_INFO)) expect(text.length).toBeLessThan(60);
  });
});
