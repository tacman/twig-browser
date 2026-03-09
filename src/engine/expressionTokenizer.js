const IDENT_START = /[A-Za-z_]/;
const IDENT_BODY = /[A-Za-z0-9_]/;
const DIGIT = /[0-9]/;

const TWO_CHAR_OPS = new Set(['??', '?:', '==', '!=', '>=', '<=', '&&', '||']);
const ONE_CHAR_SYMBOLS = new Set(['(', ')', '[', ']', '{', '}', '.', ',', ':', '?', '|', '~', '+', '-', '*', '/', '%', '>', '<', '=', '!']);

export function tokenizeExpression(input) {
  const tokens = [];
  let i = 0;

  while (i < input.length) {
    const ch = input[i];

    if (/\s/.test(ch)) {
      i += 1;
      continue;
    }

    const start = i;
    const pair = input.slice(i, i + 2);
    if (TWO_CHAR_OPS.has(pair)) {
      tokens.push({ type: 'symbol', value: pair, start, end: i + 2 });
      i += 2;
      continue;
    }

    if (ch === '"' || ch === "'") {
      const quote = ch;
      i += 1;
      while (i < input.length) {
        const next = input[i];
        if (next === '\\') {
          i += 2;
          continue;
        }
        if (next === quote) {
          i += 1;
          break;
        }
        i += 1;
      }
      tokens.push({ type: 'string', value: input.slice(start, i), start, end: i });
      continue;
    }

    if (DIGIT.test(ch)) {
      i += 1;
      while (i < input.length && /[0-9.]/.test(input[i])) {
        i += 1;
      }
      tokens.push({ type: 'number', value: input.slice(start, i), start, end: i });
      continue;
    }

    if (IDENT_START.test(ch)) {
      i += 1;
      while (i < input.length && IDENT_BODY.test(input[i])) {
        i += 1;
      }
      tokens.push({ type: 'identifier', value: input.slice(start, i), start, end: i });
      continue;
    }

    if (ONE_CHAR_SYMBOLS.has(ch)) {
      tokens.push({ type: 'symbol', value: ch, start, end: i + 1 });
      i += 1;
      continue;
    }

    throw new Error(`Unsupported token '${ch}' in expression: ${input}`);
  }

  return tokens;
}

export function splitTopLevel(input, delimiter) {
  const tokens = tokenizeExpression(input);
  const parts = [];
  let depth = 0;
  let last = 0;

  for (const token of tokens) {
    if (token.value === '(' || token.value === '[' || token.value === '{') {
      depth += 1;
      continue;
    }
    if (token.value === ')' || token.value === ']' || token.value === '}') {
      depth -= 1;
      continue;
    }
    if (depth === 0 && token.value === delimiter) {
      parts.push(input.slice(last, token.start).trim());
      last = token.end;
    }
  }

  parts.push(input.slice(last).trim());
  return parts;
}

export function findTopLevelToken(input, value) {
  const tokens = tokenizeExpression(input);
  let depth = 0;

  for (const token of tokens) {
    if (token.value === '(' || token.value === '[' || token.value === '{') {
      depth += 1;
      continue;
    }
    if (token.value === ')' || token.value === ']' || token.value === '}') {
      depth -= 1;
      continue;
    }
    if (depth === 0 && token.value === value) {
      return token.start;
    }
  }

  return -1;
}

/**
 * Re-escape backslashes inside a quoted string token so they survive
 * being embedded as a JS string literal in generated code.
 *
 * e.g. Twig "Y\m\d"  →  token value: "Y\m\d"  →  JS needs: "Y\\m\\d"
 */
function escapeStringToken(raw) {
  if (raw.length < 2) return raw;
  const quote = raw[0];
  if (quote !== '"' && quote !== "'") return raw;
  const inner = raw.slice(1, -1);
  // Double any backslash that isn't already doubled
  const reescaped = inner.replace(/\\(.)/g, (_, ch) => `\\\\${ch}`);
  return `${quote}${reescaped}${quote}`;
}

export function replaceTwigLogicOperators(input) {
  const tokens = tokenizeExpression(input);
  const mapped = tokens.map((token) => {
    if (token.type === 'string') {
      return escapeStringToken(token.value);
    }

    if (token.type !== 'identifier') {
      return token.value;
    }

    if (token.value === 'and') return '&&';
    if (token.value === 'or') return '||';
    if (token.value === 'not') return '!';
    if (token.value === 'null') return 'null';
    return token.value;
  });

  let out = '';
  for (let i = 0; i < mapped.length; i += 1) {
    const current = mapped[i];
    const prev = mapped[i - 1];
    if (i > 0 && needsSpace(prev, current)) {
      out += ' ';
    }
    out += current;
  }
  return out;
}

function needsSpace(prev, current) {
  if (!prev || !current) return false;
  const prevWord = /[A-Za-z0-9_'"]$/.test(prev);
  const currentWord = /^[A-Za-z0-9_'"]/.test(current);
  return prevWord && currentWord;
}
