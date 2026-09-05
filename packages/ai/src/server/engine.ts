import { PageDocument, Node, DocumentMetadataSchema } from '@kubuild/schema';
import type {
  KubuildAiEngineOptions,
  AiGeneratePageRequest,
  AiGenerateSectionRequest,
  AiRefactorNodeRequest,
  AiGenerateResponse,
  AiCompiledComponentSpec,
} from '../types';
import {
  compileComponentCatalog,
  buildSystemPrompt,
  buildJsonSchemaForMode,
} from '../core/prompt-compiler';
import {
  extractJsonFromResponse,
  normalizeAndValidatePageDocument,
  normalizeAndValidateSectionNode,
  normalizeAndValidateRefactoredNode,
} from '../core/normalizer';

export class KubuildAiEngine {
  private options: KubuildAiEngineOptions;
  private catalog: AiCompiledComponentSpec[];

  constructor(options: KubuildAiEngineOptions) {
    if (!options.adapter) {
      throw new Error('KubuildAiEngine requires an adapter instance');
    }
    this.options = options;
    this.catalog = compileComponentCatalog(options.registry);
  }

  get adapterName(): string {
    return this.options.adapter.name;
  }

  refreshCatalog(): void {
    this.catalog = compileComponentCatalog(this.options.registry);
  }

  async generatePage(
    request: AiGeneratePageRequest,
    context?: { signal?: AbortSignal },
  ): Promise<AiGenerateResponse<PageDocument>> {
    let rawText = '';
    try {
      const systemPrompt = buildSystemPrompt({
        catalog: this.catalog,
        mode: 'full-page',
        prefix: this.options.systemPromptPrefix,
        stylePreference: request.stylePreference,
      });

      let userPrompt = `User Request: ${request.prompt}`;
      if (request.tone) userPrompt += `\nTone: ${request.tone}`;
      if (request.locale) userPrompt += `\nLanguage/Locale: ${request.locale}`;

      const jsonSchema = buildJsonSchemaForMode('full-page');

      const result = await this.options.adapter.generate({
        systemPrompt,
        userPrompt,
        jsonSchema,
        signal: context?.signal,
      });

      rawText = result.text;
      const rawJson = extractJsonFromResponse(rawText);
      const document = normalizeAndValidatePageDocument(
        rawJson,
        this.options.securityLimits,
      );

      // Merge user requested metadata if given
      if (request.metadata) {
        document.metadata = DocumentMetadataSchema.parse({
          ...document.metadata,
          ...request.metadata,
        });
      }

      return {
        success: true,
        data: document,
        usage: result.usage,
        rawModelResponse: rawText,
      };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      return {
        success: false,
        error: {
          code: 'GENERATION_ERROR',
          message,
        },
        rawModelResponse: rawText || undefined,
      };
    }
  }

  async generateSection(
    request: AiGenerateSectionRequest,
    context?: { signal?: AbortSignal },
  ): Promise<AiGenerateResponse<Node>> {
    let rawText = '';
    try {
      const systemPrompt = buildSystemPrompt({
        catalog: this.catalog,
        mode: 'section',
        prefix: this.options.systemPromptPrefix,
        stylePreference: request.stylePreference,
      });

      let userPrompt = `Generate a single section node for: ${request.prompt}`;
      if (request.targetSectionType) {
        userPrompt += `\nTarget Section Purpose: ${request.targetSectionType}`;
      }
      if (request.parentContext) {
        userPrompt += `\nSurrounding Page Context: ${request.parentContext}`;
      }

      const jsonSchema = buildJsonSchemaForMode('section');

      const result = await this.options.adapter.generate({
        systemPrompt,
        userPrompt,
        jsonSchema,
        signal: context?.signal,
      });

      rawText = result.text;
      const rawJson = extractJsonFromResponse(rawText);
      const sectionNode = normalizeAndValidateSectionNode(
        rawJson,
        this.options.securityLimits,
      );

      return {
        success: true,
        data: sectionNode,
        usage: result.usage,
        rawModelResponse: rawText,
      };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      return {
        success: false,
        error: {
          code: 'SECTION_GENERATION_ERROR',
          message,
        },
        rawModelResponse: rawText || undefined,
      };
    }
  }

  async refactorNode(
    request: AiRefactorNodeRequest,
    context?: { signal?: AbortSignal },
  ): Promise<AiGenerateResponse<Node>> {
    let rawText = '';
    try {
      const systemPrompt = buildSystemPrompt({
        catalog: this.catalog,
        mode: 'refactor',
        prefix: this.options.systemPromptPrefix,
        stylePreference: request.stylePreference,
      });

      const userPrompt = `Instruction: ${request.instruction}\n\nCurrent Node:\n${JSON.stringify(request.node, null, 2)}`;
      const jsonSchema = buildJsonSchemaForMode('refactor');

      const result = await this.options.adapter.generate({
        systemPrompt,
        userPrompt,
        jsonSchema,
        signal: context?.signal,
      });

      rawText = result.text;
      const rawJson = extractJsonFromResponse(rawText);
      const updatedNode = normalizeAndValidateRefactoredNode(
        rawJson,
        request.node,
        this.options.securityLimits,
      );

      return {
        success: true,
        data: updatedNode,
        usage: result.usage,
        rawModelResponse: rawText,
      };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      return {
        success: false,
        error: {
          code: 'REFACTOR_ERROR',
          message,
        },
        rawModelResponse: rawText || undefined,
      };
    }
  }
}
