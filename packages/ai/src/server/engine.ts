import { PageDocument, Node, DocumentMetadataSchema, DocumentMetadata } from '@kubuild/schema';
import type {
  KubuildAiEngineOptions,
  AiGeneratePageRequest,
  AiGenerateSectionRequest,
  AiRefactorNodeRequest,
  AiGenerateResponse,
  AiCompiledComponentSpec,
  AiStreamEvent,
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

interface PlannedSection {
  type: string;
  title: string;
  prompt: string;
}

interface PagePlan {
  title?: string;
  description?: string;
  pageStyles?: Node['styles'];
  sections?: PlannedSection[];
}

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

  /**
   * Progressive Section Streaming Generator.
   * Emits structured SSE events: status -> metadata -> section (one by one) -> complete.
   */
  async *streamPage(
    request: AiGeneratePageRequest,
    context?: { signal?: AbortSignal },
  ): AsyncIterable<AiStreamEvent> {
    try {
      yield {
        type: 'status',
        message: 'Analyzing requirements and planning page sections...',
      };

      // 1. Plan page sections
      const planSystemPrompt = `
You are a web architect for the KUBUILD page builder.
Given the user's prompt, plan the website structure. Output pure JSON (no markdown fences, no explanatory text):
{
  "title": "<Page Title>",
  "description": "<Page Description>",
  "pageStyles": {
    "base": {
      "backgroundColor": "#ffffff",
      "fontFamily": "Inter, system-ui, sans-serif",
      "color": "#111827",
      "minHeight": "100vh"
    }
  },
  "sections": [
    {
      "type": "<hero|features|pricing|testimonials|cta|contact|footer>",
      "title": "<Brief title>",
      "prompt": "<Detailed prompt for generating this specific section with components, layout, and content>"
    }
  ]
}
Plan 3 to 5 essential, cohesive sections that fulfill the request.
`;

      let planUserPrompt = `User Request: ${request.prompt}`;
      if (request.stylePreference) {
        planUserPrompt += `\nStyle Preference: ${request.stylePreference}`;
      }
      if (request.tone) planUserPrompt += `\nTone: ${request.tone}`;
      if (request.locale) planUserPrompt += `\nLocale: ${request.locale}`;

      const planResult = await this.options.adapter.generate({
        systemPrompt: planSystemPrompt,
        userPrompt: planUserPrompt,
        signal: context?.signal,
      });

      let plan: PagePlan;
      try {
        plan = extractJsonFromResponse(planResult.text) as PagePlan;
      } catch {
        // Fallback default plan if JSON parse failed
        plan = {
          title: 'AI Generated Page',
          description: 'Generated by KUBUILD AI',
          sections: [
            { type: 'hero', title: 'Hero Banner', prompt: `Hero section for: ${request.prompt}` },
            { type: 'features', title: 'Key Features', prompt: `Features grid for: ${request.prompt}` },
            { type: 'cta', title: 'Call To Action', prompt: `Call to action section for: ${request.prompt}` },
          ],
        };
      }

      const sectionsToGenerate = Array.isArray(plan.sections) && plan.sections.length > 0
        ? plan.sections
        : [
            { type: 'hero', title: 'Hero Section', prompt: `Hero banner for: ${request.prompt}` },
            { type: 'features', title: 'Features', prompt: `Features grid for: ${request.prompt}` },
            { type: 'cta', title: 'Call To Action', prompt: `CTA section for: ${request.prompt}` },
          ];

      const metadata: DocumentMetadata = DocumentMetadataSchema.parse({
        title: plan.title || 'AI Generated Page',
        description: plan.description || 'Generated by KUBUILD AI',
        author: 'KUBUILD AI',
        tags: ['ai-generated', 'progressive-stream'],
        category: 'landing',
        version: '1.0.0',
        ...(request.metadata || {}),
      });

      const rootPageNode: Node = {
        id: 'root-page',
        type: 'page',
        styles: plan.pageStyles || {
          base: {
            backgroundColor: '#ffffff',
            fontFamily: 'Inter, system-ui, sans-serif',
            color: '#111827',
            minHeight: '100vh',
          },
        },
        children: [],
      };

      // 2. Emit initial metadata so canvas can render initial empty page immediately!
      yield {
        type: 'metadata',
        metadata,
        rootPageNode,
      };

      yield {
        type: 'status',
        message: `Plan ready with ${sectionsToGenerate.length} sections: ${sectionsToGenerate.map((s) => s.title).join(', ')}`,
      };

      // 3. Sequentially generate each section and stream it!
      const completedSections: Node[] = [];
      const total = sectionsToGenerate.length;

      for (let i = 0; i < total; i++) {
        if (context?.signal?.aborted) {
          throw new Error('Streaming aborted by client');
        }

        const plannedSec = sectionsToGenerate[i];
        yield {
          type: 'status',
          message: `Generating section ${i + 1}/${total} (${plannedSec.title})...`,
        };

        const secRes = await this.generateSection(
          {
            prompt: plannedSec.prompt,
            stylePreference: request.stylePreference,
            targetSectionType: plannedSec.type,
            parentContext: `Website: ${plan.title}. Previous sections: ${sectionsToGenerate.slice(0, i).map((s) => s.title).join(', ')}`,
          },
          { signal: context?.signal },
        );

        if (secRes.success && secRes.data) {
          completedSections.push(secRes.data);
          yield {
            type: 'section',
            index: i,
            total,
            section: secRes.data,
          };
        }
      }

      // 4. Assemble final document and emit complete event
      const finalDocument: PageDocument = {
        schema: 'stora.page',
        version: '1.0.0',
        metadata,
        document: {
          ...rootPageNode,
          children: completedSections,
        } as PageDocument['document'],
      };

      yield {
        type: 'complete',
        document: finalDocument,
      };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      yield {
        type: 'error',
        error: {
          code: 'STREAM_ERROR',
          message,
        },
      };
    }
  }
}
