import { describe, it, expect } from 'vitest';
import snapshot from '../src/data/brand-colors.json' with { type: 'json' };
import orca from '../src/data/orca-vendors.json' with { type: 'json' };
import * as DB from '../src/lib/colorDatabase.js';
import * as Auto from '../src/lib/colorAutoUpdate.js';
import * as Backup from '../src/lib/backup.js';
import { memoryStorage as localStorageFake } from './storage.js';
import { toAll, manifestFor } from './ofdFixture.js';

const clone = (x) => JSON.parse(JSON.stringify(x));
const builtIn = { colors: snapshot, orca, origin: 'built-in' };

function newer(date = '2099-01-01') {
  const next = clone(snapshot);
  next.source = { ...next.source, commit: 'f'.repeat(40), date };
  Object.values(next.brands[0].materials)[0][0].colors.push(['Brand New Color', 'ABCDEF', '', '']);
  return next;
}

// The API from memory, counting how often the big file is downloaded. `built` is the build time the manifest reports.
function api(colors, built) {
  const all = toAll(colors);
  if (built) all.generated_at = built;
  const calls = { all: 0 };
  const fetchImpl = async (url) => {
    if (url.endsWith('manifest.json')) return { ok: true, status: 200, json: async () => manifestFor(all) };
    calls.all++;
    return { ok: true, status: 200, json: async () => all };
  };
  return { fetchImpl, calls };
}

const place = (initial = null) => {
  let value = initial;
  return { read: async () => value, write: async (v) => void (value = v), clear: async () => void (value = null), peek: () => value };
};

describe('what to do at app start', () => {
  const plan = (age, auto, pending = false) => DB.bootPlan({ age, auto, pending });
  it('updates by itself from 7 days when the switch is on', () => {
    expect(plan(6, true)).toBe('none');
    expect(plan(7, true)).toBe('auto-update');
  });
  it('only offers the download from 30 days when the switch is off', () => {
    expect(plan(29, false)).toBe('none');
    expect(plan(30, false)).toBe('offer-download');
    expect(plan(200, true)).toBe('auto-update');
  });
  it('uses a waiting update first: installs it with the switch on, reminds you with it off', () => {
    expect(plan(1, true, true)).toBe('install-pending');
    expect(plan(100, false, true)).toBe('show-pending'); // not also the 30 day message
  });
  it('does nothing when the age is unknown', () => {
    expect(plan(null, true)).toBe('none');
    expect(plan(null, false)).toBe('none');
  });
});

describe('keeping an update that is not installed yet', () => {
  it('saves a found update and reuses it for the same build without downloading again', async () => {
    const pendingStore = place();
    const local = localStorageFake();
    const { fetchImpl, calls } = api(newer(), '2099-01-01T22:15:00Z');
    const first = await DB.checkAndRemember(builtIn, { fetchImpl, pendingStore, local });
    expect(first.status).toBe('update');
    expect(calls.all).toBe(1);
    expect(pendingStore.peek().built).toBe('2099-01-01T22:15:00Z');
    const again = await DB.checkAndRemember(builtIn, { fetchImpl, pendingStore, local });
    expect(again.status).toBe('update');
    expect(again.fromCache).toBe(true);
    expect(calls.all).toBe(1);
  });

  it('downloads again when a newer build is out, and keeps that one instead', async () => {
    const pendingStore = place();
    const local = localStorageFake();
    await DB.checkAndRemember(builtIn, { ...api(newer(), '2099-01-01T22:15:00Z'), pendingStore, local });
    const later = api(newer('2099-01-02'), '2099-01-02T22:15:00Z');
    const r = await DB.checkAndRemember(builtIn, { fetchImpl: later.fetchImpl, pendingStore, local });
    expect(later.calls.all).toBe(1);
    expect(r.info.date).toBe('2099-01-02');
    expect(pendingStore.peek().colors.source.date).toBe('2099-01-02');
  });

  it('forgets a waiting update the app already has something as new as', async () => {
    const stale = place({ colors: clone(snapshot), built: 'x' });
    expect(await DB.loadPending(builtIn, { storage: stale })).toBeNull();
    expect(stale.peek()).toBeNull();
    const broken = place({ colors: { brands: [] }, built: 'x' });
    expect(await DB.loadPending(builtIn, { storage: broken })).toBeNull();
    expect(broken.peek()).toBeNull();
    const good = place({ colors: newer(), built: 'x' });
    expect((await DB.loadPending(builtIn, { storage: good })).status).toBe('update');
  });

  it('is cleared when the update is installed', async () => {
    const pendingStore = place({ colors: newer(), built: 'x' });
    const store = place();
    await DB.applyUpdate({ colors: newer() }, store, pendingStore);
    expect(store.peek().colors.source.date).toBe('2099-01-01');
    expect(pendingStore.peek()).toBeNull();
  });

  it('is still fine when it can’t be saved', async () => {
    const full = { ...place(), write: async () => { throw new Error('full'); } };
    const r = await DB.checkAndRemember(builtIn, { ...api(newer(), 'b1'), pendingStore: full, local: localStorageFake() });
    expect(r.status).toBe('update');
  });
});

describe('a build with no color changes', () => {
  it('is remembered, so the big file is not downloaded for it again', async () => {
    const pendingStore = place();
    const local = localStorageFake();
    // Newer date, same colors
    const same = clone(snapshot);
    same.source = { ...same.source, commit: 'e'.repeat(40), date: '2099-02-01' };
    const { fetchImpl, calls } = api(same, '2099-02-01T22:15:00Z');
    expect((await DB.checkAndRemember(builtIn, { fetchImpl, pendingStore, local })).status).toBe('current');
    expect(calls.all).toBe(1);
    expect(DB.loadSeen(local).built).toBe('2099-02-01T22:15:00Z');
    expect((await DB.checkAndRemember(builtIn, { fetchImpl, pendingStore, local })).status).toBe('current');
    expect(calls.all).toBe(1);
    // A later build is looked at again
    const later = api(same, '2099-02-02T22:15:00Z');
    await DB.checkAndRemember(builtIn, { fetchImpl: later.fetchImpl, pendingStore, local });
    expect(later.calls.all).toBe(1);
  });

  it('counts as the newest from the time it was confirmed', async () => {
    const local = localStorageFake();
    const { fetchImpl } = api(clone(snapshot));
    await DB.checkAndRemember(builtIn, { fetchImpl, pendingStore: place(), local });
    expect(Date.now() - Date.parse(DB.loadSeen(local).at)).toBeLessThan(5000);
  });

  it('ignores junk', () => {
    expect(DB.loadSeen({ getItem: () => 'not json' })).toEqual({ built: '', at: '' });
    expect(DB.loadSeen({ getItem: () => '{"built":5,"at":"nope"}' })).toEqual({ built: '', at: '' });
  });
});

describe('Update automatically', () => {
  it('is off until turned on, and ignores junk', () => {
    const s = localStorageFake();
    expect(Auto.load(s)).toBe(false);
    Auto.store(true, s);
    expect(Auto.load(s)).toBe(true);
    Auto.store(false, s);
    expect(Auto.load(s)).toBe(false);
    expect(Auto.load({ getItem: () => 'yes' })).toBe(false);
    expect(Auto.load({ getItem: () => { throw new Error('blocked'); } })).toBe(false);
  });

  it('is in the backup, and an old backup restores it as off', () => {
    const s = localStorageFake();
    Auto.store(true, s);
    expect(Backup.snapshot(s).colorAutoUpdate).toBe(true);
    const t = localStorageFake();
    Backup.apply({ ...Backup.snapshot(s) }, t);
    expect(Auto.load(t)).toBe(true);
    const old = Backup.snapshot(s);
    delete old.colorAutoUpdate;
    const u = localStorageFake();
    Auto.store(true, u);
    Backup.apply(Backup.parse(Backup.build(old)), u);
    expect(Auto.load(u)).toBe(false);
  });
});
