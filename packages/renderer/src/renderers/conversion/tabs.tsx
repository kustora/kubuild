import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { RenderNodeContentOptions } from '../render-node-content';
import { childIndexContaining, readAriaLabel, readNumber } from './shared';

interface TabsContextValue {
  activeIndex: number;
  panelIds: string[];
  tabId: (index: number) => string;
}

const TabsContext = createContext<TabsContextValue | null>(null);

/** Clamps a requested tab index into `[0, count - 1]` (0 when there are no tabs). */
export function clampTabIndex(index: number, count: number): number {
  if (count <= 0 || !Number.isFinite(index)) return 0;
  return Math.min(Math.max(Math.trunc(index), 0), count - 1);
}

const TabsView: React.FC<{ options: RenderNodeContentOptions }> = ({ options }) => {
  const { node, domId, styles, mode, handleClick, childrenElements, selectedNodeId, onNodePropChange } =
    options;
  const panels = useMemo(() => node.children ?? [], [node.children]);
  const count = panels.length;
  const propIndex = clampTabIndex(readNumber(options, 'activeIndex', 0), count);
  const [active, setActive] = useState(propIndex);
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);

  // Keep local state in sync when the prop is changed from the inspector.
  useEffect(() => {
    setActive(propIndex);
  }, [propIndex]);

  const selectedPanel = mode === 'editor' ? childIndexContaining(node, selectedNodeId) : -1;
  const effectiveActive = clampTabIndex(selectedPanel >= 0 ? selectedPanel : active, count);

  const suffix = options.instanceSuffix ?? '';
  const tabId = (i: number) => `${domId}-tab-${i}`;
  const panelIds = panels.map((p) => `${p.id}${suffix}`);

  const activate = (i: number, focus = false) => {
    const next = clampTabIndex(i, count);
    setActive(next);
    if (focus) tabRefs.current[next]?.focus();
    // Editor: persist the chosen tab so the author can edit its panel (undoable prop change).
    if (mode === 'editor' && next !== propIndex) {
      onNodePropChange?.(node.id, 'activeIndex', next, true);
    }
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>, i: number) => {
    let next: number | null = null;
    if (e.key === 'ArrowRight') next = (i + 1) % count;
    else if (e.key === 'ArrowLeft') next = (i - 1 + count) % count;
    else if (e.key === 'Home') next = 0;
    else if (e.key === 'End') next = count - 1;
    if (next === null) return;
    e.preventDefault();
    activate(next, true);
  };

  const panelKey = panelIds.join('|');
  const contextValue = useMemo<TabsContextValue>(
    () => ({
      activeIndex: effectiveActive,
      panelIds: panelKey ? panelKey.split('|') : [],
      tabId: (i: number) => `${domId}-tab-${i}`,
    }),
    [effectiveActive, panelKey, domId],
  );

  return (
    <div id={domId} style={styles} onClick={handleClick} data-kubuild-node={node.id}>
      <div
        role="tablist"
        aria-label={readAriaLabel(options)}
        aria-orientation="horizontal"
        style={{ display: 'flex', gap: '4px', borderBottom: '1px solid #e2e8f0', overflowX: 'auto' }}
      >
        {panels.map((panel, i) => {
          const rawLabel = panel.props?.label;
          const label = typeof rawLabel === 'string' && rawLabel ? rawLabel : `Tab ${i + 1}`;
          const selected = i === effectiveActive;
          return (
            <button
              key={panel.id}
              ref={(el) => {
                tabRefs.current[i] = el;
              }}
              type="button"
              role="tab"
              id={tabId(i)}
              aria-selected={selected}
              aria-controls={panelIds[i]}
              tabIndex={selected ? 0 : -1}
              data-kubuild-tab-index={i}
              onClick={() => activate(i)}
              onKeyDown={(e) => onKeyDown(e, i)}
              style={{
                padding: '10px 16px',
                background: 'transparent',
                border: 'none',
                borderBottom: selected ? '2px solid currentColor' : '2px solid transparent',
                marginBottom: '-1px',
                font: 'inherit',
                fontWeight: selected ? 600 : 500,
                color: 'inherit',
                opacity: selected ? 1 : 0.65,
                cursor: 'pointer',
                whiteSpace: 'nowrap',
              }}
            >
              {label}
            </button>
          );
        })}
      </div>
      <TabsContext.Provider value={contextValue}>{childrenElements}</TabsContext.Provider>
    </div>
  );
};

const TabPanelView: React.FC<{ options: RenderNodeContentOptions }> = ({ options }) => {
  const { node, domId, styles, handleClick, childrenElements } = options;
  const ctx = useContext(TabsContext);
  const index = ctx ? ctx.panelIds.indexOf(domId) : -1;
  const isActive = !ctx || index === ctx.activeIndex;

  return (
    <div
      id={domId}
      style={isActive ? styles : { ...styles, display: 'none' }}
      onClick={handleClick}
      data-kubuild-node={node.id}
      role={ctx ? 'tabpanel' : undefined}
      aria-labelledby={ctx && index >= 0 ? ctx.tabId(index) : undefined}
      tabIndex={ctx ? 0 : undefined}
      hidden={!isActive}
    >
      {childrenElements}
    </div>
  );
};

export function renderTabs(options: RenderNodeContentOptions): React.ReactElement {
  return <TabsView options={options} />;
}

export function renderTabPanel(options: RenderNodeContentOptions): React.ReactElement {
  return <TabPanelView options={options} />;
}
