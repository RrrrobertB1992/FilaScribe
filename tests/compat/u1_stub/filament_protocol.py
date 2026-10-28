# Stand-in for the U1 stock firmware's filament_protocol module, which isn't
# public. It has only what filament_protocol_ndef.py uses: result codes, the
# most colors a spool can have, and the info record it fills in.
FILAMENT_PROTO_OK = 0
FILAMENT_PROTO_ERR = -1
FILAMENT_PROTO_PARAMETER_ERR = -2
FILAMENT_PROTO_SIGN_CHECK_ERR = -3

# Color 1 plus 4 extra colors (RGB_1..RGB_5)
FILAMENT_PROTO_COLOR_NUMS_MAX = 5

FILAMENT_INFO_STRUCT = {
    'VERSION': 0, 'VENDOR': 'NONE', 'MANUFACTURER': 'NONE', 'MAIN_TYPE': 'NONE', 'SUB_TYPE': 'NONE',
    'TRAY': 0, 'ALPHA': 0xFF, 'COLOR_NUMS': 1, 'ARGB_COLOR': 0xFFFFFFFF,
    'RGB_1': 0xFFFFFF, 'RGB_2': 0, 'RGB_3': 0, 'RGB_4': 0, 'RGB_5': 0,
    'DIAMETER': 175, 'WEIGHT': 0, 'LENGTH': 0, 'DRYING_TEMP': 0, 'DRYING_TIME': 0,
    'HOTEND_MAX_TEMP': 0, 'HOTEND_MIN_TEMP': 0, 'BED_TYPE': 0, 'BED_TEMP': 0,
    'FIRST_LAYER_TEMP': 0, 'OTHER_LAYER_TEMP': 0, 'SKU': 0, 'MF_DATE': '19700101',
    'RSA_KEY_VERSION': 0, 'OFFICIAL': False, 'CARD_UID': [],
}
