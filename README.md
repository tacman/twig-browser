# @tacman1123/twig-browser

Browser-only Twig subset engine for modern ESM + importmap deployments.

No `/dist`. No CommonJS. No Node runtime path.

## Features

- Source-first ESM package (`type: module`), shipped from `src/`.
- Importmap-friendly — works with Symfony AssetMapper out of the box.
- Built-in `stimulus_controller`, `stimulus_target`, `stimulus_action` functions.
- Built-in `path`, `ux_icon`, `render` function stubs — throw clear errors until adapters wire them up.
- Symfony adapter for FOS JS Routing and UX Icons.
- Auto-detection of FOS routing via `autoInstallFosRouting()`.
- Template loading from URL via `loadTemplateFromUrl()`.

## Supported Twig subset

- Output: `{{ expr }}`
- Control flow: `{% if %}`, `{% elseif %}`, `{% else %}`, `{% endif %}`
- Loops: `{% for item in list %}`, `{% for key, value in map %}`, `{% endfor %}`
- Assignment: `{% set x = expr %}`, multi-assignment, `{% set x %}...{% endset %}`
- Expressions: `and`, `or`, `not`, Elvis `?:`, `is [not] <test>`

**Filters:** `length`, `default`, `merge`, `raw`, `e`/`escape`, `upper`, `lower`, `capitalize`, `title`, `trim`, `striptags`, `nl2br`, `join`, `keys`, `first`, `last`, `reverse`, `sort`, `slice`, `split`, `abs`, `round`, `number_format`, `replace`, `format`, `url_encode`, `json_encode`, `date`

**`is` tests:** `defined`, `null`/`none`, `empty`, `odd`, `even`, `iterable`, `divisibleby`, `sameas`

**Functions:** `path`, `ux_icon`, `stimulus_controller`, `stimulus_target`, `stimulus_action`, `render`, `range`, `min`, `max`, `cycle`, `dump`

Unsupported tags fail fast with clear diagnostics.

## Installation (Symfony AssetMapper)

```bash
php bin/console importmap:require @tacman1123/twig-browser
php bin/console importmap:require "@tacman1123/twig-browser/adapters/symfony"
```

## Basic usage

```js
import { createEngine, compileTwigBlocks, twigRender } from '@tacman1123/twig-browser';
import { installSymfonyTwigAPI } from '@tacman1123/twig-browser/adapters/symfony';

const engine = createEngine();

installSymfonyTwigAPI(engine, {
  Routing,                                          // FOS Routing instance
  uxIconResolver: (name) => `<svg>…</svg>`          // UX Icons resolver
});

// Compile blocks from a <script id="my-blocks"> tag containing JSON
compileTwigBlocks(engine, null, 'my-blocks');

const html = twigRender(engine, null, 'blockName', { item });
document.querySelector('#target').innerHTML = html;
```

## Symfony adapter

### `installSymfonyTwigAPI(engine, options)`

Wires `path()` and `ux_icon()` into the engine synchronously.

```js
import { installSymfonyTwigAPI } from '@tacman1123/twig-browser/adapters/symfony';

installSymfonyTwigAPI(engine, {
  Routing,                          // FOS Routing object with .generate()
  // or:
  pathGenerator: (route, params) => myRouter.generate(route, params),

  uxIconResolver: (name, attrs) => iconMap[name] ?? '',
  // or alias:
  iconResolver: (name, attrs) => iconMap[name] ?? '',
});
```

If `path()` or `ux_icon()` are called in a template before being configured, they throw a clear error at render time.

### `autoInstallFosRouting(engine)`

Async helper that auto-detects FOS JS Routing and wires `path()` — no config needed.

```js
import { autoInstallFosRouting } from '@tacman1123/twig-browser/adapters/symfony';

const engine = createEngine();
autoInstallFosRouting(engine); // fire-and-forget; no-op if fos-routing not installed
```

Dynamically imports `fos-routing` and `/js/fos_js_routes.js`. If both succeed, calls `Routing.setData()` and registers `path()`. Silently skips on any import failure.

## Loading templates from a URL

```js
import { loadTemplateFromUrl } from '@tacman1123/twig-browser';

const blockName = await loadTemplateFromUrl(engine, '/templates/hit.html.twig');
const html = engine.renderBlock(blockName, { hit });
```

Fetches the URL, auto-detects whether it contains `<twig:block name="…">` wrappers or is a plain template, compiles it, and returns the primary block name.

## File layout

```text
.
├── package.json
├── src/
│   ├── index.js                        # exports: createEngine, compileTwigBlocks, twigRender, loadTemplateFromUrl
│   ├── engine/
│   │   ├── createEngine.js
│   │   └── compile.js
│   ├── compat/
│   │   ├── compileTwigBlocks.js        # compile <twig:block> tags from DOM or string
│   │   ├── twigRender.js               # render with registry guard
│   │   └── loadTemplateFromUrl.js      # fetch URL → compile → return block name
│   ├── extensions/
│   │   ├── filters.js                  # all core filters
│   │   ├── tests.js                    # is defined/null/empty/odd/even/iterable/…
│   │   ├── functions.js                # range, min, max, cycle, dump
│   │   └── stimulus.js                 # stimulus_controller / _target / _action
│   └── testing/
│       └── detailContextHeader.cases.js
└── adapters/
    └── symfony/
        └── installSymfonyTwigAPI.js    # installSymfonyTwigAPI + autoInstallFosRouting
```

## Testing

```bash
npm test
```

Table-driven fixture tests using Vitest and parse5 HTML normalization.

## License

BSD-2-Clause. See `THIRD_PARTY_NOTICES.md` for upstream Twig.js attribution.
