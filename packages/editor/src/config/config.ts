import React from 'react';
import { ComponentCategory, CoreComponentType } from '@kubuild/components';
import { StyleSectorId } from '../components/style-manager/style-manager-accordion';

export type LeftSidebarTab = 'components' | 'blocks' | 'layers';

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

export interface EditorToolbarConfig {
  /** Display page title & status badge in toolbar. Default: true */
  showTitle?: boolean;
  /** Display Navigator (element tree) toggle button. Default: true */
  showNavigatorToggle?: boolean;
  /** Display Undo and Redo buttons. Default: true */
  showHistory?: boolean;
  /** Display Copy, Paste, Duplicate, and Delete buttons. Default: true */
  showClipboard?: boolean;
  /** Display "View Code" (< >) modal button. Default: true */
  showCodeViewer?: boolean;
  /** Display Import and Export (.stora / JSON) buttons. Default: true */
  showExportImport?: boolean;
  /** Display Viewport breakpoint switcher (desktop/tablet/mobile). Default: true */
  showViewportSwitcher?: boolean;
  /** Display Preview / Edit mode toggle button. Default: true */
  showPreviewToggle?: boolean;
  /** Display Action Debugger toggle button in preview mode. Default: true */
  showActionDebugger?: boolean;
  /** Display selected element ID badge on right side. Default: true */
  showSelectionStatus?: boolean;
  /** Custom extra actions or buttons rendered in the toolbar */
  customActions?: React.ReactNode;
}

export interface EditorSidebarConfig {
  /** Whether the left sidebar is enabled and visible. Default: true */
  enabled?: boolean;
  /** Default active tab ('components' | 'blocks' | 'layers'). Default: 'components' */
  defaultTab?: LeftSidebarTab;
  /** List of tabs available for user navigation. Default: ['components', 'blocks', 'layers'] */
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
  /** Display hierarchy breadcrumbs bar below the canvas. Default: true */
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
  /** Display pseudo-state selector (:hover, :active, :focus). Default: true */
  showStateSelector?: boolean;
  /**
   * Filter allowed style sectors ('dimension' | 'spacing' | 'typography' | 'decorations' | 'flex' | 'motion').
   * If omitted, all style sectors are visible.
   */
  allowedStyleSectors?: StyleSectorId[];
}

export interface EditorConfig {
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
  toolbar: {
    enabled: boolean;
    showTitle: boolean;
    showNavigatorToggle: boolean;
    showHistory: boolean;
    showClipboard: boolean;
    showCodeViewer: boolean;
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

export function resolveEditorConfig(config?: EditorConfig): ResolvedEditorConfig {
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

  const availableTabs: LeftSidebarTab[] = sidebarCfg.availableTabs && sidebarCfg.availableTabs.length > 0
    ? sidebarCfg.availableTabs
    : ['components', 'blocks', 'layers'];

  const defaultTab: LeftSidebarTab = sidebarCfg.defaultTab && availableTabs.includes(sidebarCfg.defaultTab)
    ? sidebarCfg.defaultTab
    : availableTabs[0] ?? 'components';

  return {
    toolbar: {
      enabled: toolbarEnabled,
      showTitle: toolbarCfg.showTitle ?? true,
      showNavigatorToggle: toolbarCfg.showNavigatorToggle ?? true,
      showHistory: toolbarCfg.showHistory ?? true,
      showClipboard: toolbarCfg.showClipboard ?? true,
      showCodeViewer: toolbarCfg.showCodeViewer ?? true,
      showExportImport: toolbarCfg.showExportImport ?? true,
      showViewportSwitcher: toolbarCfg.showViewportSwitcher ?? true,
      showPreviewToggle: toolbarCfg.showPreviewToggle ?? true,
      showActionDebugger: toolbarCfg.showActionDebugger ?? true,
      showSelectionStatus: toolbarCfg.showSelectionStatus ?? true,
      customActions: toolbarCfg.customActions,
    },
    sidebar: {
      enabled: sidebarEnabled,
      defaultTab,
      availableTabs,
      allowedComponents: sidebarCfg.allowedComponents,
      hiddenComponents: sidebarCfg.hiddenComponents,
      allowedCategories: sidebarCfg.allowedCategories,
      hiddenCategories: sidebarCfg.hiddenCategories,
    },
    canvas: {
      showBreadcrumbs: canvasCfg.showBreadcrumbs ?? true,
      showFloatingBadges: canvasCfg.showFloatingBadges ?? true,
    },
    inspector: {
      enabled: inspectorEnabled,
      showProps: inspectorCfg.showProps ?? true,
      showTraits: inspectorCfg.showTraits ?? true,
      showStyles: inspectorCfg.showStyles ?? true,
      showStateSelector: inspectorCfg.showStateSelector ?? true,
      allowedStyleSectors: inspectorCfg.allowedStyleSectors,
    },
  };
}
