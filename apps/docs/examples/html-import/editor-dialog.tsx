'use client';

import { useMemo, useRef, useState } from 'react';
import {
  HtmlImportModal,
  KubuildEditor,
  type EditorHandle,
  type HtmlImportPreset,
} from '@kubuild/editor';
import type { HtmlImportOptions } from '@kubuild/html-import';

const PRESETS: HtmlImportPreset[] = [
  {
    id: 'hero',
    name: 'Hero section',
    description: 'Heading, copy and a call to action',
    html: '<section><h1>Hello</h1><p>Imported from HTML.</p><a href="/start">Start</a></section>',
  },
];

export function EditorWithHtmlImport() {
  const editorRef = useRef<EditorHandle>(null);
  const [open, setOpen] = useState(false);

  // Same options as importHtml / importHtmlZip; keep the object stable.
  const options = useMemo<HtmlImportOptions>(
    () => ({
      baseUrl: window.location.origin,
      assetResolver: ({ url }) => (url.startsWith('https://') ? url : null),
    }),
    [],
  );

  return (
    <>
      <button type="button" onClick={() => setOpen(true)}>
        Import HTML
      </button>

      <HtmlImportModal
        isOpen={open}
        onClose={() => setOpen(false)}
        presets={PRESETS}
        options={options}
        onImport={(doc) => {
          // keepHistory: the swap becomes one undo step instead of resetting history.
          const result = editorRef.current?.replaceDocument(doc, { keepHistory: true });
          if (result && !result.success) console.error(result.error, result.errors);
        }}
      />

      <KubuildEditor ref={editorRef} />
    </>
  );
}
