---
title: 'Variabel & Dynamic Data Catalog'
description: 'Binding variabel format mustache, katalog variabel, dan data pratinjau di KUBUILD.'
---

# Variabel & Dynamic Data Catalog

KUBUILD mendukung pembuatan template dinamis. Dokumen dapat menggunakan ekspresi mustache seperti `{{user.name}}` atau `{{cart.total}}`. Editor dilengkapi dengan sistem **Variable Catalog** yang memungkinkan aplikasi host mendaftarkan skema data serta menyediakan nilai contoh (sample values) untuk pratinjau langsung di canvas.

## Menentukan Katalog Variabel

```ts
import { VariableCatalog } from '@kubuild/core';

export const appVariableCatalog: VariableCatalog = [
  {
    key: 'user.firstName',
    label: 'Nama Depan Pengguna',
    type: 'string',
    sampleValue: 'Ahmad',
  },
  {
    key: 'user.email',
    label: 'Email Pengguna',
    type: 'string',
    sampleValue: 'ahmad@example.com',
  },
  {
    key: 'order.invoiceId',
    label: 'Nomor Invoice',
    type: 'string',
    sampleValue: 'INV-2026-8941',
  },
];
```

## Memasang ke Editor

```tsx
<KubuildEditor
  initialDocument={document}
  variableCatalog={appVariableCatalog}
  onChange={handleDocumentChange}
/>
```

Nilai sampel `sampleValue` langsung ditampilkan di canvas selama sesi pengeditan sehingga desainer dapat melihat tata letak secara realistis. Saat diekspor, dokumen mempertahankan binding asli `{{user.firstName}}` untuk diinterpolasi pada runtime backend.
