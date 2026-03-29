import { describe, expect, test } from 'vitest';
import { createEngine } from '../src/engine/createEngine.js';

function render(template, vars = {}) {
  const engine = createEngine();
  engine.compileBlock('t', template);
  return engine.renderBlock('t', vars);
}

describe('range()', () => {
  test('numeric ascending',  () => expect(render('{{ range(1,4)|join(",") }}')).toBe('1,2,3,4'));
  test('numeric descending', () => expect(render('{{ range(4,1)|join(",") }}')).toBe('4,3,2,1'));
  test('with step',          () => expect(render('{{ range(0,10,3)|join(",") }}')).toBe('0,3,6,9'));
  test('char range',         () => expect(render('{{ range("a","d")|join(",") }}')).toBe('a,b,c,d'));
});

describe('min() / max()', () => {
  test('min of args',   () => expect(render('{{ min(3,1,4,1,5) }}')).toBe('1'));
  test('max of args',   () => expect(render('{{ max(3,1,4,1,5) }}')).toBe('5'));
  test('min of array',  () => expect(render('{{ min(a) }}', { a: [7, 2, 9] })).toBe('2'));
  test('max of array',  () => expect(render('{{ max(a) }}', { a: [7, 2, 9] })).toBe('9'));
});

describe('cycle()', () => {
  test('cycles through array', () => {
    expect(render('{{ cycle(a,0) }}-{{ cycle(a,1) }}-{{ cycle(a,2) }}', { a: ['odd', 'even'] }))
      .toBe('odd-even-odd');
  });
});

describe('dump()', () => {
  test('falls back to pre when no custom element registered', () => {
    const out = render('{{ dump(x)|raw }}', { x: { id: 1, name: 'test' } });
    expect(out).toContain('twig-dump');
    expect(out).toContain('"id"');
  });
  test('wraps scalar in value key', () => {
    const out = render('{{ dump(n)|raw }}', { n: 42 });
    expect(out).toContain('"value"');
    expect(out).toContain('42');
  });
  test('null dump', () => {
    const out = render('{{ dump(v)|raw }}', { v: null });
    expect(out).toContain('twig-dump');
  });
});

describe('attribute()', () => {
  test('accesses property by dynamic key', () => {
    expect(render('{{ attribute(obj, key) }}', { obj: { name: 'Alice' }, key: 'name' })).toBe('Alice');
  });
  test('accesses nested property', () => {
    expect(render('{{ attribute(obj, "id") }}', { obj: { id: 42 } })).toBe('42');
  });
  test('with filter in key arg (the real bug)', () => {
    // attribute(hit, _config.primaryKey|default('id')) — pipe inside function arg
    expect(render(
      '{{ attribute(hit, _config.primaryKey|default("id")) }}',
      { hit: { id: 99, title: "Wine" }, _config: {} }
    )).toBe('99');
  });
  test('with non-default key', () => {
    expect(render(
      '{{ attribute(hit, _config.primaryKey|default("id")) }}',
      { hit: { slug: "wine-red", id: 1 }, _config: { primaryKey: "slug" } }
    )).toBe('wine-red');
  });
});

describe('random()', () => {
  test('no args returns a non-negative integer', () => {
    const out = Number(render('{{ random() }}'));
    expect(out).toBeGreaterThanOrEqual(0);
    expect(Number.isInteger(out)).toBe(true);
  });
  test('integer arg returns value in [0, n]', () => {
    // run a few times to be confident it stays in range
    for (let i = 0; i < 20; i++) {
      const out = Number(render('{{ random(10) }}'));
      expect(out).toBeGreaterThanOrEqual(0);
      expect(out).toBeLessThanOrEqual(10);
      expect(Number.isInteger(out)).toBe(true);
    }
  });
  test('array arg returns an element from the array', () => {
    const choices = ['foo', 'bar', 'baz'];
    for (let i = 0; i < 20; i++) {
      const out = render('{{ random(a) }}', { a: choices });
      expect(choices).toContain(out);
    }
  });
  test('string arg returns a single char from the string', () => {
    for (let i = 0; i < 20; i++) {
      const out = render('{{ random("abc") }}');
      expect(['a', 'b', 'c']).toContain(out);
    }
  });
});

describe('pipe filter inside function arguments', () => {
  test('default filter in function arg', () => {
    expect(render('{{ range(1, limit|default(3))|join(",") }}', { limit: null })).toBe('1,2,3');
  });
  test('default filter resolves to provided value', () => {
    expect(render('{{ range(1, limit|default(3))|join(",") }}', { limit: 5 })).toBe('1,2,3,4,5');
  });
});

describe('render() recursion guard', () => {
  test('throws clear error when a block renders itself', () => {
    const engine = createEngine();
    engine.compileBlock('loop', '{{ render("loop") }}');

    expect(() => engine.renderBlock('loop')).toThrowError('Infinite Twig block recursion detected: loop -> loop');
  });

  test('throws clear error for indirect recursion', () => {
    const engine = createEngine();
    engine.compileBlock('a', '{{ render("b") }}');
    engine.compileBlock('b', '{{ render("a") }}');

    expect(() => engine.renderBlock('a')).toThrowError('Infinite Twig block recursion detected: a -> b -> a');
  });
});
