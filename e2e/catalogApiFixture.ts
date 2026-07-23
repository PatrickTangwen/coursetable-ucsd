import { readFile } from 'node:fs/promises';
import path from 'node:path';
import type { Page } from '@playwright/test';

import { splitPublishedCatalogPayload } from '../shared/catalogPayload.js';

const catalogFixturePath = path.resolve(
  process.cwd(),
  'api/static/catalogs/public/FA26.json',
);
const metadataFixturePath = path.resolve(
  process.cwd(),
  'api/static/metadata.json',
);

export async function installCatalogApiFixture(page: Page) {
  const [catalogBody, metadataBody] = await Promise.all([
    readFile(catalogFixturePath, 'utf8'),
    readFile(metadataFixturePath, 'utf8'),
  ]);
  const canonical = JSON.parse(catalogBody) as {
    courses: {
      subject: string;
      course_number: string;
      title: string;
      archive_record_count: number;
      grade_archive_records: unknown[];
      sections: unknown[];
    }[];
  };
  const { listPayload, detailPayload } =
    splitPublishedCatalogPayload(canonical);
  const listBody = JSON.stringify(listPayload);
  const detailBody = JSON.stringify(detailPayload);
  const courseWithDetails = canonical.courses.find(
    (course) =>
      course.archive_record_count > 0 &&
      course.grade_archive_records.length > 0 &&
      course.sections.length === 1,
  );
  if (!courseWithDetails)
    throw new Error('Catalog fixture has no single-section Past Grades course');
  let detailRequestCount = 0;

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
        body: listBody,
        contentType: 'application/json',
      });
      return;
    }
    if (pathname === '/api/catalog/details/FA26') {
      detailRequestCount += 1;
      await route.fulfill({
        body: detailBody,
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

  return {
    courseWithDetails,
    detailRequestCount: () => detailRequestCount,
  };
}
