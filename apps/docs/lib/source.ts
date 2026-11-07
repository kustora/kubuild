import { llms, loader } from 'fumadocs-core/source';
import { lucideIconsPlugin } from 'fumadocs-core/source/lucide-icons';
import { docsRoute, getPageMarkdownUrl, siteUrl } from './shared';
import { defineDocs } from 'fumadocs-mdx/macro';
import { applyMdxPreset } from 'fumadocs-mdx/config';
import { remarkMdxMermaid } from 'fumadocs-core/mdx-plugins';
import { metaSchema, pageSchema } from 'fumadocs-core/source/schema';

const docs = defineDocs({
  dir: 'content/docs',
  docs: {
    schema: pageSchema,
    mdxOptions: applyMdxPreset({
      remarkPlugins: (plugins) => [remarkMdxMermaid, ...plugins],
    }),
    postprocess: {
      includeProcessedMarkdown: true,
    },
  },
  meta: {
    schema: metaSchema,
  },
});

// See https://fumadocs.dev/docs/headless/source-api for more info
export const source = loader({
  baseUrl: docsRoute,
  source: docs.toFumadocsSource(),
  plugins: [lucideIconsPlugin()],
});

export const docsLlms = llms(source, {
  renderName: (item) => {
    if (item.type === undefined || item.type === 'root') return 'KUBUILD';
    if (item.type === 'page') return source.getNodePage(item)?.data.title ?? '';
    return typeof item.name === 'string' ? item.name : '';
  },
  renderDescription: (item) => {
    if (item.type === undefined || item.type === 'root') {
      return "KUBUILD is an open-source (MIT) page builder engine for React apps by Kustora. It provides a visual editor (@kubuild/editor), a lightweight server-renderable renderer (@kubuild/renderer), a framework-free TypeScript core (@kubuild/core), and Zod schemas (@kubuild/schema) for a portable JSON page format called .stora. Pages are stored in the host app's own database and rendered anywhere, with no vendor lock-in.";
    }
    if (item.type === 'page') return source.getNodePage(item)?.data.description ?? '';
    return typeof item.description === 'string' ? item.description : '';
  },
  // Link to each page's markdown twin so agents fetch clean text instead of HTML.
  renderUrl: (item) => {
    const page = source.getNodePage(item);
    return page
      ? new URL(getPageMarkdownUrl(page).url, siteUrl).toString()
      : new URL(item.url, siteUrl).toString();
  },
  renderPage: async (page) => `# ${page.data.title}

Source: ${new URL(page.url, siteUrl)}

> ${page.data.description ?? ''}

${await page.data.getText('processed')}`,
});
