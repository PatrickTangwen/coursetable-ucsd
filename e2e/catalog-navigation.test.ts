import { expect, test, type Page } from '@playwright/test';

import { installCatalogApiFixture } from './catalogApiFixture';

const catalogQuery = 'CSE';
const catalogQueryString = `searchText=${catalogQuery}`;

async function openSiteNavigation(page: Page, mobile: boolean) {
  if (!mobile) return;
  await page.getByRole('button', { name: 'Toggle navigation' }).click();
}

async function readDisplayedResultCount(page: Page) {
  const text = await page
    .getByText(/^Showing \d+ results$/u)
    .first()
    .textContent();
  const match = /Showing (?<count>\d+) results/u.exec(text ?? '');
  if (!match?.groups?.count)
    throw new Error(`Invalid result count: ${text ?? 'missing'}`);
  return Number(match.groups.count);
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
    await page.goto(`/catalog?${catalogQueryString}`);

    const resultCount = page.getByText(/^Showing \d+ results$/u).first();
    await expect(resultCount).not.toHaveText('Showing 0 results');
    await expect(page.getByTestId('catalog-course-row').first()).toBeVisible();
    const initialResultCount = await readDisplayedResultCount(page);
    const initialMountedRows = await page
      .getByTestId('catalog-course-row')
      .allTextContents();

    await openSiteNavigation(page, mobile);
    await page.getByRole('link', { name: 'Worksheet', exact: true }).click();
    await expect(page).toHaveURL('/worksheet');

    await openSiteNavigation(page, mobile);
    await page
      .getByRole('link', { name: 'Catalog', exact: true })
      .press('Enter');

    await expect(page).toHaveURL(`/catalog?${catalogQueryString}`, {
      timeout: 5_000,
    });
    await expect(
      page.getByRole('combobox', { name: 'Search courses' }),
    ).toHaveValue(catalogQuery);
    await expect
      .poll(() => readDisplayedResultCount(page))
      .toBe(initialResultCount);
    await expect(page.getByTestId('catalog-course-row').first()).toBeVisible();
    await expect
      .poll(() =>
        page
          .getByTestId('catalog-course-row')
          .allTextContents()
          .then((rows) => rows.slice(0, initialMountedRows.length)),
      )
      .toEqual(initialMountedRows);
  });

  test(`preserves a selected Catalog search suggestion across reload and Worksheet navigation on ${label}`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport);
    await installCatalogApiFixture(page);
    await page.goto('/catalog');

    const search = page.getByRole('combobox', { name: 'Search courses' });
    await search.fill('math');
    const subjectSuggestion = page.getByRole('option', {
      name: 'MATH / Mathematics Subject',
      exact: true,
    });
    await expect(subjectSuggestion).toBeVisible();
    await subjectSuggestion.click();

    await expect(search).toHaveValue('MATH');
    await expect
      .poll(() => new URL(page.url()).searchParams.get('searchColumn'))
      .toBe('Subject');
    await expect.poll(() => readDisplayedResultCount(page)).toBeGreaterThan(0);
    const selectedResultCount = await readDisplayedResultCount(page);
    await expect(page.getByTestId('catalog-course-row').first()).toBeVisible();
    const selectedMountedRows = await page
      .getByTestId('catalog-course-row')
      .allTextContents();
    await expect
      .poll(() =>
        page
          .getByTestId('catalog-course-row')
          .allTextContents()
          .then((rows) => rows.every((text) => /\bMATH[- ]/u.test(text))),
      )
      .toBe(true);

    await page.reload();

    await expect(search).toHaveValue('MATH');
    await expect
      .poll(() => readDisplayedResultCount(page))
      .toBe(selectedResultCount);
    await expect(page.getByTestId('catalog-course-row').first()).toBeVisible();
    await expect
      .poll(() =>
        page
          .getByTestId('catalog-course-row')
          .allTextContents()
          .then((rows) => rows.slice(0, selectedMountedRows.length)),
      )
      .toEqual(selectedMountedRows);

    await openSiteNavigation(page, mobile);
    await page.getByRole('link', { name: 'Worksheet', exact: true }).click();
    await expect(page).toHaveURL('/worksheet');

    await openSiteNavigation(page, mobile);
    await page.getByRole('link', { name: 'Catalog', exact: true }).click();

    await expect
      .poll(() => new URL(page.url()).searchParams.get('searchColumn'))
      .toBe('Subject');
    await expect(search).toHaveValue('MATH');
    await expect
      .poll(() => readDisplayedResultCount(page))
      .toBe(selectedResultCount);
    await expect(page.getByTestId('catalog-course-row').first()).toBeVisible();
    await expect
      .poll(() =>
        page
          .getByTestId('catalog-course-row')
          .allTextContents()
          .then((rows) => rows.slice(0, selectedMountedRows.length)),
      )
      .toEqual(selectedMountedRows);

    await page.getByRole('button', { name: 'Clear search' }).click();
    await expect(search).toHaveValue('');
    await expect
      .poll(() => new URL(page.url()).searchParams.get('searchText'))
      .toBeNull();
    await expect
      .poll(() => new URL(page.url()).searchParams.get('searchColumn'))
      .toBeNull();

    await search.fill('math');
    await expect(subjectSuggestion).toBeVisible();
    await subjectSuggestion.click();

    await search.fill('mathematics');
    await expect(search).toHaveValue('mathematics');
    await search.press('Escape');
    await search.press('Enter');
    await expect
      .poll(() => new URL(page.url()).searchParams.get('searchColumn'))
      .toBeNull();
    await expect
      .poll(() => new URL(page.url()).searchParams.get('searchText'))
      .toBe('mathematics');
  });
}
