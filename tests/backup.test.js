import { describe, it, expect } from 'vitest';
import * as Backup from '../src/lib/backup.js';
import * as Filaments from '../src/lib/filaments.js';
import * as SC from '../src/lib/savedColors.js';
import { memoryStorage, brokenStorage } from './storage.js';

const spool = (over = {}) => ({
  profile: 'u1', brand: 'Polymaker', type: 'PLA', subtype: 'Matte', minTemp: '190', maxTemp: '220',
  bedMinTemp: '50', bedMaxTemp: '60', colors: ['2B2B2D'], colorName: 'Galaxy Black', ...over,
});

function filled() {
  const s = memoryStorage();
  s.setItem(Filaments.STORAGE_KEY, JSON.stringify([spool(), spool({ colors: ['FF0000'], colorName: 'Red' })]));
  s.setItem(Filaments.AUTO_KEY, '1');
  s.setItem(SC.STORAGE_KEY, JSON.stringify({ 'Generic|PETG': [{ colors: ['ABCDEF'], name: 'Sky', variants: ['Basic'] }] }));
  s.setItem('filascribe-color-overrides', JSON.stringify([{ brand: 'Polymaker', material: 'PLA', line: '*', color: 'Red', hex: 'FF1111', was: 'FF0000' }]));
  s.setItem('filascribe-custom-chips', JSON.stringify({ brands: ['Zephyr'], materials: ['PLA+'], variants: { 'Zephyr|PLA+': ['Rapid'] } }));
  s.setItem('filascribe-brands', JSON.stringify({ shown: ['Polymaker', 'Zephyr'] }));
  s.setItem('filascribe-materials', JSON.stringify({ shown: ['PLA', 'PLA+'] }));
  s.setItem('filascribe-variants', JSON.stringify({ hidden: ['Silk'] }));
  s.setItem('filascribe-defaults', JSON.stringify({ brand: 'Polymaker', type: 'PETG' }));
  s.setItem('filascribe-closest-colors', '5');
  s.setItem('filascribe-closest-closeness', 'loose');
  s.setItem('filascribe-theme', 'dark');
  s.setItem('filascribe-motion-speed', 'slow');
  s.setItem('filascribe-open-mode', 'close');
  return s;
}

describe('backup: save and restore', () => {
  it('a snapshot survives being built, written out and read back', () => {
    const data = Backup.snapshot(filled());
    const file = JSON.parse(JSON.stringify(Backup.build(data, new Date('2026-11-06T12:00:00Z'))));
    expect(file).toMatchObject({ app: 'FilaScribe backup', version: 1, made: '2026-11-06T12:00:00.000Z' });
    expect(Backup.parse(file)).toEqual(data);
  });

  it('keeps every setting and list', () => {
    const d = Backup.snapshot(filled());
    expect(d.filaments).toHaveLength(2);
    expect(d.autoFilaments).toBe(true);
    expect(Object.keys(d.savedColors)).toEqual(['Generic|PETG']);
    expect(d.colorOverrides).toHaveLength(1);
    expect(d.customChips.variants['Zephyr|PLA+']).toEqual(['Rapid']);
    expect(d.brands).toEqual(['Polymaker', 'Zephyr']);
    expect(d.materials).toEqual(['PLA', 'PLA+']);
    expect(d.hiddenVariants).toEqual(['Silk']);
    expect(d.defaults).toEqual({ brand: 'Polymaker', type: 'PETG' });
    expect(d.closestColors).toBe(5);
    expect(d.closestCloseness).toBe('loose');
    expect(d.theme).toBe('dark');
    expect(d.motionSpeed).toBe('slow');
    expect(d.openMode).toBe('close');
  });

  it('leaves out the downloaded color database and which cards are open', () => {
    const s = filled();
    s.setItem('filascribe-color-database', 'big');
    s.setItem('filascribe-settings-open', '["backup"]');
    const out = JSON.stringify(Backup.snapshot(s));
    expect(out).not.toContain('big');
    expect(out).not.toContain('backup"]');
  });

  it('applies a backup to an empty device and gets the same snapshot back', () => {
    const data = Backup.snapshot(filled());
    const fresh = memoryStorage();
    Backup.apply(data, fresh);
    expect(Backup.snapshot(fresh)).toEqual(data);
  });

  it('names the file by date', () => {
    expect(Backup.backupName(new Date('2026-11-06T12:00:00Z'))).toBe('filascribe-backup-2026-11-06.json');
  });
});

describe('backup: files that are not backups', () => {
  it.each([
    ['null', null],
    ['a list', []],
    ['another app', { app: 'Other', version: 1, data: {} }],
    ['a saved-colors export', { 'Generic|PETG': [{ colors: ['AABBCC'] }] }],
    ['no data', { app: 'FilaScribe backup', version: 1 }],
    ['data that is a list', { app: 'FilaScribe backup', version: 1, data: [] }],
    ['no version', { app: 'FilaScribe backup', data: {} }],
  ])('rejects %s', (_, file) => {
    expect(() => Backup.parse(file)).toThrow();
  });

  it('rejects a backup from a newer version', () => {
    expect(() => Backup.parse({ app: 'FilaScribe backup', version: 2, data: {} })).toThrow('Newer backup');
  });

  it('cleans junk inside a real backup instead of keeping it', () => {
    const d = Backup.parse({
      app: 'FilaScribe backup', version: 1,
      data: {
        filaments: [spool(), { brand: 5 }, 'x'],
        savedColors: { 'bad key': [{ colors: ['000000'] }], 'Generic|PLA': [{ colors: ['nothex', 'aabbcc'], name: 'A', variants: [''] }] },
        colorOverrides: 'nope',
        customChips: { brands: ['Ok', 3], materials: 'no', variants: [] },
        brands: ['Polymaker', 'Generic', 7],
        hiddenVariants: 'nope',
        defaults: { brand: 'X', evil: 'y' },
        closestColors: 99,
        closestCloseness: 'very',
        theme: 'purple',
        motionSpeed: 'warp',
        openMode: 'both',
      },
    });
    expect(d.filaments).toHaveLength(1);
    expect(Object.keys(d.savedColors)).toEqual(['Generic|PLA']);
    expect(d.savedColors['Generic|PLA'][0].colors).toEqual(['AABBCC']);
    expect(d.colorOverrides).toEqual([]);
    expect(d.customChips).toEqual({ brands: ['Ok'], materials: [], variants: {} });
    expect(d.brands).toEqual(['Polymaker']);
    expect(d.hiddenVariants).toEqual([]);
    expect(d.defaults).toEqual({ brand: 'X' });
    expect(d.closestColors).toBe(3);
    expect(d.closestCloseness).toBe('normal');
    expect(d.theme).toBe('system');
    expect(d.motionSpeed).toBe('normal');
    expect(d.openMode).toBe('leave');
  });

  it('a backup with nothing in it is empty, not an error', () => {
    const d = Backup.parse({ app: 'FilaScribe backup', version: 1, data: {} });
    expect(d.filaments).toEqual([]);
    expect(d.savedColors).toEqual({});
    expect(d.autoFilaments).toBe(false);
  });
});

describe('backup: add what is new', () => {
  const current = () => Backup.snapshot(filled());

  it('counts what is in the file and what is new', () => {
    const incoming = current();
    incoming.filaments = [...incoming.filaments, Filaments.load(memoryStorage({ [Filaments.STORAGE_KEY]: JSON.stringify([spool({ colors: ['00FF00'], colorName: 'Green' })]) }))[0]];
    incoming.savedColors = SC.save(incoming.savedColors, 'Generic|PLA', ['112233'], '1', 'Basic');
    incoming.customChips = { brands: ['Zephyr', 'Nova'], materials: [], variants: {} };
    const rows = Backup.summary(current(), incoming);
    expect(rows).toEqual([
      { label: 'My filaments', total: 3, added: 1 },
      { label: 'Saved colors', total: 2, added: 1 },
      { label: 'Color overrides', total: 1, added: 0 },
      { label: 'Your chips', total: 2, added: 1 },
    ]);
  });

  it('the same backup adds nothing', () => {
    expect(Backup.summary(current(), current()).map((r) => r.added)).toEqual([0, 0, 0, 0]);
  });

  it('keeps what you have, adds what is new, and takes settings from the file', () => {
    const now = current();
    const incoming = {
      ...Backup.snapshot(memoryStorage()),
      filaments: [Filaments.load(memoryStorage({ [Filaments.STORAGE_KEY]: JSON.stringify([spool({ colors: ['00FF00'], colorName: 'Green' })]) }))[0]],
      savedColors: SC.save({}, 'Generic|PLA', ['112233'], '1', 'Basic'),
      customChips: { brands: ['Nova'], materials: [], variants: { 'Zephyr|PLA+': ['Fast'] } },
      theme: 'light',
      motionSpeed: 'fast',
      openMode: 'close',
      closestColors: 1,
      closestCloseness: 'strict',
      hiddenVariants: [],
    };
    const out = Backup.merge(now, incoming);
    expect(out.filaments).toHaveLength(3);
    expect(Object.keys(out.savedColors).sort()).toEqual(['Generic|PETG', 'Generic|PLA']);
    expect(out.colorOverrides).toEqual(now.colorOverrides);
    expect(out.customChips.brands).toEqual(['Zephyr', 'Nova']);
    expect(out.customChips.variants['Zephyr|PLA+']).toEqual(['Rapid', 'Fast']);
    expect(out.theme).toBe('light');
    expect(out.motionSpeed).toBe('fast');
    expect(out.openMode).toBe('close');
    expect(out.closestColors).toBe(1);
    expect(out.closestCloseness).toBe('strict');
    expect(out.hiddenVariants).toEqual([]);
  });

  it('merging into an empty device gives the backup', () => {
    const incoming = current();
    const out = Backup.merge(Backup.snapshot(memoryStorage()), incoming);
    expect(out.filaments).toEqual(incoming.filaments);
    expect(out.savedColors).toEqual(incoming.savedColors);
    expect(out.customChips).toEqual(incoming.customChips);
  });

  it('restoring over a full device with Replace leaves exactly the backup', () => {
    const incoming = Backup.snapshot(memoryStorage());
    const s = filled();
    Backup.apply(incoming, s);
    expect(Backup.snapshot(s)).toEqual(incoming);
    expect(s.keys()).not.toContain(Filaments.STORAGE_KEY);
  });

  it('survives storage that throws', () => {
    expect(() => Backup.snapshot(brokenStorage)).not.toThrow();
    expect(() => Backup.apply(Backup.snapshot(memoryStorage()), brokenStorage)).not.toThrow();
  });
});
