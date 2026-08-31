import React, { useMemo } from 'react';
import {
  toastManager,
  useToasts,
  type ToastItem,
  type ToastPosition,
  type ToastType,
  type ToastManager as ToastManagerClass,
} from './toast-manager';
import { CheckCircle2, AlertCircle, AlertTriangle, Info, X } from 'lucide-react';

export interface ToastContainerProps {
  manager?: ToastManagerClass;
  position?: ToastPosition;
  className?: string;
  maxVisible?: number;
}

const POSITION_STYLES: Record<ToastPosition, React.CSSProperties> = {
  'top-right': {
    top: '16px',
    right: '16px',
    alignItems: 'flex-end',
  },
  'top-left': {
    top: '16px',
    left: '16px',
    alignItems: 'flex-start',
  },
  'top-center': {
    top: '16px',
    left: '50%',
    transform: 'translateX(-50%)',
    alignItems: 'center',
  },
  'bottom-right': {
    bottom: '16px',
    right: '16px',
    alignItems: 'flex-end',
  },
  'bottom-left': {
    bottom: '16px',
    left: '16px',
    alignItems: 'flex-start',
  },
  'bottom-center': {
    bottom: '16px',
    left: '50%',
    transform: 'translateX(-50%)',
    alignItems: 'center',
  },
};

const TOAST_THEMES: Record<
  ToastType,
  {
    bg: string;
    border: string;
    text: string;
    titleText: string;
    iconColor: string;
    Icon: React.ComponentType<{ size?: number; className?: string; color?: string }>;
  }
> = {
  success: {
    bg: '#f0fdf4',
    border: '#bbf7d0',
    text: '#166534',
    titleText: '#14532d',
    iconColor: '#16a34a',
    Icon: CheckCircle2,
  },
  error: {
    bg: '#fef2f2',
    border: '#fecaca',
    text: '#991b1b',
    titleText: '#7f1d1d',
    iconColor: '#dc2626',
    Icon: AlertCircle,
  },
  warning: {
    bg: '#fffbeb',
    border: '#fde68a',
    text: '#92400e',
    titleText: '#78350f',
    iconColor: '#d97706',
    Icon: AlertTriangle,
  },
  info: {
    bg: '#eff6ff',
    border: '#bfdbfe',
    text: '#1e40af',
    titleText: '#1e3a8a',
    iconColor: '#2563eb',
    Icon: Info,
  },
};

/**
 * Single Toast Item component rendering an alert card.
 */
export const ToastCard: React.FC<{ toast: ToastItem }> = ({ toast }) => {
  const theme = TOAST_THEMES[toast.type] || TOAST_THEMES.info;
  const IconComponent = theme.Icon;

  return (
    <div
      role="alert"
      aria-live="polite"
      data-testid={`toast-${toast.id}`}
      data-toast-type={toast.type}
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: '12px',
        width: '100%',
        maxWidth: '380px',
        minWidth: '280px',
        padding: '12px 14px',
        backgroundColor: theme.bg,
        border: `1px solid ${theme.border}`,
        borderRadius: '8px',
        boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
        color: theme.text,
        fontSize: '14px',
        lineHeight: '1.4',
        pointerEvents: 'auto',
        animation: 'kubuildToastIn 200ms cubic-bezier(0.16, 1, 0.3, 1)',
        wordBreak: 'break-word',
        boxSizing: 'border-box',
        transition: 'all 200ms ease',
      }}
    >
      <div style={{ flexShrink: 0, marginTop: '2px', color: theme.iconColor }}>
        <IconComponent size={18} color={theme.iconColor} />
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        {toast.title && (
          <div
            style={{
              fontWeight: 600,
              fontSize: '14px',
              marginBottom: '2px',
              color: theme.titleText,
            }}
          >
            {toast.title}
          </div>
        )}
        <div style={{ color: theme.text }}>{toast.message}</div>
      </div>

      {toast.dismissible && (
        <button
          type="button"
          aria-label="Close notification"
          onClick={toast.dismiss}
          data-testid={`toast-dismiss-${toast.id}`}
          style={{
            flexShrink: 0,
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            padding: '2px',
            marginLeft: '4px',
            color: theme.text,
            opacity: 0.7,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: '4px',
          }}
        >
          <X size={16} />
        </button>
      )}
    </div>
  );
};

/**
 * Built-in responsive Toast Container component.
 * Renders floating toasts with smooth animations and auto-dismiss capabilities.
 */
export const ToastContainer: React.FC<ToastContainerProps> = ({
  manager = toastManager,
  position,
  className,
  maxVisible = 5,
}) => {
  const { toasts } = useToasts(manager);

  // Group toasts by position if position prop is not specified
  const groupedToasts = useMemo(() => {
    if (position) {
      return { [position]: toasts.filter((t) => (t.position || 'top-right') === position) };
    }

    const groups: Record<ToastPosition, ToastItem[]> = {
      'top-right': [],
      'top-left': [],
      'top-center': [],
      'bottom-right': [],
      'bottom-left': [],
      'bottom-center': [],
    };

    toasts.forEach((t) => {
      const pos = t.position || 'top-right';
      groups[pos].push(t);
    });

    return groups;
  }, [toasts, position]);

  if (toasts.length === 0) {
    return null;
  }

  return (
    <>
      <style>{`
        @keyframes kubuildToastIn {
          from {
            opacity: 0;
            transform: translateY(-8px) scale(0.96);
          }
          to {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }
      `}</style>
      {(Object.entries(groupedToasts) as [ToastPosition, ToastItem[]][]).map(([pos, items]) => {
        if (!items || items.length === 0) return null;
        const visibleItems = items.slice(-maxVisible);

        return (
          <div
            key={pos}
            data-testid={`toast-container-${pos}`}
            className={className}
            style={{
              position: 'fixed',
              zIndex: 99999,
              display: 'flex',
              flexDirection: 'column',
              gap: '8px',
              maxWidth: 'calc(100vw - 32px)',
              pointerEvents: 'none',
              ...POSITION_STYLES[pos],
            }}
          >
            {visibleItems.map((toast) => (
              <ToastCard key={toast.id} toast={toast} />
            ))}
          </div>
        );
      })}
    </>
  );
};

