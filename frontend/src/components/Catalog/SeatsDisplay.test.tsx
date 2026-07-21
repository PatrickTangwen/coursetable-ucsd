import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import SeatsDisplay from './SeatsDisplay';

describe('SeatsDisplay', () => {
  it('shows source-reported available seats when capacity is unavailable', () => {
    const html = renderToStaticMarkup(
      <SeatsDisplay enrolled={null} capacity={null} availableSeats={16} />,
    );

    expect(html).toContain('16 left');
  });
});
