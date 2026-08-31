import React, { useState, useMemo } from 'react';
import { STARTER_BLOCKS, BlockDefinition, ComponentRegistry } from '@kubuild/components';
import { insertNode, collectNodeIdSet } from '@kubuild/core';
import { useEditorStore } from './store';
import { ComponentIcon } from './icons';
import { Image as ImageIcon } from 'lucide-react';

export interface BlocksPanelProps {
  registry?: ComponentRegistry;
  blocks?: BlockDefinition[];
  className?: string;
  onInsertBlock?: (block: BlockDefinition) => void;
}

/**
 * Thumbnail schematic preview component for blocks
 */
export const BlockThumbnail: React.FC<{ block: BlockDefinition }> = ({ block }) => {
  switch (block.id) {
    case 'layout-1-col':
      return (
        <div className="w-full h-12 bg-slate-50 border border-slate-200 rounded flex items-center justify-center p-1">
          <div className="w-full h-full bg-blue-100/70 border border-blue-300 rounded flex items-center justify-center text-[9px] text-blue-700 font-medium">
            100%
          </div>
        </div>
      );
    case 'layout-2-col-50-50':
      return (
        <div className="w-full h-12 bg-slate-50 border border-slate-200 rounded flex items-center justify-center gap-1 p-1">
          <div className="flex-1 h-full bg-blue-100/70 border border-blue-300 rounded flex items-center justify-center text-[9px] text-blue-700 font-medium">
            50%
          </div>
          <div className="flex-1 h-full bg-blue-100/70 border border-blue-300 rounded flex items-center justify-center text-[9px] text-blue-700 font-medium">
            50%
          </div>
        </div>
      );
    case 'layout-2-col-30-70':
      return (
        <div className="w-full h-12 bg-slate-50 border border-slate-200 rounded flex items-center justify-center gap-1 p-1">
          <div className="w-[30%] h-full bg-blue-100/70 border border-blue-300 rounded flex items-center justify-center text-[8px] text-blue-700 font-medium">
            30%
          </div>
          <div className="w-[70%] h-full bg-blue-100/70 border border-blue-300 rounded flex items-center justify-center text-[8px] text-blue-700 font-medium">
            70%
          </div>
        </div>
      );
    case 'layout-3-col':
      return (
        <div className="w-full h-12 bg-slate-50 border border-slate-200 rounded flex items-center justify-center gap-1 p-1">
          <div className="flex-1 h-full bg-blue-100/70 border border-blue-300 rounded flex items-center justify-center text-[8px] text-blue-700 font-medium">
            1/3
          </div>
          <div className="flex-1 h-full bg-blue-100/70 border border-blue-300 rounded flex items-center justify-center text-[8px] text-blue-700 font-medium">
            1/3
          </div>
          <div className="flex-1 h-full bg-blue-100/70 border border-blue-300 rounded flex items-center justify-center text-[8px] text-blue-700 font-medium">
            1/3
          </div>
        </div>
      );
    case 'layout-4-col':
      return (
        <div className="w-full h-12 bg-slate-50 border border-slate-200 rounded flex items-center justify-center gap-1 p-1">
          <div className="flex-1 h-full bg-blue-100/70 border border-blue-300 rounded text-[7px] text-blue-700 font-medium flex items-center justify-center">
            1/4
          </div>
          <div className="flex-1 h-full bg-blue-100/70 border border-blue-300 rounded text-[7px] text-blue-700 font-medium flex items-center justify-center">
            1/4
          </div>
          <div className="flex-1 h-full bg-blue-100/70 border border-blue-300 rounded text-[7px] text-blue-700 font-medium flex items-center justify-center">
            1/4
          </div>
          <div className="flex-1 h-full bg-blue-100/70 border border-blue-300 rounded text-[7px] text-blue-700 font-medium flex items-center justify-center">
            1/4
          </div>
        </div>
      );
    case 'hero-section':
      return (
        <div className="w-full h-12 bg-slate-100 border border-slate-200 rounded flex flex-col items-center justify-center p-1.5 gap-1">
          <div className="w-2/3 h-1.5 bg-slate-800 rounded-full" />
          <div className="w-1/2 h-1 bg-slate-400 rounded-full" />
          <div className="w-1/3 h-2 bg-blue-600 rounded mt-0.5" />
        </div>
      );
    case 'feature-card':
      return (
        <div className="w-full h-12 bg-white border border-slate-200 rounded flex flex-col p-1.5 justify-between shadow-xs">
          <div className="w-6 h-1.5 bg-blue-500 rounded-full" />
          <div className="w-3/4 h-1.5 bg-slate-700 rounded" />
          <div className="w-full h-1 bg-slate-300 rounded" />
        </div>
      );
    case 'media-object':
      return (
        <div className="w-full h-12 bg-white border border-slate-200 rounded flex items-center gap-1.5 p-1.5">
          <div className="w-7 h-7 bg-indigo-50 border border-indigo-200 rounded shrink-0 flex items-center justify-center">
            <ImageIcon className="w-4 h-4 text-indigo-600" />
          </div>
          <div className="flex-1 flex flex-col gap-1">
            <div className="w-3/4 h-1.5 bg-slate-700 rounded" />
            <div className="w-full h-1 bg-slate-300 rounded" />
          </div>
        </div>
      );
    case 'pricing-table':
      return (
        <div className="w-full h-12 bg-white border-2 border-blue-400 rounded flex flex-col items-center justify-center p-1 gap-1">
          <div className="w-10 h-1.5 bg-slate-700 rounded" />
          <div className="w-8 h-2 bg-blue-600 rounded font-bold text-[8px] text-white flex items-center justify-center">
            $$$
          </div>
        </div>
      );
    case 'cta-banner':
      return (
        <div className="w-full h-12 bg-slate-900 border border-slate-800 rounded flex flex-col items-center justify-center p-1.5 gap-1 text-white">
          <div className="w-3/4 h-1.5 bg-white rounded" />
          <div className="w-1/3 h-2 bg-blue-500 rounded text-[8px] flex items-center justify-center font-bold">
            CTA
          </div>
        </div>
      );
    default:
      return (
        <div className="w-full h-12 bg-slate-50 border border-slate-200 rounded flex items-center justify-center text-slate-400">
          <ComponentIcon iconOrType={block.icon ?? 'layout'} size={20} />
        </div>
      );
  }
};

/**
 * Tab "Blocks" di Sidebar Kiri Editor — STORA-240.
 * Displays grid of ready-to-use layout & pre-composed template block cards per category.
 */
export const BlocksPanel: React.FC<BlocksPanelProps> = ({
  blocks = STARTER_BLOCKS,
  className,
  onInsertBlock,
}) => {
  const { document, selectedNodeId, dispatch, selectNode } = useEditorStore();
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  const categories = useMemo(() => {
    const set = new Set<string>();
    blocks.forEach((b) => set.add(b.category));
    return ['all', ...Array.from(set)];
  }, [blocks]);

  const filteredBlocks = useMemo(() => {
    return blocks.filter((b) => {
      const matchCat = selectedCategory === 'all' || b.category === selectedCategory;
      const matchQuery =
        !searchQuery ||
        b.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (b.description && b.description.toLowerCase().includes(searchQuery.toLowerCase()));
      return matchCat && matchQuery;
    });
  }, [blocks, selectedCategory, searchQuery]);

  const handleInsert = (block: BlockDefinition) => {
    if (onInsertBlock) {
      onInsertBlock(block);
      return;
    }

    const existingIds = collectNodeIdSet(document.document);
    let counter = 1;
    const generateId = (prefix = 'block') => {
      let id = `${prefix}-${Date.now().toString(36)}-${counter++}`;
      while (existingIds.has(id)) {
        id = `${prefix}-${Date.now().toString(36)}-${counter++}`;
      }
      existingIds.add(id);
      return id;
    };

    const nodeTree = block.createNodeTree(generateId);
    const targetParentId = selectedNodeId ?? document.document.id;

    try {
      dispatch((doc) => insertNode(doc, { parentId: targetParentId, node: nodeTree }));
      selectNode(nodeTree.id);
    } catch {
      // Fallback: insert at page root
      dispatch((doc) => insertNode(doc, { parentId: document.document.id, node: nodeTree }));
      selectNode(nodeTree.id);
    }
  };

  const setDragPayload = useEditorStore((s) => s.setDragPayload);

  const handleDragStart = (e: React.DragEvent, block: BlockDefinition) => {
    e.dataTransfer.effectAllowed = 'copy';
    e.dataTransfer.setData('text/plain', `block:${block.id}`);
    e.dataTransfer.setData('application/kubuild-drag-type', 'block');
    e.dataTransfer.setData('application/kubuild-block-id', block.id);
    setDragPayload({ type: 'block', blockId: block.id });
  };

  const handleDragEnd = () => {
    setDragPayload(null);
  };

  return (
    <div
      data-testid="blocks-panel"
      className={`flex flex-col h-full min-h-0 bg-white text-slate-800 ${className || ''}`}
    >
      {/* Search Input */}
      <div className="p-3 pb-2 border-b border-slate-100">
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search blocks..."
          className="w-full text-xs px-2.5 py-1.5 rounded border border-slate-300 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 bg-slate-50 placeholder-slate-400"
        />
      </div>

      {/* Category Pills */}
      <div className="flex items-center gap-1 px-3 py-2 overflow-x-auto border-b border-slate-100 no-scrollbar">
        {categories.map((cat) => (
          <button
            key={cat}
            type="button"
            onClick={() => setSelectedCategory(cat)}
            className={`px-2 py-1 rounded-full text-[11px] font-medium capitalize shrink-0 transition ${
              selectedCategory === cat
                ? 'bg-blue-600 text-white shadow-xs'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            {cat === 'all' ? 'All Blocks' : cat}
          </button>
        ))}
      </div>

      {/* Blocks Grid */}
      <div className="flex-1 overflow-y-auto p-3 min-h-0">
        {filteredBlocks.length === 0 ? (
          <div className="text-center py-8 text-xs text-slate-400">No blocks found.</div>
        ) : (
          <div className="grid grid-cols-2 gap-2.5">
            {filteredBlocks.map((block) => (
              <button
                key={block.id}
                type="button"
                draggable={true}
                onDragStart={(e) => handleDragStart(e, block)}
                onDragEnd={handleDragEnd}
                data-testid="block-card"
                data-block-id={block.id}
                onClick={() => handleInsert(block)}
                title={block.description || `Click to insert or drag to canvas: ${block.name}`}
                className="flex flex-col justify-between p-2 rounded-lg border border-slate-200 bg-white hover:border-blue-400 hover:shadow-md hover:bg-blue-50/20 transition-all text-left group cursor-grab active:cursor-grabbing select-none"
              >
                {/* Thumbnail Illustration */}
                <div className="mb-2 w-full pointer-events-none">
                  <BlockThumbnail block={block} />
                </div>

                {/* Card Title & Info */}
                <div className="w-full pointer-events-none">
                  <div className="flex items-center justify-between gap-1 mb-0.5">
                    <span className="text-[11px] font-semibold text-slate-800 group-hover:text-blue-600 truncate">
                      {block.name}
                    </span>
                  </div>
                  <span className="inline-block text-[9px] uppercase tracking-wider font-semibold text-slate-400 bg-slate-100 px-1 py-0.2 rounded">
                    {block.category}
                  </span>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
