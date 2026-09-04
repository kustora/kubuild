import React from 'react';
import { PageDocument } from '@kubuild/schema';
import { ComponentRegistry, createDefaultComponentRegistry } from '@kubuild/components';
import { getNodeAncestors } from '@kubuild/core';
import { useEditorStore } from '../../store';

export interface HierarchyBreadcrumbsProps {
  registry?: ComponentRegistry;
  document?: PageDocument;
  selectedNodeId?: string | null;
  className?: string;
}

/**
 * Bottom Hierarchy Breadcrumbs Bar — STORA-231.
 * Displays the ancestor hierarchy path: Page > Section > Container > ... > SelectedElement.
 * Clicking any breadcrumb item selects that element across canvas and inspector.
 */
export const HierarchyBreadcrumbs: React.FC<HierarchyBreadcrumbsProps> = ({
  registry = createDefaultComponentRegistry(),
  document: propDoc,
  selectedNodeId: propSelectedNodeId,
  className,
}) => {
  const storeState = useEditorStore();
  const document = propDoc ?? storeState.document;
  const selectedNodeId =
    propSelectedNodeId !== undefined ? propSelectedNodeId : storeState.selectedNodeId;
  const selectNode = storeState.selectNode;

  if (!document?.document) return null;

  // Retrieve the full ancestor path from root down to the selected node in O(N)
  const ancestors = selectedNodeId
    ? getNodeAncestors(document.document, selectedNodeId)
    : [document.document];

  // If node is not found in the tree, fallback to root
  const path = ancestors.length > 0 ? ancestors : [document.document];

  return (
    <nav
      aria-label="Hierarchy Breadcrumbs"
      data-testid="hierarchy-breadcrumbs"
      className={`flex items-center gap-1 px-4 py-2 bg-white border-t border-slate-200 text-xs text-slate-600 select-none overflow-x-auto min-h-[36px] w-full shrink-0 shadow-sm ${
        className || ''
      }`}
    >
      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mr-1 shrink-0">
        Path:
      </span>
      {path.map((node, index) => {
        const isLast = index === path.length - 1;
        const isSelected = node.id === selectedNodeId;
        const def = registry.get(node.type);
        const label =
          node.type === 'page'
            ? document.metadata?.title || 'Page'
            : def?.label || node.type;

        return (
          <React.Fragment key={node.id}>
            {index > 0 && (
              <span
                aria-hidden="true"
                className="text-slate-300 font-semibold mx-0.5 select-none shrink-0"
              >
                &gt;
              </span>
            )}
            <button
              type="button"
              data-testid={`breadcrumb-${node.id}`}
              onClick={() => selectNode(node.id)}
              className={`px-1.5 py-0.5 rounded transition shrink-0 flex items-center gap-1 ${
                isSelected || isLast
                  ? 'bg-blue-50 text-blue-700 font-semibold border border-blue-200 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100 font-medium'
              }`}
              title={`Select ${label} (${node.id})`}
            >
              <span>{label}</span>
              {node.props && typeof node.props === 'object' && 'tag' in node.props && (
                <span className="text-[10px] text-slate-400 font-mono">
                  &lt;{String(node.props.tag)}&gt;
                </span>
              )}
            </button>
          </React.Fragment>
        );
      })}
    </nav>
  );
};
