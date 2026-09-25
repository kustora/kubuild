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

  it('re-exports the editor i18n API and LanguageSwitcher', () => {
    expect(kubuildReact.LanguageSwitcher).toBeDefined();
    expect(kubuildReact.registerEditorLocale).toBeDefined();
    expect(kubuildReact.getTranslation).toBeDefined();
    expect(kubuildReact.useTranslation).toBeDefined();
    expect(kubuildReact.TranslationOverridesContext).toBeDefined();
  });
});
