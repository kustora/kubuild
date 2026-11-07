'use client';

import { useState, type ReactNode } from 'react';

export function Mark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      className={className}
    >
      <rect x="3" y="3" width="7" height="7" rx="1.5" />
      <rect x="14" y="3" width="7" height="5" rx="1" />
      <rect x="14" y="11" width="7" height="10" rx="1.5" />
      <rect x="3" y="13" width="7" height="8" rx="1.5" />
    </svg>
  );
}

interface Layer {
  id: string;
  label: string;
  title: string;
  code: string;
  plate: string;
  face: ReactNode;
}

// One page of the sample "Spring Sale" document, exploded node by node.
const layers: Layer[] = [
  {
    id: 'stora',
    label: '.stora',
    title: 'spring-sale.stora · document.json',
    code: `{
  "schema": "stora.page",
  "version": "1.3.0",
  "document": {
    "id": "spring-sale",
    "type": "page",
    "children": ["hero"]
  }
}`,
    plate: 'border border-fd-muted-foreground/40 bg-fd-background',
    face: (
      <pre className="p-4 font-mono text-[9px] leading-snug text-fd-muted-foreground">
        {
          '{\n  "schema": "stora.page",\n  "version": "1.3.0",\n  "document": {\n    "type": "page",\n    "children": […]\n  }\n}'
        }
      </pre>
    ),
  },
  {
    id: 'section',
    label: 'section',
    title: 'hero · section',
    code: `{
  "id": "hero",
  "type": "section",
  "styles": {
    "base":   { "padding": "56px" },
    "mobile": { "padding": "32px" }
  },
  "children": [
    "hero-heading",
    "hero-button"
  ]
}`,
    plate: 'border border-fd-muted-foreground/40 bg-fd-card',
    face: <div className="absolute inset-5 rounded-xl border border-dashed border-blue-400/50" />,
  },
  {
    id: 'heading',
    label: 'heading',
    title: 'hero-heading · heading',
    code: `{
  "id": "hero-heading",
  "type": "heading",
  "props": {
    "text": "Spring Sale: 30% off",
    "level": 1
  },
  "styles": {
    "base": { "fontSize": "56px" },
    "mobile": { "fontSize": "34px" }
  }
}`,
    plate: 'border border-fd-muted-foreground/40 bg-fd-background/85',
    face: (
      <p className="absolute inset-x-6 top-1/2 -translate-y-1/2 text-[22px] leading-tight font-semibold tracking-tight">
        Spring Sale: 30% off
      </p>
    ),
  },
  {
    id: 'button',
    label: 'button',
    title: 'hero-button · button',
    code: `{
  "id": "hero-button",
  "type": "button",
  "props": {
    "label": "Claim the discount",
    "href": "#plans"
  }
}`,
    plate: 'border border-fd-muted-foreground/40 bg-fd-background/85',
    face: (
      <span className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 rounded-md bg-blue-600 px-3 py-1.5 text-[11px] font-semibold whitespace-nowrap text-white">
        Claim the discount
      </span>
    ),
  },
  {
    id: 'engine',
    label: 'renderer',
    title: 'page.tsx · Server Component',
    code: `import { KubuildRenderer } from '@kubuild/react';

// Walks the tree above and returns
// plain HTML + @media CSS.
<KubuildRenderer
  document={doc}
  responsive="css"
/>`,
    plate:
      'grid place-items-center border border-blue-500/70 bg-[#111a2e] shadow-[0_1px_0_#2563eb,0_2px_0_#2563eb,0_3px_0_#2563eb,0_4px_0_#1d4ed8,0_5px_0_#1d4ed8,0_6px_0_#1e40af,0_7px_0_#1e40af,0_8px_0_#1e3a8a,0_40px_60px_-20px_rgba(37,99,235,0.55)]',
    face: <Mark className="size-12 rotate-45 text-blue-400" />,
  },
];

const SPACING = 86; // vertical distance between plate centres
const TOP = 160;

/** The hero's exploded view of one document: hover or focus a layer to read its JSON. */
export function HeroLayers() {
  const [active, setActive] = useState('heading');
  const current = layers.find((l) => l.id === active) ?? layers[2];

  return (
    <div className="relative h-full min-h-[560px] [perspective:1400px]">
      {/* the spine every layer hangs on */}
      <div
        className="absolute left-1/2 border-l border-dashed xl:left-[35%] border-blue-500/50"
        style={{ top: TOP, height: SPACING * (layers.length - 1) }}
        aria-hidden
      />

      <ol aria-label="Layers of a .stora document">
        {layers.map((layer, i) => {
          const on = layer.id === active;
          return (
            <li
              key={layer.id}
              className="absolute left-1/2 size-0 xl:left-[35%] motion-safe:animate-[kb-drop_900ms_cubic-bezier(0.16,1,0.3,1)_both]"
              style={{
                top: TOP + i * SPACING,
                zIndex: layers.length - i,
                animationDelay: `${i * 90}ms`,
              }}
            >
              <div
                className={`transition-transform duration-300 ease-out ${on ? '-translate-y-3' : ''}`}
              >
                <button
                  type="button"
                  aria-pressed={on}
                  aria-label={`${layer.label} layer`}
                  onMouseEnter={() => setActive(layer.id)}
                  onFocus={() => setActive(layer.id)}
                  onClick={() => setActive(layer.id)}
                  className={`absolute size-48 overflow-hidden rounded-[24px] text-left transition-colors duration-300 outline-none [transform:translate(-50%,-50%)_rotateX(58deg)_rotateZ(-45deg)] focus-visible:ring-2 focus-visible:ring-blue-500 ${layer.plate} ${
                    on && layer.id !== 'engine' ? 'border-blue-500!' : ''
                  }`}
                >
                  {layer.face}
                </button>
                {/* label with a leader line, kept flat like a callout */}
                <span
                  className={`pointer-events-none absolute hidden -translate-y-1/2 xl:flex items-center gap-2 font-mono text-[11px] tracking-wider whitespace-nowrap uppercase transition-colors ${
                    on ? 'text-blue-500' : 'text-fd-muted-foreground'
                  }`}
                  style={{ right: 150 }}
                  aria-hidden
                >
                  {layer.label}
                  <span className="w-6 border-t border-dashed border-current" />
                </span>
              </div>
            </li>
          );
        })}
      </ol>

      {/* the JSON of whichever layer is active */}
      <div
        className="absolute top-14 right-4 hidden w-[min(300px,42%)] overflow-hidden xl:block rounded-md border border-white/10 bg-[#0f172a] font-mono text-[11.5px] leading-relaxed text-slate-300"
        aria-live="polite"
      >
        <div className="border-b border-white/10 px-4 py-2 text-[11px] text-blue-300">
          {current.title}
        </div>
        <pre className="overflow-x-auto px-4 py-3">{current.code}</pre>
      </div>
    </div>
  );
}
