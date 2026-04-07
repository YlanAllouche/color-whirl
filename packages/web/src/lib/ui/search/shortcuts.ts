type SearchShortcutOptions = {
  getInput: () => HTMLInputElement | null;
  getQuery: () => string;
  setQuery: (next: string) => void;
};

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;
  const tag = target.tagName.toLowerCase();
  return tag === 'input' || tag === 'textarea' || tag === 'select';
}

export function installSearchShortcuts(options: SearchShortcutOptions) {
  function focusSearch() {
    const input = options.getInput();
    if (!input) return;
    input.focus();
    input.select();
  }

  function clearSearch() {
    options.setQuery('');
    const input = options.getInput();
    if (input) input.value = '';
  }

  function handleKeydown(event: KeyboardEvent) {
    const input = options.getInput();
    const isInputFocused = !!input && document.activeElement === input;
    const hasQuery = options.getQuery().trim().length > 0;

    if (event.key === 'Escape') {
      if (isInputFocused || hasQuery) {
        event.preventDefault();
        clearSearch();
        input?.blur();
      }
      return;
    }

    if (isEditableTarget(event.target)) return;

    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
      event.preventDefault();
      focusSearch();
      return;
    }

    if (!event.metaKey && !event.ctrlKey && event.key === '/') {
      event.preventDefault();
      focusSearch();
    }
  }

  window.addEventListener('keydown', handleKeydown);

  return {
    destroy() {
      window.removeEventListener('keydown', handleKeydown);
    }
  };
}
