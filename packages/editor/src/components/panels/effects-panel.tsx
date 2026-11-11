import React from 'react';
import { MAX_NODE_EFFECTS, type Node, type NodeEffect } from '@kubuild/schema';
import {
  resolveEffect,
  type EffectFieldDescriptor,
  type EffectKeyframe,
  type EffectKeyframeChannel,
  type EffectRegistry,
} from '@kubuild/core';
import { Trash2 } from 'lucide-react';
import { ComponentIcon } from '../ui/icons.js';
import { useTranslation } from '../../i18n/index.js';

export interface EffectsPanelProps {
  node: Node;
  registry: EffectRegistry;
  /** Receives the node's complete new effect list; `null` removes it. */
  onChange: (effects: NodeEffect[] | null) => void;
  error?: string;
}

const inputClass =
  'w-full bg-white text-slate-900 border border-slate-300 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 shadow-2xs';

/**
 * Number control that edits a local draft and commits once the gesture ends (slider
 * release, blur, Enter), so dragging a slider produces one undo step instead of dozens.
 */
const NumberField: React.FC<{
  field: Extract<EffectFieldDescriptor, { type: 'number' }>;
  value: number;
  onCommit: (value: number) => void;
}> = ({ field, value, onCommit }) => {
  const [draft, setDraft] = React.useState<string>(String(value));
  React.useEffect(() => setDraft(String(value)), [value]);

  const commit = (): void => {
    const parsed = Number(draft);
    if (draft.trim() === '' || !Number.isFinite(parsed)) {
      setDraft(String(value));
      return;
    }
    const clamped = Math.min(field.max, Math.max(field.min, parsed));
    setDraft(String(clamped));
    if (clamped !== value) onCommit(clamped);
  };

  return (
    <div className="flex items-center gap-2">
      <input
        type="range"
        aria-label={field.label}
        min={field.min}
        max={field.max}
        step={field.step ?? 'any'}
        value={Number.isFinite(Number(draft)) ? Number(draft) : value}
        onChange={(e) => setDraft(e.target.value)}
        onPointerUp={commit}
        onKeyUp={commit}
        onBlur={commit}
        className="flex-1 accent-blue-600"
      />
      <input
        type="number"
        aria-label={`${field.label} value`}
        min={field.min}
        max={field.max}
        step={field.step ?? 'any'}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') commit();
        }}
        className={`${inputClass} w-16 font-mono`}
      />
      {field.unit && <span className="text-[10px] text-slate-500 w-5">{field.unit}</span>}
    </div>
  );
};

const CHANNEL_LABELS: Record<EffectKeyframeChannel, string> = {
  x: 'X',
  y: 'Y',
  scale: 'Scale',
  rotate: 'Rot',
  opacity: 'Opac',
};

function readKeyframes(value: unknown): EffectKeyframe[] {
  if (!Array.isArray(value)) return [];
  return value.filter(
    (step): step is EffectKeyframe => typeof step === 'object' && step !== null && typeof step.at === 'number',
  );
}

/** One numeric timeline cell; empty means "rest value", committed on blur/Enter. */
const KeyframeCell: React.FC<{
  label: string;
  value: number | undefined;
  onCommit: (value: number | undefined) => void;
}> = ({ label, value, onCommit }) => {
  const [draft, setDraft] = React.useState(value === undefined ? '' : String(value));
  React.useEffect(() => setDraft(value === undefined ? '' : String(value)), [value]);
  const commit = (): void => {
    if (draft.trim() === '') {
      if (value !== undefined) onCommit(undefined);
      return;
    }
    const parsed = Number(draft);
    if (!Number.isFinite(parsed)) {
      setDraft(value === undefined ? '' : String(value));
      return;
    }
    if (parsed !== value) onCommit(parsed);
  };
  return (
    <input
      // Text, not number: spinner arrows would eat the few pixels a timeline cell has.
      type="text"
      inputMode="decimal"
      aria-label={label}
      title={label}
      value={draft}
      placeholder="–"
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === 'Enter') commit();
      }}
      className={`${inputClass} px-1 font-mono text-[11px] min-w-0 text-center`}
    />
  );
};

/**
 * Timeline editor for `keyframes` fields: one card per step with its position (`at`, as a
 * percentage), optional easing, and one input per motion channel (blank = rest value), so it
 * stays readable in a narrow inspector. Steps are kept sorted by `at`, so the stored config
 * always reads in timeline order.
 */
const KeyframesField: React.FC<{
  field: Extract<EffectFieldDescriptor, { type: 'keyframes' }>;
  value: unknown;
  onCommit: (value: EffectKeyframe[]) => void;
}> = ({ field, value, onCommit }) => {
  const { t } = useTranslation();
  const steps = readKeyframes(value);
  const minSteps = field.minSteps ?? 2;
  const maxSteps = field.maxSteps ?? 12;

  const commitSteps = (next: EffectKeyframe[]): void => onCommit([...next].sort((a, b) => a.at - b.at));
  const patch = (index: number, change: Partial<EffectKeyframe>): void =>
    commitSteps(
      steps.map((step, i) => {
        if (i !== index) return step;
        const merged: EffectKeyframe = { ...step, ...change };
        for (const [key, v] of Object.entries(change)) if (v === undefined) delete merged[key as keyof EffectKeyframe];
        return merged;
      }),
    );

  const addStep = (): void => {
    const last = steps[steps.length - 1];
    const previous = steps[steps.length - 2];
    // Split the last segment in half, carrying the last step's pose so nothing jumps.
    const at = last ? (previous ? (previous.at + last.at) / 2 : last.at < 1 ? 1 : 0.5) : 0;
    commitSteps([...steps, { ...(last ?? {}), at: Math.round(at * 1000) / 1000 }]);
  };

  return (
    <div className="flex flex-col gap-1" data-testid={`keyframes-${field.key}`}>
      <span className="font-medium text-slate-600" title={field.description}>
        {field.label}
      </span>
      {steps.map((step, index) => (
        <div
          key={index}
          data-testid={`keyframe-step-${index}`}
          className="flex flex-col gap-1 p-1.5 rounded border border-slate-200 bg-slate-50/60"
        >
          <div className="flex items-center gap-1.5 text-[10px] text-slate-500">
            <span className="font-semibold text-slate-600 w-4 shrink-0">{index + 1}</span>
            <span className="shrink-0">{t.effectsKeyframeAt}</span>
            <div className="w-14 shrink-0">
              <KeyframeCell
                label={`${t.effectsKeyframeAt} ${index + 1}`}
                value={Math.round(step.at * 1000) / 10}
                onCommit={(percent) => patch(index, { at: Math.min(100, Math.max(0, percent ?? 0)) / 100 })}
              />
            </div>
            {field.easings && (
              <select
                aria-label={`${t.effectsKeyframeEase} ${index + 1}`}
                title={t.effectsKeyframeEase}
                value={step.ease ?? ''}
                disabled={index === 0}
                onChange={(e) => patch(index, { ease: e.target.value || undefined })}
                className={`${inputClass} px-1 text-[10px] min-w-0 flex-1 disabled:opacity-40`}
              >
                <option value="">{index === 0 ? '–' : 'Linear'}</option>
                {field.easings.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            )}
            <button
              type="button"
              title={t.effectsKeyframeRemove}
              aria-label={`${t.effectsKeyframeRemove} ${index + 1}`}
              disabled={steps.length <= minSteps}
              onClick={() => commitSteps(steps.filter((_, i) => i !== index))}
              className="ml-auto shrink-0 text-slate-400 hover:text-red-600 disabled:opacity-30 disabled:hover:text-slate-400 cursor-pointer"
            >
              <Trash2 className="w-3 h-3" />
            </button>
          </div>
          <div
            className="grid gap-1 text-[10px] text-slate-500"
            style={{ gridTemplateColumns: `repeat(${field.channels.length}, minmax(0, 1fr))` }}
          >
            {field.channels.map((channel) => (
              <label key={channel} className="flex flex-col gap-0.5 min-w-0">
                <span className="truncate">{CHANNEL_LABELS[channel]}</span>
                <KeyframeCell
                  label={`${CHANNEL_LABELS[channel]} ${index + 1}`}
                  value={step[channel]}
                  onCommit={(v) => patch(index, { [channel]: v })}
                />
              </label>
            ))}
          </div>
        </div>
      ))}
      <button
        type="button"
        data-testid={`keyframes-${field.key}-add`}
        disabled={steps.length >= maxSteps}
        onClick={addStep}
        className="self-start text-[11px] font-medium text-blue-600 hover:text-blue-500 disabled:opacity-40 cursor-pointer"
      >
        + {t.effectsKeyframeAdd}
      </button>
      {field.description && <span className="text-[10px] text-slate-400 leading-snug">{field.description}</span>}
    </div>
  );
};

const EffectField: React.FC<{
  field: EffectFieldDescriptor;
  value: unknown;
  onCommit: (value: unknown) => void;
}> = ({ field, value, onCommit }) => {
  if (field.type === 'keyframes') {
    return <KeyframesField field={field} value={value} onCommit={onCommit} />;
  }
  if (field.type === 'boolean') {
    return (
      <label className="flex items-center gap-2 text-slate-600" title={field.description}>
        <input
          type="checkbox"
          checked={value === true}
          onChange={(e) => onCommit(e.target.checked)}
          className="accent-blue-600"
        />
        <span>{field.label}</span>
      </label>
    );
  }
  return (
    <div className="flex flex-col gap-1">
      <span className="font-medium text-slate-600" title={field.description}>
        {field.label}
      </span>
      {field.type === 'number' ? (
        <NumberField field={field} value={typeof value === 'number' ? value : field.min} onCommit={onCommit} />
      ) : (
        <select
          aria-label={field.label}
          value={typeof value === 'string' ? value : ''}
          onChange={(e) => onCommit(e.target.value)}
          className={inputClass}
        >
          {field.options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      )}
      {field.description && field.type === 'number' && (
        <span className="text-[10px] text-slate-400 leading-snug">{field.description}</span>
      )}
    </div>
  );
};

/**
 * Inspector section for node effects (STORA-651). Controls are generated from each plugin's
 * `fields`, so a new plugin needs no editor code. Only changed keys are written to the
 * stored config; defaults stay with the plugin.
 */
export const EffectsPanel: React.FC<EffectsPanelProps> = ({ node, registry, onChange, error }) => {
  const { t } = useTranslation();
  const effects = node.effects ?? [];
  const plugins = registry.list();
  const [pluginToAdd, setPluginToAdd] = React.useState('');

  const replace = (next: NodeEffect[]): void => onChange(next.length > 0 ? next : null);
  const update = (index: number, patch: Partial<NodeEffect>): void =>
    replace(effects.map((effect, i) => (i === index ? { ...effect, ...patch } : effect)));

  const add = (): void => {
    if (!pluginToAdd || effects.length >= MAX_NODE_EFFECTS) return;
    replace([...effects, { plugin: pluginToAdd, enabled: true, config: {} }]);
    setPluginToAdd('');
  };

  return (
    <div className="flex flex-col gap-3 text-xs text-slate-700" data-testid="effects-panel">
      <p className="text-[11px] text-slate-500 leading-snug">{t.effectsPlayInPreview}</p>

      {effects.map((effect, index) => {
        const resolved = resolveEffect(effect, registry);
        const plugin = registry.get(effect.plugin);
        const values =
          resolved.status === 'ok' ? resolved.config : { ...(plugin?.defaults ?? {}), ...(effect.config ?? {}) };
        return (
          <div
            key={`${effect.plugin}-${index}`}
            data-testid={`effect-card-${effect.plugin}`}
            className={`flex flex-col gap-2.5 p-2.5 border rounded-lg ${
              effect.enabled === false ? 'border-slate-200 bg-slate-50 opacity-70' : 'border-slate-200 bg-white'
            }`}
          >
            <div className="flex items-center justify-between gap-2">
              <div className="flex flex-col min-w-0">
                <span className="font-semibold text-slate-800 truncate">{plugin?.label ?? effect.plugin}</span>
                {plugin?.description && (
                  <span className="text-[10px] text-slate-500 leading-snug">{plugin.description}</span>
                )}
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <label className="flex items-center gap-1 text-[11px] text-slate-600">
                  <input
                    type="checkbox"
                    data-testid={`effect-enabled-${effect.plugin}`}
                    checked={effect.enabled !== false}
                    onChange={(e) => update(index, { enabled: e.target.checked })}
                    className="accent-blue-600"
                  />
                  {t.effectsEnabled}
                </label>
                <button
                  type="button"
                  title={t.effectsRemove}
                  aria-label={t.effectsRemove}
                  data-testid={`effect-remove-${effect.plugin}`}
                  onClick={() => replace(effects.filter((_, i) => i !== index))}
                  className="p-1 rounded text-slate-400 hover:text-red-600 hover:bg-red-50 transition cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {!plugin && <p className="text-[11px] text-amber-700 leading-snug">{t.effectsUnknownPlugin}</p>}
            {resolved.status === 'invalid-config' && (
              <p className="text-[11px] text-red-600 leading-snug">{resolved.error}</p>
            )}

            {plugin?.fields.map((field) => (
              <EffectField
                key={field.key}
                field={field}
                value={values[field.key]}
                onCommit={(value) => update(index, { config: { ...(effect.config ?? {}), [field.key]: value } })}
              />
            ))}
          </div>
        );
      })}

      {plugins.length === 0 ? (
        <p className="text-[11px] text-slate-500">{t.effectsNoPlugins}</p>
      ) : effects.length >= MAX_NODE_EFFECTS ? (
        <p className="text-[11px] text-slate-500">{t.effectsLimitReached}</p>
      ) : (
        <div className="flex items-center gap-2">
          <select
            aria-label={t.effectsAddPlaceholder}
            data-testid="effects-add-select"
            value={pluginToAdd}
            onChange={(e) => setPluginToAdd(e.target.value)}
            className={inputClass}
          >
            <option value="">{t.effectsAddPlaceholder}</option>
            {plugins.map((plugin) => (
              <option key={plugin.id} value={plugin.id}>
                {plugin.label}
              </option>
            ))}
          </select>
          <button
            type="button"
            data-testid="effects-add-button"
            disabled={!pluginToAdd}
            onClick={add}
            className="shrink-0 px-2.5 py-1 rounded bg-blue-600 hover:bg-blue-500 text-white font-medium disabled:opacity-40 transition cursor-pointer"
          >
            {t.effectsAdd}
          </button>
        </div>
      )}

      {error && <p className="text-[11px] text-red-600">{error}</p>}
    </div>
  );
};

/** `EffectsPanel` in a collapsible card matching the style-manager sectors. */
export const EffectsSector: React.FC<EffectsPanelProps> = (props) => {
  const { t } = useTranslation();
  const count = props.node.effects?.length ?? 0;
  const [isOpen, setIsOpen] = React.useState(count > 0);

  return (
    <div
      data-testid="sector-effects"
      className="mt-1.5 rounded-lg border border-slate-200 bg-white overflow-hidden shadow-2xs"
    >
      <button
        type="button"
        onClick={() => setIsOpen((open) => !open)}
        aria-expanded={isOpen}
        aria-controls="sector-content-effects"
        data-testid="sector-header-effects"
        title={t.effectsSectorDesc}
        className="w-full flex items-center justify-between px-3 py-2 text-left bg-slate-50/70 hover:bg-slate-100/70 transition cursor-pointer select-none"
      >
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-slate-500 shrink-0">
            <ComponentIcon iconOrType="motion" size={14} />
          </span>
          <span className="text-xs font-semibold text-slate-700 truncate">{t.effectsSector}</span>
          {count > 0 && (
            <span className="px-1.5 py-0.2 text-[9px] font-bold bg-blue-100 text-blue-700 rounded-full border border-blue-200 leading-none">
              {count}
            </span>
          )}
        </div>
        <span
          className={`text-slate-400 transform transition-transform duration-200 ${isOpen ? 'rotate-180' : 'rotate-0'}`}
        >
          <ComponentIcon iconOrType="chevron-down" size={13} />
        </span>
      </button>
      {isOpen && (
        <div id="sector-content-effects" className="p-3 border-t border-slate-100">
          <EffectsPanel {...props} />
        </div>
      )}
    </div>
  );
};
