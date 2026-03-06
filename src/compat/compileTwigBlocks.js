const BLOCK_REGEX = /<twig:block\s+name="([^"]+)"\s*>([\s\S]*?)<\/twig:block>/g;

function resolveSource(sourceOrElementId) {
  if (typeof sourceOrElementId !== 'string') {
    throw new Error('compileTwigBlocks expects a string template source or DOM id.');
  }

  if (sourceOrElementId.includes('<twig:block')) {
    return sourceOrElementId;
  }

  if (typeof document !== 'undefined') {
    const element = document.getElementById(sourceOrElementId);
    if (element) {
      return element.innerHTML;
    }
  }

  throw new Error(`No <twig:block> source found for \`${sourceOrElementId}\`.`);
}

export function compileTwigBlocks(engine, registry, sourceOrElementId) {
  const source = resolveSource(sourceOrElementId);
  let count = 0;

  for (const match of source.matchAll(BLOCK_REGEX)) {
    const [, blockName, blockBody] = match;
    try {
      engine.compileBlock(blockName, blockBody);
    } catch (error) {
      if (typeof console !== 'undefined' && typeof console.error === 'function') {
        console.error('[twig-browser] Failed to compile block:', blockName);
        console.error('[twig-browser] Original Twig block source:\n', blockBody);
        console.error('[twig-browser] Compile error:', error);
      }
      throw error;
    }
    if (registry && typeof registry.set === 'function') {
      registry.set(blockName, true);
    } else if (registry && typeof registry === 'object') {
      registry[blockName] = true;
    }
    count += 1;
  }

  if (count === 0) {
    throw new Error('No <twig:block name="..."> tags were found in source.');
  }

  return count;
}
