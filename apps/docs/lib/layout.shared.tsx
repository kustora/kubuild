import type { BaseLayoutProps } from 'fumadocs-ui/layouts/shared';
import { gitConfig } from './shared';
import { KubuildMark } from '@/components/kubuild-logo';

export function baseOptions(): BaseLayoutProps {
  return {
    nav: {
      title: (
        <div className="flex items-center gap-2.5 font-bold tracking-tight text-foreground select-none">
          <KubuildMark className="size-6 text-blue-600 dark:text-blue-500" />
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
