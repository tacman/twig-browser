import { describe, expect, test } from 'vitest';
import { createEngine } from '../src/engine/createEngine.js';

function render(template, vars = {}) {
  const engine = createEngine();
  engine.compileBlock('t', template);
  return engine.renderBlock('t', vars);
}

describe('stimulus_controller()', () => {
  test('plain name', () => {
    expect(render('{{ stimulus_controller("my-controller")|raw }}'))
      .toBe('data-controller="my-controller"');
  });

  test('scoped package name normalizes @ and /', () => {
    expect(render('{{ stimulus_controller("@survos/meili-bundle/json")|raw }}'))
      .toBe('data-controller="survos--meili-bundle--json"');
  });

  test('underscores in controller name become dashes', () => {
    expect(render('{{ stimulus_controller("my_controller")|raw }}'))
      .toBe('data-controller="my-controller"');
  });

  test('values are emitted with correct data attribute', () => {
    const out = render('{{ stimulus_controller("my-ctrl", {serverUrl: "http://x"})|raw }}');
    expect(out).toContain('data-controller="my-ctrl"');
    expect(out).toContain('data-my-ctrl-server-url-value="http://x"');
  });
});

describe('stimulus_action()', () => {
  test('plain controller and action', () => {
    expect(render('{{ stimulus_action("my-ctrl", "doThing")|raw }}'))
      .toBe('data-action="my-ctrl#doThing"');
  });

  test('scoped package name normalizes correctly', () => {
    expect(render('{{ stimulus_action("@survos/meili-bundle/json", "modal")|raw }}'))
      .toBe('data-action="survos--meili-bundle--json#modal"');
  });

  test('with explicit event name', () => {
    expect(render('{{ stimulus_action("my-ctrl", "save", "click")|raw }}'))
      .toBe('data-action="click->my-ctrl#save"');
  });
});

describe('stimulus_target()', () => {
  test('plain controller and target', () => {
    expect(render('{{ stimulus_target("my-ctrl", "content")|raw }}'))
      .toContain('data-my-ctrl-target="content"');
  });

  test('scoped package name normalizes correctly', () => {
    const out = render('{{ stimulus_target("@survos/meili-bundle/json", "dialog")|raw }}');
    expect(out).toContain('data-survos--meili-bundle--json-target="dialog"');
  });
});
