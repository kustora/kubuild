import React from 'react';
import {
  PageDocument,
  Node,
  isActionBinding,
} from '@kubuild/schema';
import { type ComponentRegistry, createDefaultComponentRegistry } from '@kubuild/components';
import {
  RenderContext,
  DEFAULT_RENDER_CONTEXT,
  RenderContextProvider,
  resolveActionPayload,
  dispatchAction,
  Diagnostic,
} from './render-context';
import { AlertTriangle } from 'lucide-react';
import { resolveNodeStyles, collectStateStylesCss } from './styles';
import { collectAnimationStylesCss } from './animation';
import { ComponentErrorBoundary } from './error-boundary';
import { resolvePropsForNode } from './prop-resolution';
import { renderNodeContent } from './renderers';
import { ToastContainer } from './action-runners/toast-container';
import { executeNodeActions, useNodeLoadActions } from './action-dispatcher';

// Re-export all nodes and media utilities for backward compatibility
export * from './nodes';
export * from './renderers';

export interface KubuildRendererProps {
  document: PageDocument;
  registry?: ComponentRegistry;
  context?: RenderContext;
  viewport?: 'desktop' | 'tablet' | 'mobile';
  mode?: 'editor' | 'runtime';
  className?: string;
  showToastContainer?: boolean;
  onNodeClick?: (nodeId: string, event: React.MouseEvent) => void;
  onDiagnostic?: (diagnostic: Diagnostic) => void;
  onActionDispatch?: (actionType: string, payload: Record<string, unknown> | undefined, nodeId: string) => void;
  onNodePropChange?: (nodeId: string, propName: string, value: unknown, isBlur?: boolean) => void;
}

export interface NodeRendererProps {
  node: Node;
  document: PageDocument;
  registry: ComponentRegistry;
  context?: RenderContext;
  viewport?: 'desktop' | 'tablet' | 'mobile';
  mode?: 'editor' | 'runtime';
  onNodeClick?: (nodeId: string, event: React.MouseEvent) => void;
  onDiagnostic?: (diagnostic: Diagnostic) => void;
  onActionDispatch?: (actionType: string, payload: Record<string, unknown> | undefined, nodeId: string) => void;
  onNodePropChange?: (nodeId: string, propName: string, value: unknown, isBlur?: boolean) => void;
  /**
   * Suffix appended to the HTML `id` attribute (never to `data-kubuild-node`, the
   * canonical template-node reference) so a `collection` node's repeated child
   * template produces unique DOM ids per iteration instead of duplicates.
   */
  instanceSuffix?: string;
}

export function NodeRenderer({
  node,
  document,
  registry,
  context: propContext,
  viewport = 'desktop',
  mode = 'runtime',
  onNodeClick,
  onDiagnostic,
  onActionDispatch,
  onNodePropChange,
  instanceSuffix = '',
}: NodeRendererProps): React.ReactElement {
  const context = propContext || DEFAULT_RENDER_CONTEXT;
  const styles = resolveNodeStyles(node.styles, viewport);
  const props = node.props || {};
  const definition = registry.get(node.type);
  const domId = instanceSuffix ? `${node.id}${instanceSuffix}` : node.id;
  const { props: resolvedProps, diagnostics } = resolvePropsForNode(node, definition, context);

  diagnostics.forEach((diagnostic) => {
    onDiagnostic?.(diagnostic);
    context?.onDiagnostic?.(diagnostic);
  });

  // Execute `load` lifecycle action pipelines on component mount
  useNodeLoadActions(node, {
    document,
    context,
    onDiagnostic,
    onActionDispatch,
    mode,
  });

  const handleClick = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onNodeClick) {
      onNodeClick(node.id, e);
    }

    // 1. Execute modern ActionPipeline[] for 'click' trigger
    if (node.actions && node.actions.length > 0 && !props.disabled) {
      await executeNodeActions({
        node,
        trigger: 'click',
        document,
        context,
        onDiagnostic,
        onActionDispatch,
      });
    }

    // 2. Backward compatibility: dispatch legacy single props.action
    if (props.action && !props.disabled) {
      dispatchAction({
        action: props.action,
        nodeId: node.id,
        document,
        context,
        onDiagnostic,
      });
      if (onActionDispatch && isActionBinding(props.action)) {
        onActionDispatch(props.action.type, resolveActionPayload(context, props.action.payload), node.id);
      }
    }
  };

  const childrenElements = node.children?.map((child: Node) => (
    <NodeRenderer
      key={`${child.id}${instanceSuffix}`}
      node={child}
      document={document}
      registry={registry}
      context={context}
      viewport={viewport}
      mode={mode}
      onNodeClick={onNodeClick}
      onDiagnostic={onDiagnostic}
      onActionDispatch={onActionDispatch}
      onNodePropChange={onNodePropChange}
      instanceSuffix={instanceSuffix}
    />
  ));

  const renderChildNode = (
    child: Node,
    childInstanceSuffix: string = '',
    itemContext: RenderContext = context,
  ) => (
    <NodeRenderer
      key={`${child.id}${instanceSuffix}${childInstanceSuffix}`}
      node={child}
      document={document}
      registry={registry}
      context={itemContext}
      viewport={viewport}
      mode={mode}
      onNodeClick={onNodeClick}
      onDiagnostic={onDiagnostic}
      onActionDispatch={onActionDispatch}
      onNodePropChange={onNodePropChange}
      instanceSuffix={`${instanceSuffix}${childInstanceSuffix}`}
    />
  );

  let content: React.ReactElement;
  try {
    content = renderNodeContent({
      node,
      document,
      registry,
      context,
      viewport,
      mode,
      styles,
      props,
      resolvedProps,
      definition,
      domId,
      childrenElements,
      handleClick,
      onNodeClick,
      onDiagnostic,
      onActionDispatch,
      onNodePropChange,
      instanceSuffix,
      renderChildNode,
    });
  } catch (error) {
    if (mode === 'editor') {
      content = (
        <div
          data-kubuild-node={node.id}
          data-kubuild-error={node.type}
          style={{
            padding: '12px 16px',
            margin: '4px 0',
            backgroundColor: '#fef2f2',
            border: '1px solid #ef4444',
            borderRadius: '6px',
            color: '#b91c1c',
            fontFamily: 'system-ui, -apple-system, sans-serif',
            fontSize: '13px',
            lineHeight: '1.4',
          }}
        >
          <div style={{ fontWeight: 600, marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <AlertTriangle size={14} aria-hidden="true" />
            <span>Component Render Error: &lt;{node.type}&gt;</span>
          </div>
          <div style={{ fontSize: '11px', color: '#7f1d1d', wordBreak: 'break-all' }}>
            Node ID: <code>{node.id}</code> — {error instanceof Error ? error.message : String(error)}
          </div>
        </div>
      );
    } else {
      content = (
        <div
          data-kubuild-node={node.id}
          data-kubuild-error={node.type}
          style={{ display: 'none' }}
          aria-hidden="true"
        />
      );
    }
  }

  return (
    <ComponentErrorBoundary
      nodeId={node.id}
      componentType={node.type}
      mode={mode}
      onDiagnostic={onDiagnostic}
    >
      {content}
    </ComponentErrorBoundary>
  );
}

export const KubuildRenderer: React.FC<KubuildRendererProps> = ({
  document,
  registry = createDefaultComponentRegistry(),
  context,
  viewport = 'desktop',
  mode = 'runtime',
  className,
  showToastContainer = true,
  onNodeClick,
  onDiagnostic,
  onActionDispatch,
  onNodePropChange,
}) => {
  if (!document || !document.document) {
    return <div className={className}>Empty Document</div>;
  }

  return (
    <RenderContextProvider value={context}>
      <div className={`kubuild-canvas-root ${className || ''}`}>
        {/* Compiled pseudo-state CSS (:hover/:active/:focus) — STORA-222 */}
        {(() => {
          const css = collectStateStylesCss(document);
          return css ? <style data-kubuild-state-styles>{css}</style> : null;
        })()}
        {/* Compiled animation & hover micro-interactions CSS — STORA-264 */}
        {(() => {
          const animCss = collectAnimationStylesCss(document);
          return animCss ? <style data-kubuild-animation-styles>{animCss}</style> : null;
        })()}
        <NodeRenderer
          node={document.document}
          document={document}
          registry={registry}
          context={context}
          viewport={viewport}
          mode={mode}
          onNodeClick={onNodeClick}
          onDiagnostic={onDiagnostic}
          onActionDispatch={onActionDispatch}
          onNodePropChange={onNodePropChange}
        />
        {showToastContainer && <ToastContainer />}
      </div>
    </RenderContextProvider>
  );
};
