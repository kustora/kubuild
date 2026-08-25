import React from 'react';

export interface ComponentIconProps {
  iconOrType?: string;
  className?: string;
  size?: number;
}

export const ComponentIcon: React.FC<ComponentIconProps> = ({
  iconOrType,
  className = '',
  size = 15,
}) => {
  const iconProps = {
    width: size,
    height: size,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 2,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    className,
  };

  switch (iconOrType) {
    case 'layout':
    case 'page':
      return (
        <svg {...iconProps}>
          <rect width="18" height="18" x="3" y="3" rx="2" />
          <path d="M3 9h18" />
          <path d="M9 21V9" />
        </svg>
      );
    case 'rows':
    case 'section':
      return (
        <svg {...iconProps}>
          <rect width="18" height="18" x="3" y="3" rx="2" />
          <path d="M3 10h18" />
          <path d="M3 15h18" />
        </svg>
      );
    case 'box':
    case 'container':
      return (
        <svg {...iconProps}>
          <rect width="18" height="18" x="3" y="3" rx="2" />
          <rect width="10" height="10" x="7" y="7" rx="1" strokeDasharray="2 2" />
        </svg>
      );
    case 'columns':
      return (
        <svg {...iconProps}>
          <rect width="18" height="18" x="3" y="3" rx="2" />
          <path d="M12 3v18" />
        </svg>
      );
    case 'heading':
      return (
        <svg {...iconProps}>
          <path d="M6 12h12" />
          <path d="M6 4v16" />
          <path d="M18 4v16" />
        </svg>
      );
    case 'type':
    case 'text':
      return (
        <svg {...iconProps}>
          <path d="M4 7V4h16v3" />
          <path d="M9 20h6" />
          <path d="M12 4v16" />
        </svg>
      );
    case 'image':
      return (
        <svg {...iconProps}>
          <rect width="18" height="18" x="3" y="3" rx="2" />
          <circle cx="9" cy="9" r="2" />
          <path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21" />
        </svg>
      );
    case 'mouse-pointer':
    case 'button':
      return (
        <svg {...iconProps}>
          <rect width="18" height="12" x="3" y="6" rx="3" />
          <path d="M8 12h8" />
        </svg>
      );
    case 'database':
    case 'collection':
      return (
        <svg {...iconProps}>
          <ellipse cx="12" cy="5" rx="9" ry="3" />
          <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5" />
          <path d="M3 12c0 1.66 4 3 9 3s9-1.34 9-3" />
        </svg>
      );
    case 'list':
    case 'list-item':
      return (
        <svg {...iconProps}>
          <line x1="8" x2="21" y1="6" y2="6" />
          <line x1="8" x2="21" y1="12" y2="12" />
          <line x1="8" x2="21" y1="18" y2="18" />
          <line x1="3" x2="3.01" y1="6" y2="6" />
          <line x1="3" x2="3.01" y1="12" y2="12" />
          <line x1="3" x2="3.01" y1="18" y2="18" />
        </svg>
      );
    case 'table':
    case 'table-row':
    case 'table-cell':
      return (
        <svg {...iconProps}>
          <rect width="18" height="18" x="3" y="3" rx="2" />
          <path d="M3 9h18" />
          <path d="M3 15h18" />
          <path d="M9 3v18" />
          <path d="M15 3v18" />
        </svg>
      );
    case 'video':
      return (
        <svg {...iconProps}>
          <rect width="18" height="14" x="3" y="5" rx="2" />
          <polygon points="10 9 15 12 10 15 10 9" />
        </svg>
      );
    case 'divider':
    case 'hr':
      return (
        <svg {...iconProps}>
          <line x1="3" x2="21" y1="12" y2="12" />
        </svg>
      );
    default:
      return (
        <svg {...iconProps}>
          <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
        </svg>
      );
  }
};
