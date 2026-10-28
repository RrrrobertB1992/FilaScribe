"""Can the U1 read what FilaScribe writes?

Runs the real OpenSpool readers on tags FilaScribe wrote (full NTAG215
memory images from make-fixtures.js):
  - paxx12's U1 extended firmware: filament_protocol_ndef.py
  - OpenRFID: tag/openspool/processor.py
Both are fetched at pinned commits by fetch-readers.sh (see that file to
update them).

Environment: FIXTURES_DIR, FIRMWARE_DIR, OPENRFID_DIR.

Features a reader doesn't support yet (color_type, OpenRFID extra colors)
are skipped with a note; once a pinned reader mentions them in its source,
the checks run, so bumping a pin to a release that adds them tests them.
"""

import importlib.util
import json
import logging
import os
import shutil
import sys
import tempfile
from pathlib import Path

import pytest

FIXTURES = Path(os.environ.get('FIXTURES_DIR', 'tests/compat/out'))
FIRMWARE = Path(os.environ['FIRMWARE_DIR'])
OPENRFID = Path(os.environ['OPENRFID_DIR'])
FW_PARSER = FIRMWARE / 'overlays/firmware-extended/13-patch-rfid/root/home/lava/klipper/klippy/extras/filament_protocol_ndef.py'
ORFID_PROCESSOR = OPENRFID / 'src/tag/openspool/processor.py'

logging.disable(logging.CRITICAL)  # the readers log every tag


def _load_firmware():
    # The parser imports `from . import filament_protocol`, so give it a package
    pkg = Path(tempfile.mkdtemp()) / 'u1fw'
    pkg.mkdir()
    (pkg / '__init__.py').write_text('')
    shutil.copy(FW_PARSER, pkg / 'filament_protocol_ndef.py')
    shutil.copy(Path(__file__).parent / 'u1_stub/filament_protocol.py', pkg / 'filament_protocol.py')
    sys.path.insert(0, str(pkg.parent))
    import u1fw.filament_protocol_ndef as fw  # noqa: E402
    return fw


def _load_openrfid():
    sys.path.insert(0, str(OPENRFID / 'src'))
    from reader.scan_result import ScanResult  # noqa: E402
    from tag.openspool.processor import OpenspoolTagProcessor  # noqa: E402
    from tag.tag_types import TagType  # noqa: E402

    from filament.valid_materials import VALID_BASE_MATERIALS  # noqa: E402

    global ORFID_MATERIALS
    ORFID_MATERIALS = set(VALID_BASE_MATERIALS)
    processor = OpenspoolTagProcessor({'__name': 'OpenspoolTagProcessor'})
    processor.enabled = True
    scan = ScanResult(tag_type=TagType.MifareUltralight, uid=b'\x04\xa1\xb2\xc3\xd4\xe5\x80', atqa=b'\x00\x44', bcc=b'\x00', sak=b'\x00')
    return lambda data: processor.process_tag(scan, data)


ORFID_MATERIALS = set()
FW = _load_firmware()
ORFID_READ = _load_openrfid()
FW_SOURCE = FW_PARSER.read_text()
ORFID_SOURCE = ORFID_PROCESSOR.read_text()

CASES = json.loads((FIXTURES / 'cases.json').read_text())
IDS = [c['name'] for c in CASES]


def tag_bytes(case):
    return (FIXTURES / case['file']).read_bytes()


def rgb(hex6):
    return int(hex6, 16)


# --- U1 extended firmware ---

@pytest.mark.parametrize('case', CASES, ids=IDS)
def test_u1_firmware_reads_tag(case):
    e = case['expect']
    code, info = FW.ndef_proto_data_parse(tag_bytes(case))
    assert code == 0, f'firmware rejected the tag (code {code}); JSON: {case["json"]}'

    assert info['VENDOR'] == (e['brand'] or 'Generic')
    assert info['MAIN_TYPE'] == e['type'].upper()
    assert info['SUB_TYPE'] == (e['subtype'] or 'Basic')

    assert info['COLOR_NUMS'] == len(e['colors'])
    for i, hex6 in enumerate(e['colors'], start=1):
        assert info[f'RGB_{i}'] == rgb(hex6), f'color {i}'

    assert info['HOTEND_MIN_TEMP'] == (e['minTemp'] or 0)
    assert info['HOTEND_MAX_TEMP'] == (e['maxTemp'] or 0)
    bed = e['bedMinTemp'] if e['bedMinTemp'] else (e['bedMaxTemp'] or 0)
    assert info['BED_TEMP'] == bed
    assert info['WEIGHT'] == (e['weight'] or 0)
    assert info['DIAMETER'] == int(round((e['diameter'] or 1.75) * 100))
    if e['alpha'] is None:
        assert info['ALPHA'] == 0xFF


def _alpha_reads_differently(a):
    # "00"-"09" mean the same in hex and decimal, so they can't show the issue
    return not (a.isdigit() and int(a) == int(a, 16))


@pytest.mark.parametrize('case', [c for c in CASES if c['expect']['alpha'] and _alpha_reads_differently(c['expect']['alpha'])],
                         ids=lambda c: c['name'])
@pytest.mark.xfail(
    strict=True,
    reason='Known firmware issue: the U1 doc and OpenRFID read alpha as hex ("80" = 128), '
           'the firmware reads it as decimal ("80" = 80, and "7F" falls back to FF). '
           'If this starts passing, the firmware was fixed: remove this xfail.',
)
def test_u1_firmware_reads_alpha_as_hex(case):
    _, info = FW.ndef_proto_data_parse(tag_bytes(case))
    assert info['ALPHA'] == int(case['expect']['alpha'], 16)


@pytest.mark.parametrize('case', [c for c in CASES if len(c['expect']['colors']) > 1], ids=lambda c: c['name'])
def test_u1_firmware_reads_gradient(case):
    if 'color_type' not in FW_SOURCE:
        pytest.skip("the pinned firmware doesn't read color_type yet (pending PR)")
    pytest.fail('The pinned firmware now reads color_type: add the check for its gradient field here.')


# --- OpenRFID ---

def openrfid_type(e):
    """OpenRFID's material: upper-cased, with a CF/GF variant folded into it."""
    base = e['type'].upper()
    modifiers = [e['subtype']] if e['subtype'] else []
    for m in ('CF', 'GF'):
        if m in modifiers:
            base += '-' + m
            modifiers.remove(m)
    return base, modifiers


@pytest.mark.parametrize('case', CASES, ids=IDS)
def test_openrfid_reads_tag(case):
    e = case['expect']
    f = ORFID_READ(tag_bytes(case))
    base, modifiers = openrfid_type(e)
    if base not in ORFID_MATERIALS:
        # OpenRFID only loads spools whose material is in its own list
        # (filament/valid_materials.py); a custom material like "PLA+" is
        # rejected as a whole. The firmware's built-in reader accepts it.
        assert f is None, f'OpenRFID now accepts material {base!r}: update this test'
        return
    if (e['maxTemp'] or 0) < (e['minTemp'] or 0):
        # A missing max_temp counts as 0, so a tag with only min_temp has
        # max < min, and OpenRFID rejects the tag
        assert f is None, 'OpenRFID now accepts a tag with only min_temp: update this test'
        return
    assert f is not None, f'OpenRFID rejected the tag; JSON: {case["json"]}'
    d = f.to_dict()

    assert d['manufacturer'] == (e['brand'] or 'Generic')
    assert d['type'] == base
    assert d['modifiers'] == modifiers

    alpha = int(e['alpha'], 16) if e['alpha'] else 0xFF
    first = (alpha << 24) | rgb(e['colors'][0])
    assert int(str(d['colors'][0]), 0) == first if isinstance(d['colors'][0], str) else d['colors'][0] == first

    assert d['hotend_min_temp_c'] == (e['minTemp'] or 0)
    assert d['hotend_max_temp_c'] == (e['maxTemp'] or 0)
    assert d['weight_grams'] == (e['weight'] or 1000)
    assert d['diameter_mm'] == pytest.approx(e['diameter'] or 1.75)


@pytest.mark.parametrize('case', [c for c in CASES if len(c['expect']['colors']) > 1], ids=lambda c: c['name'])
def test_openrfid_reads_extra_colors(case):
    if 'additional_color_hexes' not in ORFID_SOURCE:
        pytest.skip("the pinned OpenRFID doesn't read additional_color_hexes yet (pending PR)")
    e = case['expect']
    f = ORFID_READ(tag_bytes(case))
    if f is None:
        pytest.skip('OpenRFID rejects this material (see test_openrfid_reads_tag)')
    d = f.to_dict()
    alpha = int(e['alpha'], 16) if e['alpha'] else 0xFF
    want = [(alpha << 24) | rgb(h) for h in e['colors']]
    got = [int(str(c), 0) if isinstance(c, str) else c for c in d['colors']]
    assert got == want


def test_every_builtin_material_loads_in_openrfid():
    # The materials FilaScribe offers as chips must all be ones OpenRFID accepts
    catalog = Path(__file__).resolve().parents[2] / 'src/lib/catalog.js'
    import re
    block = catalog.read_text().split('export const MATERIALS', 1)[1].split('};', 1)[0]
    names = re.findall(r"^\s*'?([A-Z0-9-]+)'?:", block, re.M)
    assert names, 'no materials found in catalog.js'
    assert [n for n in names if n not in ORFID_MATERIALS] == []


def test_cases_cover_the_long_record_format():
    # At least one tag must exceed 254 bytes so the readers parse the
    # 4-byte NDEF payload length and the 3-byte TLV length
    assert any(c['messageBytes'] > 254 for c in CASES)
