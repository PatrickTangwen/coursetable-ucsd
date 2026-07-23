import { expect, test, type Locator, type Page } from '@playwright/test';
import sharp from 'sharp';

import { installCatalogApiFixture } from './catalogApiFixture';

const darkIllustrationAppearance = {
  filter: 'invert(1) hue-rotate(180deg) contrast(1.08)',
  mixBlendMode: 'screen',
};

function readIllustrationAppearance(illustration: Locator) {
  return illustration.evaluate((element) => {
    const style = getComputedStyle(element);
    return {
      filter: style.filter,
      mixBlendMode: style.mixBlendMode,
    };
  });
}

async function requireIllustrationBounds(
  illustration: Locator,
  label = 'Calendar',
) {
  const bounds = await illustration.boundingBox();
  if (!bounds) throw new Error(`${label} illustration is not rendered`);
  return bounds;
}

async function expectIllustrationNotDraggable(
  page: Page,
  illustration: Locator,
) {
  await illustration.evaluate((element) => {
    element.addEventListener(
      'dragstart',
      () => {
        (element as HTMLElement).dataset.dragStarted = 'true';
      },
      { once: true },
    );
  });
  const bounds = await requireIllustrationBounds(illustration);

  const center = {
    x: bounds.x + bounds.width / 2,
    y: bounds.y + bounds.height / 2,
  };
  await page.mouse.move(center.x, center.y);
  await page.mouse.down();
  await page.mouse.move(center.x + 60, center.y + 30, { steps: 6 });
  await page.mouse.up();

  expect(await illustration.getAttribute('data-drag-started')).toBeNull();
}

async function measureIllustrationBackgroundDelta(
  page: Page,
  illustration: Locator,
) {
  const bounds = await requireIllustrationBounds(illustration);

  const padding = 12;
  const clipX = Math.max(0, Math.floor(bounds.x) - padding);
  const clipY = Math.max(0, Math.floor(bounds.y));
  const screenshot = await page.screenshot({
    clip: {
      x: clipX,
      y: clipY,
      width: Math.ceil(bounds.width) + padding * 2,
      height: 24,
    },
  });
  const { data, info } = await sharp(screenshot)
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const pixelAt = (x: number, y: number) => {
    const offset = (y * info.width + x) * info.channels;
    return [...data.subarray(offset, offset + 3)];
  };
  const outside = pixelAt(4, 8);
  const inside = pixelAt(padding + 4, 8);
  return Math.max(
    ...inside.map((channel, index) => Math.abs(channel - outside[index]!)),
  );
}

test('keeps empty calendar illustrations seamless and inert', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await installCatalogApiFixture(page);
  await page.goto('/catalog');

  const catalogIllustration = page
    .locator('img[src*="calendar_img_high_res"]')
    .first();
  await expect(catalogIllustration).toBeVisible();
  await expectIllustrationNotDraggable(page, catalogIllustration);
  await expect
    .poll(() => readIllustrationAppearance(catalogIllustration))
    .toEqual({
      filter: 'none',
      mixBlendMode: 'multiply',
    });

  await page.getByRole('button', { name: 'To dark mode' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await expect
    .poll(() => readIllustrationAppearance(catalogIllustration))
    .toEqual(darkIllustrationAppearance);
  expect(
    await measureIllustrationBackgroundDelta(page, catalogIllustration),
  ).toBe(0);

  await page.getByRole('link', { name: 'Worksheet' }).click();
  await page.getByRole('button', { name: 'List', pressed: false }).click();
  const listIllustration = page
    .locator('img[src*="calendar_img_high_res"]')
    .first();
  await expect(listIllustration).toBeVisible();
  await expectIllustrationNotDraggable(page, listIllustration);
  await expect
    .poll(() => readIllustrationAppearance(listIllustration))
    .toEqual(darkIllustrationAppearance);

  const desktopListBounds = await requireIllustrationBounds(
    listIllustration,
    'Desktop List View calendar',
  );
  expect(desktopListBounds.width).toBeGreaterThanOrEqual(260);
  expect(
    desktopListBounds.y + desktopListBounds.height / 2,
  ).toBeGreaterThanOrEqual(900 * 0.42);

  await page.setViewportSize({ width: 390, height: 844 });
  const mobileListBounds = await requireIllustrationBounds(
    listIllustration,
    'Mobile List View calendar',
  );
  expect(mobileListBounds.width).toBeGreaterThanOrEqual(210);
  expect(mobileListBounds.width).toBeLessThanOrEqual(230);
  expect(
    mobileListBounds.y + mobileListBounds.height / 2,
  ).toBeGreaterThanOrEqual(844 * 0.38);
});
