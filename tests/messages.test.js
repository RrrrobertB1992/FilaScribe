import { describe, it, expect } from 'vitest';
import * as Messages from '../src/lib/messages.js';

const m = (id, text, kind = 'ok') => ({ id, text, kind });

describe('messages', () => {
  it('keeps messages in the order they happened', () => {
    let list = [];
    list = Messages.push(list, m(1, 'a'));
    list = Messages.push(list, m(2, 'b', 'error'));
    list = Messages.push(list, m(3, 'c', 'info'));
    expect(list.map((x) => x.text)).toEqual(['a', 'b', 'c']);
  });

  it('only errors stay on their own', () => {
    expect(Messages.autoDismisses('ok')).toBe(true);
    expect(Messages.autoDismisses('info')).toBe(true);
    expect(Messages.autoDismisses('error')).toBe(false);
  });

  it('the same message again moves to the end instead of repeating', () => {
    let list = [m(1, 'Tag written.'), m(2, 'Oops', 'error')];
    list = Messages.push(list, m(3, 'Tag written.'));
    expect(list.map((x) => x.id)).toEqual([2, 3]);
  });

  it('too many fading messages drop the oldest, and never an error', () => {
    let list = [m(1, 'e1', 'error')];
    for (let i = 2; i <= 2 + Messages.MAX_SHOWN + 1; i++) list = Messages.push(list, m(i, `t${i}`));
    expect(list.filter((x) => x.kind === 'ok')).toHaveLength(Messages.MAX_SHOWN);
    expect(list[0].text).toBe('e1');
    expect(list.at(-1).text).toBe(`t${2 + Messages.MAX_SHOWN + 1}`);
  });

  it('drops one message by id', () => {
    expect(Messages.drop([m(1, 'a'), m(2, 'b')], 1).map((x) => x.id)).toEqual([2]);
  });
});
