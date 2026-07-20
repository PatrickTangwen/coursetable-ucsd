import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import PageStatus, { DataLoadErrorPage } from './PageStatus';

describe('PageStatus', () => {
  it('reuses the new status-page visual for route and data failures', () => {
    const notFound = renderToStaticMarkup(
      <PageStatus
        title="Page not found"
        message="The page you're looking for doesn't exist."
      />,
    );
    const dataFailure = renderToStaticMarkup(<DataLoadErrorPage />);

    expect(notFound).toContain('Page not found');
    expect(dataFailure).toContain('Unable to load this page');
    expect(dataFailure).toContain(
      'We couldn&#x27;t load the data for this page. Reload the page to try again.',
    );
    expect(notFound).toContain('page_not_found.png');
    expect(dataFailure).toContain('page_not_found.png');
  });
});
