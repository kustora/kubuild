import React from 'react';
import {
  PageDocument,
  Node,
  isAssetReference,
  isVariableBinding,
  ValidationRule,
  ValidateOnEvent,
  FormConfig,
} from '@kubuild/schema';
import type { ComponentRegistry, ComponentDefinition } from '@kubuild/components';
import { icons as lucideIcons, Package, Puzzle, AlertTriangle } from 'lucide-react';
import { resolveBinding, sanitizeUrl, sanitizeHtml } from '@kubuild/core';
import {
  RenderContext,
  resolveAssetSync,
  isActionRegistered,
  Diagnostic,
} from '../render-context';
import { FormRuntimeProvider } from '../form-context';
import {
  EditableText,
  HtmlEmbedView,
  FormContainerNode,
  FormInputNode,
  FormTextareaNode,
  FormSelectNode,
  FormCheckboxNode,
  FormRadioNode,
  FormSubmitButtonNode,
  toPascalCase,
  getYouTubeId,
  getVimeoId,
  aspectRatioToCss,
} from '../nodes';

export interface RenderNodeContentOptions {
  node: Node;
  document: PageDocument;
  registry: ComponentRegistry;
  context: RenderContext;
  viewport: 'desktop' | 'tablet' | 'mobile';
  mode: 'editor' | 'runtime';
  styles: React.CSSProperties;
  props: Record<string, unknown>;
  resolvedProps: Record<string, unknown>;
  definition?: ComponentDefinition;
  domId: string;
  childrenElements?: React.ReactNode;
  handleClick: (e: React.MouseEvent) => void;
  onNodeClick?: (nodeId: string, event: React.MouseEvent) => void;
  onDiagnostic?: (diagnostic: Diagnostic) => void;
  onActionDispatch?: (actionType: string, payload: Record<string, unknown> | undefined, nodeId: string) => void;
  onNodePropChange?: (nodeId: string, propName: string, value: unknown, isBlur?: boolean) => void;
  instanceSuffix?: string;
  renderChildNode: (child: Node, instanceSuffix?: string, itemContext?: RenderContext) => React.ReactElement;
}

/**
 * Renders custom component if registered in ComponentRegistry.
 */
export function renderCustomComponent(options: RenderNodeContentOptions): React.ReactElement | null {
  const { node, document, definition, resolvedProps, styles, context, childrenElements, handleClick } = options;

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

  return null;
}

/**
 * Layout nodes: page, section, container, columns
 */
export function renderLayoutNode(options: RenderNodeContentOptions): React.ReactElement | null {
  const { node, domId, styles, resolvedProps, props, handleClick, childrenElements } = options;

  switch (node.type) {
    case 'page':
      return (
        <div id={domId} style={styles} onClick={handleClick} data-kubuild-node={node.id}>
          {childrenElements}
        </div>
      );
    case 'section': {
      const ariaLabel =
        typeof resolvedProps.ariaLabel === 'string'
          ? resolvedProps.ariaLabel
          : typeof props.ariaLabel === 'string'
          ? props.ariaLabel
          : undefined;

      return (
        <section
          id={domId}
          style={styles}
          onClick={handleClick}
          data-kubuild-node={node.id}
          aria-label={ariaLabel}
        >
          {childrenElements}
        </section>
      );
    }
    case 'container':
      return (
        <div id={domId} style={styles} onClick={handleClick} data-kubuild-node={node.id}>
          {childrenElements}
        </div>
      );
    case 'columns':
      return (
        <div id={domId} style={styles} onClick={handleClick} data-kubuild-node={node.id}>
          {childrenElements}
        </div>
      );
    case 'flex':
    case 'grid': {
      const ariaLabel =
        typeof resolvedProps.ariaLabel === 'string'
          ? resolvedProps.ariaLabel
          : typeof props.ariaLabel === 'string'
          ? props.ariaLabel
          : undefined;

      return (
        <div
          id={domId}
          style={styles}
          onClick={handleClick}
          data-kubuild-node={node.id}
          aria-label={ariaLabel}
        >
          {childrenElements}
        </div>
      );
    }
    default:
      return null;
  }
}

/**
 * Typography nodes: heading, text, paragraph, link, blockquote, badge, code-block
 */
export function renderTypographyNode(options: RenderNodeContentOptions): React.ReactElement | null {
  const {
    node,
    domId,
    styles,
    resolvedProps,
    props,
    mode,
    handleClick,
    onNodePropChange,
    childrenElements,
  } = options;

  switch (node.type) {
    case 'heading': {
      const level = typeof resolvedProps.level === 'number' ? resolvedProps.level : 1;
      const Tag = (`h${Math.min(Math.max(level, 1), 6)}` as keyof React.JSX.IntrinsicElements) || 'h1';
      const text = String(resolvedProps.text ?? resolvedProps.content ?? props.text ?? props.content ?? '');
      const isEditable = mode === 'editor' && !isVariableBinding(props.text) && !isVariableBinding(props.content);

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
        />
      );
    }
    case 'text': {
      const text = String(resolvedProps.text ?? resolvedProps.content ?? props.text ?? props.content ?? '');
      const asTag =
        typeof resolvedProps.as === 'string'
          ? resolvedProps.as
          : typeof props.as === 'string'
          ? props.as
          : typeof resolvedProps.tag === 'string'
          ? resolvedProps.tag
          : typeof props.tag === 'string'
          ? props.tag
          : (props.content !== undefined || resolvedProps.content !== undefined) && props.text === undefined && resolvedProps.text === undefined
          ? 'p'
          : 'span';
      const isEditable = mode === 'editor' && !isVariableBinding(props.text) && !isVariableBinding(props.content);

      return (
        <EditableText
          as={asTag}
          id={domId}
          style={styles}
          value={text}
          isEditable={isEditable}
          nodeId={node.id}
          onClick={handleClick}
          onChange={(val, isBlur) => onNodePropChange?.(node.id, 'text', val, isBlur)}
        />
      );
    }
    case 'paragraph': {
      const text = String(resolvedProps.text ?? resolvedProps.content ?? props.text ?? props.content ?? '');
      const isEditable = mode === 'editor' && !isVariableBinding(props.text) && !isVariableBinding(props.content);

      return (
        <EditableText
          as="p"
          id={domId}
          style={styles}
          value={text}
          isEditable={isEditable}
          nodeId={node.id}
          onClick={handleClick}
          onChange={(val, isBlur) => onNodePropChange?.(node.id, 'text', val, isBlur)}
        />
      );
    }
    case 'link': {
      const text = String(resolvedProps.text ?? resolvedProps.label ?? resolvedProps.content ?? props.text ?? props.label ?? props.content ?? '');
      const href = typeof resolvedProps.href === 'string' ? resolvedProps.href : '#';
      const target = typeof resolvedProps.target === 'string' ? resolvedProps.target : undefined;
      const isEditable =
        mode === 'editor' &&
        !isVariableBinding(props.text) &&
        !isVariableBinding(props.label) &&
        !isVariableBinding(props.content);

      const computedRel =
        typeof resolvedProps.rel === 'string'
          ? resolvedProps.rel
          : target === '_blank'
          ? 'noopener noreferrer'
          : undefined;

      const safeHref = mode === 'editor' ? undefined : sanitizeUrl(href, '#');

      const handleLinkClick = (e: React.MouseEvent) => {
        if (mode === 'editor') {
          e.preventDefault();
        }
        handleClick(e);
      };

      if (isEditable) {
        return (
          <EditableText
            as="a"
            id={domId}
            style={styles}
            value={text}
            isEditable={isEditable}
            nodeId={node.id}
            onClick={handleLinkClick}
            onChange={(val, isBlur) => {
              const propKey = 'text' in props ? 'text' : 'label';
              onNodePropChange?.(node.id, propKey, val, isBlur);
            }}
            href={safeHref}
            target={target}
            rel={computedRel}
          />
        );
      }

      return (
        <a
          id={domId}
          style={styles}
          href={safeHref}
          target={target}
          rel={computedRel}
          onClick={handleLinkClick}
          data-kubuild-node={node.id}
        >
          {text}
        </a>
      );
    }
    case 'blockquote': {
      const quote =
        typeof resolvedProps.quote === 'string'
          ? resolvedProps.quote
          : typeof resolvedProps.text === 'string'
          ? resolvedProps.text
          : typeof props.quote === 'string'
          ? props.quote
          : typeof props.text === 'string'
          ? props.text
          : undefined;
      const cite = typeof resolvedProps.cite === 'string' ? resolvedProps.cite : (typeof props.cite === 'string' ? props.cite : undefined);
      const isEditable = mode === 'editor' && !isVariableBinding(props.quote) && !isVariableBinding(props.text);

      const defaultBlockquoteStyle: React.CSSProperties = {
        borderLeft: '4px solid #cbd5e1',
        paddingLeft: '1rem',
        margin: '1rem 0',
        fontStyle: 'italic',
        color: '#475569',
        ...styles,
      };

      return (
        <blockquote
          id={domId}
          style={defaultBlockquoteStyle}
          onClick={handleClick}
          data-kubuild-node={node.id}
          cite={cite}
        >
          {quote !== undefined ? (
            isEditable ? (
              <EditableText
                as="p"
                value={quote}
                isEditable={isEditable}
                nodeId={node.id}
                onChange={(val, isBlur) => {
                  const propKey = 'quote' in props ? 'quote' : 'text';
                  onNodePropChange?.(node.id, propKey, val, isBlur);
                }}
              />
            ) : (
              <p>{quote}</p>
            )
          ) : null}
          {childrenElements}
          {cite && (
            <cite style={{ display: 'block', fontStyle: 'normal', fontSize: '0.875rem', marginTop: '0.5rem', color: '#64748b' }}>
              — {cite}
            </cite>
          )}
        </blockquote>
      );
    }
    case 'badge': {
      const text = String(resolvedProps.text ?? resolvedProps.label ?? props.text ?? props.label ?? '');
      const variant = typeof resolvedProps.variant === 'string' ? resolvedProps.variant : (typeof props.variant === 'string' ? props.variant : 'default');
      const isEditable = mode === 'editor' && !isVariableBinding(props.text) && !isVariableBinding(props.label);

      return (
        <span
          id={domId}
          style={styles}
          onClick={handleClick}
          data-kubuild-node={node.id}
          data-variant={variant}
          data-badge-variant={variant}
        >
          {isEditable ? (
            <EditableText
              as="span"
              value={text}
              isEditable={isEditable}
              nodeId={node.id}
              onChange={(val, isBlur) => {
                const propKey = 'text' in props ? 'text' : 'label';
                onNodePropChange?.(node.id, propKey, val, isBlur);
              }}
            />
          ) : (
            text
          )}
        </span>
      );
    }
    case 'code-block': {
      const code = String(resolvedProps.code ?? props.code ?? '');
      const language = typeof resolvedProps.language === 'string' ? resolvedProps.language : (typeof props.language === 'string' ? props.language : 'plaintext');

      if (mode === 'editor') {
        return (
          <pre
            id={domId}
            style={styles}
            onClick={handleClick}
            data-kubuild-node={node.id}
            data-language={language}
          >
            <code
              className={`language-${language}`}
              contentEditable={true}
              suppressContentEditableWarning={true}
              onBlur={(e) => onNodePropChange?.(node.id, 'code', e.currentTarget.textContent ?? '', true)}
            >
              {code}
            </code>
          </pre>
        );
      }

      return (
        <pre
          id={domId}
          style={styles}
          onClick={handleClick}
          data-kubuild-node={node.id}
          data-language={language}
        >
          <code className={`language-${language}`}>{code}</code>
        </pre>
      );
    }
    default:
      return null;
  }
}

/**
 * List nodes: list, list-item
 */
export function renderListNode(options: RenderNodeContentOptions): React.ReactElement | null {
  const { node, domId, styles, resolvedProps, props, mode, handleClick, onNodePropChange, childrenElements } = options;

  switch (node.type) {
    case 'list': {
      const tag = resolvedProps.tag || props.tag;
      const Tag = tag === 'ol' || resolvedProps.ordered === true || props.ordered === true ? 'ol' : 'ul';
      const listStyle =
        typeof resolvedProps.listStyleType === 'string'
          ? resolvedProps.listStyleType
          : typeof resolvedProps.listStyle === 'string'
          ? resolvedProps.listStyle
          : typeof props.listStyleType === 'string'
          ? (props.listStyleType as string)
          : typeof props.listStyle === 'string'
          ? (props.listStyle as string)
          : undefined;
      const listStyleType = listStyle === 'custom-icon' || listStyle === 'none' ? 'none' : listStyle;

      const combinedStyles: React.CSSProperties = {
        ...styles,
        ...(listStyleType ? { listStyleType } : {}),
      };

      return (
        <Tag
          id={domId}
          style={combinedStyles}
          onClick={handleClick}
          data-kubuild-node={node.id}
          data-list-style={listStyle}
        >
          {childrenElements}
        </Tag>
      );
    }
    case 'list-item': {
      const text =
        resolvedProps.text !== undefined
          ? String(resolvedProps.text)
          : props.text !== undefined
          ? String(props.text)
          : undefined;
      const isEditable = mode === 'editor' && !isVariableBinding(props.text) && text !== undefined;

      return (
        <li
          id={domId}
          style={styles}
          onClick={handleClick}
          data-kubuild-node={node.id}
        >
          {text !== undefined && (
            isEditable ? (
              <EditableText
                as="span"
                value={text}
                isEditable={isEditable}
                nodeId={node.id}
                onChange={(val, isBlur) => onNodePropChange?.(node.id, 'text', val, isBlur)}
              />
            ) : (
              text
            )
          )}
          {childrenElements}
        </li>
      );
    }
    default:
      return null;
  }
}

/**
 * Table nodes: table, table-row, table-cell
 */
export function renderTableNode(options: RenderNodeContentOptions): React.ReactElement | null {
  const { node, domId, styles, resolvedProps, props, mode, handleClick, onNodePropChange, childrenElements } = options;

  switch (node.type) {
    case 'table': {
      const cellPadding = typeof resolvedProps.cellPadding === 'number' ? resolvedProps.cellPadding : undefined;
      const cellSpacing = typeof resolvedProps.cellSpacing === 'number' ? resolvedProps.cellSpacing : undefined;
      const border = typeof resolvedProps.border === 'number' ? resolvedProps.border : undefined;
      const striped = resolvedProps.striped === true || props.striped === true;
      const bordered = resolvedProps.bordered === true || props.bordered === true;
      const hover = resolvedProps.hover === true || props.hover === true;
      const compact = resolvedProps.compact === true || props.compact === true;

      return (
        <table
          id={domId}
          style={styles}
          cellPadding={cellPadding}
          cellSpacing={cellSpacing}
          border={border}
          onClick={handleClick}
          data-kubuild-node={node.id}
          data-striped={striped ? 'true' : undefined}
          data-bordered={bordered ? 'true' : undefined}
          data-hover={hover ? 'true' : undefined}
          data-compact={compact ? 'true' : undefined}
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
        >
          {childrenElements}
        </tr>
      );
    }
    case 'table-cell': {
      const isHeader =
        resolvedProps.tag === 'th' ||
        props.tag === 'th' ||
        resolvedProps.isHeader === true ||
        props.isHeader === true ||
        resolvedProps.cellType === 'header' ||
        props.cellType === 'header' ||
        resolvedProps.type === 'th' ||
        props.type === 'th';
      const Tag = isHeader ? 'th' : 'td';
      const colSpan =
        typeof resolvedProps.colSpan === 'number'
          ? resolvedProps.colSpan
          : typeof props.colSpan === 'number'
          ? (props.colSpan as number)
          : undefined;
      const rowSpan =
        typeof resolvedProps.rowSpan === 'number'
          ? resolvedProps.rowSpan
          : typeof props.rowSpan === 'number'
          ? (props.rowSpan as number)
          : undefined;
      const text =
        resolvedProps.text !== undefined
          ? String(resolvedProps.text)
          : props.text !== undefined
          ? String(props.text)
          : undefined;
      const isEditable = mode === 'editor' && !isVariableBinding(props.text) && text !== undefined;

      return (
        <Tag
          id={domId}
          colSpan={colSpan}
          rowSpan={rowSpan}
          style={styles}
          onClick={handleClick}
          data-kubuild-node={node.id}
        >
          {text !== undefined && (
            isEditable ? (
              <EditableText
                as="span"
                value={text}
                isEditable={isEditable}
                nodeId={node.id}
                onChange={(val, isBlur) => onNodePropChange?.(node.id, 'text', val, isBlur)}
              />
            ) : (
              text
            )
          )}
          {childrenElements}
        </Tag>
      );
    }
    default:
      return null;
  }
}

/**
 * Media nodes: image, video, icon, html-embed
 */
export function renderMediaNode(options: RenderNodeContentOptions): React.ReactElement | null {
  const { node, domId, styles, resolvedProps, props, context, mode, handleClick } = options;

  switch (node.type) {
    case 'image': {
      const rawSrc =
        resolvedProps.src !== undefined
          ? resolvedProps.src
          : props.src !== undefined
          ? props.src
          : props.asset;
      let src: string | undefined;

      if (isAssetReference(rawSrc)) {
        src = resolveAssetSync(context?.assetProvider, rawSrc.assetId) || rawSrc.fallbackUrl;
      } else if (typeof rawSrc === 'string') {
        src = resolveAssetSync(context?.assetProvider, rawSrc) || rawSrc;
      }

      const alt = typeof resolvedProps.alt === 'string' ? resolvedProps.alt : (typeof props.alt === 'string' ? props.alt : '');
      const fit = typeof resolvedProps.fit === 'string' ? (resolvedProps.fit as React.CSSProperties['objectFit']) : undefined;
      const loading = resolvedProps.loading === 'eager' ? 'eager' : 'lazy';
      const width = typeof resolvedProps.width === 'number' ? resolvedProps.width : undefined;
      const height = typeof resolvedProps.height === 'number' ? resolvedProps.height : undefined;
      const safeSrc = src ? sanitizeUrl(src, '') : undefined;

      const imgStyles: React.CSSProperties = {
        ...styles,
        ...(fit ? { objectFit: fit } : {}),
      };

      const role = alt === '' ? 'presentation' : undefined;

      return (
        <img
          id={domId}
          src={safeSrc}
          alt={alt}
          role={role}
          loading={loading}
          width={width}
          height={height}
          style={imgStyles}
          onClick={handleClick}
          data-kubuild-node={node.id}
        />
      );
    }
    case 'video': {
      const rawUrl = resolvedProps.src ?? resolvedProps.url ?? props.src ?? props.url;
      const url = typeof rawUrl === 'string' ? rawUrl : undefined;
      const poster = typeof resolvedProps.poster === 'string' ? resolvedProps.poster : undefined;
      const controls = resolvedProps.controls !== false;
      const autoplay = resolvedProps.autoplay === true;
      const loop = resolvedProps.loop === true;
      const muted = resolvedProps.muted === true;
      const playsInline = resolvedProps.playsInline !== false;
      const aspectRatio = resolvedProps.aspectRatio;

      const videoWrapperStyle: React.CSSProperties = {
        position: 'relative',
        width: styles.width || '100%',
        ...(aspectRatio ? { aspectRatio: aspectRatioToCss(aspectRatio) } : {}),
        ...styles,
      };

      const youtubeId = url ? getYouTubeId(url) : null;
      const vimeoId = url ? getVimeoId(url) : null;

      if (youtubeId) {
        const embedUrl = `https://www.youtube.com/embed/${youtubeId}?autoplay=${autoplay ? 1 : 0}&loop=${loop ? 1 : 0}&mute=${muted ? 1 : 0}&controls=${controls ? 1 : 0}`;
        const safeEmbedUrl = sanitizeUrl(embedUrl, '');

        return (
          <div
            id={domId}
            data-video-provider="youtube"
            style={videoWrapperStyle}
            onClick={handleClick}
            data-kubuild-node={node.id}
          >
            <iframe
              src={safeEmbedUrl}
              title="YouTube video player"
              style={{ width: '100%', height: '100%', border: 0 }}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              allowFullScreen
            />
          </div>
        );
      }

      if (vimeoId) {
        const embedUrl = `https://player.vimeo.com/video/${vimeoId}?autoplay=${autoplay ? 1 : 0}&loop=${loop ? 1 : 0}&muted=${muted ? 1 : 0}`;
        const safeEmbedUrl = sanitizeUrl(embedUrl, '');

        return (
          <div
            id={domId}
            data-video-provider="vimeo"
            style={videoWrapperStyle}
            onClick={handleClick}
            data-kubuild-node={node.id}
          >
            <iframe
              src={safeEmbedUrl}
              title="Vimeo video player"
              style={{ width: '100%', height: '100%', border: 0 }}
              allow="autoplay; fullscreen; picture-in-picture"
              allowFullScreen
            />
          </div>
        );
      }

      const safeVideoUrl = url ? sanitizeUrl(url, '') : undefined;
      const safePoster = poster ? sanitizeUrl(poster, '') : undefined;

      return (
        <video
          id={domId}
          src={safeVideoUrl}
          poster={safePoster}
          controls={controls}
          autoPlay={autoplay}
          loop={loop}
          muted={muted}
          playsInline={playsInline}
          style={videoWrapperStyle}
          onClick={handleClick}
          data-kubuild-node={node.id}
        />
      );
    }
    case 'icon': {
      const name = typeof resolvedProps.name === 'string' ? resolvedProps.name : 'Square';
      const size = typeof resolvedProps.size === 'number' ? resolvedProps.size : 24;
      const color = typeof resolvedProps.color === 'string' ? resolvedProps.color : 'currentColor';
      const strokeWidth = typeof resolvedProps.strokeWidth === 'number' ? resolvedProps.strokeWidth : 2;

      const pascalName = toPascalCase(name);
      // @ts-expect-error Lucide icons indexed access
      const IconComponent = lucideIcons[pascalName] || lucideIcons[name] || Package;

      return (
        <span
          id={domId}
          data-icon-name={name}
          style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', ...styles }}
          onClick={handleClick}
          data-kubuild-node={node.id}
        >
          <IconComponent size={size} color={color} strokeWidth={strokeWidth} />
        </span>
      );
    }
    case 'html-embed': {
      const rawHtml = typeof resolvedProps.html === 'string' ? resolvedProps.html : '';
      const isSanitized = resolvedProps.sanitize !== false;
      const finalHtml = isSanitized ? sanitizeHtml(rawHtml) : rawHtml;

      if (!finalHtml.trim() && mode === 'editor') {
        return (
          <div
            id={domId}
            style={{
              ...styles,
              minHeight: '60px',
              border: '1px dashed #94a3b8',
              borderRadius: '4px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: '#f8fafc',
              color: '#64748b',
              fontSize: '0.875rem',
            }}
            onClick={handleClick}
            data-kubuild-node={node.id}
          >
            <span>&lt;/&gt; HTML Embed — Click to configure HTML code in Inspector Panel</span>
          </div>
        );
      }

      return (
        <HtmlEmbedView
          id={domId}
          style={styles}
          html={finalHtml}
          onClick={handleClick}
          dataKubuildNode={node.id}
        />
      );
    }
    default:
      return null;
  }
}

/**
 * Form nodes: button, form, input, textarea, select, checkbox, radio
 */
export function renderFormNode(options: RenderNodeContentOptions): React.ReactElement | null {
  const {
    node,
    domId,
    styles,
    resolvedProps,
    props,
    context,
    mode,
    document,
    onDiagnostic,
    onActionDispatch,
    handleClick,
    onNodePropChange,
    childrenElements,
  } = options;

  switch (node.type) {
    case 'button': {
      const label = String(resolvedProps.label ?? resolvedProps.text ?? resolvedProps.content ?? props.label ?? props.text ?? props.content ?? 'Button');
      const href = typeof resolvedProps.href === 'string' ? resolvedProps.href : (typeof props.href === 'string' ? props.href : undefined);
      const target = typeof resolvedProps.target === 'string' ? resolvedProps.target : (typeof props.target === 'string' ? props.target : undefined);
      const rawButtonType = resolvedProps.buttonType ?? resolvedProps.type ?? props.buttonType ?? props.type;
      const buttonType =
        typeof rawButtonType === 'string' &&
        ['submit', 'reset', 'button'].includes(rawButtonType)
          ? (rawButtonType as 'submit' | 'reset' | 'button')
          : 'button';
      const disabled = resolvedProps.disabled === true || props.disabled === true;
      const ariaLabel = typeof resolvedProps.ariaLabel === 'string' ? resolvedProps.ariaLabel : undefined;
      const isEditable = mode === 'editor' && !isVariableBinding(props.label) && !isVariableBinding(props.text);

      const computedRel =
        typeof resolvedProps.rel === 'string'
          ? resolvedProps.rel
          : typeof props.rel === 'string'
          ? (props.rel as string)
          : target === '_blank'
          ? 'noopener noreferrer'
          : undefined;

      const actionAttrs: Record<string, unknown> = {};
      if (props.action && !disabled) {
        const actionType = typeof props.action === 'object' ? (props.action as any).type : props.action;
        actionAttrs['data-kubuild-action'] = actionType;
        if (context?.actionRegistry) {
          const isResolved = isActionRegistered(context.actionRegistry, actionType);
          actionAttrs['data-kubuild-action-resolved'] = isResolved ? 'true' : 'false';
        }
      }

      if (href && !disabled) {
        const safeHref = mode === 'editor' ? undefined : sanitizeUrl(href, '#');
        return (
          <a
            id={domId}
            href={safeHref}
            target={target}
            rel={computedRel}
            tabIndex={0}
            style={styles}
            onClick={handleClick}
            data-kubuild-node={node.id}
            aria-label={ariaLabel}
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
        <FormSubmitButtonNode
          id={domId}
          buttonType={mode === 'editor' ? 'button' : buttonType}
          disabled={disabled}
          ariaLabel={ariaLabel}
          style={styles}
          onClick={disabled ? undefined : handleClick}
          actions={node.actions}
          node={node}
          document={document}
          renderContext={context}
          onDiagnostic={onDiagnostic}
          onActionDispatch={onActionDispatch}
          dataKubuildNode={node.id}
          actionAttrs={actionAttrs}
        >
          {label}
        </FormSubmitButtonNode>
      );
    }
    case 'form': {
      const action = typeof resolvedProps.action === 'string' ? resolvedProps.action : undefined;
      const method = typeof resolvedProps.method === 'string' ? resolvedProps.method : 'POST';
      const target = typeof resolvedProps.target === 'string' ? resolvedProps.target : undefined;
      const autoComplete = typeof resolvedProps.autoComplete === 'string' ? resolvedProps.autoComplete : undefined;
      const name = typeof resolvedProps.name === 'string' ? resolvedProps.name : undefined;
      const nodeFormConfig = node.formConfig;
      const formConfig: FormConfig = {
        formId: nodeFormConfig?.formId || (props.formId as string) || name || node.id,
        resetOnSubmit: resolvedProps.resetOnSubmit === true || (nodeFormConfig?.resetOnSubmit ?? false),
        scrollToFirstError: resolvedProps.scrollToFirstError !== false && (nodeFormConfig?.scrollToFirstError ?? true),
        validateOn: (resolvedProps.validateOn as ValidateOnEvent) || nodeFormConfig?.validateOn || 'blur',
        initialValues: (resolvedProps.initialValues as Record<string, unknown>) || nodeFormConfig?.initialValues,
      };

      return (
        <FormRuntimeProvider
          formId={formConfig.formId}
          formConfig={formConfig}
          initialValues={formConfig.initialValues}
          actions={node.actions}
          nodeId={node.id}
          document={document}
          onDiagnostic={onDiagnostic}
        >
          <FormContainerNode
            id={domId}
            name={name}
            action={action && mode !== 'editor' ? sanitizeUrl(action, '') : undefined}
            method={method}
            target={target}
            autoComplete={autoComplete}
            style={styles}
            onClick={handleClick}
            mode={mode}
            dataKubuildNode={node.id}
          >
            {childrenElements}
          </FormContainerNode>
        </FormRuntimeProvider>
      );
    }
    case 'input': {
      const name = typeof resolvedProps.name === 'string' ? resolvedProps.name : undefined;
      const inputType = typeof resolvedProps.type === 'string' ? resolvedProps.type : 'text';
      const placeholder = typeof resolvedProps.placeholder === 'string' ? resolvedProps.placeholder : undefined;
      const defaultValue = resolvedProps.defaultValue !== undefined ? resolvedProps.defaultValue : undefined;
      const required = resolvedProps.required === true;
      const disabled = resolvedProps.disabled === true;
      const readOnly = resolvedProps.readOnly === true;
      const rules = (node.formConfig?.rules as ValidationRule[]) || (resolvedProps.rules as ValidationRule[]) || (props.rules as ValidationRule[]) || [];
      const validateOn = (resolvedProps.validateOn as ValidateOnEvent) || (props.validateOn as ValidateOnEvent);
      const transform = (resolvedProps.transform as 'trim' | 'lowercase' | 'uppercase' | 'number') || (props.transform as 'trim' | 'lowercase' | 'uppercase' | 'number');

      return (
        <FormInputNode
          id={domId}
          name={name}
          type={inputType}
          placeholder={placeholder}
          defaultValue={defaultValue}
          required={required}
          disabled={disabled}
          readOnly={readOnly}
          rules={rules}
          validateOn={validateOn}
          transform={transform}
          style={styles}
          onClick={handleClick}
          actions={node.actions}
          nodeId={node.id}
          document={document}
          renderContext={context}
          onDiagnostic={onDiagnostic}
          onActionDispatch={onActionDispatch}
          dataKubuildNode={node.id}
        />
      );
    }
    case 'textarea': {
      const name = typeof resolvedProps.name === 'string' ? resolvedProps.name : undefined;
      const placeholder = typeof resolvedProps.placeholder === 'string' ? resolvedProps.placeholder : undefined;
      const defaultValue = resolvedProps.defaultValue !== undefined ? resolvedProps.defaultValue : undefined;
      const rows = typeof resolvedProps.rows === 'number' ? resolvedProps.rows : 4;
      const required = resolvedProps.required === true;
      const disabled = resolvedProps.disabled === true;
      const readOnly = resolvedProps.readOnly === true;
      const rules = (node.formConfig?.rules as ValidationRule[]) || (resolvedProps.rules as ValidationRule[]) || (props.rules as ValidationRule[]) || [];
      const validateOn = (resolvedProps.validateOn as ValidateOnEvent) || (props.validateOn as ValidateOnEvent);
      const transform = (resolvedProps.transform as 'trim' | 'lowercase' | 'uppercase' | 'number') || (props.transform as 'trim' | 'lowercase' | 'uppercase' | 'number');

      return (
        <FormTextareaNode
          id={domId}
          name={name}
          placeholder={placeholder}
          defaultValue={defaultValue}
          rows={rows}
          required={required}
          disabled={disabled}
          readOnly={readOnly}
          rules={rules}
          validateOn={validateOn}
          transform={transform}
          style={styles}
          onClick={handleClick}
          actions={node.actions}
          nodeId={node.id}
          document={document}
          renderContext={context}
          onDiagnostic={onDiagnostic}
          onActionDispatch={onActionDispatch}
          dataKubuildNode={node.id}
        />
      );
    }
    case 'select': {
      const name = typeof resolvedProps.name === 'string' ? resolvedProps.name : undefined;
      const placeholder = typeof resolvedProps.placeholder === 'string' ? resolvedProps.placeholder : undefined;
      const defaultValue = resolvedProps.defaultValue !== undefined ? resolvedProps.defaultValue : undefined;
      const required = resolvedProps.required === true;
      const disabled = resolvedProps.disabled === true;
      const rules = (node.formConfig?.rules as ValidationRule[]) || (resolvedProps.rules as ValidationRule[]) || (props.rules as ValidationRule[]) || [];
      const validateOn = (resolvedProps.validateOn as ValidateOnEvent) || (props.validateOn as ValidateOnEvent);

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
        <FormSelectNode
          id={domId}
          name={name}
          placeholder={placeholder}
          defaultValue={defaultValue}
          required={required}
          disabled={disabled}
          rules={rules}
          validateOn={validateOn}
          optionsList={optionsList}
          style={styles}
          onClick={handleClick}
          actions={node.actions}
          nodeId={node.id}
          document={document}
          renderContext={context}
          onDiagnostic={onDiagnostic}
          onActionDispatch={onActionDispatch}
          dataKubuildNode={node.id}
        />
      );
    }
    case 'checkbox': {
      const name = typeof resolvedProps.name === 'string' ? resolvedProps.name : undefined;
      const label = String(resolvedProps.label ?? 'Checkbox');
      const value = resolvedProps.value !== undefined ? String(resolvedProps.value) : 'yes';
      const defaultChecked = resolvedProps.defaultChecked === true;
      const required = resolvedProps.required === true;
      const disabled = resolvedProps.disabled === true;
      const rules = (node.formConfig?.rules as ValidationRule[]) || (resolvedProps.rules as ValidationRule[]) || (props.rules as ValidationRule[]) || [];
      const validateOn = (resolvedProps.validateOn as ValidateOnEvent) || (props.validateOn as ValidateOnEvent);
      const isEditable = mode === 'editor' && !isVariableBinding(props.label);

      return (
        <FormCheckboxNode
          id={domId}
          name={name}
          label={label}
          value={value}
          defaultChecked={defaultChecked}
          required={required}
          disabled={disabled}
          rules={rules}
          validateOn={validateOn}
          style={styles}
          onClick={handleClick}
          actions={node.actions}
          nodeId={node.id}
          document={document}
          renderContext={context}
          onDiagnostic={onDiagnostic}
          onActionDispatch={onActionDispatch}
          dataKubuildNode={node.id}
          isEditable={isEditable}
          onNodePropChange={onNodePropChange}
        />
      );
    }
    case 'radio': {
      const name = typeof resolvedProps.name === 'string' ? resolvedProps.name : undefined;
      const label = String(resolvedProps.label ?? 'Radio');
      const value = resolvedProps.value !== undefined ? String(resolvedProps.value) : 'option';
      const defaultChecked = resolvedProps.defaultChecked === true;
      const required = resolvedProps.required === true;
      const disabled = resolvedProps.disabled === true;
      const rules = (resolvedProps.rules as ValidationRule[]) || (props.rules as ValidationRule[]) || [];
      const validateOn = (resolvedProps.validateOn as ValidateOnEvent) || (props.validateOn as ValidateOnEvent);
      const isEditable = mode === 'editor' && !isVariableBinding(props.label);

      return (
        <FormRadioNode
          id={domId}
          name={name}
          label={label}
          value={value}
          defaultChecked={defaultChecked}
          required={required}
          disabled={disabled}
          rules={rules}
          validateOn={validateOn}
          style={styles}
          onClick={handleClick}
          actions={node.actions}
          nodeId={node.id}
          document={document}
          renderContext={context}
          onDiagnostic={onDiagnostic}
          onActionDispatch={onActionDispatch}
          dataKubuildNode={node.id}
          isEditable={isEditable}
          onNodePropChange={onNodePropChange}
        />
      );
    }
    default:
      return null;
  }
}

/**
 * Collection node: collection
 */
export function renderCollectionNode(options: RenderNodeContentOptions): React.ReactElement | null {
  const { node, domId, styles, props, context, mode, handleClick, onDiagnostic, renderChildNode } = options;

  if (node.type !== 'collection') return null;

  const sourceKey = typeof props.sourceKey === 'string' ? props.sourceKey : undefined;
  const itemAlias = typeof props.itemAlias === 'string' && props.itemAlias.length > 0 ? props.itemAlias : 'item';
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
            padding: '12px',
            color: '#b45309',
            fontSize: '0.875rem',
            borderRadius: '4px',
          }}
          onClick={handleClick}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
            <AlertTriangle size={16} />
            <strong>Collection: expected an array</strong>
          </div>
          <div>
            Source path <code>{sourceKey ?? '(none)'}</code> did not resolve to an array. Found{' '}
            <code>{sourceValue === undefined ? 'nothing' : typeof sourceValue}</code>.
          </div>
        </div>
      );
    }

    return (
      <div
        id={domId}
        data-kubuild-node={node.id}
        style={{ display: 'contents' }}
        data-kubuild-empty-collection="invalid-source"
      />
    );
  }

  const templateChildren = node.children || [];
  if (templateChildren.length === 0 || sourceValue.length === 0) {
    return (
      <div
        id={domId}
        style={styles}
        onClick={handleClick}
        data-kubuild-node={node.id}
        data-kubuild-collection-empty={sourceValue.length === 0 ? 'true' : undefined}
      >
        {sourceValue.length === 0 && mode === 'editor' && (
          <div
            style={{
              padding: '12px',
              border: '1px dashed #cbd5e1',
              borderRadius: '4px',
              color: '#94a3b8',
              fontSize: '0.875rem',
              textAlign: 'center',
            }}
          >
            Empty Collection (<code>{sourceKey}</code> has 0 items)
          </div>
        )}
      </div>
    );
  }

  return (
    <div id={domId} style={styles} onClick={handleClick} data-kubuild-node={node.id}>
      {sourceValue.map((item, index) => {
        const itemContext: RenderContext = {
          ...context,
          variables: {
            ...context.variables,
            [itemAlias]: item,
            [indexKey]: index,
          },
        };

        const iterationSuffix = `__iter_${index}`;

        return (
          <React.Fragment key={`collection-item-${index}`}>
            {templateChildren.map((templateChild) =>
              renderChildNode(templateChild, iterationSuffix, itemContext)
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
}

/**
 * Fallback node for unregistered / unknown types.
 */
export function renderFallbackNode(options: RenderNodeContentOptions): React.ReactElement {
  const { node, domId, styles, handleClick, mode, childrenElements } = options;

  if (mode === 'editor') {
    return (
      <div
        id={domId}
        style={{
          ...styles,
          border: '2px dashed #e2e8f0',
          padding: '16px',
          backgroundColor: '#f8fafc',
        }}
        onClick={handleClick}
        data-kubuild-node={node.id}
        data-kubuild-unknown={node.type}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#64748b' }}>
          <Puzzle size={16} />
          <span>Unknown Component: {node.type}</span>
          <span style={{ fontSize: '12px', color: '#94a3b8' }}>({node.id})</span>
        </div>
        {childrenElements}
      </div>
    );
  }

  return (
    <div id={domId} style={styles} onClick={handleClick} data-kubuild-node={node.id} data-kubuild-unknown={node.type}>
      {childrenElements}
    </div>
  );
}

/**
 * Master dispatcher function for rendering node content based on node type.
 */
export function renderNodeContent(options: RenderNodeContentOptions): React.ReactElement {
  // 1. Custom component registered via ComponentRegistry
  const custom = renderCustomComponent(options);
  if (custom) return custom;

  // 2. Layout nodes
  const layout = renderLayoutNode(options);
  if (layout) return layout;

  // 3. Typography nodes
  const typography = renderTypographyNode(options);
  if (typography) return typography;

  // 4. List nodes
  const list = renderListNode(options);
  if (list) return list;

  // 5. Table nodes
  const table = renderTableNode(options);
  if (table) return table;

  // 6. Media nodes
  const media = renderMediaNode(options);
  if (media) return media;

  // 7. Form nodes
  const form = renderFormNode(options);
  if (form) return form;

  // 8. Collection node
  const collection = renderCollectionNode(options);
  if (collection) return collection;

  // 9. Fallback for unknown / custom elements without custom renderers
  return renderFallbackNode(options);
}
