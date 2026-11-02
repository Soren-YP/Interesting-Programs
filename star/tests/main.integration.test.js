import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { expect, it, vi } from 'vitest';

it('renders the editorial index and keeps its primary interactions isolated', async () => {
  const html = readFileSync(resolve(process.cwd(), 'index.html'), 'utf8');
  document.open();
  document.write(html);
  document.close();
  window.open = vi.fn(() => null);

  await import('../src/main.js');

  expect(document.getElementById('collection-title').textContent).toBe('常用');
  expect(document.querySelectorAll('.bookmark-card')).toHaveLength(2);
  expect(document.querySelector('[data-view="favorites"]').classList).toContain('active');

  const search = document.getElementById('bookmark-search');
  search.value = 'github';
  search.dispatchEvent(new Event('input', { bubbles: true }));
  expect(document.querySelector('[data-view="all"]').classList).toContain('active');
  expect(document.querySelectorAll('.bookmark-card')).toHaveLength(1);

  document.querySelector('.card-url').dispatchEvent(
    new MouseEvent('click', { bubbles: true, cancelable: true }),
  );
  expect(window.open).toHaveBeenCalledOnce();

  window.open.mockClear();
  document.querySelector('.bookmark-card [data-action="edit-bookmark"]').click();
  expect(window.open).not.toHaveBeenCalled();
  expect(document.getElementById('bookmark-dialog').hidden).toBe(false);
  document.querySelector('#bookmark-dialog [data-close-dialog]').click();

  document.querySelector('.selection-control').click();
  expect(document.getElementById('selected-count').textContent).toBe('已选择 1 项');

  document.getElementById('selection-mode-button').click();
  search.value = '';
  search.dispatchEvent(new Event('input', { bubbles: true }));
  document.querySelector('[data-view="favorites"]').click();
  const initialFirstTitle = document.querySelector('.card-title').textContent;
  document.querySelector('[data-action="move-down"]').click();
  expect(document.querySelector('.card-title').textContent).not.toBe(initialFirstTitle);

  document.getElementById('settings-button').click();
  expect(document.getElementById('sidebar-more').open).toBe(true);
  document.getElementById('sidebar-toggle').click();
  expect(document.body.classList).toContain('sidebar-open');
  document.getElementById('sidebar-scrim').click();
  expect(document.body.classList).not.toContain('sidebar-open');

  window.open.mockClear();
  search.value = '不存在的收藏关键词';
  search.dispatchEvent(new Event('input', { bubbles: true }));
  document.getElementById('omnibox-form').dispatchEvent(
    new SubmitEvent('submit', { bubbles: true, cancelable: true }),
  );
  expect(window.open).toHaveBeenCalledOnce();
  expect(window.open.mock.calls[0][0]).toContain('bing.com/search');

  window.open.mockClear();
  search.value = 'github';
  search.dispatchEvent(new Event('input', { bubbles: true }));
  search.dispatchEvent(
    new KeyboardEvent('keydown', {
      key: 'Enter',
      ctrlKey: true,
      bubbles: true,
      cancelable: true,
    }),
  );
  expect(window.open).toHaveBeenCalledOnce();
  expect(window.open.mock.calls[0][0]).toContain('bing.com/search');

  window.open.mockClear();
  search.value = 'example.com';
  search.dispatchEvent(new Event('input', { bubbles: true }));
  document.getElementById('omnibox-form').dispatchEvent(
    new SubmitEvent('submit', { bubbles: true, cancelable: true }),
  );
  expect(window.open).toHaveBeenCalledWith(
    'https://example.com/',
    '_blank',
    'noopener,noreferrer',
  );
});
