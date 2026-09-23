import React, { useEffect, useState, useRef } from 'react';
import {
  ComponentRegistry,
  ComponentTraitDefinition,
  TRAIT_GROUP_ORDER,
  TRAIT_GROUP_LABELS,
  TraitGroup,
} from '@kubuild/components';
import { findNodeById, AssetProvider } from '@kubuild/core';
import { PageDocument, FormConfig } from '@kubuild/schema';
import { X, Upload, Image as ImageIcon, Link2 } from 'lucide-react';
import { FormValidationRulesPanel, isFormFieldNode } from './form-validation-rules-panel';
import { useEditorStore } from '../../store';
import { useTranslation } from '../../i18n';
import type { MediaTranslations } from '../../i18n';

export interface TraitsPanelProps {
  registry: ComponentRegistry;
  document: PageDocument;
  selectedNodeId: string | null;
  /** Commit a single trait value to the node's props. */
  onCommitTrait: (traitName: string, value: unknown) => void;
  /** Commit form configuration updates (including validation rules) to the node. */
  onUpdateFormConfig?: (formConfig: Partial<FormConfig> | null) => void;
  className?: string;
  /** Host asset provider for direct uploads and asset management */
  assetProvider?: AssetProvider;
}

function ErrorText({ message }: { message: string | null | undefined }) {
  if (!message) return null;
  return (
    <div
      role="alert"
      className="text-xs text-red-600 bg-red-50 border border-red-200 rounded px-2 py-1 mt-1"
    >
      {message}
    </div>
  );
}

interface TraitStringControlProps {
  trait: ComponentTraitDefinition;
  value: unknown;
  onCommit: (value: string) => void;
}

const TraitStringControl: React.FC<TraitStringControlProps> = ({ trait, value, onCommit }) => {
  const valueStr = typeof value === 'string' ? value : '';
  const [text, setText] = useState(valueStr);
  const isFocusedRef = useRef(false);

  useEffect(() => {
    if (!isFocusedRef.current) {
      setText(typeof value === 'string' ? value : '');
    }
  }, [value]);

  return (
    <input
      type="text"
      value={text}
      onFocus={() => {
        isFocusedRef.current = true;
      }}
      onChange={(e) => {
        setText(e.target.value);
        onCommit(e.target.value);
      }}
      onBlur={() => {
        isFocusedRef.current = false;
        onCommit(text);
      }}
      placeholder={trait.defaultValue !== undefined ? String(trait.defaultValue) : ''}
      className="w-full text-xs bg-white text-slate-900 border border-slate-300 rounded px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
    />
  );
};

function getAssetDisplayName(urlOrData: string, media: MediaTranslations): string {
  if (!urlOrData) return '';
  if (urlOrData.startsWith('data:image/')) return media.embeddedImage;
  if (urlOrData.startsWith('blob:')) return media.blobFile;
  try {
    const parsed = new URL(urlOrData);
    const pathname = parsed.pathname;
    const segments = pathname.split('/').filter(Boolean);
    const last = segments[segments.length - 1];
    if (last) {
      const decoded = decodeURIComponent(last);
      const cleanName = decoded.replace(/^(\d{10,14}|[a-f0-9-]{36})[-_]/, '');
      return cleanName || decoded;
    }
  } catch {
    const segments = urlOrData.split('/').filter(Boolean);
    return segments[segments.length - 1] || urlOrData;
  }
  return media.imageAsset;
}

interface TraitMediaSrcControlProps extends TraitStringControlProps {
  assetProvider?: AssetProvider;
}

const TraitMediaSrcControl: React.FC<TraitMediaSrcControlProps> = ({ trait, value, onCommit, assetProvider }) => {
  const valueStr = typeof value === 'string' ? value : '';
  const [text, setText] = useState(valueStr);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [showUrlInput, setShowUrlInput] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const isFocusedRef = useRef(false);
  const { media } = useTranslation().t;

  useEffect(() => {
    if (!isFocusedRef.current) {
      setText(typeof value === 'string' ? value : '');
    }
  }, [value]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';

    if (assetProvider?.upload) {
      setIsUploading(true);
      setUploadError(null);
      try {
        const info = await assetProvider.upload(file);
        setText(info.url);
        onCommit(info.url);
        setShowUrlInput(false);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : media.uploadFailed;
        setUploadError(msg);
      } finally {
        setIsUploading(false);
      }
    } else {
      const reader = new FileReader();
      reader.onload = () => {
        const dataUrl = reader.result as string;
        setText(dataUrl);
        onCommit(dataUrl);
        setShowUrlInput(false);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleClear = () => {
    setText('');
    onCommit('');
    setShowUrlInput(false);
  };

  const isDataUrl = text.startsWith('data:image/');
  const hasPreview = text.trim().length > 0 && (isDataUrl || text.startsWith('http://') || text.startsWith('https://') || text.startsWith('blob:'));
  const isLocalFilePath = text.trim().startsWith('file:') || /^[a-zA-Z]:\\/.test(text.trim());
  const displayName = getAssetDisplayName(text, media);

  return (
    <div className="flex flex-col gap-1.5">
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileUpload}
        accept="image/png, image/jpeg, image/jpg, image/webp, image/svg+xml, image/gif, image/avif"
        className="hidden"
        disabled={isUploading}
      />

      {hasPreview ? (
        <div className="flex flex-col gap-1.5">
          {/* Preview Card without showing ugly raw URL */}
          <div className="flex items-center gap-2.5 bg-slate-50 border border-slate-200 rounded-lg p-2">
            <div className="w-10 h-10 rounded border border-slate-300 bg-white overflow-hidden shrink-0 flex items-center justify-center">
              <img
                src={text}
                alt={media.previewAlt}
                className="w-full h-full object-cover"
                onError={(e) => {
                  (e.target as HTMLElement).style.display = 'none';
                }}
              />
            </div>
            <div className="flex-1 min-w-0 flex flex-col">
              <span className="text-xs font-semibold text-slate-800 truncate" title={displayName}>
                {displayName}
              </span>
              <span className="text-[10px] text-slate-400">
                {isDataUrl ? media.localImage : media.imageAsset}
              </span>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <button
                type="button"
                title={isUploading ? media.uploadingImage : media.replaceImageTitle}
                aria-label={media.replaceImageAria}
                disabled={isUploading}
                onClick={() => fileInputRef.current?.click()}
                className="px-2 py-1 text-xs rounded border border-slate-300 bg-white text-slate-700 hover:text-blue-600 hover:border-blue-400 hover:bg-blue-50/50 transition flex items-center gap-1 font-medium cursor-pointer shadow-2xs disabled:opacity-50"
              >
                {isUploading ? (
                  <div className="w-3 h-3 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
                ) : (
                  <Upload className="w-3 h-3" />
                )}
                <span className="text-[11px]">{isUploading ? media.uploading : media.replace}</span>
              </button>
              <button
                type="button"
                onClick={handleClear}
                title={media.removeImage}
                aria-label={media.removeImage}
                className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded border border-slate-200 bg-white transition cursor-pointer shadow-2xs"
              >
                <X className="w-3.5 h-3.5" aria-hidden="true" />
              </button>
            </div>
          </div>

          {/* Optional toggle for manual URL if needed */}
          {showUrlInput ? (
            <div className="flex items-center gap-1.5 mt-0.5">
              <input
                type="text"
                value={text}
                disabled={isUploading}
                onFocus={() => {
                  isFocusedRef.current = true;
                }}
                onChange={(e) => {
                  setText(e.target.value);
                  onCommit(e.target.value);
                }}
                onBlur={() => {
                  isFocusedRef.current = false;
                  onCommit(text);
                }}
                placeholder="https://..."
                className="flex-1 min-w-0 text-xs bg-white text-slate-900 border border-slate-300 rounded px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-500 font-mono text-[11px]"
              />
              <button
                type="button"
                onClick={() => setShowUrlInput(false)}
                className="p-1 text-slate-400 hover:text-slate-600 text-xs"
                title={media.hideUrl}
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setShowUrlInput(true)}
              className="text-[10px] text-slate-400 hover:text-slate-600 self-start flex items-center gap-1 hover:underline cursor-pointer"
            >
              <Link2 className="w-3 h-3" />
              <span>{media.useManualUrl}</span>
            </button>
          )}
        </div>
      ) : (
        /* When NO image is selected yet */
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center gap-1.5">
            <input
              type="text"
              value={text}
              disabled={isUploading}
              onFocus={() => {
                isFocusedRef.current = true;
              }}
              onChange={(e) => {
                setText(e.target.value);
                onCommit(e.target.value);
              }}
              onBlur={() => {
                isFocusedRef.current = false;
                onCommit(text);
              }}
              placeholder={trait.defaultValue !== undefined ? String(trait.defaultValue) : media.urlOrUploadPlaceholder}
              className="flex-1 min-w-0 text-xs bg-white text-slate-900 border border-slate-300 rounded px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-500 font-mono text-[11px]"
            />
            <button
              type="button"
              title={isUploading ? media.uploading : media.uploadFromDevice}
              aria-label={media.uploadFromDevice}
              disabled={isUploading}
              onClick={() => fileInputRef.current?.click()}
              className="shrink-0 p-1.5 rounded border border-slate-300 bg-white text-slate-600 hover:text-blue-600 hover:border-blue-400 hover:bg-blue-50/50 transition flex items-center gap-1 text-xs font-medium cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed shadow-2xs"
            >
              {isUploading ? (
                <div className="w-3.5 h-3.5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
              ) : (
                <Upload className="w-3.5 h-3.5" />
              )}
              <span className="text-[11px]">{isUploading ? media.uploading : media.upload}</span>
            </button>
          </div>
        </div>
      )}

      {uploadError && (
        <span className="text-[10px] text-red-500 font-medium">{uploadError}</span>
      )}

      {isLocalFilePath && (
        <div className="text-[11px] text-amber-700 bg-amber-50 border border-amber-200 rounded p-1.5 leading-tight">
          {media.localPathWarning(media.upload)}
        </div>
      )}
    </div>
  );
};

interface TraitNumberControlProps {
  trait: ComponentTraitDefinition;
  value: unknown;
  onCommit: (value: number | undefined) => void;
}

const TraitNumberControl: React.FC<TraitNumberControlProps> = ({ trait, value, onCommit }) => {
  const valueNum = typeof value === 'number' ? value : undefined;
  const [text, setText] = useState(valueNum !== undefined ? String(valueNum) : '');
  const isFocusedRef = useRef(false);

  useEffect(() => {
    if (!isFocusedRef.current) {
      setText(valueNum !== undefined ? String(valueNum) : '');
    }
  }, [value]);

  const commit = (raw: string) => {
    if (raw.trim() === '') {
      onCommit(undefined);
      return;
    }
    const parsed = Number(raw);
    if (!Number.isNaN(parsed)) {
      onCommit(parsed);
    }
  };

  return (
    <input
      type="number"
      value={text}
      onFocus={() => {
        isFocusedRef.current = true;
      }}
      onChange={(e) => {
        setText(e.target.value);
        commit(e.target.value);
      }}
      onBlur={() => {
        isFocusedRef.current = false;
        commit(text);
      }}
      placeholder={trait.defaultValue !== undefined ? String(trait.defaultValue) : ''}
      className="w-full text-xs bg-white text-slate-900 border border-slate-300 rounded px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
    />
  );
};

interface TraitBooleanControlProps {
  trait: ComponentTraitDefinition;
  value: unknown;
  onCommit: (value: boolean) => void;
}

const TraitBooleanControl: React.FC<TraitBooleanControlProps> = ({ trait, value, onCommit }) => {
  const checked = Boolean(value);
  return (
    <label className="flex items-center gap-2 cursor-pointer select-none">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onCommit(e.target.checked)}
        className="h-3.5 w-3.5 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
      />
      <span className="text-xs text-slate-600">{checked ? 'Enabled' : 'Disabled'}</span>
    </label>
  );
};

interface TraitSelectControlProps {
  trait: ComponentTraitDefinition;
  value: unknown;
  onCommit: (value: unknown) => void;
}

const TraitSelectControl: React.FC<TraitSelectControlProps> = ({ trait, value, onCommit }) => {
  const options = trait.options ?? [];
  const currentStr = value !== undefined && value !== null ? String(value) : '';

  return (
    <select
      value={currentStr}
      onChange={(e) => {
        const option = options.find((o) => String(o.value) === e.target.value);
        onCommit(option ? option.value : e.target.value);
      }}
      className="w-full text-xs bg-white text-slate-900 border border-slate-300 rounded px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
    >
      {trait.defaultValue === undefined && <option value="">— none —</option>}
      {options.map((opt) => (
        <option key={String(opt.value)} value={String(opt.value)}>
          {opt.label}
        </option>
      ))}
    </select>
  );
};

function renderTraitControl(
  trait: ComponentTraitDefinition,
  value: unknown,
  onCommit: (value: unknown) => void,
  assetProvider?: AssetProvider,
): React.ReactNode {
  switch (trait.type) {
    case 'number':
      return <TraitNumberControl trait={trait} value={value} onCommit={onCommit} />;
    case 'boolean':
      return <TraitBooleanControl trait={trait} value={value} onCommit={onCommit} />;
    case 'select':
      return <TraitSelectControl trait={trait} value={value} onCommit={onCommit} />;
    case 'string':
    default:
      if (trait.name === 'src') {
        return <TraitMediaSrcControl trait={trait} value={value} onCommit={onCommit} assetProvider={assetProvider} />;
      }
      return <TraitStringControl trait={trait} value={value} onCommit={onCommit} />;
  }
}

/**
 * Composite link control (STORA-212): URL input + "Open in new tab" toggle +
 * rel attribute select, rendered as one card in place of the separate
 * href/target/rel traits. Values are committed per-trait via `onCommitTrait`.
 */
interface LinkTraitControlProps {
  traits: ComponentTraitDefinition[];
  props: Record<string, unknown> | undefined;
  onCommitTrait: (traitName: string, value: unknown) => void;
}

const LinkTraitControl: React.FC<LinkTraitControlProps> = ({ traits, props, onCommitTrait }) => {
  const hrefTrait = traits.find((t) => t.name === 'href');
  const targetTrait = traits.find((t) => t.name === 'target');
  const relTrait = traits.find((t) => t.name === 'rel');

  const href = typeof props?.href === 'string' ? props.href : '';
  const target = typeof props?.target === 'string' ? props.target : '';
  const rel = typeof props?.rel === 'string' ? props.rel : '';
  const openInNewTab = target === '_blank';

  const handleToggleNewTab = (checked: boolean) => {
    onCommitTrait('target', checked ? '_blank' : '');
    // Reset rel when disabling so stale `noopener noreferrer` doesn't linger.
    if (!checked && rel) {
      onCommitTrait('rel', '');
    }
  };

  return (
    <div className="rounded border border-slate-200 bg-slate-50/60 p-2.5 flex flex-col gap-3">
      <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Link</div>

      {hrefTrait && (
        <div>
          <label className="flex items-center gap-1 text-xs font-medium text-slate-600 mb-1">
            {hrefTrait.label}
            {hrefTrait.required && <span className="text-red-500">*</span>}
          </label>
          <TraitStringControl
            trait={hrefTrait}
            value={href}
            onCommit={(v) => onCommitTrait('href', v)}
          />
          {hrefTrait.description && (
            <div className="text-[10px] text-slate-400 mt-0.5">{hrefTrait.description}</div>
          )}
        </div>
      )}

      {targetTrait && (
        <div>
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={openInNewTab}
              onChange={(e) => handleToggleNewTab(e.target.checked)}
              className="h-3.5 w-3.5 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
            />
            <span className="text-xs font-medium text-slate-600">Open in new tab</span>
            {openInNewTab && (
              <span className="ml-auto text-[10px] font-mono text-slate-400">target="_blank"</span>
            )}
          </label>
        </div>
      )}

      {relTrait && (
        <div>
          <label className="flex items-center gap-1 text-xs font-medium text-slate-600 mb-1">
            {relTrait.label}
            {openInNewTab && !rel && (
              <span className="ml-auto text-[10px] text-slate-400 italic">
                auto: noopener noreferrer
              </span>
            )}
          </label>
          <TraitSelectControl
            trait={relTrait}
            value={rel}
            onCommit={(v) => onCommitTrait('rel', v)}
          />
          {relTrait.description && (
            <div className="text-[10px] text-slate-400 mt-0.5">{relTrait.description}</div>
          )}
        </div>
      )}
    </div>
  );
};

/**
 * Traits tab content (STORA-211): renders the functional/HTML attribute
 * metadata declared on the selected component's definition, grouped by
 * trait group (identity, link, media, form, behavior, semantic, accessibility).
 */
export const TraitsPanel: React.FC<TraitsPanelProps> = ({
  registry,
  document,
  selectedNodeId,
  onCommitTrait,
  onUpdateFormConfig,
  className,
  assetProvider,
}) => {
  const node = selectedNodeId ? findNodeById(document.document, selectedNodeId) : null;
  const definition = node ? registry.get(node.type) : undefined;
  const storeUpdateFormConfig = useEditorStore((s) => s.updateNodeFormConfig);

  if (!node || !definition) {
    return (
      <div className={`p-3 text-xs text-slate-500 ${className || ''}`}>No element selected.</div>
    );
  }

  const handleUpdateFormConfig = (cfg: Partial<FormConfig> | null) => {
    if (onUpdateFormConfig) {
      onUpdateFormConfig(cfg);
    } else {
      storeUpdateFormConfig(node.id, cfg);
    }
  };

  const isForm = isFormFieldNode(node);
  const traits = definition.traits ?? [];

  if (traits.length === 0 && !isForm) {
    return (
      <div className={`p-3 text-xs text-slate-500 ${className || ''}`}>
        <div className="mb-1 font-medium text-slate-600">{definition.label}</div>
        This component has no configurable HTML attributes.
      </div>
    );
  }

  // Group traits by their declared group, preserving TRAIT_GROUP_ORDER.
  const grouped = new Map<TraitGroup | undefined, ComponentTraitDefinition[]>();
  for (const trait of traits) {
    const key = trait.group;
    const list = grouped.get(key) ?? [];
    list.push(trait);
    grouped.set(key, list);
  }

  const orderedGroups = [
    ...TRAIT_GROUP_ORDER.filter((g) => grouped.has(g)),
    ...(grouped.has(undefined) ? [undefined as TraitGroup | undefined] : []),
  ];

  return (
    <div className={`flex flex-col gap-4 ${className ?? 'p-3'} text-sm text-slate-900`}>
      {/* STORA-344: Form Validation Rules Inspector Panel */}
      {isForm && (
        <FormValidationRulesPanel
          node={node}
          onUpdateFormConfig={handleUpdateFormConfig}
          onCommitProp={onCommitTrait}
        />
      )}

      {orderedGroups.map((group) => {
        const groupTraits = grouped.get(group) ?? [];
        // Composite link control (STORA-212): when the group holds href/target/rel,
        // render one unified Link card instead of three separate fields.
        const traitNames = new Set(groupTraits.map((t) => t.name));
        const isLinkGroup = group === 'link' && traitNames.has('href');
        return (
          <div key={group ?? 'ungrouped'}>
            <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
              {group ? TRAIT_GROUP_LABELS[group] : 'Other'}
            </div>
            {isLinkGroup ? (
              <LinkTraitControl
                traits={groupTraits}
                props={node.props}
                onCommitTrait={onCommitTrait}
              />
            ) : (
            <div className="flex flex-col gap-3">
              {groupTraits.map((trait) => {
                const value = node.props?.[trait.name];
                return (
                  <div key={trait.name}>
                    <label className="flex items-center gap-1 text-xs font-medium text-slate-600 mb-1">
                      {trait.label}
                      {trait.required && <span className="text-red-500">*</span>}
                      {trait.attribute && trait.attribute !== trait.name && (
                        <span
                          className="ml-auto text-[10px] font-mono text-slate-400"
                          title={`HTML attribute: ${trait.attribute}`}
                        >
                          {trait.attribute}
                        </span>
                      )}
                    </label>
                    {renderTraitControl(trait, value, (v) => onCommitTrait(trait.name, v), assetProvider)}
                    {trait.description && (
                      <div className="text-[10px] text-slate-400 mt-0.5">{trait.description}</div>
                    )}
                  </div>
                );
              })}
            </div>
            )}
          </div>
        );
      })}
    </div>
  );
};
