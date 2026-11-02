export function isTypingTarget(target) {
  return Boolean(target?.closest?.('input, textarea, select, [contenteditable="true"]'));
}

export function shouldOpenCardFromEvent(event) {
  return !event.target.closest(
    'a, button, input, select, textarea, summary, details, .bookmark-actions, '
      + '.selection-control, .row-menu',
  );
}

export function shouldSwitchToAllOnSearch(view, value) {
  return view === 'favorites' && String(value).trim().length > 0;
}

export function getFocusableElements(container) {
  return [...container.querySelectorAll(
    'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), '
      + 'textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
  )].filter((element) => !element.hidden && element.getAttribute('aria-hidden') !== 'true');
}

export function trapFocus(event, container) {
  if (event.key !== 'Tab') return;
  const focusable = getFocusableElements(container);
  if (!focusable.length) {
    event.preventDefault();
    return;
  }

  const first = focusable[0];
  const last = focusable.at(-1);
  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault();
    last.focus();
  }
  else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault();
    first.focus();
  }
}
