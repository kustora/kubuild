import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle } from 'lucide-react';

export interface ComponentErrorBoundaryProps {
  nodeId: string;
  componentType: string;
  mode?: 'editor' | 'runtime';
  children: ReactNode;
  onError?: (error: Error, info: ErrorInfo) => void;
}

interface ComponentErrorBoundaryState {
  hasError: boolean;
  error?: Error;
}

export class ComponentErrorBoundary extends Component<
  ComponentErrorBoundaryProps,
  ComponentErrorBoundaryState
> {
  constructor(props: ComponentErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): ComponentErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }
  }

  render(): ReactNode {
    if (this.state.hasError) {
      const { nodeId, componentType, mode = 'runtime' } = this.props;
      const errorMessage = this.state.error?.message || 'Unknown render error';

      if (mode === 'editor') {
        return (
          <div
            data-kubuild-node={nodeId}
            data-kubuild-error={componentType}
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
            <div style={{ fontWeight: 600, marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <AlertTriangle size={14} aria-hidden="true" />
              <span>Component Render Error: &lt;{componentType}&gt;</span>
            </div>
            <div style={{ fontSize: '11px', color: '#7f1d1d', wordBreak: 'break-all' }}>
              Node ID: <code>{nodeId}</code> — {errorMessage}
            </div>
          </div>
        );
      }

      // In runtime mode: render a safe invisible or minimal placeholder to avoid page crash
      return (
        <div
          data-kubuild-node={nodeId}
          data-kubuild-error={componentType}
          style={{ display: 'none' }}
          aria-hidden="true"
        />
      );
    }

    return this.props.children;
  }
}
