/**
 * @kubuild/html-import
 * Unit tests for media, form, list, and table mapping rules (STORA-610).
 */

import { describe, it, expect } from 'vitest';
import type { PageNode } from '@kubuild/schema';
import {
  htmlToNodes,
  parseSrcset,
  pickBestSrcsetCandidate,
  isYouTubeOrVimeoUrl,
  hasButtonClass,
  DEFAULT_HTML_MAPPING_RULES,
  DEFAULT_MEDIA_FORM_DATA_RULES,
} from '../src/index.js';
import { generateSemanticHtml } from '../../renderer/src/code-generator.js';

describe('Media, Form, List, and Table Mapping Rules (STORA-610)', () => {
  describe('Rule Registration and Exports', () => {
    it('exports all media, form, list, and table rules in DEFAULT_MEDIA_FORM_DATA_RULES', () => {
      expect(Array.isArray(DEFAULT_MEDIA_FORM_DATA_RULES)).toBe(true);
      expect(DEFAULT_MEDIA_FORM_DATA_RULES.length).toBeGreaterThanOrEqual(15);

      const ruleIds = DEFAULT_MEDIA_FORM_DATA_RULES.map((r) => r.id);
      expect(ruleIds).toContain('image');
      expect(ruleIds).toContain('picture');
      expect(ruleIds).toContain('video');
      expect(ruleIds).toContain('iframe-video');
      expect(ruleIds).toContain('form');
      expect(ruleIds).toContain('input');
      expect(ruleIds).toContain('textarea');
      expect(ruleIds).toContain('select');
      expect(ruleIds).toContain('button');
      expect(ruleIds).toContain('button-link');
      expect(ruleIds).toContain('form-label');
      expect(ruleIds).toContain('list');
      expect(ruleIds).toContain('list-item');
      expect(ruleIds).toContain('table');
      expect(ruleIds).toContain('table-row');
      expect(ruleIds).toContain('table-cell');
      expect(ruleIds).toContain('svg-icon');
    });

    it('registers media, form, list, and table rules in DEFAULT_HTML_MAPPING_RULES', () => {
      const allIds = DEFAULT_HTML_MAPPING_RULES.map((r) => r.id);
      expect(allIds).toContain('image');
      expect(allIds).toContain('video');
      expect(allIds).toContain('form');
      expect(allIds).toContain('table');
      expect(allIds).toContain('list');
    });
  });

  describe('Srcset & Utility Functions', () => {
    it('parses width and pixel density descriptors in srcset', () => {
      const srcset = 'small.jpg 300w, medium.jpg 600w, large.jpg 1200w';
      const parsed = parseSrcset(srcset);
      expect(parsed).toEqual([
        { url: 'small.jpg', weight: 300 },
        { url: 'medium.jpg', weight: 600 },
        { url: 'large.jpg', weight: 1200 },
      ]);
      expect(pickBestSrcsetCandidate(srcset)).toBe('large.jpg');
    });

    it('parses pixel density descriptors (1x, 2x)', () => {
      const srcset = 'img.png 1x, img@2x.png 2x';
      const parsed = parseSrcset(srcset);
      expect(parsed).toEqual([
        { url: 'img.png', weight: 1000 },
        { url: 'img@2x.png', weight: 2000 },
      ]);
      expect(pickBestSrcsetCandidate(srcset)).toBe('img@2x.png');
    });

    it('identifies YouTube and Vimeo URLs accurately', () => {
      expect(isYouTubeOrVimeoUrl('https://www.youtube.com/embed/dQw4w9WgXcQ')).toBe(true);
      expect(isYouTubeOrVimeoUrl('https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ')).toBe(true);
      expect(isYouTubeOrVimeoUrl('https://youtu.be/dQw4w9WgXcQ')).toBe(true);
      expect(isYouTubeOrVimeoUrl('https://player.vimeo.com/video/76979871')).toBe(true);
      expect(isYouTubeOrVimeoUrl('https://vimeo.com/76979871')).toBe(true);
      expect(isYouTubeOrVimeoUrl('https://example.com/embed/video')).toBe(false);
      expect(isYouTubeOrVimeoUrl('https://maps.google.com/maps')).toBe(false);
    });

    it('detects button classes accurately', () => {
      expect(hasButtonClass('btn')).toBe(true);
      expect(hasButtonClass('btn-primary')).toBe(true);
      expect(hasButtonClass('header-button')).toBe(true);
      expect(hasButtonClass('main-nav-link btn')).toBe(true);
      expect(hasButtonClass('navigation-bar')).toBe(false);
    });
  });

  describe('Media Rules: img, picture, video, iframe, svg', () => {
    it('maps <img> element with src, alt, and loading', async () => {
      const html = '<img src="https://example.com/banner.png" alt="Company Banner" loading="eager" width="800" height="400" id="hero-img" />';
      const result = await htmlToNodes(html);

      expect(result.success).toBe(true);
      expect(result.nodes).toHaveLength(1);

      const node = result.nodes[0];
      expect(node.type).toBe('image');
      expect(node.props?.src).toBe('https://example.com/banner.png');
      expect(node.props?.alt).toBe('Company Banner');
      expect(node.props?.loading).toBe('eager');
      expect(node.props?.width).toBe(800);
      expect(node.props?.height).toBe(400);
      expect(node.props?.id).toBe('hero-img');
      expect(node.styles).toBeDefined();
    });

    it('picks highest resolution candidate from <img> srcset', async () => {
      const html = '<img src="thumb.jpg" srcset="thumb.jpg 150w, mid.jpg 600w, hi-res.jpg 1200w" alt="Responsive Pic" />';
      const result = await htmlToNodes(html);

      expect(result.success).toBe(true);
      expect(result.nodes).toHaveLength(1);

      const node = result.nodes[0];
      expect(node.type).toBe('image');
      expect(node.props?.src).toBe('hi-res.jpg');
      expect(node.props?.alt).toBe('Responsive Pic');
    });

    it('maps <picture> with <source srcset> and inner <img> to image component', async () => {
      const html = `
        <picture id="responsive-pic">
          <source srcset="large.webp 1200w, huge.webp 2000w" type="image/webp" />
          <source srcset="large.jpg 1200w" type="image/jpeg" />
          <img src="fallback.jpg" alt="Nature Landscape" loading="lazy" />
        </picture>
      `;
      const result = await htmlToNodes(html);

      expect(result.success).toBe(true);
      expect(result.nodes).toHaveLength(1);

      const node = result.nodes[0];
      expect(node.type).toBe('image');
      expect(node.props?.src).toBe('huge.webp');
      expect(node.props?.alt).toBe('Nature Landscape');
      expect(node.props?.loading).toBe('lazy');
      expect(node.props?.id).toBe('responsive-pic');
    });

    it('blocks unsafe URL schemes in images and emits URL_BLOCKED diagnostic', async () => {
      const html = '<img src="javascript:alert(1)" alt="Malicious" />';
      const result = await htmlToNodes(html);

      expect(result.success).toBe(true);
      const node = result.nodes[0];
      expect(node.type).toBe('image');
      expect(node.props?.src).toBe('');

      const blockedDiag = result.report.diagnostics.find((d) => d.code === 'URL_BLOCKED');
      expect(blockedDiag).toBeDefined();
      expect(blockedDiag?.severity).toBe('warning');
    });

    it('maps <video> with controls, poster, autoplay, loop, and muted', async () => {
      const html = '<video src="https://example.com/intro.mp4" poster="https://example.com/poster.jpg" controls autoplay loop muted id="intro-vid"></video>';
      const result = await htmlToNodes(html);

      expect(result.success).toBe(true);
      expect(result.nodes).toHaveLength(1);

      const node = result.nodes[0];
      expect(node.type).toBe('video');
      expect(node.props?.src).toBe('https://example.com/intro.mp4');
      expect(node.props?.poster).toBe('https://example.com/poster.jpg');
      expect(node.props?.controls).toBe(true);
      expect(node.props?.autoplay).toBe(true);
      expect(node.props?.loop).toBe(true);
      expect(node.props?.muted).toBe(true);
      expect(node.props?.id).toBe('intro-vid');
    });

    it('extracts video src from nested <source src="..."> child', async () => {
      const html = `
        <video controls>
          <source src="trailer.mp4" type="video/mp4" />
          <source src="trailer.webm" type="video/webm" />
        </video>
      `;
      const result = await htmlToNodes(html);

      expect(result.success).toBe(true);
      expect(result.nodes).toHaveLength(1);

      const node = result.nodes[0];
      expect(node.type).toBe('video');
      expect(node.props?.src).toBe('trailer.mp4');
      expect(node.props?.controls).toBe(true);
    });

    it('maps YouTube and Vimeo <iframe> elements to video component', async () => {
      const html = `
        <iframe src="https://www.youtube.com/embed/dQw4w9WgXcQ" title="Rick Astley" width="560" height="315"></iframe>
        <iframe src="https://player.vimeo.com/video/76979871" title="Vimeo Reel"></iframe>
      `;
      const result = await htmlToNodes(html);

      expect(result.success).toBe(true);
      expect(result.nodes).toHaveLength(2);

      const [ytNode, vmNode] = result.nodes;
      expect(ytNode.type).toBe('video');
      expect(ytNode.props?.src).toBe('https://www.youtube.com/embed/dQw4w9WgXcQ');
      expect(ytNode.props?.title).toBe('Rick Astley');

      expect(vmNode.type).toBe('video');
      expect(vmNode.props?.src).toBe('https://player.vimeo.com/video/76979871');
      expect(vmNode.props?.title).toBe('Vimeo Reel');
    });

    it('leaves non-YouTube/Vimeo <iframe> for fallback embed', async () => {
      const html = '<iframe src="https://example.com/widget" title="Widget"></iframe>';
      const result = await htmlToNodes(html, { fallback: 'embed' });

      expect(result.success).toBe(true);
      expect(result.nodes).toHaveLength(1);
      expect(result.nodes[0].type).toBe('html-embed');
    });

    it('maps simple <svg> to icon component with serialized svg content', async () => {
      const html = '<svg viewBox="0 0 24 24" aria-label="Star icon" id="star-svg"><path d="M12 2l3.09 6.26L22 9.27"></path></svg>';
      const result = await htmlToNodes(html);

      expect(result.success).toBe(true);
      expect(result.nodes).toHaveLength(1);

      const node = result.nodes[0];
      expect(node.type).toBe('icon');
      expect(typeof node.props?.svg).toBe('string');
      expect(node.props?.svg).toContain('<path');
      expect(node.props?.ariaLabel).toBe('Star icon');
      expect(node.props?.id).toBe('star-svg');
    });
  });

  describe('Form Rules: form, input, textarea, select, button', () => {
    it('maps <form> with action and records diagnostic info (form action not automatically executable)', async () => {
      const html = `
        <form action="https://api.example.com/v1/submit" method="post" id="contact-form">
          <input type="text" name="fullName" placeholder="Your Name" />
        </form>
      `;
      const result = await htmlToNodes(html);

      expect(result.success).toBe(true);
      expect(result.nodes).toHaveLength(1);

      const formNode = result.nodes[0];
      expect(formNode.type).toBe('form');
      expect(formNode.props?.action).toBe('https://api.example.com/v1/submit');
      expect(formNode.props?.method).toBe('POST');
      expect(formNode.props?.id).toBe('contact-form');
      expect(formNode.children).toHaveLength(1);
      expect(formNode.children?.[0].type).toBe('input');

      const actionDiag = result.report.diagnostics.find(
        (d) => d.severity === 'info' && d.message.includes('form action not automatically executable'),
      );
      expect(actionDiag).toBeDefined();
      expect(actionDiag?.details?.action).toBe('https://api.example.com/v1/submit');
    });

    it('maps text-like <input> elements with attributes', async () => {
      const html = '<input type="email" name="userEmail" placeholder="you@domain.com" value="test@domain.com" required disabled id="email-in" />';
      const result = await htmlToNodes(html);

      expect(result.success).toBe(true);
      expect(result.nodes).toHaveLength(1);

      const node = result.nodes[0];
      expect(node.type).toBe('input');
      expect(node.props?.type).toBe('email');
      expect(node.props?.name).toBe('userEmail');
      expect(node.props?.placeholder).toBe('you@domain.com');
      expect(node.props?.value).toBe('test@domain.com');
      expect(node.props?.required).toBe(true);
      expect(node.props?.disabled).toBe(true);
      expect(node.props?.id).toBe('email-in');
    });

    it('maps <input type="submit"> to button-submit and <input type="button"> to button', async () => {
      const html = `
        <input type="submit" value="Send Message" disabled />
        <input type="button" value="Cancel Action" id="cancel-btn" />
      `;
      const result = await htmlToNodes(html);

      expect(result.success).toBe(true);
      expect(result.nodes).toHaveLength(2);

      const [submitNode, btnNode] = result.nodes;
      expect(submitNode.type).toBe('button-submit');
      expect(submitNode.props?.label).toBe('Send Message');
      expect(submitNode.props?.buttonType).toBe('submit');
      expect(submitNode.props?.disabled).toBe(true);

      expect(btnNode.type).toBe('button');
      expect(btnNode.props?.label).toBe('Cancel Action');
      expect(btnNode.props?.type).toBe('button');
      expect(btnNode.props?.id).toBe('cancel-btn');
    });

    it('maps standalone <input type="checkbox"> and <input type="radio">', async () => {
      const html = `
        <input type="checkbox" name="agree" checked aria-label="I agree to terms" />
        <input type="radio" name="plan" value="pro" checked aria-label="Pro Tier" />
      `;
      const result = await htmlToNodes(html);

      expect(result.success).toBe(true);
      expect(result.nodes).toHaveLength(2);

      const [cbNode, radioNode] = result.nodes;
      expect(cbNode.type).toBe('checkbox');
      expect(cbNode.props?.name).toBe('agree');
      expect(cbNode.props?.checked).toBe(true);
      expect(cbNode.props?.label).toBe('I agree to terms');

      expect(radioNode.type).toBe('radio');
      expect(radioNode.props?.name).toBe('plan');
      expect(radioNode.props?.value).toBe('pro');
      expect(radioNode.props?.checked).toBe(true);
      expect(radioNode.props?.label).toBe('Pro Tier');
    });

    it('unwraps <label> containing checkbox or radio cleanly', async () => {
      const html = `
        <label class="kb-checkbox-label">
          <input type="checkbox" name="newsletter" checked />
          <span>Subscribe to weekly newsletter</span>
        </label>
        <label class="kb-radio-label">
          <input type="radio" name="freq" value="daily" checked />
          <span>Daily digest</span>
        </label>
      `;
      const result = await htmlToNodes(html);

      expect(result.success).toBe(true);
      expect(result.nodes).toHaveLength(2);

      const [cbNode, radioNode] = result.nodes;
      expect(cbNode.type).toBe('checkbox');
      expect(cbNode.props?.name).toBe('newsletter');
      expect(cbNode.props?.checked).toBe(true);
      expect(cbNode.props?.label).toBe('Subscribe to weekly newsletter');

      expect(radioNode.type).toBe('radio');
      expect(radioNode.props?.name).toBe('freq');
      expect(radioNode.props?.value).toBe('daily');
      expect(radioNode.props?.checked).toBe(true);
      expect(radioNode.props?.label).toBe('Daily digest');
    });

    it('maps <textarea> with name, placeholder, rows, value, required, disabled', async () => {
      const html = '<textarea name="comments" placeholder="Write feedback here" rows="6" required disabled id="feedback-ta">Initial user comment</textarea>';
      const result = await htmlToNodes(html);

      expect(result.success).toBe(true);
      expect(result.nodes).toHaveLength(1);

      const node = result.nodes[0];
      expect(node.type).toBe('textarea');
      expect(node.props?.name).toBe('comments');
      expect(node.props?.placeholder).toBe('Write feedback here');
      expect(node.props?.rows).toBe(6);
      expect(node.props?.value).toBe('Initial user comment');
      expect(node.props?.required).toBe(true);
      expect(node.props?.disabled).toBe(true);
      expect(node.props?.id).toBe('feedback-ta');
    });

    it('maps <select> with nested <option> tags and extracts options list', async () => {
      const html = `
        <select name="country" required disabled id="country-sel">
          <option value="id">Indonesia</option>
          <option value="us" selected>United States</option>
          <option value="jp">Japan</option>
        </select>
      `;
      const result = await htmlToNodes(html);

      expect(result.success).toBe(true);
      expect(result.nodes).toHaveLength(1);

      const node = result.nodes[0];
      expect(node.type).toBe('select');
      expect(node.props?.name).toBe('country');
      expect(node.props?.required).toBe(true);
      expect(node.props?.disabled).toBe(true);
      expect(node.props?.value).toBe('us');
      expect(node.props?.id).toBe('country-sel');
      expect(node.props?.options).toEqual([
        { value: 'id', label: 'Indonesia' },
        { value: 'us', label: 'United States' },
        { value: 'jp', label: 'Japan' },
      ]);
    });

    it('maps <button type="submit"> to button-submit and other buttons to button', async () => {
      const html = `
        <button type="submit" id="submit-btn">Submit Order</button>
        <button type="button" id="click-btn">Click Me</button>
        <button disabled>Default Button</button>
      `;
      const result = await htmlToNodes(html);

      expect(result.success).toBe(true);
      expect(result.nodes).toHaveLength(3);

      const [submitBtn, clickBtn, defaultBtn] = result.nodes;
      expect(submitBtn.type).toBe('button-submit');
      expect(submitBtn.props?.label).toBe('Submit Order');
      expect(submitBtn.props?.buttonType).toBe('submit');
      expect(submitBtn.props?.id).toBe('submit-btn');

      expect(clickBtn.type).toBe('button');
      expect(clickBtn.props?.label).toBe('Click Me');
      expect(clickBtn.props?.type).toBe('button');
      expect(clickBtn.props?.id).toBe('click-btn');

      expect(defaultBtn.type).toBe('button');
      expect(defaultBtn.props?.label).toBe('Default Button');
      expect(defaultBtn.props?.disabled).toBe(true);
    });
  });

  describe('Button Styling Heuristic for <a> Elements', () => {
    it('maps <a> with class "btn" to button component', async () => {
      const html = '<a class="btn btn-primary" href="/get-started" id="cta-link">Get Started</a>';
      const result = await htmlToNodes(html);

      expect(result.success).toBe(true);
      expect(result.nodes).toHaveLength(1);

      const node = result.nodes[0];
      expect(node.type).toBe('button');
      expect(node.props?.label).toBe('Get Started');
      expect(node.props?.href).toBe('/get-started');
      expect(node.props?.link).toBe('/get-started');
      expect(node.props?.id).toBe('cta-link');
    });

    it('maps <a> with role="button" to button component', async () => {
      const html = '<a role="button" href="/dashboard">Go to Dashboard</a>';
      const result = await htmlToNodes(html);

      expect(result.success).toBe(true);
      expect(result.nodes).toHaveLength(1);

      const node = result.nodes[0];
      expect(node.type).toBe('button');
      expect(node.props?.label).toBe('Go to Dashboard');
      expect(node.props?.href).toBe('/dashboard');
    });

    it('maps <a> with both background color and padding styles to button component', async () => {
      const html = '<a href="/contact" style="background-color: #2563eb; padding: 12px 24px;">Contact Us</a>';
      const result = await htmlToNodes(html);

      expect(result.success).toBe(true);
      expect(result.nodes).toHaveLength(1);

      const node = result.nodes[0];
      expect(node.type).toBe('button');
      expect(node.props?.label).toBe('Contact Us');
      expect(node.props?.href).toBe('/contact');
    });

    it('preserves <a> as link when options.preserveButtonLinks is true', async () => {
      const html = '<a class="btn btn-primary" href="/signup">Sign Up</a>';
      const result = await htmlToNodes(html, { preserveButtonLinks: true });

      expect(result.success).toBe(true);
      expect(result.nodes).toHaveLength(1);

      const node = result.nodes[0];
      expect(node.type).toBe('link');
      expect(node.props?.href).toBe('/signup');
      expect(node.props?.text).toBe('Sign Up');
    });

    it('keeps ordinary <a> as link component when button heuristics do not apply', async () => {
      const html = '<a href="/privacy-policy">Privacy Policy</a>';
      const result = await htmlToNodes(html);

      expect(result.success).toBe(true);
      expect(result.nodes).toHaveLength(1);

      const node = result.nodes[0];
      expect(node.type).toBe('link');
      expect(node.props?.href).toBe('/privacy-policy');
      expect(node.props?.text).toBe('Privacy Policy');
    });
  });

  describe('List Rules: ul, ol, li', () => {
    it('maps <ul> and <li> to list and list-item with ordered=false', async () => {
      const html = `
        <ul id="features-list">
          <li>Fast compilation</li>
          <li>Secure AST sanitizer</li>
          <li>Rich layout mapping</li>
        </ul>
      `;
      const result = await htmlToNodes(html);

      expect(result.success).toBe(true);
      expect(result.nodes).toHaveLength(1);

      const listNode = result.nodes[0];
      expect(listNode.type).toBe('list');
      expect(listNode.props?.ordered).toBe(false);
      expect(listNode.props?.tag).toBe('ul');
      expect(listNode.props?.id).toBe('features-list');
      expect(listNode.children).toHaveLength(3);

      expect(listNode.children?.[0].type).toBe('list-item');
      expect(listNode.children?.[0].props?.text).toBe('Fast compilation');

      expect(listNode.children?.[1].type).toBe('list-item');
      expect(listNode.children?.[1].props?.text).toBe('Secure AST sanitizer');

      expect(listNode.children?.[2].type).toBe('list-item');
      expect(listNode.children?.[2].props?.text).toBe('Rich layout mapping');
    });

    it('maps <ol> to list with ordered=true', async () => {
      const html = `
        <ol id="steps-list">
          <li>Step one</li>
          <li>Step two</li>
        </ol>
      `;
      const result = await htmlToNodes(html);

      expect(result.success).toBe(true);
      expect(result.nodes).toHaveLength(1);

      const listNode = result.nodes[0];
      expect(listNode.type).toBe('list');
      expect(listNode.props?.ordered).toBe(true);
      expect(listNode.props?.tag).toBe('ol');
      expect(listNode.children).toHaveLength(2);
      expect(listNode.children?.[0].props?.text).toBe('Step one');
      expect(listNode.children?.[1].props?.text).toBe('Step two');
    });

    it('converts <li> with complex child elements recursively', async () => {
      const html = `
        <ul>
          <li><a href="/feature-1">Feature 1 Link</a></li>
          <li><p>Feature 2 Description</p></li>
        </ul>
      `;
      const result = await htmlToNodes(html);

      expect(result.success).toBe(true);
      const listNode = result.nodes[0];
      expect(listNode.children).toHaveLength(2);

      const li1 = listNode.children?.[0];
      expect(li1?.type).toBe('list-item');
      expect(li1?.children?.[0].type).toBe('link');
      expect(li1?.children?.[0].props?.href).toBe('/feature-1');

      const li2 = listNode.children?.[1];
      expect(li2?.type).toBe('list-item');
      expect(li2?.children?.[0].type).toBe('paragraph');
    });
  });

  describe('Table Rules: table, thead, tbody, tfoot, tr, td, th', () => {
    it('maps <table> with <thead> and <tbody>, flattening rows cleanly', async () => {
      const html = `
        <table id="pricing-table" aria-label="Pricing tiers">
          <thead>
            <tr>
              <th>Plan</th>
              <th>Price</th>
              <th>Features</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Starter</td>
              <td>$10</td>
              <td>Basic features</td>
            </tr>
            <tr>
              <td>Enterprise</td>
              <td>$99</td>
              <td>All features</td>
            </tr>
          </tbody>
        </table>
      `;
      const result = await htmlToNodes(html);

      expect(result.success).toBe(true);
      expect(result.nodes).toHaveLength(1);

      const tableNode = result.nodes[0];
      expect(tableNode.type).toBe('table');
      expect(tableNode.props?.id).toBe('pricing-table');
      expect(tableNode.props?.ariaLabel).toBe('Pricing tiers');

      // The 1 header row + 2 body rows = 3 rows flattened
      expect(tableNode.children).toHaveLength(3);
      for (const row of tableNode.children ?? []) {
        expect(row.type).toBe('table-row');
      }

      const headerRow = tableNode.children?.[0];
      expect(headerRow?.children).toHaveLength(3);
      expect(headerRow?.children?.[0].type).toBe('table-cell');
      expect(headerRow?.children?.[0].props?.isHeader).toBe(true);
      expect(headerRow?.children?.[0].props?.text).toBe('Plan');

      const dataRow = tableNode.children?.[1];
      expect(dataRow?.children).toHaveLength(3);
      expect(dataRow?.children?.[0].type).toBe('table-cell');
      expect(dataRow?.children?.[0].props?.isHeader).toBe(false);
      expect(dataRow?.children?.[0].props?.text).toBe('Starter');
    });

    it('maps <td> and <th> attributes including colspan and rowspan', async () => {
      const html = `
        <table>
          <tr>
            <th colspan="2">Merged Header</th>
            <td rowspan="3">Span 3 Rows</td>
          </tr>
        </table>
      `;
      const result = await htmlToNodes(html);

      expect(result.success).toBe(true);
      const cell1 = result.nodes[0].children?.[0].children?.[0];
      const cell2 = result.nodes[0].children?.[0].children?.[1];

      expect(cell1?.type).toBe('table-cell');
      expect(cell1?.props?.isHeader).toBe(true);
      expect(cell1?.props?.colSpan).toBe(2);

      expect(cell2?.type).toBe('table-cell');
      expect(cell2?.props?.isHeader).toBe(false);
      expect(cell2?.props?.rowSpan).toBe(3);
    });
  });

  describe('Round-trip Compatibility with Code-generator Output', () => {
    it('round-trips image component generated by code-generator', async () => {
      const originalNode: PageNode = {
        id: 'img-node-1',
        type: 'image',
        props: {
          src: 'https://images.unsplash.com/photo-1?w=800',
          alt: 'Sunset Mountain',
          loading: 'lazy',
        },
        styles: { base: { maxWidth: '100%' } },
        children: [],
      };

      const html = generateSemanticHtml(originalNode);
      const result = await htmlToNodes(html);

      expect(result.success).toBe(true);
      expect(result.nodes).toHaveLength(1);

      const imported = result.nodes[0];
      expect(imported.type).toBe('image');
      expect(imported.props?.src).toBe(originalNode.props?.src);
      expect(imported.props?.alt).toBe(originalNode.props?.alt);
      expect(imported.props?.loading).toBe('lazy');
    });

    it('round-trips video component (HTML5) generated by code-generator', async () => {
      const originalNode: PageNode = {
        id: 'vid-node-1',
        type: 'video',
        props: {
          src: 'https://cdn.example.com/movie.mp4',
          poster: 'https://cdn.example.com/poster.jpg',
          controls: true,
          autoplay: false,
          loop: false,
          muted: false,
        },
        styles: { base: { width: '100%' } },
        children: [],
      };

      const html = generateSemanticHtml(originalNode);
      const result = await htmlToNodes(html);

      expect(result.success).toBe(true);
      expect(result.nodes).toHaveLength(1);

      const imported = result.nodes[0];
      expect(imported.type).toBe('video');
      expect(imported.props?.src).toBe(originalNode.props?.src);
      expect(imported.props?.poster).toBe(originalNode.props?.poster);
      expect(imported.props?.controls).toBe(true);
    });

    it('round-trips YouTube iframe generated by code-generator into video component', async () => {
      const originalNode: PageNode = {
        id: 'yt-vid-1',
        type: 'video',
        props: {
          src: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
          title: 'Never Gonna Give You Up',
        },
        styles: { base: {} },
        children: [],
      };

      const html = generateSemanticHtml(originalNode);
      const result = await htmlToNodes(html);

      expect(result.success).toBe(true);
      // Code generator wraps youtube iframe in a wrapper div: <div class="kb-video-wrapper"><iframe>...</iframe></div>
      // Div maps to container/flex, inside which iframe maps to video
      const rootNode = result.nodes[0];
      const videoNode = rootNode.type === 'video' ? rootNode : rootNode.children?.[0];

      expect(videoNode).toBeDefined();
      expect(videoNode?.type).toBe('video');
      expect(String(videoNode?.props?.src)).toContain('dQw4w9WgXcQ');
      expect(videoNode?.props?.title).toBe('Never Gonna Give You Up');
    });

    it('round-trips form, input, textarea, select, and button generated by code-generator', async () => {
      const originalForm: PageNode = {
        id: 'test-form',
        type: 'form',
        props: {
          action: '/api/contact',
          method: 'POST',
        },
        styles: { base: {} },
        children: [
          {
            id: 'in-name',
            type: 'input',
            props: { type: 'text', name: 'name', placeholder: 'Your Name', value: 'Alice' },
            styles: { base: {} },
            children: [],
          },
          {
            id: 'ta-msg',
            type: 'textarea',
            props: { name: 'message', placeholder: 'Message...', rows: 4, value: 'Hello KUBUILD' },
            styles: { base: {} },
            children: [],
          },
          {
            id: 'sel-role',
            type: 'select',
            props: {
              name: 'role',
              options: [
                { value: 'dev', label: 'Developer' },
                { value: 'des', label: 'Designer' },
              ],
            },
            styles: { base: {} },
            children: [],
          },
          {
            id: 'btn-submit',
            type: 'button',
            props: { label: 'Submit Form', type: 'submit' },
            styles: { base: {} },
            children: [],
          },
        ],
      };

      const html = generateSemanticHtml(originalForm);
      const result = await htmlToNodes(html);

      expect(result.success).toBe(true);
      expect(result.nodes).toHaveLength(1);

      const form = result.nodes[0];
      expect(form.type).toBe('form');
      expect(form.props?.action).toBe('/api/contact');
      expect(form.props?.method).toBe('POST');
      expect(form.children).toHaveLength(4);

      const [inputNode, taNode, selNode, btnNode] = form.children ?? [];
      expect(inputNode.type).toBe('input');
      expect(inputNode.props?.name).toBe('name');
      expect(inputNode.props?.placeholder).toBe('Your Name');
      expect(inputNode.props?.value).toBe('Alice');

      expect(taNode.type).toBe('textarea');
      expect(taNode.props?.name).toBe('message');
      expect(taNode.props?.value).toBe('Hello KUBUILD');

      expect(selNode.type).toBe('select');
      expect(selNode.props?.name).toBe('role');
      expect(selNode.props?.options).toEqual([
        { value: 'dev', label: 'Developer' },
        { value: 'des', label: 'Designer' },
      ]);

      expect(btnNode.type).toBe('button-submit');
      expect(btnNode.props?.label).toBe('Submit Form');
    });

    it('round-trips list and list-item generated by code-generator', async () => {
      const originalList: PageNode = {
        id: 'list-1',
        type: 'list',
        props: { ordered: true, tag: 'ol' },
        styles: { base: {} },
        children: [
          {
            id: 'li-1',
            type: 'list-item',
            props: { text: 'Item 1' },
            styles: { base: {} },
            children: [],
          },
          {
            id: 'li-2',
            type: 'list-item',
            props: { text: 'Item 2' },
            styles: { base: {} },
            children: [],
          },
        ],
      };

      const html = generateSemanticHtml(originalList);
      const result = await htmlToNodes(html);

      expect(result.success).toBe(true);
      expect(result.nodes).toHaveLength(1);

      const importedList = result.nodes[0];
      expect(importedList.type).toBe('list');
      expect(importedList.props?.ordered).toBe(true);
      expect(importedList.children).toHaveLength(2);
      expect(importedList.children?.[0].type).toBe('list-item');
      expect(importedList.children?.[0].props?.text).toBe('Item 1');
      expect(importedList.children?.[1].type).toBe('list-item');
      expect(importedList.children?.[1].props?.text).toBe('Item 2');
    });

    it('round-trips table, table-row, and table-cell generated by code-generator', async () => {
      const originalTable: PageNode = {
        id: 'table-1',
        type: 'table',
        props: {},
        styles: { base: {} },
        children: [
          {
            id: 'tr-1',
            type: 'table-row',
            props: {},
            styles: { base: {} },
            children: [
              {
                id: 'th-1',
                type: 'table-cell',
                props: { isHeader: true, text: 'Col 1' },
                styles: { base: {} },
                children: [],
              },
              {
                id: 'th-2',
                type: 'table-cell',
                props: { isHeader: true, text: 'Col 2' },
                styles: { base: {} },
                children: [],
              },
            ],
          },
          {
            id: 'tr-2',
            type: 'table-row',
            props: {},
            styles: { base: {} },
            children: [
              {
                id: 'td-1',
                type: 'table-cell',
                props: { isHeader: false, text: 'Val 1' },
                styles: { base: {} },
                children: [],
              },
              {
                id: 'td-2',
                type: 'table-cell',
                props: { isHeader: false, text: 'Val 2' },
                styles: { base: {} },
                children: [],
              },
            ],
          },
        ],
      };

      const html = generateSemanticHtml(originalTable);
      const result = await htmlToNodes(html);

      expect(result.success).toBe(true);
      expect(result.nodes).toHaveLength(1);

      const importedTable = result.nodes[0];
      expect(importedTable.type).toBe('table');
      expect(importedTable.children).toHaveLength(2);

      const row1 = importedTable.children?.[0];
      expect(row1?.type).toBe('table-row');
      expect(row1?.children?.[0].props?.isHeader).toBe(true);
      expect(row1?.children?.[0].props?.text).toBe('Col 1');

      const row2 = importedTable.children?.[1];
      expect(row2?.type).toBe('table-row');
      expect(row2?.children?.[0].props?.isHeader).toBe(false);
      expect(row2?.children?.[0].props?.text).toBe('Val 1');
    });
  });
});
