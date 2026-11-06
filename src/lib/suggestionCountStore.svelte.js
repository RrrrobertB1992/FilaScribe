// The suggestion count as shared state: Settings changes it, the Colors card
// reads it, and both stay in step without a reload.
import * as SuggestionCount from './suggestionCount.js';

let count = $state(SuggestionCount.load());

export const getSuggestionCount = () => count;

export function setSuggestionCount(value) {
  count = SuggestionCount.clean(value);
  SuggestionCount.store(count);
}
