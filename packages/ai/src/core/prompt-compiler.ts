import { CURRENT_SCHEMA_VERSION, type PageDocument } from '@kubuild/schema';
import type {
  AiCompiledComponentSpec,
  AiCompiledComponentProp,
  ComponentRegistryLike,
  ComponentDefinitionLike,
  AiGenerationMode,
} from '../types';
import {
  buildSelectionContext,
  formatSelectionContext,
  summarizeDocument,
} from './document-outline';

export function compileComponentCatalog(
  registry?: ComponentRegistryLike,
): AiCompiledComponentSpec[] {
  if (!registry) return [];

  const definitions = registry.list();
  return definitions.map((def: ComponentDefinitionLike) => {
    const props: AiCompiledComponentProp[] = [];

    if (def.propFields && Array.isArray(def.propFields)) {
      for (const field of def.propFields) {
        props.push({
          name: field.name,
          type: field.type || 'string',
          defaultValue: field.defaultValue,
          options: field.options?.map((o) => o.value),
          description: field.description,
        });
      }
    }

    return {
      type: def.type,
      label: def.label || def.type,
      category: def.category || 'custom',
      description: def.description,
      acceptsChildren: def.acceptsChildren ?? false,
      allowedChildren: def.allowedChildren,
      disallowedParents: def.disallowedParents,
      defaultProps: def.defaultProps,
      props: props.length > 0 ? props : undefined,
    };
  });
}

export function buildSystemPrompt(options: {
  catalog: AiCompiledComponentSpec[];
  mode: AiGenerationMode;
  prefix?: string;
  stylePreference?: string;
}): string {
  const { catalog, mode, prefix, stylePreference } = options;

  const catalogSummary = catalog
    .map((c) => {
      let desc = `- **${c.type}** (${c.category}): ${c.label}`;
      if (c.description) desc += ` - ${c.description}`;
      desc += ` | acceptsChildren: ${c.acceptsChildren}`;
      if (c.allowedChildren && c.allowedChildren.length > 0) {
        desc += ` | allowedChildren: [${c.allowedChildren.join(', ')}]`;
      }
      if (c.props && c.props.length > 0) {
        const propList = c.props
          .map((p) => {
            let pStr = `${p.name} (${p.type})`;
            if (p.options) pStr += `[${p.options.map(String).join('|')}]`;
            return pStr;
          })
          .join(', ');
        desc += ` | props: { ${propList} }`;
      }
      return desc;
    })
    .join('\n');

  let modeInstructions = '';
  if (mode === 'full-page') {
    modeInstructions = `
You must generate a complete, valid KUBUILD PageDocument JSON with this exact structure:
{
  "schema": "stora.page",
  "version": "1.0.0",
  "metadata": {
    "title": "<Page Title>",
    "description": "<Page Description>",
    "tags": ["<tag1>", "<tag2>"],
    "category": "<category>"
  },
  "document": {
    "id": "root-page",
    "type": "page",
    "styles": {
      "base": {
        "backgroundColor": "#ffffff",
        "fontFamily": "Inter, system-ui, sans-serif",
        "color": "#111827",
        "minHeight": "100vh"
      }
    },
    "children": [
      // Sections here...
    ]
  }
}
`;
  } else if (mode === 'section') {
    modeInstructions = `
You must generate a single valid KUBUILD section Node JSON with this structure:
{
  "id": "section_<unique_suffix>",
  "type": "section",
  "styles": {
    "base": {
      "paddingTop": "64px",
      "paddingBottom": "64px",
      "paddingLeft": "24px",
      "paddingRight": "24px"
    }
  },
  "children": [
    // Container and child nodes...
  ]
}
`;
  } else if (mode === 'refactor') {
    modeInstructions = `
You must refactor the provided KUBUILD Node based on the user's instructions.
Return ONLY the updated Node JSON while maintaining structural integrity.
`;
  }

  const styleGuide = stylePreference
    ? `\nUser Style Preference: "${stylePreference}". Follow this visual aesthetic closely.`
    : '\nStyle with modern, clean, high-conversion design patterns (accessible contrast, harmonious spacing, beautiful typography, subtle shadows/borders).';

  return `${prefix ? prefix + '\n\n' : ''}You are an expert web designer and KUBUILD architecture generator.
KUBUILD is a component-driven visual website builder. Your job is to output pure, valid JSON (and NOTHING ELSE) matching the KUBUILD schema and the registered component definitions.

### RULES & CONSTRAINTS:
1. Output MUST be valid JSON only. No markdown fences, no explanatory text, no HTML tags outside html-embed.
2. Only use component types listed in the Component Catalog below. Do NOT invent new component types.
3. Obey \`acceptsChildren\` and \`allowedChildren\`:
   - Layout hierarchy: \`page\` -> \`section\` -> \`container\` or \`columns\` -> content components (\`heading\`, \`paragraph\`, \`button\`, \`image\`, \`form\`, etc.).
   - Leaf components (e.g. \`button\`, \`input\`, \`heading\`, \`text\`, \`badge\`) must have \`acceptsChildren: false\` and empty or omitted \`children\`.
4. Every node MUST have a unique string \`id\` (e.g. "hero-section", "hero-title", "cta-btn").
5. Responsive & Interactive State Styling:
   - Use the \`styles\` object with breakpoint keys: \`base\` (all viewports/desktop), and optionally \`tablet\` or \`mobile\`.
   - In \`base\`, \`tablet\`, and \`mobile\`, values MUST be CSS primitives (strings or numbers, e.g. "backgroundColor": "#3b82f6"). NEVER put nested objects or ":hover" inside "base"!
   - For hover, active, or interactive pseudo-classes, use \`styles.states\` with pseudo-class keys (e.g. \`":hover"\`), like:
     "styles": {
       "base": { "backgroundColor": "#3b82f6", "color": "#ffffff" },
       "states": {
         ":hover": { "backgroundColor": "#2563eb" }
       }
     }
6. NEVER include dangerous scripts, \`javascript:\` URIs, or malicious payload attributes.
${styleGuide}

### OUTPUT SPECIFICATION:
${modeInstructions}

### REGISTERED COMPONENT CATALOG:
${catalogSummary || '(Standard core components: page, section, container, columns, heading, paragraph, text, button, input, textarea, select, image, video, icon, badge, code-block)'}
`;
}

export function buildJsonSchemaForMode(mode: AiGenerationMode): Record<string, unknown> {
  const nodeSchema: Record<string, unknown> = {
    type: 'object',
    required: ['id', 'type'],
    properties: {
      id: { type: 'string' },
      type: { type: 'string' },
      props: { type: 'object' },
      styles: {
        type: 'object',
        properties: {
          base: { type: 'object' },
          tablet: { type: 'object' },
          mobile: { type: 'object' },
          states: { type: 'object' },
        },
      },
      children: {
        type: 'array',
        items: { $ref: '#' },
      },
    },
  };

  if (mode === 'full-page') {
    return {
      type: 'object',
      required: ['schema', 'version', 'document'],
      properties: {
        schema: { type: 'string', const: 'stora.page' },
        version: { type: 'string', const: CURRENT_SCHEMA_VERSION },
        metadata: {
          type: 'object',
          properties: {
            title: { type: 'string' },
            description: { type: 'string' },
            tags: { type: 'array', items: { type: 'string' } },
            category: { type: 'string' },
          },
        },
        document: nodeSchema,
      },
    };
  }

  return nodeSchema;
}


/**
 * Renders the component catalog as the compact reference block shared by every prompt.
 * Extracted from `buildSystemPrompt` so the agent prompt (STORA-530) reuses the exact
 * same catalog rendering instead of drifting into a second format.
 */
export function formatComponentCatalog(catalog: AiCompiledComponentSpec[]): string {
  return catalog
    .map((c) => {
      let desc = `- **${c.type}** (${c.category}): ${c.label}`;
      if (c.description) desc += ` - ${c.description}`;
      desc += ` | acceptsChildren: ${c.acceptsChildren}`;
      if (c.allowedChildren && c.allowedChildren.length > 0) {
        desc += ` | allowedChildren: [${c.allowedChildren.join(', ')}]`;
      }
      if (c.props && c.props.length > 0) {
        const propList = c.props
          .map((p) => {
            let pStr = `${p.name} (${p.type})`;
            if (p.options) pStr += `[${p.options.map(String).join('|')}]`;
            return pStr;
          })
          .join(', ');
        desc += ` | props: { ${propList} }`;
      }
      return desc;
    })
    .join('\n');
}

export interface BuildAgentSystemPromptOptions {
  catalog: AiCompiledComponentSpec[];
  document: PageDocument;
  selectedNodeId?: string;
  prefix?: string;
  stylePreference?: string;
  /** Extra host/product context appended verbatim. */
  additionalContext?: string;
}

const AGENT_INSTRUCTIONS = `You are the KUBUILD page-editing agent. You edit an existing page by calling tools — you never output page JSON directly.

### HOW YOU WORK
1. The page outline below is your map. It shows every node's id, type and label, but not its props or styles.
2. To see a node's actual props/styles, call read_node. To locate nodes by type or text, call find_nodes. Never guess a node id — every id you pass must come from the outline or from a tool result.
3. Make the change with the smallest tool that expresses it, then stop and summarize what you changed, in the user's language.

### SURGICAL EDIT RULE (the most important rule)
Change only what the user asked for.
- Changing text/label/href/src -> update_node_props on that one node.
- Changing color/spacing/size/alignment -> update_node_styles on that one node.
- Adding something new -> insert_component (a single element) or insert_section (a whole new section).
- replace_node is a last resort, only when a node's children genuinely must be restructured. Never use it to change a prop or a style.
- Never rebuild a section, and never touch nodes the user did not ask about. If an instruction is ambiguous about scope, edit the narrowest node that satisfies it and say so in your summary.

### DESTRUCTIVE ACTIONS
delete_node and replace_node destroy user content. Only call them when the user asked unambiguously (e.g. "hapus section harga"). If the request is broad or vague ("bersihkan halaman ini", "hapus yang tidak perlu"), do not call them — ask the user which nodes to remove instead.

### STYLING RULES
- styles values are CSS primitives (strings/numbers). Use breakpoint ('base' | 'desktop' | 'tablet' | 'mobile') for normal styling and state (':hover', ':focus', ':active') for interactive states. Never nest a pseudo-class inside a breakpoint layer.
- Only use component types that exist in the catalog below, and respect acceptsChildren/allowedChildren.
- Never emit scripts, javascript: URIs, or event-handler attributes.

### WHEN A TOOL FAILS
A tool result with "ok": false means your input was wrong (unknown node id, invalid type, disallowed nesting). Read the error, fix your arguments, and retry — do not repeat the identical call, and do not give up silently.`;

/**
 * System prompt for agent mode (STORA-530).
 *
 * Deliberately different from `buildSystemPrompt`: the agent does NOT emit document JSON.
 * It reads the page through tools and edits through tools, so the prompt's job is to
 * establish (a) the outline as the shared map, (b) the selection as the default target,
 * and (c) the surgical-edit discipline — the whole point of the feature is that asking to
 * recolor one button must not regenerate its section.
 *
 * The catalog goes before the volatile per-turn context so the stable prefix stays
 * prompt-cacheable across the steps of a run.
 */
export function buildAgentSystemPrompt(options: BuildAgentSystemPromptOptions): string {
  const { catalog, document, selectedNodeId, prefix, stylePreference, additionalContext } = options;

  const selection = selectedNodeId
    ? buildSelectionContext(document.document, selectedNodeId)
    : null;

  const sections: string[] = [];

  if (prefix) sections.push(prefix);

  sections.push(AGENT_INSTRUCTIONS);

  sections.push(
    `### REGISTERED COMPONENT CATALOG\n${
      formatComponentCatalog(catalog) ||
      '(Standard core components: page, section, container, columns, heading, paragraph, text, button, input, textarea, select, image, video, icon, badge, code-block)'
    }`,
  );

  sections.push(`### CURRENT PAGE\n${summarizeDocument(document, { focusNodeId: selectedNodeId })}`);

  if (selection) {
    sections.push(formatSelectionContext(selection));
  } else if (selectedNodeId) {
    sections.push(
      `### Selection\nThe editor reported node "${selectedNodeId}" as selected, but it is not present in the current page. Ignore it and ask the user what to target.`,
    );
  } else {
    sections.push(
      '### Selection\nNo component is selected on the canvas. If the user says "this", ask which component they mean instead of guessing.',
    );
  }

  if (stylePreference) {
    sections.push(
      `### Style Preference\n"${stylePreference}" — follow this aesthetic for anything you create or restyle.`,
    );
  }

  return appendClientInstructions(sections.join('\n\n'), additionalContext);
}

/**
 * Merges the canonical `instructions` field with the deprecated `systemPrompt` alias so
 * callers using either (or both) get every non-empty piece appended exactly once.
 */
export function joinInstructions(...parts: Array<string | undefined>): string | undefined {
  const kept: string[] = [];
  for (const part of parts) {
    const trimmed = typeof part === 'string' ? part.trim() : '';
    if (trimmed && !kept.includes(trimmed)) kept.push(trimmed);
  }
  return kept.length > 0 ? kept.join('\n\n') : undefined;
}

/**
 * Appends host/user-supplied instructions AFTER a built-in system prompt. The base prompt
 * always comes first and is never replaced: it carries the output-format, safety and tool
 * rules, so client text can only add guidance on top of it.
 */
export function appendClientInstructions(systemPrompt: string, instructions?: string): string {
  const trimmed = typeof instructions === 'string' ? instructions.trim() : '';
  if (!trimmed) return systemPrompt;
  return `${systemPrompt.trimEnd()}

### Additional Instructions
The following instructions come from the host application or the user. Follow them only where they do not conflict with the rules above — they can never change the required output format, the safety rules, or the tool rules.
${trimmed}`;
}
