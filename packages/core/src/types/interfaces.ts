import { PageDocument } from '@kubuild/schema';

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

export type Diagnostic =
  | ActionDiagnostic
  | PropBindingDiagnostic
  | CollectionDiagnostic
  | AiGenerationDiagnostic;

export type RenderContext = Readonly<{
  variables?: Readonly<Record<string, unknown>>;
  assetProvider?: AssetProvider;
  actionRegistry?: ActionRegistry;
  onDiagnostic?: (diagnostic: Diagnostic) => void;
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
