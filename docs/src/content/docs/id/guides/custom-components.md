---
title: Membuat & Mendaftarkan Komponen Kustom
description: Panduan membuat, mendefinisikan skema, dan merender komponen kustom di KUBUILD.
---

KUBUILD memungkinkan pengembang aplikasi untuk menambahkan komponen kustom selain elemen bawaan engine.

## 1. Buat Komponen React

Buat komponen React standar:

```tsx
import React from 'react';

export interface PricingCardProps {
  planTitle: string;
  price: string;
  features: string[];
  ctaLabel: string;
}

export function PricingCard({ planTitle, price, features = [], ctaLabel }: PricingCardProps) {
  return (
    <div className="rounded-xl border border-gray-200 p-6 shadow-sm hover:shadow-md transition">
      <h3 className="text-xl font-bold text-gray-900">{planTitle}</h3>
      <p className="mt-2 text-3xl font-extrabold text-indigo-600">{price}</p>
      <ul className="mt-4 space-y-2">
        {features.map((feat, i) => (
          <li key={i} className="text-sm text-gray-600 flex items-center">
            ✓ {feat}
          </li>
        ))}
      </ul>
      <button className="mt-6 w-full py-2 bg-indigo-600 text-white rounded-lg font-medium">
        {ctaLabel}
      </button>
    </div>
  );
}
```

## 2. Daftarkan Metadata & Skema Properti

Daftarkan komponen ke dalam `ComponentRegistry` lengkap dengan kontrol form di panel builder:

```tsx
import { ComponentRegistry } from '@kubuild/components';
import { PricingCard } from './PricingCard';

export const appRegistry = new ComponentRegistry();

appRegistry.register({
  type: 'PricingCard',
  displayName: 'Pricing Card',
  category: 'Marketing',
  icon: 'credit-card',
  component: PricingCard,
  propsSchema: {
    planTitle: { type: 'string', default: 'Paket Pro', label: 'Nama Paket' },
    price: { type: 'string', default: 'Rp 299.000/bln', label: 'Harga' },
    features: {
      type: 'array',
      itemType: 'string',
      default: ['Unlimited Proyek', 'Custom Domain', 'Dukungan 24/7'],
      label: 'Daftar Fitur',
    },
    ctaLabel: { type: 'string', default: 'Mulai Sekarang', label: 'Label Tombol' },
  },
  supportsChildren: false,
});
```

## 3. Integrasikan ke Editor dan Renderer

Berikan objek registry ke komponen `<KubuildEditor />` atau `<KubuildRenderer />`:

```tsx
<KubuildEditor
  initialDocument={document}
  registry={appRegistry}
/>
```
