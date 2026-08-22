import React from 'react';
import { PageDocument, Node, isAssetReference } from '@kubuild/schema';
import { ComponentRegistry, createDefaultComponentRegistry } from '@kubuild/components';
import { RuntimeContext } from '@kubuild/core';
import { resolveNodeStyles } from './styles';

export interface KubuildRendererProps {
  document: PageDocument;
  registry?: ComponentRegistry;
  context?: RuntimeContext;
  viewport?: 'desktop' | 'tablet' | 'mobile';
  className?: string;
  onNodeClick?: (nodeId: string, event: React.MouseEvent) => void;
}

export function NodeRenderer({
  node,
  registry,
  context,
  viewport = 'desktop',
  onNodeClick,
}: {
  node: Node;
  registry: ComponentRegistry;
  context?: RuntimeContext;
  viewport?: 'desktop' | 'tablet' | 'mobile';
  onNodeClick?: (nodeId: string, event: React.MouseEvent) => void;
}): React.ReactElement {
  const styles = resolveNodeStyles(node.styles, viewport);
  const props = node.props || {};

  const handleClick = (e: React.MouseEvent) => {
    if (onNodeClick) {
      onNodeClick(node.id, e);
    }
  };

  const childrenElements = node.children?.map((child: Node) => (
    <NodeRenderer
      key={child.id}
      node={child}
      registry={registry}
      context={context}
      viewport={viewport}
      onNodeClick={onNodeClick}
    />
  ));

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
      const text = (props.text as string) || '';
      const Tag = `h${Math.min(Math.max(level, 1), 6)}` as 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6';
      return (
        <Tag id={node.id} style={styles} onClick={handleClick} data-kubuild-node={node.id}>
          {text}
        </Tag>
      );
    }
    case 'text':
      return (
        <p id={node.id} style={styles} onClick={handleClick} data-kubuild-node={node.id}>
          {(props.content as string) || ''}
        </p>
      );
    case 'image': {
      const directSrc = typeof props.src === 'string' && props.src.length > 0 ? props.src : undefined;
      const fallbackSrc = isAssetReference(props.asset) ? props.asset.fallbackUrl : undefined;
      return (
        <img
          id={node.id}
          src={directSrc || fallbackSrc || undefined}
          alt={(props.alt as string) || ''}
          width={props.width as number}
          height={props.height as number}
          style={styles}
          onClick={handleClick}
          data-kubuild-node={node.id}
        />
      );
    }
    case 'button': {
      const label = (props.label as string) || 'Button';
      const disabled = props.disabled === true;
      const href = typeof props.href === 'string' ? props.href : undefined;

      if (href && !disabled) {
        return (
          <a id={node.id} href={href} style={styles} onClick={handleClick} data-kubuild-node={node.id}>
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
        >
          {label}
        </button>
      );
    }
    default:
      return (
        <div
          id={node.id}
          style={{ ...styles, border: '1px dashed #cbd5e1', padding: '8px' }}
          onClick={handleClick}
          data-kubuild-node={node.id}
        >
          {childrenElements || <span>Unknown Component ({node.type})</span>}
        </div>
      );
  }
}

export const KubuildRenderer: React.FC<KubuildRendererProps> = ({
  document,
  registry = createDefaultComponentRegistry(),
  context,
  viewport = 'desktop',
  className,
  onNodeClick,
}) => {
  if (!document || !document.document) {
    return <div className={className}>Empty Document</div>;
  }

  return (
    <div className={`kubuild-canvas-root ${className || ''}`}>
      <NodeRenderer
        node={document.document}
        registry={registry}
        context={context}
        viewport={viewport}
        onNodeClick={onNodeClick}
      />
    </div>
  );
};
