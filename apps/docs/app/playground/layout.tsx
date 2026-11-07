import type { ReactNode } from 'react';
import { createMetadata } from '@/lib/seo';

export const metadata = createMetadata({
  title: 'Interactive Playground',
  description:
    'Try the KUBUILD visual page editor in your browser: load a SaaS, link-in-bio, or portfolio template, edit it, export a .stora package, and copy the React embed code.',
  path: '/playground',
  image: '/og/playground.png',
});

export default function Layout({ children }: { children: ReactNode }) {
  return children;
}
