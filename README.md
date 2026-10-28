# FilaScribe

Create, read and update NFC filament tags from your phone. FilaScribe follows on from PrintTag-Web, and one codebase gives two outputs:

- **Website** on GitHub Pages, using Web NFC. Works in Chrome on Android and writes NDEF formats only.
- **Android app** (APK on the Releases page), using the phone's own NFC through reader mode. It also shows the tag's chip, UID, free space and raw pages, and it checks every write by reading it back. Raw page access is there for formats that aren't NDEF, such as TigerTag, which is planned next.

The first version handles **OpenSpool** tags.

## OpenSpool fields

Tags hold one NDEF record of type `application/json`. FilaScribe writes only documented fields, and leaves empty ones out.

| Field | Written when | Source |
| --- | --- | --- |
| `protocol` (`"openspool"`), `version` (`"1.0"`), `type`, `color_hex`, `brand`, `min_temp`, `max_temp` | always / when set | [OpenSpool spec](https://openspool.io/rfid.html) |
| `bed_min_temp`, `bed_max_temp`, `subtype`, `additional_color_hexes` (up to 4), `alpha` (when not `FF`), `weight`, `diameter` | "Snapmaker U1 fields" is on and the field is set | [U1 extended firmware: OpenSpool format](https://github.com/paxx12/SnapmakerU1-Extended-Firmware/blob/main/docs/design/openspool.md) |
| `color_type` | written as `0` for a gradient spool with 2+ colors, and left out for segments | Rrrrobert's extension, pending in the U1 firmware and OpenRFID PRs. It uses OrcaSlicer's `filament_colour_type` values. |

Value formats follow the spec examples: colors are 6 hex digits without `#`, and temperatures are strings. When reading, FilaScribe also accepts `#RRGGBB` colors and numeric values. If a tag has fields outside this list, FilaScribe lists them and doesn't write them back.

The multi-color fields and `color_type` match PrintTag-Web-Rrrrobert. Saved colors work the same way and use the same data shape. To bring yours over, save the value of the `printtag-saved-colors` localStorage key from that site (for example from Chrome DevTools, under Application, then Local storage) as a `.json` file. Then, in FilaScribe, open Saved colors and choose Import.

## Project layout

```
src/
  App.svelte                 the form, read/update flow and action bar
  components/                Palette, ColorEditor, HsvPicker, SavedColors,
                             SpoolPreview, NfcSheet, TagDetails
  lib/formats/openspool.js   build / parse / validate OpenSpool JSON
  lib/ndef.js                NDEF message and Type 2 TLV encoding
  lib/savedColors.js         saved colors data (localStorage)
  lib/catalog.js             material, brand and variant choices
  lib/nfc/                   one NFC interface: web.js (Web NFC), native.js (app plugin)
android/                     Capacitor Android project
  app/src/main/java/.../FilaScribeNfcPlugin.java   native NFC (reader mode)
tests/                       unit tests (Vitest)
.github/workflows/           Pages, PR test APK, release APK
```

## Developing

Requires Node 22 or newer. For local APK builds you also need JDK 21 and the Android SDK.

```sh
npm install
npm run dev          # local web server (Web NFC needs https on a phone; use the PR builds or Pages)
npm test             # unit tests
npm run test:e2e     # browser tests (first time: npx playwright install chromium)
npm run test:readers # U1 reader compatibility (needs Python 3.10+ with pytest)
npm run build        # web app into dist/
npm run cap:sync     # build, then copy into android/
cd android && ./gradlew assembleDebug
```

## Tests

The **Tests** workflow runs on every pull request and on `main`:

- **Unit tests** (`tests/`): OpenSpool build/parse/validate, NDEF encoding, saved-colors rules, and the app's side of native NFC, using a fake plugin.
- **Browser tests** (`e2e/`): a phone-sized Chrome, in light and dark mode, goes through the basic features with the NFC tag simulated by `e2e/nfc.js`:
  - **Create:** default tag, standard vs U1 fields, material temperature presets, Custom material/brand/variant, 1 to 5 colors with gradient/segments, color and temperature validation, spool details, the tag data preview, and cancelling a write or a write that fails.
  - **Read & update:** loading U1 and standard tags, updating (undocumented fields dropped), blank, unreadable and non-OpenSpool tags, several records on one tag, Read another, and copying a read tag onto a new one.
  - **Saved colors:** saving on write, per brand + material, surviving a reload, picking and un-picking, gradient vs segments, variants, rename, editing colors, removing, clearing, picking automatically when a tag is read, and import/export.

- **U1 reader compatibility** (`tests/compat/`): FilaScribe writes about 160 tags as full NTAG215 memory images. A dozen are hand-picked cases, including a gradient with 5 colors, custom names and the largest possible tag; the rest are random forms. The real OpenSpool readers then read them: paxx12's U1 extended firmware and OpenRFID, fetched at pinned commits by `tests/compat/fetch-readers.sh`. Each check compares what the reader reports against what was entered in the form. Neither project is copied into this repo.
  - Features a reader doesn't support yet are skipped: `color_type`, and OpenRFID's extra colors. These checks switch on once a pinned reader adds them.
  - Two known reader behaviors are tested as they are, so a change upstream gets noticed:
    - OpenRFID only loads spools whose material is in its list. A Custom material like `PLA+` is rejected, and so is a tag with only a nozzle min temperature (a missing max counts as 0).
    - The firmware reads `alpha` as decimal. This is marked as an expected failure.
- **Fuzz and round-trip** (`tests/fuzz.test.js`): random valid forms must survive write then read unchanged and write exactly what was entered. Random and damaged tag bytes, odd JSON values and random saved-colors actions and imports must never crash the app.
- **Tag size** (`tests/tagSize.test.js`): room on NTAG213/215/216, the switch to the long formats above 254 bytes, and that data too big for a tag is refused.

If the browser tests fail, the run has a `playwright-report` artifact with screenshots and a trace of each failure.

The **Advanced tests (weekly)** workflow runs every Monday, and also on demand from the Actions tab. It fuzzes with 20,000 inputs per test, and runs the reader tests against the latest `main` of the firmware and OpenRFID instead of the pinned commits. If it fails while PR tests pass, something changed upstream. Check what changed, then update the pins in `tests/compat/fetch-readers.sh`.

The native Android code (the reader-mode plugin) can only be fully tested on a phone. It still gets compiled on every PR by the test-APK build.

## Builds

- **Pull requests:** the "PR test build" workflow runs the tests and builds a test APK. A comment on the PR links to it. GitHub downloads it as a .zip, so open the zip on the phone and tap the APK inside. It installs as **FilaScribe Test** (`io.github.rrrrobertb1992.filascribe.test`) next to the release app. Every test APK is signed with the committed, non-secret `android/app/ci-debug.keystore`, so each one installs over the last.
- **Website:** merging to `main` deploys to GitHub Pages.
- **Releases:** publishing a GitHub release (for example tag `v0.1.0`) builds the signed APK and attaches it to that release.

### One-time setup

1. **Pages:** in Settings, then Pages, set Source to **GitHub Actions**.
2. **Release signing.** Make a release key once and keep the file and passwords somewhere safe. Every future update has to be signed with the same key.

   ```sh
   keytool -genkeypair -v -keystore filascribe-release.keystore -alias filascribe \
     -keyalg RSA -keysize 4096 -validity 10000
   base64 -w0 filascribe-release.keystore > keystore.b64
   ```

   Then add these repository secrets in Settings, then Secrets and variables, then Actions:
   `RELEASE_KEYSTORE_BASE64` (the contents of `keystore.b64`), `RELEASE_KEYSTORE_PASSWORD`, `RELEASE_KEY_ALIAS` (`filascribe`) and `RELEASE_KEY_PASSWORD`.

## Contributing

Every change goes on its own branch and through a pull request. Nothing is pushed straight to `main`.
