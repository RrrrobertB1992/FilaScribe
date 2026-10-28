#!/usr/bin/env bash
# Fetch the OpenSpool readers used on the Snapmaker U1, at pinned commits,
# for tests/compat/test_readers.py. Only the files the tests need are
# checked out. Neither project is copied into this repo.
#
# To test against newer versions, change the commits below (or set
# FIRMWARE_REF / OPENRFID_REF to a commit, branch or tag).
set -euo pipefail

# paxx12 Snapmaker U1 Extended Firmware, main on 2026-10-25
FIRMWARE_REPO="https://github.com/paxx12/SnapmakerU1-Extended-Firmware"
FIRMWARE_REF="${FIRMWARE_REF:-417e6394f62366e010a3f76f8e567f67db770165}"
FIRMWARE_PATHS="overlays/firmware-extended/13-patch-rfid/root/home/lava/klipper/klippy/extras"

# OpenRFID (suchmememanyskill), main on 2026-09-25
OPENRFID_REPO="https://github.com/suchmememanyskill/OpenRFID"
OPENRFID_REF="${OPENRFID_REF:-a13bc9e181374e182f61db4e69abf9fa1786cc29}"
OPENRFID_PATHS="src"

DEST="${1:-.readers}"

fetch() { # repo ref dir paths
  local repo=$1 ref=$2 dir=$3 paths=$4
  rm -rf "$dir"
  git init -q "$dir"
  git -C "$dir" remote add origin "$repo"
  git -C "$dir" sparse-checkout set --no-cone $paths
  git -C "$dir" fetch -q --depth 1 --filter=blob:none origin "$ref"
  git -C "$dir" checkout -q FETCH_HEAD
  echo "$(basename "$repo") at $(git -C "$dir" rev-parse --short HEAD)"
}

mkdir -p "$DEST"
fetch "$FIRMWARE_REPO" "$FIRMWARE_REF" "$DEST/firmware" "$FIRMWARE_PATHS"
fetch "$OPENRFID_REPO" "$OPENRFID_REF" "$DEST/openrfid" "$OPENRFID_PATHS"
