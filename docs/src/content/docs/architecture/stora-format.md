---
title: Portable .stora Package Format
description: Specification of the .stora portable template archive format and security considerations.
---

The `.stora` format is an open, portable package format designed to store, transfer, and instantiate landing pages and templates across different deployments and environments.

## Package Architecture

A `.stora` package is a compressed ZIP archive structured as follows:

```
my-landing-template.stora (ZIP)
├── manifest.json       # Schema/package versions, required components & capabilities, asset index
├── page.json           # Complete PageDocument payload
├── metadata.json       # Document metadata (title, description, author, tags)
└── assets/             # Localized media files and images
    └── hero-cover.webp
```

### 1. `manifest.json`

Describes the package: document schema version, package version, builder compatibility range, the component types and host capabilities the page needs, and every bundled asset with its size and SHA-256 checksum (validated by `ManifestSchema` from `@kubuild/schema`):

```json
{
  "schema": "stora.page",
  "schemaVersion": "1.2.0",
  "packageVersion": "1.0.0",
  "builderCompatibility": ">=0.1.0",
  "requiredComponents": ["pricing-card"],
  "requiredCapabilities": ["actionRegistry"],
  "assets": [
    {
      "id": "asset_hero",
      "path": "assets/hero-cover.webp",
      "mimeType": "image/webp",
      "size": 48213,
      "checksum": "sha256-hex-digest"
    }
  ],
  "createdAt": "2026-08-25T00:00:00.000Z"
}
```

### 2. Security & Sanitization Model

Imported `.stora` packages are treated as **untrusted input**:

- **No Arbitrary Code Execution**: Templates cannot contain JavaScript code or external executable scripts.
- **Strict Schema Validation**: The payload is validated against `PageDocumentSchema` with Zod, and the document is migrated to `CURRENT_SCHEMA_VERSION` (currently `1.2.0`) when needed.
- **Asset Screening**: Executable or script file types (including double extensions such as `logo.exe.png`) are rejected, and every asset's size and checksum must match the manifest.
- **Path Traversal Protection**: Archive filenames are sanitized to prevent `../` directory traversal exploits.
