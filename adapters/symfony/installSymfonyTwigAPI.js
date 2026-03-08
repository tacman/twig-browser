export function installSymfonyTwigAPI(engine, options = {}) {
  const {
    Routing,
    pathGenerator,
    uxIconResolver,
    iconResolver
  } = options;

  const resolvePath =
    typeof pathGenerator === 'function'
      ? pathGenerator
      : typeof Routing?.generate === 'function'
        ? (route, params = {}) => {
            const safeParams = { ...params };
            delete safeParams._keys;
            return Routing.generate(route, safeParams);
          }
        : null;

  if (resolvePath) {
    engine.registerFunction('path', resolvePath);
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

/**
 * Attempt to auto-detect and load the FOS JS Routing bundle, then install
 * the `path()` function into the engine.
 *
 * This tries, in order:
 *   1. Dynamic import of 'fos-routing' (the npm shim)
 *   2. Dynamic import of '/js/fos_js_routes.js' (Symfony-generated route data)
 *   3. Calls Routing.setData(data) and registers path() on the engine.
 *
 * If either import fails (bundle not installed, or route file not present),
 * it silently skips — path() will throw a clear error at render time if called.
 *
 * @param {object} engine - twig-browser engine
 * @param {object} [options] - same options as installSymfonyTwigAPI
 * @returns {Promise<boolean>} true if routing was successfully wired
 */
export async function autoInstallFosRouting(engine, options = {}) {
  try {
    const { default: Routing } = await import('fos-routing');
    const { default: routingData } = await import('/js/fos_js_routes.js');
    Routing.setData(routingData);
    installSymfonyTwigAPI(engine, { ...options, Routing });
    return true;
  } catch {
    // fos-routing not available — path() will throw at render time if called
    return false;
  }
}
