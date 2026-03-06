export const detailContextHeaderTemplate = `{% if image %}
    <div class="ss-detail-context mb-3">
        <span class="badge rounded-pill text-bg-primary">Image</span>
        <span title="#{{ image.id }} · {{ image.title ?: 'Untitled' }}">
            #{{ image.id }} · {{ image.title ?: 'Untitled' }}
        </span>
        <a class="btn btn-sm btn-outline-primary" href="{{ path('app_homepage', {containerId: container.id}) }}">
            View Container
        </a>
        <button class="btn btn-sm btn-outline-secondary" {{ stimulus_action('topic', 'search', 'input') }}>
            Focus Container
        </button>
    </div>
{% else %}
    <div class="ss-detail-context mb-3">
        <span class="badge rounded-pill text-bg-secondary">Container</span>
        <span title="{{ container.title ?: container.code ?: container.id }}">
            {{ container.title ?: container.code ?: container.id }}
        </span>
        {% if container.images and container.images|length > 0 %}
            <button class="btn btn-sm btn-outline-secondary" {{ stimulus_action('topic', 'search') }}>
                View Images
            </button>
        {% endif %}
    </div>
{% endif %}`;

export const detailContextHeaderCases = [
  {
    name: 'container with images',
    vars: {
      image: null,
      container: {
        id: 77,
        title: 'Demo User',
        code: 'TREE-77',
        images: [1, 2]
      }
    },
    expected: `<div class="ss-detail-context mb-3"><span class="badge rounded-pill text-bg-secondary">Container</span><span title="Demo User">Demo User</span><button class="btn btn-sm btn-outline-secondary" data-action="topic#search">View Images</button></div>`
  },
  {
    name: 'image context fallback title',
    vars: {
      image: {
        id: 501,
        title: ''
      },
      container: {
        id: 77,
        title: 'Demo User',
        code: 'TREE-77',
        images: [1, 2]
      }
    },
    expected: `<div class="ss-detail-context mb-3"><span class="badge rounded-pill text-bg-primary">Image</span><span title="#501 · Untitled">#501 · Untitled</span><a class="btn btn-sm btn-outline-primary" href="/?containerId=77">View Container</a><button class="btn btn-sm btn-outline-secondary" data-action="input->topic#search">Focus Container</button></div>`
  },
  {
    name: 'container fallback to code without images',
    vars: {
      image: null,
      container: {
        id: 77,
        title: '',
        code: 'TREE-77',
        images: []
      }
    },
    expected: `<div class="ss-detail-context mb-3"><span class="badge rounded-pill text-bg-secondary">Container</span><span title="TREE-77">TREE-77</span></div>`
  },
  {
    name: 'container fallback to id when title/code missing',
    vars: {
      image: null,
      container: {
        id: 99,
        title: '',
        code: '',
        images: []
      }
    },
    expected: `<div class="ss-detail-context mb-3"><span class="badge rounded-pill text-bg-secondary">Container</span><span title="99">99</span></div>`
  },
  {
    name: 'image context uses real title when present',
    vars: {
      image: {
        id: 900,
        title: 'Sunrise'
      },
      container: {
        id: 77,
        title: 'Demo User',
        code: 'TREE-77',
        images: [1]
      }
    },
    expected: `<div class="ss-detail-context mb-3"><span class="badge rounded-pill text-bg-primary">Image</span><span title="#900 · Sunrise">#900 · Sunrise</span><a class="btn btn-sm btn-outline-primary" href="/?containerId=77">View Container</a><button class="btn btn-sm btn-outline-secondary" data-action="input->topic#search">Focus Container</button></div>`
  },
  {
    name: 'container with null images does not show button',
    vars: {
      image: null,
      container: {
        id: 42,
        title: 'No Images',
        code: 'TREE-42',
        images: null
      }
    },
    expected: `<div class="ss-detail-context mb-3"><span class="badge rounded-pill text-bg-secondary">Container</span><span title="No Images">No Images</span></div>`
  }
];
