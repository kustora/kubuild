import { describe, it, expect } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { DimensionSectorControls } from '../src/components/style-manager/dimension-sector-controls';
import { STYLE_SECTORS } from '../src/components/style-manager/style-manager-accordion';

describe('Object Fit / Object Position style controls', () => {
  it('renders an Object Fit and Object Position select in the Dimension sector', () => {
    const html = renderToString(<DimensionSectorControls styles={{}} onChange={() => {}} />);

    expect(html).toContain('data-testid="dimension-select-object-fit"');
    expect(html).toContain('data-testid="dimension-select-object-position"');
    expect(html).toContain('Object Fit');
    expect(html).toContain('Object Position');
    // Every CSS object-fit keyword is reachable.
    ['contain', 'cover', 'fill', 'none', 'scale-down'].forEach((value) => {
      expect(html).toContain(`value="${value}"`);
    });
  });

  it('reflects the current objectFit / objectPosition style values', () => {
    const html = renderToString(
      <DimensionSectorControls
        styles={{ objectFit: 'cover', objectPosition: 'top right' }}
        onChange={() => {}}
      />,
    );

    expect(html).toContain('Cover');
    expect(html).toContain('Top Right');
  });

  it('offers an empty option so the property can be cleared back to the CSS default', () => {
    const html = renderToString(<DimensionSectorControls styles={{}} onChange={() => {}} />);

    expect(html).toContain('Default (fill)');
    expect(html).toContain('Default (center)');
  });

  it('lists objectFit and objectPosition among the Dimension sector properties', () => {
    const dimension = STYLE_SECTORS.find((sector) => sector.id === 'dimension');

    expect(dimension?.properties).toContain('objectFit');
    expect(dimension?.properties).toContain('objectPosition');
  });
});
