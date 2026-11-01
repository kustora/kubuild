import React from 'react';
import { ComponentCategory, CoreComponentType } from '@kubuild/components';
import { StyleSectorId } from '../components/style-manager/style-manager-accordion.js';

export type LeftSidebarTab = 'components' | 'blocks' | 'layers';

/**
 * Editor UI complexity mode:
 * - `'simple'`: Streamlined, beginner-friendly view (curated blocks/components, unified simple inspector, single-page focus).
 * - `'advance'`: Full studio & developer view with all CSS sectors, DOM layers, actions, and multi-artboard canvas.
 */
export type EditorMode = 'simple' | 'advance';

export type { CoreComponentType, ComponentCategory };

/**
 * Built-in component types or custom component string identifier.
 * Autocompletes standard component types in IDE IntelliSense while supporting custom registered components.
 */
export type ComponentTypeFilter = CoreComponentType | (string & {});

/**
 * Built-in component categories or custom category string identifier.
 * Autocompletes standard categories ('layout' | 'typography' | 'media' | 'form' | 'interactive' | 'data' | 'custom').
 */
export type ComponentCategoryFilter = ComponentCategory | (string & {});

/**
 * Curated list of essential, beginner-friendly components displayed in Simple Mode
 * when no custom `allowedComponents` or `hiddenComponents` filter is provided.
 */
export const SIMPLE_MODE_ALLOWED_COMPONENTS: ComponentTypeFilter[] = [
  'section',
  'columns',
  'divider',
  'spacer',
  'heading',
  'paragraph',
  'list',
  'image',
  'video',
  'button',
  'link',
  'form',
];

export interface EditorToolbarConfig {
  /** Display page title & status badge in toolbar. Default: true */
  showTitle?: boolean;
  /** Display the Simple | Advance mode switcher in toolbar. Default: true */
  showModeSwitcher?: boolean;
  /**
   * Display the AI Chat toggle button (STORA-504). Default: true.
   * The button is still hidden when AI is disabled entirely in `AiEditorConfig`
   * (no `ai` prop given, or every `features.*` flag is false) regardless of this flag.
   */
  showAiChatToggle?: boolean;
  /** Display Undo and Redo buttons. Default: true */
  showHistory?: boolean;
  /** Display Copy, Paste, Duplicate, and Delete buttons. Default: true in advance, false in simple */
  showClipboard?: boolean;
  /** Display "View Code" (< >) modal button. Default: true in advance, false in simple */
  showCodeViewer?: boolean;
  /** Display Pixel Tracking settings button in toolbar. Default: true */
  showTracking?: boolean;
  /** Display Import and Export (.stora / JSON) buttons. Default: true in advance, false in simple */
  showExportImport?: boolean;
  /** Display Viewport breakpoint switcher (desktop/tablet/mobile). Default: true */
  showViewportSwitcher?: boolean;
  /** Display Preview / Edit mode toggle button. Default: true */
  showPreviewToggle?: boolean;
  /** Display Action Debugger toggle button in preview mode. Default: true in advance, false in simple */
  showActionDebugger?: boolean;
  /** Display selected element ID badge on right side. Default: true in advance, false in simple */
  showSelectionStatus?: boolean;
  /** Custom extra actions or buttons rendered in the toolbar */
  customActions?: React.ReactNode;
}

export interface EditorSidebarConfig {
  /** Whether the left sidebar is enabled and visible. Default: true */
  enabled?: boolean;
  /** Default active tab ('components' | 'blocks' | 'layers'). Default: 'components' in advance, 'blocks' in simple */
  defaultTab?: LeftSidebarTab;
  /** List of tabs available for user navigation. Default: ['components', 'blocks', 'layers'] in advance, ['blocks', 'components'] in simple */
  availableTabs?: LeftSidebarTab[];
  /**
   * Whitelist of component types to display in the Components panel.
   * If specified, only components matching these types will be shown.
   *
   * Built-in component types:
   * `'page'` | `'section'` | `'container'` | `'columns'` | `'heading'` | `'text'` |
   * `'paragraph'` | `'link'` | `'blockquote'` | `'badge'` | `'code-block'` | `'image'` |
   * `'video'` | `'icon'` | `'html-embed'` | `'button'` | `'button-submit'` | `'form'` |
   * `'input'` | `'textarea'` | `'select'` | `'checkbox'` | `'switch'` | `'radio-group'` |
   * `'radio'` | `'radio-item'` | `'file-upload'` | `'collection'` | `'list'` | `'list-item'` |
   * `'table'` | `'table-row'` | `'table-cell'`
   */
  allowedComponents?: ComponentTypeFilter[];
  /**
   * Blacklist of component types to hide from the Components panel.
   * Components matching these types will not be displayed in the sidebar.
   *
   * Built-in component types:
   * `'page'` | `'section'` | `'container'` | `'columns'` | `'heading'` | `'text'` |
   * `'paragraph'` | `'link'` | `'blockquote'` | `'badge'` | `'code-block'` | `'image'` |
   * `'video'` | `'icon'` | `'html-embed'` | `'button'` | `'button-submit'` | `'form'` |
   * `'input'` | `'textarea'` | `'select'` | `'checkbox'` | `'switch'` | `'radio-group'` |
   * `'radio'` | `'radio-item'` | `'file-upload'` | `'collection'` | `'list'` | `'list-item'` |
   * `'table'` | `'table-row'` | `'table-cell'`
   */
  hiddenComponents?: ComponentTypeFilter[];
  /**
   * Whitelist of component categories to display in the Components panel.
   * If specified, only categories in this list will be shown.
   *
   * Standard categories:
   * `'layout'` | `'typography'` | `'media'` | `'form'` | `'interactive'` | `'data'` | `'custom'`
   */
  allowedCategories?: ComponentCategoryFilter[];
  /**
   * Blacklist of component categories to hide from the Components panel.
   * Categories matching this list will not be displayed.
   *
   * Standard categories:
   * `'layout'` | `'typography'` | `'media'` | `'form'` | `'interactive'` | `'data'` | `'custom'`
   */
  hiddenCategories?: ComponentCategoryFilter[];
}

export interface EditorCanvasConfig {
  /** Display hierarchy breadcrumbs bar below the canvas. Default: true in advance, false in simple */
  showBreadcrumbs?: boolean;
  /** Display floating action badges on selected node. Default: true */
  showFloatingBadges?: boolean;
}

export interface EditorInspectorConfig {
  /** Whether the right inspector panel is enabled and visible. Default: true */
  enabled?: boolean;
  /** Display Props tab/controls. Default: true */
  showProps?: boolean;
  /** Display Traits tab/controls. Default: true */
  showTraits?: boolean;
  /** Display Style Manager section. Default: true */
  showStyles?: boolean;
  /** Display pseudo-state selector (:hover, :active, :focus). Default: true in advance, false in simple */
  showStateSelector?: boolean;
  /**
   * Filter allowed style sectors ('dimension' | 'spacing' | 'typography' | 'decorations' | 'flex' | 'motion').
   * If omitted, all style sectors are visible.
   */
  allowedStyleSectors?: StyleSectorId[];
}

export interface EditorConfig {
  /** Editor complexity mode ('simple' | 'advance'). Default: 'advance' */
  mode?: EditorMode;
  /** Configure or toggle Top Toolbar. If false, toolbar is completely hidden. Default: true */
  toolbar?: boolean | EditorToolbarConfig;
  /** Configure or toggle Left Sidebar. If false, sidebar is completely hidden. Default: true */
  sidebar?: boolean | EditorSidebarConfig;
  /** Configure Canvas UI elements (breadcrumbs, floating badges). */
  canvas?: EditorCanvasConfig;
  /** Configure or toggle Right Inspector. If false, inspector is completely hidden. Default: true */
  inspector?: boolean | EditorInspectorConfig;
}

export interface ResolvedEditorConfig {
  mode: EditorMode;
  toolbar: {
    enabled: boolean;
    showTitle: boolean;
    showModeSwitcher: boolean;
    showAiChatToggle: boolean;
    showHistory: boolean;
    showClipboard: boolean;
    showCodeViewer: boolean;
    showTracking: boolean;
    showExportImport: boolean;
    showViewportSwitcher: boolean;
    showPreviewToggle: boolean;
    showActionDebugger: boolean;
    showSelectionStatus: boolean;
    customActions?: React.ReactNode;
  };
  sidebar: {
    enabled: boolean;
    defaultTab: LeftSidebarTab;
    availableTabs: LeftSidebarTab[];
    allowedComponents?: ComponentTypeFilter[];
    hiddenComponents?: ComponentTypeFilter[];
    allowedCategories?: ComponentCategoryFilter[];
    hiddenCategories?: ComponentCategoryFilter[];
  };
  canvas: {
    showBreadcrumbs: boolean;
    showFloatingBadges: boolean;
  };
  inspector: {
    enabled: boolean;
    showProps: boolean;
    showTraits: boolean;
    showStyles: boolean;
    showStateSelector: boolean;
    allowedStyleSectors?: StyleSectorId[];
  };
}

export function resolveEditorConfig(
  config?: EditorConfig,
  activeMode?: EditorMode,
): ResolvedEditorConfig {
  const mode: EditorMode = activeMode ?? config?.mode ?? 'advance';
  const isSimple = mode === 'simple';

  const toolbarOpt = config?.toolbar;
  const toolbarEnabled = toolbarOpt !== false;
  const toolbarCfg = typeof toolbarOpt === 'object' ? toolbarOpt : {};

  const sidebarOpt = config?.sidebar;
  const sidebarEnabled = sidebarOpt !== false && (typeof sidebarOpt !== 'object' || sidebarOpt.enabled !== false);
  const sidebarCfg = typeof sidebarOpt === 'object' ? sidebarOpt : {};

  const canvasCfg = config?.canvas ?? {};

  const inspectorOpt = config?.inspector;
  const inspectorEnabled = inspectorOpt !== false && (typeof inspectorOpt !== 'object' || inspectorOpt.enabled !== false);
  const inspectorCfg = typeof inspectorOpt === 'object' ? inspectorOpt : {};

  const defaultTabsForMode: LeftSidebarTab[] = isSimple
    ? ['blocks', 'components']
    : ['components', 'blocks', 'layers'];

  const availableTabs: LeftSidebarTab[] = sidebarCfg.availableTabs && sidebarCfg.availableTabs.length > 0
    ? sidebarCfg.availableTabs
    : defaultTabsForMode;

  const fallbackDefaultTab: LeftSidebarTab =
    isSimple && availableTabs.includes('blocks')
      ? 'blocks'
      : availableTabs[0] ?? 'components';

  const defaultTab: LeftSidebarTab = sidebarCfg.defaultTab && availableTabs.includes(sidebarCfg.defaultTab)
    ? sidebarCfg.defaultTab
    : fallbackDefaultTab;

  const allowedComponents =
    sidebarCfg.allowedComponents ??
    (isSimple && !sidebarCfg.hiddenComponents ? SIMPLE_MODE_ALLOWED_COMPONENTS : undefined);

  return {
    mode,
    toolbar: {
      enabled: toolbarEnabled,
      showTitle: toolbarCfg.showTitle ?? true,
      showModeSwitcher: toolbarCfg.showModeSwitcher ?? true,
      showAiChatToggle: toolbarCfg.showAiChatToggle ?? true,
      showHistory: toolbarCfg.showHistory ?? true,
      showClipboard: toolbarCfg.showClipboard ?? !isSimple,
      showCodeViewer: toolbarCfg.showCodeViewer ?? !isSimple,
      showTracking: toolbarCfg.showTracking ?? !isSimple,
      showExportImport: toolbarCfg.showExportImport ?? !isSimple,
      showViewportSwitcher: toolbarCfg.showViewportSwitcher ?? true,
      showPreviewToggle: toolbarCfg.showPreviewToggle ?? true,
      showActionDebugger: toolbarCfg.showActionDebugger ?? !isSimple,
      showSelectionStatus: toolbarCfg.showSelectionStatus ?? !isSimple,
      customActions: toolbarCfg.customActions,
    },
    sidebar: {
      enabled: sidebarEnabled,
      defaultTab,
      availableTabs,
      allowedComponents,
      hiddenComponents: sidebarCfg.hiddenComponents,
      allowedCategories: sidebarCfg.allowedCategories,
      hiddenCategories: sidebarCfg.hiddenCategories,
    },
    canvas: {
      showBreadcrumbs: canvasCfg.showBreadcrumbs ?? !isSimple,
      showFloatingBadges: canvasCfg.showFloatingBadges ?? true,
    },
    inspector: {
      enabled: inspectorEnabled,
      showProps: inspectorCfg.showProps ?? true,
      showTraits: inspectorCfg.showTraits ?? !isSimple,
      showStyles: inspectorCfg.showStyles ?? true,
      showStateSelector: inspectorCfg.showStateSelector ?? !isSimple,
      allowedStyleSectors: inspectorCfg.allowedStyleSectors,
    },
  };
}
