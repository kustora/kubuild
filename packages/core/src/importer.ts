import { unzipSync, strFromU8 } from 'fflate';
import {
  PageDocument,
  DocumentMetadata,
  Manifest,
  ManifestAssetItem,
  ManifestSchema,
  CURRENT_SCHEMA_VERSION,
  SCHEMA_NAME,
} from '@kubuild/schema';
import {
  validateDocument,
  ComponentRegistryLike,
} from './validator';
import {
  canMigrate,
  getMigrationPath,
  migrateDocument,
  MigrationRegistry,
  defaultMigrationRegistry,
} from './migration';
import { calculateChecksum } from './exporter';
import { remapDocumentAssetReferences } from './document-utils';
import type { AssetProvider, AssetInfo } from './interfaces';

export interface SecurityLimits {
  /**
   * Maximum allowed size for the compressed archive in bytes (default: 50MB).
   */
  maxArchiveSize?: number;

  /**
   * Maximum total uncompressed size across all files in bytes (default: 100MB).
   */
  maxUncompressedSize?: number;

  /**
   * Maximum number of files in the archive (default: 1000).
   */
  maxFileCount?: number;

  /**
   * Maximum size for any individual asset in bytes (default: 25MB).
   */
  maxAssetSize?: number;
}

export const DEFAULT_SECURITY_LIMITS: Required<SecurityLimits> = {
  maxArchiveSize: 50 * 1024 * 1024,      // 50 MB
  maxUncompressedSize: 100 * 1024 * 1024, // 100 MB
  maxFileCount: 1000,
  maxAssetSize: 25 * 1024 * 1024,        // 25 MB
};

export type MissingDependencyPolicy =
  | 'cancel'
  | 'import-with-placeholder'
  | 'install-or-register-before-import';

export type AssetCollisionStrategy =
  | 'reject'
  | 'rename'
  | 'overwrite'
  | 'reuse-existing';

export interface AssetConflict {
  assetId: string;
  path: string;
  mimeType: string;
  size: number;
  existingAsset?: AssetInfo | Record<string, unknown>;
}

export interface AssetConflictResolution {
  action: AssetCollisionStrategy;
  newAssetId?: string;
}

export type PreflightDiagnosticCode =
  | 'ARCHIVE_EMPTY'
  | 'ARCHIVE_CORRUPT'
  | 'SIZE_LIMIT_EXCEEDED'
  | 'FILE_COUNT_EXCEEDED'
  | 'ZIP_SLIP_DETECTED'
  | 'MISSING_MANIFEST'
  | 'INVALID_MANIFEST'
  | 'MISSING_PAGE_DOCUMENT'
  | 'INVALID_PAGE_DOCUMENT'
  | 'UNSUPPORTED_SCHEMA_VERSION'
  | 'NO_MIGRATION_PATH'
  | 'MIGRATION_FAILED'
  | 'ASSET_FILE_MISSING'
  | 'ASSET_SIZE_MISMATCH'
  | 'ASSET_CHECKSUM_MISMATCH'
  | 'ASSET_LIMIT_EXCEEDED'
  | 'ASSET_CONFLICT'
  | 'MISSING_COMPONENTS'
  | 'MISSING_CAPABILITIES'
  | 'HOST_ADAPTER_ERROR';

export interface PreflightDiagnostic {
  code: PreflightDiagnosticCode;
  severity: 'error' | 'warning' | 'info';
  message: string;
  path?: string;
  details?: Record<string, unknown>;
}

export interface PreflightOptions {
  /**
   * Component registry to check required custom components.
   */
  componentRegistry?: ComponentRegistryLike;

  /**
   * Allowlist of known component type names (used if componentRegistry is not provided or in combination).
   */
  knownComponentTypes?: string[] | Set<string>;

  /**
   * Allowlist of capabilities supported by host.
   */
  supportedCapabilities?: string[] | Set<string>;

  /**
   * Security limits for archive and files.
   */
  securityLimits?: SecurityLimits;

  /**
   * Custom migration registry.
   */
  migrationRegistry?: MigrationRegistry;

  /**
   * Target schema version (defaults to CURRENT_SCHEMA_VERSION = "1.0.0").
   */
  targetSchemaVersion?: string;

  /**
   * Policy for handling missing custom components and capabilities.
   * - 'cancel' (default): Abort import with blocking errors when components/capabilities are missing.
   * - 'import-with-placeholder': Allow import, keeping missing component nodes and props intact for placeholder rendering.
   * - 'install-or-register-before-import': Call onMissingDependency to register/install before finalizing import.
   */
  dependencyPolicy?: MissingDependencyPolicy;

  /**
   * Hook called when dependencyPolicy is 'install-or-register-before-import'.
   */
  onMissingDependency?: (
    missing: { components: string[]; capabilities: string[] },
    preflight: PreflightReport,
  ) => Promise<boolean | void> | boolean | void;

  /**
   * If true, missing components are treated as warnings rather than blocking errors.
   * (Equivalent to setting dependencyPolicy: 'import-with-placeholder')
   */
  allowMissingComponents?: boolean;

  /**
   * If true, missing capabilities are treated as warnings rather than blocking errors.
   * (Equivalent to setting dependencyPolicy: 'import-with-placeholder')
   */
  allowMissingCapabilities?: boolean;

  /**
   * Strategy for resolving asset collisions with existing host assets.
   * - 'reject' (default): Refuse import if asset collision is detected without an explicit resolution strategy.
   * - 'rename': Rename the incoming asset to avoid overwriting host assets, and automatically remap document asset references.
   * - 'overwrite': Explicitly overwrite host assets with incoming archive assets.
   * - 'reuse-existing': Reuse existing host assets and skip writing archive asset binaries.
   */
  assetCollisionStrategy?: AssetCollisionStrategy;

  /**
   * Existing host asset IDs or checker function to detect collisions.
   */
  existingAssetIds?: string[] | Set<string> | ((assetId: string) => boolean | Promise<boolean>);

  /**
   * Custom naming function when renaming colliding assets.
   */
  renameAssetStrategy?: (incoming: ManifestAssetItem, existingIds: Set<string>) => string;

  /**
   * Host AssetProvider to resolve existing assets or upload extracted local assets.
   */
  assetProvider?: AssetProvider;

  /**
   * Fine-grained callback for resolving individual asset conflicts.
   */
  onAssetConflict?: (
    conflict: AssetConflict,
  ) => Promise<AssetConflictResolution | AssetCollisionStrategy> | AssetConflictResolution | AssetCollisionStrategy;
}

export interface PreflightReport {
  /**
   * True if archive is completely safe and syntactically valid.
   */
  valid: boolean;

  /**
   * True if archive can be safely imported given the host's supported components/capabilities and asset policies.
   */
  canImport: boolean;

  /**
   * Parsed manifest if available.
   */
  manifest?: Manifest;

  /**
   * Parsed metadata if available.
   */
  rawMetadata?: DocumentMetadata;

  /**
   * Schema version reported in the document/manifest.
   */
  sourceVersion?: string;

  /**
   * Target schema version.
   */
  targetVersion: string;

  /**
   * True if the document version differs from target version and requires migration.
   */
  requiresMigration: boolean;

  /**
   * Migration path version sequence if migration is needed.
   */
  migrationPath?: string[];

  /**
   * List of custom component types required by package that are missing in host.
   */
  missingComponents: string[];

  /**
   * List of capabilities required by package that are missing in host.
   */
  missingCapabilities: string[];

  /**
   * Active policy for missing dependencies.
   */
  dependencyPolicy: MissingDependencyPolicy;

  /**
   * Number of valid local assets declared in manifest.
   */
  assetCount: number;

  /**
   * List of detected asset collisions with existing host assets.
   */
  assetConflicts: AssetConflict[];

  /**
   * Active strategy for handling asset collisions.
   */
  assetCollisionStrategy: AssetCollisionStrategy;

  /**
   * Total uncompressed size of all files in archive.
   */
  totalUncompressedBytes: number;

  /**
   * Diagnostics collected during inspection.
   */
  diagnostics: PreflightDiagnostic[];
}

export interface ImportPackageOptions extends PreflightOptions {
  /**
   * Custom asset importer hook called for each extracted asset.
   */
  onAssetImport?: (
    assetId: string,
    assetBytes: Uint8Array,
    assetMeta: ManifestAssetItem,
  ) => Promise<AssetInfo | string | void> | AssetInfo | string | void;
}

export interface ExtractedAsset {
  bytes: Uint8Array;
  meta: ManifestAssetItem;
  hostInfo?: AssetInfo | string;
}

export interface ImportPackageSuccess {
  success: true;
  document: PageDocument;
  manifest: Manifest;
  metadata: DocumentMetadata;
  extractedAssets: Map<string, ExtractedAsset>;
  renamedAssets?: Record<string, string>;
  preflight: PreflightReport;
}

export interface ImportPackageFailure {
  success: false;
  errors: PreflightDiagnostic[];
  diagnosticMessage: string;
  preflight?: PreflightReport;
}

export type ImportPackageResult = ImportPackageSuccess | ImportPackageFailure;

/**
 * Checks if a zip entry path contains zip-slip or directory traversal attempts.
 */
export function isDangerousPath(filepath: string): boolean {
  if (!filepath || typeof filepath !== 'string') return true;

  // Check for null bytes
  if (filepath.includes('\0')) return true;

  // Check for absolute paths (Unix or Windows drive)
  if (filepath.startsWith('/') || filepath.startsWith('\\') || /^[a-zA-Z]:/.test(filepath)) {
    return true;
  }

  // Normalize slashes
  const normalized = filepath.replace(/\\/g, '/');

  // Check path segments
  const segments = normalized.split('/');
  for (const seg of segments) {
    if (seg === '..' || seg.trim() === '..') {
      return true;
    }
  }

  return false;
}

/**
 * Inspects a .stora archive and runs non-destructive preflight validation.
 * Verifies security limits, path safety, manifest, checksums, component/capability requirements, and migration status.
 */
export async function preflightPackage(
  archiveData: Uint8Array | ArrayBuffer,
  options: PreflightOptions = {},
): Promise<PreflightReport> {
  const limits: Required<SecurityLimits> = {
    ...DEFAULT_SECURITY_LIMITS,
    ...options.securityLimits,
  };

  const targetVersion = options.targetSchemaVersion || CURRENT_SCHEMA_VERSION;
  const migrationRegistry = options.migrationRegistry || defaultMigrationRegistry;
  const diagnostics: PreflightDiagnostic[] = [];

  let dependencyPolicy: MissingDependencyPolicy = options.dependencyPolicy || 'cancel';
  if (!options.dependencyPolicy) {
    if (options.allowMissingComponents && options.allowMissingCapabilities) {
      dependencyPolicy = 'import-with-placeholder';
    }
  }

  const assetCollisionStrategy: AssetCollisionStrategy = options.assetCollisionStrategy || 'reject';

  const archiveBytes = archiveData instanceof Uint8Array ? archiveData : new Uint8Array(archiveData);

  // 1. Check archive size limit
  if (!archiveBytes || archiveBytes.byteLength === 0) {
    diagnostics.push({
      code: 'ARCHIVE_EMPTY',
      severity: 'error',
      message: 'Archive is empty or 0 bytes.',
    });
    return buildReport(false, false, { targetVersion, dependencyPolicy, assetCollisionStrategy, diagnostics });
  }

  if (archiveBytes.byteLength > limits.maxArchiveSize) {
    diagnostics.push({
      code: 'SIZE_LIMIT_EXCEEDED',
      severity: 'error',
      message: `Archive size (${archiveBytes.byteLength} bytes) exceeds maximum limit of ${limits.maxArchiveSize} bytes.`,
      details: { actualBytes: archiveBytes.byteLength, limitBytes: limits.maxArchiveSize },
    });
    return buildReport(false, false, { targetVersion, dependencyPolicy, assetCollisionStrategy, diagnostics });
  }

  // 2. Safe Unzip
  let unzipped: Record<string, Uint8Array>;
  try {
    unzipped = unzipSync(archiveBytes);
  } catch (err) {
    diagnostics.push({
      code: 'ARCHIVE_CORRUPT',
      severity: 'error',
      message: `Failed to unzip archive: ${err instanceof Error ? err.message : String(err)}`,
    });
    return buildReport(false, false, { targetVersion, dependencyPolicy, assetCollisionStrategy, diagnostics });
  }

  const entries = Object.keys(unzipped);

  // Check file count limit
  if (entries.length > limits.maxFileCount) {
    diagnostics.push({
      code: 'FILE_COUNT_EXCEEDED',
      severity: 'error',
      message: `Archive file count (${entries.length}) exceeds maximum limit of ${limits.maxFileCount}.`,
      details: { fileCount: entries.length, limit: limits.maxFileCount },
    });
  }

  // 3. Security checks: Zip-Slip and Total Uncompressed Size
  let totalUncompressedBytes = 0;
  for (const entryPath of entries) {
    // Check path safety
    if (isDangerousPath(entryPath)) {
      diagnostics.push({
        code: 'ZIP_SLIP_DETECTED',
        severity: 'error',
        message: `Security violation: Path traversal or Zip-Slip attempt detected in archive entry "${entryPath}".`,
        path: entryPath,
      });
    }

    const fileBytes = unzipped[entryPath];
    if (fileBytes) {
      totalUncompressedBytes += fileBytes.byteLength;

      // Check single asset size limit if in assets/
      if (entryPath.startsWith('assets/') && fileBytes.byteLength > limits.maxAssetSize) {
        diagnostics.push({
          code: 'ASSET_LIMIT_EXCEEDED',
          severity: 'error',
          message: `Asset "${entryPath}" size (${fileBytes.byteLength} bytes) exceeds maximum limit of ${limits.maxAssetSize} bytes.`,
          path: entryPath,
          details: { actualBytes: fileBytes.byteLength, limitBytes: limits.maxAssetSize },
        });
      }
    }
  }

  if (totalUncompressedBytes > limits.maxUncompressedSize) {
    diagnostics.push({
      code: 'SIZE_LIMIT_EXCEEDED',
      severity: 'error',
      message: `Total uncompressed archive size (${totalUncompressedBytes} bytes) exceeds maximum limit of ${limits.maxUncompressedSize} bytes.`,
      details: { actualBytes: totalUncompressedBytes, limitBytes: limits.maxUncompressedSize },
    });
  }

  // 4. Check Mandatory Files: manifest.json & page.json
  const manifestEntry = unzipped['manifest.json'];
  if (!manifestEntry) {
    diagnostics.push({
      code: 'MISSING_MANIFEST',
      severity: 'error',
      message: 'Archive is missing mandatory "manifest.json" file.',
    });
  }

  const pageEntry = unzipped['page.json'];
  if (!pageEntry) {
    diagnostics.push({
      code: 'MISSING_PAGE_DOCUMENT',
      severity: 'error',
      message: 'Archive is missing mandatory "page.json" file.',
    });
  }

  // If mandatory files missing or security violated, stop preflight early
  if (!manifestEntry || !pageEntry || diagnostics.some((d) => d.code === 'ZIP_SLIP_DETECTED')) {
    return buildReport(false, false, {
      targetVersion,
      dependencyPolicy,
      assetCollisionStrategy,
      totalUncompressedBytes,
      diagnostics,
    });
  }

  // 5. Parse & Validate Manifest
  let parsedManifest: Manifest | undefined;
  try {
    const manifestJson = JSON.parse(strFromU8(manifestEntry));
    const parseResult = ManifestSchema.safeParse(manifestJson);
    if (!parseResult.success) {
      const issues = parseResult.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join(', ');
      diagnostics.push({
        code: 'INVALID_MANIFEST',
        severity: 'error',
        message: `Manifest validation failed: ${issues}`,
        details: { issues: parseResult.error.issues },
      });
    } else {
      parsedManifest = parseResult.data;
    }
  } catch (err) {
    diagnostics.push({
      code: 'INVALID_MANIFEST',
      severity: 'error',
      message: `Failed to parse "manifest.json" as valid JSON: ${err instanceof Error ? err.message : String(err)}`,
    });
  }

  // 6. Parse Metadata (Optional metadata.json)
  let rawMetadata: DocumentMetadata | undefined;
  const metadataEntry = unzipped['metadata.json'];
  if (metadataEntry) {
    try {
      rawMetadata = JSON.parse(strFromU8(metadataEntry)) as DocumentMetadata;
    } catch {
      // Non-critical, fallback will use page.json metadata
    }
  }

  // 7. Parse & Inspect page.json
  let rawPageDoc: Record<string, unknown> | undefined;
  try {
    rawPageDoc = JSON.parse(strFromU8(pageEntry)) as Record<string, unknown>;
  } catch (err) {
    diagnostics.push({
      code: 'INVALID_PAGE_DOCUMENT',
      severity: 'error',
      message: `Failed to parse "page.json" as valid JSON: ${err instanceof Error ? err.message : String(err)}`,
    });
  }

  const docVersion = typeof rawPageDoc?.version === 'string'
    ? rawPageDoc.version
    : parsedManifest?.schemaVersion || 'unknown';

  let requiresMigration = false;
  let migrationPath: string[] | undefined;

  if (rawPageDoc) {
    if (docVersion !== targetVersion) {
      if (canMigrate(docVersion, targetVersion, migrationRegistry)) {
        requiresMigration = true;
        migrationPath = getMigrationPath(docVersion, targetVersion, migrationRegistry) || undefined;
        diagnostics.push({
          code: 'UNSUPPORTED_SCHEMA_VERSION',
          severity: 'info',
          message: `Document schema version "${docVersion}" requires migration to current version "${targetVersion}".`,
          details: { sourceVersion: docVersion, targetVersion, migrationPath },
        });
      } else {
        diagnostics.push({
          code: 'NO_MIGRATION_PATH',
          severity: 'error',
          message: `Document schema version "${docVersion}" is not compatible and no migration path exists to "${targetVersion}".`,
          details: { sourceVersion: docVersion, targetVersion },
        });
      }
    } else {
      // Validate current schema structure
      const docValidation = validateDocument(rawPageDoc, {
        componentRegistry: options.componentRegistry,
        knownComponentTypes: options.knownComponentTypes,
      });
      const criticalDocErrors = docValidation.errors.filter((e) => {
        if (e.code === 'UNKNOWN_COMPONENT_TYPE' && dependencyPolicy !== 'cancel') {
          return false;
        }
        return true;
      });
      if (criticalDocErrors.length > 0) {
        diagnostics.push({
          code: 'INVALID_PAGE_DOCUMENT',
          severity: 'error',
          message: `Document validation failed with ${criticalDocErrors.length} error(s):\n` +
            criticalDocErrors.map((e) => `[${e.code}] ${e.path}: ${e.message}`).join('\n'),
        });
      }
    }
  }

  // 8. Verify Asset Inventory & Checksums
  const missingComponents: string[] = [];
  const missingCapabilities: string[] = [];
  const assetConflicts: AssetConflict[] = [];

  // Build existing host assets set
  const existingAssetIdsSet = new Set<string>();
  if (options.existingAssetIds) {
    if (Array.isArray(options.existingAssetIds)) {
      for (const id of options.existingAssetIds) existingAssetIdsSet.add(id);
    } else if (options.existingAssetIds instanceof Set) {
      for (const id of options.existingAssetIds) existingAssetIdsSet.add(id);
    }
  }

  // Check host assetProvider list if available and existingAssetIds not given
  if (options.assetProvider?.list && !options.existingAssetIds) {
    try {
      const list = await options.assetProvider.list();
      if (Array.isArray(list)) {
        for (const item of list) {
          if (item?.id) existingAssetIdsSet.add(item.id);
        }
      }
    } catch {
      // Non-fatal
    }
  }

  if (parsedManifest) {
    for (const assetItem of parsedManifest.assets) {
      // Validate asset path in archive
      const assetFile = unzipped[assetItem.path];
      if (!assetFile) {
        diagnostics.push({
          code: 'ASSET_FILE_MISSING',
          severity: 'error',
          message: `Declared asset "${assetItem.id}" is missing in archive at path "${assetItem.path}".`,
          path: assetItem.path,
          details: { assetId: assetItem.id },
        });
        continue;
      }

      // Validate size
      if (assetFile.byteLength !== assetItem.size) {
        diagnostics.push({
          code: 'ASSET_SIZE_MISMATCH',
          severity: 'error',
          message: `Asset "${assetItem.id}" size mismatch: expected ${assetItem.size} bytes, found ${assetFile.byteLength} bytes.`,
          path: assetItem.path,
          details: { assetId: assetItem.id, expected: assetItem.size, actual: assetFile.byteLength },
        });
      }

      // Validate checksum if provided
      if (assetItem.checksum) {
        const actualChecksum = await calculateChecksum(assetFile);
        if (actualChecksum !== assetItem.checksum) {
          diagnostics.push({
            code: 'ASSET_CHECKSUM_MISMATCH',
            severity: 'error',
            message: `Asset "${assetItem.id}" checksum mismatch: expected ${assetItem.checksum}, calculated ${actualChecksum}.`,
            path: assetItem.path,
            details: { assetId: assetItem.id, expected: assetItem.checksum, actual: actualChecksum },
          });
        }
      }

      // Check collision with host assets
      let isConflict = false;
      if (typeof options.existingAssetIds === 'function') {
        const fnRes = await options.existingAssetIds(assetItem.id);
        if (fnRes) isConflict = true;
      } else if (existingAssetIdsSet.has(assetItem.id)) {
        isConflict = true;
      }

      if (isConflict) {
        assetConflicts.push({
          assetId: assetItem.id,
          path: assetItem.path,
          mimeType: assetItem.mimeType,
          size: assetItem.size,
        });
      }
    }

    // Report Asset Collision diagnostics
    if (assetConflicts.length > 0) {
      const conflictIds = assetConflicts.map((c) => c.assetId).join(', ');
      if (assetCollisionStrategy === 'reject' && !options.onAssetConflict) {
        diagnostics.push({
          code: 'ASSET_CONFLICT',
          severity: 'error',
          message: `Asset collision detected for asset(s): ${conflictIds}. Host assets will not be overwritten without an explicit assetCollisionStrategy.`,
          details: { assetConflicts, strategy: assetCollisionStrategy },
        });
      } else {
        diagnostics.push({
          code: 'ASSET_CONFLICT',
          severity: 'info',
          message: `Asset collision detected for asset(s): ${conflictIds}. Strategy "${assetCollisionStrategy}" will be applied on import.`,
          details: { assetConflicts, strategy: assetCollisionStrategy },
        });
      }
    }

    // 9. Component Requirements Check
    const knownSet = new Set<string>();
    if (options.knownComponentTypes) {
      for (const t of options.knownComponentTypes) knownSet.add(t);
    }
    // Add standard built-ins
    const builtIns = ['page', 'section', 'container', 'columns', 'heading', 'text', 'image', 'button', 'collection'];
    for (const b of builtIns) knownSet.add(b);

    for (const compType of parsedManifest.requiredComponents) {
      let isSupported = knownSet.has(compType);
      if (!isSupported && options.componentRegistry) {
        isSupported = options.componentRegistry.has(compType);
      }
      if (!isSupported) {
        missingComponents.push(compType);
      }
    }

    if (missingComponents.length > 0) {
      if (dependencyPolicy === 'cancel' && !options.allowMissingComponents) {
        diagnostics.push({
          code: 'MISSING_COMPONENTS',
          severity: 'error',
          message: `Package requires custom component(s) not registered in host: ${missingComponents.join(', ')}.`,
          details: { missingComponents, policy: dependencyPolicy },
        });
      } else if (dependencyPolicy === 'import-with-placeholder' || options.allowMissingComponents) {
        diagnostics.push({
          code: 'MISSING_COMPONENTS',
          severity: 'warning',
          message: `Package requires custom component(s) [${missingComponents.join(', ')}] not registered in host. Nodes and props are preserved intact for placeholder rendering.`,
          details: { missingComponents, policy: dependencyPolicy },
        });
      } else if (dependencyPolicy === 'install-or-register-before-import') {
        diagnostics.push({
          code: 'MISSING_COMPONENTS',
          severity: 'info',
          message: `Package requires custom component(s) [${missingComponents.join(', ')}]. Installation/registration required before import.`,
          details: { missingComponents, policy: dependencyPolicy },
        });
      }
    }

    // 10. Capability Requirements Check
    const supportedCaps = new Set<string>();
    if (options.supportedCapabilities) {
      for (const c of options.supportedCapabilities) supportedCaps.add(c);
    }

    for (const cap of parsedManifest.requiredCapabilities) {
      if (!supportedCaps.has(cap)) {
        missingCapabilities.push(cap);
      }
    }

    if (missingCapabilities.length > 0) {
      if (dependencyPolicy === 'cancel' && !options.allowMissingCapabilities) {
        diagnostics.push({
          code: 'MISSING_CAPABILITIES',
          severity: 'error',
          message: `Package requires capability/capabilities not supported by host: ${missingCapabilities.join(', ')}.`,
          details: { missingCapabilities, policy: dependencyPolicy },
        });
      } else if (dependencyPolicy === 'import-with-placeholder' || options.allowMissingCapabilities) {
        diagnostics.push({
          code: 'MISSING_CAPABILITIES',
          severity: 'warning',
          message: `Package requires capability/capabilities [${missingCapabilities.join(', ')}] not supported by host. Placeholder rendering enabled.`,
          details: { missingCapabilities, policy: dependencyPolicy },
        });
      } else if (dependencyPolicy === 'install-or-register-before-import') {
        diagnostics.push({
          code: 'MISSING_CAPABILITIES',
          severity: 'info',
          message: `Package requires capability/capabilities [${missingCapabilities.join(', ')}]. Registration required before import.`,
          details: { missingCapabilities, policy: dependencyPolicy },
        });
      }
    }
  }

  const hasErrors = diagnostics.some((d) => d.severity === 'error');
  const valid = !hasErrors;
  const canImport = valid;

  return buildReport(valid, canImport, {
    manifest: parsedManifest,
    rawMetadata,
    sourceVersion: docVersion,
    targetVersion,
    requiresMigration,
    migrationPath,
    missingComponents,
    missingCapabilities,
    dependencyPolicy,
    assetCount: parsedManifest?.assets.length || 0,
    assetConflicts,
    assetCollisionStrategy,
    totalUncompressedBytes,
    diagnostics,
  });
}

function buildReport(
  valid: boolean,
  canImport: boolean,
  fields: Partial<PreflightReport>,
): PreflightReport {
  return {
    valid,
    canImport,
    targetVersion: fields.targetVersion || CURRENT_SCHEMA_VERSION,
    requiresMigration: fields.requiresMigration || false,
    missingComponents: fields.missingComponents || [],
    missingCapabilities: fields.missingCapabilities || [],
    dependencyPolicy: fields.dependencyPolicy || 'cancel',
    assetCount: fields.assetCount || 0,
    assetConflicts: fields.assetConflicts || [],
    assetCollisionStrategy: fields.assetCollisionStrategy || 'reject',
    totalUncompressedBytes: fields.totalUncompressedBytes || 0,
    diagnostics: fields.diagnostics || [],
    ...fields,
  };
}

/**
 * Preview a .stora package without mutating host state.
 * Returns missing dependencies, asset conflicts, schema migration status, and diagnostics.
 */
export const previewImportPackage = preflightPackage;

/**
 * Alias for preflightPackage.
 */
export const inspectPackage = preflightPackage;

/**
 * Default generator for renaming colliding asset IDs.
 */
export function defaultRenameAssetStrategy(
  incoming: ManifestAssetItem,
  existingIds: Set<string>,
): string {
  let candidate = `${incoming.id}_imported`;
  let counter = 1;
  while (existingIds.has(candidate)) {
    candidate = `${incoming.id}_imported_${counter}`;
    counter++;
  }
  return candidate;
}

/**
 * Imports a .stora package with preflight safety checks, schema migration, missing dependency policy,
 * and host-controlled asset collision handling.
 */
export async function importPackage(
  archiveData: Uint8Array | ArrayBuffer,
  options: ImportPackageOptions = {},
): Promise<ImportPackageResult> {
  // 1. Run Preflight Inspection first
  let preflight = await preflightPackage(archiveData, options);

  // 2. Handle 'install-or-register-before-import' policy hook
  const dependencyPolicy = options.dependencyPolicy || preflight.dependencyPolicy;
  if (
    dependencyPolicy === 'install-or-register-before-import' &&
    (preflight.missingComponents.length > 0 || preflight.missingCapabilities.length > 0) &&
    options.onMissingDependency
  ) {
    try {
      await options.onMissingDependency(
        {
          components: [...preflight.missingComponents],
          capabilities: [...preflight.missingCapabilities],
        },
        preflight,
      );

      // Re-run preflight after hook execution
      preflight = await preflightPackage(archiveData, {
        ...options,
        dependencyPolicy: 'cancel', // Strict check after install attempt
      });
    } catch (err) {
      const diag: PreflightDiagnostic = {
        code: 'HOST_ADAPTER_ERROR',
        severity: 'error',
        message: `Dynamic dependency registration failed: ${err instanceof Error ? err.message : String(err)}`,
      };
      return {
        success: false,
        errors: [diag],
        diagnosticMessage: diag.message,
        preflight,
      };
    }
  }

  if (!preflight.canImport || !preflight.manifest) {
    const errorDiagnostics = preflight.diagnostics.filter((d) => d.severity === 'error');
    const diagnosticMessage = `Package import rejected with ${errorDiagnostics.length} error(s):\n` +
      errorDiagnostics.map((d) => `[${d.code}] ${d.path ? d.path + ': ' : ''}${d.message}`).join('\n');

    return {
      success: false,
      errors: errorDiagnostics,
      diagnosticMessage,
      preflight,
    };
  }

  const archiveBytes = archiveData instanceof Uint8Array ? archiveData : new Uint8Array(archiveData);
  const unzipped = unzipSync(archiveBytes);

  // 3. Read and Migrate Page Document
  const pageRaw = JSON.parse(strFromU8(unzipped['page.json']));
  let finalDocument: PageDocument;

  if (preflight.requiresMigration) {
    const migrationRegistry = options.migrationRegistry || defaultMigrationRegistry;
    const migrationRes = migrateDocument(pageRaw, {
      targetVersion: options.targetSchemaVersion || CURRENT_SCHEMA_VERSION,
      registry: migrationRegistry,
      validate: true,
    });

    if (!migrationRes.success || !migrationRes.document) {
      const err: PreflightDiagnostic = {
        code: 'MIGRATION_FAILED',
        severity: 'error',
        message: `Failed to migrate document from "${preflight.sourceVersion}" to "${preflight.targetVersion}".`,
        details: { diagnostic: migrationRes.diagnostic },
      };
      return {
        success: false,
        errors: [err],
        diagnosticMessage: err.message,
        preflight,
      };
    }

    finalDocument = migrationRes.document;
  } else {
    finalDocument = pageRaw as PageDocument;
  }

  // 4. Extract and Merge Metadata
  let metadata: DocumentMetadata = finalDocument.metadata || {
    title: 'Imported Page',
    description: '',
    author: '',
    tags: [],
    category: 'general',
    version: finalDocument.version || CURRENT_SCHEMA_VERSION,
  };

  if (unzipped['metadata.json']) {
    try {
      const metaFromFile = JSON.parse(strFromU8(unzipped['metadata.json'])) as DocumentMetadata;
      metadata = {
        ...metadata,
        ...metaFromFile,
      };
    } catch {
      // Use document metadata
    }
  }

  finalDocument.metadata = metadata;

  // 5. Build existing host assets set
  const existingAssetIdsSet = new Set<string>();
  if (options.existingAssetIds) {
    if (Array.isArray(options.existingAssetIds)) {
      for (const id of options.existingAssetIds) existingAssetIdsSet.add(id);
    } else if (options.existingAssetIds instanceof Set) {
      for (const id of options.existingAssetIds) existingAssetIdsSet.add(id);
    }
  }

  if (options.assetProvider?.list && !options.existingAssetIds) {
    try {
      const list = await options.assetProvider.list();
      if (Array.isArray(list)) {
        for (const item of list) {
          if (item?.id) existingAssetIdsSet.add(item.id);
        }
      }
    } catch {
      // Non-fatal
    }
  }

  const renameAssetFn = options.renameAssetStrategy || defaultRenameAssetStrategy;
  const renameMap: Record<string, string> = {};
  const extractedAssets = new Map<string, ExtractedAsset>();

  // 6. Extract Assets with Host-Controlled Collision Resolution
  for (const assetItem of preflight.manifest.assets) {
    const assetBytes = unzipped[assetItem.path];
    if (assetBytes) {
      let targetAssetId = assetItem.id;
      let effectiveStrategy: AssetCollisionStrategy = options.assetCollisionStrategy || 'reject';

      const conflictInfo = preflight.assetConflicts.find((c) => c.assetId === assetItem.id);

      if (conflictInfo) {
        if (options.onAssetConflict) {
          try {
            const conflictRes = await options.onAssetConflict(conflictInfo);
            if (typeof conflictRes === 'string') {
              effectiveStrategy = conflictRes;
            } else {
              effectiveStrategy = conflictRes.action;
              if (conflictRes.newAssetId) {
                targetAssetId = conflictRes.newAssetId;
              }
            }
          } catch (err) {
            const diag: PreflightDiagnostic = {
              code: 'HOST_ADAPTER_ERROR',
              severity: 'error',
              message: `Asset conflict resolution handler failed for "${assetItem.id}": ${err instanceof Error ? err.message : String(err)}`,
              path: assetItem.path,
            };
            return {
              success: false,
              errors: [diag],
              diagnosticMessage: diag.message,
              preflight,
            };
          }
        }

        if (effectiveStrategy === 'reject') {
          const diag: PreflightDiagnostic = {
            code: 'ASSET_CONFLICT',
            severity: 'error',
            message: `Import aborted: Asset "${assetItem.id}" collides with host asset. No overwrite strategy specified.`,
            path: assetItem.path,
          };
          return {
            success: false,
            errors: [diag],
            diagnosticMessage: diag.message,
            preflight,
          };
        }

        if (effectiveStrategy === 'rename') {
          if (targetAssetId === assetItem.id) {
            targetAssetId = renameAssetFn(assetItem, existingAssetIdsSet);
          }
          renameMap[assetItem.id] = targetAssetId;
          existingAssetIdsSet.add(targetAssetId);
        }
      }

      let hostInfo: AssetInfo | string | undefined;

      if (effectiveStrategy === 'reuse-existing' && conflictInfo) {
        // Reuse existing asset: skip binary upload and resolve from host provider
        if (options.assetProvider?.resolve) {
          hostInfo = await options.assetProvider.resolve(targetAssetId);
        }
      } else {
        // Upload or pass to onAssetImport hook
        const effectiveMeta: ManifestAssetItem = {
          ...assetItem,
          id: targetAssetId,
        };

        if (options.onAssetImport) {
          try {
            const result = await options.onAssetImport(targetAssetId, assetBytes, effectiveMeta);
            if (result) hostInfo = result;
          } catch (err) {
            const diag: PreflightDiagnostic = {
              code: 'HOST_ADAPTER_ERROR',
              severity: 'error',
              message: `Host asset import hook failed for "${targetAssetId}": ${err instanceof Error ? err.message : String(err)}`,
              path: assetItem.path,
            };
            return {
              success: false,
              errors: [diag],
              diagnosticMessage: diag.message,
              preflight,
            };
          }
        } else if (options.assetProvider?.upload) {
          try {
            const blob = new Blob([assetBytes], { type: assetItem.mimeType });
            const filename = assetItem.path.replace(/^assets\//, '');
            const file = new File([blob], filename, { type: assetItem.mimeType });
            const info = await options.assetProvider.upload(file, {
              assetId: targetAssetId,
              originalAssetId: assetItem.id,
            });
            if (info) hostInfo = info;
          } catch {
            // Non-fatal if upload not strictly required
          }
        }
      }

      extractedAssets.set(targetAssetId, {
        bytes: assetBytes,
        meta: {
          ...assetItem,
          id: targetAssetId,
        },
        hostInfo,
      });
    }
  }

  // 7. Remap Asset References in Document if Any Assets Were Renamed
  if (Object.keys(renameMap).length > 0) {
    remapDocumentAssetReferences(finalDocument, renameMap);
  }

  return {
    success: true,
    document: finalDocument,
    manifest: preflight.manifest,
    metadata,
    extractedAssets,
    renamedAssets: Object.keys(renameMap).length > 0 ? renameMap : undefined,
    preflight,
  };
}

/**
 * Alias for importPackage.
 */
export const importStoraPackage = importPackage;
