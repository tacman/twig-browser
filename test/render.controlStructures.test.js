import { describe, expect, test } from 'vitest';

import { createEngine } from '../src/engine/createEngine.js';
import { normalizeHtml } from './helpers/normalizeHtml.js';

function render(template, vars = {}) {
  const engine = createEngine();
  engine.compileBlock('sample', template);
  return engine.renderBlock('sample', vars);
}

describe('set tag support', () => {
  test('supports scalar set assignment', () => {
    const actual = render('{% set label = container.title ?: container.code %}<span>{{ label }}</span>', {
      container: { title: '', code: 'TREE-77' }
    });

    expect(normalizeHtml(actual)).toBe('<span>TREE-77</span>');
  });

  test('supports multi-variable set assignment', () => {
    const actual = render('{% set first, second = "alpha", "beta" %}<span>{{ first }}-{{ second }}</span>');
    expect(normalizeHtml(actual)).toBe('<span>alpha-beta</span>');
  });

  test('supports set capture blocks', () => {
    const actual = render('{% set badge %}<strong>{{ title }}</strong>{% endset %}<div>{{ badge }}</div>', {
      title: 'Hello'
    });

    expect(normalizeHtml(actual)).toBe('<div><strong>Hello</strong></div>');
  });
});

describe('for tag support', () => {
  test('supports single-variable array loops', () => {
    const actual = render('<ul>{% for img in images %}<li>{{ img.id }}</li>{% endfor %}</ul>', {
      images: [{ id: 1 }, { id: 2 }, { id: 3 }]
    });

    expect(normalizeHtml(actual)).toBe('<ul><li>1</li><li>2</li><li>3</li></ul>');
  });

  test('supports key/value object loops', () => {
    const actual = render('<ul>{% for key, value in metrics %}<li>{{ key }}={{ value }}</li>{% endfor %}</ul>', {
      metrics: { ok: 2, failed: 1 }
    });

    expect(normalizeHtml(actual)).toBe('<ul><li>ok=2</li><li>failed=1</li></ul>');
  });

  test('restores variable shadowed by loop variable', () => {
    const actual = render('{{ item }}{% for item in items %}[{{ item }}]{% endfor %}{{ item }}', {
      item: 'root',
      items: ['a', 'b']
    });

    expect(actual.replace(/\s+/g, '')).toBe('root[a][b]root');
  });
});
