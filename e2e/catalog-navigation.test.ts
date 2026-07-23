import { expect, test, type Page } from '@playwright/test';

import { installCatalogApiFixture } from './catalogApiFixture';

const catalogQuery = 'CSE';

async function openSiteNavigation(page: Page, mobile: boolean) {
  if (!mobile) return;
  await page.getByRole('button', { name: 'Toggle navigation' }).click();
}

for (const { label, mobile, viewport } of [
  {
    label: 'mobile',
    mobile: true,
    viewport: { width: 390, height: 844 },
  },
  {
    label: 'desktop',
    mobile: false,
    viewport: { width: 1440, height: 900 },
  },
] as const) {
  test(`preserves a deep-linked Catalog search across Worksheet navigation on ${label}`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport);
    await installCatalogApiFixture(page);
    await page.goto(`/catalog?searchText=${catalogQuery}`);

    const resultCount = page.getByText(/^Showing \d+ results$/u).first();
    await expect(resultCount).not.toHaveText('Showing 0 results');
    await expect(page.getByTestId('catalog-course-row').first()).toBeVisible();

    await openSiteNavigation(page, mobile);
    await page.getByRole('link', { name: 'Worksheet', exact: true }).click();
    await expect(page).toHaveURL('/worksheet');

    await openSiteNavigation(page, mobile);
    await page
      .getByRole('link', { name: 'Catalog', exact: true })
      .press('Enter');

    await expect(page).toHaveURL(`/catalog?searchText=${catalogQuery}`, {
      timeout: 5_000,
    });
    await expect(
      page.getByRole('combobox', { name: 'Search courses' }),
    ).toHaveValue(catalogQuery);
    await expect(resultCount).not.toHaveText('Showing 0 results');
    await expect(page.getByTestId('catalog-course-row').first()).toBeVisible();
  });
}
