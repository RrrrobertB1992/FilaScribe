// The closeness level as shared state: Settings changes it, the Colors card
// reads it, and both stay in step without a reload.
import * as Closeness from './suggestionCloseness.js';

let level = $state(Closeness.load());

export const getCloseness = () => level;

export function setCloseness(value) {
  level = Closeness.clean(value);
  Closeness.store(level);
}
