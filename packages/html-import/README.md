# @kubuild/html-import

[![npm version](https://img.shields.io/npm/v/@kubuild/html-import.svg)](https://www.npmjs.com/package/@kubuild/html-import)
[![License: Apache-2.0](https://img.shields.io/badge/License-Apache_2.0-blue.svg)](https://opensource.org/licenses/Apache-2.0)

Converts static HTML into a **KUBUILD** `PageDocument`: sanitizing, stylesheet cascade, responsive breakpoint mapping, optional Tailwind support and an import report.

```bash
pnpm add @kubuild/html-import @kubuild/core @kubuild/schema
```

```ts
import { importHtml } from '@kubuild/html-import';

const result = await importHtml(html);
if (result.success) {
  console.log(result.document, result.report);
}
```

Also available: `importHtmlToStoraPackage` (HTML → `.stora` package), `htmlToNodes` (fragment → nodes) and zip-site import.

Imported HTML is treated as untrusted input and sanitized.

## License

Apache-2.0
