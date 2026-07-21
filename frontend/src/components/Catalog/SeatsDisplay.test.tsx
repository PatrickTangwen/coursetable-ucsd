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

  it('prefers source-reported available seats over a derived total', () => {
    const html = renderToStaticMarkup(
      <SeatsDisplay enrolled={20} capacity={100} availableSeats={90} />,
    );

    expect(html).toContain('90 left');
    expect(html).not.toContain('80 left');
  });

  it('shows effectively unbounded availability without a numeric limit', () => {
    const html = renderToStaticMarkup(
      <SeatsDisplay
        enrolled={null}
        capacity={null}
        availableSeats={null}
        capacityKind="effectively_unbounded"
      />,
    );

    expect(html).toContain('Open · no fixed cap');
    expect(html).not.toContain('9999');
  });
});
