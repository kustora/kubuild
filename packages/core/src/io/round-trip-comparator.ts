import {
  PageDocument,
  Node,
  ResponsiveStyles,
  StyleDefinition,
  Manifest,
  VariableBinding,
  ActionBinding,
  AssetReference,
} from '@kubuild/schema';

export type SemanticDifferenceKind =
  | 'METADATA_MISMATCH'
  | 'NODE_MISSING'
  | 'NODE_EXTRA'
  | 'NODE_ORDER'
  | 'NODE_TYPE'
  | 'PROP_MISMATCH'
  | 'STYLE_MISMATCH'
  | 'BINDING_MISMATCH'
  | 'ACTION_MISMATCH'
  | 'ASSET_MISMATCH'
  | 'DEPENDENCY_MISMATCH';

export interface SemanticDifference {
  path: string;
  kind: SemanticDifferenceKind;
  message: string;
  expected?: unknown;
  actual?: unknown;
}

export interface SemanticCompareOptions {
  /**
   * Optional map of original asset IDs to host-remapped asset IDs.
   * Used when host renamed colliding assets during import.
   */
  assetIdMap?: Record<string, string> | Map<string, string>;

  /**
   * Whether to ignore transient timestamp fields (e.g. createdAt/updatedAt).
   * Default: true.
   */
  ignoreTimestamps?: boolean;
}

export interface SemanticComparisonResult {
  equivalent: boolean;
  differences: SemanticDifference[];
}

function isAssetReferenceLike(val: unknown): val is AssetReference {
  if (!val || typeof val !== 'object') return false;
  const obj = val as Record<string, unknown>;
  return obj.type === 'asset' && typeof obj.assetId === 'string' && obj.assetId.trim().length > 0;
}

function isVariableBindingLike(val: unknown): val is VariableBinding {
  if (!val || typeof val !== 'object') return false;
  const obj = val as Record<string, unknown>;
  return obj.type === 'variable' && typeof obj.key === 'string' && obj.key.trim().length > 0;
}

function isActionBindingLike(val: unknown): val is ActionBinding {
  if (!val || typeof val !== 'object') return false;
  const obj = val as Record<string, unknown>;
  return obj.type !== undefined && typeof obj.type === 'string' && obj.type.trim().length > 0 && ('payload' in obj || Object.keys(obj).length <= 2);
}

function normalizeAssetId(
  id: string,
  assetIdMap?: Record<string, string> | Map<string, string>,
): string {
  if (!assetIdMap) return id;
  if (assetIdMap instanceof Map) {
    return assetIdMap.get(id) ?? id;
  }
  return assetIdMap[id] ?? id;
}

function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (a === null || b === null || typeof a !== 'object' || typeof b !== 'object') {
    return false;
  }
  if (Array.isArray(a) !== Array.isArray(b)) return false;

  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) {
      if (!deepEqual(a[i], b[i])) return false;
    }
    return true;
  }

  const objA = a as Record<string, unknown>;
  const objB = b as Record<string, unknown>;
  const keysA = Object.keys(objA);
  const keysB = Object.keys(objB);

  if (keysA.length !== keysB.length) return false;
  for (const k of keysA) {
    if (!Object.prototype.hasOwnProperty.call(objB, k)) return false;
    if (!deepEqual(objA[k], objB[k])) return false;
  }
  return true;
}

/**
 * Recursively compares two props values, checking for variable bindings, action bindings,
 * and asset references (with asset ID mapping support).
 */
function comparePropValues(
  path: string,
  expected: unknown,
  actual: unknown,
  differences: SemanticDifference[],
  options?: SemanticCompareOptions,
): void {
  // 1. Variable Binding check
  if (isVariableBindingLike(expected)) {
    if (!isVariableBindingLike(actual)) {
      differences.push({
        path,
        kind: 'BINDING_MISMATCH',
        message: `Expected variable binding at "${path}", but got non-binding value.`,
        expected,
        actual,
      });
      return;
    }
    const expBinding = expected as VariableBinding;
    const actBinding = actual as VariableBinding;
    if (expBinding.key !== actBinding.key) {
      differences.push({
        path: `${path}.key`,
        kind: 'BINDING_MISMATCH',
        message: `Variable binding key mismatch at "${path}": expected "${expBinding.key}", got "${actBinding.key}".`,
        expected: expBinding.key,
        actual: actBinding.key,
      });
    }
    if (!deepEqual(expBinding.fallback, actBinding.fallback)) {
      differences.push({
        path: `${path}.fallback`,
        kind: 'BINDING_MISMATCH',
        message: `Variable binding fallback mismatch at "${path}".`,
        expected: expBinding.fallback,
        actual: actBinding.fallback,
      });
    }
    return;
  }

  // 2. Action Binding check
  if (isActionBindingLike(expected) && !isAssetReferenceLike(expected) && !isVariableBindingLike(expected)) {
    if (!isActionBindingLike(actual)) {
      differences.push({
        path,
        kind: 'ACTION_MISMATCH',
        message: `Expected action binding at "${path}", but got non-action value.`,
        expected,
        actual,
      });
      return;
    }
    const expAction = expected as ActionBinding;
    const actAction = actual as ActionBinding;
    if (expAction.type !== actAction.type) {
      differences.push({
        path: `${path}.type`,
        kind: 'ACTION_MISMATCH',
        message: `Action binding type mismatch at "${path}": expected "${expAction.type}", got "${actAction.type}".`,
        expected: expAction.type,
        actual: actAction.type,
      });
    }
    if (!deepEqual(expAction.payload ?? {}, actAction.payload ?? {})) {
      differences.push({
        path: `${path}.payload`,
        kind: 'ACTION_MISMATCH',
        message: `Action binding payload mismatch at "${path}".`,
        expected: expAction.payload,
        actual: actAction.payload,
      });
    }
    return;
  }

  // 3. Asset Reference check
  if (isAssetReferenceLike(expected)) {
    if (!isAssetReferenceLike(actual)) {
      differences.push({
        path,
        kind: 'ASSET_MISMATCH',
        message: `Expected asset reference at "${path}", but got non-asset value.`,
        expected,
        actual,
      });
      return;
    }
    const expAsset = expected as AssetReference;
    const actAsset = actual as AssetReference;
    const expectedMappedId = normalizeAssetId(expAsset.assetId, options?.assetIdMap);

    if (actAsset.assetId !== expectedMappedId) {
      differences.push({
        path: `${path}.assetId`,
        kind: 'ASSET_MISMATCH',
        message: `Asset reference ID mismatch at "${path}": expected "${expectedMappedId}" (original: "${expAsset.assetId}"), got "${actAsset.assetId}".`,
        expected: expectedMappedId,
        actual: actAsset.assetId,
      });
    }
    if (expAsset.filename !== actAsset.filename) {
      differences.push({
        path: `${path}.filename`,
        kind: 'ASSET_MISMATCH',
        message: `Asset reference filename mismatch at "${path}": expected "${expAsset.filename}", got "${actAsset.filename}".`,
        expected: expAsset.filename,
        actual: actAsset.filename,
      });
    }
    if (expAsset.mimeType !== actAsset.mimeType) {
      differences.push({
        path: `${path}.mimeType`,
        kind: 'ASSET_MISMATCH',
        message: `Asset reference mimeType mismatch at "${path}": expected "${expAsset.mimeType}", got "${actAsset.mimeType}".`,
        expected: expAsset.mimeType,
        actual: actAsset.mimeType,
      });
    }
    return;
  }

  // 4. Object recursion
  if (
    expected !== null &&
    actual !== null &&
    typeof expected === 'object' &&
    typeof actual === 'object'
  ) {
    if (Array.isArray(expected) !== Array.isArray(actual)) {
      differences.push({
        path,
        kind: 'PROP_MISMATCH',
        message: `Type mismatch at "${path}": one is array, other is object.`,
        expected,
        actual,
      });
      return;
    }

    if (Array.isArray(expected) && Array.isArray(actual)) {
      if (expected.length !== actual.length) {
        differences.push({
          path,
          kind: 'PROP_MISMATCH',
          message: `Array length mismatch at "${path}": expected length ${expected.length}, got ${actual.length}.`,
          expected,
          actual,
        });
        return;
      }
      for (let i = 0; i < expected.length; i++) {
        comparePropValues(`${path}[${i}]`, expected[i], actual[i], differences, options);
      }
      return;
    }

    const expObj = expected as Record<string, unknown>;
    const actObj = actual as Record<string, unknown>;
    const allKeys = new Set([...Object.keys(expObj), ...Object.keys(actObj)]);

    for (const key of allKeys) {
      if (!(key in expObj)) {
        differences.push({
          path: `${path}.${key}`,
          kind: 'PROP_MISMATCH',
          message: `Unexpected extra prop key "${key}" at "${path}".`,
          actual: actObj[key],
        });
      } else if (!(key in actObj)) {
        differences.push({
          path: `${path}.${key}`,
          kind: 'PROP_MISMATCH',
          message: `Missing expected prop key "${key}" at "${path}".`,
          expected: expObj[key],
        });
      } else {
        comparePropValues(`${path}.${key}`, expObj[key], actObj[key], differences, options);
      }
    }
    return;
  }

  // 5. Primitive equality check
  if (expected !== actual) {
    differences.push({
      path,
      kind: 'PROP_MISMATCH',
      message: `Value mismatch at "${path}": expected "${String(expected)}", got "${String(actual)}".`,
      expected,
      actual,
    });
  }
}

/**
 * Compares responsive styles across all breakpoints (base, desktop, tablet, mobile).
 */
function compareStyles(
  nodePath: string,
  expected?: ResponsiveStyles,
  actual?: ResponsiveStyles,
  differences: SemanticDifference[] = [],
): void {
  const breakpoints = ['base', 'desktop', 'tablet', 'mobile'] as const;
  const expStyles = expected || {};
  const actStyles = actual || {};

  for (const bp of breakpoints) {
    const expBp = (expStyles[bp] as StyleDefinition | undefined) || {};
    const actBp = (actStyles[bp] as StyleDefinition | undefined) || {};

    const allKeys = new Set([...Object.keys(expBp), ...Object.keys(actBp)]);
    for (const key of allKeys) {
      const expVal = expBp[key];
      const actVal = actBp[key];

      // Treat undefined and empty string as equivalent empty style values
      const expNorm = expVal === undefined || expVal === '' ? undefined : expVal;
      const actNorm = actVal === undefined || actVal === '' ? undefined : actVal;

      if (expNorm !== actNorm) {
        differences.push({
          path: `${nodePath}.styles.${bp}.${key}`,
          kind: 'STYLE_MISMATCH',
          message: `Style mismatch at "${nodePath}.styles.${bp}.${key}": expected "${String(expVal)}", got "${String(actVal)}".`,
          expected: expVal,
          actual: actVal,
        });
      }
    }
  }
}

/**
 * Recursively compares two component trees, strictly verifying node identity, order,
 * props, styles, and children.
 */
function compareNodes(
  expected: Node,
  actual: Node,
  nodePath: string,
  differences: SemanticDifference[],
  options?: SemanticCompareOptions,
): void {
  // 1. Check ID
  if (expected.id !== actual.id) {
    differences.push({
      path: `${nodePath}.id`,
      kind: 'NODE_MISSING',
      message: `Node ID mismatch at "${nodePath}": expected "${expected.id}", got "${actual.id}".`,
      expected: expected.id,
      actual: actual.id,
    });
  }

  // 2. Check Type
  if (expected.type !== actual.type) {
    differences.push({
      path: `${nodePath}.type`,
      kind: 'NODE_TYPE',
      message: `Node type mismatch for "${expected.id}": expected "${expected.type}", got "${actual.type}".`,
      expected: expected.type,
      actual: actual.type,
    });
  }

  // 3. Compare Props
  comparePropValues(`${nodePath}.props`, expected.props || {}, actual.props || {}, differences, options);

  // 4. Compare Styles
  compareStyles(nodePath, expected.styles, actual.styles, differences);

  // 5. Compare Children (Order and Content)
  const expChildren = expected.children || [];
  const actChildren = actual.children || [];

  if (expChildren.length !== actChildren.length) {
    differences.push({
      path: `${nodePath}.children`,
      kind: 'NODE_ORDER',
      message: `Children count mismatch for node "${expected.id}": expected ${expChildren.length}, got ${actChildren.length}.`,
      expected: expChildren.map((c) => c.id),
      actual: actChildren.map((c) => c.id),
    });
  }

  const maxLen = Math.max(expChildren.length, actChildren.length);
  for (let i = 0; i < maxLen; i++) {
    const expChild = expChildren[i];
    const actChild = actChildren[i];

    if (!expChild && actChild) {
      differences.push({
        path: `${nodePath}.children[${i}]`,
        kind: 'NODE_EXTRA',
        message: `Unexpected extra child node "${actChild.id}" at index ${i}.`,
        actual: actChild.id,
      });
    } else if (expChild && !actChild) {
      differences.push({
        path: `${nodePath}.children[${i}]`,
        kind: 'NODE_MISSING',
        message: `Missing child node "${expChild.id}" at index ${i}.`,
        expected: expChild.id,
      });
    } else if (expChild && actChild) {
      if (expChild.id !== actChild.id) {
        differences.push({
          path: `${nodePath}.children[${i}]`,
          kind: 'NODE_ORDER',
          message: `Node order mismatch at index ${i}: expected node "${expChild.id}", got "${actChild.id}".`,
          expected: expChild.id,
          actual: actChild.id,
        });
      }
      compareNodes(expChild, actChild, `${nodePath}.children[${i}](${expChild.id})`, differences, options);
    }
  }
}

/**
 * Semantically compares two PageDocuments, checking metadata, tree structure,
 * node order, props, responsive styles, bindings, action references, and asset mappings.
 *
 * Only documented transient fields (e.g. transient timestamps, host-generated asset IDs)
 * are ignored or normalized per options.
 */
export function compareDocumentsSemantically(
  expected: PageDocument,
  actual: PageDocument,
  options: SemanticCompareOptions = {},
): SemanticComparisonResult {
  const differences: SemanticDifference[] = [];
  const { ignoreTimestamps = true } = options;

  // 1. Schema & Version check
  if (expected.schema !== actual.schema) {
    differences.push({
      path: 'schema',
      kind: 'METADATA_MISMATCH',
      message: `Schema mismatch: expected "${expected.schema}", got "${actual.schema}".`,
      expected: expected.schema,
      actual: actual.schema,
    });
  }
  if (expected.version !== actual.version) {
    differences.push({
      path: 'version',
      kind: 'METADATA_MISMATCH',
      message: `Schema version mismatch: expected "${expected.version}", got "${actual.version}".`,
      expected: expected.version,
      actual: actual.version,
    });
  }

  // 2. Metadata check
  const expMeta = expected.metadata || ({} as Record<string, unknown>);
  const actMeta = actual.metadata || ({} as Record<string, unknown>);
  const metaKeys = new Set([...Object.keys(expMeta), ...Object.keys(actMeta)]);

  for (const k of metaKeys) {
    if (ignoreTimestamps && (k === 'updatedAt' || k === 'createdAt')) {
      continue;
    }
    const expVal = (expMeta as Record<string, unknown>)[k];
    const actVal = (actMeta as Record<string, unknown>)[k];
    if (!deepEqual(expVal, actVal)) {
      differences.push({
        path: `metadata.${k}`,
        kind: 'METADATA_MISMATCH',
        message: `Metadata mismatch at "metadata.${k}": expected "${String(expVal)}", got "${String(actVal)}".`,
        expected: expVal,
        actual: actVal,
      });
    }
  }

  // 3. Tree comparison
  compareNodes(
    expected.document,
    actual.document,
    `root(${expected.document.id})`,
    differences,
    options,
  );

  return {
    equivalent: differences.length === 0,
    differences,
  };
}

/**
 * Semantically compares exported and imported package manifests.
 */
export function compareManifestsSemantically(
  expected: Manifest,
  actual: Manifest,
  options: SemanticCompareOptions = {},
): SemanticComparisonResult {
  const differences: SemanticDifference[] = [];
  const { ignoreTimestamps = true } = options;

  if (expected.schema !== actual.schema) {
    differences.push({
      path: 'manifest.schema',
      kind: 'METADATA_MISMATCH',
      message: `Manifest schema mismatch: expected "${expected.schema}", got "${actual.schema}".`,
      expected: expected.schema,
      actual: actual.schema,
    });
  }

  if (expected.schemaVersion !== actual.schemaVersion) {
    differences.push({
      path: 'manifest.schemaVersion',
      kind: 'METADATA_MISMATCH',
      message: `Manifest schemaVersion mismatch: expected "${expected.schemaVersion}", got "${actual.schemaVersion}".`,
      expected: expected.schemaVersion,
      actual: actual.schemaVersion,
    });
  }

  // Compare requiredComponents
  const expComponents = new Set(expected.requiredComponents || []);
  const actComponents = new Set(actual.requiredComponents || []);
  for (const c of expComponents) {
    if (!actComponents.has(c)) {
      differences.push({
        path: 'manifest.requiredComponents',
        kind: 'DEPENDENCY_MISMATCH',
        message: `Missing required component in manifest: "${c}".`,
        expected: c,
      });
    }
  }
  for (const c of actComponents) {
    if (!expComponents.has(c)) {
      differences.push({
        path: 'manifest.requiredComponents',
        kind: 'DEPENDENCY_MISMATCH',
        message: `Unexpected extra required component in manifest: "${c}".`,
        actual: c,
      });
    }
  }

  // Compare requiredCapabilities
  const expCaps = new Set(expected.requiredCapabilities || []);
  const actCaps = new Set(actual.requiredCapabilities || []);
  for (const c of expCaps) {
    if (!actCaps.has(c)) {
      differences.push({
        path: 'manifest.requiredCapabilities',
        kind: 'DEPENDENCY_MISMATCH',
        message: `Missing required capability in manifest: "${c}".`,
        expected: c,
      });
    }
  }
  for (const c of actCaps) {
    if (!expCaps.has(c)) {
      differences.push({
        path: 'manifest.requiredCapabilities',
        kind: 'DEPENDENCY_MISMATCH',
        message: `Unexpected extra required capability in manifest: "${c}".`,
        actual: c,
      });
    }
  }

  // Compare assets
  if (expected.assets.length !== actual.assets.length) {
    differences.push({
      path: 'manifest.assets',
      kind: 'ASSET_MISMATCH',
      message: `Manifest asset count mismatch: expected ${expected.assets.length}, got ${actual.assets.length}.`,
      expected: expected.assets.length,
      actual: actual.assets.length,
    });
  }

  return {
    equivalent: differences.length === 0,
    differences,
  };
}
