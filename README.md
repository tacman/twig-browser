# @tacman1123/twig-browser

Browser-only Twig subset engine for modern ESM + importmap deployments.

No `/dist`. No CommonJS. No Node runtime path.

## Current design

- Source-first ESM package (`type: module`), shipped from `src/`.
- Import-map friendly public API.
- Built-in support for `stimulus_controller`, `stimulus_target`, `stimulus_action`.
- Built-in function names for Symfony compatibility: `path`, `ux_icon`, `render`.
- `path` and `ux_icon` throw clear runtime errors until adapters are installed.

## Testing

- Runner: `vitest`
- HTML comparison: `parse5` normalization
- Shared fixture cases: `src/testing/detailContextHeader.cases.js`
- Run tests: `npm test`

Current pattern is table-driven: compile a template once, iterate variable sets, compare normalized HTML output.

## Supported Twig subset (initial)

- Output: `{{ expr }}`
- Control flow: `{% if %}`, `{% elseif %}`, `{% else %}`, `{% endif %}`
- Expressions: `and`, `or`, `not`, Elvis `?:`
- Filters: `length`, `default`
- Function calls: `path`, `ux_icon`, `stimulus_*`, `render`

Unsupported tags fail fast with diagnostics.

## Import map usage

```html
<script type="importmap">
{
  "imports": {
    "@tacman1123/twig-browser": "/assets/twig-browser/src/index.js",
    "@tacman1123/twig-browser/adapters/symfony": "/assets/twig-browser/adapters/symfony/installSymfonyTwigAPI.js"
  }
}
</script>
<script type="module">
  import { createEngine, compileTwigBlocks, twigRender } from '@tacman1123/twig-browser';
  import { installSymfonyTwigAPI } from '@tacman1123/twig-browser/adapters/symfony';

  const registry = new Map();
  const engine = createEngine();

  installSymfonyTwigAPI(engine, { Routing, uxIconResolver: (name) => `<span>${name}</span>` });
  compileTwigBlocks(engine, registry, 'show-pages-blocks');

  const html = twigRender(engine, registry, 'detailContextHeader', {
    image: null,
    container: { id: 42, title: 'Demo Container', images: [1] }
  });

  document.querySelector('#target').innerHTML = html;
</script>
```

## JS tree rendering target

This engine is intended for render-on-demand UI updates (including jsTree node rendering). A typical flow:

1. Compile block templates once on page load.
2. On jsTree node open/select events, call `twigRender(engine, registry, nodeTemplate, nodeData)`.
3. Inject resulting HTML into node detail panes/tooltips/context sections.

Because rendering is synchronous and browser-only, node redraws are deterministic and easy to profile.

## Symfony adapter

`installSymfonyTwigAPI(engine, options)` supports:

- `Routing` object with `.generate()`
- or a direct `pathGenerator(route, params)` function
- `uxIconResolver(name, attrs)` (or `iconResolver` alias)

If these are missing, calls to `path()` or `ux_icon()` throw clear errors at render time.

## File layout

```text
.
├── package.json
├── LICENSE
├── THIRD_PARTY_NOTICES.md
├── src/
│   ├── index.js
│   ├── testing/
│   │   └── detailContextHeader.cases.js
│   ├── engine/
│   │   ├── createEngine.js
│   │   └── compile.js
│   ├── compat/
│   │   ├── compileTwigBlocks.js
│   │   └── twigRender.js
│   └── extensions/
│       ├── filters.js
│       └── stimulus.js
└── adapters/
    └── symfony/
        └── installSymfonyTwigAPI.js
```

## License and attribution

- License: BSD-2-Clause (`LICENSE`)
- Upstream attribution: `THIRD_PARTY_NOTICES.md`
- This keeps required upstream notice while allowing substantial ongoing rewrite work.

## Next implementation steps

- Expand expression parser beyond current subset (object literals, safer tokenization, clearer diagnostics).
- Add `{% for %}` and `{% set %}` with fixture-driven tests.
- Add filters used in app templates (`merge`, `join`, `number_format`, `json_encode`).
- Add snapshot/parity fixtures from upstream Twig.js tests and prioritize phase-1 compatibility lanes.
- Add optional locutus-backed compat module (v3 named-export shape) where parity wins outweigh bundle size.

## Release

- Planned first tag: `v0.1.0`
- NPM package: `@tacman1123/twig-browser`
- Publish command: `npm publish --access public`
