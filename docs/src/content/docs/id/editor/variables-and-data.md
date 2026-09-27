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
    group: 'Pengguna',
    type: 'string',
    sampleValue: 'Ahmad',
  },
  {
    key: 'user.email',
    label: 'Email Pengguna',
    group: 'Pengguna',
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

## Pengelompokan Variabel

`group` adalah label opsional khusus editor yang dikirim host dalam bentuk yang sudah dilokalkan (misal `'Toko'`, `'Produk'`). Entry tanpa `group` dikelompokkan berdasarkan segmen pertama `key`, jadi `order.invoiceId` di atas masuk grup `order`. Urutan grup mengikuti kemunculan pertamanya di katalog. `group` tidak pernah ditulis ke dokumen.

Di Inspector, klik **Bind variable…** di bawah field, lalu ketik untuk mencari berdasarkan label, key, deskripsi, atau grup. Katalog yang sama juga dipakai autocomplete `{{ }}` di Action Builder. Di dalam action pipeline, variabel host berada di scope `variables`, sehingga yang disisipkan adalah `{{variables.user.firstName}}`.

Nilai sampel `sampleValue` langsung ditampilkan di canvas selama sesi pengeditan sehingga desainer dapat melihat tata letak secara realistis. Saat diekspor, dokumen mempertahankan binding asli `{{user.firstName}}` untuk diinterpolasi pada runtime backend.
