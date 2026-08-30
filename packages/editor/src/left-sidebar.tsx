import React, { useState } from 'react';
import { ComponentRegistry } from '@kubuild/components';
import { Boxes, Blocks, Layers } from 'lucide-react';
import { ComponentPanel } from './component-panel';
import { BlocksPanel } from './blocks-panel';
import { LayersPanel } from './layers-panel';

export type LeftSidebarTab = 'components' | 'blocks' | 'layers';

export interface LeftSidebarProps {
  registry: ComponentRegistry;
  defaultTab?: LeftSidebarTab;
  className?: string;
}

/**
 * Left Sidebar with tabs: Components, Blocks, and Layers — STORA-240.
 */
export const LeftSidebar: React.FC<LeftSidebarProps> = ({
  registry,
  defaultTab = 'components',
  className,
}) => {
  const [activeTab, setActiveTab] = useState<LeftSidebarTab>(defaultTab);

  return (
    <div className={`flex flex-col h-full min-h-0 bg-white border-r border-slate-200 ${className || ''}`}>
      {/* Sidebar Top Tab Switcher */}
      <div
        role="tablist"
        aria-label="Sidebar Navigation"
        className="flex items-center border-b border-slate-200 bg-slate-50/80 px-2 pt-2 gap-1 shrink-0 select-none"
      >
        <button
          type="button"
          role="tab"
          id="tab-components"
          aria-selected={activeTab === 'components'}
          aria-controls="tabpanel-components"
          data-testid="tab-components"
          onClick={() => setActiveTab('components')}
          className={`flex-1 py-2 text-xs font-semibold rounded-t-md transition-all flex items-center justify-center gap-1.5 border-t border-x ${
            activeTab === 'components'
              ? 'bg-white text-blue-600 border-slate-200 border-b-white -mb-px shadow-xs'
              : 'border-transparent text-slate-500 hover:text-slate-800 hover:bg-slate-100'
          }`}
        >
          <Boxes className="w-3.5 h-3.5" aria-hidden="true" />
          <span>Components</span>
        </button>

        <button
          type="button"
          role="tab"
          id="tab-blocks"
          aria-selected={activeTab === 'blocks'}
          aria-controls="tabpanel-blocks"
          data-testid="tab-blocks"
          onClick={() => setActiveTab('blocks')}
          className={`flex-1 py-2 text-xs font-semibold rounded-t-md transition-all flex items-center justify-center gap-1.5 border-t border-x ${
            activeTab === 'blocks'
              ? 'bg-white text-blue-600 border-slate-200 border-b-white -mb-px shadow-xs'
              : 'border-transparent text-slate-500 hover:text-slate-800 hover:bg-slate-100'
          }`}
        >
          <Blocks className="w-3.5 h-3.5" aria-hidden="true" />
          <span>Blocks</span>
        </button>

        <button
          type="button"
          role="tab"
          id="tab-layers"
          aria-selected={activeTab === 'layers'}
          aria-controls="tabpanel-layers"
          data-testid="tab-layers"
          onClick={() => setActiveTab('layers')}
          className={`flex-1 py-2 text-xs font-semibold rounded-t-md transition-all flex items-center justify-center gap-1.5 border-t border-x ${
            activeTab === 'layers'
              ? 'bg-white text-blue-600 border-slate-200 border-b-white -mb-px shadow-xs'
              : 'border-transparent text-slate-500 hover:text-slate-800 hover:bg-slate-100'
          }`}
        >
          <Layers className="w-3.5 h-3.5" aria-hidden="true" />
          <span>Layers</span>
        </button>
      </div>

      {/* Tab Panels */}
      <div className="flex-1 overflow-hidden min-h-0">
        {activeTab === 'components' && (
          <div role="tabpanel" id="tabpanel-components" aria-labelledby="tab-components" className="h-full">
            <ComponentPanel registry={registry} />
          </div>
        )}
        {activeTab === 'blocks' && (
          <div role="tabpanel" id="tabpanel-blocks" aria-labelledby="tab-blocks" className="h-full">
            <BlocksPanel registry={registry} />
          </div>
        )}
        {activeTab === 'layers' && (
          <div role="tabpanel" id="tabpanel-layers" aria-labelledby="tab-layers" className="h-full">
            <LayersPanel registry={registry} />
          </div>
        )}
      </div>
    </div>
  );
};
