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
