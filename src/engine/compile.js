const TOKEN_REGEX = /({{[\s\S]*?}}|{%[\s\S]*?%})/g;

function escapeText(text) {
  return text.replace(/\\/g, '\\\\').replace(/`/g, '\\`').replace(/\$\{/g, '\\${');
}

function splitTopLevel(input, separator) {
  const parts = [];
  let current = '';
  let depth = 0;
  let quote = null;

  for (let i = 0; i < input.length; i += 1) {
    const ch = input[i];
    const next = input[i + 1];

    if (quote) {
      current += ch;
      if (ch === quote && input[i - 1] !== '\\') {
        quote = null;
      }
      continue;
    }

    if (ch === '"' || ch === "'") {
      quote = ch;
      current += ch;
      continue;
    }

    if (ch === '(' || ch === '[' || ch === '{') {
      depth += 1;
      current += ch;
      continue;
    }

    if (ch === ')' || ch === ']' || ch === '}') {
      depth -= 1;
      current += ch;
      continue;
    }

    if (depth === 0 && input.slice(i, i + separator.length) === separator) {
      parts.push(current.trim());
      current = '';
      i += separator.length - 1;
      continue;
    }

    if (depth === 0 && separator === '|') {
      if ((ch === '|' && next === '|') || (ch === '?' && next === '|')) {
        current += ch;
        continue;
      }
    }

    current += ch;
  }

  parts.push(current.trim());
  return parts;
}

function replaceTwigLogicOperators(expr) {
  return expr
    .replace(/\band\b/g, '&&')
    .replace(/\bor\b/g, '||')
    .replace(/\bnot\b/g, '!')
    .replace(/\bnull\b/g, 'null');
}

function findTopLevelElvis(expr) {
  let depth = 0;
  let quote = null;

  for (let i = 0; i < expr.length - 1; i += 1) {
    const ch = expr[i];
    const next = expr[i + 1];

    if (quote) {
      if (ch === quote && expr[i - 1] !== '\\') {
        quote = null;
      }
      continue;
    }

    if (ch === '"' || ch === "'") {
      quote = ch;
      continue;
    }

    if (ch === '(' || ch === '[' || ch === '{') {
      depth += 1;
      continue;
    }

    if (ch === ')' || ch === ']' || ch === '}') {
      depth -= 1;
      continue;
    }

    if (depth === 0 && ch === '?' && next === ':') {
      return i;
    }
  }

  return -1;
}

function parseFilterCall(filterSpec) {
  const trimmed = filterSpec.trim();
  const nameMatch = trimmed.match(/^([a-zA-Z_][a-zA-Z0-9_]*)/);
  if (!nameMatch) {
    throw new Error(`Invalid Twig filter expression: ${filterSpec}`);
  }

  const name = nameMatch[1];
  let cursor = name.length;
  let args = [];

  if (trimmed[cursor] === '(') {
    let depth = 0;
    let quote = null;
    let closeIndex = -1;

    for (let i = cursor; i < trimmed.length; i += 1) {
      const ch = trimmed[i];
      if (quote) {
        if (ch === quote && trimmed[i - 1] !== '\\') {
          quote = null;
        }
        continue;
      }
      if (ch === '"' || ch === "'") {
        quote = ch;
        continue;
      }
      if (ch === '(') {
        depth += 1;
        continue;
      }
      if (ch === ')') {
        depth -= 1;
        if (depth === 0) {
          closeIndex = i;
          break;
        }
      }
    }

    if (closeIndex === -1) {
      throw new Error(`Unclosed filter args in expression: ${filterSpec}`);
    }

    const argsRaw = trimmed.slice(cursor + 1, closeIndex).trim();
    args = argsRaw ? splitTopLevel(argsRaw, ',').map(transformExpression) : [];
    cursor = closeIndex + 1;
  }

  const tail = trimmed.slice(cursor).trim();
  return { name, args, tail };
}

function transformExpression(rawExpression) {
  const expression = rawExpression.trim();
  const elvisIndex = findTopLevelElvis(expression);

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
      output = `(${output} ${replaceTwigLogicOperators(tail)})`;
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

export function compileTemplate(template) {
  const compiledExpr = [];
  let code = 'let __out = "";\n';
  let cursor = 0;
  let ifDepth = 0;

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
    } else {
      const tag = token.slice(2, -2).trim();

      if (tag.startsWith('if ')) {
        const expression = tag.slice(3).trim();
        const exprIndex = compiledExpr.push(compileExpression(expression)) - 1;
        code += `if (__expr[${exprIndex}](__scope, __helpers)) {\n`;
        ifDepth += 1;
      } else if (tag.startsWith('elseif ')) {
        const expression = tag.slice(7).trim();
        const exprIndex = compiledExpr.push(compileExpression(expression)) - 1;
        code += `} else if (__expr[${exprIndex}](__scope, __helpers)) {\n`;
      } else if (tag === 'else') {
        code += '} else {\n';
      } else if (tag === 'endif') {
        code += '}\n';
        ifDepth -= 1;
      } else {
        throw new Error(`Unsupported Twig tag: ${tag}`);
      }
    }

    cursor = index + token.length;
  }

  if (cursor < template.length) {
    code += `__out += \`${escapeText(template.slice(cursor))}\`;\n`;
  }

  if (ifDepth !== 0) {
    throw new Error('Unbalanced Twig if/endif tags.');
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
