import type React from 'react';
import type { RenderNodeContentOptions } from '../render-node-content.js';
import { renderCountdown } from './countdown.js';
import { renderAccordion, renderAccordionItem } from './accordion.js';
import { renderTabs, renderTabPanel } from './tabs.js';
import { renderCarousel } from './carousel.js';
import { renderRating } from './rating.js';
import { renderDivider, renderSpacer } from './divider.js';

export {
  splitCountdown,
  formatCountdown,
  getTimeZoneOffsetMs,
  resolveFixedDeadline,
  resolveEvergreenDeadline,
  getCountdownStorage,
  resetCountdownMemoryStore,
  fireCountdownExpire,
  type CountdownFormat,
  type CountdownParts,
  type CountdownStorageLike,
} from './countdown.js';
export { toggleAccordionIndex, buildFaqJsonLd, serializeJsonForScript } from './accordion.js';
export { clampTabIndex } from './tabs.js';
export { stepCarouselIndex, swipeDirection, CAROUSEL_SWIPE_THRESHOLD } from './carousel.js';
export { normalizeRating, ratingStarFills, formatRatingLabel, RATING_MAX_STARS } from './rating.js';

/**
 * Conversion components (Epic 60): countdown, accordion/accordion-item, tabs/tab-panel,
 * carousel, rating, divider, spacer.
 */
export function renderConversionNode(options: RenderNodeContentOptions): React.ReactElement | null {
  switch (options.node.type) {
    case 'countdown':
      return renderCountdown(options);
    case 'accordion':
      return renderAccordion(options);
    case 'accordion-item':
      return renderAccordionItem(options);
    case 'tabs':
      return renderTabs(options);
    case 'tab-panel':
      return renderTabPanel(options);
    case 'carousel':
      return renderCarousel(options);
    case 'rating':
      return renderRating(options);
    case 'divider':
      return renderDivider(options);
    case 'spacer':
      return renderSpacer(options);
    default:
      return null;
  }
}
