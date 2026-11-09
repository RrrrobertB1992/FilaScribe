import { describe, it, expect } from 'vitest';
import snapshot from '../src/data/brand-colors.json' with { type: 'json' };
import orca from '../src/data/orca-vendors.json' with { type: 'json' };
import * as DB from '../src/lib/colorDatabase.js';
import { withOrcaNames } from '../src/lib/brandColors.js';
import { loadBrandColors } from '../src/lib/brandColorsData.js';
import { memoryStorage as localStorageFake } from './storage.js';
import { toAll, manifestFor } from './ofdFixture.js';

const clone = (x) => JSON.parse(JSON.stringify(x));
const builtIn = { colors: snapshot, orca, origin: 'built-in' };

// A fetch that serves the database's API from memory: the manifest and the
// all-in-one download, both made from a snapshot. `manifest: false` leaves the manifest out.
const server = (colors, status = 200, { manifest = true } = {}) => async (url) => {
  const all = toAll(colors);
  if (url.endsWith('manifest.json')) return manifest ? { ok: true, status: 200, json: async () => manifestFor(all) } : { ok: false, status: 404 };
  return { ok: status === 200, status, json: async () => all };
};

const memoryStorage = (initial = null, { failWrite = false, failClear = false, failRead = false } = {}) => {
  let value = initial;
  return {
    read: async () => {
      if (failRead) throw new Error('no storage');
      return value;
    },
    write: async (v) => {
      if (failWrite) throw new Error('full');
      value = v;
    },
    clear: async () => {
      if (failClear) throw new Error('blocked');
      value = null;
    },
    peek: () => value,
  };
};

// A newer snapshot: one new color in the first brand's first line, a new brand
function newer() {
  const next = clone(snapshot);
  next.source = { ...next.source, commit: 'f'.repeat(40), date: '2026-12-01' };
  const first = next.brands[0];
  const line = Object.values(first.materials)[0][0];
  line.colors.push(['Brand New Color', 'ABCDEF', '', '']);
  next.brands.push({ name: 'Zeta Filaments', keys: ['zeta'], materials: { PLA: [{ name: 'Zeta PLA', temps: [190, 220, 0, 50], traits: '', colors: [['Red', 'FF0000', '', '']] }] } });
  return next;
}

describe('color database info', () => {
  it('counts the brands and colors of the bundled snapshot', () => {
    const info = DB.describe(builtIn);
    expect(info.origin).toBe('built-in');
    expect(info.date).toBe(snapshot.source.date);
    expect(info.brands).toBe(snapshot.brands.length);
    expect(info.colors).toBe(DB.countColors(snapshot));
    expect(info.colors).toBeGreaterThan(1000);
    expect(info.orcaDate).toBe(orca.source.date);
  });

  it('loadBrandColors carries that info and the Orca-named brand list', async () => {
    const db = await loadBrandColors();
    expect(db.info.origin).toBe('built-in');
    expect(db.info.brands).toBe(snapshot.brands.length);
    expect(db.brands.length).toBeGreaterThanOrEqual(snapshot.brands.length);
  });
});

describe('how old the database is', () => {
  const now = new Date('2026-12-15T12:00:00Z');
  it('counts whole days', () => {
    expect(DB.ageDays('2026-12-14', now)).toBe(1);
    expect(DB.ageDays('2026-12-15', now)).toBe(0);
  });
  it('is only old after 35 days', () => {
    expect(DB.isOld('2026-11-10', now)).toBe(false); // 35 days
    expect(DB.isOld('2026-11-09', now)).toBe(true); // 36 days
  });
  it('does not call an unreadable date old', () => {
    expect(DB.ageDays('', now)).toBeNull();
    expect(DB.isOld('last week', now)).toBe(false);
  });
});

describe('checking a downloaded database', () => {
  it('accepts the real snapshot', () => {
    expect(DB.problemWith(snapshot, { builtInColors: DB.countColors(snapshot) })).toBe('');
  });
  it('refuses files that are not a database', () => {
    expect(DB.problemWith(null)).toBeTruthy();
    expect(DB.problemWith([])).toBeTruthy();
    expect(DB.problemWith({ brands: [] })).toBeTruthy();
    expect(DB.problemWith({ source: snapshot.source, brands: [] })).toBeTruthy();
  });
  it('refuses a missing date and a malformed color', () => {
    const noDate = clone(snapshot);
    noDate.source.date = 'yesterday';
    expect(DB.problemWith(noDate)).toBe('no date');
    const bad = clone(snapshot);
    Object.values(bad.brands[0].materials)[0][0].colors[0] = 'Black';
    expect(DB.problemWith(bad)).toBe('a color is malformed');
  });
  it('refuses a file with far fewer colors than the built-in one', () => {
    const cut = clone(snapshot);
    cut.brands = cut.brands.slice(0, 3);
    expect(DB.problemWith(cut, { builtInColors: DB.countColors(snapshot) })).toBe('far fewer colors than expected');
  });
});

describe('checking for an update', () => {
  it('says current when nothing changed', async () => {
    const r = await DB.checkForUpdate(builtIn, { fetchImpl: server(snapshot) });
    expect(r.status).toBe('current');
  });

  it('finds a newer database and what changed', async () => {
    const next = newer();
    const r = await DB.checkForUpdate(builtIn, { fetchImpl: server(next) });
    expect(r.status).toBe('update');
    expect(r.info.date).toBe('2026-12-01');
    expect(r.info.colors).toBe(DB.countColors(snapshot) + 2);
    expect(r.info.origin).toBe('downloaded');
    expect(DB.summarize(r.changes)).toEqual({ newBrands: 1, goneBrands: 0, added: 2, removed: 0, changed: 0 });
    expect(r.overrides).toEqual({ changed: 0, gone: 0 });
  });

  it('skips the big download when the manifest shows nothing newer', async () => {
    const seen = [];
    const fetchImpl = async (url) => {
      seen.push(url);
      return server(snapshot)(url);
    };
    expect((await DB.checkForUpdate(builtIn, { fetchImpl })).status).toBe('current');
    expect(seen.some((u) => u.endsWith('all.json'))).toBe(false);
  });

  it('still checks when the manifest can’t be read, and reports progress', async () => {
    const steps = [];
    const r = await DB.checkForUpdate(builtIn, { fetchImpl: server(newer(), 200, { manifest: false }), onProgress: (p) => steps.push(p.stage) });
    expect(r.status).toBe('update');
    expect(steps).toEqual(['download', 'build']);
  });

  it('keeps the brand names built into the app', async () => {
    const r = await DB.checkForUpdate(builtIn, { fetchImpl: server(newer()) });
    expect(r.next.orca).toBe(orca);
    const store = memoryStorage({ colors: newer(), orca: { vendors: ['Old Download'], source: { date: '2020-01-01' } } });
    expect((await DB.pickSource({ colors: snapshot, orca }, store)).orca).toBe(orca);
  });

  it('never swaps in a database older than the one in use', async () => {
    const older = newer();
    older.source.date = '2020-01-01';
    const r = await DB.checkForUpdate(builtIn, { fetchImpl: server(older) });
    expect(r.status).toBe('current');
  });

  it('asks the database for its files without using a stale copy', async () => {
    const seen = [];
    await DB.checkForUpdate(builtIn, {
      base: 'https://example.test/',
      fetchImpl: async (url, init) => {
        seen.push([url, init.cache]);
        return server(newer())(url);
      },
    });
    expect(seen).toEqual([
      ['https://example.test/manifest.json', 'no-cache'],
      ['https://example.test/json/all.json', 'no-cache'],
    ]);
  });

  it('explains an offline phone, a missing file and a bad file', async () => {
    const offline = DB.checkForUpdate(builtIn, { fetchImpl: async () => { throw new TypeError('Failed to fetch'); } });
    await expect(offline).rejects.toThrow(/Couldn’t reach the update/);
    await expect(DB.checkForUpdate(builtIn, { fetchImpl: server(newer(), 404) })).rejects.toThrow(/\(404\)/);
    const notJson = DB.checkForUpdate(builtIn, { fetchImpl: async () => ({ ok: true, status: 200, json: async () => { throw new SyntaxError('x'); } }) });
    const wrongFile = DB.checkForUpdate(builtIn, { fetchImpl: async () => ({ ok: true, status: 200, json: async () => ({ hello: 'world' }) }) });
    await expect(wrongFile).rejects.toThrow(/wasn’t a database file/);
    await expect(notJson).rejects.toThrow(/wasn’t a database file/);
    await expect(DB.checkForUpdate(builtIn, { fetchImpl: server({ source: { date: '2026-12-01' }, brands: [] }) })).rejects.toThrow(/didn’t look right/);
    await expect(DB.checkForUpdate(builtIn, { fetchImpl: server(newer(), 500) })).rejects.toBeInstanceOf(DB.UpdateError);
  });
});

describe('your color overrides and an update', () => {
  // The first brand under the name the app shows (Orca's spelling), its first color
  const shown = withOrcaNames(snapshot, orca.vendors).brands[0];
  const material = Object.keys(shown.materials)[0];
  const line = shown.materials[material][0];
  const color = line.colors[0];
  const edit = { brand: shown.name, material, line: line.name, color: color[0], hex: '123456', was: color[1] };
  const firstLine = (db) => Object.values(db.brands[0].materials)[0][0];

  it('counts an override whose database color changed', () => {
    const next = clone(snapshot);
    firstLine(next).colors[0][1] = color[1] === 'ABCDEF' ? '654321' : 'ABCDEF';
    expect(DB.overridesImpact(builtIn, { colors: next, orca }, [edit])).toEqual({ changed: 1, gone: 0 });
  });

  it('counts an override whose color is gone', () => {
    const next = clone(snapshot);
    firstLine(next).colors.splice(0, 1);
    expect(DB.overridesImpact(builtIn, { colors: next, orca }, [edit])).toEqual({ changed: 0, gone: 1 });
  });

  it('does not count one the update leaves alone', () => {
    expect(DB.overridesImpact(builtIn, { colors: newer(), orca }, [edit])).toEqual({ changed: 0, gone: 0 });
  });

  it('is zero without overrides', () => {
    expect(DB.overridesImpact(builtIn, builtIn, [])).toEqual({ changed: 0, gone: 0 });
  });

  it('is part of an update check', async () => {
    const next = clone(snapshot);
    next.source = { ...next.source, commit: 'e'.repeat(40), date: '2026-12-01' };
    firstLine(next).colors.splice(0, 1);
    const r = await DB.checkForUpdate(builtIn, { edits: [edit], fetchImpl: server(next) });
    expect(r.overrides).toEqual({ changed: 0, gone: 1 });
  });
});

describe('keeping the downloaded copy', () => {
  const down = () => ({ colors: newer(), orca });

  it('uses a downloaded copy that is newer than the built-in one', async () => {
    const src = await DB.pickSource({ colors: snapshot, orca }, memoryStorage(down()));
    expect(src.origin).toBe('downloaded');
    expect(src.colors.source.date).toBe('2026-12-01');
  });

  it('ignores one that is older, broken, or unreadable', async () => {
    const old = down();
    old.colors.source.date = '2000-01-01';
    expect((await DB.pickSource({ colors: snapshot, orca }, memoryStorage(old))).origin).toBe('built-in');
    expect((await DB.pickSource({ colors: snapshot, orca }, memoryStorage({ colors: { brands: [] }, orca }))).origin).toBe('built-in');
    expect((await DB.pickSource({ colors: snapshot, orca }, memoryStorage(null))).origin).toBe('built-in');
    expect((await DB.pickSource({ colors: snapshot, orca }, memoryStorage(null, { failRead: true }))).origin).toBe('built-in');
  });

  it('saves an update, and going back to the built-in copy removes it', async () => {
    const store = memoryStorage();
    await DB.applyUpdate({ colors: newer(), orca }, store);
    expect(store.peek().colors.source.date).toBe('2026-12-01');
    expect((await DB.pickSource({ colors: snapshot, orca }, store)).origin).toBe('downloaded');
    await DB.useBuiltIn(store);
    expect(store.peek()).toBeNull();
    expect((await DB.pickSource({ colors: snapshot, orca }, store)).origin).toBe('built-in');
  });

  it('says so when it can’t save or remove', async () => {
    await expect(DB.applyUpdate({ colors: newer(), orca }, memoryStorage(null, { failWrite: true }))).rejects.toBeInstanceOf(DB.UpdateError);
    await expect(DB.useBuiltIn(memoryStorage(null, { failClear: true }))).rejects.toBeInstanceOf(DB.UpdateError);
  });
});

describe('when it was last checked', () => {
  it('remembers the time, and starts out empty', () => {
    const s = localStorageFake();
    expect(DB.loadChecked(s)).toBe('');
    DB.storeChecked('2026-11-04T12:00:00.000Z', s);
    expect(DB.loadChecked(s)).toBe('2026-11-04T12:00:00.000Z');
  });
  it('ignores junk', () => {
    expect(DB.loadChecked({ getItem: () => '{"at":"nope"}' })).toBe('');
    expect(DB.loadChecked({ getItem: () => 'not json' })).toBe('');
  });
});
