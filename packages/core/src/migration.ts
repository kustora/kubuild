import {
  PageDocument,
  PageDocumentSchema,
  CURRENT_SCHEMA_VERSION,
  SCHEMA_NAME,
  ResponsiveStyles,
} from '@kubuild/schema';
import { deepClone } from './command-tree-utils';
import { validateDocument } from './validator';

export type MigrationErrorCode =
  | 'NO_MIGRATION_PATH'
  | 'UNSUPPORTED_SCHEMA_VERSION'
  | 'INVALID_SOURCE_DOCUMENT'
  | 'MIGRATION_EXECUTION_FAILED';

export interface MigrationError {
  code: MigrationErrorCode;
  message: string;
  sourceVersion: string;
  targetVersion: string;
  details?: Record<string, unknown>;
}

export interface MigrationDiagnostic {
  success: boolean;
  sourceVersion: string;
  targetVersion: string;
  migrationPath: string[];
  stepsApplied: number;
  dryRun: boolean;
  errors?: MigrationError[];
}

export interface MigrationResult {
  success: boolean;
  document?: PageDocument;
  diagnostic: MigrationDiagnostic;
}

export interface MigrateOptions {
  /**
   * Target schema version (defaults to CURRENT_SCHEMA_VERSION = "1.0.0").
   */
  targetVersion?: string;
  /**
   * If true, validates path and simulates migration without modifying production data.
   */
  dryRun?: boolean;
  /**
   * Custom migration registry (defaults to defaultMigrationRegistry).
   */
  registry?: MigrationRegistry;
  /**
   * Validate document with schema validator after migration (default: true).
   */
  validate?: boolean;
}

export type MigrationFunction = (rawDoc: Record<string, unknown>) => Record<string, unknown>;

export interface MigrationStep {
  fromVersion: string;
  toVersion: string;
  migrate: MigrationFunction;
  description?: string;
}

/**
 * Migration Registry to manage version transition steps.
 */
export class MigrationRegistry {
  private steps: Map<string, MigrationStep> = new Map();

  /**
   * Register a migration step from one version to another.
   */
  register(step: MigrationStep): void {
    const key = this.getKey(step.fromVersion, step.toVersion);
    this.steps.set(key, step);
  }

  private getKey(fromVersion: string, toVersion: string): string {
    return `${fromVersion}->${toVersion}`;
  }

  /**
   * Find shortest path of versions to migrate from source to target using BFS.
   */
  findPath(sourceVersion: string, targetVersion: string): string[] | null {
    if (sourceVersion === targetVersion) {
      return [sourceVersion];
    }

    const queue: { version: string; path: string[] }[] = [
      { version: sourceVersion, path: [sourceVersion] },
    ];
    const visited = new Set<string>([sourceVersion]);

    while (queue.length > 0) {
      const { version: currentVersion, path } = queue.shift()!;

      for (const step of this.steps.values()) {
        if (step.fromVersion === currentVersion) {
          const nextVersion = step.toVersion;
          if (nextVersion === targetVersion) {
            return [...path, nextVersion];
          }

          if (!visited.has(nextVersion)) {
            visited.add(nextVersion);
            queue.push({ version: nextVersion, path: [...path, nextVersion] });
          }
        }
      }
    }

    return null;
  }

  /**
   * Check if a valid migration path exists between source and target versions.
   */
  hasPath(sourceVersion: string, targetVersion: string): boolean {
    return this.findPath(sourceVersion, targetVersion) !== null;
  }

  /**
   * Get the migration step handler for a direct version step.
   */
  getStep(fromVersion: string, toVersion: string): MigrationStep | undefined {
    return this.steps.get(this.getKey(fromVersion, toVersion));
  }
}

/**
 * Helper to recursively migrate legacy flat styles: { color: 'red' } to responsive: { base: { color: 'red' } }
 */
function convertNodeStylesToResponsive(node: Record<string, unknown>): void {
  if (node.styles && typeof node.styles === 'object' && !Array.isArray(node.styles)) {
    const styles = node.styles as Record<string, unknown>;
    const hasBreakpointKeys = 'base' in styles || 'desktop' in styles || 'tablet' in styles || 'mobile' in styles;
    if (!hasBreakpointKeys) {
      node.styles = {
        base: { ...styles },
      } as ResponsiveStyles;
    }
  }

  if (Array.isArray(node.children)) {
    for (const child of node.children) {
      if (child && typeof child === 'object') {
        convertNodeStylesToResponsive(child as Record<string, unknown>);
      }
    }
  }
}

// Built-in Default Registry
export const defaultMigrationRegistry = new MigrationRegistry();

// 1. Migration from 0.1.0 -> 1.0.0 (Alpha to v1)
defaultMigrationRegistry.register({
  fromVersion: '0.1.0',
  toVersion: '1.0.0',
  description: 'Migrate alpha 0.1.0 schema (root node key, flat styles) to v1.0.0',
  migrate: (rawDoc: Record<string, unknown>) => {
    const migrated = deepClone(rawDoc);
    migrated.schema = SCHEMA_NAME;
    migrated.version = '1.0.0';

    // Migrate root node key: legacy used 'root' instead of 'document'
    if (migrated.root && !migrated.document) {
      migrated.document = migrated.root;
      delete migrated.root;
    }

    // Default metadata
    if (!migrated.metadata || typeof migrated.metadata !== 'object') {
      migrated.metadata = {
        title: 'Migrated Page',
        description: '',
        author: '',
        tags: [],
        category: 'general',
        version: '1.0.0',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
    } else {
      const meta = migrated.metadata as Record<string, unknown>;
      meta.title = meta.title || 'Migrated Page';
      meta.tags = Array.isArray(meta.tags) ? meta.tags : [];
      meta.version = '1.0.0';
    }

    // Migrate node tree flat styles
    if (migrated.document && typeof migrated.document === 'object') {
      convertNodeStylesToResponsive(migrated.document as Record<string, unknown>);
    }

    return migrated;
  },
});

// 2. Migration from 0.2.0 -> 1.0.0
defaultMigrationRegistry.register({
  fromVersion: '0.2.0',
  toVersion: '1.0.0',
  description: 'Migrate 0.2.0 schema to v1.0.0',
  migrate: (rawDoc: Record<string, unknown>) => {
    const migrated = deepClone(rawDoc);
    migrated.schema = SCHEMA_NAME;
    migrated.version = '1.0.0';

    if (migrated.document && typeof migrated.document === 'object') {
      convertNodeStylesToResponsive(migrated.document as Record<string, unknown>);
    }

    return migrated;
  },
});

// 3. Migration from 0.9.0 -> 1.0.0 (Beta to v1)
defaultMigrationRegistry.register({
  fromVersion: '0.9.0',
  toVersion: '1.0.0',
  description: 'Migrate 0.9.0 beta schema to v1.0.0',
  migrate: (rawDoc: Record<string, unknown>) => {
    const migrated = deepClone(rawDoc);
    migrated.schema = SCHEMA_NAME;
    migrated.version = '1.0.0';

    if (!migrated.metadata || typeof migrated.metadata !== 'object') {
      migrated.metadata = {
        title: 'Migrated Page',
        description: '',
        author: '',
        tags: [],
        category: 'general',
        version: '1.0.0',
      };
    }

    return migrated;
  },
});

// 4. Shorthand "1.0" -> "1.0.0"
defaultMigrationRegistry.register({
  fromVersion: '1.0',
  toVersion: '1.0.0',
  description: 'Normalize 1.0 version string to 1.0.0',
  migrate: (rawDoc: Record<string, unknown>) => {
    const migrated = deepClone(rawDoc);
    migrated.version = '1.0.0';
    return migrated;
  },
});

/**
 * Check whether a migration path exists between source and target versions.
 */
export function canMigrate(
  sourceVersion: string,
  targetVersion: string = CURRENT_SCHEMA_VERSION,
  registry: MigrationRegistry = defaultMigrationRegistry,
): boolean {
  if (!sourceVersion || !targetVersion) return false;
  if (sourceVersion === targetVersion) return true;
  return registry.hasPath(sourceVersion, targetVersion);
}

/**
 * Get the sequence of versions forming the migration path.
 */
export function getMigrationPath(
  sourceVersion: string,
  targetVersion: string = CURRENT_SCHEMA_VERSION,
  registry: MigrationRegistry = defaultMigrationRegistry,
): string[] | null {
  if (!sourceVersion || !targetVersion) return null;
  return registry.findPath(sourceVersion, targetVersion);
}

/**
 * Migrate a page document from an older schema version to current (or specified) schema version.
 * Supports dry-run execution, step diagnostics, and structured error reporting.
 */
export function migrateDocument(
  rawDocument: unknown,
  options: MigrateOptions = {},
): MigrationResult {
  const targetVersion = options.targetVersion ?? CURRENT_SCHEMA_VERSION;
  const dryRun = options.dryRun ?? false;
  const registry = options.registry ?? defaultMigrationRegistry;
  const validate = options.validate ?? true;

  // 1. Basic object validation
  if (!rawDocument || typeof rawDocument !== 'object' || Array.isArray(rawDocument)) {
    const error: MigrationError = {
      code: 'INVALID_SOURCE_DOCUMENT',
      message: 'Source document must be a non-null object.',
      sourceVersion: 'unknown',
      targetVersion,
    };
    return {
      success: false,
      diagnostic: {
        success: false,
        sourceVersion: 'unknown',
        targetVersion,
        migrationPath: [],
        stepsApplied: 0,
        dryRun,
        errors: [error],
      },
    };
  }

  const doc = rawDocument as Record<string, unknown>;
  const sourceVersion = typeof doc.version === 'string' ? doc.version.trim() : 'unknown';

  // 2. If already on target version
  if (sourceVersion === targetVersion) {
    const cloned = deepClone(doc) as unknown as PageDocument;
    if (validate) {
      const validation = validateDocument(cloned);
      if (!validation.valid) {
        return {
          success: false,
          diagnostic: {
            success: false,
            sourceVersion,
            targetVersion,
            migrationPath: [sourceVersion],
            stepsApplied: 0,
            dryRun,
            errors: validation.errors.map((e) => ({
              code: 'INVALID_SOURCE_DOCUMENT',
              message: `Validation error: ${e.message} at ${e.path}`,
              sourceVersion,
              targetVersion,
            })),
          },
        };
      }
    }

    return {
      success: true,
      document: cloned,
      diagnostic: {
        success: true,
        sourceVersion,
        targetVersion,
        migrationPath: [sourceVersion],
        stepsApplied: 0,
        dryRun,
      },
    };
  }

  // 3. Find migration path
  const path = registry.findPath(sourceVersion, targetVersion);
  if (!path || path.length <= 1) {
    const error: MigrationError = {
      code: 'NO_MIGRATION_PATH',
      message: `No migration path found from schema version "${sourceVersion}" to "${targetVersion}".`,
      sourceVersion,
      targetVersion,
    };
    return {
      success: false,
      diagnostic: {
        success: false,
        sourceVersion,
        targetVersion,
        migrationPath: [],
        stepsApplied: 0,
        dryRun,
        errors: [error],
      },
    };
  }

  // 4. If dry-run mode, return simulation success without modifying
  if (dryRun) {
    return {
      success: true,
      diagnostic: {
        success: true,
        sourceVersion,
        targetVersion,
        migrationPath: path,
        stepsApplied: path.length - 1,
        dryRun: true,
      },
    };
  }

  // 5. Execute migration path steps sequentially
  let currentDoc = deepClone(doc);
  let stepsApplied = 0;

  for (let i = 0; i < path.length - 1; i++) {
    const fromVer = path[i];
    const toVer = path[i + 1];
    const step = registry.getStep(fromVer, toVer);

    if (!step) {
      const error: MigrationError = {
        code: 'MIGRATION_EXECUTION_FAILED',
        message: `Registered migration step for "${fromVer}" -> "${toVer}" is missing executor.`,
        sourceVersion,
        targetVersion,
      };
      return {
        success: false,
        diagnostic: {
          success: false,
          sourceVersion,
          targetVersion,
          migrationPath: path,
          stepsApplied,
          dryRun,
          errors: [error],
        },
      };
    }

    try {
      currentDoc = step.migrate(currentDoc);
      stepsApplied++;
    } catch (err: unknown) {
      const error: MigrationError = {
        code: 'MIGRATION_EXECUTION_FAILED',
        message: `Failed executing migration step from "${fromVer}" to "${toVer}": ${err instanceof Error ? err.message : String(err)}`,
        sourceVersion,
        targetVersion,
        details: { stepFrom: fromVer, stepTo: toVer },
      };
      return {
        success: false,
        diagnostic: {
          success: false,
          sourceVersion,
          targetVersion,
          migrationPath: path,
          stepsApplied,
          dryRun,
          errors: [error],
        },
      };
    }
  }

  // 6. Validate final migrated document
  const finalDoc = currentDoc as unknown as PageDocument;
  if (validate) {
    const validation = validateDocument(finalDoc);
    if (!validation.valid) {
      return {
        success: false,
        diagnostic: {
          success: false,
          sourceVersion,
          targetVersion,
          migrationPath: path,
          stepsApplied,
          dryRun,
          errors: validation.errors.map((e) => ({
            code: 'MIGRATION_EXECUTION_FAILED',
            message: `Post-migration validation error: ${e.message} at ${e.path}`,
            sourceVersion,
            targetVersion,
          })),
        },
      };
    }
  }

  return {
    success: true,
    document: finalDoc,
    diagnostic: {
      success: true,
      sourceVersion,
      targetVersion,
      migrationPath: path,
      stepsApplied,
      dryRun: false,
    },
  };
}
