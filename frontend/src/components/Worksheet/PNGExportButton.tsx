import { useState } from 'react';
import saveFile from 'file-saver';
import html2canvas from 'html2canvas';
import { toast } from 'sonner';
import { useStore } from '../../store';

const CANVAS_SCALE = 3; // High-resolution export (3x)

// The SunGrid calendar root marks itself with this attribute so the export
// doesn't depend on hashed CSS-module class names; elements marked with the
// ignore attribute (e.g. the live now-line) are left out of the capture.
export const PNG_EXPORT_ROOT_ATTRIBUTE = 'data-png-export-root';
export const PNG_EXPORT_IGNORE_ATTRIBUTE = 'data-png-export-ignore';

// Html2canvas can't rasterize the paper skin's soft-light noise blend, which
// shifts every event color. On screen the noise overlay makes the block read
// as a flat tint, so drop the whole background image in the clone and let the
// flat tint fill match the on-screen look.
function stripUnsupportedBlends(root: HTMLElement) {
  for (const element of root.querySelectorAll<HTMLElement>('*')) {
    if (!element.style.backgroundBlendMode) continue;
    element.style.backgroundImage = 'none';
    element.style.backgroundBlendMode = '';
    element.style.backgroundSize = '';
  }
}

export function useCalendarPNGExport() {
  const viewedSeason = useStore((state) => state.viewedSeason);
  const [isExporting, setIsExporting] = useState(false);

  const exportPNG = async () => {
    setIsExporting(true);
    try {
      const calendarElement = document.querySelector<HTMLElement>(
        `[${PNG_EXPORT_ROOT_ATTRIBUTE}]`,
      );

      if (!calendarElement)
        throw new Error('Calendar not found. Please try again.');

      // The calendar surfaces paint themselves; the body background (theme
      // aware) only backfills fully transparent spots.
      const isTransparent = (color: string) =>
        !color || color === 'transparent' || color === 'rgba(0, 0, 0, 0)';
      const bodyBackground = getComputedStyle(document.body).backgroundColor;
      const pageBackground = isTransparent(bodyBackground)
        ? '#ffffff'
        : bodyBackground;

      const canvas = await html2canvas(calendarElement, {
        backgroundColor: pageBackground,
        scale: CANVAS_SCALE,
        logging: false,
        useCORS: true,
        ignoreElements: (element) =>
          element.hasAttribute(PNG_EXPORT_IGNORE_ATTRIBUTE),
        onclone(clonedDocument) {
          const clonedRoot = clonedDocument.querySelector<HTMLElement>(
            `[${PNG_EXPORT_ROOT_ATTRIBUTE}]`,
          );
          if (clonedRoot) stripUnsupportedBlends(clonedRoot);
        },
      });

      await new Promise<void>((resolve, reject) => {
        canvas.toBlob((blob) => {
          if (blob) {
            saveFile(blob, `${viewedSeason}_worksheet.png`);
            toast.success('Calendar exported as PNG!');
            resolve();
          } else {
            reject(new Error('Failed to export calendar as PNG.'));
          }
        });
      });
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'Error exporting calendar as PNG.';
      toast.error(message);
    } finally {
      setIsExporting(false);
    }
  };

  return { exportPNG, isExporting };
}
