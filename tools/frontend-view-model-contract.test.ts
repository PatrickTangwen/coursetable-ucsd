import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';

const sourceRoot = path.resolve('frontend/src');

function sourceImports(sourcePath: string) {
  const source = readFileSync(path.join(sourceRoot, sourcePath), 'utf8');
  const sourceDirectory = path.posix.dirname(sourcePath);
  return ts
    .preProcessFile(source)
    .importedFiles.map(({ fileName }) =>
      fileName.startsWith('.')
        ? path.posix.normalize(path.posix.join(sourceDirectory, fileName))
        : fileName,
    );
}

describe('Course Planning frontend contract', () => {
  it('keeps active UCSD boundaries independent of inherited GraphQL types and hooks', () => {
    const activeBoundaries = [
      'search/SearchBootstrap.tsx',
      'components/Catalog/CatalogTable.tsx',
      'components/Catalog/FilterBar.tsx',
      'components/Catalog/MobileFilterSheet.tsx',
      'components/CourseModal/UcsdSnapshotCourseModal.tsx',
      'components/ModalHistoryBridge.tsx',
      'components/Search/LastUpdated.tsx',
      'components/Worksheet/SeasonDropdown.tsx',
      'components/Worksheet/WorksheetConflictIcon.tsx',
      'pages/CatalogListView.tsx',
      'search/catalogListFilters.ts',
      'slices/WorksheetSlice.ts',
      'utilities/anonymousWorksheet.ts',
      'utilities/modalHistoryUrl.ts',
      'utilities/savedWorksheet.ts',
    ];
    const forbiddenDependencies = [
      'generated/graphql-types',
      'queries/graphql-queries',
      'hooks/useFerry',
    ];

    for (const sourcePath of activeBoundaries) {
      const imports = sourceImports(sourcePath);
      for (const forbiddenDependency of forbiddenDependencies) {
        expect(
          imports,
          `${sourcePath} imports ${forbiddenDependency}`,
        ).not.toContain(forbiddenDependency);
      }
    }
  });

  it('gives remaining compatibility consumers explicit legacy-only boundaries', () => {
    expect(
      existsSync(path.join(sourceRoot, 'hooks/useCoursePlanning.ts')),
    ).toBe(true);
    expect(existsSync(path.join(sourceRoot, 'hooks/useLegacyFerry.ts'))).toBe(
      true,
    );
    expect(
      existsSync(path.join(sourceRoot, 'hooks/useLegacyWorksheetInfo.ts')),
    ).toBe(true);
    expect(
      existsSync(path.join(sourceRoot, 'utilities/legacyCourseModalUrl.ts')),
    ).toBe(true);
    expect(existsSync(path.join(sourceRoot, 'hooks/useFerry.ts'))).toBe(false);
    expect(
      existsSync(
        path.join(sourceRoot, 'utilities/legacyAnonymousWorksheet.ts'),
      ),
    ).toBe(false);
  });
});
