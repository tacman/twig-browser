function htmlEscape(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/"/g, '&quot;');
}

function toKebabCase(input) {
  return String(input)
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .replace(/[\s_]+/g, '-')
    .toLowerCase();
}

/**
 * Normalize a Stimulus controller name to match Symfony's PHP convention:
 *   @survos/meili-bundle/json  →  survos--meili-bundle--json
 *
 * Rules (mirrors StimulusAttributes::normalizeControllerName):
 *   1. Replace every '/' with '--'
 *   2. Replace every '_' with '-'
 *   3. Strip a leading '@'
 *
 * Plain names (no '@' or '/') pass through unchanged after step 2.
 */
function normalizeControllerName(input) {
  return String(input)
    .replace(/\//g, '--')
    .replace(/_/g, '-')
    .replace(/^@/, '');
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
      const controller = normalizeControllerName(controllerName);
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
      const controller = normalizeControllerName(controllerName);
      const target = toKebabCase(targetName ?? controllerName);
      return buildAttributes({
        'data-target': `${controller}.${target}`,
        [`data-${controller}-target`]: target
      });
    },

    stimulus_action(controllerName, actionName, eventName = null, options = {}) {
      const controller = normalizeControllerName(controllerName);
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
