import {
  PageDocument,
  PageDocumentSchema,
  SCHEMA_NAME,
} from '@kubuild/schema';
import {
  DocumentSecurityLimits,
  validateDocumentSecurity,
} from './security';

export type DocumentValidationErrorCode =
  | 'GLOBAL_SCHEMA_INVALID'
  | 'ROOT_NODE_INVALID'
  | 'NODE_SHAPE_INVALID'
  | 'DUPLICATE_NODE_ID'
  | 'TREE_CYCLE_DETECTED'
  | 'UNKNOWN_COMPONENT_TYPE'
  | 'CHILD_POLICY_VIOLATION'
  | 'INVALID_ASSET_REFERENCE'
  | 'INVALID_VARIABLE_BINDING'
  | 'INVALID_ACTION_BINDING'
  | 'INVALID_METADATA'
  | 'PROTOTYPE_POLLUTION_DETECTED'
  | 'SECURITY_LIMIT_EXCEEDED';

export interface DocumentValidationError {
  code: DocumentValidationErrorCode;
  message: string;
  path: string;
  nodeId?: string;
  details?: Record<string, unknown>;
}

export type DocumentValidationWarningCode =
  | 'CHILD_POLICY_VIOLATION'
  | 'UNKNOWN_COMPONENT_TYPE'
  | 'UNRESOLVED_ASSET_REFERENCE'
  | (string & {});

export interface DocumentValidationWarning {
  code: DocumentValidationWarningCode;
  message: string;
  path: string;
  nodeId?: string;
  details?: Record<string, unknown>;
}

export interface ComponentDefinitionLike {
  type: string;
  category?: string;
  capabilities?: string[];
  acceptsChildren?: boolean;
  allowedChildren?: string[];
  disallowedParents?: string[];
}

export interface ComponentRegistryLike {
  get(type: string): ComponentDefinitionLike | undefined;
  has(type: string): boolean;
}

export interface ValidationOptions {
  componentRegistry?: ComponentRegistryLike;
  knownComponentTypes?: string[] | Set<string>;
  strictComponentTypes?: boolean;
  /**
   * Whether to treat child policy mismatches (e.g. allowedChildren) strictly as blocking errors.
   * If false or undefined (default), allowedChildren mismatches are emitted as non-blocking warnings.
   */
  strictChildPolicy?: boolean;
  /**
   * Validate asset references (`{ type: 'asset', assetId, fallbackUrl? }`) found in node props.
   * Checks that `assetId` is a non-empty string and `fallbackUrl` (if present) is a string.
   * When `knownAssetIds` is also supplied, every referenced `assetId` must be in that set.
   * Defaults to `true`.
   */
  checkAssetReferences?: boolean;
  /**
   * Known asset IDs used to verify that asset references resolve. A `PageDocument` carries
   * no asset registry of its own (assets live in the `.stora` manifest or the host's asset
   * provider), so this existence check only runs when the caller supplies the IDs.
   * An unresolved reference is an `INVALID_ASSET_REFERENCE` error, or a non-blocking
   * `UNRESOLVED_ASSET_REFERENCE` warning when the reference has a `fallbackUrl`.
   * Ignored when `checkAssetReferences` is `false`.
   */
  knownAssetIds?: string[] | Set<string>;
  /**
   * Validate variable bindings (`{ type: 'variable', key }`) in node props: `key` must be a
   * non-empty string. Defaults to `true`.
   */
  checkVariableBindings?: boolean;
  /**
   * Validate action bindings in node props (a prop named `action`, or any object with a string
   * `type` and a `payload`): `type` must be a non-empty string. Defaults to `true`.
   */
  checkActionBindings?: boolean;
  securityLimits?: DocumentSecurityLimits;
}

export interface DocumentValidationResult {
  valid: boolean;
  success: boolean;
  errors: DocumentValidationError[];
  warnings: DocumentValidationWarning[];
  data?: PageDocument;
}

/**
 * Validate a page document against global schema, node shape, child policy,
 * ID uniqueness, cycles, unknown component types, and structural bindings.
 */
export function validateDocument(
  input: unknown,
  options: ValidationOptions = {},
): DocumentValidationResult {
  const errors: DocumentValidationError[] = [];
  const warnings: DocumentValidationWarning[] = [];

  // 1. Basic Object check
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return {
      valid: false,
      success: false,
      errors: [
        {
          code: 'GLOBAL_SCHEMA_INVALID',
          message: 'Document must be a valid non-null object',
          path: '',
        },
      ],
      warnings: [],
    };
  }

  const doc = input as Record<string, unknown>;

  // 1.5 Security Limits & Prototype Pollution Check
  const securityCheck = validateDocumentSecurity(doc, options.securityLimits);
  if (!securityCheck.safe) {
    for (const secErr of securityCheck.errors) {
      errors.push({
        code: secErr.code === 'PROTOTYPE_POLLUTION_DETECTED'
          ? 'PROTOTYPE_POLLUTION_DETECTED'
          : 'SECURITY_LIMIT_EXCEEDED',
        message: secErr.message,
        path: secErr.path || '',
        details: secErr.details,
      });
    }
    if (securityCheck.errors.some((e) => e.code === 'PROTOTYPE_POLLUTION_DETECTED')) {
      return {
        valid: false,
        success: false,
        errors,
        warnings: [],
      };
    }
  }

  // 2. Global Schema / Version / Document field checks
  if (doc.schema !== SCHEMA_NAME) {
    errors.push({
      code: 'GLOBAL_SCHEMA_INVALID',
      message: `Invalid schema identifier. Expected "${SCHEMA_NAME}", received "${String(doc.schema)}"`,
      path: '/schema',
    });
  }

  if (typeof doc.version !== 'string' || doc.version.trim().length === 0) {
    errors.push({
      code: 'GLOBAL_SCHEMA_INVALID',
      message: 'Schema version must be a non-empty string',
      path: '/version',
    });
  }

  if (!doc.document || typeof doc.document !== 'object' || Array.isArray(doc.document)) {
    errors.push({
      code: 'GLOBAL_SCHEMA_INVALID',
      message: 'Document must contain a root document node object',
      path: '/document',
    });
    return {
      valid: false,
      success: false,
      errors,
      warnings,
    };
  }

  const rootNode = doc.document as Record<string, unknown>;

  // 3. Root Node Type check (must be 'page')
  if (rootNode.type !== 'page') {
    errors.push({
      code: 'ROOT_NODE_INVALID',
      message: `Root node type must be "page", received "${String(rootNode.type)}"`,
      path: '/document/type',
      nodeId: typeof rootNode.id === 'string' ? rootNode.id : undefined,
    });
  }

  // 4. Metadata check
  if (doc.metadata !== undefined) {
    if (typeof doc.metadata !== 'object' || doc.metadata === null || Array.isArray(doc.metadata)) {
      errors.push({
        code: 'INVALID_METADATA',
        message: 'Document metadata must be an object',
        path: '/metadata',
      });
    } else {
      const meta = doc.metadata as Record<string, unknown>;
      if (meta.title !== undefined && (typeof meta.title !== 'string' || meta.title.trim().length === 0)) {
        errors.push({
          code: 'INVALID_METADATA',
          message: 'Metadata title must be a non-empty string when provided',
          path: '/metadata/title',
        });
      }
    }
  }

  // 5. Deep Recursive Node Tree Validation (Cycle, ID Uniqueness, Node Shape, Registry, Bindings)
  const seenIds = new Map<string, string>(); // nodeId -> path
  const visitedObjects = new Set<object>();

  validateNodeRecursive(
    rootNode,
    '/document',
    undefined,
    seenIds,
    visitedObjects,
    options,
    errors,
    warnings,
  );

  // 6. Schema Zod safe parse fallback to capture any missed structural issues
  if (errors.length === 0) {
    const zodResult = PageDocumentSchema.safeParse(input);
    if (!zodResult.success) {
      for (const issue of zodResult.error.issues) {
        const jsonPath = '/' + issue.path.join('/');
        errors.push({
          code: 'GLOBAL_SCHEMA_INVALID',
          message: issue.message,
          path: jsonPath === '/' ? '' : jsonPath,
        });
      }
    } else {
      return {
        valid: true,
        success: true,
        errors: [],
        warnings,
        data: zodResult.data as unknown as PageDocument,
      };
    }
  }

  return {
    valid: errors.length === 0,
    success: errors.length === 0,
    errors,
    warnings,
  };
}

function validateNodeRecursive(
  nodeObj: Record<string, unknown>,
  currentPath: string,
  parentNode: { id: string; type: string } | undefined,
  seenIds: Map<string, string>,
  visitedObjects: Set<object>,
  options: ValidationOptions,
  errors: DocumentValidationError[],
  warnings: DocumentValidationWarning[],
): void {
  // Cycle Detection
  if (visitedObjects.has(nodeObj)) {
    errors.push({
      code: 'TREE_CYCLE_DETECTED',
      message: `Cyclic reference detected at node path ${currentPath}`,
      path: currentPath,
      nodeId: typeof nodeObj.id === 'string' ? nodeObj.id : undefined,
    });
    return;
  }
  visitedObjects.add(nodeObj);

  // Validate Node ID
  const nodeId = nodeObj.id;
  if (typeof nodeId !== 'string' || nodeId.trim().length === 0) {
    errors.push({
      code: 'NODE_SHAPE_INVALID',
      message: 'Node id must be a non-empty string',
      path: `${currentPath}/id`,
    });
  } else {
    if (seenIds.has(nodeId)) {
      errors.push({
        code: 'DUPLICATE_NODE_ID',
        message: `Duplicate node ID "${nodeId}" found at ${currentPath} (first seen at ${seenIds.get(nodeId)})`,
        path: `${currentPath}/id`,
        nodeId,
        details: { firstSeenAt: seenIds.get(nodeId) },
      });
    } else {
      seenIds.set(nodeId, currentPath);
    }
  }

  // Validate Node Type
  const nodeType = nodeObj.type;
  if (typeof nodeType !== 'string' || nodeType.trim().length === 0) {
    errors.push({
      code: 'NODE_SHAPE_INVALID',
      message: 'Node type must be a non-empty string',
      path: `${currentPath}/type`,
      nodeId: typeof nodeId === 'string' ? nodeId : undefined,
    });
  }

  const effectiveNodeId = typeof nodeId === 'string' ? nodeId : undefined;
  const effectiveNodeType = typeof nodeType === 'string' ? nodeType : '';

  // Validate against Component Registry or known types
  let componentDef: ComponentDefinitionLike | undefined;
  if (effectiveNodeType) {
    if (options.componentRegistry) {
      componentDef = options.componentRegistry.get(effectiveNodeType);
      if (!componentDef && (options.strictComponentTypes || !options.componentRegistry.has(effectiveNodeType))) {
        errors.push({
          code: 'UNKNOWN_COMPONENT_TYPE',
          message: `Unknown component type: "${effectiveNodeType}"`,
          path: `${currentPath}/type`,
          nodeId: effectiveNodeId,
        });
      }
    } else if (options.knownComponentTypes) {
      const isKnown = Array.isArray(options.knownComponentTypes)
        ? options.knownComponentTypes.includes(effectiveNodeType)
        : options.knownComponentTypes.has(effectiveNodeType);

      if (!isKnown && options.strictComponentTypes) {
        errors.push({
          code: 'UNKNOWN_COMPONENT_TYPE',
          message: `Unknown component type: "${effectiveNodeType}"`,
          path: `${currentPath}/type`,
          nodeId: effectiveNodeId,
        });
      }
    }
  }

  // Validate Child Policy
  const children = nodeObj.children;
  if (children !== undefined) {
    if (!Array.isArray(children)) {
      errors.push({
        code: 'NODE_SHAPE_INVALID',
        message: 'Node children must be an array',
        path: `${currentPath}/children`,
        nodeId: effectiveNodeId,
      });
    } else {
      if (componentDef && componentDef.acceptsChildren === false && children.length > 0) {
        errors.push({
          code: 'CHILD_POLICY_VIOLATION',
          message: `Component "${effectiveNodeType}" does not accept children, but found ${children.length} child node(s)`,
          path: `${currentPath}/children`,
          nodeId: effectiveNodeId,
        });
      }

      if (parentNode && componentDef?.disallowedParents?.includes(parentNode.type)) {
        errors.push({
          code: 'CHILD_POLICY_VIOLATION',
          message: `Component "${effectiveNodeType}" cannot be a child of "${parentNode.type}"`,
          path: currentPath,
          nodeId: effectiveNodeId,
        });
      }

      for (let i = 0; i < children.length; i++) {
        const child = children[i];
        const childPath = `${currentPath}/children/${i}`;

        if (!child || typeof child !== 'object' || Array.isArray(child)) {
          errors.push({
            code: 'NODE_SHAPE_INVALID',
            message: `Child at index ${i} must be a valid node object`,
            path: childPath,
            nodeId: effectiveNodeId,
          });
          continue;
        }

        const childRecord = child as Record<string, unknown>;
        const childType = typeof childRecord.type === 'string' ? childRecord.type : '';
        const childIsKnown = !options.componentRegistry || options.componentRegistry.has(childType);
        const childCategory = options.componentRegistry?.get(childType)?.category;

        if (
          componentDef?.allowedChildren &&
          childType &&
          childIsKnown &&
          !componentDef.allowedChildren.includes(childType) &&
          !componentDef.allowedChildren.includes('*') &&
          !(childCategory && componentDef.allowedChildren.includes(childCategory))
        ) {
          const violationMessage = `Component type "${childType}" is not allowed as a child of "${effectiveNodeType}". Allowed types: ${componentDef.allowedChildren.join(', ')}`;
          if (options.strictChildPolicy) {
            errors.push({
              code: 'CHILD_POLICY_VIOLATION',
              message: violationMessage,
              path: `${childPath}/type`,
              nodeId: typeof childRecord.id === 'string' ? childRecord.id : undefined,
            });
          } else {
            warnings.push({
              code: 'CHILD_POLICY_VIOLATION',
              message: violationMessage,
              path: `${childPath}/type`,
              nodeId: typeof childRecord.id === 'string' ? childRecord.id : undefined,
            });
          }
        }

        validateNodeRecursive(
          childRecord,
          childPath,
          { id: effectiveNodeId || '', type: effectiveNodeType },
          seenIds,
          visitedObjects,
          options,
          errors,
          warnings,
        );
      }
    }
  }

  // Validate Props and structural bindings (Assets, Variables, Actions)
  if (nodeObj.props !== undefined) {
    if (typeof nodeObj.props !== 'object' || nodeObj.props === null || Array.isArray(nodeObj.props)) {
      errors.push({
        code: 'NODE_SHAPE_INVALID',
        message: 'Node props must be an object',
        path: `${currentPath}/props`,
        nodeId: effectiveNodeId,
      });
    } else {
      validatePropsBindings(
        nodeObj.props as Record<string, unknown>,
        `${currentPath}/props`,
        effectiveNodeId,
        options,
        errors,
        warnings,
      );
    }
  }

  // Validate Styles
  if (nodeObj.styles !== undefined) {
    if (typeof nodeObj.styles !== 'object' || nodeObj.styles === null || Array.isArray(nodeObj.styles)) {
      errors.push({
        code: 'NODE_SHAPE_INVALID',
        message: 'Node styles must be an object',
        path: `${currentPath}/styles`,
        nodeId: effectiveNodeId,
      });
    }
  }
}

/**
 * Recursively inspect props object for structural bindings (asset, variable, action).
 * Each binding kind is gated by its `ValidationOptions` flag (all default to `true`).
 */
function validatePropsBindings(
  propsObj: Record<string, unknown>,
  propsPath: string,
  nodeId: string | undefined,
  options: ValidationOptions,
  errors: DocumentValidationError[],
  warnings: DocumentValidationWarning[],
): void {
  const checkAssets = options.checkAssetReferences !== false;
  const checkVariables = options.checkVariableBindings !== false;
  const checkActions = options.checkActionBindings !== false;

  for (const [key, value] of Object.entries(propsObj)) {
    const currentPath = `${propsPath}/${key}`;

    if (!value || typeof value !== 'object') {
      continue;
    }

    if (Array.isArray(value)) {
      value.forEach((item, index) => {
        if (item && typeof item === 'object' && !Array.isArray(item)) {
          validatePropsBindings(
            item as Record<string, unknown>,
            `${currentPath}/${index}`,
            nodeId,
            options,
            errors,
            warnings,
          );
        }
      });
      continue;
    }

    const record = value as Record<string, unknown>;

    // Check if it's an Asset Reference
    if (record.type === 'asset') {
      if (!checkAssets) continue;
      const assetId =
        typeof record.assetId === 'string' && record.assetId.trim().length > 0 ? record.assetId : undefined;
      if (assetId === undefined) {
        errors.push({
          code: 'INVALID_ASSET_REFERENCE',
          message: 'Asset reference must have a non-empty "assetId"',
          path: `${currentPath}/assetId`,
          nodeId,
        });
      }
      if (record.fallbackUrl !== undefined && typeof record.fallbackUrl !== 'string') {
        errors.push({
          code: 'INVALID_ASSET_REFERENCE',
          message: 'Asset fallbackUrl must be a string if provided',
          path: `${currentPath}/fallbackUrl`,
          nodeId,
        });
      }
      if (assetId !== undefined && options.knownAssetIds && !isKnownId(options.knownAssetIds, assetId)) {
        if (typeof record.fallbackUrl === 'string' && record.fallbackUrl.length > 0) {
          warnings.push({
            code: 'UNRESOLVED_ASSET_REFERENCE',
            message: `Asset "${assetId}" is not among the known assets; its fallbackUrl will be used`,
            path: `${currentPath}/assetId`,
            nodeId,
            details: { assetId },
          });
        } else {
          errors.push({
            code: 'INVALID_ASSET_REFERENCE',
            message: `Asset "${assetId}" is not among the known assets and has no fallbackUrl`,
            path: `${currentPath}/assetId`,
            nodeId,
            details: { assetId },
          });
        }
      }
    }
    // Check if it's a Variable Binding
    else if (record.type === 'variable') {
      if (!checkVariables) continue;
      if (typeof record.key !== 'string' || record.key.trim().length === 0) {
        errors.push({
          code: 'INVALID_VARIABLE_BINDING',
          message: 'Variable binding must have a non-empty "key"',
          path: `${currentPath}/key`,
          nodeId,
        });
      }
    }
    // Check if it's an Action Binding (either key is 'action' or has explicit action shape)
    else if (key === 'action' || (typeof record.type === 'string' && record.payload !== undefined)) {
      if (!checkActions) continue;
      if (typeof record.type !== 'string' || record.type.trim().length === 0) {
        errors.push({
          code: 'INVALID_ACTION_BINDING',
          message: 'Action binding must have a non-empty "type"',
          path: `${currentPath}/type`,
          nodeId,
        });
      }
    } else {
      // Recurse into nested objects
      validatePropsBindings(record, currentPath, nodeId, options, errors, warnings);
    }
  }
}

function isKnownId(ids: string[] | Set<string>, id: string): boolean {
  return Array.isArray(ids) ? ids.includes(id) : ids.has(id);
}
