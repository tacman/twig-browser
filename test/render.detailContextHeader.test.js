import { describe, expect, test } from 'vitest';

import { createEngine } from '../src/engine/createEngine.js';
import { installSymfonyTwigAPI } from '../adapters/symfony/installSymfonyTwigAPI.js';
import { detailContextHeaderCases, detailContextHeaderTemplate } from '../src/testing/detailContextHeader.cases.js';
import { normalizeHtml } from './helpers/normalizeHtml.js';

function createTestEngine() {
  const engine = createEngine();

  installSymfonyTwigAPI(engine, {
    pathGenerator: (route, params = {}) => {
      if (route === 'app_homepage') {
        const suffix = params.containerId ? `?containerId=${params.containerId}` : '';
        return `/${suffix}`;
      }

      if (route === 'app_tree_json') {
        return params._format ? `/tree-json.${params._format}` : '/tree-json';
      }

      const query = new URLSearchParams(params).toString();
      return query ? `/${route}?${query}` : `/${route}`;
    },
    uxIconResolver: (name, attrs = {}) => `<i class="bi bi-${name} ${attrs.class ?? ''}"></i>`
  });

  engine.compileBlock('detailContextHeader', detailContextHeaderTemplate);
  return engine;
}

describe('detailContextHeader template parity', () => {
  test.each(detailContextHeaderCases)('$name', ({ vars, expected }) => {
    const engine = createTestEngine();
    const actual = engine.renderBlock('detailContextHeader', vars);

    expect(normalizeHtml(actual)).toBe(normalizeHtml(expected));
  });
});
