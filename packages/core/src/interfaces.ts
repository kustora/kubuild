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

export interface RuntimeContext {
  variables?: Record<string, unknown>;
  assetProvider?: AssetProvider;
  actionRegistry?: ActionRegistry;
}
