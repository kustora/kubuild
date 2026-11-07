# KUBUILD Docs

Documentation site for KUBUILD, built with [Next.js](https://nextjs.org) and
[Fumadocs](https://fumadocs.dev). It consumes the workspace packages (`@kubuild/*`) directly,
so interactive demos and the `/playground` always run against the current source.

## Development

From the repo root:

```bash
pnpm install
pnpm --filter docs dev      # http://localhost:3001
pnpm --filter docs build    # production build (builds upstream @kubuild/* packages first via turbo)
pnpm --filter docs typecheck
pnpm --filter docs lint
```

## Layout

| Path                          | Description                                                        |
| ----------------------------- | ------------------------------------------------------------------ |
| `content/docs/**`             | MDX pages. Sidebar order is controlled by each folder's `meta.json`. |
| `lib/source.ts`               | Content collection (Fumadocs MDX macro API) and MDX plugins.       |
| `lib/shared.ts`               | Site URL, routes, GitHub repo info.                                |
| `components/mdx.tsx`          | Components available in every MDX page.                            |
| `components/interactive-renderer.tsx` | `<InteractiveRenderer />` live demo used inside pages.     |
| `components/mermaid.tsx`      | Client-side renderer for ` ```mermaid ` code blocks.               |
| `app/playground`              | Full editor playground with starter templates.                     |
| `app/llms*.txt`, `app/llms.mdx` | Machine-readable docs for LLMs (`/llms.txt`, `/llms-full.txt`, `*.md`). |
| `app/og`                      | Generated Open Graph images.                                       |

## Writing docs

- Code samples must match the real package APIs. Import from the public entrypoints
  (`@kubuild/schema`, `@kubuild/core`, `@kubuild/react`, …) and check signatures against
  `packages/*/src` before publishing.
- Diagrams: use ` ```mermaid ` code blocks; they are rendered client-side.
- Write in English.
