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
