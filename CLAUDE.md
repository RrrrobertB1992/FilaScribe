# FilaScribe: notes for Claude

Read this first. It has what you need to carry on working on this project
without any earlier conversation. `README.md` is the detailed description of
every feature and is the source of truth for how the app behaves; this file
is about how to work on it.

## What this is

A tool to create, read and update NFC filament spool tags (OpenSpool JSON in
one NDEF MIME record). One Svelte 5 + Vite codebase makes two things:

- the **website** (GitHub Pages, Web NFC in Chrome on Android, NDEF only)
- the **Android app** (Capacitor wrapper plus our own Java NFC plugin that
  adds chip type, UID, raw pages and read-back verification)

Where things are:

| Area | Files |
| --- | --- |
| Screen, read/update/write flow | `src/App.svelte` (`readTag`, `writeTag`) |
| Tag format | `src/lib/formats/openspool.js` (build / parse / validate) |
| NDEF and Type 2 tag bytes | `src/lib/ndef.js` |
| NFC (one interface, two backends) | `src/lib/nfc/index.js`, `web.js`, `native.js` |
| Native NFC | `android/app/src/main/java/io/github/rrrrobertb1992/filascribe/FilaScribeNfcPlugin.java` |
| Choices on the form | `src/lib/catalog.js`, `brandList.js`, `materialList.js`, `variantList.js` |
| Brand colors | `src/lib/brandColors.js`, data in `src/data/*.json` (generated, see below) |
| Things kept on the device | `savedColors.js`, `filaments.js`, `customChips.js`, `manualColors.js`, `defaults.js`, `folds.js`, `theme.js` (all localStorage, keys start `filascribe-`) |
| UI pieces | `src/components/*.svelte` |

## Starting a session

1. Read `README.md` for the feature you will touch.
2. Check where things stand before anything else:
   - `git fetch && git log --oneline origin/main -10`
   - open PRs: `gh api "repos/{owner}/{repo}/pulls?state=open" --jq '.[] | "#\(.number) [\(.head.ref)] \(.title)"'`
   - Open PRs may touch the same files as your change. Say so if they do.
3. Set up: Node 22+, then `npm ci`. For browser tests, once per session:
   `npx playwright install --with-deps chromium`.
4. GitHub: the session needs the repo attached with push access. In a cloud
   session `gh` may report a bad token and GraphQL is blocked, so use the REST
   API through `gh api` (for example `gh api -X POST repos/{owner}/{repo}/pulls`).
   `gh pr create` will not work there.
5. Ask the maintainer what they want to work on. If they ask for ideas,
   suggest improvements grouped by category, not new tag types.

## Current direction

- **No new tag formats for now** (for example TigerTag). The maintainer wants
  the rest of the app finished first. The native plugin already returns raw
  pages, so this is ready when they say go.
- Features come from the maintainer's requests. Do not add features on your own.

## How to build a feature (follow in order)

1. **Describe it before any code.** Say how it will work: where it appears,
   what the user taps, what is saved, what happens in edge cases, and what you
   will leave out.
2. **Show a mock-up image.** Render a picture of the change (the inline visual
   tool, HTML or SVG, is fine) so the maintainer can see it. Match the real
   app: phone width (about 390 px), the colors and fonts from `src/app.css`
   (cobalt `--action`, brass accent, slate ink, Barlow Semi Condensed for
   labels, Atkinson Hyperlegible for text), cards with small accent titles, and
   show the light theme (dark too if the colors matter). Show the changed state,
   and the before state if it helps. Change the mock-up until they are happy.
3. **Ask questions** when anything is unclear. Do it at the description or
   mock-up step, not after coding.
4. **Do not write code until the maintainer approves the mock-up.**
5. Branch from latest `origin/main`: one branch per change, short kebab-case
   name (`color-overrides`, `my-filaments`).
6. Write the code, the tests and the README update together (see below).
7. Run the right tests (see below), commit, push the branch, open a PR.
8. **Never push to `main` and never merge a PR.** The maintainer merges.
9. After the test APK is built, the PR gets a comment linking it. The
   maintainer tries it on a phone and reports back; change the PR if needed.

Small fixes and wording tweaks to an existing PR can skip steps 1 to 4 if the
maintainer asked for exactly that change.

## Tests

| What | Command | Where |
| --- | --- | --- |
| Unit | `npm test` (about 5 s) | `tests/*.test.js` (Vitest, plus fast-check) |
| One browser spec | `npx playwright test e2e/<name>.spec.js --project=phone-light` | `e2e/` |
| All browser tests | `npm run test:e2e` | phone-sized Chrome, light and dark (dark runs `create.spec` only) |
| U1 reader compatibility | `npm run test:readers` | `tests/compat/`, needs Python 3.10+ and pytest, downloads pinned readers |
| Everything | `npm run test:all` | |
| Heavier fuzzing | `FUZZ_RUNS=20000 npx vitest run tests/fuzz.test.js` | |

**What to run:**

- A change confined to one area: run only the tests for that area (its unit
  test file and its e2e spec).
- A change to a **shared library**: run the full suite (`npm test`,
  `npm run test:readers`, `npm run test:e2e`). Shared means code many things
  rely on: `src/lib/formats/openspool.js`, `src/lib/ndef.js`, `src/lib/nfc/*`,
  `src/lib/catalog.js`, `src/lib/brandColors.js`, the stores in `src/lib`,
  `src/app.css`, `e2e/nfc.js`, and the read/write flow in `src/App.svelte`.
  When unsure, run everything.
- GitHub Actions runs the full suite on every PR and every push to `main`
  anyway, so a PR can only go green if everything passes.

**Writing tests for a feature:**

- Logic goes in a module under `src/lib` with a `tests/<module>.test.js`.
  Storage modules take a `storage` argument (default `globalThis.localStorage`)
  so tests can pass a fake. Test junk in storage and the size limit too.
- Behavior on screen gets an `e2e/<feature>.spec.js`. Import from `e2e/nfc.js`:
  it fakes Web NFC, clears localStorage before each test, auto-accepts
  `confirm()` dialogs, and fails a test on any console error. Helpers:
  `placeTag`, `lastWrite`, `writeTag`, `chip`, `openCustom`, `colorTab`,
  `temps`, `showAllMaterials`.
- Anything that changes what is written to a tag must keep
  `tests/fuzz.test.js` and the `tests/compat` reader checks passing.
- The Java plugin cannot be tested here. CI compiles it in the test APK build,
  and the maintainer checks the behavior on a real phone. Keep Java changes
  small and say clearly what needs a phone check.

## Rules for the tag data

- Write only fields from the OpenSpool spec, the Snapmaker U1 extended
  firmware docs, or the one existing extension (`color_type`). Do not invent
  fields or formats. When a tag has other fields, they are listed and not
  written back.
- Values follow the spec examples: colors are 6 hex digits without `#`,
  temperatures are strings, empty optional fields are left out.
- Do not hand-edit `src/data/brand-colors.json` or `src/data/orca-vendors.json`.
  They are generated by `scripts/build-brand-colors.js` and
  `scripts/build-orca-vendors.js` (monthly workflow PR). Fix a wrong database
  color in `scripts/color-overrides.json` (format in the README), not in the
  snapshot.

## Code style

- ES modules, 2-space indent, single quotes, semicolons.
- Svelte 5 runes (`$state`, `$derived`, `$props`, `$effect`) and `onclick={...}`
  attributes. Match the structure of the nearby components.
- Words shown to the user: plain, short, and with curly apostrophes (’), as in
  the existing screens. No jargon without a hint (see `VARIANT_INFO`).
- Comments explain why, in a sentence or two, at the top of a file or above a
  non-obvious step.
- Anything saved on the device: a `filascribe-…` key, a `load` that cleans
  whatever it finds, a `store` that survives storage being unavailable, a size
  limit, and export/import in Settings when it is data the user would be sad to
  lose.
- Every card in Settings starts closed. Every Create card folds and its
  open/closed state is remembered.

## README

Every feature PR updates `README.md` in the same PR: the section describing
the feature, plus the **Tests** list when tests were added. Describe what the
user sees, in the same plain style as the rest of the file.

## Commits and pull requests

- **Author:** the repository owner's GitHub identity, copied from the main
  branch history (`git log origin/main -1 --format='%an <%ae>'`).
  **Committer:** `Claude <noreply@anthropic.com>`. Set both with
  `GIT_AUTHOR_NAME`, `GIT_AUTHOR_EMAIL`, `GIT_COMMITTER_NAME` and
  `GIT_COMMITTER_EMAIL` on the `git commit` command.
- **Commit message:** a short imperative subject with no prefix ("Add My
  filaments: save whole spools and fill the form in one tap"), a short body
  saying what and why, then a last line: `Made with help from Claude`.
  No Co-Authored-By line and no claude.ai session links.
- **PR title:** same style as the subject. **PR description:**
  - `## What`: the change as bullets, in terms of what the user sees
  - `## Testing notes`: numbered steps to try it in the test APK
  - one line on which tests pass
  - `Made with help from Claude`, then a rule, then
    `_Generated by [Claude Code](https://claude.ai/code)_`.
    Use the plain link only, never one that ends in a session id.
- The maintainer's conversations must not be linked from commits, PRs or files.
- `.claude/settings.json` sets Claude Code's attribution so commits and PRs carry
  no session link (`attribution.sessionUrl` is `false`). If a commit or PR still
  gets a session link, remove it by hand (`gh api -X PATCH` on the PR body) and
  tell the maintainer.
- Keep this file free of personal details about the maintainer, their
  devices and their printers. The same goes for the README, commits and PRs.

## CI at a glance

- **Tests** (`tests.yml`): unit, browser and U1 reader tests on every PR and on `main`.
- **PR test build** (`pr-test-apk.yml`): tests, web build, and a test APK
  ("FilaScribe Test", installs next to the release app) linked in a PR comment.
- **Deploy website** (`pages.yml`): publishes to GitHub Pages when `main` changes.
- **Release APK** (`release-apk.yml`): signed APK when a release is published.
- **Update brand colors** (`update-brand-colors.yml`): monthly PR with new
  colors and brand names. A PR opened by a workflow does not start other
  workflows, so the workflow starts Tests and PR test build on the PR branch
  itself (the test APK is on that run, not in a PR comment).
- **Advanced tests (weekly)** (`advanced-weekly.yml`): heavier fuzzing and the
  latest upstream readers. A failure here while PR tests pass means something
  changed upstream; update the pins in `tests/compat/fetch-readers.sh` after
  checking.
