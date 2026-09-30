---
title: Ekspor & Impor Paket .stora
description: Cara menserialisasi, mengekspor, membagikan, dan mengimpor paket template .stora.
---

KUBUILD mendukung portabilitas penuh melalui berkas paket `.stora`. Mesin pengemasan berada di
`@kubuild/core` (TypeScript murni, sehingga berjalan di browser, Node, maupun worker); editor
menambahkan helper unduhan browser yang tipis di atasnya.

| Fungsi | Paket | Kegunaan |
| :--- | :--- | :--- |
| `exportPackage(doc, options?)` | `@kubuild/core` | Memvalidasi `PageDocument` dan membangun byte arsip `.stora`. |
| `exportStoraPackage` | `@kubuild/core` | Alias dari `exportPackage`. |
| `preflightPackage(bytes, options?)` | `@kubuild/core` | Inspeksi non-destruktif: batas keamanan, manifes, checksum, dependensi, migrasi. Alias: `inspectPackage`, `previewImportPackage`. |
| `importPackage(bytes, options?)` | `@kubuild/core` | Preflight, migrasi, dan ekstraksi paket menjadi `PageDocument` + aset. |
| `importStoraPackage` | `@kubuild/core` | Alias dari `importPackage`. |
| `downloadDocumentAsStora(doc, filename?, options?)` | `@kubuild/editor` | `exportPackage` + memicu unduhan browser. |
| `downloadDocumentAsJson(doc, filename?)` | `@kubuild/editor` | Mengunduh JSON `PageDocument` mentah (secret tracking dibuang). |

Tidak ada fungsi di atas yang melempar error untuk input tidak valid — `exportPackage` dan
`importPackage` mengembalikan hasil terdiskriminasi (`success: true | false`); hanya helper
unduhan editor yang melempar error, sehingga bisa langsung dipasang ke tombol.

## Struktur paket

Berkas `.stora` adalah arsip ZIP yang berisi:

- `manifest.json` — nama/versi skema, versi paket, kompatibilitas builder, komponen dan
  kapabilitas yang dibutuhkan, serta daftar aset (path, MIME type, ukuran, checksum SHA-256).
- `page.json` — `PageDocument` lengkap.
- `metadata.json` — metadata dokumen (judul, deskripsi, penulis, tag, ...).
- `assets/` — biner aset lokal yang direferensikan dokumen.

## Mengekspor dokumen halaman

`exportPackage` memvalidasi dokumen terlebih dahulu, mengumpulkan semua referensi aset,
mengambil byte aset (dari `assets`, `getAssetBytes`, atau `assetProvider`), membuang secret
tracking, lalu menulis arsip. Bila gagal, Anda mendapatkan error validasi alih-alih arsip.

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

Di browser, `downloadDocumentAsStora` melakukan hal yang sama sekaligus menyimpan berkasnya.
Fungsi ini menerima `ExportPackageOptions` yang sama (dengan `allowExternalFallback: true`
sebagai default), melempar error berisi detail validasi bila ekspor gagal, dan mengembalikan
byte arsip:

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

Kedua helper unduhan menolak halaman yang mereferensikan artboard komponen terlepas (detached),
karena format `.stora` yang berbasis satu dokumen belum bisa membawanya.

## Mengimpor paket .stora secara aman

Paket yang diimpor adalah **input tak tepercaya**. `importPackage` selalu menjalankan
`preflightPackage` lebih dulu, yang memeriksa batas ukuran arsip dan jumlah berkas, path
zip-slip, aset executable, prototype pollution, skema manifes dan `page.json`, ukuran serta
checksum aset, komponen dan kapabilitas yang dibutuhkan, dan apakah perlu migrasi skema. Baru
setelah itu dokumen dimigrasikan ke `CURRENT_SCHEMA_VERSION` dan aset diekstrak.

### Preflight sebelum impor

Gunakan `preflightPackage` untuk menunjukkan kepada pengguna apa yang dibutuhkan sebuah paket
sebelum benar-benar mengimpornya:

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

### Impor

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

`ImportPackageSuccess` juga membawa `manifest`, `metadata` hasil parsing, laporan `preflight`
lengkap, dan `extractedAssets` (sebuah `Map<assetId, { bytes, meta, hostInfo? }>`).

### `MissingDependencyPolicy`

`dependencyPolicy` menentukan apa yang terjadi bila paket membutuhkan tipe komponen
(`manifest.requiredComponents`) atau kapabilitas (`manifest.requiredCapabilities`) yang tidak
disediakan host (dicek terhadap `componentRegistry` / `knownComponentTypes` dan
`supportedCapabilities`):

| Nilai | Perilaku |
| :--- | :--- |
| `'cancel'` (default) | Batalkan impor dengan error pemblokir `MISSING_COMPONENTS` / `MISSING_CAPABILITIES`. |
| `'import-with-placeholder'` | Tetap impor; node yang tidak dikenal mempertahankan tipe dan props-nya sehingga renderer menampilkan placeholder dan tidak ada data yang hilang saat diekspor ulang. |
| `'install-or-register-before-import'` | Panggil `onMissingDependency(missing, preflight)` agar host dapat menginstal/mendaftarkan yang kurang; preflight lalu dijalankan ulang dengan `'cancel'`, sehingga apa pun yang masih kurang akan memblokir impor. |

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

`allowMissingComponents` / `allowMissingCapabilities` adalah jalan pintas yang menurunkan
pemeriksaan terkait menjadi peringatan (setara `'import-with-placeholder'` untuk pemeriksaan
tersebut).

### `AssetCollisionStrategy`

Bila `existingAssetIds` (array, `Set`, atau fungsi pemeriksa `(assetId) => boolean |
Promise<boolean>`) melaporkan bahwa id aset yang masuk sudah ada di host,
`assetCollisionStrategy` menentukan hasilnya:

| Nilai | Perilaku |
| :--- | :--- |
| `'reject'` (default) | Tolak impor dengan error `ASSET_CONFLICT`. |
| `'rename'` | Beri aset yang masuk id baru (`renameAssetStrategy`, default `<id>_imported`, `<id>_imported_1`, ...) dan petakan ulang semua referensi di dokumen. Pemetaannya dikembalikan di `renamedAssets`. |
| `'overwrite'` | Timpa aset host dengan byte dari arsip. |
| `'reuse-existing'` | Pertahankan aset host dan lewati penulisan byte dari arsip. |

Untuk keputusan per aset, berikan `onAssetConflict(conflict)` yang mengembalikan strategi atau
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

### Batas keamanan

`securityLimits` menimpa `DEFAULT_SECURITY_LIMITS` — `maxArchiveSize` (50 MB),
`maxUncompressedSize` (100 MB), `maxFileCount` (1000), dan `maxAssetSize` (25 MB). Paket tidak
pernah dieksekusi: template hanyalah data, tipe aset executable ditolak, dan path yang keluar
dari root arsip (zip-slip) ditolak.

### Mengimpor JSON mentah

Berkas JSON `PageDocument` biasa melewati lapisan arsip — validasi dengan `validateDocument`
dari `@kubuild/core` (atau migrasikan versi lama dengan `migrateDocument` terlebih dahulu)
sebelum dimuat ke editor, misalnya melalui `EditorHandle.replaceDocument`, yang memvalidasi
ulang dan menolak dokumen tidak valid.
