import type { Metadata } from 'next';
import { RootProvider } from 'fumadocs-ui/provider/next';
import './global.css';
import { Inter } from 'next/font/google';

const inter = Inter({
  subsets: ['latin'],
});

export const metadata: Metadata = {
  metadataBase: new URL('https://kubuild.kustora.com'),
  title: {
    template: '%s - KUBUILD',
    default: 'KUBUILD - Open & Portable Web Page Builder Engine',
  },
  description:
    'Open, portable, and backend-agnostic web page builder & layout engine. Build once, render anywhere.',
  keywords: [
    'kubuild',
    'kustora',
    'web page builder',
    'layout engine',
    'visual builder',
    'portable document',
    'stora',
    'react builder',
    'headless builder',
  ],
  authors: [{ name: 'Kustora Team', url: 'https://github.com/kustora' }],
  creator: 'Kustora',
  openGraph: {
    title: {
      template: '%s - KUBUILD',
      default: 'KUBUILD - Open & Portable Web Page Builder Engine',
    },
    description:
      'Open, portable, and backend-agnostic web page builder & layout engine. Build once, render anywhere.',
    siteName: 'KUBUILD',
    type: 'website',
    locale: 'en_US',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'KUBUILD - Open & Portable Web Page Builder Engine',
    description:
      'Open, portable, and backend-agnostic web page builder & layout engine. Build once, render anywhere.',
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
              ['Component Verification', '/docs/test'],
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
