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

describe('?? null-coalescing operator', () => {
  test('returns left when not null',  () => expect(render('{{ a ?? "x" }}', { a: 1 })).toBe('1'));
  test('returns right when null',     () => expect(render('{{ a ?? "x" }}', { a: null })).toBe('x'));
  test('returns right when missing',  () => expect(render('{{ a ?? "x" }}')).toBe('x'));
  test('chained ??',                  () => expect(render('{{ a ?? b ?? "z" }}', { a: null, b: null })).toBe('z'));
  test('with function call on left',  () => expect(render(
    "{{ attribute(hit, key|default('id')) ?? 'none' }}",
    { hit: { id: 42 }, key: null }
  )).toBe('42'));
});

describe('undefined variable safety', () => {
  test('missing var is falsy in if', () => expect(render('{% if x %}y{% else %}n{% endif %}')).toBe('n'));
  test('null var is falsy in if',    () => expect(render('{% if x %}y{% else %}n{% endif %}', { x: null })).toBe('n'));
  test('missing var outputs empty',  () => expect(render('{{ x }}')).toBe(''));
  test('missing dotted path is falsy', () => expect(render('{% if a.b %}y{% else %}n{% endif %}')).toBe('n'));
  test('missing dotted path outputs empty', () => expect(render('{{ a.b }}')).toBe(''));
  test('truthy var works normally',  () => expect(render('{% if x %}y{% endif %}', { x: 'hi' })).toBe('y'));
});

describe('infix string tests', () => {
  test('supports starts with chained with or (no recursion)', () => {
    const tpl = `
      {% set isUrl = value starts with 'http://' or value starts with 'https://' %}
      {{ isUrl ? 'yes' : 'no' }}
    `;
    expect(render(tpl, { value: 'https://example.org' }).trim()).toBe('yes');
    expect(render(tpl, { value: '/local/path' }).trim()).toBe('no');
  });

  test('supports explicit is starts with form', () => {
    const tpl = `
      {% set isSecure = value is starts with 'https://' %}
      {{ isSecure ? 'yes' : 'no' }}
    `;
    expect(render(tpl, { value: 'https://example.org' }).trim()).toBe('yes');
  });

  test('supports is string test', () => {
    expect(render("{% if value is string %}yes{% else %}no{% endif %}", { value: 'abc' }).trim()).toBe('yes');
    expect(render("{% if value is string %}yes{% else %}no{% endif %}", { value: 123 }).trim()).toBe('no');
  });
});

describe('in / not in operator', () => {
  test('supports substring containment for strings', () => {
    expect(render("{% if 'http://' in value %}yes{% else %}no{% endif %}", { value: 'http://example.org/a.jpg' }).trim()).toBe('yes');
    expect(render("{% if 'http://' in value %}yes{% else %}no{% endif %}", { value: 'https://example.org/a.jpg' }).trim()).toBe('no');
  });

  test('supports membership for arrays', () => {
    expect(render("{% if 'jpg' in tags %}yes{% else %}no{% endif %}", { tags: ['png', 'jpg'] }).trim()).toBe('yes');
  });

  test('supports key lookup for objects', () => {
    expect(render("{% if 'title' in hit %}yes{% else %}no{% endif %}", { hit: { title: 'A' } }).trim()).toBe('yes');
    expect(render("{% if 'missing' in hit %}yes{% else %}no{% endif %}", { hit: { title: 'A' } }).trim()).toBe('no');
  });

  test('supports not in negation', () => {
    expect(render("{% if 'http://' not in value %}yes{% else %}no{% endif %}", { value: 'https://example.org' }).trim()).toBe('yes');
  });
});

describe('{# comments #}', () => {
  test('inline comment is stripped',    () => expect(render('a{# comment #}b')).toBe('ab'));
  test('comment at start',              () => expect(render('{# hi #}x')).toBe('x'));
  test('comment at end',                () => expect(render('x{# hi #}')).toBe('x'));
  test('comment inside if block',       () => expect(render('{% if true %}{# note #}y{% endif %}')).toBe('y'));
  test('multiline comment is stripped', () => expect(render('a{#\n  multi\n  line\n#}b')).toBe('ab'));
});

describe('whitespace-control dashes {{- -}} and {%- -%}', () => {
  test('{{- expr -}} strips dashes and renders value', () => {
    expect(render('{{- name -}}', { name: 'Alice' })).toBe('Alice');
  });
  test('{{- expr -}} with null coalescing', () => {
    expect(render('{{- a ?? b ?? c -}}', { b: 'fallback' })).toBe('fallback');
    expect(render('{{- a ?? b ?? c -}}', { a: 'first' })).toBe('first');
    expect(render('{{- a ?? b ?? c -}}', { c: 'last' })).toBe('last');
  });
  test('{%- if -%} strips dashes from tags', () => {
    expect(render('{%- if show -%}yes{%- endif -%}', { show: true })).toBe('yes');
    expect(render('{%- if show -%}yes{%- endif -%}', { show: false })).toBe('');
  });
  test('nodeLabel pattern: title with imageCount badge', () => {
    const tpl = '{{- node.title ?? node.name ?? node.code -}}'
      + '{% if node.imageCount > 0 %}'
      + '<span class="badge">{{ node.imageCount }}</span>'
      + '{% endif %}';
    expect(render(tpl, { node: { title: 'Room 1', imageCount: 3 } }))
      .toBe('Room 1<span class="badge">3</span>');
    expect(render(tpl, { node: { name: 'fallback', imageCount: 0 } }))
      .toBe('fallback');
    expect(render(tpl, { node: { code: 'abc', imageCount: 1 } }))
      .toBe('abc<span class="badge">1</span>');
  });
});
