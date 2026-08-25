import { describe, it, expect } from 'vitest';
import * as kubuildReact from '../src/index';

describe('@kubuild/react exports', () => {
  it('exports core, schema, components, renderer, and editor modules', () => {
    expect(kubuildReact.createBlankDocument).toBeDefined();
    expect(kubuildReact.PageDocumentSchema).toBeDefined();
    expect(kubuildReact.createDefaultComponentRegistry).toBeDefined();
    expect(kubuildReact.KubuildRenderer).toBeDefined();
    expect(kubuildReact.KubuildEditor).toBeDefined();
    expect(kubuildReact.useEditorStore).toBeDefined();
  });
});
