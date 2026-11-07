import type { Metadata } from 'next';
import { RootProvider } from 'fumadocs-ui/provider/next';
import './global.css';
import { Inter } from 'next/font/google';
import { siteUrl } from '@/lib/shared';
import { createMetadata, siteTitle } from '@/lib/seo';

const inter = Inter({
  subsets: ['latin'],
});

export const metadata: Metadata = {
  ...createMetadata({ path: '/' }),
  metadataBase: new URL(siteUrl),
  title: {
    template: '%s - KUBUILD',
    default: siteTitle,
  },
  applicationName: 'KUBUILD',
  keywords: [
    'kubuild',
    'kustora',
    'page builder',
    'react page builder',
    'embeddable page builder',
    'headless page builder',
    'visual editor',
    'layout engine',
    'portable document',
    'stora',
    'open source page builder',
  ],
  authors: [{ name: 'Kustora Team', url: 'https://github.com/kustora' }],
  creator: 'Kustora',
  publisher: 'Kustora',
  category: 'technology',
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, 'max-image-preview': 'large', 'max-snippet': -1 },
  },
  alternates: {
    canonical: '/',
    types: { 'text/plain': '/llms.txt' },
  },
};

export default function Layout({ children }: LayoutProps<'/'>) {
  return (
    <html lang="en" className={inter.className} suppressHydrationWarning>
      <body className="flex flex-col min-h-screen">
        <RootProvider
          search={{
            options: {
              api: '/api/search',
            },
            links: [
              ['Documentation Home', '/docs'],
              ['Quickstart', '/docs/getting-started/quickstart'],
              ['Interactive Playground', '/playground'],
            ],
          }}
        >
          {children}
        </RootProvider>
      </body>
    </html>
  );
}
