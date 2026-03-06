export function twigRender(engine, registry, blockName, vars = {}, runtime = {}) {
  if (registry && typeof registry.has === 'function' && !registry.has(blockName)) {
    throw new Error(`Block \`${blockName}\` is not present in the registry.`);
  }

  if (registry && typeof registry === 'object' && typeof registry.has !== 'function') {
    if (!registry[blockName]) {
      throw new Error(`Block \`${blockName}\` is not present in the registry.`);
    }
  }

  return engine.renderBlock(blockName, vars, runtime);
}
