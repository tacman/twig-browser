import {
  findTopLevelToken,
  replaceTwigLogicOperators,
  splitTopLevel,
  tokenizeExpression
} from './expressionTokenizer.js';

const TOKEN_REGEX = /({{[\s\S]*?}}|{%[\s\S]*?%})/g;

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
  const rest = expression.slice(isToken.end).trim();
  const REST_RE = /^(not\s+)?(\w+)(\(.*\))?\s*$/s;
  const m = rest.match(REST_RE);
  if (!m) return null;

  const [, negated, testName, argsPart] = m;
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

function transformExpression(rawExpression) {
  const expression = rawExpression.trim();
  if (!expression) {
    return 'undefined';
  }

  // `is [not]` test — check before elvis/filter splitting since `is` contains no top-level operators
  const isTest = transformIsTest(expression);
  if (isTest !== null) return isTest;

  const elvisIndex = findTopLevelToken(expression, '?:');
  if (elvisIndex !== -1) {
    const left = expression.slice(0, elvisIndex).trim();
    const right = expression.slice(elvisIndex + 2).trim();
    return `__helpers.elvis((${transformExpression(left)}), (${transformExpression(right)}))`;
  }

  const filterParts = splitTopLevel(expression, '|');
  const base = replaceTwigLogicOperators(filterParts[0]);
  if (filterParts.length === 1) {
    return base;
  }

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
