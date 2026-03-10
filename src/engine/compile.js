import {
  findTopLevelToken,
  replaceTwigLogicOperators,
  splitTopLevel,
  tokenizeExpression
} from './expressionTokenizer.js';

const TOKEN_REGEX = /({#[\s\S]*?#}|{{[\s\S]*?}}|{%[\s\S]*?%})/g;

function escapeText(text) {
  return text.replace(/\\/g, '\\\\').replace(/`/g, '\\`').replace(/\$\{/g, '\\${');
}

function parseFilterCall(filterSpec) {
  const trimmed = filterSpec.trim();
  const tokens = tokenizeExpression(trimmed);
  if (tokens.length === 0 || tokens[0].type !== 'identifier') {
    throw new Error(`Invalid Twig filter expression: ${filterSpec}`);
  }

  const name = tokens[0].value;
  let cursor = tokens[0].end;
  let args = [];

  if (tokens[1]?.value === '(') {
    let depth = 0;
    let closeToken = null;
    for (let i = 1; i < tokens.length; i += 1) {
      const token = tokens[i];
      if (token.value === '(') depth += 1;
      if (token.value === ')') {
        depth -= 1;
        if (depth === 0) {
          closeToken = token;
          break;
        }
      }
    }

    if (!closeToken) {
      throw new Error(`Unclosed filter args in expression: ${filterSpec}`);
    }

    const argsRaw = trimmed.slice(tokens[1].end, closeToken.start).trim();
    args = argsRaw ? splitTopLevel(argsRaw, ',').map(transformExpression) : [];
    cursor = closeToken.end;
  }

  return {
    name,
    args,
    tail: trimmed.slice(cursor).trim()
  };
}

/**
 * Handle `x is [not] testName(args...)` expressions.
 * Returns generated JS or null if no `is` pattern is found.
 *
 * Supports:
 *   x is defined
 *   x is not defined
 *   x is empty
 *   x is not empty
 *   x is null
 *   x is odd
 *   x is even
 *   x is iterable
 *   x is divisibleby(3)
 *   x is sameas(y)
 */
function transformIsTest(expression) {
  // Find a top-level `is` identifier token using the tokenizer so that `is`
  // inside object literals / arrays / parentheses is never matched.
  const tokens = tokenizeExpression(expression);
  let depth = 0;
  let isTokenIndex = -1;
  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i];
    if (t.value === '(' || t.value === '[' || t.value === '{') { depth++; continue; }
    if (t.value === ')' || t.value === ']' || t.value === '}') { depth--; continue; }
    if (depth === 0 && t.type === 'identifier' && t.value === 'is') {
      isTokenIndex = i;
      break;
    }
  }
  if (isTokenIndex === -1) return null;

  const isToken = tokens[isTokenIndex];
  const subject = expression.slice(0, isToken.start).trim();
  if (!subject) return null;

  // What follows `is`: optional `not`, then testName, optional `(args)`
  // Parse using the tokenizer so greedy `.*` can't swallow `and`/`or` after args.
  const restTokens = tokenizeExpression(expression.slice(isToken.end));
  if (restTokens.length === 0) return null;

  let rtIdx = 0;
  let negated = '';
  if (restTokens[rtIdx]?.type === 'identifier' && restTokens[rtIdx].value === 'not') {
    negated = 'not ';
    rtIdx++;
  }
  if (rtIdx >= restTokens.length || restTokens[rtIdx].type !== 'identifier') return null;
  let testName = restTokens[rtIdx].value;
  rtIdx++;

  // Handle two-word test names
  if (testName === 'same' && restTokens[rtIdx]?.value === 'as') {
    testName = 'sameas'; rtIdx++;
  } else if (testName === 'divisible' && restTokens[rtIdx]?.value === 'by') {
    testName = 'divisibleby'; rtIdx++;
  } else if (testName === 'starts' && restTokens[rtIdx]?.value === 'with') {
    testName = 'startswith'; rtIdx++;
  } else if (testName === 'ends' && restTokens[rtIdx]?.value === 'with') {
    testName = 'endswith'; rtIdx++;
  }

  // Optional args — two forms:
  //   (a) parenthesised:  `divisibleby(3)`, `sameas(x)`
  //   (b) bare expression: `starts with '_'`, `ends with suffix`, `matches '/re/'`
  let argsPart = null;
  if (restTokens[rtIdx]?.value === '(') {
    // form (a) — find matching close paren
    let d = 0;
    let closeRt = -1;
    for (let j = rtIdx; j < restTokens.length; j++) {
      if (restTokens[j].value === '(') d++;
      else if (restTokens[j].value === ')') { d--; if (d === 0) { closeRt = j; break; } }
    }
    if (closeRt === -1) return null;
    const openToken = restTokens[rtIdx];
    const closeToken = restTokens[closeRt];
    argsPart = expression.slice(isToken.end + openToken.start, isToken.end + closeToken.end);
    rtIdx = closeRt + 1;
  } else if (rtIdx < restTokens.length) {
    // form (b) — bare argument expression up to (but not including) any top-level
    // `and` / `or` identifier token, which belongs to an outer boolean expression.
    let endRt = rtIdx;
    let d = 0;
    for (let j = rtIdx; j < restTokens.length; j++) {
      const tok = restTokens[j];
      if (tok.value === '(' || tok.value === '[' || tok.value === '{') { d++; continue; }
      if (tok.value === ')' || tok.value === ']' || tok.value === '}') { d--; continue; }
      if (d === 0 && tok.type === 'identifier' && (tok.value === 'and' || tok.value === 'or')) break;
      endRt = j;
    }
    const firstTok = restTokens[rtIdx];
    const lastTok  = restTokens[endRt];
    const bareArg  = expression.slice(isToken.end + firstTok.start, isToken.end + lastTok.end);
    argsPart = `(${bareArg})`;
    rtIdx = endRt + 1;
  }

  // After consuming args there must be nothing left.
  if (rtIdx < restTokens.length) return null;
  const subjectTrimmed = subject.trim();

  // Tests that need safe scope access (must not throw ReferenceError for absent vars).
  // We read from __scope directly rather than evaluating through `with`.
  const SAFE_SCOPE_TESTS = new Set(['defined', 'null', 'none', 'empty']);
  if (SAFE_SCOPE_TESTS.has(testName)) {
    // Build a safe reader for simple dotted paths: "x", "x.y", "x.y.z"
    const parts = subjectTrimmed.split('.').map(p => p.trim());
    let safeRead;
    if (parts.length === 1) {
      safeRead = `(${JSON.stringify(parts[0])} in __scope ? __scope[${JSON.stringify(parts[0])}] : undefined)`;
    } else {
      // chain: read each level safely
      let acc = `(${JSON.stringify(parts[0])} in __scope ? __scope[${JSON.stringify(parts[0])}] : undefined)`;
      for (let i = 1; i < parts.length; i++) {
        acc = `(${acc} != null ? ${acc}[${JSON.stringify(parts[i])}] : undefined)`;
      }
      safeRead = acc;
    }

    if (testName === 'defined') {
      const val = safeRead;
      const check = `(${val} !== undefined && ${val} !== null)`;
      return negated ? `!(${check})` : check;
    }

    // null / none / empty — use callTest with safe read
    const call = `__helpers.callTest(${JSON.stringify(testName)}, (${safeRead}))`;
    return negated ? `!(${call})` : call;
  }

  const subjectExpr = transformExpression(subjectTrimmed);

  let argsExpr = '';
  if (argsPart) {
    // strip surrounding parens
    const inner = argsPart.slice(1, -1).trim();
    if (inner) {
      argsExpr = ', ' + splitTopLevel(inner, ',').map(a => transformExpression(a.trim())).join(', ');
    }
  }

  const call = `__helpers.callTest(${JSON.stringify(testName)}, (${subjectExpr})${argsExpr})`;
  return negated ? `!(${call})` : call;
}

/**
 * Transform a Twig object literal `{ key: expr, ... }` by recursively
 * transforming each value expression. Keys are always plain identifiers or
 * string literals and are passed through as-is.
 */
function transformObjectLiteral(expression) {
  // Strip outer braces
  const inner = expression.slice(1, expression.length - 1).trim();
  if (!inner) return '{}';

  // Split on top-level commas to get key:value pairs
  const pairs = splitTopLevel(inner, ',');
  const transformed = pairs.map(pair => {
    pair = pair.trim();
    if (!pair) return '';
    // Find the first top-level colon (key separator)
    const colonIdx = findTopLevelToken(pair, ':');
    if (colonIdx === -1) {
      // Shorthand or computed — just transform the whole thing
      return transformExpression(pair);
    }
    const key = pair.slice(0, colonIdx).trim();
    const value = pair.slice(colonIdx + 1).trim();
    return `${key}: ${transformExpression(value)}`;
  }).filter(Boolean);

  return `{ ${transformed.join(', ')} }`;
}

/**
 * Transform a Twig array literal `[ expr, ... ]` by recursively
 * transforming each element expression.
 */
function transformArrayLiteral(expression) {
  const inner = expression.slice(1, expression.length - 1).trim();
  if (!inner) return '[]';
  const elements = splitTopLevel(inner, ',').map(e => transformExpression(e.trim()));
  return `[${elements.join(', ')}]`;
}

function transformExpression(rawExpression) {
  const expression = rawExpression.trim();
  if (!expression) {
    return 'undefined';
  }

  // Object literal — recursively transform values so filters/is-tests inside work.
  // Only dispatch when the closing `}` is the very last character.
  if (expression[0] === '{') {
    const tokens = tokenizeExpression(expression);
    let depth = 0;
    let closeIdx = -1;
    for (let i = 0; i < tokens.length; i++) {
      if (tokens[i].value === '{') depth++;
      if (tokens[i].value === '}') { depth--; if (depth === 0) { closeIdx = tokens[i].end; break; } }
    }
    if (closeIdx === expression.length) {
      return transformObjectLiteral(expression);
    }
    // Otherwise fall through
  }

  // Array literal — recursively transform elements.
  // Only dispatch when the closing `]` is the very last character (i.e. the
  // entire expression is the array literal, not e.g. `["a","b"]|join(", ")`).
  if (expression[0] === '[') {
    const tokens = tokenizeExpression(expression);
    let depth = 0;
    let closeIdx = -1;
    for (let i = 0; i < tokens.length; i++) {
      if (tokens[i].value === '[') depth++;
      if (tokens[i].value === ']') { depth--; if (depth === 0) { closeIdx = tokens[i].end; break; } }
    }
    if (closeIdx === expression.length) {
      return transformArrayLiteral(expression);
    }
    // Otherwise fall through — the `[...]` is followed by filters/operators
  }

  // Parenthesised expression — strip parens and recursively transform inner content
  if (expression[0] === '(') {
    // Only strip if the closing ) matches the opening (
    const tokens = tokenizeExpression(expression);
    let depth = 0;
    let closeIdx = -1;
    for (let i = 0; i < tokens.length; i++) {
      if (tokens[i].value === '(') depth++;
      if (tokens[i].value === ')') { depth--; if (depth === 0) { closeIdx = tokens[i].end; break; } }
    }
    if (closeIdx === expression.length) {
      // The entire expression is wrapped in parens — strip and recurse
      const inner = expression.slice(1, expression.length - 1).trim();
      return `(${transformExpression(inner)})`;
    }
    // Otherwise fall through (partial parens, e.g. function call or ternary condition)
  }

  // Function call: identifier(args) — transform arguments recursively.
  // Only fires when the entire expression is `name(args)` where name is a
  // simple identifier (no operators). This ensures pipes/is-tests inside
  // arguments are handled. Must run before replaceTwigLogicOperators.
  {
    const tokens = tokenizeExpression(expression);
    // The expression is a function call if:
    //   - first token is an identifier
    //   - second token is `(`
    //   - last token is the matching `)`
    if (
      tokens.length >= 3 &&
      tokens[0].type === 'identifier' &&
      tokens[1]?.value === '(' &&
      tokens[tokens.length - 1]?.value === ')'
    ) {
      // Verify the closing ) actually matches the opening ( at tokens[1]
      let depth = 0;
      let closeIdx = -1;
      for (let i = 1; i < tokens.length; i++) {
        if (tokens[i].value === '(') depth++;
        else if (tokens[i].value === ')') {
          depth--;
          if (depth === 0) { closeIdx = i; break; }
        }
      }
      if (closeIdx === tokens.length - 1) {
        const callee = tokens[0].value;
        const argsRaw = expression.slice(tokens[1].end, tokens[closeIdx].start).trim();
        const argParts = argsRaw ? splitTopLevel(argsRaw, ',').map(a => transformExpression(a.trim())) : [];

        // `attribute(obj, key)` → direct property access obj[key]
        if (callee === 'attribute') {
          if (argParts.length >= 2) {
            return `(${argParts[0]})[${argParts[1]}]`;
          }
        }

        return `__helpers.callFunction(${JSON.stringify(callee)}, [${argParts.join(', ')}])`;
      }
    }
  }

  // `is [not]` test — check before boolean/filter splitting since `is` contains no top-level operators
  const isTest = transformIsTest(expression);
  if (isTest !== null) return isTest;

  // Top-level `and` / `or` / infix string tests — split and recurse.
  // Also handles infix forms of string tests:
  //   `x starts with y`  →  `x is starts with y`
  //   `x ends with y`    →  `x is ends with y`
  //   `x matches y`      →  `x is matches y`
  //   `x not starts with y` (with preceding `not` token already handled by caller)
  {
    const tokens = tokenizeExpression(expression);
    let depth = 0;
    for (let i = 0; i < tokens.length; i++) {
      const t = tokens[i];
      if (t.value === '(' || t.value === '[' || t.value === '{') { depth++; continue; }
      if (t.value === ')' || t.value === ']' || t.value === '}') { depth--; continue; }
      if (depth !== 0 || t.type !== 'identifier') continue;

      if (t.value === 'and' || t.value === 'or') {
        const op = t.value === 'and' ? '&&' : '||';
        const left = expression.slice(0, t.start).trim();
        const right = expression.slice(t.end).trim();
        return `(${transformExpression(left)}) ${op} (${transformExpression(right)})`;
      }

      // Infix string-test operators: rewrite as `subject is <test> arg` and recurse.
      // Handles optional `not` before the operator: `x not starts with y`
      if (t.value === 'starts' || t.value === 'ends' || t.value === 'matches') {
        // If this operator is already part of an explicit `is` test
        // (e.g. `value is starts with '_'`), do not rewrite again.
        const prev = tokens[i - 1];
        const prev2 = tokens[i - 2];
        if ((prev?.type === 'identifier' && prev.value === 'is') ||
            (prev?.type === 'identifier' && prev.value === 'not' && prev2?.type === 'identifier' && prev2.value === 'is')) {
          continue;
        }

        const subject = expression.slice(0, t.start).trim();
        if (!subject) continue; // `starts` as a variable name, not an operator
        const rest = expression.slice(t.end).trim();
        // rewrite as `subject is [not] <test> rest` and let transformIsTest handle it
        return transformExpression(`${subject} is ${t.value} ${rest}`);
      }

      // `x not starts with y` — `not` immediately before `starts`/`ends`/`matches`
      if (t.value === 'not') {
        const next = tokens[i + 1];
        if (depth === 0 && next?.type === 'identifier' &&
            (next.value === 'starts' || next.value === 'ends' || next.value === 'matches')) {
          const subject = expression.slice(0, t.start).trim();
          if (!subject) continue;
          const rest = expression.slice(next.end).trim();
          return transformExpression(`${subject} is not ${next.value} ${rest}`);
        }
      }
    }
  }

  // Null-coalescing `??` — maps directly to JS `??`. Check before `?` so the
  // tokenizer's two-char `??` token is matched first.
  const nullCoalesceIdx = findTopLevelToken(expression, '??');
  if (nullCoalesceIdx !== -1) {
    const left = expression.slice(0, nullCoalesceIdx).trim();
    const right = expression.slice(nullCoalesceIdx + 2).trim();
    return `(${transformExpression(left)}) ?? (${transformExpression(right)})`;
  }

  // Standard ternary: condition ? then : else
  // Must check before elvis (?:) since ? appears first
  const qmarkIdx = findTopLevelToken(expression, '?');
  if (qmarkIdx !== -1) {
    // Distinguish `?:` (elvis) from `? ... :` (ternary)
    const afterQ = expression.slice(qmarkIdx + 1).trimStart();
    if (!afterQ.startsWith(':')) {
      // It's a real ternary — find the matching top-level `:`
      const condExpr = expression.slice(0, qmarkIdx).trim();
      const rest = expression.slice(qmarkIdx + 1);
      // Find top-level `:` in the rest
      const colonIdx = findTopLevelToken(rest, ':');
      if (colonIdx !== -1) {
        const thenExpr = rest.slice(0, colonIdx).trim();
        const elseExpr = rest.slice(colonIdx + 1).trim();
        return `(${transformExpression(condExpr)}) ? (${transformExpression(thenExpr)}) : (${transformExpression(elseExpr)})`;
      }
      // No `:` — short ternary `a ? b` (Twig: returns b if a is truthy, else '')
      const thenExpr = rest.trim();
      return `(${transformExpression(condExpr)}) ? (${transformExpression(thenExpr)}) : ''`;
    }
  }

  const elvisIndex = findTopLevelToken(expression, '?:');
  if (elvisIndex !== -1) {
    const left = expression.slice(0, elvisIndex).trim();
    const right = expression.slice(elvisIndex + 2).trim();
    return `__helpers.elvis((${transformExpression(left)}), (${transformExpression(right)}))`;
  }

  // Twig `~` string concatenation operator → JS String() + String()
  const concatParts = splitTopLevel(expression, '~');
  if (concatParts.length > 1) {
    return concatParts.map(p => `String(${transformExpression(p.trim())} ?? '')`).join(' + ');
  }

  const filterParts = splitTopLevel(expression, '|');
  if (filterParts.length === 1) {
    // If the expression is a simple dotted path (e.g. `x`, `hit.name`, `_config.pk`),
    // emit an explicit safe chain read from __scope so that missing variables return
    // undefined (falsy) instead of throwing ReferenceError — matching PHP Twig behaviour.
    {
      const tokens = tokenizeExpression(expression);
      const isDottedPath = tokens.length > 0 && tokens.every((t, i) =>
        i % 2 === 0 ? t.type === 'identifier' : t.value === '.'
      );
      if (isDottedPath) {
        const parts = tokens.filter(t => t.type === 'identifier').map(t => t.value);
        // Reserve JS keywords / engine internals that should never be scope-read
        const JS_GLOBALS = new Set(['true', 'false', 'null', 'undefined', 'NaN', 'Infinity']);
        if (!JS_GLOBALS.has(parts[0])) {
          let acc = `__scope[${JSON.stringify(parts[0])}]`;
          for (let i = 1; i < parts.length; i++) {
            acc = `(${acc} != null ? ${acc}[${JSON.stringify(parts[i])}] : undefined)`;
          }
          return acc;
        }
      }
    }
    return replaceTwigLogicOperators(expression);
  }
  // Base may itself be a function call with pipe args (e.g. range(1, n|default(3)))
  // so recurse through transformExpression rather than replaceTwigLogicOperators.
  const base = transformExpression(filterParts[0]);

  let output = base;
  for (let i = 1; i < filterParts.length; i += 1) {
    const { name, args, tail } = parseFilterCall(filterParts[i]);
    output = `__helpers.callFilter(${JSON.stringify(name)}, (${output}), [${args.join(', ')}])`;
    if (tail) {
      output = `(${output}${replaceTwigLogicOperators(tail)})`;
    }
  }

  return output;
}

function compileExpression(rawExpression) {
  const expression = transformExpression(rawExpression);
  try {
    return new Function('__scope', '__helpers', `with (__scope) { return (${expression}); }`);
  } catch (error) {
    const details = [
      `Failed to compile Twig expression: ${rawExpression}`,
      `Generated JS expression: ${expression}`
    ].join('\n');
    throw new Error(details, { cause: error });
  }
}

function parseForTag(tag) {
  const expression = tag.slice(4).trim();
  const tokens = tokenizeExpression(expression);
  let depth = 0;
  let inToken = null;

  for (const token of tokens) {
    if (token.value === '(' || token.value === '[' || token.value === '{') depth += 1;
    if (token.value === ')' || token.value === ']' || token.value === '}') depth -= 1;
    if (depth === 0 && token.type === 'identifier' && token.value === 'in') {
      inToken = token;
      break;
    }
  }

  if (!inToken) {
    throw new Error(`Invalid Twig for tag: ${tag}`);
  }

  const left = expression.slice(0, inToken.start).trim();
  const right = expression.slice(inToken.end).trim();
  const vars = splitTopLevel(left, ',').map((name) => name.trim()).filter(Boolean);

  if (vars.length < 1 || vars.length > 2) {
    throw new Error(`Twig for tag supports one or two loop variables: ${tag}`);
  }
  vars.forEach((name) => {
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(name)) {
      throw new Error(`Invalid Twig loop variable name: ${name}`);
    }
  });

  if (!right) {
    throw new Error(`Twig for tag is missing iterable expression: ${tag}`);
  }

  return {
    keyVar: vars.length === 2 ? vars[0] : null,
    valueVar: vars.length === 2 ? vars[1] : vars[0],
    iterableExpression: right
  };
}

function parseSetTag(tag) {
  const expression = tag.slice(4).trim();
  const equalsIndex = findTopLevelToken(expression, '=');

  if (equalsIndex === -1) {
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(expression)) {
      throw new Error(`Invalid Twig set capture tag: ${tag}`);
    }
    return {
      mode: 'capture',
      variableName: expression
    };
  }

  const left = expression.slice(0, equalsIndex).trim();
  const right = expression.slice(equalsIndex + 1).trim();
  const variables = splitTopLevel(left, ',').map((name) => name.trim()).filter(Boolean);

  if (!right) {
    throw new Error(`Twig set tag is missing assignment expression: ${tag}`);
  }

  variables.forEach((name) => {
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(name)) {
      throw new Error(`Invalid Twig set variable name: ${name}`);
    }
  });

  return {
    mode: 'assign',
    variables,
    expressions: splitTopLevel(right, ',').map((part) => part.trim()).filter(Boolean)
  };
}

export function compileTemplate(template) {
  const compiledExpr = [];
  const controlStack = [];
  let code = 'let __out = "";\n';
  let cursor = 0;
  let forCounter = 0;
  let setCaptureCounter = 0;

  const tokens = [...template.matchAll(TOKEN_REGEX)];
  for (const match of tokens) {
    const token = match[0];
    const index = match.index;

    if (index > cursor) {
      code += `__out += \`${escapeText(template.slice(cursor, index))}\`;\n`;
    }

    // Twig comment — silently discard
    if (token.startsWith('{#')) {
      cursor = index + token.length;
      continue;
    }

    if (token.startsWith('{{')) {
      const expression = token.slice(2, -2).trim();
      const exprIndex = compiledExpr.push(compileExpression(expression)) - 1;
      code += `__out += String(__expr[${exprIndex}](__scope, __helpers) ?? "");\n`;
      cursor = index + token.length;
      continue;
    }

    const tag = token.slice(2, -2).trim();

    if (tag.startsWith('if ')) {
      const exprIndex = compiledExpr.push(compileExpression(tag.slice(3).trim())) - 1;
      code += `if (__expr[${exprIndex}](__scope, __helpers)) {\n`;
      controlStack.push({ type: 'if' });
    } else if (tag.startsWith('elseif ')) {
      const top = controlStack[controlStack.length - 1];
      if (!top || top.type !== 'if') {
        throw new Error('Twig elseif must follow an if block.');
      }
      const exprIndex = compiledExpr.push(compileExpression(tag.slice(7).trim())) - 1;
      code += `} else if (__expr[${exprIndex}](__scope, __helpers)) {\n`;
    } else if (tag === 'else') {
      const top = controlStack[controlStack.length - 1];
      if (!top || top.type !== 'if') {
        throw new Error('Twig else is only supported inside if blocks.');
      }
      code += '} else {\n';
    } else if (tag === 'endif') {
      const top = controlStack.pop();
      if (!top || top.type !== 'if') {
        throw new Error('Twig endif does not match an open if block.');
      }
      code += '}\n';
    } else if (tag.startsWith('for ')) {
      const parsed = parseForTag(tag);
      const forId = forCounter++;
      const exprIndex = compiledExpr.push(compileExpression(parsed.iterableExpression)) - 1;

      code += '{\n';
      code += `const __iterable${forId} = __expr[${exprIndex}](__scope, __helpers);\n`;
      code += `const __entries${forId} = Array.isArray(__iterable${forId}) ? __iterable${forId}.map((__v, __k) => [__k, __v]) : (__iterable${forId} && typeof __iterable${forId} === 'object') ? Object.entries(__iterable${forId}) : [];\n`;

      const loopVars = [parsed.valueVar];
      if (parsed.keyVar) {
        loopVars.unshift(parsed.keyVar);
      }

      loopVars.forEach((name) => {
        code += `const __had_${forId}_${name} = Object.prototype.hasOwnProperty.call(__scope, ${JSON.stringify(name)});\n`;
        code += `const __old_${forId}_${name} = __scope[${JSON.stringify(name)}];\n`;
      });

      code += `for (const [__k${forId}, __v${forId}] of __entries${forId}) {\n`;
      if (parsed.keyVar) {
        code += `__scope[${JSON.stringify(parsed.keyVar)}] = __k${forId};\n`;
      }
      code += `__scope[${JSON.stringify(parsed.valueVar)}] = __v${forId};\n`;

      controlStack.push({ type: 'for', id: forId, vars: loopVars });
    } else if (tag === 'endfor') {
      const top = controlStack.pop();
      if (!top || top.type !== 'for') {
        throw new Error('Twig endfor does not match an open for block.');
      }

      code += '}\n';
      top.vars.forEach((name) => {
        code += `if (__had_${top.id}_${name}) { __scope[${JSON.stringify(name)}] = __old_${top.id}_${name}; } else { delete __scope[${JSON.stringify(name)}]; }\n`;
      });
      code += '}\n';
    } else if (tag.startsWith('set ')) {
      const parsed = parseSetTag(tag);

      if (parsed.mode === 'capture') {
        const captureId = setCaptureCounter++;
        code += `const __set_prev_${captureId} = __out;\n`;
        code += '__out = "";\n';
        controlStack.push({ type: 'set_capture', id: captureId, variableName: parsed.variableName });
      } else {
        if (parsed.variables.length === 1) {
          const exprIndex = compiledExpr.push(compileExpression(parsed.expressions.join(', '))) - 1;
          code += `__scope[${JSON.stringify(parsed.variables[0])}] = __expr[${exprIndex}](__scope, __helpers);\n`;
        } else if (parsed.expressions.length === parsed.variables.length) {
          parsed.variables.forEach((name, idx) => {
            const exprIndex = compiledExpr.push(compileExpression(parsed.expressions[idx])) - 1;
            code += `__scope[${JSON.stringify(name)}] = __expr[${exprIndex}](__scope, __helpers);\n`;
          });
        } else {
          const exprIndex = compiledExpr.push(compileExpression(parsed.expressions.join(', '))) - 1;
          code += `const __set_value = __expr[${exprIndex}](__scope, __helpers);\n`;
          parsed.variables.forEach((name, idx) => {
            code += `__scope[${JSON.stringify(name)}] = Array.isArray(__set_value) ? __set_value[${idx}] : (__set_value?.[${JSON.stringify(name)}]);\n`;
          });
        }
      }
    } else if (tag === 'endset') {
      const top = controlStack.pop();
      if (!top || top.type !== 'set_capture') {
        throw new Error('Twig endset does not match an open set capture block.');
      }

      code += `const __set_captured_${top.id} = __out;\n`;
      code += `__out = __set_prev_${top.id};\n`;
      code += `__scope[${JSON.stringify(top.variableName)}] = __set_captured_${top.id};\n`;
    } else {
      throw new Error(`Unsupported Twig tag: ${tag}`);
    }

    cursor = index + token.length;
  }

  if (cursor < template.length) {
    code += `__out += \`${escapeText(template.slice(cursor))}\`;\n`;
  }

  if (controlStack.length > 0) {
    throw new Error(`Unbalanced Twig control tags: ${controlStack.map((item) => item.type).join(', ')}`);
  }

  code += 'return __out;';

  let renderer;
  try {
    renderer = new Function('__scope', '__helpers', '__expr', code);
  } catch (error) {
    const details = [
      'Failed to compile Twig block renderer.',
      'Generated renderer body:',
      code
    ].join('\n');
    throw new Error(details, { cause: error });
  }

  return (scope, helpers) => renderer(scope, helpers, compiledExpr);
}
