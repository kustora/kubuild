import {
  buildResponsiveStyles,
  getAttribute,
  getTextContent,
  hasAttribute,
  importHtml,
  type HtmlMappingRule,
} from '@kubuild/html-import';

function hasClass(className: string | undefined, name: string): boolean {
  return (className ?? '').split(/\s+/).includes(name);
}

/** <div class="pricing-card" data-plan="pro">…</div> → custom.pricing-card */
const pricingCardRule: HtmlMappingRule = {
  id: 'acme-pricing-card',
  priority: 200, // default rules use 30–60; host rules go above them
  match: (element) =>
    element.tagName === 'div' && hasClass(getAttribute(element, 'class'), 'pricing-card'),
  convert: (element, context, computed) => ({
    id: context.generateId('pricing'), // replaced by a deterministic id during normalization
    type: 'custom.pricing-card', // must be listed in allowedComponentTypes
    props: {
      plan: getAttribute(element, 'data-plan') ?? 'basic',
      summary: getTextContent(element).replace(/\s+/g, ' ').trim(),
    },
    styles: buildResponsiveStyles(computed, context.report),
    children: [],
  }),
};

/** Same id as the built-in "divider" rule, so it replaces it: drop every <hr>. */
const noDividersRule: HtmlMappingRule = {
  id: 'divider',
  priority: 50,
  match: (element) => element.tagName === 'hr',
  convert: () => null,
};

/** Keep children of <div data-kb-unwrap> but drop the wrapper itself. */
const unwrapRule: HtmlMappingRule = {
  id: 'acme-unwrap',
  priority: 210,
  match: (element) => hasAttribute(element, 'data-kb-unwrap'),
  convert: (element, context) => context.convertChildren(element),
};

export function importWithHostRules(html: string) {
  return importHtml(html, {
    rules: [pricingCardRule, noDividersRule, unwrapRule],
    allowedComponentTypes: ['custom.pricing-card'],
  });
}
