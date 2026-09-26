import React from 'react';
import { describe, it, expect } from 'vitest';
import { renderToString } from 'react-dom/server';
import { EditableText } from '../src/nodes/editable-text';

describe('EditableText: Inline Text Editing & Caret Stability', () => {
  it('renders standard non-editable element when isEditable is false', () => {
    const html = renderToString(
      <EditableText
        as="h1"
        nodeId="heading-1"
        value="Hello World"
        isEditable={false}
      />
    );
    expect(html).toContain('Hello World');
    expect(html).toContain('data-kubuild-node="heading-1"');
    expect(html.toLowerCase()).not.toContain('contenteditable');
  });

  it('renders contenteditable element with initial text when isEditable is true', () => {
    const html = renderToString(
      <EditableText
        as="h2"
        nodeId="heading-2"
        value="Selamat datang"
        isEditable={true}
      />
    );
    expect(html).toContain('Selamat datang');
    expect(html.toLowerCase()).toContain('contenteditable="true"');
    expect(html).toContain('data-kubuild-node="heading-2"');
  });

  it('escapes special characters in HTML when rendering contenteditable', () => {
    const html = renderToString(
      <EditableText
        as="p"
        nodeId="p-1"
        value="5 < 10 & 2 > 1"
        isEditable={true}
      />
    );
    expect(html).toContain('5 &lt; 10 &amp; 2 &gt; 1');
    expect(html.toLowerCase()).toContain('contenteditable="true"');
  });

  it('renders with correct semantic tag for headings, buttons, and paragraphs', () => {
    const headingHtml = renderToString(
      <EditableText
        as="h3"
        nodeId="h-3"
        value="Heading 3"
        isEditable={true}
      />
    );
    expect(headingHtml).toMatch(/^<h3[^>]*>Heading 3<\/h3>$/);

    const buttonHtml = renderToString(
      <EditableText
        as="button"
        nodeId="btn-1"
        value="Click Me"
        isEditable={true}
      />
    );
    expect(buttonHtml).toMatch(/^<button[^>]*>Click Me<\/button>$/);

    const paragraphHtml = renderToString(
      <EditableText
        as="p"
        nodeId="p-2"
        value="Paragraph"
        isEditable={true}
      />
    );
    expect(paragraphHtml).toMatch(/^<p[^>]*>Paragraph<\/p>$/);
  });

  it('renders contenteditable element with draggable="false" and userSelect: text to allow smooth inline editing and text blocking', () => {
    const html = renderToString(
      <EditableText
        as="p"
        nodeId="text-drag-test"
        value="Selectable and Editable Text"
        isEditable={true}
      />
    );
    expect(html).toContain('draggable="false"');
    expect(html).toContain('user-select:text');
  });
});
