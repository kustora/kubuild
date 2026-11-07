import type { SVGProps } from 'react';

/** KUBUILD brand mark — source of truth: assets/brand/kubuild-simbol-a-blok.svg. Colored via currentColor. */
export function KubuildMark(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" {...props}>
      <rect x="0.75" y="0.75" width="6.5" height="22.5" rx="1.25" />
      <rect x="8.75" y="8.75" width="6.5" height="6.5" rx="1.25" />
      <rect x="16.75" y="0.75" width="6.5" height="6.5" rx="1.25" />
      <rect x="16.75" y="16.75" width="6.5" height="6.5" rx="1.25" />
    </svg>
  );
}
