/**
 * @kubuild/html-import
 * Unit tests for layout and typography element mapping rules (STORA-608).
 */

import { describe, it, expect } from 'vitest';
import type { PageNode } from '@kubuild/schema';
import {
  htmlToNodes,
  importHtml,
  collapseWhitespace,
  getRawTextContent,
  convertRawTextNode,
  createRuleRegistry,
  DEFAULT_HTML_MAPPING_RULES,
} from '../src/index.js';
import { generateSemanticHtml } from '../../renderer/src/code-generator.js';

describe('Layout and Typography Mapping Rules (STORA-608)', () => {
  describe('Semantic Sections: section, header, footer, main, nav, article, aside', () => {
    it('maps section with aria-label, role, and recursive children', async () => {
      const html = `
        <section aria-label="Hero Banner" role="region" id="hero-sec">
          <h1>Welcome</h1>
          <p>Explore our products</p>
        </section>
      `;
      const result = await htmlToNodes(html);

      expect(result.success).toBe(true);
      expect(result.nodes).toHaveLength(1);

      const section = result.nodes[0];
      expect(section.type).toBe('section');
      expect(section.props?.ariaLabel).toBe('Hero Banner');
      expect(section.props?.role).toBe('region');
      expect(section.props?.id).toBe('hero-sec');

      expect(section.children).toHaveLength(2);
      expect(section.children?.[0].type).toBe('heading');
      expect(section.children?.[0].props?.level).toBe('h1');
      expect(section.children?.[0].props?.text).toBe('Welcome');

      expect(section.children?.[1].type).toBe('paragraph');
      expect(section.children?.[1].props?.text).toBe('Explore our products');
    });

    it('maps header, footer, main, nav, article, aside all to section component', async () => {
      const html = `
        <header><p>Header content</p></header>
        <nav aria-label="Main Navigation"><a href="/home">Home</a></nav>
        <main><p>Main body</p></main>
        <article><h2>Article Title</h2><p>Article body</p></article>
        <aside><p>Sidebar info</p></aside>
        <footer><p>Footer copyright</p></footer>
      `;
      const result = await htmlToNodes(html);

      expect(result.success).toBe(true);
      expect(result.nodes).toHaveLength(6);

      const [header, nav, main, article, aside, footer] = result.nodes;

      expect(header.type).toBe('section');
      expect(header.children?.[0].type).toBe('paragraph');

      expect(nav.type).toBe('section');
      expect(nav.props?.ariaLabel).toBe('Main Navigation');
      expect(nav.children?.[0].type).toBe('link');

      expect(main.type).toBe('section');
      expect(main.children?.[0].type).toBe('paragraph');

      expect(article.type).toBe('section');
      expect(article.children?.[0].type).toBe('heading');

      expect(aside.type).toBe('section');
      expect(aside.children?.[0].type).toBe('paragraph');

      expect(footer.type).toBe('section');
      expect(footer.children?.[0].type).toBe('paragraph');
    });
  });

  describe('Containers: div mapping to flex, grid, and container based on display', () => {
    it('maps div with display:flex to flex component', async () => {
      const html = '<div style="display: flex; gap: 16px"><p>Item 1</p><p>Item 2</p></div>';
      const result = await htmlToNodes(html);

      expect(result.success).toBe(true);
      expect(result.nodes).toHaveLength(1);

      const flexNode = result.nodes[0];
      expect(flexNode.type).toBe('flex');
      expect(flexNode.styles.base?.display).toBe('flex');
      expect(flexNode.children).toHaveLength(2);
      expect(flexNode.children?.[0].type).toBe('paragraph');
      expect(flexNode.children?.[1].type).toBe('paragraph');
    });

    it('maps div with display:grid to grid component', async () => {
      const html = '<div style="display: grid; grid-template-columns: 1fr 1fr"><p>Cell 1</p></div>';
      const result = await htmlToNodes(html);

      expect(result.success).toBe(true);
      expect(result.nodes).toHaveLength(1);

      const gridNode = result.nodes[0];
      expect(gridNode.type).toBe('grid');
      expect(gridNode.styles.base?.display).toBe('grid');
      expect(gridNode.children).toHaveLength(1);
      expect(gridNode.children?.[0].type).toBe('paragraph');
    });

    it('maps div with display:block or without display to container component', async () => {
      const htmlBlock = '<div style="display: block"><p>Block</p></div>';
      const resultBlock = await htmlToNodes(htmlBlock);
      expect(resultBlock.nodes[0].type).toBe('container');

      const htmlDefault = '<div><p>Default</p></div>';
      const resultDefault = await htmlToNodes(htmlDefault);
      expect(resultDefault.nodes[0].type).toBe('container');
    });

    it('extracts aria-label and role attributes on containers', async () => {
      const html = '<div aria-label="Feature Card" role="group"><h3>Card</h3></div>';
      const result = await htmlToNodes(html);

      expect(result.nodes[0].type).toBe('container');
      expect(result.nodes[0].props?.ariaLabel).toBe('Feature Card');
      expect(result.nodes[0].props?.role).toBe('group');
    });
  });

  describe('Headings: h1–h6 mapping to heading', () => {
    it('maps h1 through h6 with correct level and collapsed text', async () => {
      const html = `
        <h1>   Heading 1   </h1>
        <h2>Heading\n\t2</h2>
        <h3>Heading 3</h3>
        <h4>Heading 4</h4>
        <h5>Heading 5</h5>
        <h6>Heading 6</h6>
      `;
      const result = await htmlToNodes(html);

      expect(result.success).toBe(true);
      expect(result.nodes).toHaveLength(6);

      const levels = ['h1', 'h2', 'h3', 'h4', 'h5', 'h6'];
      for (let i = 0; i < levels.length; i++) {
        const node = result.nodes[i];
        expect(node.type).toBe('heading');
        expect(node.props?.level).toBe(levels[i]);
        expect(node.props?.text).toBe(`Heading ${i + 1}`);
        expect(node.children).toEqual([]);
      }
    });

    it('extracts text from nested child text nodes in heading', async () => {
      const html = '<h2>Title with <span>nested</span> <b>styled</b> text</h2>';
      const result = await htmlToNodes(html);

      expect(result.nodes).toHaveLength(1);
      expect(result.nodes[0].type).toBe('heading');
      expect(result.nodes[0].props?.text).toBe('Title with nested styled text');
    });
  });

  describe('Paragraphs: p mapping to paragraph', () => {
    it('maps p to paragraph with collapsed whitespace text', async () => {
      const html = '<p>This is a paragraph with   multiple \n\t spaces and lines.</p>';
      const result = await htmlToNodes(html);

      expect(result.success).toBe(true);
      expect(result.nodes).toHaveLength(1);

      const pNode = result.nodes[0];
      expect(pNode.type).toBe('paragraph');
      expect(pNode.props?.text).toBe('This is a paragraph with multiple spaces and lines.');
      expect(pNode.children).toEqual([]);
    });

    it('preserves id attribute on paragraph', async () => {
      const html = '<p id="para-lead">Lead paragraph</p>';
      const result = await htmlToNodes(html);

      expect(result.nodes[0].type).toBe('paragraph');
      expect(result.nodes[0].props?.id).toBe('para-lead');
      expect(result.nodes[0].props?.text).toBe('Lead paragraph');
    });
  });

  describe('Bare Text Nodes: whitespace collapse and edge trimming', () => {
    it('collapses whitespace sequences into single spaces via helper', () => {
      expect(collapseWhitespace('  foo   bar  \n  baz  ')).toBe('foo bar baz');
      expect(collapseWhitespace('   \n\t  ')).toBe('');
      expect(collapseWhitespace('')).toBe('');
    });

    it('ignores empty whitespace-only text nodes between block elements', async () => {
      const html = `
        <div>
          <p>Paragraph 1</p>
          <p>Paragraph 2</p>
        </div>
      `;
      const result = await htmlToNodes(html);

      expect(result.nodes).toHaveLength(1);
      const container = result.nodes[0];
      expect(container.type).toBe('container');
      // Must only contain the 2 paragraphs; indentation and newline text nodes ignored!
      expect(container.children).toHaveLength(2);
      expect(container.children?.[0].type).toBe('paragraph');
      expect(container.children?.[1].type).toBe('paragraph');
    });

    it('maps non-empty bare text node in container to text component with as: span', async () => {
      const html = '<div>Bare text in container</div>';
      const result = await htmlToNodes(html);

      expect(result.nodes).toHaveLength(1);
      const container = result.nodes[0];
      expect(container.type).toBe('container');
      expect(container.children).toHaveLength(1);

      const textNode = container.children?.[0];
      expect(textNode?.type).toBe('text');
      expect(textNode?.props?.text).toBe('Bare text in container');
      expect(textNode?.props?.as).toBe('span');
    });

    it('trims whitespace adjacent to block edges while preserving spacing between inline elements', async () => {
      const html = '<div>\n  <span>Left</span> and <span>Right</span>\n</div>';
      const result = await htmlToNodes(html);

      const container = result.nodes[0];
      // 1. span 'Left'
      // 2. bare text ' and ' (spaces between inline spans preserved!)
      // 3. span 'Right'
      expect(container.children).toHaveLength(3);
      expect(container.children?.[0].props?.text).toBe('Left');
      expect(container.children?.[1].type).toBe('text');
      expect(container.children?.[1].props?.text).toBe(' and ');
      expect(container.children?.[2].props?.text).toBe('Right');
    });
  });

  describe('Pre and Code: mapping to code-block with whitespace preserved', () => {
    it('maps pre containing code to code-block and extracts language from class', async () => {
      const codeString = 'const x = 1;\n  const y = 2;\n\nconsole.log(x + y);';
      const html = `<pre><code class="language-typescript">${codeString}</code></pre>`;
      const result = await htmlToNodes(html);

      expect(result.success).toBe(true);
      expect(result.nodes).toHaveLength(1);

      const node = result.nodes[0];
      expect(node.type).toBe('code-block');
      expect(node.props?.language).toBe('typescript');
      expect(node.props?.code).toBe(codeString);
      expect(node.children).toEqual([]);
    });

    it('maps standalone pre to code-block without collapsing indentation or newlines', async () => {
      const rawText = 'Line 1\n    Line 2 indented\nLine 3';
      const html = `<pre>${rawText}</pre>`;
      const result = await htmlToNodes(html);

      expect(result.nodes).toHaveLength(1);
      const node = result.nodes[0];
      expect(node.type).toBe('code-block');
      expect(node.props?.code).toBe(rawText);
    });

    it('maps standalone code to code-block and extracts lang- prefix', async () => {
      const html = '<code class="lang-python">import os\nprint(os.getcwd())</code>';
      const result = await htmlToNodes(html);

      expect(result.nodes).toHaveLength(1);
      const node = result.nodes[0];
      expect(node.type).toBe('code-block');
      expect(node.props?.language).toBe('python');
      expect(node.props?.code).toBe('import os\nprint(os.getcwd())');
    });

    it('extracts raw text content recursively via getRawTextContent', () => {
      expect(getRawTextContent(null as any)).toBe('');
      expect(getRawTextContent({ nodeName: '#text', value: 'hello   world\n' } as any)).toBe('hello   world\n');
    });
  });

  describe('Divider: hr mapping to divider', () => {
    it('maps hr to divider component with id support', async () => {
      const html = '<hr id="sep" />';
      const result = await htmlToNodes(html);

      expect(result.success).toBe(true);
      expect(result.nodes).toHaveLength(1);

      const node = result.nodes[0];
      expect(node.type).toBe('divider');
      expect(node.props?.id).toBe('sep');
      expect(node.children).toEqual([]);
    });
  });

  describe('Link: a mapping to link with safe URL validation', () => {
    it('maps a to link with href, target, rel, and text', async () => {
      const html = '<a href="https://kubuild.com" target="_blank" rel="noopener noreferrer">Visit KUBUILD</a>';
      const result = await htmlToNodes(html);

      expect(result.success).toBe(true);
      expect(result.nodes).toHaveLength(1);

      const link = result.nodes[0];
      expect(link.type).toBe('link');
      expect(link.props?.href).toBe('https://kubuild.com');
      expect(link.props?.target).toBe('_blank');
      expect(link.props?.rel).toBe('noopener noreferrer');
      expect(link.props?.text).toBe('Visit KUBUILD');
      expect(link.children).toEqual([]);
    });

    it('sanitizes unsafe javascript: URL to # and records URL_BLOCKED diagnostic', async () => {
      const html = '<a href="javascript:alert(\'pwned\')">Click exploit</a>';
      const result = await htmlToNodes(html);

      expect(result.nodes).toHaveLength(1);
      const link = result.nodes[0];
      expect(link.type).toBe('link');
      expect(link.props?.href).toBe('#');
      expect(link.props?.text).toBe('Click exploit');

      expect(result.report.diagnostics.some((d) => d.code === 'URL_BLOCKED')).toBe(true);
    });

    it('converts children recursively when link has child elements', async () => {
      const html = '<a href="/dashboard"><p>Go to Dashboard</p></a>';
      const result = await htmlToNodes(html);

      expect(result.nodes).toHaveLength(1);
      const link = result.nodes[0];
      expect(link.type).toBe('link');
      expect(link.props?.href).toBe('/dashboard');
      expect(link.children).toHaveLength(1);
      expect(link.children?.[0].type).toBe('paragraph');
      expect(link.children?.[0].props?.text).toBe('Go to Dashboard');
    });
  });

  describe('Blockquote: blockquote mapping', () => {
    it('maps blockquote with cite attribute and quote text', async () => {
      const html = '<blockquote cite="https://example.com/quote"><p>Simplicity is prerequisite for reliability.</p></blockquote>';
      const result = await htmlToNodes(html);

      expect(result.success).toBe(true);
      expect(result.nodes).toHaveLength(1);

      const bq = result.nodes[0];
      expect(bq.type).toBe('blockquote');
      expect(bq.props?.quote).toBe('Simplicity is prerequisite for reliability.');
      expect(bq.props?.text).toBe('Simplicity is prerequisite for reliability.');
      expect(bq.props?.cite).toBe('https://example.com/quote');
    });

    it('extracts cite from nested cite element', async () => {
      const html = '<blockquote><p>Stay hungry, stay foolish.</p><cite>Steve Jobs</cite></blockquote>';
      const result = await htmlToNodes(html);

      expect(result.nodes).toHaveLength(1);
      const bq = result.nodes[0];
      expect(bq.type).toBe('blockquote');
      expect(bq.props?.quote).toBe('Stay hungry, stay foolish.');
      expect(bq.props?.cite).toBe('Steve Jobs');
    });

    it('converts children recursively when blockquote contains complex structure', async () => {
      const html = '<blockquote><div><p>Paragraph 1</p><p>Paragraph 2</p></div></blockquote>';
      const result = await htmlToNodes(html);

      expect(result.nodes).toHaveLength(1);
      const bq = result.nodes[0];
      expect(bq.type).toBe('blockquote');
      expect(bq.children).toHaveLength(1);
      expect(bq.children?.[0].type).toBe('container');
    });
  });

  describe('Responsive Styles attachment', () => {
    it('attaches base styles and responsive breakpoint overrides to created nodes', async () => {
      const html = `
        <style>
          .hero-title {
            color: #1e293b;
            font-size: 32px;
          }
          @media (max-width: 640px) {
            .hero-title {
              font-size: 20px;
            }
          }
        </style>
        <h1 class="hero-title">Responsive Title</h1>
      `;
      const result = await htmlToNodes(html);

      expect(result.nodes).toHaveLength(1);
      const heading = result.nodes[0];
      expect(heading.type).toBe('heading');
      expect(heading.styles.base?.color).toBe('#1e293b');
      expect(heading.styles.base?.fontSize).toBe('32px');
      expect(heading.styles.mobile?.fontSize).toBe('20px');
    });
  });

  describe('Round-Trip with Code Generator (renderNodeToHtml -> htmlToNodes)', () => {
    it('round-trips heading component', async () => {
      const originalNode: PageNode = {
        id: 'heading-1',
        type: 'heading',
        props: { level: 'h2', text: 'Section Title' },
        styles: { base: { color: '#0f172a' } },
        children: [],
      };

      const html = generateSemanticHtml(originalNode, { includeNodeClasses: false });
      const result = await htmlToNodes(html);

      expect(result.nodes).toHaveLength(1);
      const imported = result.nodes[0];
      expect(imported.type).toBe('heading');
      expect(imported.props?.level).toBe('h2');
      expect(imported.props?.text).toBe('Section Title');
    });

    it('round-trips paragraph component', async () => {
      const originalNode: PageNode = {
        id: 'para-1',
        type: 'paragraph',
        props: { text: 'Round-trip paragraph testing.' },
        styles: { base: {} },
        children: [],
      };

      const html = generateSemanticHtml(originalNode, { includeNodeClasses: false });
      const result = await htmlToNodes(html);

      expect(result.nodes).toHaveLength(1);
      const imported = result.nodes[0];
      expect(imported.type).toBe('paragraph');
      expect(imported.props?.text).toBe('Round-trip paragraph testing.');
    });

    it('round-trips section with nested container, heading, and paragraph', async () => {
      const originalNode: PageNode = {
        id: 'sec-1',
        type: 'section',
        props: { ariaLabel: 'Main Section' },
        styles: { base: {} },
        children: [
          {
            id: 'cont-1',
            type: 'container',
            props: {},
            styles: { base: {} },
            children: [
              {
                id: 'h-1',
                type: 'heading',
                props: { level: 'h1', text: 'Nested Title' },
                styles: { base: {} },
                children: [],
              },
              {
                id: 'p-1',
                type: 'paragraph',
                props: { text: 'Nested paragraph' },
                styles: { base: {} },
                children: [],
              },
            ],
          },
        ],
      };

      const html = generateSemanticHtml(originalNode, { includeNodeClasses: false });
      const result = await htmlToNodes(html);

      expect(result.nodes).toHaveLength(1);
      const importedSec = result.nodes[0];
      expect(importedSec.type).toBe('section');
      expect(importedSec.props?.ariaLabel).toBe('Main Section');

      const importedCont = importedSec.children?.[0];
      expect(importedCont?.type).toBe('container');
      expect(importedCont?.children).toHaveLength(2);

      expect(importedCont?.children?.[0].type).toBe('heading');
      expect(importedCont?.children?.[0].props?.level).toBe('h1');
      expect(importedCont?.children?.[0].props?.text).toBe('Nested Title');

      expect(importedCont?.children?.[1].type).toBe('paragraph');
      expect(importedCont?.children?.[1].props?.text).toBe('Nested paragraph');
    });

    it('round-trips link component', async () => {
      const originalNode: PageNode = {
        id: 'link-1',
        type: 'link',
        props: { href: 'https://example.com/about', target: '_blank', rel: 'noopener noreferrer', text: 'About Us' },
        styles: { base: {} },
        children: [],
      };

      const html = generateSemanticHtml(originalNode, { includeNodeClasses: false });
      const result = await htmlToNodes(html);

      expect(result.nodes).toHaveLength(1);
      const imported = result.nodes[0];
      expect(imported.type).toBe('link');
      expect(imported.props?.href).toBe('https://example.com/about');
      expect(imported.props?.target).toBe('_blank');
      expect(imported.props?.text).toBe('About Us');
    });

    it('round-trips divider component', async () => {
      const originalNode: PageNode = {
        id: 'div-1',
        type: 'divider',
        props: {},
        styles: { base: {} },
        children: [],
      };

      const html = generateSemanticHtml(originalNode, { includeNodeClasses: false });
      const result = await htmlToNodes(html);

      expect(result.nodes).toHaveLength(1);
      expect(result.nodes[0].type).toBe('divider');
    });

    it('round-trips code-block component', async () => {
      const originalNode: PageNode = {
        id: 'code-1',
        type: 'code-block',
        props: { code: 'const answer = 42;\nexport default answer;', language: 'javascript' },
        styles: { base: {} },
        children: [],
      };

      const html = generateSemanticHtml(originalNode, { includeNodeClasses: false });
      const result = await htmlToNodes(html);

      expect(result.nodes).toHaveLength(1);
      const imported = result.nodes[0];
      expect(imported.type).toBe('code-block');
      expect(imported.props?.code).toBe('const answer = 42;\nexport default answer;');
      expect(imported.props?.language).toBe('javascript');
    });

    it('round-trips blockquote component', async () => {
      const originalNode: PageNode = {
        id: 'bq-1',
        type: 'blockquote',
        props: { quote: 'Simplicity is beauty.', cite: 'Designer' },
        styles: { base: {} },
        children: [],
      };

      const html = generateSemanticHtml(originalNode, { includeNodeClasses: false });
      const result = await htmlToNodes(html);

      expect(result.nodes).toHaveLength(1);
      const imported = result.nodes[0];
      expect(imported.type).toBe('blockquote');
      expect(imported.props?.quote).toBe('Simplicity is beauty.');
      expect(imported.props?.cite).toBe('Designer');
    });
  });

  describe('importHtml integration', () => {
    it('creates a complete PageDocument with document.type: page containing mapped nodes', async () => {
      const html = `
        <!DOCTYPE html>
        <html lang="en">
          <head>
            <title>My Landing Page</title>
            <meta name="description" content="Landing page description" />
            <style>
              body { background-color: #f8fafc; }
            </style>
          </head>
          <body>
            <header>
              <h1>Hero Title</h1>
              <p>Hero subtitle</p>
            </header>
            <main>
              <section aria-label="Features">
                <hr />
                <p>Features list</p>
              </section>
            </main>
          </body>
        </html>
      `;
      const result = await importHtml(html);

      expect(result.success).toBe(true);
      expect(result.document).toBeDefined();

      const doc = result.document!;
      expect(doc.schema).toBe('stora.page');
      expect(doc.metadata?.title).toBe('My Landing Page');
      expect(doc.metadata?.description).toBe('Landing page description');

      const rootPage = doc.document;
      expect(rootPage.type).toBe('page');
      expect(rootPage.children).toHaveLength(2);

      const [header, main] = rootPage.children!;
      expect(header.type).toBe('section');
      expect(header.children).toHaveLength(2);
      expect(header.children?.[0].type).toBe('heading');
      expect(header.children?.[1].type).toBe('paragraph');

      expect(main.type).toBe('section');
      expect(main.children?.[0].type).toBe('section');
      expect(main.children?.[0].children?.[0].type).toBe('divider');
      expect(main.children?.[0].children?.[1].type).toBe('paragraph');
    });
  });
});
