/**
 * Built-in Twig functions (browser-safe subset).
 *
 * dump() uses @andypf/json-viewer when available (custom element).
 * If the element isn't defined yet (e.g. in tests) it falls back to <pre>.
 */
export function createCoreFunctions() {
  return {
    range(low, high, step = 1) {
      const result = [];
      const lowN  = Number(low);
      const highN = Number(high);
      const stepN = Math.abs(Number(step)) || 1;

      if (!isNaN(lowN) && !isNaN(highN)) {
        if (lowN <= highN) {
          for (let i = lowN; i <= highN; i += stepN) result.push(i);
        } else {
          for (let i = lowN; i >= highN; i -= stepN) result.push(i);
        }
        return result;
      }

      // Character range (e.g. range('a', 'z'))
      const lowC  = String(low).charCodeAt(0);
      const highC = String(high).charCodeAt(0);
      if (lowC <= highC) {
        for (let i = lowC; i <= highC; i += stepN) result.push(String.fromCharCode(i));
      } else {
        for (let i = lowC; i >= highC; i -= stepN) result.push(String.fromCharCode(i));
      }
      return result;
    },

    min(...args) {
      const flat = args.length === 1 && Array.isArray(args[0]) ? args[0] : args;
      return flat.reduce((a, b) => (Number(b) < Number(a) ? b : a));
    },

    max(...args) {
      const flat = args.length === 1 && Array.isArray(args[0]) ? args[0] : args;
      return flat.reduce((a, b) => (Number(b) > Number(a) ? b : a));
    },

    cycle(arr, position) {
      if (!Array.isArray(arr) || arr.length === 0) return null;
      return arr[((position % arr.length) + arr.length) % arr.length];
    },

    /**
     * random() — mirrors PHP Twig's random():
     *   - no args: random integer (0 to MAX_SAFE_INTEGER)
     *   - integer arg: random integer between 0 and that number (inclusive)
     *   - array arg: random element from the array
     *   - string arg: random character from the string
     */
    random(value) {
      if (value === undefined || value === null) {
        return Math.floor(Math.random() * Number.MAX_SAFE_INTEGER);
      }
      if (Array.isArray(value)) {
        return value[Math.floor(Math.random() * value.length)];
      }
      if (typeof value === 'string') {
        return value.charAt(Math.floor(Math.random() * value.length));
      }
      const n = Number(value);
      if (!isNaN(n)) {
        const lo = Math.min(0, n);
        const hi = Math.max(0, n);
        return Math.floor(Math.random() * (hi - lo + 1)) + lo;
      }
      return value;
    },

    /**
     * dump(value) — renders value as inspectable HTML.
     *
     * Uses <andypf-json-viewer> if the custom element is registered in the
     * current document (i.e. @andypf/json-viewer has been imported).
     * Falls back to an escaped <pre> block for server-side / test environments.
     *
     * The caller is responsible for importing @andypf/json-viewer and its CSS.
     * Typical setup in a Stimulus controller:
     *
     *   import '@andypf/json-viewer';
     *
     * The generated <andypf-json-viewer> element is self-contained and
     * styled via its own shadow DOM, so no external CSS link is needed.
     */
    dump(value) {
      const safe = (s) => String(s ?? '')
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

      // Normalize scalars to an object so json-viewer always gets valid JSON.
      const normalized = (value !== null && typeof value === 'object')
        ? value
        : { value };

      let jsonString;
      try {
        jsonString = JSON.stringify(normalized);
      } catch {
        jsonString = JSON.stringify({ error: 'not serializable' });
      }

      // Check if the custom element is registered (browser environment).
      const isRegistered =
        typeof customElements !== 'undefined' &&
        customElements.get('andypf-json-viewer') !== undefined;

      if (isRegistered) {
        // Attributes set here are reflected as properties by the web component.
        return `<andypf-json-viewer expanded="2" indent="2" show-data-types="false" show-toolbar="true" show-size="true" show-copy="true" expand-icon-type="arrow" theme="default-light" data='${jsonString.replace(/'/g, '&#39;')}'></andypf-json-viewer>`;
      }

      // Fallback: pretty-printed <pre>
      return `<pre class="twig-dump">${safe(JSON.stringify(normalized, null, 2))}</pre>`;
    },
  };
}
