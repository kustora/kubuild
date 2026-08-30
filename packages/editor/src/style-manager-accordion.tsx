import React, { useState, useEffect, useCallback } from 'react';
import { AnimationConfig, DEFAULT_ANIMATION_CONFIG } from '@kubuild/schema';
import { ComponentIcon } from './icons';
import { BoxModelEditor } from './box-model-editor';
import { DimensionSectorControls } from './dimension-sector-controls';
import { TypographySectorControls } from './typography-sector-controls';
import { MotionSectorControls } from './motion-sector-controls';

export type StyleSectorId = 'dimension' | 'spacing' | 'typography' | 'decorations' | 'flex' | 'motion';

export interface StyleSectorDefinition {
  id: StyleSectorId;
  label: string;
  icon: string;
  description?: string;
  properties: string[];
}

export const STYLE_SECTORS: StyleSectorDefinition[] = [
  {
    id: 'dimension',
    label: 'Dimension',
    icon: 'dimension',
    description: 'Width, height, min/max limits, display & overflow',
    properties: ['display', 'width', 'height', 'minWidth', 'maxWidth', 'minHeight', 'maxHeight', 'overflow'],
  },
  {
    id: 'spacing',
    label: 'Spacing (Box Model)',
    icon: 'spacing',
    description: 'Margin, border widths, padding & box dimensions',
    properties: [
      'marginTop',
      'marginRight',
      'marginBottom',
      'marginLeft',
      'paddingTop',
      'paddingRight',
      'paddingBottom',
      'paddingLeft',
      'borderTopWidth',
      'borderRightWidth',
      'borderBottomWidth',
      'borderLeftWidth',
    ],
  },
  {
    id: 'typography',
    label: 'Typography',
    icon: 'typography',
    description: 'Font family, size, weight, line-height, text color & align',
    properties: ['fontFamily', 'fontSize', 'fontWeight', 'lineHeight', 'letterSpacing', 'color', 'textAlign', 'textDecoration', 'textTransform'],
  },
  {
    id: 'decorations',
    label: 'Decorations',
    icon: 'decorations',
    description: 'Background, borders, radius, shadow & opacity',
    properties: ['backgroundColor', 'backgroundImage', 'borderStyle', 'borderWidth', 'borderColor', 'borderRadius', 'boxShadow', 'opacity'],
  },
  {
    id: 'flex',
    label: 'Flex / Alignment',
    icon: 'flex',
    description: 'Flex direction, alignment, wrapping & gap',
    properties: ['flexDirection', 'justifyContent', 'alignItems', 'flexWrap', 'gap', 'alignContent', 'flexGrow', 'flexShrink'],
  },
  {
    id: 'motion',
    label: 'Motion / Animation',
    icon: 'motion',
    description: 'Scroll entrance effects, duration, delay, hover & loop animations',
    properties: ['type', 'duration', 'delay', 'easing', 'once', 'hoverEffect', 'loopEffect'],
  },
];

export const STORAGE_KEY_ACCORDION = 'kubuild:style-manager-accordion';

export const DEFAULT_ACCORDION_STATE: Record<StyleSectorId, boolean> = {
  dimension: true,
  spacing: true,
  typography: false,
  decorations: false,
  flex: false,
  motion: false,
};

let memoryStorage: Record<string, string> = {};

export function getStorage(): {
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
  removeItem: (key: string) => void;
} {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      return window.localStorage;
    }
    if (typeof localStorage !== 'undefined') {
      return localStorage;
    }
  } catch {
    // restricted storage fallback
  }
  return {
    getItem: (k: string) => memoryStorage[k] ?? null,
    setItem: (k: string, v: string) => {
      memoryStorage[k] = v;
    },
    removeItem: (k: string) => {
      delete memoryStorage[k];
    },
  };
}

export function clearMemoryStorage(): void {
  memoryStorage = {};
}

export function loadAccordionState(): Record<StyleSectorId, boolean> {
  const storage = getStorage();
  try {
    const raw = storage.getItem(STORAGE_KEY_ACCORDION);
    if (!raw) return { ...DEFAULT_ACCORDION_STATE };
    const parsed = JSON.parse(raw);
    return {
      ...DEFAULT_ACCORDION_STATE,
      ...parsed,
    };
  } catch {
    return { ...DEFAULT_ACCORDION_STATE };
  }
}

export function saveAccordionState(state: Record<StyleSectorId, boolean>): void {
  const storage = getStorage();
  try {
    storage.setItem(STORAGE_KEY_ACCORDION, JSON.stringify(state));
  } catch {
    // ignore quota/security errors
  }
}

export interface StyleManagerAccordionProps {
  styles?: Record<string, unknown>;
  animation?: Partial<AnimationConfig>;
  onCommitStyle: (property: string, value: string) => void;
  onCommitAnimation?: (animation: Partial<AnimationConfig>) => void;
  onResetStyles?: (properties?: string[]) => void;
  onResetAnimation?: () => void;
  onReplayAnimation?: () => void;
  errors?: Record<string, string | null>;
  breakpoint?: 'base' | 'tablet' | 'mobile';
  className?: string;
  initialState?: Partial<Record<StyleSectorId, boolean>>;
  /** Optional filter for allowed style sectors. If omitted, all sectors are displayed. */
  allowedSectors?: StyleSectorId[];
}

export const StyleManagerAccordion: React.FC<StyleManagerAccordionProps> = ({
  styles = {},
  animation,
  onCommitStyle,
  onCommitAnimation,
  onResetStyles,
  onResetAnimation,
  onReplayAnimation,
  errors = {},
  breakpoint = 'base',
  className = '',
  initialState,
  allowedSectors,
}) => {
  const visibleSectors = React.useMemo(() => {
    if (!allowedSectors || allowedSectors.length === 0) return STYLE_SECTORS;
    return STYLE_SECTORS.filter((sector) => allowedSectors.includes(sector.id));
  }, [allowedSectors]);

  const [openState, setOpenState] = useState<Record<StyleSectorId, boolean>>(() => ({
    ...loadAccordionState(),
    ...initialState,
  }));

  const toggleSector = useCallback((sectorId: StyleSectorId) => {
    setOpenState((prev) => {
      const next = { ...prev, [sectorId]: !prev[sectorId] };
      saveAccordionState(next);
      return next;
    });
  }, []);

  const expandAll = useCallback(() => {
    const next: Record<StyleSectorId, boolean> = {
      dimension: true,
      spacing: true,
      typography: true,
      decorations: true,
      flex: true,
      motion: true,
    };
    setOpenState(next);
    saveAccordionState(next);
  }, []);

  const collapseAll = useCallback(() => {
    const next: Record<StyleSectorId, boolean> = {
      dimension: false,
      spacing: false,
      typography: false,
      decorations: false,
      flex: false,
      motion: false,
    };
    setOpenState(next);
    saveAccordionState(next);
  }, []);

  const handleResetSector = useCallback(
    (e: React.MouseEvent, sector: StyleSectorDefinition) => {
      e.stopPropagation();
      if (sector.id === 'motion') {
        if (onResetAnimation) {
          onResetAnimation();
        } else if (onCommitAnimation) {
          onCommitAnimation(DEFAULT_ANIMATION_CONFIG);
        }
        return;
      }

      if (onResetStyles) {
        onResetStyles(sector.properties);
      } else {
        sector.properties.forEach((prop) => {
          if (styles[prop] !== undefined && styles[prop] !== null && styles[prop] !== '') {
            onCommitStyle(prop, '');
          }
        });
      }
    },
    [onResetStyles, onCommitStyle, onResetAnimation, onCommitAnimation, styles],
  );

  const handleResetAll = useCallback(() => {
    if (onResetStyles) {
      onResetStyles();
    } else {
      Object.keys(styles).forEach((prop) => {
        if (styles[prop] !== undefined && styles[prop] !== null && styles[prop] !== '') {
          onCommitStyle(prop, '');
        }
      });
    }
    if (onResetAnimation) {
      onResetAnimation();
    } else if (onCommitAnimation) {
      onCommitAnimation(DEFAULT_ANIMATION_CONFIG);
    }
  }, [onResetStyles, onCommitStyle, onResetAnimation, onCommitAnimation, styles]);

  // Compute number of active custom properties per sector
  const getActivePropertyCount = (sector: StyleSectorDefinition): number => {
    if (sector.id === 'motion') {
      let count = 0;
      if (animation?.type && animation.type !== 'none') count++;
      if (animation?.delay !== undefined && animation.delay > 0) count++;
      if (animation?.hoverEffect && animation.hoverEffect !== 'none') count++;
      if (animation?.loopEffect && animation.loopEffect !== 'none') count++;
      return count;
    }

    return sector.properties.filter((prop) => {
      const val = styles[prop];
      return val !== undefined && val !== null && val !== '';
    }).length;
  };

  const isMotionActive =
    Boolean(animation?.type && animation.type !== 'none') ||
    Boolean(animation?.hoverEffect && animation.hoverEffect !== 'none') ||
    Boolean(animation?.loopEffect && animation.loopEffect !== 'none') ||
    Boolean(animation?.delay !== undefined && animation.delay > 0);

  const totalActiveStyles =
    Object.values(styles).filter(
      (val) => val !== undefined && val !== null && val !== '',
    ).length + (isMotionActive ? 1 : 0);

  return (
    <div className={`flex flex-col gap-2 w-full min-w-0 max-w-full ${className}`} data-testid="style-manager-accordion">
      {/* Top Header Controls — stacked in two rows so the narrow inspector
          panel (w-72) never overflows: title+badge on top, actions below. */}
      <div className="flex flex-col gap-1 px-1 py-0.5 min-w-0">
        <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 uppercase tracking-wide min-w-0">
          <span className="truncate">Style Manager</span>
          <span className="shrink-0 px-1.5 py-0.2 text-[10px] font-medium bg-slate-100 text-slate-600 rounded border border-slate-200">
            {breakpoint === 'base' ? 'base' : `${breakpoint} override`}
          </span>
        </div>
        <div className="flex items-center gap-1 flex-wrap">
          <button
            type="button"
            onClick={expandAll}
            title="Expand All Sectors"
            className="px-1.5 py-0.5 text-[10px] font-medium text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded transition whitespace-nowrap"
          >
            Expand All
          </button>
          <span className="text-slate-300 text-xs">|</span>
          <button
            type="button"
            onClick={collapseAll}
            title="Collapse All Sectors"
            className="px-1.5 py-0.5 text-[10px] font-medium text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded transition whitespace-nowrap"
          >
            Collapse All
          </button>
          {totalActiveStyles > 0 && (
            <>
              <span className="text-slate-300 text-xs">|</span>
              <button
                type="button"
                data-testid="style-manager-reset-all"
                onClick={handleResetAll}
                title="Reset all styles on active node"
                className="flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-medium text-red-600 hover:text-red-800 hover:bg-red-50 rounded transition whitespace-nowrap"
              >
                <ComponentIcon iconOrType="reset" size={11} />
                <span>Reset CSS</span>
              </button>
            </>
          )}
        </div>
      </div>

      {/* Accordion Sectors List */}
      <div className="flex flex-col gap-1.5">
        {visibleSectors.map((sector) => {
          const isOpen = Boolean(openState[sector.id]);
          const activeCount = getActivePropertyCount(sector);

          return (
            <div
              key={sector.id}
              data-testid={`sector-${sector.id}`}
              className="rounded-lg border border-slate-200 bg-white overflow-hidden shadow-2xs transition-colors"
            >
              {/* Sector Header / Toggle Button */}
              <button
                type="button"
                onClick={() => toggleSector(sector.id)}
                aria-expanded={isOpen}
                aria-controls={`sector-content-${sector.id}`}
                data-testid={`sector-header-${sector.id}`}
                className="w-full flex items-center justify-between px-3 py-2 text-left bg-slate-50/70 hover:bg-slate-100/70 transition cursor-pointer select-none"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-slate-500 shrink-0">
                    <ComponentIcon iconOrType={sector.icon} size={14} />
                  </span>
                  <span className="text-xs font-semibold text-slate-700 truncate">
                    {sector.label}
                  </span>
                  {activeCount > 0 && (
                    <span
                      title={`${activeCount} custom properties set`}
                      className="px-1.5 py-0.2 text-[9px] font-bold bg-blue-100 text-blue-700 rounded-full border border-blue-200 leading-none"
                    >
                      {activeCount}
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-1.5 shrink-0 ml-2">
                  {activeCount > 0 && (
                    <button
                      type="button"
                      data-testid={`sector-reset-${sector.id}`}
                      title={`Reset ${sector.label} styles`}
                      onClick={(e) => handleResetSector(e, sector)}
                      className="p-1 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded transition"
                    >
                      <ComponentIcon iconOrType="reset" size={11} />
                    </button>
                  )}
                  <span
                    className={`text-slate-400 transform transition-transform duration-200 ${
                      isOpen ? 'rotate-180' : 'rotate-0'
                    }`}
                  >
                    <ComponentIcon iconOrType="chevron-down" size={13} />
                  </span>
                </div>
              </button>

              {/* Sector Body / Animated Container */}
              {isOpen && (
                <div
                  id={`sector-content-${sector.id}`}
                  data-testid={`sector-body-${sector.id}`}
                  className="p-3 border-t border-slate-100 bg-white animate-fadeIn"
                >
                  {sector.id === 'spacing' && (
                    <div className="flex flex-col gap-3">
                      {/* Visual Box Model Diagram */}
                      <BoxModelEditor
                        values={styles}
                        onChange={(prop, val) => onCommitStyle(prop, val)}
                      />

                      {/* Quick Field Grid */}
                      <div className="pt-2 border-t border-slate-100">
                        <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
                          Side Inputs
                        </div>
                        <div className="grid grid-cols-2 gap-2 text-xs">
                          {['marginTop', 'marginRight', 'marginBottom', 'marginLeft', 'paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft'].map(
                            (prop) => (
                              <div key={prop} className="flex items-center justify-between gap-1 bg-slate-50 px-2 py-1 rounded border border-slate-200">
                                <span className="text-[11px] text-slate-500 font-medium truncate">
                                  {prop.replace(/([A-Z])/g, ' $1').toLowerCase()}
                                </span>
                                <input
                                  type="text"
                                  placeholder="0"
                                  value={String(styles[prop] ?? '')}
                                  onChange={(e) => onCommitStyle(prop, e.target.value)}
                                  className="w-14 text-right font-mono text-[11px] bg-white border border-slate-200 rounded px-1.5 py-0.5 focus:outline-none focus:ring-1 focus:ring-blue-500"
                                />
                              </div>
                            ),
                          )}
                        </div>
                      </div>
                    </div>
                  )}

                  {sector.id === 'dimension' && (
                    <DimensionSectorControls
                      styles={styles}
                      onChange={onCommitStyle}
                    />
                  )}

                  {sector.id === 'typography' && (
                    <TypographySectorControls
                      styles={styles}
                      onChange={onCommitStyle}
                    />
                  )}

                  {sector.id === 'decorations' && (
                    <div className="flex flex-col gap-2.5">
                      <div>
                        <label className="block text-[11px] font-medium text-slate-600 mb-1">Background Color</label>
                        <div className="flex items-center gap-1.5">
                          <input
                            type="color"
                            value={typeof styles.backgroundColor === 'string' && styles.backgroundColor.startsWith('#') ? styles.backgroundColor : '#ffffff'}
                            onChange={(e) => onCommitStyle('backgroundColor', e.target.value)}
                            className="w-7 h-7 rounded border border-slate-300 cursor-pointer p-0.5"
                          />
                          <input
                            type="text"
                            placeholder="transparent / #ffffff"
                            value={String(styles.backgroundColor ?? '')}
                            onChange={(e) => onCommitStyle('backgroundColor', e.target.value)}
                            className="w-full text-xs bg-white border border-slate-300 rounded px-2 py-1 focus:outline-none font-mono"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="block text-[11px] font-medium text-slate-600 mb-1">Border Radius</label>
                          <input
                            type="text"
                            placeholder="0px"
                            value={String(styles.borderRadius ?? '')}
                            onChange={(e) => onCommitStyle('borderRadius', e.target.value)}
                            className="w-full text-xs bg-white border border-slate-300 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-blue-500 font-mono"
                          />
                        </div>
                        <div>
                          <label className="block text-[11px] font-medium text-slate-600 mb-1">Border Style</label>
                          <select
                            value={String(styles.borderStyle ?? 'none')}
                            onChange={(e) => onCommitStyle('borderStyle', e.target.value)}
                            className="w-full text-xs bg-white text-slate-900 border border-slate-300 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-blue-500"
                          >
                            <option value="none">None</option>
                            <option value="solid">Solid</option>
                            <option value="dashed">Dashed</option>
                            <option value="dotted">Dotted</option>
                          </select>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="block text-[11px] font-medium text-slate-600 mb-1">Border Color</label>
                          <input
                            type="text"
                            placeholder="#e2e8f0"
                            value={String(styles.borderColor ?? '')}
                            onChange={(e) => onCommitStyle('borderColor', e.target.value)}
                            className="w-full text-xs bg-white border border-slate-300 rounded px-2 py-1 focus:outline-none font-mono"
                          />
                        </div>
                        <div>
                          <label className="block text-[11px] font-medium text-slate-600 mb-1">Box Shadow</label>
                          <input
                            type="text"
                            placeholder="none"
                            value={String(styles.boxShadow ?? '')}
                            onChange={(e) => onCommitStyle('boxShadow', e.target.value)}
                            className="w-full text-xs bg-white border border-slate-300 rounded px-2 py-1 focus:outline-none font-mono"
                          />
                        </div>
                      </div>
                    </div>
                  )}

                  {sector.id === 'flex' && (
                    <div className="flex flex-col gap-2.5">
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="block text-[11px] font-medium text-slate-600 mb-1">Direction</label>
                          <select
                            value={String(styles.flexDirection ?? 'row')}
                            onChange={(e) => onCommitStyle('flexDirection', e.target.value)}
                            className="w-full text-xs bg-white text-slate-900 border border-slate-300 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-blue-500"
                          >
                            <option value="row">Row (Horizontal)</option>
                            <option value="column">Column (Vertical)</option>
                            <option value="row-reverse">Row Reverse</option>
                            <option value="column-reverse">Column Reverse</option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-[11px] font-medium text-slate-600 mb-1">Wrap</label>
                          <select
                            value={String(styles.flexWrap ?? 'nowrap')}
                            onChange={(e) => onCommitStyle('flexWrap', e.target.value)}
                            className="w-full text-xs bg-white text-slate-900 border border-slate-300 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-blue-500"
                          >
                            <option value="nowrap">No Wrap</option>
                            <option value="wrap">Wrap</option>
                            <option value="wrap-reverse">Wrap Reverse</option>
                          </select>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="block text-[11px] font-medium text-slate-600 mb-1">Justify Content</label>
                          <select
                            value={String(styles.justifyContent ?? 'flex-start')}
                            onChange={(e) => onCommitStyle('justifyContent', e.target.value)}
                            className="w-full text-xs bg-white text-slate-900 border border-slate-300 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-blue-500"
                          >
                            <option value="flex-start">Start</option>
                            <option value="center">Center</option>
                            <option value="flex-end">End</option>
                            <option value="space-between">Space Between</option>
                            <option value="space-around">Space Around</option>
                            <option value="space-evenly">Space Evenly</option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-[11px] font-medium text-slate-600 mb-1">Align Items</label>
                          <select
                            value={String(styles.alignItems ?? 'stretch')}
                            onChange={(e) => onCommitStyle('alignItems', e.target.value)}
                            className="w-full text-xs bg-white text-slate-900 border border-slate-300 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-blue-500"
                          >
                            <option value="stretch">Stretch</option>
                            <option value="flex-start">Start</option>
                            <option value="center">Center</option>
                            <option value="flex-end">End</option>
                            <option value="baseline">Baseline</option>
                          </select>
                        </div>
                      </div>

                      <div>
                        <label className="block text-[11px] font-medium text-slate-600 mb-1">Gap</label>
                        <input
                          type="text"
                          placeholder="0px / 1rem"
                          value={String(styles.gap ?? '')}
                          onChange={(e) => onCommitStyle('gap', e.target.value)}
                          className="w-full text-xs bg-white border border-slate-300 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-blue-500 font-mono"
                        />
                      </div>
                    </div>
                  )}

                  {sector.id === 'motion' && (
                    <MotionSectorControls
                      animation={animation}
                      onChange={onCommitAnimation ?? (() => {})}
                      onReplay={onReplayAnimation}
                    />
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
