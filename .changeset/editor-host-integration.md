---
'@kubuild/editor': minor
'@kubuild/react': minor
---

Editor host-integration fixes:

- `KubuildEditor`'s `assetProvider` prop is now forwarded into the canvas render context (an explicit `context.assetProvider` still wins), so uploaded and `asset://` images resolve on the canvas.
- `selectedNodeId` is now a real controlled input synced into the store (canvas, Inspector and Layers follow it); new `onSelectionChange` callback reports editor-side selection changes without echoing prop updates.
- New i18n API: `locale` / `onLocaleChange` / `translations` props on `KubuildEditor`, `TranslationOverridesContext`, `registerEditorLocale` / `unregisterEditorLocale` / `getAvailableEditorLocales`, `mergeTranslations`, and `DeepPartial` / `TranslationOverrides` / `BuiltInEditorLocale` types. `EditorLocale` now accepts custom locale codes (English fallback per key); `getTranslation(locale, overrides?)` takes optional overrides.
- `LanguageSwitcher` is exported and accepts a `locales` option list.
- Image/media source controls in the Inspector and Traits panels are localized via the new `media` translation namespace (previously hardcoded Indonesian/English mix).
