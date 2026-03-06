function htmlEscape(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function toKebabCase(input) {
  return String(input)
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .replace(/[\s_]+/g, '-')
    .toLowerCase();
}

function buildAttributes(attributes) {
  return Object.entries(attributes)
    .filter(([, value]) => value !== undefined && value !== null && value !== false)
    .map(([name, value]) => {
      if (value === true) {
        return name;
      }
      return `${name}="${htmlEscape(value)}"`;
    })
    .join(' ');
}

export function createStimulusHelpers() {
  return {
    stimulus_controller(controllerName, values = {}, classes = {}, outlets = {}) {
      const controller = toKebabCase(controllerName);
      const attrs = {
        'data-controller': controller
      };

      for (const [key, value] of Object.entries(values)) {
        attrs[`data-${controller}-${toKebabCase(key)}-value`] = value;
      }

      for (const [key, value] of Object.entries(classes)) {
        attrs[`data-${controller}-${toKebabCase(key)}-class`] = value;
      }

      for (const [key, value] of Object.entries(outlets)) {
        attrs[`data-${controller}-${toKebabCase(key)}-outlet`] = value;
      }

      return buildAttributes(attrs);
    },

    stimulus_target(controllerName, targetName) {
      const controller = toKebabCase(controllerName);
      const target = toKebabCase(targetName ?? controllerName);
      return buildAttributes({
        'data-target': `${controller}.${target}`,
        [`data-${controller}-target`]: target
      });
    },

    stimulus_action(controllerName, actionName, eventName = null, options = {}) {
      const controller = toKebabCase(controllerName);
      const action = `${controller}#${actionName}`;
      const descriptor = eventName ? `${eventName}->${action}` : action;
      const attrs = {
        'data-action': descriptor,
        ...options
      };
      return buildAttributes(attrs);
    }
  };
}
