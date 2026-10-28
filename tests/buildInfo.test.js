import { describe, it, expect } from 'vitest';
import { buildParts } from '../src/lib/buildInfo.js';

const SHA = 'f724cb47fe260f97c96d7d9153ecfef217839b4b';
const GH = 'https://github.com/RrrrobertB1992/FilaScribe';

describe('build label', () => {
  it('test APK: the PR and the commit are links', () => {
    expect(buildParts({ repo: 'RrrrobertB1992/FilaScribe', pr: '10', run: '18', commit: SHA })).toEqual([
      { text: 'pr10', href: `${GH}/pull/10` },
      { text: '-18' },
      { text: ' · ' },
      { text: 'f724cb4', href: `${GH}/commit/${SHA}` },
    ]);
  });

  it('website: just the commit', () => {
    expect(buildParts({ repo: 'RrrrobertB1992/FilaScribe', commit: SHA })).toEqual([{ text: 'f724cb4', href: `${GH}/commit/${SHA}` }]);
  });

  it('release: the tag links to the release', () => {
    expect(buildParts({ repo: 'RrrrobertB1992/FilaScribe', tag: 'v0.1.0', commit: SHA })).toEqual([{ text: 'v0.1.0', href: `${GH}/releases/tag/v0.1.0` }]);
  });

  it('local dev: nothing; no repo: text without links', () => {
    expect(buildParts({})).toEqual([]);
    expect(buildParts({ pr: '3', commit: SHA })).toEqual([{ text: 'pr3' }, { text: ' · ' }, { text: 'f724cb4' }]);
    expect(buildParts({ repo: 'bad repo', commit: 'not-a-sha' })).toEqual([]);
  });
});
