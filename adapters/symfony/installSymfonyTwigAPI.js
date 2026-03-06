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
