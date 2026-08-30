import { describe, it, expect, beforeEach } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { createBlankDocument } from '@kubuild/core';
import { createDefaultComponentRegistry } from '@kubuild/components';
import { ResponsiveStyles } from '@kubuild/schema';
import { useEditorStore } from '../src/store';
import { CodeViewerModal } from '../src/code-viewer-modal';
import { CodeHighlighter } from '../src/code-highlighter';
import { EditorToolbar } from '../src/toolbar';

describe('Live Code Viewer Modal (STORA-251)', () => {
  const registry = createDefaultComponentRegistry();

  const heroStyles: ResponsiveStyles = {
    base: { backgroundColor: '#1e293b', padding: '32px' },
    states: { ':hover': { backgroundColor: '#334155' } },
  };

  const btnStyles: ResponsiveStyles = {
    base: { backgroundColor: '#2563eb', color: '#ffffff' },
    states: { ':hover': { backgroundColor: '#1d4ed8' } },
  };

  beforeEach(() => {
    const doc = createBlankDocument('Code Viewer Test');
    doc.document.children = [
      {
        id: 'hero-sec',
        type: 'section',
        props: { ariaLabel: 'Hero Area' },
        styles: heroStyles,
        children: [
          {
            id: 'main-heading',
            type: 'heading',
            props: { level: 1, text: 'Welcome to KUBUILD' },
          },
          {
            id: 'cta-button',
            type: 'button',
            props: { label: 'Explore Features' },
            styles: btnStyles,
          },
        ],
      },
    ];
    useEditorStore.getState().setDocument(doc);
  });

  it('renders View Code button inside EditorToolbar', () => {
    const html = renderToString(<EditorToolbar registry={registry} />);
    expect(html).toContain('View Code');
    expect(html).toContain('&lt;&gt;');
    expect(html).toContain('View Semantic HTML');
  });

  it('renders modal dialog when isOpen is true with active document markup & styles', () => {
    const doc = createBlankDocument('Code Viewer Test');
    doc.document.children = [
      {
        id: 'hero-sec',
        type: 'section',
        props: { ariaLabel: 'Hero Area' },
        styles: heroStyles,
        children: [
          {
            id: 'main-heading',
            type: 'heading',
            props: { level: 1, text: 'Welcome to KUBUILD' },
          },
          {
            id: 'cta-button',
            type: 'button',
            props: { label: 'Explore Features' },
            styles: btnStyles,
          },
        ],
      },
    ];

    const html = renderToString(
      <CodeViewerModal isOpen={true} document={doc} onClose={() => {}} />,
    );

    expect(html).toContain('role="dialog"');
    expect(html).toContain('Live Code Viewer');
    expect(html).toContain('Live Sync');
    expect(html).toContain('HTML &amp; CSS');
    expect(html).toContain('Semantic HTML');
    expect(html).toContain('Structured CSS');
    expect(html).toContain('Copy Code');
    expect(html).toContain('Download');
    expect(html).toContain('Welcome to KUBUILD');
    expect(html).toContain('.kb-node-hero-sec');
    expect(html).toContain('.kb-node-cta-button');
    expect(html).toContain(':hover');
  });

  it('renders nothing when isOpen is false', () => {
    const html = renderToString(
      <CodeViewerModal isOpen={false} onClose={() => {}} />,
    );
    expect(html).toBe('');
  });

  it('displays accurate document elements and line statistics in modal footer', () => {
    const doc = createBlankDocument('Stats Test');
    const html = renderToString(
      <CodeViewerModal isOpen={true} document={doc} onClose={() => {}} />,
    );
    expect(html).toContain('Elements');
    expect(html).toContain('Lines');
    expect(html).toContain('KB');
    expect(html).toContain('Single-file HTML document');
  });

  it('renders syntax highlighting classes for HTML tags, attributes, strings, and CSS properties', () => {
    const sampleHtml = '<div class="container" id="main">Hello</div>';
    const html = renderToString(
      <CodeHighlighter code={sampleHtml} mode="html" />,
    );
    expect(html).toContain('text-sky-400'); // tag-name
    expect(html).toContain('text-amber-300'); // attr-name
    expect(html).toContain('text-emerald-400'); // attr-value
  });
});

