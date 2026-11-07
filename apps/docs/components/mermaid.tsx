'use client';

import { useEffect, useId, useState } from 'react';

function useIsDark(): boolean {
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    const root = document.documentElement;
    const update = () => setIsDark(root.classList.contains('dark'));
    update();
    const observer = new MutationObserver(update);
    observer.observe(root, { attributes: true, attributeFilter: ['class'] });
    return () => observer.disconnect();
  }, []);

  return isDark;
}

/**
 * Renders a Mermaid diagram on the client. `mermaid` code blocks are turned into
 * `<Mermaid chart="..." />` by `remarkMdxMermaid` (see `lib/source.ts`).
 */
export function Mermaid({ chart }: { chart: string }) {
  const id = useId().replace(/[^a-zA-Z0-9]/g, '');
  const isDark = useIsDark();
  const [svg, setSvg] = useState<string>();
  const [error, setError] = useState<string>();

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      try {
        const { default: mermaid } = await import('mermaid');
        mermaid.initialize({
          startOnLoad: false,
          securityLevel: 'strict',
          fontFamily: 'inherit',
          theme: isDark ? 'dark' : 'default',
        });
        const result = await mermaid.render(`mermaid-${id}`, chart.replaceAll('\\n', '\n'));
        if (!cancelled) {
          setSvg(result.svg);
          setError(undefined);
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : String(err));
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [chart, id, isDark]);

  if (error) {
    return (
      <pre className="my-4 overflow-x-auto rounded-lg border border-fd-error/40 p-4 text-xs">
        {`Mermaid render error: ${error}\n\n${chart}`}
      </pre>
    );
  }

  return (
    <div
      className="my-6 flex justify-center overflow-x-auto [&_svg]:max-w-full"
      // Mermaid output is generated with securityLevel 'strict' from first-party content.
      dangerouslySetInnerHTML={{ __html: svg ?? '' }}
    />
  );
}
