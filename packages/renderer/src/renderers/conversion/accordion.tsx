import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';
import type { Node } from '@kubuild/schema';
import type { RenderNodeContentOptions } from '../render-node-content';
import { readAriaLabel, readBoolean, readNumber, readString, subtreeContains } from './shared';

interface AccordionContextValue {
  rootDomId: string;
  itemIds: string[];
  openIndices: ReadonlySet<number>;
  toggle: (index: number) => void;
  icon: string;
}

const AccordionContext = createContext<AccordionContextValue | null>(null);

/**
 * Pure open-state transition for an accordion (exported for tests). In single-open
 * mode opening an item closes every other item; toggling an open item closes it.
 */
export function toggleAccordionIndex(
  open: ReadonlySet<number>,
  index: number,
  allowMultiple: boolean,
): Set<number> {
  if (open.has(index)) {
    const next = new Set(open);
    next.delete(index);
    return next;
  }
  if (!allowMultiple) return new Set([index]);
  const next = new Set(open);
  next.add(index);
  return next;
}

const TEXT_PROP_KEYS = ['text', 'content', 'quote', 'label', 'title', 'caption'];

function collectPlainText(node: Node, out: string[]): void {
  const props = node.props ?? {};
  for (const key of TEXT_PROP_KEYS) {
    const value = props[key];
    if (typeof value === 'string' && value.trim()) {
      out.push(value.trim());
      break;
    }
  }
  for (const child of node.children ?? []) collectPlainText(child, out);
}

/**
 * Builds schema.org `FAQPage` structured data from an accordion node: each
 * `accordion-item`'s `title` is the question and the plain text of its children is
 * the answer. Items without a literal title or answer are skipped. Returns `null`
 * when nothing usable remains.
 */
export function buildFaqJsonLd(accordion: Node): Record<string, unknown> | null {
  const mainEntity = (accordion.children ?? [])
    .filter((item) => item.type === 'accordion-item')
    .map((item) => {
      const title = item.props?.title;
      const answerParts: string[] = [];
      for (const child of item.children ?? []) collectPlainText(child, answerParts);
      if (typeof title !== 'string' || !title.trim() || answerParts.length === 0) return null;
      return {
        '@type': 'Question',
        name: title.trim(),
        acceptedAnswer: { '@type': 'Answer', text: answerParts.join(' ') },
      };
    })
    .filter((entry): entry is NonNullable<typeof entry> => entry !== null);

  if (mainEntity.length === 0) return null;
  return { '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity };
}

/** Serializes JSON for a `<script>` body so document text can never close the tag. */
export function serializeJsonForScript(value: unknown): string {
  return JSON.stringify(value)
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');
}

const AccordionView: React.FC<{ options: RenderNodeContentOptions }> = ({ options }) => {
  const { node, domId, styles, mode, handleClick, childrenElements } = options;
  const allowMultiple = readBoolean(options, 'allowMultiple', false);
  const defaultOpenIndex = Math.trunc(readNumber(options, 'defaultOpenIndex', 0));
  const icon = readString(options, 'icon', 'chevron');
  const faqSchema = readBoolean(options, 'faqSchema', false);

  const [openIndices, setOpenIndices] = useState<Set<number>>(() =>
    defaultOpenIndex >= 0 ? new Set([defaultOpenIndex]) : new Set(),
  );
  const toggle = useCallback(
    (index: number) => setOpenIndices((prev) => toggleAccordionIndex(prev, index, allowMultiple)),
    [allowMultiple],
  );

  const itemIds = useMemo(() => (node.children ?? []).map((c) => c.id), [node.children]);
  const contextValue = useMemo<AccordionContextValue>(
    () => ({ rootDomId: domId, itemIds, openIndices, toggle, icon }),
    [domId, itemIds, openIndices, toggle, icon],
  );

  const jsonLd = mode === 'runtime' && faqSchema ? buildFaqJsonLd(node) : null;

  return (
    <div
      id={domId}
      style={styles}
      onClick={handleClick}
      data-kubuild-node={node.id}
      data-kubuild-accordion={domId}
      aria-label={readAriaLabel(options)}
    >
      <AccordionContext.Provider value={contextValue}>{childrenElements}</AccordionContext.Provider>
      {jsonLd ? (
        <script
          type="application/ld+json"
          data-kubuild-faq-schema=""
          dangerouslySetInnerHTML={{ __html: serializeJsonForScript(jsonLd) }}
        />
      ) : null}
    </div>
  );
};

const AccordionIcon: React.FC<{ icon: string; open: boolean }> = ({ icon, open }) => {
  if (icon === 'none') return null;
  const common = {
    width: 16,
    height: 16,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 2,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    'aria-hidden': true,
    focusable: 'false' as const,
    style: { flexShrink: 0, transition: 'transform 200ms ease', transform: icon === 'chevron' && open ? 'rotate(180deg)' : undefined },
  };
  if (icon === 'plus') {
    return (
      <svg {...common}>
        <path d="M5 12h14" />
        {open ? null : <path d="M12 5v14" />}
      </svg>
    );
  }
  return (
    <svg {...common}>
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
};

const AccordionItemView: React.FC<{ options: RenderNodeContentOptions }> = ({ options }) => {
  const { node, domId, styles, mode, handleClick, childrenElements, selectedNodeId } = options;
  const ctx = useContext(AccordionContext);
  const [standaloneOpen, setStandaloneOpen] = useState(false);

  const index = ctx ? ctx.itemIds.indexOf(node.id) : -1;
  const stateOpen = ctx && index >= 0 ? ctx.openIndices.has(index) : standaloneOpen;
  // Editor: reveal an item whenever it (or something inside it) is selected.
  const isOpen = stateOpen || (mode === 'editor' && subtreeContains(node, selectedNodeId));
  const title = readString(options, 'title', 'Question');
  const headerId = `${domId}-header`;
  const panelId = `${domId}-panel`;
  const groupId = ctx?.rootDomId ?? domId;

  const onToggle = () => {
    if (ctx && index >= 0) ctx.toggle(index);
    else setStandaloneOpen((v) => !v);
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>) => {
    if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(e.key)) return;
    const root = e.currentTarget.closest(`[data-kubuild-accordion]`);
    if (!root) return;
    // Only this accordion's own headers (not those of an accordion nested inside an item).
    const triggers = Array.from(
      root.querySelectorAll<HTMLButtonElement>('button[data-kubuild-accordion-trigger]'),
    ).filter((el) => el.getAttribute('data-kubuild-accordion-trigger') === groupId);
    const current = triggers.indexOf(e.currentTarget);
    if (current < 0) return;
    e.preventDefault();
    const count = triggers.length;
    const nextIndex =
      e.key === 'Home'
        ? 0
        : e.key === 'End'
          ? count - 1
          : e.key === 'ArrowDown'
            ? (current + 1) % count
            : (current - 1 + count) % count;
    triggers[nextIndex]?.focus();
  };

  return (
    <div id={domId} style={styles} onClick={handleClick} data-kubuild-node={node.id} data-state={isOpen ? 'open' : 'closed'}>
      <button
        type="button"
        id={headerId}
        aria-expanded={isOpen}
        aria-controls={panelId}
        data-kubuild-accordion-trigger={groupId}
        onClick={onToggle}
        onKeyDown={onKeyDown}
        style={{
          display: 'flex',
          width: '100%',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '12px',
          padding: '16px 0',
          background: 'transparent',
          border: 'none',
          font: 'inherit',
          fontWeight: 600,
          color: 'inherit',
          textAlign: 'left',
          cursor: 'pointer',
        }}
      >
        <span>{title}</span>
        <AccordionIcon icon={ctx?.icon ?? 'chevron'} open={isOpen} />
      </button>
      <div
        id={panelId}
        role="region"
        aria-labelledby={headerId}
        hidden={!isOpen}
        style={{ paddingBottom: '16px' }}
      >
        {childrenElements}
      </div>
    </div>
  );
};

export function renderAccordion(options: RenderNodeContentOptions): React.ReactElement {
  return <AccordionView options={options} />;
}

export function renderAccordionItem(options: RenderNodeContentOptions): React.ReactElement {
  return <AccordionItemView options={options} />;
}
