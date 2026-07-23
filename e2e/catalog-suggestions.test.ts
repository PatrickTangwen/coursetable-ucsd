import { expect, test } from '@playwright/test';

import { installCatalogApiFixture } from './catalogApiFixture';

// Must match suggestionRowHeight in CatalogNavSearch.tsx.
const suggestionRowHeight = 37;

test('scrolls through every matched search suggestion', async ({ page }) => {
  await installCatalogApiFixture(page);
  await page.goto('/catalog');

  const search = page.getByRole('combobox', { name: 'Search courses' });
  await search.fill('math');

  const listbox = page.getByRole('listbox', { name: 'Search suggestions' });
  await expect(listbox).toBeVisible();

  // The dropdown exposes all matches, not a fixed top-N: the virtualized
  // track is sized for far more rows than the DOM renders at once.
  const totalRows = await listbox.evaluate(
    (element, rowHeight) =>
      Math.round(
        (element.firstElementChild as HTMLElement).getBoundingClientRect()
          .height / rowHeight,
      ),
    suggestionRowHeight,
  );
  expect(totalRows).toBeGreaterThan(8);
  const renderedRows = await listbox.getByRole('option').count();
  expect(renderedRows).toBeLessThan(totalRows);

  // Scrolling to the bottom reaches the final match.
  await listbox.evaluate((element) => {
    element.scrollTop = element.scrollHeight;
  });
  const lastOption = listbox.getByRole('option').last();
  await expect(lastOption).toHaveId(new RegExp(`-${totalRows - 1}$`, 'u'));
  await expect(lastOption).toBeVisible();
});
