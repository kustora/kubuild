import React, { useRef } from 'react';

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

