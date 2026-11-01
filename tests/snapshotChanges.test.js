import { describe, it, expect } from 'vitest';
import { diffColors, diffNames, renderChanges } from '../scripts/snapshot-changes.js';

const brand = (name, colors, line = 'PLA') => ({ name, materials: { PLA: [{ name: line, colors }] } });
const before = [
  brand('Acme', [['Red', 'FF0000', '', ''], ['Gone', '111111', '', ''], ['Dual', 'FF0000', 'c', '']]),
  brand('Old Co', [['Blue', '0000FF', '', '']]),
  brand('Same', [['Green', '00FF00', '', '']]),
];
const after = [
  brand('Acme', [['Red', 'FF0000', '', ''], ['Fresh', '222222', 's', ''], ['Dual', 'FF0000,00FF00', 'c', '']]),
  brand('New Co', [['Pink', 'FF69B4', '', '']]),
  brand('Same', [['Green', '00FF00', '', '']]),
];

describe('snapshot changes', () => {
  const d = diffColors(before, after);

  it('finds added, removed and changed colors per brand, and ignores brands that did not change', () => {
    expect(d.brands.get('Acme').added.map((c) => c.name)).toEqual(['Fresh']);
    expect(d.brands.get('Acme').removed.map((c) => c.name)).toEqual(['Gone']);
    expect(d.brands.get('Acme').changed.map((c) => [c.name, c.oldHex, c.hex])).toEqual([['Dual', 'FF0000', 'FF0000,00FF00']]);
    expect(d.brands.has('Same')).toBe(false);
    expect(d.newBrands).toEqual(['New Co']);
    expect(d.goneBrands).toEqual(['Old Co']);
  });

  it('notices a changed tag even when the colors are the same', () => {
    const c = diffColors([brand('A', [['X', 'FF0000', 'c', '']])], [brand('A', [['X', 'FF0000', '', '']])]);
    expect(c.brands.get('A').changed).toHaveLength(1);
  });

  it('lists brand names added and removed', () => {
    expect(diffNames(['A', 'B'], ['B', 'C'])).toEqual({ added: ['C'], removed: ['A'] });
  });

  it('renders a summary and one collapsible section per brand', () => {
    const md = renderChanges(d, { added: ['Zed'], removed: [] });
    expect(md).toContain('**Colors:** 2 added, 2 removed, 1 changed in 3 brands');
    expect(md).toContain('**New brands:** New Co');
    expect(md).toContain('<summary><b>Acme</b>: 1 added, 1 removed, 1 changed</summary>');
    expect(md).toContain('`FF0000` → `FF0000 00FF00`');
    expect(md).toContain('➕ Zed');
    expect(md.match(/<details>/g)).toHaveLength(4); // Acme, New Co, Old Co, brand names
  });

  it('says nothing when nothing changed', () => {
    expect(renderChanges(diffColors(before, before), { added: [], removed: [] })).toBe('');
  });

  it('stays under the size limit and says how many brands it left out', () => {
    const many = Array.from({ length: 50 }, (_, i) => brand(`Brand ${i}`, Array.from({ length: 20 }, (_, j) => [`Color ${j}`, 'FF0000', '', ''])));
    const md = renderChanges(diffColors([], many), { added: [], removed: [] }, 5000);
    expect(md.length).toBeLessThan(5500);
    expect(md).toMatch(/\d+ more brands not listed/);
  });

  it('escapes angle brackets in names', () => {
    const md = renderChanges(diffColors([], [brand('A<b>', [['X', 'FF0000', '', '']])]), { added: [], removed: [] });
    expect(md).toContain('A&lt;b&gt;');
  });
});
