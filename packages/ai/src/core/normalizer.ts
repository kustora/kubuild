import {
  PageDocument,
  PageDocumentSchema,
  DocumentMetadata,
  DocumentMetadataSchema,
  Node,
  NodeSchema,
  CURRENT_SCHEMA_VERSION,
  SCHEMA_NAME,
} from '@kubuild/schema';
import {
  validateDocument,
  validateDocumentSecurity,
  DocumentSecurityLimits,
} from '@kubuild/core';

export function extractJsonFromResponse(raw: string): unknown {
  let cleaned = raw.trim();
  // Strip Markdown code blocks if present (```json ... ``` or ``` ...)
  if (cleaned.startsWith('```')) {
    const firstNewline = cleaned.indexOf('\n');
    if (firstNewline !== -1) {
      cleaned = cleaned.slice(firstNewline + 1);
    }
    if (cleaned.endsWith('```')) {
      cleaned = cleaned.slice(0, cleaned.length - 3).trim();
    }
  }

  // Find the outermost JSON object bounds if there is extraneous text
  const firstBrace = cleaned.indexOf('{');
  const lastBrace = cleaned.lastIndexOf('}');
  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
    cleaned = cleaned.slice(firstBrace, lastBrace + 1);
  }

  try {
    return JSON.parse(cleaned);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(`Failed to parse AI response as JSON: ${msg}. Response was: ${raw.slice(0, 200)}...`);
  }
}

export function normalizeStyles(rawStyles: unknown): Node['styles'] {
  if (!rawStyles || typeof rawStyles !== 'object' || Array.isArray(rawStyles)) {
    return undefined;
  }

  const raw = rawStyles as Record<string, unknown>;
  const result: Record<string, unknown> = {};
  const states: Record<string, Record<string, unknown>> = {};

  // Existing states
  if (raw.states && typeof raw.states === 'object' && !Array.isArray(raw.states)) {
    for (const [stateKey, stateVal] of Object.entries(raw.states as Record<string, unknown>)) {
      if (stateVal && typeof stateVal === 'object' && !Array.isArray(stateVal)) {
        states[stateKey] = { ...(stateVal as Record<string, unknown>) };
      }
    }
  }

  const knownBreakpoints = ['base', 'desktop', 'tablet', 'mobile'];
  const hasBreakpoint = Object.keys(raw).some((k) => knownBreakpoints.includes(k));

  if (!hasBreakpoint) {
    // If AI output flat CSS properties without 'base' wrapper
    const baseStyles: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(raw)) {
      if (key === 'states') continue;
      if (key.startsWith(':') || key === 'hover' || key === 'focus' || key === 'active') {
        const stateKey = key.startsWith(':') ? key : `:${key}`;
        if (value && typeof value === 'object' && !Array.isArray(value)) {
          states[stateKey] = { ...(states[stateKey] || {}), ...(value as Record<string, unknown>) };
        }
      } else if (typeof value !== 'object' || value === null) {
        baseStyles[key] = value;
      }
    }
    if (Object.keys(baseStyles).length > 0) {
      result.base = baseStyles;
    }
  } else {
    for (const bp of knownBreakpoints) {
      const bpVal = raw[bp];
      if (bpVal && typeof bpVal === 'object' && !Array.isArray(bpVal)) {
        const cleanBp: Record<string, unknown> = {};
        for (const [key, value] of Object.entries(bpVal as Record<string, unknown>)) {
          if (key.startsWith(':') || key === 'hover' || key === 'focus' || key === 'active') {
            const stateKey = key.startsWith(':') ? key : `:${key}`;
            if (value && typeof value === 'object' && !Array.isArray(value)) {
              states[stateKey] = { ...(states[stateKey] || {}), ...(value as Record<string, unknown>) };
            }
          } else if (typeof value !== 'object' || value === null) {
            cleanBp[key] = value;
          }
        }
        if (Object.keys(cleanBp).length > 0) {
          result[bp] = cleanBp;
        }
      }
    }

    // Also extract any pseudo-classes at top level
    for (const [key, value] of Object.entries(raw)) {
      if (knownBreakpoints.includes(key) || key === 'states') continue;
      if (key.startsWith(':') || key === 'hover' || key === 'focus' || key === 'active') {
        const stateKey = key.startsWith(':') ? key : `:${key}`;
        if (value && typeof value === 'object' && !Array.isArray(value)) {
          states[stateKey] = { ...(states[stateKey] || {}), ...(value as Record<string, unknown>) };
        }
      }
    }
  }

  // Clean and sanitize states: each state can only have primitives
  const cleanStates: Record<string, Record<string, unknown>> = {};
  for (const [stateKey, stateDef] of Object.entries(states)) {
    const cleanDef: Record<string, unknown> = {};
    for (const [propKey, propVal] of Object.entries(stateDef)) {
      if (typeof propVal !== 'object' || propVal === null) {
        cleanDef[propKey] = propVal;
      }
    }
    if (Object.keys(cleanDef).length > 0) {
      cleanStates[stateKey] = cleanDef;
    }
  }

  if (Object.keys(cleanStates).length > 0) {
    result.states = cleanStates;
  }

  return Object.keys(result).length > 0 ? (result as Node['styles']) : undefined;
}

export function normalizeNodeTree(
  node: unknown,
  usedIds: Set<string> = new Set(),
  depth = 0,
): Node {
  if (!node || typeof node !== 'object') {
    throw new Error(`Invalid node at depth ${depth}: must be an object`);
  }

  const raw = node as Record<string, unknown>;
  const type = typeof raw.type === 'string' && raw.type.trim() ? raw.type.trim() : 'container';

  // Ensure deterministic, unique ID
  let id = typeof raw.id === 'string' && raw.id.trim() ? raw.id.trim() : '';
  if (!id || usedIds.has(id)) {
    let counter = 1;
    let candidate = `${type}-${counter}`;
    while (usedIds.has(candidate)) {
      counter++;
      candidate = `${type}-${counter}`;
    }
    id = candidate;
  }
  usedIds.add(id);

  // Normalize props
  const props =
    raw.props && typeof raw.props === 'object' && !Array.isArray(raw.props)
      ? { ...(raw.props as Record<string, unknown>) }
      : {};

  // Fix common LLM prop quirks:
  // e.g. heading level passed as string "1" instead of number 1
  if (type === 'heading' && typeof props.level === 'string') {
    const parsedLevel = parseInt(props.level, 10);
    if (!isNaN(parsedLevel) && parsedLevel >= 1 && parsedLevel <= 6) {
      props.level = parsedLevel;
    }
  }

  // Normalize styles
  const styles = normalizeStyles(raw.styles);

  // Normalize children recursively
  let children: Node[] | undefined = undefined;
  if (Array.isArray(raw.children)) {
    children = raw.children
      .filter((c) => c && typeof c === 'object')
      .map((c) => normalizeNodeTree(c, usedIds, depth + 1));
  }

  return {
    id,
    type,
    props: Object.keys(props).length > 0 ? props : undefined,
    styles,
    children,
  };
}

export function normalizeAndValidatePageDocument(
  rawJson: unknown,
  securityLimits?: DocumentSecurityLimits,
): PageDocument {
  if (!rawJson || typeof rawJson !== 'object') {
    throw new Error('AI output must be a JSON object');
  }

  const obj = rawJson as Record<string, unknown>;

  // Case 1: AI returned directly a page node instead of PageDocument
  let docObject: Record<string, unknown>;
  if (obj.type === 'page' && !obj.document) {
    docObject = {
      schema: SCHEMA_NAME,
      version: CURRENT_SCHEMA_VERSION,
      metadata: {
        title: (typeof obj.props === 'object' && obj.props !== null && (obj.props as Record<string, unknown>).title) || 'AI Generated Page',
        description: 'Generated by KUBUILD AI',
      },
      document: obj,
    };
  } else {
    docObject = {
      schema: SCHEMA_NAME,
      version: typeof obj.version === 'string' ? obj.version : CURRENT_SCHEMA_VERSION,
      metadata: typeof obj.metadata === 'object' && obj.metadata !== null
        ? obj.metadata
        : { title: 'AI Generated Page', description: 'Generated by KUBUILD AI' },
      document: obj.document || obj,
    };
  }

  // Normalize the node tree and ensure IDs
  const usedIds = new Set<string>();
  const normalizedRoot = normalizeNodeTree(docObject.document, usedIds);

  if (normalizedRoot.type !== 'page') {
    normalizedRoot.type = 'page';
  }

  const parsedMetadata = DocumentMetadataSchema.parse({
    title: 'AI Generated Page',
    description: 'Generated by KUBUILD AI',
    author: 'KUBUILD AI',
    tags: ['ai-generated'],
    category: 'general',
    version: '1.0.0',
    ...(typeof docObject.metadata === 'object' && docObject.metadata !== null
      ? (docObject.metadata as Record<string, unknown>)
      : {}),
  });

  const finalDocument: PageDocument = {
    schema: SCHEMA_NAME,
    version: CURRENT_SCHEMA_VERSION,
    metadata: parsedMetadata,
    document: normalizedRoot as PageDocument['document'],
  };

  // 1. Zod Schema parse
  const parsed = PageDocumentSchema.safeParse(finalDocument);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ');
    throw new Error(`Document schema validation failed: ${issues}`);
  }

  // 2. Core document and security validation
  const validationResult = validateDocument(finalDocument, { securityLimits });
  if (!validationResult.valid) {
    const errorMsgs = validationResult.errors.map((e) => `${e.code}: ${e.message} (${e.path})`).join('; ');
    throw new Error(`Document validation failed: ${errorMsgs}`);
  }

  return parsed.data;
}

export function normalizeAndValidateSectionNode(
  rawJson: unknown,
  securityLimits?: DocumentSecurityLimits,
): Node {
  if (!rawJson || typeof rawJson !== 'object') {
    throw new Error('AI output must be a JSON object');
  }

  const usedIds = new Set<string>();
  const normalized = normalizeNodeTree(rawJson, usedIds);

  if (normalized.type !== 'section') {
    // If AI wrapped it or returned another root, enforce section
    normalized.type = 'section';
  }

  const parsed = NodeSchema.safeParse(normalized);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ');
    throw new Error(`Section node schema validation failed: ${issues}`);
  }

  // Security check
  const secCheck = validateDocumentSecurity({ document: normalized }, securityLimits);
  if (!secCheck.safe) {
    const issues = secCheck.errors.map((e) => `${e.code}: ${e.message}`).join('; ');
    throw new Error(`Section security check failed: ${issues}`);
  }

  return parsed.data;
}

export function normalizeAndValidateRefactoredNode(
  rawJson: unknown,
  originalNode: Node,
  securityLimits?: DocumentSecurityLimits,
): Node {
  if (!rawJson || typeof rawJson !== 'object') {
    throw new Error('AI output must be a JSON object');
  }

  const usedIds = new Set<string>();
  const normalized = normalizeNodeTree(rawJson, usedIds);

  // Preserve original ID and type if AI changed them accidentally
  normalized.id = originalNode.id;
  normalized.type = originalNode.type;

  const parsed = NodeSchema.safeParse(normalized);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ');
    throw new Error(`Refactored node schema validation failed: ${issues}`);
  }

  const secCheck = validateDocumentSecurity({ document: normalized }, securityLimits);
  if (!secCheck.safe) {
    const issues = secCheck.errors.map((e) => `${e.code}: ${e.message}`).join('; ');
    throw new Error(`Refactored node security check failed: ${issues}`);
  }

  return parsed.data;
}
