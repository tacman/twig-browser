/**
 * Fetch a Twig template from a URL, compile it into the engine, and return
 * the block name that was registered.
 *
 * Two template formats are supported:
 *
 *   1. A plain Twig template string — compiled as a single block under
 *      `blockName` (default: "hit").
 *
 *   2. A document containing one or more `<twig:block name="…">…</twig:block>`
 *      wrappers — all blocks are compiled; the first block name found is
 *      returned.
 *
 * @param {object}  engine     - twig-browser engine from createEngine()
 * @param {string}  url        - URL to fetch the template from
 * @param {string}  [blockName="hit"] - block name for plain templates
 * @returns {Promise<string>}  the primary block name that was compiled
 */
export async function loadTemplateFromUrl(engine, url, blockName = 'hit') {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`[twig-browser] Template fetch failed: HTTP ${res.status} ${res.statusText} (${url})`);
  }
  const source = await res.text();

  if (source.includes('<twig:block')) {
    const { compileTwigBlocks } = await import('./compileTwigBlocks.js');
    // Collect the first block name actually compiled so callers know what to render.
    let firstName = null;
    const trackingRegistry = {
      set: (name) => { if (!firstName) firstName = name; }
    };
    compileTwigBlocks(engine, trackingRegistry, source);
    return firstName ?? blockName;
  }

  engine.compileBlock(blockName, source);
  return blockName;
}
