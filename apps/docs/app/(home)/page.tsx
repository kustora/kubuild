import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { ArrowRight, Play } from 'lucide-react';
import { ServerCodeBlock } from 'fumadocs-ui/components/codeblock.rsc';
import { gitConfig } from '@/lib/shared';
import { createMetadata, organizationLd, siteTitle, softwareLd, websiteLd } from '@/lib/seo';
import { JsonLd } from '@/components/json-ld';
import { HeroLayers } from './hero-layers';
import { InstallTabs } from './install-tabs';

export const metadata: Metadata = {
  ...createMetadata({ path: '/' }),
  title: { absolute: siteTitle },
};

const githubUrl = `https://github.com/${gitConfig.user}/${gitConfig.repo}`;

const lifecycle = ['Create', 'Customize', 'Export', 'Share', 'Import', 'Customize', 'Publish'];

const packages = [
  {
    name: '@kubuild/react',
    body: 'One import for React apps: editor, renderer, schema, and core.',
    href: '/docs/packages/react',
  },
  {
    name: '@kubuild/schema',
    body: 'Zod schemas and types for the document format.',
    href: '/docs/packages/schema',
  },
  {
    name: '@kubuild/core',
    body: 'Framework-free commands, history, migration, and .stora I/O.',
    href: '/docs/packages/core',
  },
  {
    name: '@kubuild/components',
    body: 'Component registry and built-in definitions.',
    href: '/docs/packages/components',
  },
  {
    name: '@kubuild/renderer',
    body: 'Lightweight React renderer for published pages.',
    href: '/docs/packages/renderer',
  },
  {
    name: '@kubuild/editor',
    body: 'The visual editor: canvas, inspector, layers.',
    href: '/docs/packages/editor',
  },
  {
    name: '@kubuild/ai',
    body: 'Optional AI copilot with a server-side proxy.',
    href: '/docs/packages/ai',
  },
];

const chain = ['schema', 'core', 'components', 'renderer', 'editor', 'react'];

const editorCode = `'use client';
import {
  KubuildEditor,
  createBlankDocument,
} from '@kubuild/react';

export function Builder() {
  return (
    <KubuildEditor
      initialDocument={createBlankDocument('Spring Sale')}
      onSave={(doc) => saveDraft(doc)} // your storage
    />
  );
}`;

const rendererCode = `import { KubuildRenderer } from '@kubuild/react';

export default async function Page({ params }) {
  const { slug } = await params;
  const doc = await loadPublishedPage(slug); // your storage

  // Server-rendered, responsive CSS, no editor code shipped
  return <KubuildRenderer document={doc} responsive="css" />;
}`;

const footerLinks: { title: string; links: [string, string][] }[] = [
  {
    title: 'KUBUILD',
    links: [
      ['Docs', '/docs'],
      ['Quickstart', '/docs/getting-started/quickstart'],
      ['Playground', '/playground'],
      ['Changelog', '/docs/reference/changelog'],
    ],
  },
  {
    title: 'Guides',
    links: [
      ['Custom components', '/docs/guides/custom-components'],
      ['Responsive cascade', '/docs/guides/responsive-cascade'],
      ['Export & import', '/docs/guides/export-import'],
      ['Tracking pixels', '/docs/guides/tracking-pixels'],
    ],
  },
  {
    title: 'Integrate',
    links: [
      ['Next.js', '/docs/integration/nextjs'],
      ['Vite', '/docs/integration/vite'],
      ['Backend storage', '/docs/integration/backend-storage'],
      ['Security', '/docs/integration/security'],
    ],
  },
];

/* ---------- Building blocks ---------- */

/** The Kustora mark (from stora-page/apps/web/public/brand/icon.svg), drawn in currentColor. */
function KustoraMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 32 32"
      fill="none"
      stroke="currentColor"
      strokeWidth="3.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      className={className}
    >
      <line x1="3" y1="16" x2="18" y2="16" />
      <line x1="18" y1="5" x2="18" y2="27" />
      <line x1="9.5" y1="7.5" x2="18" y2="16" />
      <line x1="18" y1="16" x2="26.5" y2="24.5" />
      <line x1="9.5" y1="24.5" x2="18" y2="16" />
      <line x1="18" y1="16" x2="26.5" y2="7.5" />
    </svg>
  );
}

/** A dark editor/terminal window, identical in light and dark mode. */
function Window({
  title,
  children,
  className = '',
}: {
  title?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`overflow-hidden rounded-md border border-white/10 bg-[#0f172a] font-mono text-[12.5px] leading-relaxed text-slate-300 ${className}`}
    >
      {title ? (
        <div className="border-b border-white/10 px-4 py-2 text-[11px] text-slate-500">{title}</div>
      ) : null}
      <pre className="overflow-hidden px-4 py-3">{children}</pre>
    </div>
  );
}

/** The textured blue field that feature windows sit on. */
function Field({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={`overflow-hidden bg-blue-600 bg-[radial-gradient(120%_80%_at_15%_0%,rgba(255,255,255,0.22),transparent_55%),repeating-linear-gradient(115deg,rgba(255,255,255,0.05)_0_2px,transparent_2px_14px)] ${className}`}
    >
      {children}
    </div>
  );
}

// Tiny syntax colouring helpers for the hand-written snippets.
const kw = (t: string) => <span className="text-blue-400">{t}</span>;
const str = (t: string) => <span className="text-emerald-300">{t}</span>;
const cm = (t: string) => <span className="text-slate-500">{t}</span>;
const fn = (t: string) => <span className="text-slate-50">{t}</span>;

function FeatureCell({
  title,
  body,
  href,
  children,
}: {
  title: string;
  body: string;
  href: string;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col border-b md:[&:nth-child(odd)]:border-r">
      <div className="px-6 pt-8 sm:px-10 sm:pt-10">
        <h3 className="text-xl font-medium tracking-tight">
          <Link href={href} className="group inline-flex items-center gap-2 hover:text-blue-500">
            {title}
            <ArrowRight className="size-4 -translate-x-1 opacity-0 transition group-hover:translate-x-0 group-hover:opacity-100" />
          </Link>
        </h3>
        <p className="mt-2 max-w-md text-fd-muted-foreground">{body}</p>
      </div>
      <div className="relative mt-8 h-72 overflow-hidden">{children}</div>
    </div>
  );
}

/* ---------- Page ---------- */

export default function HomePage() {
  return (
    <main className="flex flex-1 flex-col">
      <JsonLd data={[organizationLd, websiteLd, softwareLd]} />
      <div className="mx-auto w-full max-w-(--fd-layout-width) border-x">
        {/* Hero */}
        <section className="grid grid-cols-1 border-b lg:grid-cols-2">
          <div className="flex min-w-0 flex-col px-6 pt-14 pb-10 sm:px-10 lg:border-r lg:pt-20">
            <p className="text-sm text-fd-muted-foreground">
              Open source · MIT · by{' '}
              <span className="font-semibold text-fd-foreground">Kustora</span>
            </p>
            <h1 className="mt-5 text-4xl font-medium tracking-[-0.04em] text-balance sm:text-6xl">
              The Page Builder for Your App
            </h1>
            <p className="mt-6 max-w-md text-lg text-fd-muted-foreground">
              KUBUILD gives your React app a visual editor and a lightweight renderer. Every page is
              a portable JSON document you store and render yourself.
            </p>
            <div className="mt-10 flex flex-wrap gap-3">
              <Link
                href="/docs/getting-started/quickstart"
                className="rounded-md border-2 border-blue-500 px-5 py-2.5 font-medium shadow-[0_0_24px_-6px_rgba(59,130,246,0.8)] transition hover:bg-blue-500 hover:text-white"
              >
                Get Started
              </Link>
              <a
                href={githubUrl}
                className="rounded-md border px-5 py-2.5 font-medium transition hover:bg-fd-accent"
              >
                View on GitHub
              </a>
            </div>
            <div className="mt-auto pt-14">
              <InstallTabs />
            </div>
          </div>
          <div className="relative hidden lg:block">
            <HeroLayers />
          </div>
        </section>

        {/* Lifecycle strip */}
        <section className="border-b">
          <h2 className="px-6 pt-8 text-lg font-medium sm:px-10">
            One document, the whole lifecycle
          </h2>
          <ol className="mt-6 grid grid-cols-2 gap-px border-t bg-fd-border md:grid-cols-7">
            {lifecycle.map((step, i) => (
              <li
                key={`${step}-${i}`}
                className="flex items-center justify-center gap-2 bg-fd-background py-6 text-lg font-medium last:col-span-2 md:last:col-span-1"
              >
                <span className="font-mono text-xs text-blue-500">{i + 1}</span>
                {step}
              </li>
            ))}
          </ol>
        </section>

        {/* Section title */}
        <section className="border-b px-6 py-20 text-center sm:px-10 md:py-28">
          <h2 className="mx-auto max-w-2xl text-4xl font-medium tracking-tight text-balance md:text-5xl">
            A builder engine, not a hosted product
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-fd-muted-foreground">
            You keep your stack, your database, and your design system. KUBUILD supplies the
            document model, the editor, and the renderer.
          </p>
        </section>

        {/* Features */}
        <section className="grid md:grid-cols-2">
          <FeatureCell
            title="Portable .stora documents"
            body="Every page is a Zod-validated JSON tree. Store it in Postgres, S3, or Git, diff it in review, and move it between hosts."
            href="/docs/getting-started/stora-document"
          >
            <Field className="absolute inset-0">
              <Window
                title="spring-sale.stora · document.json"
                className="absolute top-10 left-8 w-[min(440px,85%)]"
              >
                {'{\n  '}
                {fn('"schema"')}: {str('"stora.page"')}
                {',\n  '}
                {fn('"version"')}: {str('"1.3.0"')}
                {',\n  '}
                {fn('"document"')}
                {': {\n    '}
                {fn('"id"')}: {str('"spring-sale"')}, {fn('"type"')}: {str('"page"')}
                {',\n    '}
                {fn('"children"')}
                {': [{ '}
                {fn('"type"')}: {str('"heading"')}
                {', … }]\n  }\n}'}
              </Window>
            </Field>
          </FeatureCell>

          <FeatureCell
            title="Editor and renderer are separate"
            body="Admins load the full editor; visitors only get @kubuild/renderer. Public pages render in Server Components with no editor code."
            href="/docs/getting-started/architecture"
          >
            <div className="absolute top-2 right-10 z-10 rounded-md border-2 border-blue-500 bg-fd-background px-3 py-1.5 font-mono text-xs text-blue-500 shadow-[0_0_20px_-6px_rgba(59,130,246,0.8)]">
              responsive=&quot;css&quot;
            </div>
            <Window className="absolute top-14 right-0 left-10 rounded-r-none border-r-0">
              {kw('import')}
              {' { '}
              {fn('KubuildRenderer')}
              {' } '}
              {kw('from')} {str("'@kubuild/renderer'")}
              {';\n\n'}
              {kw('export default async function')} {fn('Page')}
              {'() {\n  '}
              {kw('const')}
              {' doc = '}
              {kw('await')} {fn('loadPublishedPage')}
              {'();\n  '}
              {cm('// plain HTML + @media CSS, no editor bundle')}
              {'\n  '}
              {kw('return')}
              {' <'}
              {fn('KubuildRenderer')}
              {' document={doc} responsive='}
              {str('"css"')}
              {' />;\n}'}
            </Window>
          </FeatureCell>

          <FeatureCell
            title="Responsive by cascade"
            body="Desktop styles cascade to tablet and mobile, and each breakpoint stores only its overrides. Design every device on one canvas."
            href="/docs/guides/responsive-cascade"
          >
            <div className="absolute inset-x-8 top-0 bottom-0 overflow-hidden rounded-t-md border border-b-0">
              <Image
                src="/screenshots/editor/editor-multi-device.webp"
                alt="Desktop, tablet, and mobile previews side by side in the editor"
                width={2520}
                height={1500}
                sizes="(max-width: 768px) 100vw, 600px"
                className="h-full w-full object-cover object-left-top"
              />
            </div>
          </FeatureCell>

          <FeatureCell
            title="Your components, first-class"
            body="Register your own components with inspector controls, validation, and a React renderer. They work in the editor, renderer, and AI."
            href="/docs/guides/custom-components"
          >
            <Field className="absolute inset-0">
              <Window title="register.ts" className="absolute top-10 right-8 left-8">
                {kw('const')}
                {' registry = '}
                {fn('createDefaultComponentRegistry')}
                {'();\n\nregistry.'}
                {fn('register')}
                {'({\n  type: '}
                {str("'custom.pricing-table'")}
                {',\n  label: '}
                {str("'Pricing Table'")}
                {',\n  propFields: [{ name: '}
                {str("'plans'")}
                {', type: '}
                {str("'json'")}
                {' }],\n  renderer: PricingTable,\n});'}
              </Window>
            </Field>
          </FeatureCell>

          <FeatureCell
            title="Variables, forms & actions"
            body="Personalize text with {{ variables }}, validate forms, and run declarative action pipelines. No eval, no scripts in the document."
            href="/docs/guides/dynamic-variables"
          >
            <Field className="absolute inset-0">
              <Window
                title="heading · props.text"
                className="absolute top-10 left-8 w-[min(400px,82%)]"
              >
                {'Welcome, '}
                <span className="rounded bg-blue-500/25 px-1 text-blue-300">
                  {'{{ user.name | Valued Customer }}'}
                </span>
                {'!'}
              </Window>
              <div className="absolute right-8 bottom-10 rounded-md bg-white px-5 py-4 text-lg font-semibold text-slate-900">
                Welcome, Salwa!
              </div>
            </Field>
          </FeatureCell>

          <FeatureCell
            title="Safe by default"
            body="Imports are untrusted: schema validation, zip-bomb and path checks, URL and CSS sanitization, and no secrets in documents."
            href="/docs/integration/security"
          >
            <Window className="absolute top-0 right-10 bottom-0 left-10 rounded-b-none border-b-0">
              {kw('const')}
              {' result = '}
              {kw('await')} {fn('importStoraPackage')}
              {'(upload);\n\nresult.success         '}
              {cm('// ')}
              <span className="text-rose-400">false</span>
              {'\nresult.errors[0].code  '}
              {cm('// ')}
              <span className="text-rose-400">{"'ZIP_SLIP_DETECTED'"}</span>
              {'\n\n'}
              <span className="text-emerald-400">✓</span>
              {' manifest checked\n'}
              <span className="text-emerald-400">✓</span>
              {' size limits enforced\n'}
              <span className="text-rose-400">✗</span>
              {' ../../etc/passwd rejected'}
            </Window>
          </FeatureCell>
        </section>

        {/* Two components */}
        <section className="border-b px-6 py-20 sm:px-10 md:py-28">
          <div className="text-center">
            <h2 className="mx-auto max-w-2xl text-4xl font-medium tracking-tight text-balance md:text-5xl">
              Two components to get going
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-fd-muted-foreground">
              Put the editor behind your admin route and render the saved document on your public
              pages.
            </p>
          </div>
          <div className="mt-12 grid gap-4 lg:grid-cols-2 [&_figure]:my-0 [&_figure]:h-full">
            <div className="min-w-0">
              <ServerCodeBlock
                code={editorCode}
                lang="tsx"
                themes={{ light: 'github-light', dark: 'github-dark' }}
                codeblock={{ title: 'Admin — editor (client only)' }}
              />
            </div>
            <div className="min-w-0">
              <ServerCodeBlock
                code={rendererCode}
                lang="tsx"
                themes={{ light: 'github-light', dark: 'github-dark' }}
                codeblock={{ title: 'Public page — renderer (Server Component)' }}
              />
            </div>
          </div>
          <div className="mt-8 text-center">
            <Link
              href="/docs/integration/nextjs"
              className="inline-flex items-center gap-1.5 text-sm font-medium text-blue-500 hover:underline"
            >
              Full Next.js integration <ArrowRight className="size-4" />
            </Link>
          </div>
        </section>

        {/* Packages */}
        <section className="border-b">
          <div className="px-6 pt-20 text-center sm:px-10 md:pt-28">
            <h2 className="mx-auto max-w-2xl text-4xl font-medium tracking-tight text-balance md:text-5xl">
              Modular packages, one direction
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-fd-muted-foreground">
              Every package depends only on the ones before it. Core stays pure TypeScript with zero
              framework dependencies.
            </p>
          </div>
          <div className="my-14 flex flex-wrap items-center justify-center gap-x-2 gap-y-3 px-6 sm:gap-x-0">
            {chain.map((name, i) => (
              <div key={name} className="flex items-center">
                <span
                  className={`rounded-md border px-3 py-2 font-mono text-sm ${
                    name === 'core'
                      ? 'border-blue-500 text-blue-500 shadow-[0_0_20px_-6px_rgba(59,130,246,0.8)]'
                      : 'bg-fd-card'
                  }`}
                >
                  {name}
                </span>
                {i < chain.length - 1 ? (
                  <span className="mx-1 hidden w-6 border-t border-dashed border-blue-500/60 sm:block" />
                ) : null}
              </div>
            ))}
          </div>
          <div className="grid gap-px border-t bg-fd-border sm:grid-cols-2 lg:grid-cols-4">
            {packages.map((pkg) => (
              <Link
                key={pkg.name}
                href={pkg.href}
                className="group bg-fd-background p-6 transition-colors hover:bg-fd-accent"
              >
                <span className="font-mono text-sm font-medium group-hover:text-blue-500">
                  {pkg.name}
                </span>
                <p className="mt-2 text-sm text-fd-muted-foreground">{pkg.body}</p>
              </Link>
            ))}
            <Link
              href="/docs"
              className="flex items-center gap-2 bg-fd-background p-6 text-sm font-medium text-blue-500 transition-colors hover:bg-fd-accent"
            >
              All package docs <ArrowRight className="size-4" />
            </Link>
          </div>
        </section>

        {/* Free & open source */}
        <section className="grid items-center gap-12 border-b px-6 py-20 sm:px-10 md:grid-cols-2 md:py-24">
          <div>
            <h2 className="text-3xl font-medium tracking-tight">Free &amp; open source</h2>
            <p className="mt-4 max-w-md text-fd-muted-foreground">
              KUBUILD is MIT licensed and will always be free and open source, with no lock-in: the documents are yours.
            </p>
            <a
              href={githubUrl}
              className="mt-8 inline-flex rounded-md border px-4 py-2 text-sm font-medium transition hover:bg-fd-accent"
            >
              Star on GitHub
            </a>
          </div>
          <div className="flex items-center justify-center gap-6">
            <div className="grid size-28 place-items-center rounded-2xl border border-blue-500/70 bg-[#05123E] text-[#E8EAFD] shadow-[0_6px_0_#1e40af,0_30px_60px_-20px_rgba(37,99,235,0.6)]">
              <KustoraMark className="size-14" />
            </div>
            <div>
              <p className="font-mono text-xs text-fd-muted-foreground">Brought to you by</p>
              <p className="text-3xl font-extrabold tracking-tight">KUSTORA</p>
            </div>
          </div>
        </section>

        {/* Final CTA */}
        <section className="bg-blue-600 bg-[radial-gradient(70%_100%_at_50%_120%,rgba(255,255,255,0.35),transparent_60%),repeating-linear-gradient(100deg,rgba(255,255,255,0.05)_0_2px,transparent_2px_16px)] px-6 py-24 text-center text-white md:py-32">
          <h2 className="text-4xl font-medium tracking-tight md:text-5xl">
            Start building with KUBUILD
          </h2>
          <p className="mx-auto mt-4 max-w-md text-white/80">
            Try the editor in your browser: load a template, edit it, and export a .stora package.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Link
              href="/playground"
              className="inline-flex items-center gap-2 rounded-md bg-white px-5 py-2.5 font-medium text-slate-900 transition hover:bg-white/90"
            >
              <Play className="size-4" /> Open the playground
            </Link>
            <Link
              href="/docs/getting-started/quickstart"
              className="rounded-md border border-white/40 px-5 py-2.5 font-medium transition hover:bg-white/10"
            >
              Get Started
            </Link>
          </div>
        </section>

        {/* Footer */}
        <footer>
          <div className="flex flex-wrap gap-x-16 gap-y-10 px-6 py-14 sm:px-10">
            {footerLinks.map((group) => (
              <nav key={group.title} aria-label={group.title}>
                <h2 className="font-mono text-xs text-fd-muted-foreground uppercase">
                  {group.title}
                </h2>
                <ul className="mt-4 space-y-2.5 text-sm">
                  {group.links.map(([label, href]) => (
                    <li key={href}>
                      <Link href={href} className="hover:text-blue-500">
                        {label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </nav>
            ))}
            <nav aria-label="Community" className="sm:ml-auto">
              <h2 className="font-mono text-xs text-fd-muted-foreground uppercase">Community</h2>
              <ul className="mt-4 space-y-2.5 text-sm">
                <li>
                  <a href={githubUrl} className="hover:text-blue-500">
                    GitHub
                  </a>
                </li>
                <li>
                  <a href={`${githubUrl}/issues`} className="hover:text-blue-500">
                    Issues
                  </a>
                </li>
              </ul>
            </nav>
          </div>
          <p className="border-t px-6 py-5 text-xs text-fd-muted-foreground sm:px-10">
            © {new Date().getFullYear()} Kustora · MIT License
          </p>
        </footer>
      </div>
    </main>
  );
}
