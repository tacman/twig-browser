/**
 * Wire Symfony-specific twig functions into a twig-browser engine.
 *
 * path() is no longer wired here — import it directly from the generated module:
 *   import { path } from '@survos/js-twig/generated/fos_routes.js';
 *   engine.registerFunction('path', path);
 *
 * @param {object} engine        - twig-browser engine
 * @param {object} [options]
 * @param {Function} [options.uxIconResolver]  - function(name, attrs) → html string
 * @param {Function} [options.iconResolver]    - alias for uxIconResolver
 * @param {Function} [options.pathGenerator]   - legacy: explicit path() override
 * @returns {object} engine
 */
export function installSymfonyTwigAPI(engine, options = {}) {
  const { uxIconResolver, iconResolver, pathGenerator } = options;

  // Legacy: if a pathGenerator is explicitly passed, still honour it.
  if (typeof pathGenerator === 'function') {
    engine.registerFunction('path', pathGenerator);
  }

  const resolveIcon =
    typeof uxIconResolver === 'function'
      ? uxIconResolver
      : typeof iconResolver === 'function'
        ? iconResolver
        : null;

  if (resolveIcon) {
    engine.registerFunction('ux_icon', resolveIcon);
  }

  return engine;
}
