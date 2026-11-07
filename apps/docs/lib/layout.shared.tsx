import type { BaseLayoutProps } from 'fumadocs-ui/layouts/shared';
import { gitConfig } from './shared';

export function baseOptions(): BaseLayoutProps {
  return {
    nav: {
      title: (
        <div className="flex items-center gap-2.5 font-bold tracking-tight text-foreground select-none">
          <div className="flex size-7 items-center justify-center rounded-lg bg-gradient-to-tr from-indigo-600 via-violet-600 to-pink-500 text-white shadow-sm shadow-indigo-500/25 ring-1 ring-white/20">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="size-4"
            >
              <rect x="3" y="3" width="7" height="7" rx="1.5" />
              <rect x="14" y="3" width="7" height="5" rx="1" />
              <rect x="14" y="11" width="7" height="10" rx="1.5" />
              <rect x="3" y="13" width="7" height="8" rx="1.5" />
            </svg>
          </div>
          <span className="text-base font-extrabold tracking-tight">KUBUILD</span>
          <span className="rounded-md border border-neutral-300/80 bg-neutral-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-neutral-600 dark:border-neutral-700/80 dark:bg-neutral-800 dark:text-neutral-300">
            BUILDER-01
          </span>
        </div>
      ),
    },
    links: [
      {
        type: 'main',
        text: 'Docs',
        url: '/docs',
        active: 'nested-url',
      },
      {
        type: 'main',
        text: 'Playground',
        url: '/playground',
      },
    ],
    githubUrl: `https://github.com/${gitConfig.user}/${gitConfig.repo}`,
  };
}
