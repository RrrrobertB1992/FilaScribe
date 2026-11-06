import { describe, it, expect } from 'vitest';
import { bump, snapshot, restore, changes, FIELDS } from '../src/lib/quickEdits.js';

describe('bump', () => {
  it('steps a number up and down', () => {
    expect(bump('weight', '1000', 10)).toBe('1010');
    expect(bump('weight', '1000', -50)).toBe('950');
    expect(bump('maxTemp', '220', 5)).toBe('225');
    expect(bump('minTemp', '190', -5)).toBe('185');
  });

  it('stops at 0 and at the field maximum', () => {
    expect(bump('weight', '30', -50)).toBe('0');
    expect(bump('weight', '0', -10)).toBe('0');
    expect(bump('maxTemp', '498', 5)).toBe('500');
    expect(bump('weight', '99990', 50)).toBe('99999');
  });

  it('starts an empty field from its start value on the first tap up', () => {
    expect(bump('weight', '', 10)).toBe(String(FIELDS.weight.start));
    expect(bump('weight', '', 50)).toBe('1000');
    expect(bump('minTemp', undefined, 5)).toBe('200');
    expect(bump('maxTemp', '  ', 5)).toBe('200');
  });

  it('leaves an empty field alone on a tap down', () => {
    expect(bump('weight', '', -10)).toBe('');
    expect(bump('minTemp', undefined, -5)).toBe('');
  });

  it('treats text that is not a whole number like an empty field', () => {
    expect(bump('weight', '12.5', 10)).toBe('1000');
    expect(bump('weight', 'abc', -10)).toBe('abc');
    expect(bump('weight', '-5', 10)).toBe('1000');
  });

  it('copes with spaces around a number', () => {
    expect(bump('weight', ' 500 ', 10)).toBe('510');
  });
});

describe('snapshot and changes', () => {
  const form = { weight: '1000', minTemp: '190', maxTemp: '220', brand: 'X' };

  it('keeps just the quick-edit fields as text', () => {
    expect(snapshot({ ...form, weight: undefined })).toEqual({ weight: '', minTemp: '190', maxTemp: '220', colors: [], colorType: '' });
  });

  it('lists nothing when nothing changed', () => {
    expect(changes(snapshot(form), form)).toEqual([]);
  });

  it('lists each change with its old value', () => {
    const before = snapshot(form);
    expect(changes(before, { ...form, weight: '750', maxTemp: '225' })).toEqual([
      { field: 'weight', label: 'Weight', now: '750 g', was: '1000 g' },
      { field: 'maxTemp', label: 'Nozzle max', now: '225 °C', was: '220 °C' },
    ]);
  });

  it('says "not set" for a field that was or became empty', () => {
    const before = snapshot({ ...form, weight: '' });
    expect(changes(before, form)).toEqual([{ field: 'weight', label: 'Weight', now: '1000 g', was: 'not set' }]);
    expect(changes(snapshot(form), { ...form, minTemp: '' })).toEqual([{ field: 'minTemp', label: 'Nozzle min', now: 'not set', was: '190 °C' }]);
  });

  it('stops listing a change that was put back', () => {
    const before = snapshot(form);
    expect(changes(before, { ...form, weight: '1010' })).toHaveLength(1);
    expect(changes(before, { ...form, weight: '1000' })).toEqual([]);
  });

  it('ignores spaces and a missing snapshot', () => {
    expect(changes(snapshot(form), { ...form, weight: ' 1000 ' })).toEqual([]);
    expect(changes(undefined, form).map((c) => c.field)).toEqual(['weight', 'minTemp', 'maxTemp']);
  });
});

describe('color in the changes', () => {
  const tag = { weight: '1000', minTemp: '190', maxTemp: '220', colors: ['1E4FA0'], colorType: '1' };

  it('keeps the colors in the snapshot, as its own copy', () => {
    const before = snapshot(tag);
    tag.colors.push('FFFFFF');
    expect(before.colors).toEqual(['1E4FA0']);
    tag.colors.pop();
  });

  it('lists a new color with what it was, and the name of a brand color', () => {
    const before = snapshot(tag);
    expect(changes(before, { ...tag, colors: ['0056B8'] })).toEqual([{ field: 'color', label: 'Color', now: '#0056B8', was: '#1E4FA0' }]);
    expect(changes(before, { ...tag, colors: ['0056B8'] }, 'Cobalt Blue')[0].now).toBe('Cobalt Blue #0056B8');
  });

  it('lists several colors in order, and nothing when they are back as they were', () => {
    const before = snapshot({ ...tag, colors: ['FF0000', '00FF00'] });
    expect(changes(before, { ...tag, colors: ['00FF00', 'FF0000'] })[0]).toMatchObject({ now: '#00FF00 + #FF0000', was: '#FF0000 + #00FF00' });
    expect(changes(before, { ...tag, colors: ['ff0000', '00ff00'] })).toEqual([]);
  });

  it('restore gives the colors back as a new list', () => {
    const before = snapshot(tag);
    const back = restore(before);
    back.colors.push('000000');
    expect(before.colors).toEqual(['1E4FA0']);
    expect(back).toMatchObject({ weight: '1000', colorType: '1' });
  });
});
