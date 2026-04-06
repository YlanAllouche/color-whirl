<script lang="ts">
  import { onDestroy } from 'svelte';
  import LucideIcon from '$lib/ui/icons/LucideIcon.svelte';

  type OptionValue = string | number;

  type Option = {
    value: OptionValue;
    label: string;
    disabled?: boolean;
  };

  type OptionGroup = {
    group: string;
    options: Option[];
  };

  type OptionOrGroup = Option | OptionGroup;

  type Props = {
    value: OptionValue;
    options: OptionOrGroup[];
    disabled?: boolean;
    ariaLabel?: string;
    title?: string;
    size?: 'sm' | 'md';
    onChange?: (next: OptionValue) => void;
  };

  let {
    value = $bindable(),
    options,
    disabled = false,
    ariaLabel = 'Select option',
    title,
    size = 'md',
    onChange
  }: Props = $props();

  let open = $state(false);
  let root: HTMLDivElement | null = $state(null);
  let trigger: HTMLButtonElement | null = $state(null);
  let popStyle = $state('');
  let popover: HTMLDivElement | null = $state(null);

  function close() {
    open = false;
  }

  function onDocPointerDown(e: PointerEvent) {
    if (!open) return;
    const t = e.target as Node | null;
    if (!t) return;
    if (root && root.contains(t)) return;
    close();
  }

  function onDocKeyDown(e: KeyboardEvent) {
    if (!open) return;
    if (e.key === 'Escape') {
      e.preventDefault();
      close();
    }
  }

  function updatePosition() {
    if (!trigger || typeof window === 'undefined') return;
    const rect = trigger.getBoundingClientRect();
    const padding = 8;
    const top = rect.bottom + 6;
    const maxLeft = Math.max(padding, window.innerWidth - padding - rect.width);
    const left = Math.min(Math.max(rect.left, padding), maxLeft);
    popStyle = `left: ${left}px; top: ${top}px; width: ${rect.width}px;`;
  }

  function portal(node: HTMLElement) {
    if (typeof document === 'undefined') return;
    document.body.appendChild(node);
    return {
      destroy() {
        node.remove();
      }
    };
  }

  function selectOption(opt: Option) {
    if (opt.disabled) return;
    value = opt.value;
    onChange?.(opt.value);
    close();
  }

  const selectedLabel = $derived(
    options
      .flatMap((opt) => ('group' in opt ? opt.options : [opt]))
      .find((opt) => opt.value === value)?.label ?? String(value)
  );

  const groups = $derived(() => {
    const grouped: Array<{ group?: string; options: Option[] }> = [];
    let buffer: Option[] = [];
    for (const opt of options) {
      if ('group' in opt) {
        if (buffer.length) grouped.push({ options: buffer });
        grouped.push({ group: opt.group, options: opt.options });
        buffer = [];
      } else {
        buffer.push(opt);
      }
    }
    if (buffer.length) grouped.push({ options: buffer });
    return grouped;
  });

  if (typeof document !== 'undefined') {
    document.addEventListener('pointerdown', onDocPointerDown, true);
    document.addEventListener('keydown', onDocKeyDown);
    onDestroy(() => {
      document.removeEventListener('pointerdown', onDocPointerDown, true);
      document.removeEventListener('keydown', onDocKeyDown);
    });
  }

  $effect(() => {
    if (!open) return;
    if (typeof window === 'undefined') return;
    updatePosition();
    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition, true);
    return () => {
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition, true);
    };
  });

  $effect(() => {
    if (!open || !popover) return;
    updatePosition();
  });
</script>

<div class="dropdown" class:disabled bind:this={root} data-size={size}>
  <button
    type="button"
    class="dropdown-trigger"
    aria-haspopup="listbox"
    aria-expanded={open}
    aria-label={ariaLabel}
    {title}
    disabled={disabled}
    bind:this={trigger}
    onclick={() => {
      if (disabled) return;
      open = !open;
    }}
  >
    <span class="dropdown-label">{selectedLabel}</span>
    <span class="chev" class:open={open} aria-hidden="true">
      <LucideIcon name="chevron-down" size={16} />
    </span>
  </button>

  {#if open}
    <div
      class="dropdown-pop"
      role="listbox"
      aria-label={ariaLabel}
      style={popStyle}
      bind:this={popover}
      use:portal
    >
      {#each groups as group}
        {#if group.group}
          <div class="dropdown-group">{group.group}</div>
        {/if}
        {#each group.options as opt}
          <button
            type="button"
            class="dropdown-item"
            class:active={opt.value === value}
            class:disabled={!!opt.disabled}
            role="option"
            aria-selected={opt.value === value}
            onclick={() => {
              selectOption(opt);
            }}
          >
            <span>{opt.label}</span>
            {#if opt.value === value}
              <LucideIcon name="check" size={16} />
            {/if}
          </button>
        {/each}
      {/each}
    </div>
  {/if}
</div>

<style>
  .dropdown {
    position: relative;
    flex: 1;
    min-width: 0;
  }

  .dropdown-trigger {
    width: 100%;
    height: 32px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.5rem;
    padding: 0 0.6rem;
    border-radius: var(--radius-sm);
    border: 1px solid var(--stroke0);
    background: rgba(20, 20, 22, 0.4);
    color: var(--text0);
    cursor: pointer;
    outline: none;
    text-align: left;
  }

  .dropdown[data-size='sm'] .dropdown-trigger {
    height: 30px;
    font-size: 0.8125rem;
    padding: 0 0.5rem;
  }

  .dropdown.disabled .dropdown-trigger {
    opacity: 0.55;
    cursor: not-allowed;
  }

  .dropdown-trigger:hover:not(:disabled) {
    border-color: var(--stroke1);
  }

  .dropdown-trigger:focus-visible {
    border-color: var(--accent-stroke);
    box-shadow: 0 0 0 3px rgba(249, 115, 22, 0.16);
  }

  .dropdown-label {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .chev {
    opacity: 0.8;
    transition: transform 140ms ease;
  }

  .chev.open {
    transform: rotate(180deg);
  }

  .dropdown-pop {
    position: fixed;
    z-index: 1200;
    border-radius: var(--radius-sm);
    border: 1px solid var(--stroke0);
    background: rgba(12, 12, 14, 0.96);
    box-shadow: 0 20px 55px rgba(0, 0, 0, 0.55);
    padding: 0.25rem;
    max-height: min(56vh, 520px);
    overflow: auto;
  }

  .dropdown-group {
    padding: 0.35rem 0.5rem 0.2rem;
    font-size: 0.72rem;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--text2);
  }

  .dropdown-item {
    width: 100%;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.5rem;
    padding: 0.45rem 0.5rem;
    border-radius: var(--radius-sm);
    border: 1px solid transparent;
    background: transparent;
    color: var(--text0);
    cursor: pointer;
    text-align: left;
  }

  .dropdown-item:hover:not(.disabled) {
    background: rgba(255, 255, 255, 0.06);
    border-color: rgba(255, 255, 255, 0.08);
  }

  .dropdown-item.active {
    border-color: var(--accent-stroke);
    background: var(--accent-soft);
  }

  .dropdown-item.disabled {
    opacity: 0.45;
    cursor: not-allowed;
  }
</style>
