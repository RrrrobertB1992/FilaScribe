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

## Create screen

The Create screen is a set of cards: a compact tag preview at the top, an
OpenSpool / + Snapmaker U1 fields switch, then Filament, Colors, Temperatures,
and (U1 only) Spool details, with the raw Tag data last. Every card folds
shut and shows a one-line summary when it does. Which cards are open is
remembered on the device (`filascribe-create-open`); a card with a problem
opens itself.

### Writing several tags in a row

For a spool you want to tag more than once, the form stays filled in after a write. The bar at the bottom then shows how many tags this spool has had ("1 tag written for this spool") and two buttons: **Done** and **Write another tag**. **Write another tag** opens the usual write sheet, with a line saying which tag it is ("Tag 2 of this spool"), and writes the same data to the next tag.

- The count starts again when you change anything that goes on the tag, press **Done** or **Start over**, switch tabs, or read a tag. A write that fails, or that the app's read-back says didn't match, isn't counted.
- **In the Android app,** if the tag you tap is the same one as the last write, the count doesn't go up and the bar says so in red, with the tag's ID. It was written again with the same data, so nothing is lost. The website can't tell tags apart, so it counts every write.
- Only on Create. **Read & update** keeps **Read another** and **Update tag**.
- The spool is saved to My filaments once, on the first write, as before.

## Read & update screen

Tap **Read tag** and hold a tag to the phone: its details load into the same cards as Create, so you can change anything and tap **Update tag**. Right under the preview there is a **Quick edits** card for the two things that change most. It folds shut like the other cards (closed, it shows the weight and nozzle range; open or shut is remembered), and there is a little space between it and the OpenSpool / Snapmaker U1 buttons below. The cards under it start **shut** the first time you read a tag, so only Quick edits is open; open any of them and it stays open for the next read, of the same tag or another one. Read & update remembers its own open and shut cards (`read-…` in `filascribe-create-open`), so what you open there doesn't change Create. A card with a mistake in it, such as a nozzle max below the min, still opens itself:

- **Weight:** `−` and `+` change it by 10 g, `−−` and `++` by 50 g. It never goes below 0. A tag with no weight shows "not set"; the first `+` sets 1000 g, and the minus buttons stay greyed out until then. Weight is a Snapmaker U1 field, so with the plain OpenSpool switch the card shows a hint ("Turn on Snapmaker U1 fields to edit the weight") instead.
- **Nozzle temperature:** `−` and `+` on the min and max change them by 5 °C (0 to 500).
- **Typing:** tap a number to type one instead.
- The boxes are the same fields as the Weight and Temperatures cards below, so both always show the same numbers, and the same checks apply (whole numbers, min not above max).
- Once something changes, the card lists each change with its old value ("750 g, was 1000 g"), and **Undo changes** puts back what the tag held when it was read. A change you put back by hand drops off the list.
- Nothing is written until you tap **Update tag** and hold a tag to the phone. **Read another** starts again from the next tag.

## My filaments

Save a whole spool (brand, material, variant, colors and temperatures; not weight, diameter or opacity) and fill the Create form from it in one tap.

- **Saving:** tap **+ Save this spool as a filament** at the end of the form, or answer **Save** when the app offers after a written tag (the offer goes away if you change the form). In Settings → My filaments, **Save every write automatically** saves each written spool instead, skipping one you already have.
- **Using:** the **Filaments** tab (between Create and Read & update) lists them, newest first, as a plain full-width list under a small **My filaments** title with the count (no card around it, so the names have room). Search appears once there are 8 or more saved (fewer fit on screen without it). A color you picked yourself, not one named in the brand's database, is marked **Custom color** under its name, since its name is only a rough word for the hex. Search matches the brand, material, variant, color name, a rough color word (so "white" finds a white spool even if its color has no name) or a hex. Tap one and a small sheet shows what will be written (its brand, material, colors and temperatures, plus your defaults for new tags for weight and diameter, since a saved filament has none); **Write tag** then opens the usual hold-the-tag sheet and **Cancel** writes nothing. The form on Create isn't used or changed. After a write you stay on the tab: the row you wrote is outlined and the bottom shows "N tags written for …" with **Done** and **Write another tag**, counted like on Create (the count starts again when you write another filament, press Done or switch tabs; on the Android app the same tag twice in a row isn't counted). A filament that can't be written (for example it needs more room than an NTAG215) shows the reason. Name, note and pin are never written.
- **Pin, name and note:** each row has a **☆** (tap to pin: pinned rows sit at the top with an orange **★**, the rest stay newest first) and a **⋯** that opens a small editor under the row. **Name** (up to 40 characters) replaces the row's title, with the brand, material and color moving to the line under it. **Note** (up to 200) shows as one line under the row. Search also matches the name and note. They stay on this device and are never written to a tag; saving the same spool again keeps them. The card's summary counts pinned ones ("4 saved · 1 pinned").
- **Removing:** **Remove** in the ⋯ editor asks first. Settings → My filaments has Export, Import and **Clear all** (asks first); the list itself is only on the Filaments tab.
- Kept on the device (`filascribe-filaments`, `filascribe-filaments-auto`), up to 200.

## Settings

The **Settings** tab opens to a short menu of four groups. Tap a group to open its page; **‹ Settings** at the top goes back to the menu. Each group page holds its cards, which start closed (just the heading); tap one to open it, and it stays open next time. The menu always shows first when you come back to Settings. The **Brand colors** row also shows the red **Out of date** tag when the color database is old, so you don't have to open it to see.

**Your choices on the form**
- **Defaults for new tags:** what Create starts with and Start over goes back to. **Use the form as it is now** saves the fields, brand, material, variant, temperatures and spool details on screen (not the colors); **Reset to built-in** goes back to Generic PLA. Kept under `filascribe-defaults`.
- **Brands:** which brands the Brand row shows. Generic is always there; the rest start as the built-in list. Tap × to remove one. To add one, type in **Find a brand**: it lists up to 12 brands that start with what you typed (nothing until you type), best known first (OrcaSlicer's vendors, then the most colors), leaving out the ones already on the row; tap one to add it. "colors" marks brands with brand colors. A name nobody lists can be added as your own (it gets the dashed outline). **Show the default brands** puts the built-in list back. Kept under `filascribe-brands`. On the form, the small **Other…** chip types any other brand for one tag; its Save button (or writing a tag) adds that brand.
- **Materials:** which materials the Material row shows. It starts short: PLA, PETG and ABS. Tap × to hide one; the **+** chips below add a hidden built-in material back (the box narrows them as you type), and a name nobody lists can be added as your own (it gets the dashed outline). **Show the default materials** puts the short list back. Kept under `filascribe-materials`. With a brand picked, the row shows only the materials you show *and* that brand makes (see Brand and material below). A material that is selected but hidden, for example one read from a tag, still gets a chip until you pick another. On the form, the small **Other…** chip types any other material: built-in names are suggested as you type ("pe" → PEEK, PETG-CF) and a built-in one you pick goes on the row; your own name goes on the row with its Save button or when you write a tag.
- **Variants:** hide the variants you never use. The list has one card per kind of variant your enabled brands make in the materials you show, so it follows Settings → Brands and Materials (with only Elegoo on the row, it lists what Elegoo makes). Each tile has a switch at the top (on = shown, off = hidden), then the usual name (Metallic), the full name for the short ones (CF: Carbon fiber, GF: Glass fiber, FR: Flame retardant, HT: High temperature, ESD: Anti-static, HF: High flow), PLA+ under Plus and Neon under Fluorescent (names that explain themselves have none), and the brands' own words for it, one per line, A to Z (Metal), because they are the same variant and hide together. Two tiles per row on a phone, three on a wider screen. Tap a tile to hide it from the Variant row, tap again to show it; hidden tiles are dashed and struck through. Shore hardness (85A, 95A HF…) is a row of small chips at the end, once a material that has it (TPU) is shown. **Find a variant** filters the cards by any of their names, **Hide all** and **Show all** do what they say, and the count shows how many kinds are hidden. Nothing is hidden to start. A variant you already hid stays listed (marked "None of your brands make it") if no enabled brand has it any more, so it can always be shown again. Hiding applies to every brand's row, but **Generic** (and a brand the database doesn't know) always shows the default variants, hidden or not. None, your saved variants and the Custom box are never hidden, a hidden variant that is selected (for example read from a tag) still shows until you pick another, and a brand switch doesn't land on a hidden one. Typing the exact name of a hidden variant in Custom and tapping Save turns it back on; a near name like "Matt" is just a new variant. Kept under `filascribe-variants`.
- **Your chips:** every Custom variant you saved, with × to remove one, or all of them. Materials and brands are managed in their own cards above.

**Your saved data**
- **My filaments:** the automatic-save switch, Export, Import and Clear all for the spools saved from Create (see above).
- **Saved colors:** how many are saved for each brand and material, with Clear for one or all, plus Export and Import.
- **Backup:** everything you've set up in one file (see Backup below).

**Brand colors**
- **Color database:** which brand colors database is in use, and a button to update it (see Color database below).
- **Color overrides:** your corrections to brand colors (see Color overrides under Brand colors below), with Reset, Clear all, Export and Import.
- **Closest brand colors:** how many nearest brand colors to suggest, Off or 1 to 5 (3 until you choose; `filascribe-closest-colors`), and **How close** they have to be: Strict, Normal or Loose (Normal until you choose; `filascribe-closest-closeness`). See Closest brand colors below.

**App**
- **Appearance:** follow the system, or always Light or Dark (`filascribe-theme`).
- **About:** the version and build links, the specs FilaScribe writes, and where the brand colors and names come from.

## Backup

**Settings → Backup** keeps everything you'd be sad to lose in one `.json` file (`filascribe-backup-<date>.json`): My filaments (and the automatic-save switch), saved colors, color overrides, your chips, which brands, materials and variants you show, the defaults for new tags, how many closest colors to suggest and how close they have to be, and the theme. It leaves out the downloaded color database (the Color database card fetches it again) and which cards are open. The card first lists how many of each you have.

- **Save backup:** on the website the file downloads. In the Android app it opens the share sheet, so you can save it to Files or Drive, or send it to yourself.
- **Restore backup:** pick a backup file. It shows what is in it and how many of each are new to this device, and nothing changes yet.
  - **Add what's new** keeps everything you have and adds what the file has that you don't (spools, saved colors, overrides and chips you already have aren't doubled). The settings (brands, materials, variants, defaults, closest colors, theme and the automatic-save switch) come from the file.
  - **Replace everything** asks first (a pop-up that says it can't be undone), then deletes what is on this device and leaves exactly what the file holds.
  - **Cancel** goes back without changing anything.
- A file that isn't a FilaScribe backup, or one made by a newer version, is refused and nothing changes.

The one-card Export and Import buttons (My filaments, Saved colors, Color overrides) stay for moving a single list.

## Your own chips

Each Custom box (Variant, and Other… for Brand and Material) has a **Save** button on its right. It keeps what you typed as a chip, without writing a tag. Writing a tag does the same for any Custom value on it. Brands and materials you save show up everywhere (they join the lists in Settings); a saved variant shows up for the brand and material it was saved with. Your own chips have a dashed outline so they stand out. A saved variant can be removed with **Remove "…" from your chips** under the row; brands and materials are removed in Settings. Built-in chips can't be removed from the form. They're kept in the browser (or the app) under `filascribe-custom-chips`.

## Colors

The Colors card shows the current colors at the top: a spool swatch, the color's name and where it came from (a brand color and its line, a saved color, or custom), and the hex values. Below it, three buttons switch between where the colors come from, so the color picker is never far down the page:
- **Brand** (the default): the brand's colors from the database, below. Off for Generic and brands not in the database.
- **Saved**: the colors you saved for this brand and material. Off until something is saved.
- **Custom**: the color picker, Gradient or Segments for 2+ colors, and **Save colors**.

**The app opens on a brand color.** When it opens (and on Start over), and the remembered brand has colors for the remembered material and variant, it starts on one: **White**, else **Black**, else the first color in the list. Only the colors are set, so the remembered temperatures stay. Brands without colors (Generic) still open on Custom, and picking a brand later doesn't pick a color for you. Going to Settings and back keeps the choice: a brand, saved or custom color stays what it was.

A new brand or material opens the first one that has something (Brand, then Saved, then Custom). Reading a tag opens the one its colors match. Each button shows how many colors it has. Picking in one list lets go of a pick in the other, and changing the colors in Custom lets go of a brand color.

Saved colors belong to a brand and material only; the variant doesn't matter. Tap a tile to use that color (tap it again to let go of it). Every tile has an **Edit** button under it (a plain outline, never orange: orange means "picked"; it fills with the light text color while its editor is open). **Edit** also picks the tile and opens an editor right under that tile’s row (the tiles after it fill the row, the rest move down) with a **Name** box, the color's colors as chips (tap one to change just that one), a round **+** (adds a color, a copy of the last one, up to 5) and **−** (takes off the last one; shown with 2 or more colors) after them, **Segments** and **Gradient** buttons (shown with 2 or more colors), a color picker and **Hex** box for the tapped color, and **Remove** (asks first), **Cancel** and **Save**. Nothing changes until **Save**: it updates that saved color in place (its name and place stay) and the form takes the new colors; **Cancel** leaves everything as it was. If the new colors match another saved color, the two merge. Changing colors in Custom lets go of the picked saved color, so **Save colors** there adds a new one.

## Brand colors

Pick a brand and material, and optionally a variant, then choose a named color under **Brand**, a named color from that brand's real lineup, like Bambu Lab PLA Basic "Jade White". It works like Saved colors, but read-only:
- **Brands use OrcaSlicer's names.** Brands are written the way OrcaSlicer's filament profiles name the vendor, so the tag matches the slicer: the built-in chips are Bambu Lab, HATCHBOX, eSUN, Overture, SUNLU, Polymaker, Prusa Polymers (Prusament's maker), Snapmaker and JAYO (Settings → Brands changes which show). Brands Orca doesn't have use the Open Filament Database's spelling. Typing a brand under Other… suggests known brands as you type ("poly" → PolyFlex, PolyLite, Polymaker…, "prusament" → Prusa Polymers); tap one to use it. A full name in any spelling ("elegoo") becomes the known one ("Elegoo") when you press Enter or leave the box, and the Material, Variant and color rows only update then, not on every letter. A brand neither knows is written as typed. Reading a tag also switches a known brand to that name, and saved colors under an old spelling move to the new one.
- **Material chips follow the brand.** The form asks for the brand first, then the material. For a brand in the database, the Material row only shows the materials it has colors for, among the ones you show in Settings → Materials (Jayo: PLA, PETG and TPU, if all three are shown). Other… still takes any material. Switching to a brand that doesn't make the selected material switches it to PLA (or the first material the brand makes that you show) and fills in its temperatures; a Custom material stays. A tag read with a material its brand doesn't list still shows it. Generic and brands not in the database show every material you show.
- **Variant chips follow the brand.** For a brand in the database, the Variant row only shows the variants that brand makes in that material, in the brand's own words. Bambu Lab PLA shows Basic, Matte, Silk, Wood, Marble, Galaxy, Glow, **Metal** and Translucent, with no SnapSpeed or HF. Snapmaker PLA includes SnapSpeed and Support. Sunlu says **High Speed** and **Transparent**, and eSun says **Luminous**. Generic, a Custom brand not in the database, or a material the brand doesn't make shows the full default list:
  - Basic, Plus, Matte, SnapSpeed, Silk, Support, HF, 95A, 95A HF;
  - Wood, Marble, Galaxy, Glow, Metallic, Multi-color, Fluorescent, Translucent, Color change.

  None and Custom are always there. Variants you hide in Settings → Variants are left out (except on Generic). When you change the brand or material, the variant stays only if it still fits:
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
- **Picking a color** fills in the colors, Gradient or Segments for multi-color spools (labeled "2 colors, gradient"), and the line's nozzle and bed temperatures. Tap it again to put back what was there; **Edit** opens the editor for changing it or cloning it (see below). A line from another group, picked under Show all, offers **Set variant to …**.
- **Writing the tag** saves the colors to Saved colors, named after the brand color. Reading a tag marks the matching brand color, looking first at the line named after the tag's variant.
- **Nothing new on the tag:** names and lines aren't written. The tag gets the same OpenSpool fields as before, with your brand spelling. The new variant chips are written as `subtype` like the others.

The colors come from the [Open Filament Database](https://github.com/OpenFilamentCollective/open-filament-database) (MIT). A snapshot is bundled in `src/data/brand-colors.json`, built by `scripts/build-brand-colors.js`, so it works offline. The brand names come from OrcaSlicer's filament profiles (`filament_vendor`), listed in `src/data/orca-vendors.json` by `scripts/build-orca-vendors.js`. On the website it only loads after the page appears. Shades are approximate.

**Fixing a wrong color.** Some colors in the database are wrong: a hex of `#000000` where the real value is missing (a White that shows as black), or a dual, tri or rainbow spool with only one of its colors (about 280 of those, filled in from the color name, a standard 5-color rainbow, or a best guess; the guesses are marked "Best guess from the name" in `why`). Color-shifting (chameleon) spools that the database tags as multi-color just lose that tag. They are corrected in `scripts/color-overrides.json`: the brand, material, line and color name as the database spells them, the wrong value (`was`), the right one (`hex`, up to 5 comma-separated colors) and why (a tag change names `wasTraits` and `traits` the same way). The rebuild applies the list every time, and only while the database still has exactly the wrong value, so if the database later lists its own colors for a spool, ours is left alone, and once it's fixed upstream the override steps aside and the build prints that it can be removed. The monthly pull request lists everything that changed, grouped by brand in collapsible sections (`scripts/snapshot-changes.js`; you can run it yourself on two snapshots: `node scripts/snapshot-changes.js old.json new.json`). To patch the bundled snapshot without rebuilding it: `node scripts/build-brand-colors.js --apply-overrides src/data/brand-colors.json`. The single-color values come from the same brand's own data and the multi-color ones from the names, not from a spool in hand, so check one against yours before relying on it.

**Closest brand colors.** When the colors aren't a brand color (a custom color, or a tag you read whose color isn't in the database) and the brand and material are in the database, the **Closest <brand> <material> colors** show under the color picker (or under the list on the Brand and Saved tabs), never above it, so the picker doesn't jump while you drag it: up to 3 tiles (set in Settings), nearest first, each with the color's name, its line and **Very close** or **Close**. With a variant picked (Basic, Matte…) only that variant's lines are searched; with None, the whole material. Tap a tile to use it, exactly like picking it in the Brand list (the Brand tab opens, and its line shows even if the variant would hide it). Then **Was your color #… / Back to my color** puts yours back. Nothing shows for a color that already is a brand color, for Generic or a brand without colors, or when the setting is Off. When nothing is near enough it says "No <brand> <material> color is close to this one." How close a color has to be is **How close** in Settings. Closeness is CIEDE2000 (how the eye sees it): **Strict** allows up to 8, **Normal** up to 12 and **Loose** up to 18, and the label says **Very close** up to 5. A color from a different color family is never suggested, whatever the setting: its hue on the ordinary color wheel must be within about 20 degrees of yours, so blue doesn't match violet, and a grey only matches greys. A small difference in shade never turns a color away on its own. Loose can suggest orange for a red that is already near orange, and Strict says "No … color is close" more often. Gradients and segments are compared color by color, in order, and only with colors that have the same number of parts. Your color overrides count. Nothing is written until you write the tag.

**Closest brand colors on Read & update.** After you read a tag whose color isn't a brand color (a custom or saved color) and whose brand and material are in the database, the same tiles show at the bottom of the **Quick edits** card, as **Closest <brand> <material> <variant> colors**, matching the tag's own brand, material and variant (with no variant, the whole material). They aren't repeated in the Colors card on this screen. Tap one and the Brand tab opens on it, the Colors card shows it, and the change is listed in Quick edits as **Color** with what it was. **Back to my color** puts the tag's color back, and **Undo changes** puts back the color together with the weight and temperatures. Like picking a brand color anywhere else, it also fills in that line's temperatures, which then show in the list too. The Settings choice (Off to 5) applies here as well. Nothing is written until **Update tag**.

**Edit.** Every color tile has an **Edit** button (outlined, so it isn't mistaken for the orange "picked" outline). It picks that color and opens an editor right under the tile's row: the tiles after it fill the row and the rest move down, so a long list never needs scrolling to reach it. The editor shows the color's name, line and database hex, one **chip** per color (tap one to change just that color; a one-color tile has one), the color picker and a **Hex** box you can erase and type in (3 or 6 digits). The buttons are **Cancel** on the left and **Clone** and **Override** on the right. **Cancel** closes it and changes nothing; tap **Edit** again to close it too. However it closes (Cancel, Override, Reset), the screen scrolls back to the tile you were editing, so it doesn't jump somewhere else when the editor folds away.

**Clone.** **Clone** (in the editor) saves the colors as they are in the editor as a new **saved color**, named after the brand color and keeping its Gradient or Segments style, then picks it and opens the Saved tab. There is no name box and no way to add or remove a color: it is a copy, and Edit in Saved colors renames or reshapes it afterwards. The brand color stays as the database has it. Nothing is overridden.

**Color overrides (your own hex).** If a database color is a little off (Anycubic PLA Basic Black is `#212721`, with a green tint), tap **Edit** on it, change the hex, then tap **Override** (the orange button). Several-color spools get one chip per color; the number of colors can't change, and names stay the vendor's. Once a color is overridden, **Reset to database** shows in its editor. By default only that line changes; tick **Also change "…" in the other … lines** to change every line of that brand and material that has the color. A line's own override beats the all-lines one.
- The tile gets a dashed outline and an **Edited** tag, and the Colors card reads "Black (#212721)" with your new hex underneath and a dashed ring on the swatch.
- **Settings → Color overrides** lists them like Saved colors: old hex (dashed) and new hex, a **Reset** button per override, and Clear all, Export and Import. Reset and Clear all ask first.
- Your override **always wins**, over the database and over `scripts/color-overrides.json`. It is kept on this device (`filascribe-color-overrides`) and applied on top of every database update. If the database later changes that color, Settings says so ("The database now says …"); a color that is gone is marked so you can Reset it.
- A tag written with the database's old hex still matches the overridden color when read.

The **Update brand colors** workflow rebuilds the snapshot and the OrcaSlicer names on the 1st of each month, and on demand from the Actions tab. If anything changed, it opens or updates a PR named "Update brand colors". It needs one setting: Settings → Actions → General → Workflow permissions → **Allow GitHub Actions to create and approve pull requests**. GitHub doesn't start other workflows on a PR that a workflow opened, so the last step of this workflow starts **Tests** and **PR test build** on the PR branch itself (that is why it has the `actions: write` permission). Their `test` and `build` checks appear on the PR, so no closing and reopening is needed. A run started this way doesn't post the test APK comment; the APK is on that run's page in the Actions tab.

**Color database (Settings).** The app has the snapshot built in, so it works offline, but a newer one doesn't need a new app. **Settings → Color database** shows:
- **Brands** and **Colors**: how many are in the database in use.
- **Database date** (when the Open Filament Database snapshot was taken), **Using** (built into the app, or a downloaded copy), the **Brand names** date (OrcaSlicer) and when you **last checked**.
- A red **over 35 days old** message (and "Out of date" on the closed card) once the database date is more than 35 days ago. It only goes away with a newer database.

**Check for updates** (manual only, never automatic) downloads the newest `brand-colors.json` and `orca-vendors.json` from `main` on GitHub, so "newest" means the latest *Update brand colors* PR you have merged. Nothing is saved yet. The files are checked first (a date, brands, every color well formed, not far fewer colors than the built-in copy); a file that fails is refused and nothing changes. Then it says **You have the newest database**, or **Newer database available** with a summary ("2026-12-01: 3 new brands, 118 new colors, 12 colors changed, 4 removed") and:
- **See changes:** the new and removed brands and, per brand, each new, changed (old hex → new hex) or removed color. Long lists stop after a number of brands and colors.
- Your **color overrides** the update affects: how many now have a different database color, and how many are no longer in the database. They stay as they are (see Color overrides above).
- **Update now:** keeps the download on this device (IndexedDB), and it is used from then on, including after a reload, for as long as it is newer than the built-in copy. A newer app version that carries a newer built-in snapshot takes over by itself.
- **Go back to the built-in copy** (shown while a downloaded copy is in use; asks first) deletes the download.

Saved colors, color overrides and everything else you saved are never touched. The database isn't read straight from the Open Filament Database: that is thousands of small files that the build script groups, merges and corrects (`scripts/color-overrides.json`), and the monthly PR is where you check the result.

## Look and feel

The colors and fonts are the "Filament orange" theme: near-black (dark) or warm paper (light) with orange for actions (`--action`), violet for the tag moment (`--highlight`), Outfit for labels and Figtree for text, all set in `src/app.css`.

Every screen uses the same few shapes, set once in `src/app.css`: corners (`--r-control` for buttons, inputs and tiles, `--r-card` for cards and lists, `--r-pill` for chips and tabs) and heights (`--h-small`, `--h-chip`, `--h-control`, `--h-row`). Buttons come in three kinds: filled orange (the main action of a card), outlined (every other action) and red-text outlined (things that remove or delete). No button is plain text; only real links, which are orange and underlined, and the little round × buttons look different. A selected chip, tab or filter is always filled with the strong text color (dark in the light theme, light in the dark one). A selected color tile (brand colors, saved colors, the color slots) is outlined in orange. The four top tabs (Create, Filaments, Read & update, Settings) share the width under the title. The top tabs and the OpenSpool / Snapmaker U1 switch are a softer raised pill, because they switch whole views.

## Project layout

```
src/
  App.svelte                 the form, read/update flow and action bar
  components/                Palette, ColorSection (Brand / Saved / Custom),
                             BrandColors, SavedColors, ColorEditor, HsvPicker,
                             ClosestColors (the closest-colors tiles),
                             SpoolPreview, NfcSheet, TagDetails
  lib/formats/openspool.js   build / parse / validate OpenSpool JSON
  lib/ndef.js                NDEF message and Type 2 TLV encoding
  lib/savedColors.js         saved colors data (localStorage)
  lib/backup.js              exporting JSON, and the backup of everything (save, check, add or replace)
  lib/catalog.js             material, brand and variant choices
  lib/brandColors.js         Brand colors: line filtering and color matching
  lib/manualColors.js        your color overrides (localStorage) and how they apply
  lib/writeSeries.js         counting several tags written from one form
  lib/colorMatch.js          closest brand colors: CIEDE2000 distance plus color-family checks
  lib/suggestionCount.js     how many closest colors to suggest (Settings, localStorage)
  lib/quickEdits.js          the steps and the list of changes for Quick edits on Read & update
  lib/colorDatabase.js       the database in use: info, checking for and keeping an update
  lib/snapshotDiff.js        what changed between two snapshots (also used by the monthly PR)
  data/brand-colors.json     Open Filament Database snapshot (generated)
  scripts/color-overrides.json   corrections for colors the database has wrong
  scripts/snapshot-changes.js    the change list in the monthly pull request
  data/orca-vendors.json     OrcaSlicer's filament vendor names (generated)
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
  - **Saved colors:** the Saved button turning on and off, saving on write, per brand + material, surviving a reload, picking and un-picking, gradient vs segments, one row whatever the variant, editing a saved color from its Edit button (name, colors, Save, Cancel), removing, clearing, picking automatically when a tag is read, and import/export.
  - **Brand colors:** typed brands (suggestions, OrcaSlicer's names, waiting until the name is done), Brand above Material, the Material row following the brand (switching to PLA when the new brand doesn't make the material), which color source opens (Generic opens Custom, a brand opens Brand, a read tag opens what it matches), groups by variant (None = Basic), merged look-alikes (Sunlu Wood), Show all when a group is empty, picking and un-picking (colors and temperatures), gradient spools, search, Clone, changing colors in Custom letting go of the pick, the variant suggestion, working alongside Saved colors, Edit and Clone (a copy keeping the name and style, one chip per color, no add or remove, Cancel), and matching a read tag.
- **Settings menu** (`e2e/settings.spec.js`): Settings opening to a menu of four groups that name their cards, a group opening just its cards and ‹ Settings going back, every card being in exactly one group, coming back to Settings starting at the menu, a card staying open when you return to its group, a half-finished restore being dropped when you leave its page, and the Out of date tag showing on the Brand colors row.
- **Settings** (`tests/settings.test.js`, `tests/brandList.test.js`, `tests/materialList.test.js`, `tests/variantList.test.js`, `e2e/settings-lists.spec.js`, `e2e/settings.spec.js`): brands (hide, find and switch on, add your own, reset, kept after a reload, older brand chips moving in, a read tag with a hidden brand), materials (the short starting row, hide and add back, add your own, reset, kept after a reload, older material chips moving in, Other… suggestions, a read tag with a hidden material, brands filtering the row, a brand switch picking a material you show), variants (a card per kind for the enabled brands and shown materials, hide and show, hiding by kind, Hide all / Show all, TPU hardness chips, kept after a reload, Generic keeping the default list, None and a read tag's variant never lost, Save in Custom turning one back on, a brand switch skipping hidden ones), defaults (saved from the form, used by new tags and Start over, reset, junk in storage), listing and removing your saved variants, saved colors per brand + material with clear/import/export, the theme (applied, kept after a reload) and the About links.
- **Writing several tags in a row** (`tests/writeSeries.test.js`, `e2e/write-series.spec.js`): counting each tag, starting again when the form changes, the same tag twice in a row (and tags the phone can't tell apart), the "Tag 2 of this spool" line on the sheet, Done, Start over and tab switches ending the series, failed or invalid writes not counted, and Read & update keeping its own buttons. The same-tag warning itself needs the Android app, so it is only unit tested here.
- **Look and feel** (`e2e/styles.spec.js`): every button on Create and in each Settings group has an outline and the shared corners.
- **Closest brand colors** (`tests/colorMatch.test.js`, `tests/suggestionCount.test.js`, `tests/suggestionCloseness.test.js`, `e2e/closest-colors.spec.js`): the published CIEDE2000 reference pairs, orange, pink, yellow and green not matching their neighbors, blue not matching violet or sky blue, greys, gradients and segments, nearest-first order and the limit; a denim blue matching a royal blue while blue and violet stay apart; Strict, Normal and Loose limits passed through; both settings' default, range, junk and unavailable storage; and on screen the strip, picking one and Back to my color, what gets written, no strip for brand colors, the no-close message, the strip sitting under the picker without moving it, and the Settings choices (Off, and How close changing which colors show and being kept after a reload). On Read & update the same tiles inside Quick edits: shown there and not in the Colors card, picking one, the color in the list of changes, Back to my color, Undo changes, what Update tag writes, and none for a brand color, when Off, or the no-close message.
- **Starting color** (`e2e/default-color.spec.js`): the app opening on a brand color, Start over, and a brand or custom color staying what it was after a visit to Settings and back.
- **Read & update cards** (`e2e/read-folds.spec.js`): only Quick edits open after the first read, a card you open staying open for the same tag, another tag and a reload, Create keeping its own cards, a closed card's summary, a mistake opening its card, and Quick edits folding and being remembered.
- **Quick edits** (`tests/quickEdits.test.js`, `e2e/quick-edits.spec.js`): the steps of 10, 50 and 5, stopping at 0 and at the limits, a missing weight starting at 1000 g, the list of changes with the old values (the color too), Undo changes, typing a number, the cards below staying in step, nothing written before Update tag, the hint without the U1 fields, and Read another starting again.
- **Backup** (`tests/backup.test.js`, `e2e/backup.spec.js`): everything surviving a save and restore, the downloaded color database and open cards left out, junk and files that aren't backups (or are from a newer version) refused or cleaned, what is new counted, Add what's new keeping what you have and taking settings from the file, Replace everything leaving exactly the backup, storage that throws; and on screen the card's counts, the download, choosing a file changing nothing until you pick, Add what's new, Cancel, the confirmation pop-up before Replace everything (dismissing it changes nothing), and the refusal messages. The share sheet itself needs the Android app, so it is only checked on a phone.
- **Your own chips** (`tests/customChips.test.js`): saving, skipping built-in chips, variants per brand + material, removing, the size limit and junk in storage.
- **Color database** (`tests/colorDatabase.test.js`, `e2e/color-database.spec.js`): the date, brand and color totals, the 35-day rule (35 days is fine, 36 is old), refusing files that aren't a database or have far fewer colors, finding what changed, never swapping in an older database, the effect on color overrides, keeping and removing the downloaded copy, and each error message. The browser tests serve the files from memory and go through Check, See changes, Update now, a reload, and Go back.
- **Brand colors logic** (`tests/brandColors.test.js`): brand names (OrcaSlicer's, then the database's) and suggestions, material chips per brand, grouping lines (names, finish tags, fiber materials), merging look-alikes, color matching, and that the bundled snapshot is well-formed and covers every FilaScribe brand. **Color overrides** (`tests/colorOverrides.test.js`): a wrong value replaced, an override stepping aside once the database fixes it, a renamed color reported, and the bundled snapshot already having them.

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
