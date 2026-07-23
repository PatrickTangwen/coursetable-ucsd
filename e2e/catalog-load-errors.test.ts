import { expect, test } from '@playwright/test';

import { installCatalogApiFixture } from './catalogApiFixture';

test('does not download the catalog on the landing page', async ({ page }) => {
  await installCatalogApiFixture(page);
  const catalogRequests: string[] = [];
  page.on('request', (request) => {
    const { pathname } = new URL(request.url());
    if (pathname.startsWith('/api/catalog/')) catalogRequests.push(pathname);
  });

  await page.goto('/');
  await expect(
    page.getByRole('heading', { name: /Every course/u }),
  ).toBeVisible();
  // Settle window: catalog requests would fire from mount effects right after
  // hydration, so a short quiet period is enough to catch a regression.
  await page.waitForTimeout(1500);

  expect(catalogRequests).toEqual([]);
});

test('surfaces a catalog load failure on the page without toasts', async ({
  page,
}) => {
  await installCatalogApiFixture(page);
  await page.route('**/api/catalog/public/FA26', (route) =>
    route.abort('failed'),
  );

  await page.goto('/catalog');
  const search = page.getByRole('combobox', { name: 'Search courses' });
  await search.fill('cse');
  await search.press('Enter');

  await expect(
    page.getByRole('heading', { name: 'Unable to load this page' }),
  ).toBeVisible();
  await expect(
    page.getByText('Failed to fetch course information'),
  ).toHaveCount(0);
  await expect(page.getByText(/Failed while fetching catalog/u)).toHaveCount(0);
});
