---
title: Exporting & Importing .stora Packages
description: How to serialize, export, share, and import portable .stora template packages.
---

KUBUILD enables full portability through `.stora` packages. The packaging engine lives in
`@kubuild/core` (pure TypeScript, so it runs in the browser, in Node and in workers); the
editor adds thin browser-download helpers on top of it.

| Function | Package | Purpose |
| :--- | :--- | :--- |
| `exportPackage(doc, options?)` | `@kubuild/core` | Validate a `PageDocument` and build the `.stora` archive bytes. |
| `exportStoraPackage` | `@kubuild/core` | Alias of `exportPackage`. |
| `preflightPackage(bytes, options?)` | `@kubuild/core` | Non-destructive inspection: security limits, manifest, checksums, dependencies, migration. Aliases: `inspectPackage`, `previewImportPackage`. |
| `importPackage(bytes, options?)` | `@kubuild/core` | Preflight, migrate and extract a package into a `PageDocument` + assets. |
| `importStoraPackage` | `@kubuild/core` | Alias of `importPackage`. |
| `downloadDocumentAsStora(doc, filename?, options?)` | `@kubuild/editor` | `exportPackage` + trigger a browser download. |
| `downloadDocumentAsJson(doc, filename?)` | `@kubuild/editor` | Download the raw `PageDocument` JSON (tracking secrets stripped). |

None of these functions throw on invalid input — `exportPackage` and `importPackage` return a
discriminated result (`success: true | false`); only the editor download helpers throw, so
they can be wired straight to a button.

## Package layout

A `.stora` file is a ZIP archive containing:

- `manifest.json` — schema name/version, package version, builder compatibility, required
  components and capabilities, and the asset list (path, MIME type, size, SHA-256 checksum).
- `page.json` — the full `PageDocument`.
- `metadata.json` — the document metadata (title, description, author, tags, ...).
- `assets/` — local asset binaries referenced by the document.

## Exporting a page document

`exportPackage` validates the document first, collects every asset reference, resolves asset
bytes (from `assets`, `getAssetBytes` or `assetProvider`), strips tracking secrets and writes the
archive. On failure you get the validation errors instead of an archive.

```ts
import { exportPackage, type ExportPackageOptions } from '@kubuild/core';
import { createDefaultComponentRegistry } from '@kubuild/components';
import type { PageDocument } from '@kubuild/schema';

export async function buildStoraArchive(doc: PageDocument): Promise<Uint8Array> {
  const options: ExportPackageOptions = {
    // Validates component types and records `requiredComponents` in the manifest.
    componentRegistry: createDefaultComponentRegistry(),
    packageVersion: '1.0.0',
    builderCompatibility: '>=0.7.0',
    // Resolve `{ type: 'asset', assetId }` references to bytes on demand.
    getAssetBytes: async (assetId) => {
      const response = await fetch(`/api/assets/${encodeURIComponent(assetId)}`);
      if (!response.ok) return null;
      return {
        data: new Uint8Array(await response.arrayBuffer()),
        mimeType: response.headers.get('content-type') ?? undefined,
      };
    },
    // Assets without local bytes are allowed when they carry a fallback URL.
    allowExternalFallback: true,
    metadata: { author: 'Kustora User' },
  };

  const result = await exportPackage(doc, options);
  if (!result.success) {
    // result.errors: DocumentValidationError[]; result.diagnosticMessage: human-readable summary
    throw new Error(result.diagnosticMessage);
  }

  console.log(`Packed ${result.assetCount} asset(s)`, result.manifest.requiredComponents);
  return result.archive; // Uint8Array — upload it, store it, or offer it as a download
}
```

In the browser, `downloadDocumentAsStora` does the same and saves the file. It accepts the same
`ExportPackageOptions` (with `allowExternalFallback: true` by default), throws with the
validation details when the export fails, and resolves with the archive bytes:

```tsx
import { downloadDocumentAsJson, downloadDocumentAsStora } from '@kubuild/editor';
import type { PageDocument } from '@kubuild/schema';

export function ExportButtons({ doc }: { doc: PageDocument }) {
  return (
    <div>
      <button
        onClick={async () => {
          try {
            // Filename defaults to a slug of metadata.title, e.g. "my-landing-page.stora".
            await downloadDocumentAsStora(doc, 'my-template.stora');
          } catch (error) {
            console.error('Export failed:', error);
          }
        }}
      >
        Download .stora
      </button>
      <button onClick={() => downloadDocumentAsJson(doc)}>Download JSON</button>
    </div>
  );
}
```

Both download helpers refuse pages that reference detached component artboards, because the
single-document `.stora` format cannot carry them yet.

## Importing a .stora package safely

Imported packages are **untrusted input**. `importPackage` always runs `preflightPackage` first,
which checks archive size and file-count limits, zip-slip paths, executable assets, prototype
pollution, the manifest and `page.json` schemas, asset sizes and checksums, required components
and capabilities, and whether a schema migration is needed. Only then does it migrate the
document to `CURRENT_SCHEMA_VERSION` and extract the assets.

### Preflight before import

Use `preflightPackage` to show the user what a package needs before committing to an import:

```ts
import { preflightPackage } from '@kubuild/core';
import { createDefaultComponentRegistry } from '@kubuild/components';

export async function inspectUpload(file: File) {
  const bytes = new Uint8Array(await file.arrayBuffer());
  const report = await preflightPackage(bytes, {
    componentRegistry: createDefaultComponentRegistry(),
    supportedCapabilities: ['assetProvider', 'actionRegistry'],
  });

  if (!report.valid) {
    // Corrupt, unsafe or schema-invalid archive — never importable.
    return { ok: false as const, diagnostics: report.diagnostics };
  }

  return {
    ok: report.canImport,
    requiresMigration: report.requiresMigration, // e.g. a 1.0.0 package on a 1.2.0 host
    migrationPath: report.migrationPath,
    missingComponents: report.missingComponents,
    missingCapabilities: report.missingCapabilities,
    assetConflicts: report.assetConflicts,
    diagnostics: report.diagnostics,
  };
}
```

### Import

```ts
import { importPackage, type ImportPackageOptions } from '@kubuild/core';
import { createDefaultComponentRegistry } from '@kubuild/components';
import type { PageDocument } from '@kubuild/schema';

export async function importUpload(file: File, existingAssetIds: string[]): Promise<PageDocument> {
  const options: ImportPackageOptions = {
    componentRegistry: createDefaultComponentRegistry(),
    // What to do when the package needs components/capabilities this host lacks.
    dependencyPolicy: 'import-with-placeholder',
    // What to do when an incoming asset id already exists on the host.
    assetCollisionStrategy: 'rename',
    existingAssetIds,
    // Persist each extracted asset; return the stored URL (or an AssetInfo).
    onAssetImport: async (assetId, bytes, meta) => {
      const response = await fetch(`/api/assets/${encodeURIComponent(assetId)}`, {
        method: 'PUT',
        headers: { 'content-type': meta.mimeType },
        body: new Blob([bytes as BlobPart], { type: meta.mimeType }),
      });
      const { url } = (await response.json()) as { url: string };
      return url;
    },
  };

  const result = await importPackage(new Uint8Array(await file.arrayBuffer()), options);
  if (!result.success) {
    // result.errors: PreflightDiagnostic[] (code, severity, message, path?)
    throw new Error(result.diagnosticMessage);
  }

  if (result.renamedAssets) {
    // { oldAssetId: newAssetId } — document references were already remapped.
    console.log('Renamed assets:', result.renamedAssets);
  }
  for (const warning of result.warnings ?? []) console.warn(warning.code, warning.message);

  return result.document; // migrated, validated PageDocument
}
```

`ImportPackageSuccess` also carries the parsed `manifest`, `metadata`, the full `preflight`
report and `extractedAssets` (a `Map<assetId, { bytes, meta, hostInfo? }>`).

### `MissingDependencyPolicy`

`dependencyPolicy` decides what happens when a package requires component types
(`manifest.requiredComponents`) or capabilities (`manifest.requiredCapabilities`) the host does
not provide (checked against `componentRegistry` / `knownComponentTypes` and
`supportedCapabilities`):

| Value | Behavior |
| :--- | :--- |
| `'cancel'` (default) | Abort the import with blocking `MISSING_COMPONENTS` / `MISSING_CAPABILITIES` errors. |
| `'import-with-placeholder'` | Import anyway; unknown nodes keep their type and props so the renderer shows a placeholder and nothing is lost on re-export. |
| `'install-or-register-before-import'` | Call `onMissingDependency(missing, preflight)` so the host can install/register what is missing; preflight then re-runs with `'cancel'`, so anything still missing blocks the import. |

```ts
import { importPackage } from '@kubuild/core';
import { ComponentRegistry, createDefaultComponentRegistry } from '@kubuild/components';

const registry: ComponentRegistry = createDefaultComponentRegistry();

export async function importWithPlugins(bytes: Uint8Array) {
  return importPackage(bytes, {
    componentRegistry: registry,
    dependencyPolicy: 'install-or-register-before-import',
    onMissingDependency: async ({ components, capabilities }) => {
      for (const type of components) {
        // e.g. lazy-load the host's plugin bundle and `registry.register(...)` its definition
        console.log('host must register component type', type);
      }
      console.log('missing capabilities', capabilities);
      return true;
    },
  });
}
```

`allowMissingComponents` / `allowMissingCapabilities` are shorthands that downgrade the
respective check to a warning (equivalent to `'import-with-placeholder'` for that check).

### `AssetCollisionStrategy`

When `existingAssetIds` (an array, a `Set`, or an `(assetId) => boolean | Promise<boolean>`
checker) reports that an incoming asset id already exists on the host, `assetCollisionStrategy`
decides the outcome:

| Value | Behavior |
| :--- | :--- |
| `'reject'` (default) | Refuse the import with an `ASSET_CONFLICT` error. |
| `'rename'` | Give the incoming asset a new id (`renameAssetStrategy`, default `<id>_imported`, `<id>_imported_1`, ...) and remap every document reference. The mapping is returned in `renamedAssets`. |
| `'overwrite'` | Replace the host asset with the archive's bytes. |
| `'reuse-existing'` | Keep the host asset and skip writing the archive's bytes. |

For per-asset decisions, pass `onAssetConflict(conflict)` and return a strategy or
`{ action, newAssetId? }`:

```ts
import { importPackage, type AssetConflict } from '@kubuild/core';

export async function importInteractively(bytes: Uint8Array, hostAssetIds: Set<string>) {
  return importPackage(bytes, {
    existingAssetIds: hostAssetIds,
    onAssetConflict: (conflict: AssetConflict) =>
      conflict.mimeType.startsWith('image/') ? 'reuse-existing' : { action: 'rename' },
  });
}
```

### Security limits

`securityLimits` overrides `DEFAULT_SECURITY_LIMITS` — `maxArchiveSize` (50 MB),
`maxUncompressedSize` (100 MB), `maxFileCount` (1000) and `maxAssetSize` (25 MB). Packages are
never executed: templates are data only, executable asset types are rejected, and any path
that escapes the archive root (zip-slip) is rejected.

### Importing raw JSON

A plain `PageDocument` JSON file skips the archive layer — validate it with `validateDocument`
from `@kubuild/core` (or migrate older versions with `migrateDocument` first) before loading it
into the editor, for example through `EditorHandle.replaceDocument`, which validates again and
rejects invalid documents.
