# Changelog

## 0.4.3 - 2026-03-08

### Fixed
- Object literals `{ key: expr|filter }` and array literals `[expr|filter]` now recursively transform their element expressions, so filters, `is` tests, and ternaries inside them all work correctly.
- `transformIsTest` now uses the tokenizer (depth-aware) to locate the `is` keyword instead of a raw regex, so it no longer false-matches `is` inside object/array/paren sub-expressions.
- Parenthesised expressions `(...)` that wrap a full sub-expression (e.g. `(_config.maxLen is defined)`) are now stripped and the inner expression is recursively transformed.
- Standard ternary `condition ? then : else` is now fully transformed — all three sub-expressions are passed through `transformExpression`, so `is` tests and filters in any part work correctly.

## 0.4.1 - 2026-03-08

### Fixed
- `date` filter: `null` / `undefined` input now returns `''` instead of the current date/time. `'now'` still returns the current time. This intentionally diverges from PHP Twig (which defaults null to now) because silently returning the current year from `book.published|date('Y')` is never useful.
- `autoInstallFosRouting`: switched from `dynamic import()` of a JS module with `--callback` wrapper to `fetch()` of a plain `.json` file. The new expected route file is `public/js/fos_js_routes.json` (generated with `--format=json`). The URL is configurable via `options.routesUrl`.

## 0.4.0 - 2026-03-08

### Filters added
- `raw` — pass HTML through unescaped
- `e` / `escape` — HTML-escape a string
- `upper`, `lower`, `capitalize`, `title` — string case
- `trim` — with optional custom char set
- `striptags`, `nl2br` — string cleaning
- `join` — with separator and optional key glue
- `keys`, `first`, `last`, `reverse`, `sort` — array/object
- `slice(start, length)` — array and string
- `split(delimiter, limit)` — string to array
- `abs`, `round(precision, method)`, `number_format(decimals, decPoint, thousandsSep)` — numeric
- `replace(pairs)`, `format(...args)`, `url_encode` — string manipulation
- `json_encode(indent)` — JSON serialization
- `date(format)` — PHP-style date formatting (Y, m, d, H, i, s, M, F, D, l, U, …); date-only strings parsed as UTC to avoid day-shift

### `is` tests added
- `is defined` / `is not defined` — safe scope check (no ReferenceError for absent vars)
- `is null` / `is none`, `is empty`, `is odd`, `is even`, `is iterable`
- `is divisibleby(n)`, `is sameas(value)`
- `is null` and `is empty` also use safe scope access for undefined vars

### Functions added
- `range(low, high, step)` — numeric and character ranges
- `min(...)`, `max(...)` — variadic or single array argument
- `cycle(arr, position)` — circular array access
- `dump(value)` — renders value as inspectable HTML; uses `<andypf-json-viewer>` web component when registered, falls back to `<pre class="twig-dump">` in tests/non-browser environments; scalars wrapped in `{value: ...}`

### Engine fixes
- Backslash escapes in Twig string literals (e.g. `date("Y\m\d")`) now correctly preserved through the expression compiler
- `is` test expressions wired through new `__helpers.callTest()` in render scope
- `engine.registerTest(name, fn)` API added

## 0.3.0 - 2026-03-08

- Added `loadTemplateFromUrl(engine, url, blockName)` to the compat layer — fetches a template URL, auto-detects plain vs `<twig:block>` format, and compiles it into the engine. Exported from the main entrypoint.
- Added `autoInstallFosRouting(engine, options)` to the Symfony adapter — async helper that dynamically imports `fos-routing` and `/js/fos_js_routes.js` when present, then wires `path()` into the engine. Silently no-ops if FOS routing is not installed.

## 0.2.0 - 2026-03-06

- Added expression tokenization primitives for safer top-level parsing and operator normalization.
- Added `{% for %}` support for array loops and key/value object loops.
- Added `{% set %}` support for assignment, multi-assignment, and capture blocks with `{% endset %}`.
- Added control-structure coverage tests for `for` and `set` behavior.

## 0.1.0 - 2026-03-06

- Initial browser-only Twig subset engine with ESM source-first distribution.
- Added core rendering support for `{{ expr }}`, `{% if/elseif/else/endif %}`, `and/or/not`, `?:`, and basic filters.
- Added built-in Twig functions for `stimulus_*`, `path`, `ux_icon`, and `render` via engine/adapters.
- Added Symfony adapter entrypoint for path/icon integration.
- Added fixture-driven test cases and Vitest-based parity testing with HTML normalization.
- Added licensing and attribution docs for upstream Twig.js derivative work.
