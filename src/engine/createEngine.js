import { compileTemplate } from './compile.js';
import { createStimulusHelpers } from '../extensions/stimulus.js';
import { createCoreFilters } from '../extensions/filters.js';
import { createCoreTests } from '../extensions/tests.js';
import { createCoreFunctions } from '../extensions/functions.js';

function missingIntegration(name, details = '') {
  const suffix = details ? ` ${details}` : '';
  throw new Error(`Twig function \`${name}\` is not configured.${suffix}`);
}

function createElvisEvaluator() {
  return (left, right) => {
    if (left === false || left === null || left === undefined || left === '' || left === 0 || left === '0') {
      return right;
    }
    if (Array.isArray(left) && left.length === 0) {
      return right;
    }
    return left;
  };
}

export function createEngine(options = {}) {
  const blocks = new Map();
  const blockSources = new Map();
  const functions = new Map();
  const filters = new Map();
  const tests = new Map();

  // --- Stimulus helpers ---
  const stimulus = createStimulusHelpers();
  functions.set('stimulus_controller', stimulus.stimulus_controller);
  functions.set('stimulus_target', stimulus.stimulus_target);
  functions.set('stimulus_action', stimulus.stimulus_action);

  // --- Core filters ---
  const coreFilters = createCoreFilters();
  Object.entries(coreFilters).forEach(([name, fn]) => filters.set(name, fn.bind(coreFilters)));

  // --- Core tests ---
  const coreTests = createCoreTests();
  Object.entries(coreTests).forEach(([name, fn]) => tests.set(name, fn));

  // --- Core functions ---
  const coreFunctions = createCoreFunctions();
  Object.entries(coreFunctions).forEach(([name, fn]) => functions.set(name, fn));

  // --- Symfony integration stubs (overridden by installSymfonyTwigAPI) ---
  functions.set('path', (route, params = {}) => {
    if (typeof options.pathGenerator === 'function') {
      return options.pathGenerator(route, params);
    }
    missingIntegration('path', 'Install the Symfony adapter with a routing generator.');
  });

  functions.set('ux_icon', (name, attrs = {}) => {
    if (typeof options.uxIconResolver === 'function') {
      return options.uxIconResolver(name, attrs);
    }
    // Default: read from window.__survosIconsMap populated by bin/console ux:icons:lock
    if (typeof window !== 'undefined' && window.__survosIconsMap) {
      if (!name) return '';
      const svg = window.__survosIconsMap[name];
      if (!svg) {
        console.warn(`[twig-browser] ux_icon("${name}") not found in __survosIconsMap — run: bin/console ux:icons:lock`);
        return `<span class="ux-icon-fallback" title="${name}" style="font-size:.75em;opacity:.6">${name}</span>`;
      }
      return (attrs?.class)
        ? `<span class="${String(attrs.class)}">${svg}</span>`
        : svg;
    }
    missingIntegration('ux_icon', 'No uxIconResolver provided and window.__survosIconsMap is not set. Run: bin/console ux:icons:lock');
  });

  const engine = {
    registerFunction(name, fn) {
      functions.set(name, fn);
    },

    registerFilter(name, fn) {
      filters.set(name, fn);
    },

    registerTest(name, fn) {
      tests.set(name, fn);
    },

    compileBlock(name, template) {
      const renderer = compileTemplate(template);
      blocks.set(name, renderer);
      blockSources.set(name, template);
      return renderer;
    },

    renderBlock(name, vars = {}, runtime = {}) {
      const renderer = blocks.get(name);
      if (!renderer) {
        throw new Error(`Twig block \`${name}\` was not compiled.`);
      }

      const callFunction = (fnName, args) => {
        if (fnName === 'render') {
          const [blockName, renderVars = {}] = args;
          return engine.renderBlock(blockName, { ...vars, ...renderVars }, runtime);
        }

        const fn = functions.get(fnName);
        if (!fn) {
          throw new Error(`Twig function \`${fnName}\` is not registered.`);
        }
        return fn(...args);
      };

      const callFilter = (filterName, value, args) => {
        const filter = filters.get(filterName);
        if (!filter) {
          throw new Error(`Twig filter \`${filterName}\` is not registered.`);
        }
        return filter(value, ...args);
      };

      const callTest = (testName, value, ...args) => {
        const test = tests.get(testName);
        if (!test) {
          throw new Error(`Twig test \`${testName}\` is not registered.`);
        }
        return test(value, ...args);
      };

      const helpers = {
        callFunction,
        callFilter,
        callTest,
        elvis: createElvisEvaluator(),
      };

      const rawScope = {
        ...vars,
        ...runtime,
        render: (blockName, renderVars = {}) => callFunction('render', [blockName, renderVars])
      };

      for (const [fnName] of functions) {
        rawScope[fnName] = (...args) => callFunction(fnName, args);
      }

      const scope = rawScope;

      try {
        return renderer(scope, helpers);
      } catch (error) {
        if (typeof console !== 'undefined' && typeof console.error === 'function') {
          console.error('[twig-browser] Failed to render block:', name);
          console.error('[twig-browser] Original Twig block source:\n', blockSources.get(name));
          console.error('[twig-browser] Render vars:', vars);
          console.error('[twig-browser] Render error:', error);
        }
        throw error;
      }
    },

    hasBlock(name) {
      return blocks.has(name);
    }
  };

  return engine;
}
