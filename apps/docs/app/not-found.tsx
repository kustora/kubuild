import Link from 'next/link';
import { HomeLayout } from 'fumadocs-ui/layouts/home';
import { baseOptions } from '@/lib/layout.shared';

export default function NotFound() {
  return (
    <HomeLayout {...baseOptions()}>
      <main className="flex flex-1 flex-col items-center justify-center gap-4 px-4 py-24 text-center">
        <p className="text-sm font-semibold uppercase tracking-wider text-fd-muted-foreground">
          404
        </p>
        <h1 className="text-3xl font-bold tracking-tight">Page not found</h1>
        <p className="max-w-md text-fd-muted-foreground">
          The page you are looking for does not exist or has moved. Try the search (⌘K) or start
          from the documentation home.
        </p>
        <div className="flex gap-3">
          <Link
            href="/docs"
            className="rounded-lg bg-fd-primary px-4 py-2 text-sm font-medium text-fd-primary-foreground"
          >
            Documentation
          </Link>
          <Link href="/playground" className="rounded-lg border px-4 py-2 text-sm font-medium">
            Playground
          </Link>
        </div>
      </main>
    </HomeLayout>
  );
}
