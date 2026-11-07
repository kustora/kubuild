'use client';

import { useState } from 'react';
import { Check, Copy } from 'lucide-react';

const PACKAGES = '@kubuild/react @kubuild/schema lucide-react';

const managers = [
  { name: 'pnpm', command: `pnpm add ${PACKAGES}` },
  { name: 'npm', command: `npm install ${PACKAGES}` },
  { name: 'Yarn', command: `yarn add ${PACKAGES}` },
  { name: 'Bun', command: `bun add ${PACKAGES}` },
];

export function InstallTabs() {
  const [active, setActive] = useState(0);
  const [copied, setCopied] = useState(false);
  const { command } = managers[active];

  async function copy() {
    try {
      await navigator.clipboard.writeText(command);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className="overflow-hidden rounded-lg border bg-fd-card">
      <div role="tablist" aria-label="Package manager" className="flex border-b px-3">
        {managers.map((manager, i) => (
          <button
            key={manager.name}
            type="button"
            role="tab"
            aria-selected={i === active}
            onClick={() => setActive(i)}
            className={`relative px-3 py-3 text-sm transition-colors ${
              i === active
                ? 'text-fd-foreground after:absolute after:inset-x-3 after:-bottom-px after:h-0.5 after:bg-blue-500'
                : 'text-fd-muted-foreground hover:text-fd-foreground'
            }`}
          >
            {manager.name}
          </button>
        ))}
      </div>
      <div className="flex items-center gap-3 px-6 py-5">
        <code className="min-w-0 flex-1 overflow-x-auto font-mono text-sm whitespace-nowrap">
          <span className="text-blue-500 select-none">$ </span>
          {command}
        </code>
        <button
          type="button"
          onClick={copy}
          aria-label={copied ? 'Copied' : 'Copy install command'}
          className="rounded-md p-1.5 text-fd-muted-foreground transition-colors hover:bg-fd-accent hover:text-fd-foreground"
        >
          {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
        </button>
      </div>
    </div>
  );
}
