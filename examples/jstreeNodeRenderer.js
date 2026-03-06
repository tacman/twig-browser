import { createEngine, compileTwigBlocks, twigRender } from '../src/index.js';
import { installSymfonyTwigAPI } from '../adapters/symfony/installSymfonyTwigAPI.js';

const BLOCKS_SOURCE = `
<twig:block name="detailContextHeader">
  {% if image %}
    <div class="ss-detail-context mb-3">
      <span class="badge">Image</span>
      <span>#{{ image.id }} · {{ image.title ?: 'Untitled' }}</span>
      <a href="{{ path('instance_show', {instanceId: container.id}) }}">View Container</a>
      <button {{ stimulus_action('station', 'focusContainerContext') }}>↩ Container</button>
    </div>
  {% else %}
    <div class="ss-detail-context mb-3">
      <span class="badge">Container</span>
      <span>{{ container.title ?: container.code ?: container.id }}</span>
      {% if container.images and container.images|length > 0 %}
        <button {{ stimulus_action('station', 'focusImageContext') }}>View Images</button>
      {% endif %}
    </div>
  {% endif %}
</twig:block>
`;

const registry = new Map();
const engine = createEngine();

installSymfonyTwigAPI(engine, {
  pathGenerator: (route, params) => `/${route}?instanceId=${params.instanceId}`,
  uxIconResolver: (name) => `<span class="icon">${name}</span>`
});

compileTwigBlocks(engine, registry, BLOCKS_SOURCE);

export function renderJsTreeNodeContext(nodeData) {
  return twigRender(engine, registry, 'detailContextHeader', nodeData);
}
