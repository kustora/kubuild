import React, { useRef, useState } from 'react';

export interface PanelResizeHandleProps {
  side: 'left' | 'right';
  onResize: (deltaX: number) => void;
  onResizeStart?: () => void;
  onResizeEnd?: () => void;
  onDoubleClick?: () => void;
  ariaLabel?: string;
  title?: string;
  className?: string;
}

export const PanelResizeHandle: React.FC<PanelResizeHandleProps> = ({
  side,
  onResize,
  onResizeStart,
  onResizeEnd,
  onDoubleClick,
  ariaLabel = 'Resize panel',
  title = 'Drag to resize panel (Double-click to reset)',
  className = '',
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const startXRef = useRef<number>(0);

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();

    startXRef.current = e.clientX;
    setIsDragging(true);
    onResizeStart?.();

    const onPointerMove = (moveEvent: PointerEvent) => {
      moveEvent.preventDefault();
      const deltaX = moveEvent.clientX - startXRef.current;
      startXRef.current = moveEvent.clientX;
      onResize(deltaX);
    };

    const onPointerUp = (upEvent: PointerEvent) => {
      upEvent.preventDefault();
      setIsDragging(false);
      onResizeEnd?.();
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      document.body.style.removeProperty('cursor');
      document.body.style.removeProperty('user-select');
    };

    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';

    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'ArrowLeft') {
      e.preventDefault();
      onResize(side === 'right' ? -16 : 16);
    } else if (e.key === 'ArrowRight') {
      e.preventDefault();
      onResize(side === 'right' ? 16 : -16);
    } else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onDoubleClick?.();
    }
  };

  return (
    <div
      role="separator"
      tabIndex={0}
      aria-orientation="vertical"
      aria-label={ariaLabel}
      title={title}
      onPointerDown={handlePointerDown}
      onDoubleClick={onDoubleClick}
      onKeyDown={handleKeyDown}
      data-testid={`panel-resize-handle-${side}`}
      className={`relative group flex items-center justify-center w-2 -mx-1 shrink-0 z-20 cursor-col-resize select-none touch-none focus:outline-none focus:ring-1 focus:ring-blue-500/50 ${className}`}
    >
      {/* Visual Accent Line */}
      <div
        className={`w-[2px] h-full transition-colors duration-150 ${
          isDragging
            ? 'bg-blue-600 shadow-[0_0_8px_rgba(37,99,235,0.7)]'
            : 'bg-transparent group-hover:bg-blue-400 group-hover:shadow-[0_0_4px_rgba(96,165,250,0.5)]'
        }`}
      />
      {/* Center Grip Indicator */}
      <div
        className={`absolute top-1/2 -translate-y-1/2 w-1 h-6 rounded-full transition-all duration-150 pointer-events-none ${
          isDragging
            ? 'bg-blue-600 scale-y-125 opacity-100'
            : 'opacity-0 group-hover:opacity-100 bg-blue-400'
        }`}
      />
    </div>
  );
};
