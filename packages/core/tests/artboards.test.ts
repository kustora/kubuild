import { describe, it, expect } from 'vitest';
import {
  createBlankDocument,
  createBlankProject,
  createPageArtboard,
  createComponentArtboard,
  addArtboard,
  removeArtboard,
  renameArtboard,
  setActiveArtboard,
  extractNodeToArtboard,
  updateArtboardDocument,
  findArtboardById,
  findArtboardByTriggerId,
  getActiveArtboard,
  getPageArtboards,
  getComponentArtboards,
  collectProjectNodeIds,
  insertNode,
  findNodeById,
  loadProjectDocument,
  wrapPageDocumentAsProject,
  validateProject,
  collectArtboardReferenceNodes,
} from '../src';
import {
  ARTBOARD_REFERENCE_NODE_TYPE,
  PROJECT_SCHEMA_NAME,
  SCHEMA_NAME,
  type Node,
  type ProjectDocument,
} from '@kubuild/schema';

function modalNode(id = 'modal-1', modalId = 'modal-dialog'): Node {
  return {
    id,
    type: 'modal',
    props: { modalId, title: 'Modal Title' },
    styles: {},
    children: [
      { id: `${id}-body`, type: 'paragraph', props: { text: 'Body' }, styles: {}, children: [] },
    ],
  };
}

/** Page project with a modal nested inside the root page node. */
function projectWithModal(): ProjectDocument {
  const project = createBlankProject('Home');
  const artboard = project.artboards[0];
  const withModal = insertNode(artboard.document, {
    parentId: artboard.document.document.id,
    node: modalNode(),
  }).document;
  return updateArtboardDocument(project, artboard.id, withModal);
}

describe('Artboards: project creation and lookup', () => {
  it('creates a blank project holding a single active page artboard', () => {
    const project = createBlankProject('Home');

    expect(project.schema).toBe(PROJECT_SCHEMA_NAME);
    expect(project.artboards).toHaveLength(1);
    expect(project.artboards[0].artboardType).toBe('page');
    expect(project.activeArtboardId).toBe(project.artboards[0].id);
    // Each artboard embeds a complete, unchanged PageDocument
    expect(project.artboards[0].document.schema).toBe(SCHEMA_NAME);
    expect(project.artboards[0].document.document.type).toBe('page');
  });

  it('splits page and component artboards, and resolves triggers and active artboard', () => {
    const project = createBlankProject('Home');
    const component = createComponentArtboard(modalNode(), { id: 'ab-modal' });
    const withComponent = addArtboard(project, { artboard: component, activate: false }).project;

    expect(getPageArtboards(withComponent)).toHaveLength(1);
    expect(getComponentArtboards(withComponent)).toHaveLength(1);
    expect(findArtboardById(withComponent, 'ab-modal')?.name).toBe('modal');
    // triggerId defaults to the node's own modalId so ModalManager keeps working unchanged
    expect(findArtboardByTriggerId(withComponent, 'modal-dialog')?.id).toBe('ab-modal');
    expect(findArtboardByTriggerId(withComponent, 'nope')).toBeUndefined();
    // activate:false left the page artboard active
    expect(getActiveArtboard(withComponent)?.artboardType).toBe('page');
  });

  it('wraps a component node under a synthetic page root so the document stays valid', () => {
    const artboard = createComponentArtboard(modalNode());

    expect(artboard.artboardType).toBe('component');
    expect(artboard.document.document.type).toBe('page');
    expect(artboard.document.document.children).toHaveLength(1);
    expect(artboard.document.document.children?.[0].type).toBe('modal');
  });
});

describe('Artboards: mutation commands', () => {
  it('adds, renames, activates, and removes artboards immutably', () => {
    const project = createBlankProject('Home');
    const added = addArtboard(project, { artboard: createPageArtboard('About', { id: 'ab-about', slug: '/about' }) });

    expect(added.event.type).toBe('ARTBOARD_ADDED');
    expect(added.project.artboards).toHaveLength(2);
    expect(added.project.activeArtboardId).toBe('ab-about');
    expect(project.artboards).toHaveLength(1); // original untouched

    const renamed = renameArtboard(added.project, { artboardId: 'ab-about', name: 'About Us' });
    expect(renamed.event.type).toBe('ARTBOARD_RENAMED');
    expect(findArtboardById(renamed.project, 'ab-about')?.name).toBe('About Us');

    const activated = setActiveArtboard(renamed.project, { artboardId: project.artboards[0].id });
    expect(activated.event.type).toBe('ACTIVE_ARTBOARD_CHANGED');
    expect(activated.project.activeArtboardId).toBe(project.artboards[0].id);

    const removed = removeArtboard(activated.project, { artboardId: 'ab-about' });
    expect(removed.event.type).toBe('ARTBOARD_REMOVED');
    expect(removed.project.artboards).toHaveLength(1);
  });

  it('rejects duplicate ids, unknown ids, and removing the last artboard', () => {
    const project = createBlankProject('Home');
    const existingId = project.artboards[0].id;

    expect(() => addArtboard(project, { artboard: createPageArtboard('Dup', { id: existingId }) })).toThrow(
      /already exists/,
    );
    expect(() => removeArtboard(project, { artboardId: existingId })).toThrow(/at least one artboard/);
    expect(() => renameArtboard(project, { artboardId: 'ghost', name: 'X' })).toThrow(/not found/);
    expect(() => renameArtboard(project, { artboardId: existingId, name: '  ' })).toThrow(/non-empty/);
    expect(() => setActiveArtboard(project, { artboardId: 'ghost' })).toThrow(/not found/);
  });

  it('reassigns the active artboard when the active one is removed', () => {
    const project = addArtboard(createBlankProject('Home'), {
      artboard: createPageArtboard('About', { id: 'ab-about' }),
    }).project;
    expect(project.activeArtboardId).toBe('ab-about');

    const removed = removeArtboard(project, { artboardId: 'ab-about' }).project;
    expect(removed.activeArtboardId).toBe(removed.artboards[0].id);
  });
});

describe('Artboards: extractNodeToArtboard', () => {
  it('detaches a node into its own component artboard and leaves a reference stub', () => {
    const project = projectWithModal();
    const pageId = project.artboards[0].id;

    const result = extractNodeToArtboard(project, { artboardId: pageId, nodeId: 'modal-1' });

    expect(result.event.type).toBe('NODE_EXTRACTED_TO_ARTBOARD');
    expect(result.event.sourceArtboardId).toBe(pageId);
    expect(result.project.artboards).toHaveLength(2);

    // The modal is gone from the page tree...
    const page = findArtboardById(result.project, pageId)!;
    expect(findNodeById(page.document.document, 'modal-1')).toBeNull();

    // ...replaced in place by a stub pointing at the new artboard
    const stubs = collectArtboardReferenceNodes(page.document.document);
    expect(stubs).toHaveLength(1);
    const newArtboard = findArtboardById(result.project, stubs[0].artboardId!)!;
    expect(newArtboard.artboardType).toBe('component');
    expect(newArtboard.triggerId).toBe('modal-dialog');

    // ...and the modal subtree (with its children) now lives in that artboard
    const moved = findNodeById(newArtboard.document.document, 'modal-1');
    expect(moved?.type).toBe('modal');
    expect(moved?.children).toHaveLength(1);
  });

  it('keeps the extracted node at the same sibling index as the stub', () => {
    const project = createBlankProject('Home');
    const artboard = project.artboards[0];
    const rootId = artboard.document.document.id;

    let doc = insertNode(artboard.document, {
      parentId: rootId,
      node: { id: 'before', type: 'heading', props: {}, styles: {}, children: [] },
    }).document;
    doc = insertNode(doc, { parentId: rootId, node: modalNode() }).document;
    doc = insertNode(doc, {
      parentId: rootId,
      node: { id: 'after', type: 'paragraph', props: {}, styles: {}, children: [] },
    }).document;

    const withNodes = updateArtboardDocument(project, artboard.id, doc);
    const result = extractNodeToArtboard(withNodes, { artboardId: artboard.id, nodeId: 'modal-1' });

    const children = findArtboardById(result.project, artboard.id)!.document.document.children!;
    expect(children.map((child) => child.type)).toEqual([
      'heading',
      ARTBOARD_REFERENCE_NODE_TYPE,
      'paragraph',
    ]);
  });

  it('does not activate the new artboard unless asked', () => {
    const project = projectWithModal();
    const pageId = project.artboards[0].id;

    const stayed = extractNodeToArtboard(project, { artboardId: pageId, nodeId: 'modal-1' });
    expect(stayed.project.activeArtboardId).toBe(pageId);

    const jumped = extractNodeToArtboard(project, {
      artboardId: pageId,
      nodeId: 'modal-1',
      activate: true,
    });
    expect(jumped.project.activeArtboardId).not.toBe(pageId);
  });

  it('keeps node ids unique project-wide after extraction', () => {
    const project = projectWithModal();
    const pageId = project.artboards[0].id;
    const result = extractNodeToArtboard(project, { artboardId: pageId, nodeId: 'modal-1' });

    let total = 0;
    for (const artboard of result.project.artboards) {
      total += collectProjectNodeIds({ ...result.project, artboards: [artboard] }).size;
    }
    // No id is shared between artboards, so the per-artboard counts sum to the project set
    expect(collectProjectNodeIds(result.project).size).toBe(total);
  });

  it('rejects extracting an unknown node, the artboard root, or into a taken artboard id', () => {
    const project = projectWithModal();
    const pageId = project.artboards[0].id;
    const rootId = project.artboards[0].document.document.id;

    expect(() => extractNodeToArtboard(project, { artboardId: pageId, nodeId: 'ghost' })).toThrow(
      /not found/,
    );
    expect(() => extractNodeToArtboard(project, { artboardId: pageId, nodeId: rootId })).toThrow(
      /root cannot be detached/,
    );
    expect(() => extractNodeToArtboard(project, { artboardId: 'ghost', nodeId: 'modal-1' })).toThrow(
      /not found/,
    );
    expect(() =>
      extractNodeToArtboard(project, {
        artboardId: pageId,
        nodeId: 'modal-1',
        newArtboardId: pageId,
      }),
    ).toThrow(/already exists/);
  });
});

describe('loadProjectDocument', () => {
  it('wraps a legacy single-page document into a one-artboard project', () => {
    const legacy = createBlankDocument('Legacy Home');
    const result = loadProjectDocument(legacy);

    expect(result.success).toBe(true);
    expect(result.wrappedFromLegacyPage).toBe(true);
    expect(result.project?.schema).toBe(PROJECT_SCHEMA_NAME);
    expect(result.project?.artboards).toHaveLength(1);
    expect(result.project?.artboards[0].artboardType).toBe('page');
    expect(result.project?.artboards[0].document.document.id).toBe(legacy.document.id);
  });

  it('parses a native project document without wrapping', () => {
    const project = createBlankProject('Home');
    const result = loadProjectDocument(project);

    expect(result.success).toBe(true);
    expect(result.wrappedFromLegacyPage).toBe(false);
    expect(result.project?.artboards).toHaveLength(1);
  });

  it('routes a malformed project to the project parser instead of treating it as a page', () => {
    const result = loadProjectDocument({ schema: PROJECT_SCHEMA_NAME, artboards: [] });

    expect(result.success).toBe(false);
    expect(result.errors[0].code).toBe('PROJECT_SCHEMA_INVALID');
  });

  it('reports invalid and unmigratable sources', () => {
    expect(loadProjectDocument(null).errors[0].code).toBe('INVALID_SOURCE');
    expect(loadProjectDocument([]).errors[0].code).toBe('INVALID_SOURCE');
    expect(loadProjectDocument({ nonsense: true }).errors[0].code).toBe('LEGACY_MIGRATION_FAILED');
  });

  it('wrapPageDocumentAsProject honours explicit naming options', () => {
    const project = wrapPageDocumentAsProject(createBlankDocument('X'), {
      artboardId: 'ab-1',
      name: 'About',
      slug: '/about',
      width: 1200,
    });

    expect(project.artboards[0]).toMatchObject({
      id: 'ab-1',
      name: 'About',
      slug: '/about',
      width: 1200,
    });
    expect(project.activeArtboardId).toBe('ab-1');
  });
});

describe('validateProject', () => {
  it('accepts a well-formed project, including after an extraction', () => {
    const project = projectWithModal();
    const extracted = extractNodeToArtboard(project, {
      artboardId: project.artboards[0].id,
      nodeId: 'modal-1',
    }).project;

    const result = validateProject(extracted);
    expect(result.errors).toEqual([]);
    expect(result.valid).toBe(true);
    expect(result.data?.artboards).toHaveLength(2);
  });

  it('rejects non-objects and non-project shapes', () => {
    expect(validateProject(null).errors[0].code).toBe('PROJECT_SCHEMA_INVALID');
    expect(validateProject(createBlankDocument('Page')).errors[0].code).toBe('PROJECT_SCHEMA_INVALID');
  });

  it('detects node ids duplicated across artboards', () => {
    const project = createBlankProject('Home');
    // Same node id present in two different artboards
    const clash = addArtboard(project, {
      artboard: createComponentArtboard(modalNode(project.artboards[0].document.document.id), {
        id: 'ab-clash',
      }),
      activate: false,
    }).project;

    const result = validateProject(clash);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.code === 'DUPLICATE_NODE_ID_ACROSS_ARTBOARDS')).toBe(true);
  });

  it('detects duplicate component trigger ids', () => {
    let project = createBlankProject('Home');
    project = addArtboard(project, {
      artboard: createComponentArtboard(modalNode('m1', 'same-trigger'), { id: 'ab-1' }),
      activate: false,
    }).project;
    project = addArtboard(project, {
      artboard: createComponentArtboard(modalNode('m2', 'same-trigger'), { id: 'ab-2' }),
      activate: false,
    }).project;

    const result = validateProject(project);
    expect(result.errors.some((e) => e.code === 'DUPLICATE_TRIGGER_ID')).toBe(true);
  });

  it('detects a stub pointing at a removed artboard and an unresolvable active artboard', () => {
    const project = projectWithModal();
    const pageId = project.artboards[0].id;
    const extracted = extractNodeToArtboard(project, { artboardId: pageId, nodeId: 'modal-1' }).project;
    const stubTarget = collectArtboardReferenceNodes(
      findArtboardById(extracted, pageId)!.document.document,
    )[0].artboardId!;

    const orphaned: ProjectDocument = {
      ...extracted,
      activeArtboardId: 'ghost-artboard',
      artboards: extracted.artboards.filter((artboard) => artboard.id !== stubTarget),
    };

    const result = validateProject(orphaned);
    expect(result.errors.some((e) => e.code === 'DANGLING_ARTBOARD_REFERENCE')).toBe(true);
    expect(result.errors.some((e) => e.code === 'INVALID_ACTIVE_ARTBOARD')).toBe(true);
  });

  it('surfaces per-artboard document errors from the existing single-document validator', () => {
    const project = createBlankProject('Home');
    const broken: ProjectDocument = {
      ...project,
      artboards: [
        {
          ...project.artboards[0],
          document: {
            ...project.artboards[0].document,
            // Duplicate node ids inside one artboard's own tree
            document: {
              ...project.artboards[0].document.document,
              children: [
                { id: 'dupe', type: 'heading', props: {}, styles: {}, children: [] },
                { id: 'dupe', type: 'heading', props: {}, styles: {}, children: [] },
              ],
            },
          },
        },
      ],
    };

    const result = validateProject(broken);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.code === 'ARTBOARD_DOCUMENT_INVALID')).toBe(true);
    expect(result.artboardErrors[project.artboards[0].id].length).toBeGreaterThan(0);
  });
});
