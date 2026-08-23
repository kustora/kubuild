import React from 'react';
import { PageDocument, Node, isAssetReference, isActionBinding } from '@kubuild/schema';
import { ComponentRegistry, createDefaultComponentRegistry } from '@kubuild/components';
import {
  RenderContext,
  DEFAULT_RENDER_CONTEXT,
  RenderContextProvider,
  resolveAssetSync,
  resolveVariable,
  resolveActionPayload,
  isActionRegistered,
  dispatchAction,
  ActionDiagnostic,
} from './render-context';
import { resolveNodeStyles } from './styles';
import { ComponentErrorBoundary } from './error-boundary';

export interface KubuildRendererProps {
  document: PageDocument;
  registry?: ComponentRegistry;
  context?: RenderContext;
  viewport?: 'desktop' | 'tablet' | 'mobile';
  mode?: 'editor' | 'runtime';
  className?: string;
  onNodeClick?: (nodeId: string, event: React.MouseEvent) => void;
  onDiagnostic?: (diagnostic: ActionDiagnostic) => void;
  onActionDispatch?: (actionType: string, payload: Record<string, unknown> | undefined, nodeId: string) => void;
}

export interface NodeRendererProps {
  node: Node;
  document: PageDocument;
  registry: ComponentRegistry;
  context?: RenderContext;
  viewport?: 'desktop' | 'tablet' | 'mobile';
  mode?: 'editor' | 'runtime';
  onNodeClick?: (nodeId: string, event: React.MouseEvent) => void;
  onDiagnostic?: (diagnostic: ActionDiagnostic) => void;
  onActionDispatch?: (actionType: string, payload: Record<string, unknown> | undefined, nodeId: string) => void;
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
}: NodeRendererProps): React.ReactElement {
  const context = propContext || DEFAULT_RENDER_CONTEXT;
  const styles = resolveNodeStyles(node.styles, viewport);
  const props = node.props || {};

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onNodeClick) {
      onNodeClick(node.id, e);
    }
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
      key={child.id}
      node={child}
      document={document}
      registry={registry}
      context={context}
      viewport={viewport}
      mode={mode}
      onNodeClick={onNodeClick}
      onDiagnostic={onDiagnostic}
      onActionDispatch={onActionDispatch}
    />
  ));

  const renderNodeContent = (): React.ReactElement => {
    // Check if custom component renderer is registered in ComponentRegistry
    const definition = registry.get(node.type);
    if (definition?.renderer && typeof definition.renderer === 'function') {
      const CustomRenderer = definition.renderer as React.ComponentType<{
        node: Node;
        document: PageDocument;
        props: Record<string, unknown>;
        styles: React.CSSProperties;
        context?: RenderContext;
        children?: React.ReactNode;
        onClick?: (e: React.MouseEvent) => void;
      }>;

      try {
        if (typeof CustomRenderer === 'function' && !CustomRenderer.prototype?.isReactComponent) {
          return (CustomRenderer as (p: unknown) => React.ReactElement)({
            node,
            document,
            props,
            styles,
            context,
            children: childrenElements,
            onClick: handleClick,
          });
        }
      } catch (err) {
        throw err;
      }

      return (
        <CustomRenderer
          node={node}
          document={document}
          props={props}
          styles={styles}
          context={context}
          onClick={handleClick}
        >
          {childrenElements}
        </CustomRenderer>
      );
    }

    switch (node.type) {
      case 'page':
        return (
          <div id={node.id} style={styles} onClick={handleClick} data-kubuild-node={node.id}>
            {childrenElements}
          </div>
        );
      case 'section':
        return (
          <section id={node.id} style={styles} onClick={handleClick} data-kubuild-node={node.id}>
            {childrenElements}
          </section>
        );
      case 'container':
        return (
          <div id={node.id} style={styles} onClick={handleClick} data-kubuild-node={node.id}>
            {childrenElements}
          </div>
        );
      case 'columns':
        return (
          <div id={node.id} style={styles} onClick={handleClick} data-kubuild-node={node.id}>
            {childrenElements}
          </div>
        );
      case 'heading': {
        const level = (props.level as number) || 2;
        const rawText = (props.text as string) || '';
        const text = String(resolveVariable(context, rawText) ?? '');
        const Tag = `h${Math.min(Math.max(level, 1), 6)}` as 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6';
        return (
          <Tag id={node.id} style={styles} onClick={handleClick} data-kubuild-node={node.id}>
            {text}
          </Tag>
        );
      }
      case 'text': {
        const rawContent = (props.content as string) || '';
        const content = String(resolveVariable(context, rawContent) ?? '');
        return (
          <p id={node.id} style={styles} onClick={handleClick} data-kubuild-node={node.id}>
            {content}
          </p>
        );
      }
      case 'image': {
        const rawSrc = typeof props.src === 'string' && props.src.length > 0 ? props.src : undefined;
        const directSrc = rawSrc ? String(resolveVariable(context, rawSrc) ?? '') : undefined;
        const asset = isAssetReference(props.asset) ? props.asset : undefined;
        const resolvedSrc =
          !directSrc && asset && context?.assetProvider
            ? resolveAssetSync(context.assetProvider, asset.assetId)
            : undefined;
        const fallbackSrc = asset?.fallbackUrl;
        const rawAlt = (props.alt as string) || '';
        const alt = String(resolveVariable(context, rawAlt) ?? '');

        return (
          <img
            id={node.id}
            src={directSrc || resolvedSrc || fallbackSrc || undefined}
            alt={alt}
            width={props.width as number}
            height={props.height as number}
            style={styles}
            onClick={handleClick}
            data-kubuild-node={node.id}
          />
        );
      }
      case 'button': {
        const rawLabel = (props.label as string) || 'Button';
        const label = String(resolveVariable(context, rawLabel) ?? 'Button');
        const disabled = props.disabled === true;
        const rawHref = typeof props.href === 'string' ? props.href : undefined;
        const href = rawHref ? String(resolveVariable(context, rawHref) ?? '') : undefined;
        const action = isActionBinding(props.action) ? props.action : undefined;
        const actionResolved = action ? isActionRegistered(context?.actionRegistry, action.type) : undefined;
        const actionAttrs = action
          ? { 'data-kubuild-action': action.type, 'data-kubuild-action-resolved': actionResolved }
          : {};

        if (href && !disabled) {
          return (
            <a
              id={node.id}
              href={href}
              style={styles}
              onClick={handleClick}
              data-kubuild-node={node.id}
              {...actionAttrs}
            >
              {label}
            </a>
          );
        }

        return (
          <button
            id={node.id}
            type="button"
            disabled={disabled}
            style={styles}
            onClick={disabled ? undefined : handleClick}
            data-kubuild-node={node.id}
            {...actionAttrs}
          >
            {label}
          </button>
        );
      }
      default:
        // Unknown component handling
        if (mode === 'editor') {
          return (
            <div
              id={node.id}
              data-kubuild-node={node.id}
              data-kubuild-unknown={node.type}
              style={{
                ...styles,
                border: '2px dashed #f59e0b',
                backgroundColor: '#fffbeb',
                color: '#92400e',
                padding: '12px',
                borderRadius: '6px',
                fontFamily: 'system-ui, -apple-system, sans-serif',
              }}
              onClick={handleClick}
            >
              <div style={{ fontWeight: 600, fontSize: '13px', marginBottom: '4px' }}>
                🧩 Unknown Component: <code>{node.type}</code>
              </div>
              <div style={{ fontSize: '11px', color: '#b45309', marginBottom: childrenElements ? '8px' : 0 }}>
                Node ID: <code>{node.id}</code>
              </div>
              {childrenElements}
            </div>
          );
        }

        // Safe fallback in runtime mode
        return (
          <div
            id={node.id}
            data-kubuild-node={node.id}
            data-kubuild-unknown={node.type}
            style={styles}
            onClick={handleClick}
          >
            {childrenElements}
          </div>
        );
    }
  };

  let content: React.ReactElement;
  try {
    content = renderNodeContent();
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
          <div style={{ fontWeight: 600, marginBottom: '4px' }}>
            ⚠️ Component Render Error: &lt;{node.type}&gt;
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
    <ComponentErrorBoundary nodeId={node.id} componentType={node.type} mode={mode}>
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
  onNodeClick,
  onDiagnostic,
  onActionDispatch,
}) => {
  if (!document || !document.document) {
    return <div className={className}>Empty Document</div>;
  }

  return (
    <RenderContextProvider value={context}>
      <div className={`kubuild-canvas-root ${className || ''}`}>
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
        />
      </div>
    </RenderContextProvider>
  );
};
