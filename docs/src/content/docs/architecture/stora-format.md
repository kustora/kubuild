---
title: Portable .stora Package Format
description: Specification of the .stora portable template archive format and security considerations.
---

The `.stora` format is an open, portable package format designed to store, transfer, and instantiate landing pages and templates across different deployments and environments.

## Package Architecture

A `.stora` package is a compressed ZIP archive structured as follows:

```
my-landing-template.stora (ZIP)
├── manifest.json       # Metadata, required engines, permissions, asset index
├── document.json       # Complete PageDocument payload
└── assets/             # Localized media files and images
    ├── hero-cover.webp
    └── company-logo.svg
```

### 1. `manifest.json`

Contains package metadata, author attribution, dependencies, and required schema versions:

```json
{
  "format": "stora.package",
  "version": 1,
  "packageId": "pkg_01j7n8q2...",
  "name": "SaaS Launch Starter",
  "description": "Clean, responsive SaaS landing page template",
  "author": {
    "name": "Kustora Team",
    "url": "https://kustora.com"
  },
  "compatibility": {
    "schemaVersion": 1,
    "minEngineVersion": "0.1.0"
  },
  "assets": [
    { "id": "asset_hero", "path": "assets/hero-cover.webp", "mimeType": "image/webp" },
    { "id": "asset_logo", "path": "assets/company-logo.svg", "mimeType": "image/svg+xml" }
  ]
}
```

### 2. Security & Sanitization Model

Imported `.stora` packages are treated as **untrusted input**:

- **No Arbitrary Code Execution**: Templates cannot contain JavaScript code or external executable scripts.
- **Strict Schema Validation**: The payload is validated against `PageDocumentSchema` with Zod.
- **Asset Sanitization**: SVGs are sanitized to strip malicious `<script>` or event handler tags.
- **Path Traversal Protection**: Archive filenames are sanitized to prevent `../` directory traversal exploits.
