export function createCoreFilters() {
  return {
    length(value) {
      if (value === null || value === undefined) {
        return 0;
      }
      if (typeof value === 'string' || Array.isArray(value)) {
        return value.length;
      }
      if (typeof value === 'object') {
        return Object.keys(value).length;
      }
      return 0;
    },

    default(value, fallback = '') {
      if (value === null || value === undefined || value === '' || value === false) {
        return fallback;
      }
      if (Array.isArray(value) && value.length === 0) {
        return fallback;
      }
      return value;
    }
  };
}
