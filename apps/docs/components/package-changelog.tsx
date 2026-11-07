import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { Markdown } from 'fumadocs-core/content/md';
import defaultMdxComponents from 'fumadocs-ui/mdx';

const PACKAGES = ['react', 'core', 'schema', 'components', 'renderer', 'editor', 'ai'] as const;

export type ChangelogPackage = (typeof PACKAGES)[number];

/**
 * Renders `packages/<name>/CHANGELOG.md` (written by Changesets) at build time.
 * Raw HTML in the changelog is dropped by the Markdown renderer, so text such as
 * `aria-errormessage="<id>-error"` can't break the page.
 */
export async function PackageChangelog({ name }: { name: ChangelogPackage }) {
  if (!PACKAGES.includes(name)) return null;

  const file = path.join(process.cwd(), '..', '..', 'packages', name, 'CHANGELOG.md');
  const source = await readFile(file, 'utf8').catch(() => null);
  if (source === null) {
    return <p>No changelog found for @kubuild/{name}.</p>;
  }

  // Drop the "# @kubuild/<name>" heading; the surrounding tab already names the package.
  const body = source.replace(/^# .*\n/, '');

  return <Markdown components={defaultMdxComponents}>{body}</Markdown>;
}
