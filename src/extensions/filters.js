export function createCoreFilters() {
  return {
    // -------------------------------------------------------------------------
    // Already existed
    // -------------------------------------------------------------------------

    length(value) {
      if (value === null || value === undefined) return 0;
      if (typeof value === 'string' || Array.isArray(value)) return value.length;
      if (typeof value === 'object') return Object.keys(value).length;
      return 0;
    },

    default(value, fallback = '') {
      if (value === null || value === undefined || value === '' || value === false) return fallback;
      if (Array.isArray(value) && value.length === 0) return fallback;
      return value;
    },

    merge(value, addition) {
      if (Array.isArray(value)) {
        if (Array.isArray(addition)) return [...value, ...addition];
        if (addition === null || addition === undefined) return [...value];
        return [...value, addition];
      }
      if (value && typeof value === 'object') {
        if (addition && typeof addition === 'object') return { ...value, ...addition };
        return { ...value };
      }
      if (Array.isArray(addition)) return [...addition];
      if (addition && typeof addition === 'object') return { ...addition };
      if (addition === null || addition === undefined) return value;
      return [value, addition];
    },

    // -------------------------------------------------------------------------
    // String case
    // -------------------------------------------------------------------------

    upper(value) {
      return String(value ?? '').toUpperCase();
    },

    lower(value) {
      return String(value ?? '').toLowerCase();
    },

    capitalize(value) {
      const s = String(value ?? '');
      return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
    },

    title(value) {
      return String(value ?? '').replace(/\b\w/g, c => c.toUpperCase());
    },

    trim(value, chars = null) {
      const s = String(value ?? '');
      if (!chars) return s.trim();
      const escaped = chars.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&');
      return s.replace(new RegExp(`^[${escaped}]+|[${escaped}]+$`, 'g'), '');
    },

    // -------------------------------------------------------------------------
    // HTML safety
    // -------------------------------------------------------------------------

    /**
     * Mark a string as safe HTML — in a browser context this means we simply
     * pass the value through as-is (the engine already outputs strings directly).
     * This is the Twig `|raw` filter equivalent.
     */
    raw(value) {
      return value ?? '';
    },

    /**
     * `|e` / `|escape` — HTML-escape a string.
     * In browser-rendering we default to 'html' strategy.
     */
    e(value /* , strategy = 'html' */) {
      return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
    },

    escape(value) {
      return this.e(value);
    },

    striptags(value) {
      return String(value ?? '').replace(/<[^>]*>/g, '');
    },

    nl2br(value) {
      return String(value ?? '').replace(/\n/g, '<br />\n');
    },

    // -------------------------------------------------------------------------
    // Array / object
    // -------------------------------------------------------------------------

    join(value, separator = '', keyGlue = null) {
      if (Array.isArray(value)) return value.join(separator);
      if (value && typeof value === 'object') {
        if (keyGlue !== null) {
          return Object.entries(value).map(([k, v]) => `${k}${keyGlue}${v}`).join(separator);
        }
        return Object.values(value).join(separator);
      }
      return String(value ?? '');
    },

    keys(value) {
      if (value && typeof value === 'object') return Object.keys(value);
      return [];
    },

    first(value) {
      if (Array.isArray(value)) return value[0] ?? null;
      if (typeof value === 'string') return value.charAt(0) ?? null;
      if (value && typeof value === 'object') {
        const keys = Object.keys(value);
        return keys.length ? value[keys[0]] : null;
      }
      return null;
    },

    last(value) {
      if (Array.isArray(value)) return value[value.length - 1] ?? null;
      if (typeof value === 'string') return value.charAt(value.length - 1) ?? null;
      if (value && typeof value === 'object') {
        const keys = Object.keys(value);
        return keys.length ? value[keys[keys.length - 1]] : null;
      }
      return null;
    },

    reverse(value) {
      if (Array.isArray(value)) return [...value].reverse();
      if (typeof value === 'string') return value.split('').reverse().join('');
      if (value && typeof value === 'object') {
        return Object.fromEntries(Object.entries(value).reverse());
      }
      return value;
    },

    sort(value) {
      if (Array.isArray(value)) return [...value].sort();
      return value;
    },

    /**
     * slice(start, length)
     * Matches Twig's slice which uses (start, length) not (start, end).
     */
    slice(value, start = 0, length = null) {
      if (Array.isArray(value)) {
        const end = length !== null ? start + length : undefined;
        return value.slice(start, end);
      }
      if (typeof value === 'string') {
        return length !== null ? value.substr(start, length) : value.slice(start);
      }
      return value;
    },

    split(value, delimiter = '', limit = null) {
      const s = String(value ?? '');
      const parts = s.split(delimiter);
      return limit !== null ? parts.slice(0, limit) : parts;
    },

    // -------------------------------------------------------------------------
    // Numeric
    // -------------------------------------------------------------------------

    abs(value) {
      return Math.abs(Number(value));
    },

    round(value, precision = 0, method = 'common') {
      const factor = Math.pow(10, precision);
      const n = Number(value);
      if (method === 'ceil') return Math.ceil(n * factor) / factor;
      if (method === 'floor') return Math.floor(n * factor) / factor;
      return Math.round(n * factor) / factor;
    },

    number_format(value, decimals = 0, decPoint = '.', thousandsSep = ',') {
      const n = Number(value);
      if (!Number.isFinite(n)) return String(value ?? '');
      const fixed = n.toFixed(decimals);
      const [intPart, decPart] = fixed.split('.');
      const formattedInt = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, thousandsSep);
      return decPart !== undefined ? `${formattedInt}${decPoint}${decPart}` : formattedInt;
    },

    // -------------------------------------------------------------------------
    // String manipulation
    // -------------------------------------------------------------------------

    replace(value, pairs) {
      let s = String(value ?? '');
      if (pairs && typeof pairs === 'object') {
        for (const [search, replacement] of Object.entries(pairs)) {
          s = s.split(search).join(String(replacement));
        }
      }
      return s;
    },

    /**
     * format(arg1, arg2, ...) — sprintf-style, uses %s placeholders.
     */
    format(value, ...args) {
      let s = String(value ?? '');
      let i = 0;
      return s.replace(/%s/g, () => String(args[i++] ?? ''));
    },

    url_encode(value) {
      if (value && typeof value === 'object') {
        return Object.entries(value)
          .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
          .join('&');
      }
      return encodeURIComponent(String(value ?? ''));
    },

    // -------------------------------------------------------------------------
    // JSON / encoding
    // -------------------------------------------------------------------------

    json_encode(value, options = null) {
      try {
        return options !== null
          ? JSON.stringify(value, null, options)
          : JSON.stringify(value);
      } catch {
        return 'null';
      }
    },

    // -------------------------------------------------------------------------
    // Date
    // -------------------------------------------------------------------------

    /**
     * date(format) — format a date value.
     *
     * Supports PHP-style date format characters as used in Twig:
     *   Y  - 4-digit year
     *   y  - 2-digit year
     *   m  - month 01-12
     *   n  - month 1-12 (no leading zero)
     *   d  - day 01-31
     *   j  - day 1-31 (no leading zero)
     *   H  - hour 00-23
     *   G  - hour 0-23 (no leading zero)
     *   h  - hour 01-12
     *   g  - hour 1-12 (no leading zero)
     *   i  - minutes 00-59
     *   s  - seconds 00-59
     *   A  - AM/PM
     *   a  - am/pm
     *   N  - day of week 1 (Mon) - 7 (Sun)
     *   w  - day of week 0 (Sun) - 6 (Sat)
     *   D  - short day name (Mon-Sun)
     *   l  - full day name
     *   M  - short month name (Jan-Dec)
     *   F  - full month name
     *   U  - Unix timestamp
     *
     * Value may be a Date, a timestamp number, or a parseable date string.
     * Passing 'now' uses the current time. null/undefined returns '' (intentional
     * divergence from PHP Twig, which defaults null to now).
     */
    date(value, format = 'Y-m-d') {
      let d;
      // When input is a date-only string (YYYY-MM-DD), parse as UTC to avoid
      // timezone offset shifting the day. Date objects and datetime strings
      // with time components are used as-is (local time).
      let useUtc = false;

      // null/undefined → blank (unlike PHP Twig which defaults to now)
      if (value === null || value === undefined) {
        return '';
      } else if (value === 'now') {
        d = new Date();
      } else if (value instanceof Date) {
        d = value;
      } else if (typeof value === 'number') {
        // Twig treats integers as Unix timestamps (seconds)
        d = new Date(value * 1000);
      } else {
        // Date-only strings like "2024-06-15" parse as UTC midnight in JS.
        // Use UTC accessors so the displayed date matches the string.
        useUtc = /^\d{4}-\d{2}-\d{2}$/.test(String(value).trim());
        d = new Date(value);
      }

      if (isNaN(d.getTime())) return String(value);

      const pad = (n, len = 2) => String(n).padStart(len, '0');
      const shortDays   = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
      const fullDays    = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
      const shortMonths = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      const fullMonths  = ['January', 'February', 'March', 'April', 'May', 'June',
                           'July', 'August', 'September', 'October', 'November', 'December'];

      const yr  = useUtc ? d.getUTCFullYear()  : d.getFullYear();
      const mo  = useUtc ? d.getUTCMonth()     : d.getMonth();      // 0-based
      const day = useUtc ? d.getUTCDate()      : d.getDate();
      const h24 = useUtc ? d.getUTCHours()     : d.getHours();
      const min = useUtc ? d.getUTCMinutes()   : d.getMinutes();
      const sec = useUtc ? d.getUTCSeconds()   : d.getSeconds();
      const dow = useUtc ? d.getUTCDay()       : d.getDay();        // 0=Sun
      const h12 = h24 % 12 || 12;

      return format.replace(/\\(.)|(Y|y|m|n|d|j|H|G|h|g|i|s|A|a|N|w|D|l|M|F|U)/g, (match, escaped, token) => {
        if (escaped !== undefined) return escaped;
        switch (token) {
          case 'Y': return yr;
          case 'y': return pad(yr % 100);
          case 'm': return pad(mo + 1);
          case 'n': return mo + 1;
          case 'd': return pad(day);
          case 'j': return day;
          case 'H': return pad(h24);
          case 'G': return h24;
          case 'h': return pad(h12);
          case 'g': return h12;
          case 'i': return pad(min);
          case 's': return pad(sec);
          case 'A': return h24 < 12 ? 'AM' : 'PM';
          case 'a': return h24 < 12 ? 'am' : 'pm';
          case 'N': return dow === 0 ? 7 : dow;  // Mon=1, Sun=7
          case 'w': return dow;
          case 'D': return shortDays[dow];
          case 'l': return fullDays[dow];
          case 'M': return shortMonths[mo];
          case 'F': return fullMonths[mo];
          case 'U': return Math.floor(d.getTime() / 1000);
          default:  return match;
        }
      });
    },
  };
}
