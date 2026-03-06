# Changelog

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
