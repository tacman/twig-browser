/**
 * Twig `is` tests — e.g. `{% if x is defined %}`, `{% if x is not empty %}`
 *
 * Each function receives the value being tested and returns a boolean.
 */
export function createCoreTests() {
  return {
    defined(value) {
      return value !== undefined && value !== null;
    },

    null(value) {
      return value === null || value === undefined;
    },

    // alias
    none(value) {
      return value === null || value === undefined;
    },

    empty(value) {
      if (value === null || value === undefined || value === false || value === '') return true;
      if (Array.isArray(value)) return value.length === 0;
      if (typeof value === 'object') return Object.keys(value).length === 0;
      if (typeof value === 'number') return value === 0;
      return false;
    },

    odd(value) {
      return Number(value) % 2 !== 0;
    },

    even(value) {
      return Number(value) % 2 === 0;
    },

    iterable(value) {
      return Array.isArray(value) || (value !== null && typeof value === 'object');
    },

    divisibleby(value, divisor) {
      return Number(value) % Number(divisor) === 0;
    },

    sameas(value, other) {
      return value === other;
    },
  };
}
