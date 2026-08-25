---
title: Building & Registering Custom Components
description: How to create, type, register, and render custom components in KUBUILD.
---

KUBUILD allows application developers to introduce custom components beyond the built-in elements.

## 1. Define the Component React Implementation

Create your React component:

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

## 2. Register with Definition Metadata

Register the component with property types and default values:

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
    planTitle: { type: 'string', default: 'Pro Plan', label: 'Plan Name' },
    price: { type: 'string', default: '$29/mo', label: 'Price' },
    features: {
      type: 'array',
      itemType: 'string',
      default: ['Unlimited Projects', 'Custom Domain', '24/7 Support'],
      label: 'Feature List',
    },
    ctaLabel: { type: 'string', default: 'Get Started', label: 'Button Label' },
  },
  supportsChildren: false,
});
```

## 3. Pass to Editor and Renderer

Pass the custom registry to `<KubuildEditor />` or `<KubuildRenderer />`:

```tsx
<KubuildEditor
  initialDocument={document}
  registry={appRegistry}
/>
```
