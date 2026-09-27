import starterPageData from './fixtures/starter-page.json' with { type: 'json' };
import { PageDocument } from './document.js';

export const starterPageFixture: PageDocument = starterPageData as unknown as PageDocument;
