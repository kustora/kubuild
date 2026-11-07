import { source } from '@/lib/source';
import {
  DocsBody,
  DocsDescription,
  DocsPage,
  DocsTitle,
  MarkdownCopyButton,
  ViewOptionsPopover,
} from 'fumadocs-ui/layouts/docs/page';
import { notFound } from 'next/navigation';
import { getMDXComponents } from '@/components/mdx';
import type { Metadata } from 'next';
import { createRelativeLink } from 'fumadocs-ui/mdx';
import { getPageImageUrl, getPageMarkdownUrl, gitConfig } from '@/lib/shared';
import {
  absoluteUrl,
  breadcrumbLd,
  createMetadata,
  extractAccordionFaq,
  faqLd,
  organizationLd,
} from '@/lib/seo';
import { JsonLd } from '@/components/json-ld';

export default async function Page(props: PageProps<'/docs/[[...slug]]'>) {
  const params = await props.params;
  const page = source.getPage(params.slug);
  if (!page) notFound();

  const MDX = page.data.body;
  const markdownUrl = getPageMarkdownUrl(page).url;

  const crumbs = [
    { name: 'KUBUILD', path: '/' },
    { name: 'Docs', path: '/docs' },
    ...(page.url === '/docs' ? [] : [{ name: page.data.title, path: page.url }]),
  ];
  const faq = extractAccordionFaq(await page.data.getText('raw'));
  const structuredData: Record<string, unknown>[] = [
    {
      '@type': 'TechArticle',
      headline: page.data.title,
      description: page.data.description,
      url: absoluteUrl(page.url),
      image: absoluteUrl(getPageImageUrl(page).url),
      inLanguage: 'en',
      isPartOf: { '@type': 'WebSite', name: 'KUBUILD', url: absoluteUrl('/') },
      about: {
        '@type': 'SoftwareApplication',
        name: 'KUBUILD',
        applicationCategory: 'DeveloperApplication',
      },
      author: organizationLd,
      publisher: organizationLd,
      encoding: {
        '@type': 'MediaObject',
        encodingFormat: 'text/markdown',
        contentUrl: absoluteUrl(markdownUrl),
      },
    },
    breadcrumbLd(crumbs),
  ];
  if (faq.length > 0) structuredData.push(faqLd(faq));

  return (
    <DocsPage toc={page.data.toc} full={page.data.full}>
      <JsonLd data={structuredData} />
      <DocsTitle>{page.data.title}</DocsTitle>
      <DocsDescription className="mb-0">{page.data.description}</DocsDescription>
      <div className="flex flex-row gap-2 items-center border-b pb-6">
        <MarkdownCopyButton markdownUrl={markdownUrl} />
        <ViewOptionsPopover
          markdownUrl={markdownUrl}
          githubUrl={`https://github.com/${gitConfig.user}/${gitConfig.repo}/blob/${gitConfig.branch}/apps/docs/content/docs/${page.path}`}
        />
      </div>
      <DocsBody>
        <MDX
          components={getMDXComponents({
            // this allows you to link to other pages with relative file paths
            a: createRelativeLink(source, page),
          })}
        />
      </DocsBody>
    </DocsPage>
  );
}

export async function generateStaticParams() {
  return source.generateParams();
}

export async function generateMetadata(props: PageProps<'/docs/[[...slug]]'>): Promise<Metadata> {
  const params = await props.params;
  const page = source.getPage(params.slug);
  if (!page) notFound();

  return createMetadata({
    title: page.data.title,
    description: page.data.description,
    path: page.url,
    image: getPageImageUrl(page).url,
    type: 'article',
    alternates: {
      // Plain-markdown twin of the page for LLM crawlers and answer engines.
      types: { 'text/markdown': getPageMarkdownUrl(page).url },
    },
  });
}
