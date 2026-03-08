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

describe('is divisibleby', () => {
  test('6 divisibleby 3', () => expect(render('{% if n is divisibleby(3) %}y{% endif %}', { n: 6 })).toBe('y'));
  test('7 not divisibleby 3', () => expect(render('{% if n is not divisibleby(3) %}y{% endif %}', { n: 7 })).toBe('y'));
});

describe('is sameas', () => {
  test('same string',    () => expect(render('{% if a is sameas(b) %}y{% endif %}', { a: 'x', b: 'x' })).toBe('y'));
  test('different vals', () => expect(render('{% if a is not sameas(b) %}y{% endif %}', { a: 1, b: '1' })).toBe('y'));
});
