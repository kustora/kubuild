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
    case 'paragraph':
      return (
        <svg {...iconProps}>
          <path d="M13 4v16" />
          <path d="M17 4v16" />
          <path d="M19 4H9.5a4.5 4.5 0 0 0 0 9H13" />
        </svg>
      );
    case 'link':
      return (
        <svg {...iconProps}>
          <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
          <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
        </svg>
      );
    case 'blockquote':
    case 'quote':
      return (
        <svg {...iconProps}>
          <path d="M3 21c3 0 7-1 7-8V5c0-1.25-.756-2.017-2-2H4c-1.25 0-2 .75-2 1.972V11c0 1.25.75 2 2 2 1 0 1 0 1 1v1c0 1-1 2-2 2s-1 .008-1 1.031V20c0 1 0 1 1 1z" />
          <path d="M15 21c3 0 7-1 7-8V5c0-1.25-.757-2.017-2-2h-4c-1.25 0-2 .75-2 1.972V11c0 1.25.75 2 2 2h.75c0 2.25.25 4-2.75 4v3c0 1 0 1 1 1z" />
        </svg>
      );
    case 'badge':
    case 'tag':
      return (
        <svg {...iconProps}>
          <path d="M12 2H2v10l9.29 9.29c.94.94 2.48.94 3.42 0l6.58-6.58c.94-.94.94-2.48 0-3.42L12 2Z" />
          <path d="M7 7h.01" />
        </svg>
      );
    case 'code-block':
    case 'code':
      return (
        <svg {...iconProps}>
          <polyline points="16 18 22 12 16 6" />
          <polyline points="8 6 2 12 8 18" />
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
    case 'icon':
    case 'sparkles':
    case 'star':
      return (
        <svg {...iconProps}>
          <path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z" />
        </svg>
      );
    case 'html-embed':
      return (
        <svg {...iconProps}>
          <polyline points="16 18 22 12 16 6" />
          <polyline points="8 6 2 12 8 18" />
          <line x1="14" x2="10" y1="4" y2="20" />
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
    case 'form':
      return (
        <svg {...iconProps}>
          <rect width="18" height="18" x="3" y="3" rx="2" />
          <path d="M7 8h10" />
          <path d="M7 12h10" />
          <path d="M7 16h6" />
        </svg>
      );
    case 'input':
      return (
        <svg {...iconProps}>
          <rect width="18" height="12" x="3" y="6" rx="2" />
          <path d="M7 10v4" />
        </svg>
      );
    case 'textarea':
      return (
        <svg {...iconProps}>
          <rect width="18" height="18" x="3" y="3" rx="2" />
          <path d="M7 7h10" />
          <path d="M7 11h10" />
          <path d="M7 15h4" />
        </svg>
      );
    case 'select':
      return (
        <svg {...iconProps}>
          <rect width="18" height="12" x="3" y="6" rx="2" />
          <path d="m15 10 2 2-2 2" />
        </svg>
      );
    case 'checkbox':
      return (
        <svg {...iconProps}>
          <rect width="18" height="18" x="3" y="3" rx="2" />
          <path d="m9 12 2 2 4-4" />
        </svg>
      );
    case 'radio':
      return (
        <svg {...iconProps}>
          <circle cx="12" cy="12" r="9" />
          <circle cx="12" cy="12" r="4" fill="currentColor" />
        </svg>
      );
    case 'dimension':
    case 'maximize':
      return (
        <svg {...iconProps}>
          <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3" />
        </svg>
      );
    case 'spacing':
    case 'box-model':
    case 'margin':
      return (
        <svg {...iconProps}>
          <rect width="18" height="18" x="3" y="3" rx="2" strokeDasharray="3 3" />
          <rect width="10" height="10" x="7" y="7" rx="1" />
        </svg>
      );
    case 'typography':
      return (
        <svg {...iconProps}>
          <polyline points="4 7 4 4 20 4 20 7" />
          <line x1="9" x2="15" y1="20" y2="20" />
          <line x1="12" x2="12" y1="4" y2="20" />
        </svg>
      );
    case 'decorations':
    case 'palette':
      return (
        <svg {...iconProps}>
          <circle cx="13.5" cy="6.5" r=".5" fill="currentColor" />
          <circle cx="17.5" cy="10.5" r=".5" fill="currentColor" />
          <circle cx="8.5" cy="7.5" r=".5" fill="currentColor" />
          <circle cx="6.5" cy="12.5" r=".5" fill="currentColor" />
          <path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.437-1.125-.29-.289-.438-.652-.438-1.125a1.64 1.64 0 0 1 1.668-1.668h1.996c3.051 0 5.555-2.503 5.555-5.554C21.965 6.012 17.461 2 12 2z" />
        </svg>
      );
    case 'flex':
    case 'alignment':
    case 'align':
      return (
        <svg {...iconProps}>
          <rect width="6" height="14" x="4" y="5" rx="1" />
          <rect width="6" height="10" x="14" y="7" rx="1" />
        </svg>
      );
    case 'chevron-down':
      return (
        <svg {...iconProps}>
          <path d="m6 9 6 6 6-6" />
        </svg>
      );
    case 'chevron-right':
      return (
        <svg {...iconProps}>
          <path d="m9 18 6-6-6-6" />
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
