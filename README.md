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

The multi-color fields and `color_type` match PrintTag-Web-Rrrrobert. Saved colors work the same way and use the same data shape. To bring yours over, save the value of the `printtag-saved-colors` localStorage key from that site (for example from Chrome DevTools, under Application, then Local storage) as a `.json` file. Then, in FilaScribe, choose **Import saved colors** under Custom (or Import under Saved).

## Colors

The Colors card shows the current colors at the top: a spool swatch, the color's name and where it came from (a brand color and its line, a saved color, or custom), and the hex values. Below it, three buttons switch between where the colors come from, so the color picker is never far down the page:
- **Brand** (the default): the brand's colors from the database, below. Off for Generic and brands not in the database.
- **Saved**: the colors you saved for this brand and material. Off until something is saved.
- **Custom**: the color picker, Gradient or Segments for 2+ colors, and **Save colors**.

A new brand or material opens the first one that has something (Brand, then Saved, then Custom). Reading a tag opens the one its colors match. Each button shows how many colors it has. Picking in one list lets go of a pick in the other, and changing the colors in Custom lets go of a brand color.

Saved colors belong to a brand and material only; the variant doesn't matter. To change a saved color, tap it and then change the colors in Custom (or tap **Edit colors**). An edit bar appears with **Save changes** (update that saved color), **Save as new** (keep it and add the new colors), and **Cancel**. Writing a tag while editing also saves the change to that saved color.

## Brand colors

Pick a brand and material, and optionally a variant, then choose a named color under **Brand**, a named color from that brand's real lineup, like Bambu Lab PLA Basic "Jade White". It works like Saved colors, but read-only:
- **Material chips follow the brand.** The form asks for the brand first, then the material. For a brand in the database, the Material row only shows the materials it has colors for (Jayo: PLA, PETG and TPU). Custom still takes any material. Switching to a brand that doesn't make the selected material switches it to PLA (or the brand's first material) and fills in its temperatures; a Custom material stays. A tag read with a material its brand doesn't list still shows it. Generic and brands not in the database show every material.
- **Variant chips follow the brand.** For a brand in the database, the Variant row only shows the variants that brand makes in that material, in the brand's own words. Bambu Lab PLA shows Basic, Matte, Silk, Wood, Marble, Galaxy, Glow, **Metal** and Translucent, with no SnapSpeed or HF. Snapmaker PLA includes SnapSpeed and Support. Sunlu says **High Speed** and **Transparent**, and eSun says **Luminous**. Generic, a Custom brand not in the database, or a material the brand doesn't make shows the full default list:
  - Basic, Plus, Matte, SnapSpeed, Silk, Support, HF, 95A, 95A HF;
  - Wood, Marble, Galaxy, Glow, Metallic, Multi-color, Fluorescent, Translucent, Color change.

  None and Custom are always there. When you change the brand or material, the variant stays only if it still fits:
  - a chip the new brand has stays as it is;
  - the same kind of variant switches to the new brand's word, e.g. Bambu "Metal" becomes Polymaker "Metallic";
  - anything else goes back to None.

  Reading a tag never changes its subtype. One the brand doesn't list, like SnapSpeed on a Bambu tag, shows in the Custom box and is written back unchanged.
- **Functional variants get their own chips,** for brands that make them. They aren't in Generic's default list:
  - **Lightweight:** Aero / LW / Light Weight / Air, foaming filaments;
  - **Tough** and Tough+;
  - **CF** and **GF:** carbon and glass fiber, in materials without a -CF chip, like ASA CF or PC-CF;
  - **FR:** FR / V0 / Flame Retardant;
  - **ESD:** ESD / static dissipative / conductive;
  - **HT:** high temp;
  - **Recycled**;
  - **Plus** (PLA+, PLA Plus, ABS+, PETG+…). This one is also in Generic's default list;
  - **every shore hardness:** 85A, 90A, 98A…, with an HF version for high-flow TPU.

  So Bambu Lab PLA Aero writes `"subtype": "Aero"` instead of being lumped in with Basic.
- **Grouped by variant.** Every filament line belongs to one group, and each chip is a group. A chip uses the brand's own word for its group when the brand's lines in it agree on one, such as Metal, Sparkle, Luminous, Transparent, Neon, High Speed, Rapid or Rainbow. Otherwise it uses the group name. That word is what's written as the subtype, so the U1 names the spool "Bambu Lab PLA Metal".
- **How lines are grouped:**
  - Lines are grouped by their name ("wood", "sparkle", "neon", "dual-color"…), with the database's finish tags as a fallback.
  - A finish wins over multi-color, so "Silk PLA+ Dual-Color" is Silk, and over high speed, so "High Speed Matte PLA" is Matte.
  - Plain lines are Basic. Picking a variant shows its group, and **None shows Basic**. A Custom variant shows the lines whose name contains it.
- **Similar lines merge.** For example, Sunlu's "PLA Wood" and "Real Wood Fiber PLA" are one Wood list. A color with the same name and nearly the same shade in another line of the group is shown once ("PLA Wood +1"). **Show all** lists every original line, with nothing merged.
- **Picking a color** fills in the colors, Gradient or Segments for multi-color spools (labeled "2 colors, gradient"), and the line's nozzle and bed temperatures. Tap it again to put back what was there; **Edit colors** keeps it and lets you adjust it. A line from another group, picked under Show all, offers **Set variant to …**.
- **Writing the tag** saves the colors to Saved colors, named after the brand color. Reading a tag marks the matching brand color, looking first at the line named after the tag's variant.
- **Nothing new on the tag:** names and lines aren't written. The tag gets the same OpenSpool fields as before, with your brand spelling. The new variant chips are written as `subtype` like the others.

The colors come from the [Open Filament Database](https://github.com/OpenFilamentCollective/open-filament-database) (MIT). A snapshot is bundled in `src/data/brand-colors.json`, built by `scripts/build-brand-colors.js`, so it works offline. On the website it only loads after the page appears. Shades are approximate.

The **Update brand colors** workflow rebuilds the snapshot on the 1st of each month, and on demand from the Actions tab. If anything changed, it opens or updates a PR named "Update brand colors". It needs one setting: Settings → Actions → General → Workflow permissions → **Allow GitHub Actions to create and approve pull requests**. GitHub doesn't run other workflows on a PR that a workflow opened, so close and reopen that PR to run its Tests and test APK.

## Project layout

```
src/
  App.svelte                 the form, read/update flow and action bar
  components/                Palette, ColorSection (Brand / Saved / Custom),
                             BrandColors, SavedColors, ColorEditor, HsvPicker,
                             SpoolPreview, NfcSheet, TagDetails
  lib/formats/openspool.js   build / parse / validate OpenSpool JSON
  lib/ndef.js                NDEF message and Type 2 TLV encoding
  lib/savedColors.js         saved colors data (localStorage)
  lib/catalog.js             material, brand and variant choices
  lib/brandColors.js         Brand colors: line filtering and color matching
  data/brand-colors.json     Open Filament Database snapshot (generated)
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
  - **Saved colors:** the Saved button turning on and off, saving on write, per brand + material, surviving a reload, picking and un-picking, gradient vs segments, one row whatever the variant, rename, editing a picked color in Custom (Save changes, Save as new, writing while editing), removing, clearing, picking automatically when a tag is read, and import/export.
  - **Brand colors:** Brand above Material, the Material row following the brand (switching to PLA when the new brand doesn't make the material), which color source opens (Generic opens Custom, a brand opens Brand, a read tag opens what it matches), groups by variant (None = Basic), merged look-alikes (Sunlu Wood), Show all when a group is empty, picking and un-picking (colors and temperatures), gradient spools, search, Edit colors opening Custom, changing colors in Custom letting go of the pick, the variant suggestion, working alongside Saved colors, naming the saved color, and matching a read tag.
- **Brand colors logic** (`tests/brandColors.test.js`): material chips per brand, grouping lines (names, finish tags, fiber materials), merging look-alikes, color matching, and that the bundled snapshot is well-formed and covers every FilaScribe brand.

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
