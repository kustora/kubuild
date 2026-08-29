import React, { useRef, useLayoutEffect, useState, useEffect, useMemo } from 'react';
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
import { resolveBinding, sanitizeUrl, sanitizeHtml } from '@kubuild/core';
import { icons as lucideIcons } from 'lucide-react';
import { resolveNodeStyles, collectStateStylesCss } from './styles';
import { ComponentErrorBoundary } from './error-boundary';
import { resolvePropsForNode } from './prop-resolution';

function toPascalCase(str: string): string {
  if (!str) return '';
  return str
    .replace(/[-_](\w)/g, (_, c) => c.toUpperCase())
    .replace(/^\w/, (c) => c.toUpperCase());
}

function getYouTubeId(url: string): string | null {
  if (!url || typeof url !== 'string') return null;
  const match = url.match(
    /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/i,
  );
  return match ? match[1] : null;
}

function getVimeoId(url: string): string | null {
  if (!url || typeof url !== 'string') return null;
  const match = url.match(
    /(?:vimeo\.com\/(?:channels\/(?:\w+\/)?|groups\/([^\/]*)\/videos\/|album\/(\d+)\/video\/|video\/|))(\d+)/i,
  );
  return match ? match[3] : null;
}

function aspectRatioToCss(ratio: unknown): string | undefined {
  if (ratio === '16:9') return '16 / 9';
  if (ratio === '4:3') return '4 / 3';
  if (ratio === '1:1') return '1 / 1';
  if (ratio === '9:16') return '9 / 16';
  if (typeof ratio === 'string' && ratio !== 'auto') return ratio.replace(':', ' / ');
  return undefined;
}

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
const useIsomorphicLayoutEffect = typeof window !== 'undefined' ? useLayoutEffect : useEffect;

export function transformEmbedHtml(rawHtml: string): string {
  if (!rawHtml) return '';

  return rawHtml.replace(/<style\b([^>]*)>([\s\S]*?)<\/style>/gi, (_match, attrs, cssContent) => {
    let transformedCss = cssContent;
    // Replace "body {" or "body," with ":host, body {"
    transformedCss = transformedCss.replace(/(^|[\s,{}])body(?=[\s,{])/g, '$1:host, body');
    // Replace "html {" or "html," with ":host, html {"
    transformedCss = transformedCss.replace(/(^|[\s,{}])html(?=[\s,{])/g, '$1:host, html');

    return `<style${attrs}>\n:host { display: block; }\n${transformedCss}</style>`;
  });
}

export interface HtmlEmbedViewProps {
  id?: string;
  style?: React.CSSProperties;
  onClick?: (e: React.MouseEvent) => void;
  dataKubuildNode?: string;
  html: string;
  role?: string;
}

export const HtmlEmbedView: React.FC<HtmlEmbedViewProps> = ({
  id,
  style,
  onClick,
  dataKubuildNode,
  html,
  role,
}) => {
  const hostRef = useRef<HTMLDivElement>(null);
  const shadowRootRef = useRef<ShadowRoot | null>(null);

  const scopedHtml = useMemo(() => transformEmbedHtml(html), [html]);

  useIsomorphicLayoutEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    if (typeof host.attachShadow === 'function') {
      if (!shadowRootRef.current) {
        if (host.shadowRoot) {
          shadowRootRef.current = host.shadowRoot;
        } else {
          try {
            shadowRootRef.current = host.attachShadow({ mode: 'open' });
          } catch {
            shadowRootRef.current = host.shadowRoot;
          }
        }
      }

      if (shadowRootRef.current) {
        shadowRootRef.current.innerHTML = scopedHtml;
        return;
      }
    }

    host.innerHTML = scopedHtml;
  }, [scopedHtml]);

  return (
    <div
      ref={hostRef}
      id={id}
      style={style}
      onClick={onClick}
      data-kubuild-node={dataKubuildNode}
      role={role}
    >
      <template
        // @ts-expect-error Declarative shadow root for SSR
        shadowrootmode="open"
        dangerouslySetInnerHTML={{ __html: scopedHtml }}
      />
    </div>
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
      case 'paragraph': {
        const text = String(resolvedProps.text ?? resolvedProps.content ?? props.text ?? props.content ?? '');
        const isEditable = mode === 'editor' && !isVariableBinding(props.text) && !isVariableBinding(props.content);
        const propName = props.content !== undefined ? 'content' : 'text';
        return (
          <EditableText
            as="p"
            id={domId}
            style={styles}
            value={text}
            isEditable={isEditable}
            nodeId={node.id}
            onClick={handleClick}
            onChange={(val, isBlur) => onNodePropChange?.(node.id, propName, val, isBlur)}
            role={typeof resolvedProps.role === 'string' ? resolvedProps.role : undefined}
          />
        );
      }
      case 'link': {
        const text = String(resolvedProps.text ?? props.text ?? '');
        const rawHref = typeof resolvedProps.href === 'string' ? resolvedProps.href : typeof props.href === 'string' ? props.href : undefined;
        const href = rawHref ? sanitizeUrl(rawHref, '#') : '#';
        const rawTarget = typeof resolvedProps.target === 'string' ? resolvedProps.target : undefined;
        const rawRel = typeof resolvedProps.rel === 'string' ? resolvedProps.rel : undefined;
        const rel = rawTarget === '_blank' && !rawRel ? 'noopener noreferrer' : rawRel;
        const isEditable = mode === 'editor' && !isVariableBinding(props.text);

        if (isEditable) {
          return (
            <EditableText
              as="a"
              id={domId}
              href={undefined}
              target={rawTarget}
              rel={rel}
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

        return (
          <a
            id={domId}
            href={href}
            target={rawTarget}
            rel={rel}
            style={styles}
            onClick={handleClick}
            data-kubuild-node={node.id}
            role={typeof resolvedProps.role === 'string' ? resolvedProps.role : undefined}
          >
            {text}
          </a>
        );
      }
      case 'blockquote': {
        const text = resolvedProps.text !== undefined ? String(resolvedProps.text) : props.text !== undefined ? String(props.text) : '';
        const rawCite = typeof resolvedProps.cite === 'string' ? resolvedProps.cite : typeof props.cite === 'string' ? props.cite : undefined;
        const safeCite = rawCite ? sanitizeUrl(rawCite) : undefined;
        const hasChildren = Boolean(childrenElements && childrenElements.length > 0);
        const isEditable = mode === 'editor' && !isVariableBinding(props.text);

        if (hasChildren) {
          return (
            <blockquote
              id={domId}
              cite={safeCite}
              style={styles}
              onClick={handleClick}
              data-kubuild-node={node.id}
              role={typeof resolvedProps.role === 'string' ? resolvedProps.role : undefined}
            >
              {text ? (
                isEditable ? (
                  <EditableText
                    as="p"
                    value={text}
                    isEditable={isEditable}
                    nodeId={node.id}
                    onClick={handleClick}
                    onChange={(val, isBlur) => onNodePropChange?.(node.id, 'text', val, isBlur)}
                  />
                ) : (
                  <p>{text}</p>
                )
              ) : null}
              {childrenElements}
            </blockquote>
          );
        }

        return (
          <EditableText
            as="blockquote"
            id={domId}
            cite={safeCite}
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
      case 'badge': {
        const text = String(resolvedProps.text ?? props.text ?? 'Badge');
        const variant = typeof resolvedProps.variant === 'string' ? resolvedProps.variant : 'default';
        const isEditable = mode === 'editor' && !isVariableBinding(props.text);

        return (
          <EditableText
            as="span"
            id={domId}
            style={styles}
            value={text}
            isEditable={isEditable}
            nodeId={node.id}
            data-variant={variant}
            onClick={handleClick}
            onChange={(val, isBlur) => onNodePropChange?.(node.id, 'text', val, isBlur)}
            role={typeof resolvedProps.role === 'string' ? resolvedProps.role : undefined}
          />
        );
      }
      case 'code-block': {
        const code = String(resolvedProps.code ?? props.code ?? '');
        const language = typeof resolvedProps.language === 'string' ? resolvedProps.language : typeof props.language === 'string' ? props.language : undefined;
        const isEditable = mode === 'editor' && !isVariableBinding(props.code);

        return (
          <pre
            id={domId}
            style={styles}
            onClick={handleClick}
            data-kubuild-node={node.id}
            data-language={language}
            role={typeof resolvedProps.role === 'string' ? resolvedProps.role : undefined}
          >
            <EditableText
              as="code"
              className={language ? `language-${language}` : undefined}
              style={{ fontFamily: 'inherit', color: 'inherit', display: 'block', whiteSpace: 'pre' }}
              value={code}
              isEditable={isEditable}
              nodeId={node.id}
              onClick={handleClick}
              onChange={(val, isBlur) => onNodePropChange?.(node.id, 'code', val, isBlur)}
            />
          </pre>
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
      case 'table': {
        const isStriped = resolvedProps.striped === true;
        const isBordered = resolvedProps.bordered !== false;
        const isCompact = resolvedProps.compact === true;

        const tableStyles: React.CSSProperties = {
          width: '100%',
          borderCollapse: 'collapse',
          ...styles,
          ...(isBordered ? { border: styles.border || '1px solid #e2e8f0' } : {}),
        };

        return (
          <table
            id={domId}
            style={tableStyles}
            onClick={handleClick}
            data-kubuild-node={node.id}
            data-striped={isStriped ? 'true' : undefined}
            data-bordered={isBordered ? 'true' : undefined}
            data-compact={isCompact ? 'true' : undefined}
            role={typeof resolvedProps.role === 'string' ? resolvedProps.role : undefined}
          >
            <tbody>{childrenElements}</tbody>
          </table>
        );
      }
      case 'table-row': {
        return (
          <tr
            id={domId}
            style={styles}
            onClick={handleClick}
            data-kubuild-node={node.id}
            role={typeof resolvedProps.role === 'string' ? resolvedProps.role : undefined}
          >
            {childrenElements}
          </tr>
        );
      }
      case 'table-cell': {
        const rawTag = resolvedProps.tag;
        const Tag = rawTag === 'th' ? 'th' : 'td';
        const colSpan =
          typeof resolvedProps.colSpan === 'number' && resolvedProps.colSpan > 1
            ? resolvedProps.colSpan
            : undefined;
        const rowSpan =
          typeof resolvedProps.rowSpan === 'number' && resolvedProps.rowSpan > 1
            ? resolvedProps.rowSpan
            : undefined;
        const text = resolvedProps.text !== undefined ? String(resolvedProps.text) : '';
        const hasChildren = Boolean(childrenElements && childrenElements.length > 0);
        const isEditable = mode === 'editor' && !isVariableBinding(props.text);

        const cellStyles: React.CSSProperties = {
          padding: '8px 12px',
          border: '1px solid #e2e8f0',
          textAlign: 'left',
          ...styles,
          ...(Tag === 'th'
            ? {
                fontWeight: styles.fontWeight || '600',
                backgroundColor: styles.backgroundColor || '#f8fafc',
              }
            : {}),
        };

        if (hasChildren) {
          return (
            <Tag
              id={domId}
              colSpan={colSpan}
              rowSpan={rowSpan}
              style={cellStyles}
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
            </Tag>
          );
        }

        return (
          <EditableText
            as={Tag}
            id={domId}
            colSpan={colSpan}
            rowSpan={rowSpan}
            style={cellStyles}
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
        // blob: allowed for media — runtime-only in-memory uploads (STORA-250).
        const safeSrc = rawUrl ? sanitizeUrl(rawUrl, '', { allowBlobMedia: true }) : undefined;
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
      case 'video': {
        const rawSrc = typeof resolvedProps.src === 'string' ? resolvedProps.src : typeof props.src === 'string' ? props.src : '';
        const provider = typeof resolvedProps.provider === 'string' ? resolvedProps.provider : typeof props.provider === 'string' ? props.provider : 'auto';
        const rawPoster = typeof resolvedProps.poster === 'string' ? resolvedProps.poster : typeof props.poster === 'string' ? props.poster : undefined;
        const poster = rawPoster ? sanitizeUrl(rawPoster) : undefined;
        const controls = resolvedProps.controls !== false && props.controls !== false;
        const autoplay = resolvedProps.autoplay === true || props.autoplay === true;
        const loop = resolvedProps.loop === true || props.loop === true;
        const muted = resolvedProps.muted === true || props.muted === true;
        const aspectRatio = aspectRatioToCss(resolvedProps.aspectRatio ?? props.aspectRatio ?? '16:9');

        const ytId = provider === 'youtube' ? (getYouTubeId(rawSrc) || rawSrc) : (provider === 'auto' ? getYouTubeId(rawSrc) : null);
        const vimeoId = provider === 'vimeo' ? (getVimeoId(rawSrc) || rawSrc) : (provider === 'auto' ? getVimeoId(rawSrc) : null);

        const videoStyles: React.CSSProperties = {
          width: '100%',
          maxWidth: '100%',
          display: 'block',
          ...(aspectRatio ? { aspectRatio } : {}),
          ...styles,
        };

        if (ytId) {
          const autoplayParam = autoplay ? '1' : '0';
          const loopParam = loop ? `1&playlist=${ytId}` : '0';
          const muteParam = muted ? '1' : '0';
          const controlsParam = controls ? '1' : '0';
          const embedUrl = `https://www.youtube.com/embed/${ytId}?autoplay=${autoplayParam}&loop=${loopParam}&mute=${muteParam}&controls=${controlsParam}`;

          return (
            <div
              id={domId}
              style={{ ...videoStyles, position: 'relative', overflow: 'hidden' }}
              onClick={handleClick}
              data-kubuild-node={node.id}
              data-video-provider="youtube"
              role={typeof resolvedProps.role === 'string' ? resolvedProps.role : undefined}
            >
              <iframe
                src={embedUrl}
                title="YouTube video"
                style={{ width: '100%', height: '100%', border: 'none', minHeight: '240px' }}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                allowFullScreen
              />
            </div>
          );
        }

        if (vimeoId) {
          const autoplayParam = autoplay ? '1' : '0';
          const loopParam = loop ? '1' : '0';
          const muteParam = muted ? '1' : '0';
          const embedUrl = `https://player.vimeo.com/video/${vimeoId}?autoplay=${autoplayParam}&loop=${loopParam}&muted=${muteParam}`;

          return (
            <div
              id={domId}
              style={{ ...videoStyles, position: 'relative', overflow: 'hidden' }}
              onClick={handleClick}
              data-kubuild-node={node.id}
              data-video-provider="vimeo"
              role={typeof resolvedProps.role === 'string' ? resolvedProps.role : undefined}
            >
              <iframe
                src={embedUrl}
                title="Vimeo video"
                style={{ width: '100%', height: '100%', border: 'none', minHeight: '240px' }}
                allow="autoplay; fullscreen; picture-in-picture"
                allowFullScreen
              />
            </div>
          );
        }

        const safeSrc = sanitizeUrl(rawSrc, '', { allowBlobMedia: true });

        return (
          <video
            id={domId}
            src={safeSrc || undefined}
            poster={poster || undefined}
            controls={controls}
            autoPlay={autoplay}
            loop={loop}
            muted={muted}
            style={videoStyles}
            onClick={handleClick}
            data-kubuild-node={node.id}
            data-video-provider="html5"
            playsInline
            role={typeof resolvedProps.role === 'string' ? resolvedProps.role : undefined}
          />
        );
      }
      case 'icon': {
        const name = typeof resolvedProps.name === 'string' && resolvedProps.name.trim().length > 0
          ? resolvedProps.name.trim()
          : typeof props.name === 'string' && props.name.trim().length > 0
          ? props.name.trim()
          : 'star';
        const size = typeof resolvedProps.size === 'number' ? resolvedProps.size : typeof props.size === 'number' ? props.size : 24;
        const color = typeof resolvedProps.color === 'string' ? resolvedProps.color : typeof props.color === 'string' ? props.color : 'currentColor';
        const strokeWidth = typeof resolvedProps.strokeWidth === 'number' ? resolvedProps.strokeWidth : typeof props.strokeWidth === 'number' ? props.strokeWidth : 2;
        const pascalName = toPascalCase(name);
        const IconComponent = (lucideIcons as Record<string, React.ComponentType<{ size?: number; color?: string; strokeWidth?: number; className?: string; style?: React.CSSProperties }>>)[pascalName];

        return (
          <span
            id={domId}
            style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color, ...styles }}
            onClick={handleClick}
            data-kubuild-node={node.id}
            data-icon-name={name}
            role={typeof resolvedProps.role === 'string' ? resolvedProps.role : 'img'}
            aria-label={typeof resolvedProps.ariaLabel === 'string' ? resolvedProps.ariaLabel : name}
          >
            {IconComponent ? (
              <IconComponent size={size} color={color} strokeWidth={strokeWidth} />
            ) : (
              <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
                <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
              </svg>
            )}
          </span>
        );
      }
      case 'html-embed': {
        const rawHtml = typeof resolvedProps.html === 'string' ? resolvedProps.html : typeof props.html === 'string' ? props.html : '';
        const sanitized = sanitizeHtml(rawHtml);

        if (mode === 'editor' && !rawHtml.trim()) {
          return (
            <div
              id={domId}
              style={{
                padding: '16px',
                border: '2px dashed #94a3b8',
                borderRadius: '8px',
                backgroundColor: '#f8fafc',
                color: '#64748b',
                textAlign: 'center',
                fontSize: '13px',
                fontFamily: 'sans-serif',
                ...styles,
              }}
              onClick={handleClick}
              data-kubuild-node={node.id}
            >
              <span style={{ fontWeight: 600 }}>&lt;/&gt; HTML Embed</span>
              <div style={{ fontSize: '11px', marginTop: '4px' }}>Click to configure HTML code in Inspector Panel</div>
            </div>
          );
        }

        return (
          <HtmlEmbedView
            id={domId}
            style={styles}
            onClick={handleClick}
            dataKubuildNode={node.id}
            html={sanitized}
            role={typeof resolvedProps.role === 'string' ? resolvedProps.role : undefined}
          />
        );
      }
      case 'button': {
        const label = String(resolvedProps.label ?? 'Button');
        const disabled = resolvedProps.disabled === true;
        const rawHref = typeof resolvedProps.href === 'string' ? resolvedProps.href : undefined;
        const href = rawHref ? sanitizeUrl(rawHref, '#') : undefined;
        const rawTarget = typeof resolvedProps.target === 'string' ? resolvedProps.target : undefined;
        const rawRel = typeof resolvedProps.rel === 'string' ? resolvedProps.rel : undefined;
        const rel = rawTarget === '_blank' && !rawRel ? 'noopener noreferrer' : rawRel;
        const action = isActionBinding(props.action) ? props.action : undefined;
        const actionResolved = action ? isActionRegistered(context?.actionRegistry, action.type) : undefined;
        const actionAttrs = action
          ? { 'data-kubuild-action': action.type, 'data-kubuild-action-resolved': actionResolved }
          : {};
        const ariaLabel = typeof resolvedProps.ariaLabel === 'string' ? resolvedProps.ariaLabel : undefined;
        const isEditable = mode === 'editor' && !isVariableBinding(props.label);

        const rawButtonType = typeof resolvedProps.buttonType === 'string' ? resolvedProps.buttonType : 'button';
        const buttonType: 'button' | 'submit' | 'reset' =
          rawButtonType === 'submit' || rawButtonType === 'reset' ? rawButtonType : 'button';

        if (href && !disabled) {
          if (isEditable) {
            return (
              <EditableText
                as="a"
                id={domId}
                href={mode === 'editor' ? undefined : href}
                target={rawTarget}
                rel={rel}
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
              target={rawTarget}
              rel={rel}
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
              type={mode === 'editor' ? 'button' : buttonType}
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
            type={mode === 'editor' ? 'button' : buttonType}
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
      case 'form': {
        const action = typeof resolvedProps.action === 'string' ? resolvedProps.action : undefined;
        const method = typeof resolvedProps.method === 'string' ? resolvedProps.method : 'POST';
        const target = typeof resolvedProps.target === 'string' ? resolvedProps.target : undefined;
        const autoComplete = typeof resolvedProps.autoComplete === 'string' ? resolvedProps.autoComplete : undefined;
        const name = typeof resolvedProps.name === 'string' ? resolvedProps.name : undefined;

        const handleSubmit = (e: React.FormEvent) => {
          if (mode === 'editor') {
            e.preventDefault();
          }
        };

        return (
          <form
            id={domId}
            name={name}
            action={action && mode !== 'editor' ? sanitizeUrl(action, '') : undefined}
            method={method}
            target={target}
            autoComplete={autoComplete}
            style={styles}
            onClick={handleClick}
            onSubmit={handleSubmit}
            data-kubuild-node={node.id}
            role="form"
            aria-label={name}
          >
            {childrenElements}
          </form>
        );
      }
      case 'input': {
        const name = typeof resolvedProps.name === 'string' ? resolvedProps.name : undefined;
        const inputType = typeof resolvedProps.type === 'string' ? resolvedProps.type : 'text';
        const placeholder = typeof resolvedProps.placeholder === 'string' ? resolvedProps.placeholder : undefined;
        const defaultValue = resolvedProps.defaultValue !== undefined ? String(resolvedProps.defaultValue) : undefined;
        const required = resolvedProps.required === true;
        const disabled = resolvedProps.disabled === true;
        const readOnly = resolvedProps.readOnly === true;

        return (
          <input
            id={domId}
            type={inputType}
            name={name}
            placeholder={placeholder}
            defaultValue={defaultValue}
            required={required}
            disabled={disabled}
            readOnly={readOnly}
            style={styles}
            onClick={handleClick}
            data-kubuild-node={node.id}
          />
        );
      }
      case 'textarea': {
        const name = typeof resolvedProps.name === 'string' ? resolvedProps.name : undefined;
        const placeholder = typeof resolvedProps.placeholder === 'string' ? resolvedProps.placeholder : undefined;
        const defaultValue = resolvedProps.defaultValue !== undefined ? String(resolvedProps.defaultValue) : undefined;
        const rows = typeof resolvedProps.rows === 'number' ? resolvedProps.rows : 4;
        const required = resolvedProps.required === true;
        const disabled = resolvedProps.disabled === true;
        const readOnly = resolvedProps.readOnly === true;

        return (
          <textarea
            id={domId}
            name={name}
            placeholder={placeholder}
            defaultValue={defaultValue}
            rows={rows}
            required={required}
            disabled={disabled}
            readOnly={readOnly}
            style={styles}
            onClick={handleClick}
            data-kubuild-node={node.id}
          />
        );
      }
      case 'select': {
        const name = typeof resolvedProps.name === 'string' ? resolvedProps.name : undefined;
        const placeholder = typeof resolvedProps.placeholder === 'string' ? resolvedProps.placeholder : undefined;
        const defaultValue = resolvedProps.defaultValue !== undefined ? String(resolvedProps.defaultValue) : undefined;
        const required = resolvedProps.required === true;
        const disabled = resolvedProps.disabled === true;

        let optionsList: Array<{ label: string; value: string }> = [];
        const rawOptions = resolvedProps.options ?? props.options;
        if (Array.isArray(rawOptions)) {
          optionsList = rawOptions.map((opt) => {
            if (typeof opt === 'object' && opt !== null) {
              const record = opt as Record<string, unknown>;
              return {
                label: String(record.label ?? record.value ?? ''),
                value: String(record.value ?? record.label ?? ''),
              };
            }
            return { label: String(opt), value: String(opt) };
          });
        } else if (typeof rawOptions === 'string') {
          try {
            const parsed = JSON.parse(rawOptions);
            if (Array.isArray(parsed)) {
              optionsList = parsed.map((opt) => {
                if (typeof opt === 'object' && opt !== null) {
                  const record = opt as Record<string, unknown>;
                  return {
                    label: String(record.label ?? record.value ?? ''),
                    value: String(record.value ?? record.label ?? ''),
                  };
                }
                return { label: String(opt), value: String(opt) };
              });
            }
          } catch {
            // Not valid JSON
          }
        }

        return (
          <select
            id={domId}
            name={name}
            defaultValue={defaultValue}
            required={required}
            disabled={disabled}
            style={styles}
            onClick={handleClick}
            data-kubuild-node={node.id}
          >
            {placeholder && (
              <option value="" disabled={required}>
                {placeholder}
              </option>
            )}
            {optionsList.map((opt, idx) => (
              <option key={`${opt.value}-${idx}`} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        );
      }
      case 'checkbox': {
        const name = typeof resolvedProps.name === 'string' ? resolvedProps.name : undefined;
        const label = String(resolvedProps.label ?? 'Checkbox');
        const value = resolvedProps.value !== undefined ? String(resolvedProps.value) : 'yes';
        const defaultChecked = resolvedProps.defaultChecked === true;
        const required = resolvedProps.required === true;
        const disabled = resolvedProps.disabled === true;
        const isEditable = mode === 'editor' && !isVariableBinding(props.label);

        return (
          <label
            id={domId}
            style={styles}
            onClick={handleClick}
            data-kubuild-node={node.id}
          >
            <input
              type="checkbox"
              name={name}
              value={value}
              defaultChecked={defaultChecked}
              required={required}
              disabled={disabled}
              style={{ cursor: disabled ? 'not-allowed' : 'pointer' }}
            />
            {isEditable ? (
              <EditableText
                as="span"
                value={label}
                isEditable={isEditable}
                nodeId={node.id}
                onChange={(val, isBlur) => onNodePropChange?.(node.id, 'label', val, isBlur)}
              />
            ) : (
              <span>{label}</span>
            )}
          </label>
        );
      }
      case 'radio': {
        const name = typeof resolvedProps.name === 'string' ? resolvedProps.name : undefined;
        const label = String(resolvedProps.label ?? 'Radio');
        const value = resolvedProps.value !== undefined ? String(resolvedProps.value) : 'option';
        const defaultChecked = resolvedProps.defaultChecked === true;
        const required = resolvedProps.required === true;
        const disabled = resolvedProps.disabled === true;
        const isEditable = mode === 'editor' && !isVariableBinding(props.label);

        return (
          <label
            id={domId}
            style={styles}
            onClick={handleClick}
            data-kubuild-node={node.id}
          >
            <input
              type="radio"
              name={name}
              value={value}
              defaultChecked={defaultChecked}
              required={required}
              disabled={disabled}
              style={{ cursor: disabled ? 'not-allowed' : 'pointer' }}
            />
            {isEditable ? (
              <EditableText
                as="span"
                value={label}
                isEditable={isEditable}
                nodeId={node.id}
                onChange={(val, isBlur) => onNodePropChange?.(node.id, 'label', val, isBlur)}
              />
            ) : (
              <span>{label}</span>
            )}
          </label>
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
        {/* Compiled pseudo-state CSS (:hover/:active/:focus) — STORA-222 */}
        {(() => {
          const css = collectStateStylesCss(document);
          return css ? <style data-kubuild-state-styles>{css}</style> : null;
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
      </div>
    </RenderContextProvider>
  );
};
