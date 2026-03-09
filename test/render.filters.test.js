import { describe, expect, test } from 'vitest';
import { createEngine } from '../src/engine/createEngine.js';

function render(template, vars = {}) {
  const engine = createEngine();
  engine.compileBlock('t', template);
  return engine.renderBlock('t', vars);
}

// ---------------------------------------------------------------------------
// String case
// ---------------------------------------------------------------------------
describe('upper / lower / capitalize / title', () => {
  test('upper', () => expect(render('{{ s|upper }}', { s: 'hello' })).toBe('HELLO'));
  test('lower', () => expect(render('{{ s|lower }}', { s: 'WORLD' })).toBe('world'));
  test('capitalize', () => expect(render('{{ s|capitalize }}', { s: 'hELLO wORLD' })).toBe('Hello world'));
  test('title',      () => expect(render('{{ s|title }}',      { s: 'hello world' })).toBe('Hello World'));
  test('upper null safe', () => expect(render('{{ s|upper }}', { s: null })).toBe(''));
});

// ---------------------------------------------------------------------------
// HTML safety
// ---------------------------------------------------------------------------
describe('raw / e / escape', () => {
  test('raw passes HTML through', () => {
    expect(render('{{ s|raw }}', { s: '<b>bold</b>' })).toBe('<b>bold</b>');
  });
  test('e escapes HTML entities', () => {
    expect(render('{{ s|e }}', { s: '<b>"it\'s"</b>' }))
      .toBe('&lt;b&gt;&quot;it&#039;s&quot;&lt;/b&gt;');
  });
  test('escape is alias for e', () => {
    expect(render('{{ s|escape }}', { s: '<x>' })).toBe('&lt;x&gt;');
  });
  test('striptags removes tags', () => {
    expect(render('{{ s|striptags }}', { s: '<p>Hello <b>world</b></p>' })).toBe('Hello world');
  });
  test('nl2br converts newlines', () => {
    expect(render('{{ s|nl2br|raw }}', { s: 'a\nb' })).toBe('a<br />\nb');
  });
});

// ---------------------------------------------------------------------------
// trim
// ---------------------------------------------------------------------------
describe('trim', () => {
  test('trims whitespace by default', () => expect(render('{{ s|trim }}', { s: '  hi  ' })).toBe('hi'));
  test('trims specific chars', () => expect(render('{{ s|trim("/") }}', { s: '/path/' })).toBe('path'));
});

// ---------------------------------------------------------------------------
// Array / object
// ---------------------------------------------------------------------------
describe('join', () => {
  test('joins array with separator', () => expect(render('{{ a|join(", ") }}', { a: ['x', 'y', 'z'] })).toBe('x, y, z'));
  test('joins with empty separator', () => expect(render('{{ a|join }}', { a: ['a', 'b'] })).toBe('ab'));
  test('joins object values', () => expect(render('{{ o|join("-") }}', { o: { a: 1, b: 2 } })).toBe('1-2'));
  test('inline array literal with string-separator filter', () => expect(render('{{ ["a","b","c"]|join(", ") }}')).toBe('a, b, c'));
  test('inline array literal with simple separator filter', () => expect(render('{{ [1,2,3]|join("-") }}')).toBe('1-2-3'));
});

describe('keys', () => {
  test('returns object keys', () => expect(render('{{ o|keys|join(",") }}', { o: { x: 1, y: 2 } })).toBe('x,y'));
  test('returns array indices', () => expect(render('{{ a|keys|join(",") }}', { a: ['p', 'q'] })).toBe('0,1'));
});

describe('first / last', () => {
  test('first of array', () => expect(render('{{ a|first }}', { a: [10, 20, 30] })).toBe('10'));
  test('last of array',  () => expect(render('{{ a|last }}',  { a: [10, 20, 30] })).toBe('30'));
  test('first of string', () => expect(render('{{ s|first }}', { s: 'abc' })).toBe('a'));
  test('last of string',  () => expect(render('{{ s|last }}',  { s: 'abc' })).toBe('c'));
});

describe('slice', () => {
  test('slices array', () => expect(render('{{ a|slice(1,2)|join(",") }}', { a: [1, 2, 3, 4] })).toBe('2,3'));
  test('slices string', () => expect(render('{{ s|slice(1,3) }}', { s: 'abcdef' })).toBe('bcd'));
  test('negative start', () => expect(render('{{ a|slice(-2)|join(",") }}', { a: [1, 2, 3, 4] })).toBe('3,4'));
});

describe('reverse', () => {
  test('reverses array', () => expect(render('{{ a|reverse|join(",") }}', { a: [1, 2, 3] })).toBe('3,2,1'));
  test('reverses string', () => expect(render('{{ s|reverse }}', { s: 'abc' })).toBe('cba'));
});

describe('sort', () => {
  test('sorts array', () => expect(render('{{ a|sort|join(",") }}', { a: [3, 1, 2] })).toBe('1,2,3'));
});

describe('split', () => {
  test('splits on delimiter', () => expect(render('{{ s|split(",")|join("|") }}', { s: 'a,b,c' })).toBe('a|b|c'));
  test('split with limit', () => expect(render('{{ s|split(",",2)|join("|") }}', { s: 'a,b,c' })).toBe('a|b'));
});

// ---------------------------------------------------------------------------
// Numeric
// ---------------------------------------------------------------------------
describe('abs', () => {
  test('abs of negative', () => expect(render('{{ n|abs }}', { n: -5 })).toBe('5'));
  test('abs of positive', () => expect(render('{{ n|abs }}', { n: 3 })).toBe('3'));
});

describe('round', () => {
  test('rounds to nearest', () => expect(render('{{ n|round }}', { n: 2.5 })).toBe('3'));
  test('rounds to precision', () => expect(render('{{ n|round(2) }}', { n: 3.14159 })).toBe('3.14'));
  test('round ceil', () => expect(render('{{ n|round(0,"ceil") }}', { n: 2.1 })).toBe('3'));
  test('round floor', () => expect(render('{{ n|round(0,"floor") }}', { n: 2.9 })).toBe('2'));
});

describe('number_format', () => {
  test('basic formatting', () => expect(render('{{ n|number_format }}', { n: 1234567 })).toBe('1,234,567'));
  test('with decimals', () => expect(render('{{ n|number_format(2) }}', { n: 1234.5 })).toBe('1,234.50'));
  test('custom separators', () => expect(render('{{ n|number_format(2,",",".") }}', { n: 1234.5 })).toBe('1.234,50'));
});

// ---------------------------------------------------------------------------
// String manipulation
// ---------------------------------------------------------------------------
describe('replace', () => {
  test('replaces all occurrences', () => {
    expect(render('{{ s|replace({"foo": "bar"}) }}', { s: 'foo and foo' })).toBe('bar and bar');
  });
  test('multiple replacements', () => {
    expect(render('{{ s|replace({"a": "1", "b": "2"}) }}', { s: 'a+b' })).toBe('1+2');
  });
});

describe('format', () => {
  test('replaces %s placeholders', () => {
    expect(render('{{ "Hello %s, you are %s"|format(name, age) }}', { name: 'Alice', age: 30 })).toBe('Hello Alice, you are 30');
  });
});

describe('url_encode', () => {
  test('encodes a string', () => expect(render('{{ s|url_encode }}', { s: 'hello world' })).toBe('hello%20world'));
  test('encodes an object', () => expect(render('{{ o|url_encode }}', { o: { a: 1, b: 'x y' } })).toBe('a=1&b=x%20y'));
});

// ---------------------------------------------------------------------------
// JSON
// ---------------------------------------------------------------------------
describe('json_encode', () => {
  test('encodes object', () => expect(render('{{ o|json_encode|raw }}', { o: { a: 1 } })).toBe('{"a":1}'));
  test('encodes array', () => expect(render('{{ a|json_encode|raw }}', { a: [1, 2] })).toBe('[1,2]'));
  test('encodes with indent', () => {
    const out = render('{{ o|json_encode(2)|raw }}', { o: { x: 1 } });
    expect(out).toContain('\n');
  });
});

// ---------------------------------------------------------------------------
// Date
// ---------------------------------------------------------------------------
describe('date filter', () => {
  test('formats Y-m-d', () => {
    expect(render('{{ d|date("Y-m-d") }}', { d: '2024-06-15' })).toBe('2024-06-15');
  });
  test('formats d/m/Y', () => {
    expect(render('{{ d|date("d/m/Y") }}', { d: '2024-06-15' })).toBe('15/06/2024');
  });
  test('formats time H:i:s', () => {
    // Use a fixed timestamp to avoid timezone issues
    const d = new Date(2024, 5, 15, 9, 5, 3); // local time
    expect(render('{{ d|date("H:i:s") }}', { d })).toBe('09:05:03');
  });
  test('handles unix timestamp', () => {
    // 2024-01-01 00:00:00 UTC = 1704067200
    // We just check it doesn't throw and returns a string
    const out = render('{{ ts|date("Y") }}', { ts: 1704067200 });
    expect(out).toMatch(/^\d{4}$/);
  });
  test('short month name', () => {
    expect(render('{{ d|date("M Y") }}', { d: '2024-06-15' })).toBe('Jun 2024');
  });
  test('escapes literal characters with backslash', () => {
    // In Twig: date("Y\m\d") — single backslash escapes m and d as literals.
    // In a JS string passed to render(), one backslash = "\\".
    expect(render('{{ d|date("Y\\m\\d") }}', { d: '2024-06-15' })).toBe('2024md');
  });
  test('null returns empty string (not current year)', () => {
    expect(render('{{ d|date("Y") }}', { d: null })).toBe('');
  });
  test('undefined variable returns empty string', () => {
    // Pass the variable explicitly as undefined (scope key present, value undefined)
    expect(render('{{ d|date("Y") }}', { d: undefined })).toBe('');
  });
});
