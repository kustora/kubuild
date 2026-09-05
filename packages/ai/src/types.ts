import type { Node, PageDocument, DocumentMetadata } from '@kubuild/schema';
import type { DocumentSecurityLimits } from '@kubuild/core';

export type AiGenerationMode = 'full-page' | 'section' | 'refactor';

export interface AiGeneratePageRequest {
  prompt: string;
  stylePreference?: string;
  tone?: string;
  locale?: string;
  metadata?: Partial<DocumentMetadata>;
  stream?: boolean;
}

export interface AiGenerateSectionRequest {
  prompt: string;
  stylePreference?: string;
  targetSectionType?: string;
  parentContext?: string;
}

export interface AiRefactorNodeRequest {
  node: Node;
  instruction: string;
  stylePreference?: string;
}

export type AiStreamEvent =
  | { type: 'status'; message: string }
  | { type: 'metadata'; metadata: DocumentMetadata; rootPageNode: Node }
  | { type: 'section'; index: number; total: number; section: Node }
  | { type: 'complete'; document: PageDocument }
  | { type: 'error'; error: { code: string; message: string } };

export interface AiStreamCallbacks {
  onStatus?: (message: string) => void;
  onMetadata?: (metadata: DocumentMetadata, rootPage: Node) => void;
  onSection?: (section: Node, index: number, total: number) => void;
  onComplete?: (document: PageDocument) => void;
  onError?: (error: Error) => void;
}

export interface AiErrorDetail {
  code: string;
  message: string;
  details?: unknown;
}

export interface AiGenerateResponse<T = PageDocument | Node> {
  success: boolean;
  data?: T;
  error?: AiErrorDetail;
  rawModelResponse?: string;
  usage?: {
    promptTokens?: number;
    completionTokens?: number;
  };
}

export interface AiCompiledComponentProp {
  name: string;
  type: string;
  defaultValue?: unknown;
  options?: unknown[];
  description?: string;
}

export interface AiCompiledComponentSpec {
  type: string;
  label: string;
  category: string;
  description?: string;
  acceptsChildren: boolean;
  allowedChildren?: string[];
  disallowedParents?: string[];
  defaultProps?: Record<string, unknown>;
  props?: AiCompiledComponentProp[];
}

export interface AiProviderGenerateParams {
  systemPrompt: string;
  userPrompt: string;
  jsonSchema?: Record<string, unknown>;
  signal?: AbortSignal;
}

export interface AiProviderGenerateResult {
  text: string;
  usage?: {
    promptTokens?: number;
    completionTokens?: number;
  };
}

export interface AiProviderAdapter {
  readonly name: string;
  generate(params: AiProviderGenerateParams): Promise<AiProviderGenerateResult>;
}

export interface ComponentDefinitionLike {
  type: string;
  label?: string;
  category?: string;
  description?: string;
  acceptsChildren?: boolean;
  allowedChildren?: string[];
  disallowedParents?: string[];
  defaultProps?: Record<string, unknown>;
  propFields?: Array<{
    name: string;
    label?: string;
    type?: string;
    defaultValue?: unknown;
    options?: Array<{ label: string; value: unknown }>;
    description?: string;
  }>;
}

export interface ComponentRegistryLike {
  list(): ComponentDefinitionLike[];
  get?(type: string): ComponentDefinitionLike | undefined;
  has?(type: string): boolean;
}

export interface KubuildAiEngineOptions {
  registry?: ComponentRegistryLike;
  adapter: AiProviderAdapter;
  securityLimits?: DocumentSecurityLimits;
  systemPromptPrefix?: string;
}
