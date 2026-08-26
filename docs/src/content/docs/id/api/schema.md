---
title: 'API @kubuild/schema'
description: 'Skema JSON, definisi Zod, tipe node AST, dan type guards di @kubuild/schema.'
---

# Referensi API `@kubuild/schema`

Paket `@kubuild/schema` mendefinisikan spesifikasi dokumen `.stora`, struktur node pohon dokumen, style responsif, dan skema validasi Zod.

## Tipe Data Utama

- `PageDocument`: Struktur dokumen root.
- `Node`: Tipe node AST untuk setiap elemen komponen.
- `ResponsiveStyles`: Peta style CSS untuk breakpoint `base`, `desktop`, `tablet`, dan `mobile`.
- `DocumentMetadata`: Metadata dokumen (judul, deskripsi, pembuat, tags).

## Skema Zod

- `PageDocumentSchema`
- `NodeSchema`
- `ResponsiveStylesSchema`
- `DocumentMetadataSchema`
