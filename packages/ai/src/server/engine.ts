import { PageDocument, Node, DocumentMetadataSchema, DocumentMetadata } from '@kubuild/schema';
import type {
  KubuildAiEngineOptions,
  AiGeneratePageRequest,
  AiGenerateSectionRequest,
  AiRefactorNodeRequest,
  AiChatRequest,
  AiChatResponse,
  AiChatMessage,
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

  private log(level: 'info' | 'warn' | 'error' | 'debug', message: string, meta?: unknown): void {
    if (this.options.logger) {
      this.options.logger(level, message, meta);
    } else if (this.options.debug) {
      const ts = new Date().toISOString();
      console.log(`[KUBUILD-AI ${level.toUpperCase()}] [${ts}] ${message}`, meta !== undefined ? meta : '');
    }
  }

  async generatePage(
    request: AiGeneratePageRequest,
    context?: { signal?: AbortSignal },
  ): Promise<AiGenerateResponse<PageDocument>> {
    let rawText = '';
    try {
      this.log('info', `Generating full page for prompt: "${request.prompt}"`);
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


      console.log("Raw model response:", result.text);
      

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

      this.log(
        'info',
        `Full page successfully generated: "${document.metadata?.title || 'Untitled'}" (${document.document.children?.length || 0} sections)`,
      );

      return {
        success: true,
        data: document,
        usage: result.usage,
        rawModelResponse: rawText,
      };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      this.log('error', `Generation failed: ${message}`);
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

      console.log(`[generateSection] Raw result text:\n${result.text}\n`);

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
      this.log('info', `[SSE] Starting streamPage for prompt: "${request.prompt}"`);
      console.log(`\n🌊 [SSE streamPage] Initiating stream for prompt: "${request.prompt}"`);

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
Plan 3 cohesive, essential sections (e.g., hero, features, and cta) that fulfill the request.
`;

      let planUserPrompt = `User Request: ${request.prompt}`;
      if (request.stylePreference) {
        planUserPrompt += `\nStyle Preference: ${request.stylePreference}`;
      }
      if (request.tone) planUserPrompt += `\nTone: ${request.tone}`;
      if (request.locale) planUserPrompt += `\nLocale: ${request.locale}`;

      console.log(`📋 [SSE streamPage] Generating website layout plan...`);
      const planResult = await this.options.adapter.generate({
        systemPrompt: planSystemPrompt,
        userPrompt: planUserPrompt,
        signal: context?.signal,
      });

      console.log(`📝 [SSE streamPage] Raw plan response from model:\n${planResult.text}\n`);

      let plan: PagePlan;
      try {
        plan = extractJsonFromResponse(planResult.text) as PagePlan;
        console.log(`✅ [SSE streamPage] Parsed plan successfully:`, JSON.stringify(plan, null, 2));
      } catch (parseErr) {
        console.warn(`⚠️ [SSE streamPage] Failed to parse plan JSON, using fallback plan. Reason:`, parseErr);
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
      console.log(`📄 [SSE streamPage] Emitting metadata: "${metadata.title}"`);
      yield {
        type: 'metadata',
        metadata,
        rootPageNode,
      };

      console.log(`ℹ️ [SSE streamPage] Plan ready with ${sectionsToGenerate.length} sections: ${sectionsToGenerate.map((s) => s.title).join(', ')}`);
      yield {
        type: 'status',
        message: `Plan ready with ${sectionsToGenerate.length} sections: ${sectionsToGenerate.map((s) => s.title).join(', ')}`,
      };

      // 3. Sequentially generate each section and stream it!
      const completedSections: Node[] = [];
      const total = sectionsToGenerate.length;

      for (let i = 0; i < total; i++) {
        if (context?.signal?.aborted) {
          console.warn('🔌 [SSE streamPage] Streaming aborted by client signal');
          throw new Error('Streaming aborted by client');
        }

        const plannedSec = sectionsToGenerate[i];
        console.log(`\n⏳ [SSE streamPage] Generating section ${i + 1}/${total} [${plannedSec.type}]: "${plannedSec.title}"`);
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
          console.log(`✨ [SSE streamPage] Section ${i + 1}/${total} generated successfully: [${secRes.data.id || secRes.data.type}]`);
          completedSections.push(secRes.data);
          yield {
            type: 'section',
            index: i,
            total,
            section: secRes.data,
          };
        } else {
          console.error(`❌ [SSE streamPage] Section ${i + 1}/${total} failed:`, secRes.error?.message);
        }
      }

      if (completedSections.length === 0) {
        console.error(`❌ [SSE streamPage] All sections failed to generate.`);
        yield {
          type: 'error',
          error: {
            code: 'STREAM_GENERATION_FAILED',
            message: 'All sections failed to generate. Please check server logs or retry.',
          },
        };
        return;
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

      console.log(`🎉 [SSE streamPage] All ${completedSections.length} sections generated. Emitting complete event.\n`);
      yield {
        type: 'complete',
        document: finalDocument,
      };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`❌ [SSE streamPage] Error during stream:`, message);
      this.log('error', `Streaming failed: ${message}`);
      yield {
        type: 'error',
        error: {
          code: 'STREAM_ERROR',
          message,
        },
      };
    }
  }

  /**
   * Conversational Assistant / Q&A.
   * Can discuss web design, explain KUBUILD components, review current page,
   * suggest improvements, or recommend copywriting.
   */
  async chat(
    request: AiChatRequest,
    context?: { signal?: AbortSignal },
  ): Promise<AiGenerateResponse<AiChatResponse>> {
    let rawText = '';
    try {
      if (!request.messages || !Array.isArray(request.messages) || request.messages.length === 0) {
        return {
          success: false,
          error: {
            code: 'INVALID_CHAT_REQUEST',
            message: '"messages" array is required and must not be empty',
          },
        };
      }

      this.log('info', `Processing chat turn with ${request.messages.length} messages`);

      // Build system prompt with component catalog and document grounding
      let systemPrompt = `You are the KUBUILD AI Assistant — an expert web designer, developer, and page architecture consultant.
Your role is to assist users with creating, designing, refining, and understanding web pages built with the KUBUILD builder.
Answer questions directly, concisely, and helpfully using friendly professional tone and markdown formatting.

### Available KUBUILD Components:
${this.catalog.map((c) => `- **${c.type}** (${c.category}): ${c.label}${c.description ? ` — ${c.description}` : ''}`).join('\n')}
`;

      if (this.options.systemPromptPrefix) {
        systemPrompt = `${this.options.systemPromptPrefix}\n\n${systemPrompt}`;
      }

      if (request.systemPrompt) {
        systemPrompt += `\nAdditional Context:\n${request.systemPrompt}`;
      }

      if (request.currentDocument) {
        const doc = request.currentDocument;
        const sections = doc.document?.children || [];
        const sectionSummary = sections
          .map((s, idx) => `Section ${idx + 1}: id="${s.id}", type="${s.type}", title="${(s.props?.title as string) || 'untitled'}", childrenCount=${s.children?.length || 0}`)
          .join('\n');

        systemPrompt += `\n### Current Page in Builder Canvas:
- Title: ${doc.metadata?.title || 'Untitled Page'}
- Description: ${doc.metadata?.description || 'N/A'}
- Total Sections: ${sections.length}
- Sections Summary:
${sectionSummary || '(Canvas is currently empty)'}
`;
      }

      if (request.selectedNodeId) {
        systemPrompt += `\nCurrently Selected Component Node ID: "${request.selectedNodeId}"`;
      }

      // Extract last user message
      const lastUserMsg = [...request.messages].reverse().find((m) => m.role === 'user');
      const userPrompt = lastUserMsg?.content || 'Hello';

      const result = await this.options.adapter.generate({
        systemPrompt,
        userPrompt,
        messages: request.messages,
        signal: context?.signal,
      });

      rawText = result.text.trim();

      const assistantMessage: AiChatMessage = {
        role: 'assistant',
        content: rawText,
        timestamp: Date.now(),
      };

      return {
        success: true,
        data: {
          message: assistantMessage,
        },
        usage: result.usage,
        rawModelResponse: rawText,
      };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      this.log('error', `Chat failed: ${message}`);
      return {
        success: false,
        error: {
          code: 'CHAT_ERROR',
          message,
        },
        rawModelResponse: rawText || undefined,
      };
    }
  }
}
