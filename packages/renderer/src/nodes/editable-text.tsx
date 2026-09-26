import React, { useRef, useLayoutEffect, useEffect, useMemo } from 'react';

const useIsomorphicLayoutEffect =
  typeof window !== 'undefined' &&
  typeof window.document !== 'undefined' &&
  typeof window.document.createElement !== 'undefined'
    ? useLayoutEffect
    : useEffect;

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function getCaretOffset(element: HTMLElement): number | null {
  const selection = typeof window !== 'undefined' ? window.getSelection() : null;
  if (!selection || selection.rangeCount === 0) return null;
  const range = selection.getRangeAt(0);
  if (!element.contains(range.endContainer)) return null;

  try {
    const preCaretRange = range.cloneRange();
    preCaretRange.selectNodeContents(element);
    preCaretRange.setEnd(range.endContainer, range.endOffset);
    return preCaretRange.toString().length;
  } catch {
    return null;
  }
}

function setCaretOffset(element: HTMLElement, offset: number) {
  const selection = typeof window !== 'undefined' ? window.getSelection() : null;
  if (!selection) return;

  let currentOffset = 0;
  let found = false;

  const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
  let textNode = walker.nextNode();

  while (textNode) {
    const textLength = textNode.textContent?.length ?? 0;
    if (currentOffset + textLength >= offset) {
      const targetOffset = Math.min(Math.max(offset - currentOffset, 0), textLength);
      const range = document.createRange();
      range.setStart(textNode, targetOffset);
      range.collapse(true);
      selection.removeAllRanges();
      selection.addRange(range);
      found = true;
      break;
    }
    currentOffset += textLength;
    textNode = walker.nextNode();
  }

  if (!found) {
    const range = document.createRange();
    range.selectNodeContents(element);
    range.collapse(false);
    selection.removeAllRanges();
    selection.addRange(range);
  }
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
  const elementRef = useRef<HTMLElement | null>(null);
  const isEditingRef = useRef(false);
  const savedCaretOffsetRef = useRef<number | null>(null);
  const lastHtmlRef = useRef<string>(escapeHtml(value ?? ''));
  const prevValueRef = useRef(value);

  // Keep lastHtmlRef in sync with latest value whenever not actively editing/typing
  if (!isEditingRef.current) {
    lastHtmlRef.current = escapeHtml(value ?? '');
  }

  // React 19 diffs `dangerouslySetInnerHTML` by object identity and rewrites innerHTML
  // whenever the object changes, which would wipe in-progress typing and reset the caret
  // to offset 0 on every re-render. Keep the object stable while the markup is unchanged.
  const html = lastHtmlRef.current;
  const innerHtml = useMemo(() => ({ __html: html }), [html]);

  useIsomorphicLayoutEffect(() => {
    const valueChanged = prevValueRef.current !== value;
    prevValueRef.current = value;
    if (!isEditable || !elementRef.current) return;

    const isFocused =
      document.activeElement === elementRef.current ||
      elementRef.current.contains(document.activeElement);

    if (isEditingRef.current && isFocused) {
      // Only a real prop change that didn't come from our own onInput (e.g. undo/redo)
      // may overwrite the DOM; a stale/skipped value must never clobber what's typed.
      if (valueChanged && elementRef.current.textContent !== value) {
        elementRef.current.textContent = value ?? '';
        lastHtmlRef.current = escapeHtml(value ?? '');
        setCaretOffset(elementRef.current, (value ?? '').length);
      } else if (savedCaretOffsetRef.current !== null) {
        // If caret collapsed to 0 due to any DOM reconciliation, restore it to saved position
        const currentCaret = getCaretOffset(elementRef.current);
        if (currentCaret === 0 && savedCaretOffsetRef.current > 0) {
          setCaretOffset(elementRef.current, savedCaretOffsetRef.current);
        }
      }
      savedCaretOffsetRef.current = null;
      return;
    }

    // External change (inspector panel, prop edit, switching nodes)
    if (elementRef.current.textContent !== value) {
      elementRef.current.textContent = value ?? '';
      lastHtmlRef.current = escapeHtml(value ?? '');
    }
  }, [value, isEditable]);

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

  const isSingleLine =
    typeof as === 'string' &&
    (as.startsWith('h') || as === 'button' || as === 'span' || as === 'a');

  return (
    <Tag
      ref={elementRef}
      key={nodeId}
      id={id}
      className={className}
      style={{
        ...style,
        outline: 'none',
        cursor: 'text',
        userSelect: 'text',
        WebkitUserSelect: 'text',
      }}
      contentEditable={true}
      suppressContentEditableWarning={true}
      draggable={false}
      data-kubuild-node={nodeId}
      dangerouslySetInnerHTML={innerHtml}
      onPointerDown={(e: React.PointerEvent) => {
        e.stopPropagation();
      }}
      onMouseDown={(e: React.MouseEvent) => {
        e.stopPropagation();
      }}
      onClick={(e: React.MouseEvent) => {
        e.stopPropagation();
        onClick?.(e);
      }}
      onDoubleClick={(e: React.MouseEvent) => {
        e.stopPropagation();
      }}
      onDragStart={(e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
      }}
      onFocus={() => {
        isEditingRef.current = true;
      }}
      onInput={(e: React.FormEvent<HTMLElement>) => {
        const target = e.currentTarget;
        const text = target.textContent ?? '';
        savedCaretOffsetRef.current = getCaretOffset(target);
        onChange?.(text, false);
      }}
      onBlur={(e: React.FocusEvent<HTMLElement>) => {
        isEditingRef.current = false;
        savedCaretOffsetRef.current = null;
        const text = e.currentTarget.textContent ?? '';
        lastHtmlRef.current = escapeHtml(text);
        onChange?.(text, true);
      }}
      onKeyDown={(e: React.KeyboardEvent) => {
        if (e.key === 'Escape') {
          (e.currentTarget as HTMLElement).blur();
        } else if (e.key === 'Enter' && isSingleLine && !e.shiftKey) {
          e.preventDefault();
          (e.currentTarget as HTMLElement).blur();
        }
      }}
      {...rest}
    />
  );
};


