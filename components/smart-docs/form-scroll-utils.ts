/**
 * Utility to smoothly auto-scroll modal scroll containers as the user moves
 * between inputs (via Tab or click) without injecting any artificial margins
 * or unnecessary empty whitespace into the DOM.
 */
export function handleFormFocusScroll(e: React.FocusEvent<HTMLElement>) {
  const container = e.currentTarget;
  const target = e.target as HTMLElement;
  if (!target || !container) return;

  // Only auto-scroll for interactive form elements
  const tag = target.tagName?.toLowerCase();
  if (tag !== 'input' && tag !== 'textarea' && tag !== 'select' && tag !== 'button') {
    return;
  }

  // Do not scroll the modal body if focus is inside an absolute dropdown/popover menu
  if (
    target.closest('[role="listbox"]') ||
    target.closest('[data-dropdown-menu]') ||
    target.closest('.popover-menu')
  ) {
    return;
  }

  // Consider the parent field wrapper (label + input) for optimal visibility
  const fieldWrapper = (target.closest('.flex-col') as HTMLElement) || target;

  const containerRect = container.getBoundingClientRect();
  const fieldRect = fieldWrapper.getBoundingClientRect();

  const topBuffer = 20;
  const bottomBuffer = 30;

  if (fieldRect.bottom > containerRect.bottom - bottomBuffer) {
    const delta = fieldRect.bottom - (containerRect.bottom - bottomBuffer);
    container.scrollBy({
      top: delta,
      behavior: 'smooth',
    });
  } else if (fieldRect.top < containerRect.top + topBuffer) {
    const delta = fieldRect.top - (containerRect.top + topBuffer);
    container.scrollBy({
      top: delta,
      behavior: 'smooth',
    });
  }
}
