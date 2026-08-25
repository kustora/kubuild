import React, { useRef, useLayoutEffect, useState } from 'react';
import { PageDocument, Node, isAssetReference, isActionBinding, isVariableBinding } from '@kubuild/schema';
import { ComponentRegistry, createDefaultComponentRegistry } from '@kubuild/components';
import {
  RenderContext,
  DEFAULT_RENDER_CONTEXT,
  RenderContextProvider,
  resolveAssetSync,
  resolveActionPayload,
  isActionRegistered,
  dispatchAction,
  Diagnostic,
} from './render-context';
import { resolveBinding, sanitizeUrl } from '@kubuild/core';
import { resolveNodeStyles } from './styles';
import { ComponentErrorBoundary } from './error-boundary';
import { resolvePropsForNode } from './prop-resolution';

export interface EditableTextProps {
  as?: string;
  id?: string;
  className?: string;
  style?: React.CSSProperties;
  value: string;
  isEditable: boolean;
  nodeId: string;
  onClick?: (e: React.MouseEvent) => void;
  onChange?: (val: string, isBlur: boolean) => void;
  [key: string]: unknown;
}

export const EditableText: React.FC<EditableTextProps> = ({
  as = 'p',
  id,
  className,
  style,
  value,
  isEditable,
  nodeId,
  onClick,
  onChange,
  ...rest
}) => {
  const isEditingRef = useRef(false);

  const Tag = as as any;

  if (!isEditable) {
    return (
      <Tag
        id={id}
        className={className}
        style={style}
        onClick={onClick}
        data-kubuild-node={nodeId}
        {...rest}
      >
        {value}
      </Tag>
    );
  }

  return (
    <Tag
      id={id}
      className={className}
      style={{
        ...style,
        outline: 'none',
        cursor: 'text',
      }}
      contentEditable={true}
      suppressContentEditableWarning={true}
      data-kubuild-node={nodeId}
      onClick={(e: React.MouseEvent) => {
        onClick?.(e);
      }}
      onFocus={() => {
        isEditingRef.current = true;
      }}
      onInput={(e: React.FormEvent<HTMLElement>) => {
        const text = e.currentTarget.textContent ?? '';
        onChange?.(text, false);
      }}
      onBlur={(e: React.FocusEvent<HTMLElement>) => {
        isEditingRef.current = false;
        const text = e.currentTarget.textContent ?? '';
        onChange?.(text, true);
      }}
      onKeyDown={(e: React.KeyboardEvent) => {
        if (e.key === 'Escape') {
          (e.currentTarget as HTMLElement).blur();
        }
      }}
      {...rest}
    >
      {value}
    </Tag>
  );
};

export interface KubuildRendererProps {
  document: PageDocument;
  registry?: ComponentRegistry;
  context?: RenderContext;
  viewport?: 'desktop' | 'tablet' | 'mobile';
  mode?: 'editor' | 'runtime';
  className?: string;
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

  const renderNodeContent = (): React.ReactElement => {
    // Check if custom component renderer is registered in ComponentRegistry
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
            props: resolvedProps,
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
          props={resolvedProps}
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
          <div id={domId} style={styles} onClick={handleClick} data-kubuild-node={node.id}>
            {childrenElements}
          </div>
        );
      case 'section':
        return (
          <section
            id={domId}
            style={styles}
            onClick={handleClick}
            data-kubuild-node={node.id}
            aria-label={typeof resolvedProps.ariaLabel === 'string' ? resolvedProps.ariaLabel : undefined}
            role={typeof resolvedProps.role === 'string' ? resolvedProps.role : undefined}
          >
            {childrenElements}
          </section>
        );
      case 'container':
        return (
          <div
            id={domId}
            style={styles}
            onClick={handleClick}
            data-kubuild-node={node.id}
            role={typeof resolvedProps.role === 'string' ? resolvedProps.role : undefined}
          >
            {childrenElements}
          </div>
        );
      case 'columns':
        return (
          <div
            id={domId}
            style={styles}
            onClick={handleClick}
            data-kubuild-node={node.id}
            role={typeof resolvedProps.role === 'string' ? resolvedProps.role : undefined}
          >
            {childrenElements}
          </div>
        );
      case 'heading': {
        const rawLevel = typeof resolvedProps.level === 'number' ? resolvedProps.level : typeof props.level === 'number' ? props.level : 2;
        const clampedLevel = Math.min(Math.max(rawLevel, 1), 6);
        const text = String(resolvedProps.text ?? '');
        const Tag = `h${clampedLevel}`;
        const isEditable = mode === 'editor' && !isVariableBinding(props.text);
        return (
          <EditableText
            as={Tag}
            id={domId}
            style={styles}
            value={text}
            isEditable={isEditable}
            nodeId={node.id}
            onClick={handleClick}
            onChange={(val, isBlur) => onNodePropChange?.(node.id, 'text', val, isBlur)}
            aria-label={typeof resolvedProps.ariaLabel === 'string' ? resolvedProps.ariaLabel : undefined}
          />
        );
      }
      case 'text': {
        const content = String(resolvedProps.content ?? '');
        const isEditable = mode === 'editor' && !isVariableBinding(props.content);
        return (
          <EditableText
            as="p"
            id={domId}
            style={styles}
            value={content}
            isEditable={isEditable}
            nodeId={node.id}
            onClick={handleClick}
            onChange={(val, isBlur) => onNodePropChange?.(node.id, 'content', val, isBlur)}
            role={typeof resolvedProps.role === 'string' ? resolvedProps.role : undefined}
          />
        );
      }
      case 'list': {
        const rawTag = resolvedProps.tag;
        const Tag = rawTag === 'ol' ? 'ol' : 'ul';
        const rawListStyle = resolvedProps.listStyleType as string | undefined;
        const listStyleType = rawListStyle === 'custom-icon' ? 'none' : rawListStyle;
        const listStyles: React.CSSProperties = {
          ...styles,
          ...(listStyleType ? { listStyleType } : {}),
        };
        return (
          <Tag
            id={domId}
            style={listStyles}
            onClick={handleClick}
            data-kubuild-node={node.id}
            data-list-style={rawListStyle}
            role={typeof resolvedProps.role === 'string' ? resolvedProps.role : undefined}
          >
            {childrenElements}
          </Tag>
        );
      }
      case 'list-item': {
        const text = resolvedProps.text !== undefined ? String(resolvedProps.text) : '';
        const hasChildren = Boolean(childrenElements && childrenElements.length > 0);
        const isEditable = mode === 'editor' && !isVariableBinding(props.text);

        if (hasChildren) {
          return (
            <li
              id={domId}
              style={styles}
              onClick={handleClick}
              data-kubuild-node={node.id}
              role={typeof resolvedProps.role === 'string' ? resolvedProps.role : undefined}
            >
              {text ? (
                isEditable ? (
                  <EditableText
                    as="span"
                    value={text}
                    isEditable={isEditable}
                    nodeId={node.id}
                    onClick={handleClick}
                    onChange={(val, isBlur) => onNodePropChange?.(node.id, 'text', val, isBlur)}
                  />
                ) : (
                  <span>{text}</span>
                )
              ) : null}
              {childrenElements}
            </li>
          );
        }

        return (
          <EditableText
            as="li"
            id={domId}
            style={styles}
            value={text}
            isEditable={isEditable}
            nodeId={node.id}
            onClick={handleClick}
            onChange={(val, isBlur) => onNodePropChange?.(node.id, 'text', val, isBlur)}
            role={typeof resolvedProps.role === 'string' ? resolvedProps.role : undefined}
          />
        );
      }
      case 'image': {
        const rawSrc = typeof resolvedProps.src === 'string' && resolvedProps.src.length > 0 ? resolvedProps.src : undefined;
        const directSrc = rawSrc ?? undefined;
        const asset = isAssetReference(props.asset) ? props.asset : undefined;
        const resolvedSrc =
          !directSrc && asset && context?.assetProvider
            ? resolveAssetSync(context.assetProvider, asset.assetId)
            : undefined;
        const fallbackSrc = asset?.fallbackUrl;
        const rawUrl = directSrc || resolvedSrc || fallbackSrc;
        const safeSrc = rawUrl ? sanitizeUrl(rawUrl) : undefined;
        const alt = typeof resolvedProps.alt === 'string' ? resolvedProps.alt : '';
        const loading = resolvedProps.loading === 'eager' ? 'eager' : 'lazy';

        return (
          <img
            id={domId}
            src={safeSrc || undefined}
            alt={alt}
            role={alt.length === 0 ? 'presentation' : undefined}
            loading={loading}
            width={resolvedProps.width as number}
            height={resolvedProps.height as number}
            style={styles}
            onClick={handleClick}
            data-kubuild-node={node.id}
          />
        );
      }
      case 'button': {
        const label = String(resolvedProps.label ?? 'Button');
        const disabled = resolvedProps.disabled === true;
        const rawHref = typeof resolvedProps.href === 'string' ? resolvedProps.href : undefined;
        const href = rawHref ? sanitizeUrl(rawHref, '#') : undefined;
        const action = isActionBinding(props.action) ? props.action : undefined;
        const actionResolved = action ? isActionRegistered(context?.actionRegistry, action.type) : undefined;
        const actionAttrs = action
          ? { 'data-kubuild-action': action.type, 'data-kubuild-action-resolved': actionResolved }
          : {};
        const ariaLabel = typeof resolvedProps.ariaLabel === 'string' ? resolvedProps.ariaLabel : undefined;
        const isEditable = mode === 'editor' && !isVariableBinding(props.label);

        if (href && !disabled) {
          if (isEditable) {
            return (
              <EditableText
                as="a"
                id={domId}
                href={mode === 'editor' ? undefined : href}
                style={styles}
                value={label}
                isEditable={isEditable}
                nodeId={node.id}
                onClick={handleClick}
                onChange={(val, isBlur) => onNodePropChange?.(node.id, 'label', val, isBlur)}
                aria-label={ariaLabel}
                tabIndex={0}
                {...actionAttrs}
              />
            );
          }
          return (
            <a
              id={domId}
              href={href}
              style={styles}
              onClick={handleClick}
              data-kubuild-node={node.id}
              aria-label={ariaLabel}
              tabIndex={0}
              {...actionAttrs}
            >
              {label}
            </a>
          );
        }

        if (isEditable) {
          return (
            <EditableText
              as="button"
              id={domId}
              type="button"
              disabled={disabled}
              aria-disabled={disabled ? true : undefined}
              aria-label={ariaLabel}
              tabIndex={disabled ? -1 : 0}
              style={styles}
              value={label}
              isEditable={isEditable}
              nodeId={node.id}
              onClick={disabled ? undefined : handleClick}
              onChange={(val, isBlur) => onNodePropChange?.(node.id, 'label', val, isBlur)}
              {...actionAttrs}
            />
          );
        }

        return (
          <button
            id={domId}
            type="button"
            disabled={disabled}
            aria-disabled={disabled ? true : undefined}
            aria-label={ariaLabel}
            tabIndex={disabled ? -1 : 0}
            style={styles}
            onClick={disabled ? undefined : handleClick}
            data-kubuild-node={node.id}
            {...actionAttrs}
          >
            {label}
          </button>
        );
      }
      case 'collection': {
        const sourceKey = typeof props.sourceKey === 'string' ? props.sourceKey : undefined;
        const itemAlias =
          typeof props.itemAlias === 'string' && props.itemAlias.length > 0 ? props.itemAlias : 'item';
        const indexKey = `${itemAlias}Index`;
        const sourceValue = sourceKey ? resolveBinding({ key: sourceKey }, context).value : undefined;

        if (!Array.isArray(sourceValue)) {
          const collectionDiagnostic: Diagnostic = {
            code: 'INVALID_COLLECTION_SOURCE',
            nodeId: node.id,
            propName: 'sourceKey',
            message: `Collection node "${node.id}" expected an array at variable path "${
              sourceKey ?? '(missing sourceKey)'
            }" but found ${sourceValue === undefined ? 'nothing' : typeof sourceValue}.`,
          };
          onDiagnostic?.(collectionDiagnostic);
          context?.onDiagnostic?.(collectionDiagnostic);

          if (mode === 'editor') {
            return (
              <div
                id={domId}
                data-kubuild-node={node.id}
                data-kubuild-collection-invalid={node.type}
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
                <div style={{ fontWeight: 600, fontSize: '13px' }}>
                  📦 Collection: expected an array at <code>{sourceKey ?? '(missing sourceKey)'}</code>
                </div>
              </div>
            );
          }

          return (
            <div id={domId} data-kubuild-node={node.id} style={styles} onClick={handleClick} aria-hidden="true" />
          );
        }

        return (
          <div id={domId} data-kubuild-node={node.id} style={styles} onClick={handleClick}>
            {sourceValue.map((item, index) => {
              const childContext: RenderContext = {
                ...context,
                variables: { ...(context?.variables ?? {}), [itemAlias]: item, [indexKey]: index },
              };
              const itemSuffix = `${instanceSuffix}--${index}`;
              return node.children?.map((child: Node) => (
                <NodeRenderer
                  key={`${child.id}${itemSuffix}`}
                  node={child}
                  document={document}
                  registry={registry}
                  context={childContext}
                  viewport={viewport}
                  mode={mode}
                  onNodeClick={onNodeClick}
                  onDiagnostic={onDiagnostic}
                  onActionDispatch={onActionDispatch}
                  onNodePropChange={onNodePropChange}
                  instanceSuffix={itemSuffix}
                />
              ));
            })}
          </div>
        );
      }
      default:
        // Unknown component handling
        if (mode === 'editor') {
          return (
            <div
              id={domId}
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
            id={domId}
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
  onNodePropChange,
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
          onNodePropChange={onNodePropChange}
        />
      </div>
    </RenderContextProvider>
  );
};
