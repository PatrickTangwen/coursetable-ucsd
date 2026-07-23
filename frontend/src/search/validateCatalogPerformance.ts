import {
  assertCatalogPerformance,
  runCatalogPerformanceBenchmark,
} from './catalogPerformance';

const report = runCatalogPerformanceBenchmark();
assertCatalogPerformance(report);

console.log(
  JSON.stringify(
    {
      result: 'passed',
      ...report,
    },
    null,
    2,
  ),
);
