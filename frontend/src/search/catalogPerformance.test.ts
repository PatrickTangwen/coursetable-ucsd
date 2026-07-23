import { describe, expect, it } from 'vitest';

import {
  assertCatalogPerformance,
  createCatalogPerformanceFixture,
  runCatalogPerformanceBenchmark,
  type CatalogPerformanceReport,
} from './catalogPerformance';

describe('Catalog search performance contract', () => {
  it('exercises the accepted FA26 scale through the public search index', () => {
    const listings = createCatalogPerformanceFixture();
    const report = runCatalogPerformanceBenchmark(listings);

    expect(report.scale).toEqual({ courses: 1998, listings: 6104 });
    expect(report.operations.emptyFilter.resultCount).toBe(6104);
    expect(report.operations.textFilter.resultCount).toBe(1018);
    expect(report.operations.subjectFilter.resultCount).toBe(1018);
    expect(report.operations.typeahead.resultCount).toBe(334);
  });

  it('accepts a fixed-scale report inside the performance budgets', () => {
    const accepted: CatalogPerformanceReport = {
      scale: { courses: 1998, listings: 6104 },
      indexBuildMedianMs: 120,
      operations: {
        emptyFilter: { medianMs: 2, resultCount: 6104 },
        textFilter: { medianMs: 8, resultCount: 1018 },
        subjectFilter: { medianMs: 2, resultCount: 1018 },
        typeahead: { medianMs: 22, resultCount: 334 },
      },
    };

    expect(() => assertCatalogPerformance(accepted)).not.toThrow();
  });

  it('rejects a regression that moves submitted filtering back toward index-build cost', () => {
    const regressed: CatalogPerformanceReport = {
      scale: { courses: 1998, listings: 6104 },
      indexBuildMedianMs: 100,
      operations: {
        emptyFilter: { medianMs: 80, resultCount: 6104 },
        textFilter: { medianMs: 50, resultCount: 1018 },
        subjectFilter: { medianMs: 45, resultCount: 1018 },
        typeahead: { medianMs: 100, resultCount: 334 },
      },
    };

    expect(() => assertCatalogPerformance(regressed)).toThrow(
      /Catalog performance budget exceeded/u,
    );
  });

  it('rejects a regression in the one-time index build', () => {
    const regressed: CatalogPerformanceReport = {
      scale: { courses: 1998, listings: 6104 },
      indexBuildMedianMs: 900,
      operations: {
        emptyFilter: { medianMs: 2, resultCount: 6104 },
        textFilter: { medianMs: 7, resultCount: 1018 },
        subjectFilter: { medianMs: 2, resultCount: 1018 },
        typeahead: { medianMs: 22, resultCount: 334 },
      },
    };

    expect(() => assertCatalogPerformance(regressed)).toThrow(/index build/u);
  });
});
