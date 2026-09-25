import { Artboard, ArtboardType, PageDocument, Theme } from '@kubuild/schema';
import type { DocumentValidationError, DocumentValidationWarning } from '../validation/validator';

export interface AssetInfo {
  id: string;
  url: string;
  mimeType: string;
  size?: number;
  alt?: string;
}

export interface AssetProvider {
  resolve(assetIdOrUri: string): Promise<string> | string;
  upload?(file: File | Blob, metadata?: Record<string, unknown>): Promise<AssetInfo>;
  delete?(assetId: string): Promise<boolean>;
  list?(): Promise<AssetInfo[]>;
}

export interface ActionExecutionContext {
  nodeId?: string;
  document: PageDocument;
  variables?: Record<string, unknown>;
  [key: string]: unknown;
}

export type ActionHandler = (
  payload: Record<string, unknown> | undefined,
  context: ActionExecutionContext,
) => Promise<void> | void;

export interface ActionRegistry {
  get(actionType: string): ActionHandler | undefined;
  register(actionType: string, handler: ActionHandler): void;
  unregister(actionType: string): void;
}

export interface ActionDiagnostic {
  code: 'UNKNOWN_ACTION' | 'ACTION_EXECUTION_ERROR' | 'INVALID_ACTION_PAYLOAD' | 'INVALID_ACTION_BINDING';
  actionType: string;
  nodeId?: string;
  message: string;
  error?: unknown;
  invalidPaths?: string[];
}

export interface PropBindingDiagnostic {
  code: 'INCOMPATIBLE_BINDING_TYPE';
  nodeId?: string;
  propName: string;
  expectedType: string;
  actualType: string;
  message: string;
}

export interface CollectionDiagnostic {
  code: 'INVALID_COLLECTION_SOURCE';
  nodeId?: string;
  propName: string;
  message: string;
}

/**
 * Non-fatal diagnostic for AI-generated content that was rejected or that errored out
 * before ever reaching the document (STORA-507/509). Reuses the same `onDiagnostic`
 * reporting channel as render-time diagnostics — no separate AI-only reporting path.
 */
export interface AiGenerationDiagnostic {
  code: 'AI_SECTION_REJECTED' | 'AI_STREAM_ERROR';
  /** The id of the rejected node, when one could be determined. */
  nodeId?: string;
  message: string;
  error?: unknown;
}

/**
 * Non-fatal tracking delivery diagnostic (e.g. server delivery skipped because the host did
 * not configure a relay). The client-side pixel still fires in these cases.
 */
export interface TrackingDiagnostic {
  code: 'TRACKING_RELAY_NOT_CONFIGURED' | 'TRACKING_RELAY_FAILED';
  nodeId?: string;
  eventName?: string;
  message: string;
  error?: unknown;
}

/**
 * Non-fatal diagnostic for a node that still uses a deprecated prop alias (STORA-550), e.g. a
 * `paragraph` with `content` instead of the canonical `text`. The renderer keeps reading the
 * alias for one minor version; migrating the document (`migrateDocument`) removes it.
 */
export interface DeprecatedPropDiagnostic {
  code: 'DEPRECATED_PROP';
  nodeId?: string;
  componentType: string;
  /** The deprecated alias found on the node. */
  propName: string;
  /** The canonical prop name to use instead. */
  canonicalName: string;
  message: string;
}

/**
 * Diagnostic for a whole document the editor refused to load (STORA-538): `replaceDocument`
 * (host `EditorHandle` or store) or `applyTemplate` ran `validateDocument` and the result was
 * invalid. The current document is left untouched; the same errors are also returned in the
 * call's result.
 */
export interface DocumentValidationDiagnostic {
  code: 'DOCUMENT_INVALID';
  /** Which entry point rejected the document. */
  source: 'replaceDocument' | 'applyTemplate';
  /** Id of the template being applied, when `source` is `'applyTemplate'`. */
  templateId?: string;
  /** Node of the first blocking error, when it points at one. */
  nodeId?: string;
  message: string;
  /** Blocking validation errors from `validateDocument`. */
  errors: DocumentValidationError[];
  warnings: DocumentValidationWarning[];
}

export type Diagnostic =
  | ActionDiagnostic
  | PropBindingDiagnostic
  | CollectionDiagnostic
  | AiGenerationDiagnostic
  | TrackingDiagnostic
  | DeprecatedPropDiagnostic
  | DocumentValidationDiagnostic;

/**
 * Host-supplied runtime tracking options (NOT part of the document). Server-side delivery
 * (Meta CAPI, TikTok Events API, GA4 MP, custom webhook) only happens through `relayUrl`;
 * the browser never talks to provider APIs with secrets.
 */
export interface RuntimeTrackingOptions {
  /**
   * Host relay endpoint implementing the tracking relay protocol v1
   * (`TrackingRelayRequestSchema`). Same-origin is recommended. When absent, server delivery
   * is skipped with a `TRACKING_RELAY_NOT_CONFIGURED` diagnostic.
   */
  relayUrl?: string;
  /** Host document/page id sent to the relay so it can load the trusted tracking config. */
  documentId?: string;
  /** Extra non-secret request headers (e.g. a CSRF token). */
  relayHeaders?: Readonly<Record<string, string>>;
  /** `fetch` credentials mode for relay calls (default 'same-origin'). */
  credentials?: 'omit' | 'same-origin' | 'include';
  /** Custom fetch implementation (tests, SSR). */
  fetchFn?: typeof fetch;
  /** Receives tracking log lines (skips, relay failures, ...). */
  onLog?: (message: string, data?: unknown) => void;
}

export type RenderContext = Readonly<{
  variables?: Readonly<Record<string, unknown>>;
  assetProvider?: AssetProvider;
  actionRegistry?: ActionRegistry;
  onDiagnostic?: (diagnostic: Diagnostic) => void;
  /**
   * Resolves the component artboard an `open_modal`/`close_modal` action targets, so a
   * trigger living in one artboard can open content stored in another. Supplied by the
   * host that owns the multi-artboard project; absent for single-document rendering.
   */
  resolveArtboard?: (triggerId: string) => Artboard | undefined;
  /** Every component artboard available for portal rendering at runtime. */
  componentArtboards?: readonly Artboard[];
  /**
   * What kind of surface this render represents. On a 'component' surface the node is being
   * authored in isolation on its own artboard, so overlay chrome that only makes sense over
   * a real page (a modal's full-bleed backdrop, a drawer pinned to the viewport edge) is
   * suppressed and the node sits directly on the canvas instead.
   */
  artboardSurface?: ArtboardType;
  /** Host tracking runtime options (relay endpoint etc.). Never stored in the document. */
  tracking?: RuntimeTrackingOptions;
  /**
   * Host theme override (STORA-551), merged token-by-token over `PageDocument.theme` at
   * render time — e.g. a per-tenant brand color — without modifying the document. Unsafe
   * keys/values are dropped by the renderer.
   */
  theme?: Readonly<Partial<Theme>>;
}>;

export type RuntimeContext = RenderContext;

export type VariableValueType = 'string' | 'number' | 'boolean' | 'array' | 'object';

/**
 * Host-declared catalog entry describing a bindable variable and an editor/preview-only
 * sample value. `sampleValue` must never be written into a `PageDocument` — it exists so
 * the builder can preview bindings without persisting host data into the portable document.
 */
export interface VariableDefinition {
  key: string;
  label: string;
  type: VariableValueType;
  sampleValue: unknown;
  description?: string;
}

export type VariableCatalog = VariableDefinition[];
