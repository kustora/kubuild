import {
  Artboard,
  PageDocument,
  ProjectDocument,
  ProjectDocumentSchema,
  PROJECT_SCHEMA_NAME,
  CURRENT_PROJECT_SCHEMA_VERSION,
  CURRENT_SCHEMA_VERSION,
  looksLikeProjectDocument,
} from '@kubuild/schema';
import { canMigrate, migrateDocument, MigrationError } from './migration';

/**
 * Brings every artboard's embedded page document up to the current page schema version
 * (e.g. canonical text prop names, STORA-550). Best-effort: an artboard whose migration
 * fails is left untouched rather than failing the whole project load.
 */
function migrateProjectArtboards(project: ProjectDocument): ProjectDocument {
  let changed = false;
  const artboards = project.artboards.map((artboard) => {
    const version = artboard.document.version;
    if (version === CURRENT_SCHEMA_VERSION || !canMigrate(version)) return artboard;
    const migration = migrateDocument(artboard.document);
    if (!migration.success || !migration.document) return artboard;
    changed = true;
    return { ...artboard, document: migration.document };
  });
  return changed ? { ...project, artboards } : project;
}

export type ProjectLoadErrorCode =
  | 'INVALID_SOURCE'
  | 'PROJECT_SCHEMA_INVALID'
  | 'LEGACY_MIGRATION_FAILED';

export interface ProjectLoadError {
  code: ProjectLoadErrorCode;
  message: string;
  details?: Record<string, unknown>;
}

export interface ProjectLoadResult {
  success: boolean;
  project?: ProjectDocument;
  /** True when the payload arrived as a legacy single-page document and was wrapped. */
  wrappedFromLegacyPage: boolean;
  errors: ProjectLoadError[];
}

export interface WrapPageAsProjectOptions {
  artboardId?: string;
  name?: string;
  slug?: string;
  width?: number;
}

const DEFAULT_PAGE_ARTBOARD_ID = 'artboard-page-1';

/**
 * Wrap a single PageDocument into a one-artboard ProjectDocument.
 * Used both by the legacy load path and by consumers that still hold a lone page.
 */
export function wrapPageDocumentAsProject(
  document: PageDocument,
  options: WrapPageAsProjectOptions = {},
): ProjectDocument {
  const artboardId = options.artboardId ?? DEFAULT_PAGE_ARTBOARD_ID;
  const artboard: Artboard = {
    id: artboardId,
    name: options.name ?? document.metadata?.title ?? 'Page',
    artboardType: 'page',
    slug: options.slug ?? '/',
    document,
    ...(options.width !== undefined ? { width: options.width } : {}),
  };

  return {
    schema: PROJECT_SCHEMA_NAME,
    version: CURRENT_PROJECT_SCHEMA_VERSION,
    metadata: document.metadata,
    artboards: [artboard],
    activeArtboardId: artboardId,
  };
}

/**
 * Load a raw payload as a ProjectDocument.
 *
 * `PageDocument -> ProjectDocument` is a schema *kind* switch (`document` singular vs.
 * `artboards[]`, different `schema` literal), not a version step, so it cannot be expressed
 * as a MigrationRegistry step. This loader sniffs the shape and routes accordingly:
 *
 * - already a project (`schema === 'stora.project'` or has `artboards[]`) -> parse as a project
 * - anything else -> run the existing page migration pipeline untouched, then wrap the
 *   fully-migrated page into a single-artboard project
 *
 * Legacy inline modal/drawer/collapsible nodes are deliberately NOT auto-extracted into
 * component artboards here; that stays an explicit, author-triggered action so no existing
 * document silently changes how it renders.
 */
export function loadProjectDocument(raw: unknown): ProjectLoadResult {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return {
      success: false,
      wrappedFromLegacyPage: false,
      errors: [
        {
          code: 'INVALID_SOURCE',
          message: 'Source must be a non-null object.',
        },
      ],
    };
  }

  if (looksLikeProjectDocument(raw)) {
    const parsed = ProjectDocumentSchema.safeParse(raw);
    if (!parsed.success) {
      return {
        success: false,
        wrappedFromLegacyPage: false,
        errors: [
          {
            code: 'PROJECT_SCHEMA_INVALID',
            message: 'Payload looks like a project document but failed schema validation.',
            details: { issues: parsed.error.issues },
          },
        ],
      };
    }
    return {
      success: true,
      project: migrateProjectArtboards(parsed.data),
      wrappedFromLegacyPage: false,
      errors: [],
    };
  }

  const migration = migrateDocument(raw);
  if (!migration.success || !migration.document) {
    return {
      success: false,
      wrappedFromLegacyPage: false,
      errors: [
        {
          code: 'LEGACY_MIGRATION_FAILED',
          message: 'Payload is not a project document and could not be migrated as a page document.',
          details: {
            migrationErrors: (migration.diagnostic.errors ?? []) as MigrationError[],
          },
        },
      ],
    };
  }

  return {
    success: true,
    project: wrapPageDocumentAsProject(migration.document),
    wrappedFromLegacyPage: true,
    errors: [],
  };
}
