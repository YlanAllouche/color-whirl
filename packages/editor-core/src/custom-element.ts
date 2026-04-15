import { mount, unmount } from 'svelte';
import ColorwhirlEditor from './ColorwhirlEditor.svelte';

const ATTR_MODE = 'mode';
const ATTR_READONLY = 'readonly';

type EditorElementInstance = {
  recipe?: unknown;
  initialMeta?: unknown;
};

class ColorwhirlEditorElement extends HTMLElement {
  static get observedAttributes() {
    return [ATTR_MODE, ATTR_READONLY];
  }

  private app: ReturnType<typeof mount> | null = null;
  private root: ShadowRoot;

  constructor() {
    super();
    this.root = this.attachShadow({ mode: 'open' });
  }

  connectedCallback() {
    this.render();
  }

  disconnectedCallback() {
    if (this.app) {
      unmount(this.app);
      this.app = null;
    }
  }

  attributeChangedCallback() {
    this.render();
  }

  get recipe() {
    return (this as EditorElementInstance).recipe;
  }

  set recipe(value: unknown) {
    (this as EditorElementInstance).recipe = value;
    this.render();
  }

  get initialMeta() {
    return (this as EditorElementInstance).initialMeta;
  }

  set initialMeta(value: unknown) {
    (this as EditorElementInstance).initialMeta = value;
    this.render();
  }

  private render() {
    if (!this.isConnected) return;

    if (this.app) {
      unmount(this.app);
      this.app = null;
    }

    this.app = mount(ColorwhirlEditor, {
      target: this.root,
      props: {
        recipe: this.recipe ?? null,
        mode: this.getAttribute(ATTR_MODE) === 'embedded' ? 'embedded' : 'standalone',
        readonly: this.hasAttribute(ATTR_READONLY),
        initialMeta: this.initialMeta ?? {}
      }
    });
  }
}

export function registerColorwhirlEditorElement(tagName = 'colorwhirl-editor') {
  if (!customElements.get(tagName)) {
    customElements.define(tagName, ColorwhirlEditorElement);
  }
}
