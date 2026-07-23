import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { expect, test, type Locator, type Page } from '@playwright/test';

const maximumMountedCourseRows = 24;
const maximumDraftPaintMedianMs = 250;
const catalogFixturePath = path.resolve(
  process.cwd(),
  'api/static/catalogs/public/FA26.json',
);
const metadataFixturePath = path.resolve(
  process.cwd(),
  'api/static/metadata.json',
);

async function installCatalogApiFixture(page: Page) {
  const [catalogBody, metadataBody] = await Promise.all([
    readFile(catalogFixturePath, 'utf8'),
    readFile(metadataFixturePath, 'utf8'),
  ]);

  await page.route('**/api/**', async (route) => {
    const { pathname } = new URL(route.request().url());
    if (pathname === '/api/catalog/metadata') {
      await route.fulfill({
        body: metadataBody,
        contentType: 'application/json',
      });
      return;
    }
    if (pathname === '/api/catalog/public/FA26') {
      await route.fulfill({
        body: catalogBody,
        contentType: 'application/json',
      });
      return;
    }
    await route.fulfill({
      status: 404,
      contentType: 'application/json',
      body: JSON.stringify({ error: 'NOT_FOUND' }),
    });
  });
}

async function expectBoundedCourseRows(page: Page) {
  const rows = page.getByTestId('catalog-course-row');
  await expect.poll(() => rows.count()).toBeGreaterThan(0);
  expect(await rows.count()).toBeLessThanOrEqual(maximumMountedCourseRows);
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

function measureDraftPaint(search: Locator, draft: string) {
  return search.evaluate((element, nextValue) => {
    const input = element as HTMLInputElement;
    const nativeValueSetter = Object.getOwnPropertyDescriptor(
      HTMLInputElement.prototype,
      'value',
    )?.set;
    if (!nativeValueSetter)
      throw new Error('Missing native input value setter');

    return new Promise<number>((resolve) => {
      const startedAt = performance.now();
      nativeValueSetter.call(input, nextValue);
      input.dispatchEvent(new Event('input', { bubbles: true }));
      requestAnimationFrame(() => resolve(performance.now() - startedAt));
    });
  }, draft);
}

function median(values: number[]) {
  const ordered = values.toSorted((a, b) => a - b);
  return ordered[Math.floor(ordered.length / 2)]!;
}

async function measureDraftPaintMedians(search: Locator) {
  const measurements = new Map([
    ['c', [] as number[]],
    ['cs', [] as number[]],
    ['cse', [] as number[]],
  ]);
  for (let run = 0; run < 5; run += 1) {
    await measureDraftPaint(search, '');
    for (const draft of measurements.keys()) {
      measurements.get(draft)!.push(await measureDraftPaint(search, draft));
      await expect(search).toHaveValue(draft);
    }
  }
  return [...measurements].map(([draft, durations]) => ({
    draft,
    medianMs: median(durations),
  }));
}

test('keeps mobile Catalog input responsive and the result DOM virtualized', async ({
  page,
}) => {
  await installCatalogApiFixture(page);
  await page.goto('/catalog');

  const search = page.getByRole('combobox', { name: 'Search courses' });
  expect(page.viewportSize()).toEqual({ width: 390, height: 844 });
  await expect
    .poll(() => page.getByText(/^Showing \d+ results$/u).count())
    .toBeGreaterThan(0);
  const initialResultCount = await readDisplayedResultCount(page);
  if (initialResultCount > 0) await expectBoundedCourseRows(page);

  const catalogUrl = page.url();
  const draftPaintMedians = await measureDraftPaintMedians(search);
  for (const { draft, medianMs } of draftPaintMedians) {
    expect(
      medianMs,
      `${draft} draft paint median was ${medianMs.toFixed(1)}ms`,
    ).toBeLessThan(maximumDraftPaintMedianMs);
  }
  await expect(page).toHaveURL(catalogUrl);
  await expect
    .poll(() => readDisplayedResultCount(page))
    .toBe(initialResultCount);

  await search.press('Enter');
  await expect(page).toHaveURL(/searchText=cse/u);
  await expect
    .poll(() => readDisplayedResultCount(page))
    .not.toBe(initialResultCount);
  const submittedResultCount = await readDisplayedResultCount(page);
  expect(submittedResultCount).toBeGreaterThan(0);
  await expectBoundedCourseRows(page);

  const rows = page.getByTestId('catalog-course-row');
  const firstVisibleIndex = Number(
    await rows.first().getAttribute('data-index'),
  );
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await expect
    .poll(async () =>
      Number(
        await page
          .getByTestId('catalog-course-row')
          .first()
          .getAttribute('data-index'),
      ),
    )
    .toBeGreaterThan(firstVisibleIndex);
  await expectBoundedCourseRows(page);

  const expandableRow = page
    .getByTestId('catalog-course-row')
    .filter({ has: page.locator('button[aria-expanded="false"]') })
    .first();
  const expandable = expandableRow.locator('button[aria-expanded]').first();
  await expect(expandable).toBeVisible();
  await expandable.click();
  await expect(
    page
      .getByTestId('catalog-course-row')
      .locator('button[aria-expanded="true"]'),
  ).toHaveCount(1);
  await expectBoundedCourseRows(page);

  await page.evaluate(() => window.scrollTo(0, 0));
  await page.getByRole('button', { name: 'Clear search' }).click();
  await expect
    .poll(() => readDisplayedResultCount(page))
    .toBe(initialResultCount);
  await search.fill('cse');

  const subjectSuggestion = page
    .getByRole('option')
    .filter({ hasText: 'CSE / Computer Science & Engineering' })
    .filter({ hasText: 'Subject' });
  await expect(subjectSuggestion).toBeVisible();
  await subjectSuggestion.click();

  await expect(search).toHaveValue('CSE');
  await expect(page).toHaveURL(/searchText=CSE/u);
  await expect.poll(() => readDisplayedResultCount(page)).toBeGreaterThan(0);
  await expectBoundedCourseRows(page);
  await expect
    .poll(async () =>
      (await page.getByTestId('catalog-course-row').allTextContents()).every(
        (text) => /\bCSE[- ]/u.test(text),
      ),
    )
    .toBe(true);
});
