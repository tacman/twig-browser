import { describe, expect, test } from 'vitest';
import { createEngine } from '../src/engine/createEngine.js';

function render(template, vars = {}) {
  const engine = createEngine();
  engine.compileBlock('t', template);
  return engine.renderBlock('t', vars);
}

describe('is defined', () => {
  test('defined var is defined',   () => expect(render('{% if x is defined %}yes{% endif %}', { x: 0 })).toBe('yes'));
  test('null var is defined',      () => expect(render('{% if x is defined %}yes{% endif %}', { x: null })).toBe(''));
  test('missing var is not defined', () => expect(render('{% if x is defined %}yes{% else %}no{% endif %}', {})).toBe('no'));
  test('is not defined',           () => expect(render('{% if x is not defined %}no{% endif %}', {})).toBe('no'));
});

describe('is empty', () => {
  test('empty string is empty',  () => expect(render('{% if s is empty %}y{% endif %}', { s: '' })).toBe('y'));
  test('empty array is empty',   () => expect(render('{% if a is empty %}y{% endif %}', { a: [] })).toBe('y'));
  test('null is empty',          () => expect(render('{% if v is empty %}y{% endif %}', { v: null })).toBe('y'));
  test('non-empty string',       () => expect(render('{% if s is not empty %}y{% endif %}', { s: 'hi' })).toBe('y'));
  test('zero is empty',          () => expect(render('{% if n is empty %}y{% endif %}', { n: 0 })).toBe('y'));
});

describe('is null / none', () => {
  test('null is null',           () => expect(render('{% if v is null %}y{% endif %}', { v: null })).toBe('y'));
  test('undefined is null',      () => expect(render('{% if v is null %}y{% endif %}', {})).toBe('y'));
  test('zero is not null',       () => expect(render('{% if n is not null %}y{% endif %}', { n: 0 })).toBe('y'));
  test('none alias',             () => expect(render('{% if v is none %}y{% endif %}', { v: null })).toBe('y'));
});

describe('is odd / even', () => {
  test('3 is odd',  () => expect(render('{% if n is odd %}y{% endif %}',      { n: 3 })).toBe('y'));
  test('4 is even', () => expect(render('{% if n is even %}y{% endif %}',     { n: 4 })).toBe('y'));
  test('3 is not even', () => expect(render('{% if n is not even %}y{% endif %}', { n: 3 })).toBe('y'));
});

describe('is iterable', () => {
  test('array is iterable',  () => expect(render('{% if a is iterable %}y{% endif %}', { a: [1] })).toBe('y'));
  test('object is iterable', () => expect(render('{% if o is iterable %}y{% endif %}', { o: { x: 1 } })).toBe('y'));
  test('string is not iterable', () => expect(render('{% if s is not iterable %}y{% endif %}', { s: 'hi' })).toBe('y'));
});

describe('is sameas / same as', () => {
  test('sameas (one word)',  () => expect(render('{% if a is sameas(b) %}y{% endif %}', { a: 'x', b: 'x' })).toBe('y'));
  test('same as (two words)', () => expect(render('{% if a is same as(b) %}y{% endif %}', { a: 'x', b: 'x' })).toBe('y'));
  test('not sameas',        () => expect(render('{% if a is not sameas(b) %}y{% endif %}', { a: 1, b: '1' })).toBe('y'));
  test('not same as',       () => expect(render('{% if a is not same as(b) %}y{% endif %}', { a: 1, b: '1' })).toBe('y'));
});

describe('is divisibleby / divisible by', () => {
  test('divisibleby (one word)',  () => expect(render('{% if n is divisibleby(3) %}y{% endif %}', { n: 6 })).toBe('y'));
  test('divisible by (two words)', () => expect(render('{% if n is divisible by(3) %}y{% endif %}', { n: 6 })).toBe('y'));
  test('not divisible by',        () => expect(render('{% if n is not divisible by(3) %}y{% endif %}', { n: 7 })).toBe('y'));
});

describe('starts with / ends with / matches', () => {
  // `is` form
  test('is starts with true',       () => expect(render("{% if k is starts with '_' %}y{% endif %}", { k: '_hidden' })).toBe('y'));
  test('is starts with false',      () => expect(render("{% if k is starts with '_' %}y{% endif %}", { k: 'visible' })).toBe(''));
  test('is not starts with',        () => expect(render("{% if k is not starts with '_' %}y{% endif %}", { k: 'visible' })).toBe('y'));
  test('is ends with true',         () => expect(render("{% if s is ends with 'ing' %}y{% endif %}", { s: 'running' })).toBe('y'));
  test('is ends with false',        () => expect(render("{% if s is ends with 'ing' %}y{% endif %}", { s: 'runner' })).toBe(''));
  test('is matches true',           () => expect(render("{% if s is matches '/^\\\\d+$/' %}y{% endif %}", { s: '42' })).toBe('y'));
  test('is matches false',          () => expect(render("{% if s is matches '/^\\\\d+$/' %}y{% endif %}", { s: 'abc' })).toBe(''));
  // infix form (no `is`) — PHP Twig also accepts this
  test('infix starts with true',    () => expect(render("{% if k starts with '_' %}y{% endif %}", { k: '_hidden' })).toBe('y'));
  test('infix starts with false',   () => expect(render("{% if k starts with '_' %}y{% endif %}", { k: 'visible' })).toBe(''));
  test('infix not starts with',     () => expect(render("{% if k not starts with '_' %}y{% endif %}", { k: 'visible' })).toBe('y'));
  test('infix ends with true',      () => expect(render("{% if s ends with 'ing' %}y{% endif %}", { s: 'running' })).toBe('y'));
});

describe('is-tests combined with and/or', () => {
  // Mirrors the real-world failure: `imageUrl is null and (v is not iterable) and (v is not same as(null))`
  test('is null and is not null', () => {
    expect(render('{% if a is null and b is not null %}y{% endif %}', { a: null, b: 1 })).toBe('y');
    expect(render('{% if a is null and b is not null %}y{% endif %}', { a: null, b: null })).toBe('');
  });
  test('is null or is defined', () => {
    expect(render('{% if a is null or b is defined %}y{% endif %}', { a: 1, b: 2 })).toBe('y');
    expect(render('{% if a is null or b is defined %}y{% endif %}', { a: 1 })).toBe('');
  });
  test('is-test and plain condition', () => {
    expect(render('{% if a is null and flag %}y{% endif %}', { a: null, flag: true })).toBe('y');
    expect(render('{% if a is null and flag %}y{% endif %}', { a: null, flag: false })).toBe('');
  });
  test('is sameas combined with and', () => {
    expect(render('{% if a is sameas(1) and b is sameas(2) %}y{% endif %}', { a: 1, b: 2 })).toBe('y');
  });
});
