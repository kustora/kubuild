import type {
  AiCompiledComponentSpec,
  AiCompiledComponentProp,
  ComponentRegistryLike,
  ComponentDefinitionLike,
  AiGenerationMode,
} from '../types';

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
5. Responsive styling:
   - Use the \`styles\` object with breakpoint keys: \`base\` (all viewports/desktop), and optionally \`tablet\` or \`mobile\`.
   - Use standard CSS-in-JS style keys (e.g. \`backgroundColor\`, \`paddingTop\`, \`borderRadius\`, \`display\`, \`flexDirection\`, \`gap\`, \`boxShadow\`).
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
        version: { type: 'string', const: '1.0.0' },
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
