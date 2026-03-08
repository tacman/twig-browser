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

describe('object literals with filters and is-tests', () => {
  test('pipe filter inside object literal compiles correctly', () => {
    // Regression: splitTopLevel was treating | inside {} as a filter pipe
    const actual = render('{% set cfg = { pk: _config.primaryKey|default("id") } %}{{ cfg.pk }}', {
      _config: {}
    });
    expect(actual).toBe('id');
  });

  test('is defined inside object literal values does not corrupt expression', () => {
    const actual = render(
      '{% set cfg = { maxLen: (_config.maxLen is defined) ? _config.maxLen : 120 } %}{{ cfg.maxLen }}',
      { _config: {} }
    );
    expect(actual).toBe('120');
  });

  test('mixed filters and is-tests in one object literal', () => {
    // Mirrors the real failing template from the bug report
    const template = `{% set cfg = {
      pk:      _config.primaryKey|default('id'),
      maxLen:  (_config.maxLen is defined) ? _config.maxLen : 99
    } %}{{ cfg.pk }}/{{ cfg.maxLen }}`;
    expect(render(template, { _config: { maxLen: 42 } })).toBe('id/42');
    expect(render(template, { _config: {} })).toBe('id/99');
  });
});

describe('~ string concatenation operator', () => {
  test('concatenates two strings', () => {
    expect(render('{{ "foo" ~ "bar" }}')).toBe('foobar');
  });
  test('concatenates string and variable', () => {
    expect(render('{{ "hit-" ~ id }}', { id: 42 })).toBe('hit-42');
  });
  test('chains multiple ~ operators', () => {
    expect(render('{{ a ~ "-" ~ b }}', { a: 'foo', b: 'bar' })).toBe('foo-bar');
  });
  test('coerces null to empty string', () => {
    expect(render('{{ "x-" ~ val }}', { val: null })).toBe('x-');
  });
  test('works inside set tag (mirrors bug report pattern)', () => {
    expect(render(
      "{% set collapseId = 'hit-' ~ pk ~ '-more' %}{{ collapseId }}",
      { pk: 7 }
    )).toBe('hit-7-more');
  });
  test('works combined with ?: elvis', () => {
    expect(render(
      "{% set id = 'hit-' ~ (pk ?: 'x') ~ '-more' %}{{ id }}",
      { pk: null }
    )).toBe('hit-x-more');
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
