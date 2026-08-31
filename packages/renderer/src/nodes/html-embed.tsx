import React, { useRef, useLayoutEffect, useEffect, useMemo } from 'react';

const useIsomorphicLayoutEffect = typeof window !== 'undefined' ? useLayoutEffect : useEffect;

/**
 * Scopes custom CSS rules in embed HTML so body/html rules don't leak into the canvas.
 */
export function transformEmbedHtml(rawHtml: string): string {
  if (!rawHtml) return '';

  return rawHtml.replace(/<style\b([^>]*)>([\s\S]*?)<\/style>/gi, (_match, attrs, cssContent) => {
    let transformedCss = cssContent;
    // Replace "body {" or "body," with ":host, body {"
    transformedCss = transformedCss.replace(/(^|[\s,{}])body(?=[\s,{])/g, '$1:host, body');
    // Replace "html {" or "html," with ":host, html {"
    transformedCss = transformedCss.replace(/(^|[\s,{}])html(?=[\s,{])/g, '$1:host, html');

    return `<style${attrs}>\n:host { display: block; }\n${transformedCss}</style>`;
  });
}

export interface HtmlEmbedViewProps {
  id?: string;
  style?: React.CSSProperties;
  onClick?: (e: React.MouseEvent) => void;
  dataKubuildNode?: string;
  html: string;
  role?: string;
}

export const HtmlEmbedView: React.FC<HtmlEmbedViewProps> = ({
  id,
  style,
  onClick,
  dataKubuildNode,
  html,
  role,
}) => {
  const hostRef = useRef<HTMLDivElement>(null);
  const shadowRootRef = useRef<ShadowRoot | null>(null);

  const scopedHtml = useMemo(() => transformEmbedHtml(html), [html]);

  useIsomorphicLayoutEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    if (typeof host.attachShadow === 'function') {
      if (!shadowRootRef.current) {
        if (host.shadowRoot) {
          shadowRootRef.current = host.shadowRoot;
        } else {
          try {
            shadowRootRef.current = host.attachShadow({ mode: 'open' });
          } catch {
            shadowRootRef.current = host.shadowRoot;
          }
        }
      }

      if (shadowRootRef.current) {
        shadowRootRef.current.innerHTML = scopedHtml;
        return;
      }
    }

    host.innerHTML = scopedHtml;
  }, [scopedHtml]);

  return (
    <div
      ref={hostRef}
      id={id}
      style={style}
      onClick={onClick}
      data-kubuild-node={dataKubuildNode}
      role={role}
    >
      <template
        // @ts-expect-error Declarative shadow root for SSR
        shadowrootmode="open"
        dangerouslySetInnerHTML={{ __html: scopedHtml }}
      />
    </div>
  );
};

