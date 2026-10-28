// What this build is, for the footer: the version, plus links to where it
// came from on GitHub (set by the workflows; see vite.config.js).
//   test APK:  0.1.0 (pr10-18 · f724cb4)   pr10 -> the PR, f724cb4 -> the commit
//   website:   0.1.0 (f724cb4)
//   release:   0.1.0 (v0.1.0)              v0.1.0 -> the release
//   local dev: 0.1.0

const SHA = /^[0-9a-f]{7,40}$/i;
const REPO = /^[\w.-]+\/[\w.-]+$/;

/**
 * Parts of the build label, in order: { text, href? }. Plain separators
 * have no href.
 */
export function buildParts(build = {}) {
  const repo = REPO.test(build.repo || '') ? `https://github.com/${build.repo}` : '';
  const link = (text, path) => ({ text, ...(repo ? { href: `${repo}/${path}` } : {}) });
  const parts = [];
  const pr = /^\d+$/.test(String(build.pr ?? '')) ? String(build.pr) : '';
  const run = /^\d+$/.test(String(build.run ?? '')) ? String(build.run) : '';
  const commit = SHA.test(build.commit || '') ? build.commit : '';
  if (build.tag) {
    parts.push(link(build.tag, `releases/tag/${encodeURIComponent(build.tag)}`));
  } else {
    if (pr) {
      parts.push(link(`pr${pr}`, `pull/${pr}`));
      if (run) parts.push({ text: `-${run}` });
    }
    if (commit) {
      if (parts.length) parts.push({ text: ' · ' });
      parts.push(link(commit.slice(0, 7), `commit/${commit}`));
    }
  }
  return parts;
}
