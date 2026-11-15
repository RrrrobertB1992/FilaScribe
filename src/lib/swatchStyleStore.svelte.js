// The three swatch choices as shared state (lib/swatchStyle.js): Settings changes
// them and every swatch on screen follows without a reload.
import * as Style from './swatchStyle.js';

let circle = $state(Style.circle.load());
let tile = $state(Style.tile.load());
let size = $state(Style.size.load());

export const getCircleStyle = () => circle;
export const getTileStyle = () => tile;
export const getTileSize = () => size;

export function setCircleStyle(value) {
  circle = Style.circle.clean(value);
  Style.circle.store(circle);
}
export function setTileStyle(value) {
  tile = Style.tile.clean(value);
  Style.tile.store(tile);
}
export function setTileSize(value) {
  size = Style.size.clean(value);
  Style.size.store(size);
}
