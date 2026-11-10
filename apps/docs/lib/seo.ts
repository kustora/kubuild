import type { Metadata } from 'next';
import { appName, gitConfig, siteUrl } from './shared';

export const siteTitle = 'KUBUILD — Open & Portable Web Page Builder Engine';
export const siteTagline = 'The page builder for your app';
export const siteDescription =
  'KUBUILD is an open-source (Apache-2.0) page builder engine for React. Embed a visual editor in your app, store every page as a portable .stora JSON document in your own database, and render it on the server with no vendor lock-in.';
export const githubUrl = `https://github.com/${gitConfig.user}/${gitConfig.repo}`;
export const defaultOgImage = '/og/home.png';

export const absoluteUrl = (path: string) => new URL(path, siteUrl).toString();

/**
 * Next.js replaces nested `openGraph`/`twitter` objects instead of merging them,
 * so every page builds its social metadata through here to keep the shared fields.
 */
export function createMetadata({
  title,
  description = siteDescription,
  path,
  image = defaultOgImage,
  type = 'website',
  ...rest
}: Omit<Metadata, 'title' | 'description'> & {
  title?: string;
  description?: string;
  path: string;
  image?: string;
  type?: 'website' | 'article';
}): Metadata {
  const socialTitle = title ? `${title} - ${appName}` : siteTitle;
  const images = [{ url: image, width: 1200, height: 630, alt: socialTitle }];

  return {
    ...(title ? { title } : {}),
    description,
    ...rest,
    alternates: { canonical: path, ...rest.alternates },
    openGraph: {
      title: socialTitle,
      description,
      url: path,
      siteName: appName,
      locale: 'en_US',
      type,
      images,
    },
    twitter: {
      card: 'summary_large_image',
      title: socialTitle,
      description,
      images,
    },
  };
}

/* ---------- JSON-LD (schema.org) ---------- */

export const organizationLd = {
  '@type': 'Organization',
  '@id': absoluteUrl('/#organization'),
  name: 'Kustora',
  url: siteUrl,
  sameAs: [`https://github.com/${gitConfig.user}`],
};

export const websiteLd = {
  '@type': 'WebSite',
  '@id': absoluteUrl('/#website'),
  name: appName,
  url: siteUrl,
  description: siteDescription,
  publisher: { '@id': organizationLd['@id'] },
  inLanguage: 'en',
};

export const softwareLd = {
  '@type': ['SoftwareApplication', 'SoftwareSourceCode'],
  '@id': absoluteUrl('/#software'),
  name: appName,
  alternateName: 'kubuild',
  description: siteDescription,
  url: siteUrl,
  image: absoluteUrl(defaultOgImage),
  applicationCategory: 'DeveloperApplication',
  operatingSystem: 'Any (Node.js, browser, edge runtimes)',
  offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
  isAccessibleForFree: true,
  license: 'https://www.apache.org/licenses/LICENSE-2.0',
  codeRepository: githubUrl,
  programmingLanguage: ['TypeScript', 'React'],
  author: { '@id': organizationLd['@id'] },
  publisher: { '@id': organizationLd['@id'] },
  keywords:
    'page builder, visual editor, React page builder, headless page builder, layout engine, JSON document, .stora',
};

export function breadcrumbLd(items: { name: string; path: string }[]) {
  return {
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: item.name,
      item: absoluteUrl(item.path),
    })),
  };
}

export function faqLd(entries: { question: string; answer: string }[]) {
  return {
    '@type': 'FAQPage',
    mainEntity: entries.map((entry) => ({
      '@type': 'Question',
      name: entry.question,
      acceptedAnswer: { '@type': 'Answer', text: entry.answer },
    })),
  };
}

const decodeEntities = (s: string) =>
  s
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&');

/** Pulls `<Accordion title="…">…</Accordion>` pairs out of raw MDX so FAQ structured data stays in sync with the page. */
export function extractAccordionFaq(mdx: string) {
  const entries: { question: string; answer: string }[] = [];
  for (const match of mdx.matchAll(/<Accordion\s+title="([^"]+)"\s*>([\s\S]*?)<\/Accordion>/g)) {
    const answer = match[2]
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
      .replace(/\s+/g, ' ')
      .trim();
    if (answer) entries.push({ question: decodeEntities(match[1]), answer });
  }
  return entries;
}
