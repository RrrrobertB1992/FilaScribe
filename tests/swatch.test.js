import { describe, it, expect } from 'vitest';
import { around, diagonal, vertical, circleFill, tileFill } from '../src/lib/swatch.js';

describe('swatch backgrounds', () => {
  it('one color is just that color, and none is white', () => {
    expect(around(['FF0000'])).toBe('#FF0000');
    expect(diagonal(['ff0000'])).toBe('#ff0000');
    expect(around([])).toBe('#FFFFFF');
  });

  it('segments go around the circle with the first color on the left', () => {
    expect(around(['111111', '222222'])).toBe('conic-gradient(from 180deg, #111111 0deg 180deg, #222222 180deg 360deg)');
  });

  it('a gradient loops back to the first color so there is no seam', () => {
    expect(around(['111111', '222222', '333333'], true)).toBe('conic-gradient(from 180deg, #111111, #222222, #333333, #111111)');
  });

  it('a tile gets the same colors as bands at an angle', () => {
    expect(diagonal(['111111', '222222', '333333', '444444'])).toContain('linear-gradient(135deg, #111111 0% 25%, #222222 25% 50%');
    expect(diagonal(['111111', '222222'], true)).toBe('linear-gradient(135deg, #111111, #222222)');
  });

  it('accepts colors that already start with #', () => {
    expect(around(['#111111', '#222222'])).toBe(around(['111111', '222222']));
  });

  it('vertical bands sit side by side, first color on the left', () => {
    expect(vertical(['111111', '222222'])).toBe('linear-gradient(90deg, #111111 0% 50%, #222222 50% 100%)');
    expect(vertical(['111111', '222222'], true)).toBe('linear-gradient(90deg, #111111, #222222)');
    expect(vertical(['111111'])).toBe('#111111');
  });

  it('a circle or tile follows the chosen style, and anything unknown falls back', () => {
    const c = ['111111', '222222'];
    expect(circleFill(c, false, 'vertical')).toBe(vertical(c));
    expect(circleFill(c, false, 'angled')).toBe(diagonal(c));
    expect(circleFill(c)).toBe(around(c));
    expect(circleFill(c, false, 'nonsense')).toBe(around(c));
    expect(tileFill(c, false, 'vertical')).toBe(vertical(c));
    expect(tileFill(c)).toBe(diagonal(c));
    expect(tileFill(c, false, 'around')).toBe(diagonal(c));
  });
});
