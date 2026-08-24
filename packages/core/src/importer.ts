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
   * If true, missing components are treated as warnings rather than blocking errors.
   */
  allowMissingComponents?: boolean;

  /**
   * If true, missing capabilities are treated as warnings rather than blocking errors.
   */
  allowMissingCapabilities?: boolean;
}

export interface PreflightReport {
  /**
   * True if archive is completely safe and syntactically valid.
   */
  valid: boolean;

  /**
   * True if archive can be safely imported given the host's supported components/capabilities.
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
   * Number of valid local assets declared in manifest.
   */
  assetCount: number;

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
   * Host AssetProvider to optionally upload extracted local assets.
   */
  assetProvider?: AssetProvider;

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

  const archiveBytes = archiveData instanceof Uint8Array ? archiveData : new Uint8Array(archiveData);

  // 1. Check archive size limit
  if (!archiveBytes || archiveBytes.byteLength === 0) {
    diagnostics.push({
      code: 'ARCHIVE_EMPTY',
      severity: 'error',
      message: 'Archive is empty or 0 bytes.',
    });
    return buildReport(false, false, { targetVersion, diagnostics });
  }

  if (archiveBytes.byteLength > limits.maxArchiveSize) {
    diagnostics.push({
      code: 'SIZE_LIMIT_EXCEEDED',
      severity: 'error',
      message: `Archive size (${archiveBytes.byteLength} bytes) exceeds maximum limit of ${limits.maxArchiveSize} bytes.`,
      details: { actualBytes: archiveBytes.byteLength, limitBytes: limits.maxArchiveSize },
    });
    return buildReport(false, false, { targetVersion, diagnostics });
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
    return buildReport(false, false, { targetVersion, diagnostics });
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
      if (!docValidation.valid) {
        diagnostics.push({
          code: 'INVALID_PAGE_DOCUMENT',
          severity: 'error',
          message: `Document validation failed with ${docValidation.errors.length} error(s):\n` +
            docValidation.errors.map((e) => `[${e.code}] ${e.path}: ${e.message}`).join('\n'),
        });
      }
    }
  }

  // 8. Verify Asset Inventory & Checksums
  const missingComponents: string[] = [];
  const missingCapabilities: string[] = [];

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
      const severity = options.allowMissingComponents ? 'warning' : 'error';
      diagnostics.push({
        code: 'MISSING_COMPONENTS',
        severity,
        message: `Package requires custom component(s) not registered in host: ${missingComponents.join(', ')}.`,
        details: { missingComponents },
      });
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
      const severity = options.allowMissingCapabilities ? 'warning' : 'error';
      diagnostics.push({
        code: 'MISSING_CAPABILITIES',
        severity,
        message: `Package requires capability/capabilities not supported by host: ${missingCapabilities.join(', ')}.`,
        details: { missingCapabilities },
      });
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
    assetCount: parsedManifest?.assets.length || 0,
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
    assetCount: fields.assetCount || 0,
    totalUncompressedBytes: fields.totalUncompressedBytes || 0,
    diagnostics: fields.diagnostics || [],
    ...fields,
  };
}

/**
 * Alias for preflightPackage.
 */
export const inspectPackage = preflightPackage;

/**
 * Imports a .stora package with preflight safety checks, schema migration, and host adapter asset extraction.
 */
export async function importPackage(
  archiveData: Uint8Array | ArrayBuffer,
  options: ImportPackageOptions = {},
): Promise<ImportPackageResult> {
  // 1. Run Preflight Inspection first
  const preflight = await preflightPackage(archiveData, options);

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

  // 2. Read and Migrate Page Document
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

  // 3. Extract and Merge Metadata
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

  // 4. Extract Assets and Pass to Host Adapter
  const extractedAssets = new Map<string, ExtractedAsset>();

  for (const assetItem of preflight.manifest.assets) {
    const assetBytes = unzipped[assetItem.path];
    if (assetBytes) {
      let hostInfo: AssetInfo | string | undefined;

      // Check custom onAssetImport hook
      if (options.onAssetImport) {
        try {
          const result = await options.onAssetImport(assetItem.id, assetBytes, assetItem);
          if (result) hostInfo = result;
        } catch (err) {
          const diag: PreflightDiagnostic = {
            code: 'HOST_ADAPTER_ERROR',
            severity: 'error',
            message: `Host asset import hook failed for "${assetItem.id}": ${err instanceof Error ? err.message : String(err)}`,
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
      // Or check assetProvider upload
      else if (options.assetProvider?.upload) {
        try {
          const blob = new Blob([assetBytes], { type: assetItem.mimeType });
          const filename = assetItem.path.replace(/^assets\//, '');
          const file = new File([blob], filename, { type: assetItem.mimeType });
          const info = await options.assetProvider.upload(file, { assetId: assetItem.id });
          if (info) hostInfo = info;
        } catch {
          // Non-fatal if upload not strictly required
        }
      }

      extractedAssets.set(assetItem.id, {
        bytes: assetBytes,
        meta: assetItem,
        hostInfo,
      });
    }
  }

  return {
    success: true,
    document: finalDocument,
    manifest: preflight.manifest,
    metadata,
    extractedAssets,
    preflight,
  };
}

/**
 * Alias for importPackage.
 */
export const importStoraPackage = importPackage;
