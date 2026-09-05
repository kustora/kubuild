import React from 'react';
import { RotateCcw } from 'lucide-react';

export type Breakpoint = 'base' | 'desktop' | 'tablet' | 'mobile';

export interface PropertyInheritanceStatus {
  isOverridden: boolean;
  isInherited: boolean;
  isBase: boolean;
  inheritedValue?: unknown;
  activeValue?: unknown;
}

/**
 * Evaluates whether a property in the active viewport/breakpoint is:
 * - isOverridden: explicitly defined in the active non-base viewport layer.
 * - isInherited: not defined in the active viewport, but defined in base.
 * - isBase: active breakpoint is 'base' or 'desktop' (the canonical base style layer).
 */
export function getPropertyInheritanceStatus(
  property: string,
  activeBreakpoint: Breakpoint,
  activeStyles?: Record<string, unknown>,
  baseStyles?: Record<string, unknown>,
): PropertyInheritanceStatus {
  const isBase = activeBreakpoint === 'base' || activeBreakpoint === 'desktop';
  const activeVal = activeStyles?.[property];
  const baseVal = baseStyles?.[property];

  const hasActiveVal = activeVal !== undefined && activeVal !== null && activeVal !== '';
  const hasBaseVal = baseVal !== undefined && baseVal !== null && baseVal !== '';

  if (isBase) {
    return {
      isOverridden: false,
      isInherited: false,
      isBase: true,
      activeValue: hasActiveVal ? activeVal : baseVal,
      inheritedValue: undefined,
    };
  }

  if (hasActiveVal) {
    return {
      isOverridden: true,
      isInherited: false,
      isBase: false,
      activeValue: activeVal,
      inheritedValue: hasBaseVal ? baseVal : undefined,
    };
  }

  if (hasBaseVal) {
    return {
      isOverridden: false,
      isInherited: true,
      isBase: false,
      activeValue: undefined,
      inheritedValue: baseVal,
    };
  }

  return {
    isOverridden: false,
    isInherited: false,
    isBase: false,
    activeValue: undefined,
    inheritedValue: undefined,
  };
}

/**
 * Returns a list of all style properties explicitly overridden in the active viewport.
 */
export function getOverriddenProperties(
  activeBreakpoint: Breakpoint,
  activeStyles?: Record<string, unknown>,
  _baseStyles?: Record<string, unknown>,
): string[] {
  if (activeBreakpoint === 'base' || activeBreakpoint === 'desktop' || !activeStyles) {
    return [];
  }
  return Object.keys(activeStyles).filter((prop) => {
    const val = activeStyles[prop];
    return val !== undefined && val !== null && val !== '';
  });
}

export interface InheritanceIndicatorProps {
  property: string;
  activeBreakpoint: Breakpoint;
  activeStyles?: Record<string, unknown>;
  baseStyles?: Record<string, unknown>;
  onResetToInherited?: (property: string) => void;
  label?: string;
  showWatermark?: boolean;
  compact?: boolean;
  className?: string;
}

/**
 * Visual Style Inheritance Indicator (STORA-140 & STORA-141)
 *
 * Renders:
 * - Bold blue/orange dot indicator + "Overridden" badge + "Reset to Inherited" button when overridden.
 * - Subtle watermark & neutral text indicator when inherited from base.
 * - Nothing or neutral base label when inspecting canonical base styles.
 */
export const InheritanceIndicator: React.FC<InheritanceIndicatorProps> = ({
  property,
  activeBreakpoint,
  activeStyles = {},
  baseStyles = {},
  onResetToInherited,
  showWatermark = true,
  compact = false,
  className = '',
}) => {
  const status = getPropertyInheritanceStatus(property, activeBreakpoint, activeStyles, baseStyles);

  if (status.isBase) {
    return null;
  }

  if (status.isOverridden) {
    return (
      <div
        data-testid={`inheritance-indicator-${property}`}
        data-status="overridden"
        className={`inline-flex items-center gap-1.5 ${className}`}
      >
        {/* Bold Blue/Orange Accent Dot Indicator (STORA-140) */}
        <span
          data-testid={`style-override-dot-${property}`}
          className="w-2 h-2 rounded-full bg-blue-600 ring-2 ring-blue-100 shrink-0 inline-block"
          title={`Overridden locally in ${activeBreakpoint}`}
        />
        {!compact && (
          <span
            data-testid={`style-override-badge-${property}`}
            className="text-[9px] font-semibold text-blue-600 bg-blue-50 border border-blue-200 px-1 py-0.2 rounded leading-none uppercase tracking-wider"
          >
            Override
          </span>
        )}
        {/* STORA-141: Reset to Inherited Action */}
        {onResetToInherited && (
          <button
            type="button"
            data-testid={`reset-inherited-${property}`}
            onClick={(e) => {
              e.stopPropagation();
              onResetToInherited(property);
            }}
            title={`Reset ${property} to inherited value${status.inheritedValue !== undefined ? ` (${String(status.inheritedValue)})` : ''}`}
            className="p-0.5 text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded transition inline-flex items-center gap-0.5 cursor-pointer ml-0.5"
          >
            <RotateCcw className="w-2.5 h-2.5" />
            {!compact && <span className="text-[9px] font-medium">Reset</span>}
          </button>
        )}
      </div>
    );
  }

  if (status.isInherited) {
    return (
      <div
        data-testid={`inheritance-indicator-${property}`}
        data-status="inherited"
        className={`inline-flex items-center gap-1 min-w-0 ${className}`}
      >
        {/* Subtle Neutral Gray Dot Indicator */}
        <span
          data-testid={`style-inherited-dot-${property}`}
          className="w-1.5 h-1.5 rounded-full bg-slate-300 shrink-0 inline-block"
          title={`Inherited from base (${String(status.inheritedValue)})`}
        />
        {/* Subtle Watermark for Inherited Values (STORA-140) */}
        {showWatermark && (
          <span
            data-testid={`style-inherited-watermark-${property}`}
            className="text-[10px] text-slate-400 font-normal italic truncate"
            title={`Inherited from base: ${String(status.inheritedValue)}`}
          >
            {`Inherited${status.inheritedValue !== undefined ? `: ${String(status.inheritedValue)}` : ''}`}
          </span>
        )}
      </div>
    );
  }

  return null;
};

export interface InheritanceSummaryBarProps {
  activeBreakpoint: Breakpoint;
  activeStyles?: Record<string, unknown>;
  baseStyles?: Record<string, unknown>;
  onResetAllOverrides?: () => void;
  className?: string;
}

/**
 * Top summary banner for the Inspector when viewing responsive overrides (STORA-140 & STORA-141).
 */
export const InheritanceSummaryBar: React.FC<InheritanceSummaryBarProps> = ({
  activeBreakpoint,
  activeStyles = {},
  baseStyles = {},
  onResetAllOverrides,
  className = '',
}) => {
  const isBase = activeBreakpoint === 'base' || activeBreakpoint === 'desktop';
  if (isBase) return null;

  const overriddenProps = getOverriddenProperties(activeBreakpoint, activeStyles, baseStyles);
  const overriddenCount = overriddenProps.length;

  const basePropCount = Object.keys(baseStyles).filter((k) => {
    const val = baseStyles[k];
    return val !== undefined && val !== null && val !== '';
  }).length;

  const bpName = activeBreakpoint.charAt(0).toUpperCase() + activeBreakpoint.slice(1);
  const overrideCountLabel = `${overriddenCount} ${overriddenCount === 1 ? 'override' : 'overrides'}`;
  const inheritedRemaining = basePropCount - overriddenCount;
  const inheritedNote = inheritedRemaining > 0 ? `(${inheritedRemaining} inherited from base)` : '';

  return (
    <div
      data-testid="inheritance-summary-bar"
      className={`flex items-center justify-between px-2.5 py-1.5 bg-amber-50/80 border border-amber-200/80 rounded-md text-xs text-amber-900 ${className}`}
    >
      <div className="flex items-center gap-1.5 min-w-0">
        <span className="w-2 h-2 rounded-full bg-amber-500 shrink-0 animate-pulse" />
        <span className="font-semibold capitalize truncate">{`${bpName} Overrides:`}</span>
        <span className="text-[11px] text-amber-700">{overrideCountLabel}</span>
        {inheritedNote && (
          <span className="text-[10px] text-amber-600/80 italic">{inheritedNote}</span>
        )}
      </div>

      {overriddenCount > 0 && onResetAllOverrides && (
        <button
          type="button"
          data-testid="reset-all-viewport-overrides"
          onClick={onResetAllOverrides}
          title={`Reset all overrides on ${activeBreakpoint} layer`}
          className="px-2 py-0.5 text-[10px] font-semibold text-amber-800 hover:text-amber-950 bg-amber-100 hover:bg-amber-200 border border-amber-300 rounded transition flex items-center gap-1 cursor-pointer shrink-0"
        >
          <RotateCcw className="w-2.5 h-2.5" />
          <span>Reset All</span>
        </button>
      )}
    </div>
  );
};
