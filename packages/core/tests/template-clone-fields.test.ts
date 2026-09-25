import { describe, it, expect } from 'vitest';
import type { Node, PageDocument } from '@kubuild/schema';
import { collectNodeIds } from '@kubuild/schema';
import { cloneTemplateAsPage, createTemplateRecord } from '../src/io/template-utils';
import { cloneTreeWithNewIds } from '../src/document/command-tree-utils';
import { duplicateNode } from '../src/document/commands';

/**
 * STORA-530: cloning a template must deep-copy every node field (not just
 * id/type/props/styles/children) and remap intra-tree node-id references.
 */
function buildFormTemplateDoc(): PageDocument {
  return {
    schema: 'stora.page',
    version: '1.0.0',
    metadata: { title: 'Lead Form Template' },
    document: {
      id: 'root',
      type: 'page',
      props: {},
      styles: {},
      children: [
        {
          id: 'hero',
          type: 'section',
          props: {},
          styles: {},
          animation: {
            type: 'fade-up',
            duration: 800,
            delay: 100,
            easing: 'ease-in-out',
            once: false,
            hoverEffect: 'none',
            loopEffect: 'none',
          },
          children: [
            {
              id: 'open-btn',
              type: 'button',
              props: { label: 'Open', modalId: 'thanks-modal', href: '#lead-form' },
              styles: {},
              actions: [
                {
                  id: 'pipe_open',
                  trigger: 'click',
                  enabled: true,
                  steps: [
                    { id: 's_open', type: 'open_modal', payload: { modalNodeId: 'thanks-modal' } },
                    { id: 's_nav', type: 'navigate', payload: { url: '#lead-form' } },
                    // Reference to a node that is NOT part of the template: must stay untouched.
                    { id: 's_ext', type: 'close_modal', payload: { modalId: 'host-global-modal' } },
                  ],
                },
              ],
              children: [],
            },
          ],
        },
        {
          id: 'lead-form',
          type: 'form',
          props: { name: 'lead' },
          styles: {},
          formConfig: {
            formId: 'lead-form',
            resetOnSubmit: true,
            scrollToFirstError: true,
            validateOn: 'blur',
          },
          actions: [
            {
              id: 'pipe_submit',
              trigger: 'submit',
              enabled: true,
              steps: [
                {
                  id: 's_api',
                  type: 'api_request',
                  payload: {
                    url: 'https://api.example.com/leads',
                    method: 'POST',
                    body: '{{form}}',
                  },
                  onSuccess: [
                    { id: 's_reset', type: 'reset_form', payload: { formId: 'lead-form' } },
                    { id: 's_modal', type: 'open_modal', payload: { modalNodeId: 'thanks-modal' } },
                  ],
                  onError: [
                    {
                      id: 's_toast',
                      type: 'show_toast',
                      payload: { message: 'Failed', type: 'error' },
                    },
                  ],
                },
              ],
            },
          ],
          children: [
            {
              id: 'email',
              type: 'input',
              props: { name: 'email', type: 'email', required: true },
              styles: {},
              formConfig: {
                formId: 'lead-form',
                rules: [{ type: 'email', message: 'Invalid email' }],
              } as Node['formConfig'],
              children: [],
            },
          ],
        },
        {
          id: 'thanks-modal',
          type: 'modal',
          props: { modalId: 'thanks-modal' },
          styles: {},
          children: [],
        },
      ],
    },
  } as unknown as PageDocument;
}

function findById(root: Node, id: string): Node | undefined {
  if (root.id === id) return root;
  for (const child of root.children ?? []) {
    const hit = findById(child, id);
    if (hit) return hit;
  }
  return undefined;
}

/** Replace every node id (and remapped id reference) in a tree using the given map, for structural comparison. */
function stripIds(value: unknown, reverseMap: Map<string, string>): unknown {
  if (typeof value === 'string') {
    if (reverseMap.has(value)) return reverseMap.get(value);
    if (value.startsWith('#') && reverseMap.has(value.slice(1)))
      return `#${reverseMap.get(value.slice(1))}`;
    return value;
  }
  if (Array.isArray(value)) return value.map((v) => stripIds(v, reverseMap));
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([k, v]) => [
        k,
        stripIds(v, reverseMap),
      ]),
    );
  }
  return value;
}

describe('STORA-530: cloneTemplateAsPage preserves all node fields', () => {
  const idMapFromClone = (source: PageDocument, clone: PageDocument): Map<string, string> => {
    const oldIds = collectNodeIds(source.document);
    const newIds = collectNodeIds(clone.document);
    return new Map(oldIds.map((oldId, i) => [oldId, newIds[i]]));
  };

  it('produces a clone identical to the source except for node ids', () => {
    const source = buildFormTemplateDoc();
    const template = createTemplateRecord({ id: 'tmpl_lead', name: 'Lead', document: source });
    const clone = cloneTemplateAsPage(template, { idPrefix: 'x' });

    const idMap = idMapFromClone(template.document!, clone);
    for (const [oldId, newId] of idMap) {
      expect(newId).not.toBe(oldId);
    }

    const reverse = new Map([...idMap].map(([o, n]) => [n, o]));
    expect(stripIds(clone.document, reverse)).toEqual(template.document!.document);
  });

  it('copies actions, animation and formConfig', () => {
    const source = buildFormTemplateDoc();
    const clone = cloneTemplateAsPage(source, { idPrefix: 'x' });
    const idMap = idMapFromClone(source, clone);

    const hero = findById(clone.document, idMap.get('hero')!)!;
    expect(hero.animation).toEqual(findById(source.document, 'hero')!.animation);

    const form = findById(clone.document, idMap.get('lead-form')!)!;
    expect(form.actions).toHaveLength(1);
    expect(form.actions![0].trigger).toBe('submit');
    expect(form.formConfig?.resetOnSubmit).toBe(true);

    const email = findById(clone.document, idMap.get('email')!)!;
    expect(email.formConfig?.rules).toEqual([{ type: 'email', message: 'Invalid email' }]);
  });

  it('remaps intra-tree node id references and leaves external references untouched', () => {
    const source = buildFormTemplateDoc();
    const clone = cloneTemplateAsPage(source, { idPrefix: 'x' });
    const idMap = idMapFromClone(source, clone);
    const newModal = idMap.get('thanks-modal')!;
    const newForm = idMap.get('lead-form')!;

    const form = findById(clone.document, newForm)!;
    expect(form.formConfig?.formId).toBe(newForm);
    const apiStep = form.actions![0].steps[0];
    expect(apiStep.onSuccess![0].payload).toEqual({ formId: newForm });
    expect(apiStep.onSuccess![1].payload).toEqual({ modalNodeId: newModal });

    const btn = findById(clone.document, idMap.get('open-btn')!)!;
    expect(btn.props?.modalId).toBe(newModal);
    expect(btn.props?.href).toBe(`#${newForm}`);
    const steps = btn.actions![0].steps;
    expect(steps[0].payload).toEqual({ modalNodeId: newModal });
    expect(steps[1].payload).toEqual({ url: `#${newForm}` });
    expect(steps[2].payload).toEqual({ modalId: 'host-global-modal' });

    const modal = findById(clone.document, newModal)!;
    expect(modal.props?.modalId).toBe(newModal);
  });

  it('never mutates the source template', () => {
    const source = buildFormTemplateDoc();
    const snapshot = JSON.parse(JSON.stringify(source));
    const clone = cloneTemplateAsPage(source, { idPrefix: 'x' });
    expect(source).toEqual(snapshot);

    const form = findById(clone.document, collectNodeIds(clone.document)[3])!;
    form.actions?.[0].steps.push({ id: 'mut', type: 'show_toast', payload: { message: 'x' } });
    expect(source).toEqual(snapshot);
  });
});

describe('STORA-530: subtree duplication preserves all node fields', () => {
  it('cloneTreeWithNewIds keeps actions/animation/formConfig and remaps internal references', () => {
    const source = buildFormTemplateDoc();
    const { clonedNode, idMap } = cloneTreeWithNewIds(source.document);
    const form = findById(clonedNode, idMap.get('lead-form')!)!;
    expect(form.formConfig?.formId).toBe(idMap.get('lead-form'));
    expect(form.actions![0].steps[0].onSuccess![1].payload).toEqual({
      modalNodeId: idMap.get('thanks-modal'),
    });
    expect(findById(clonedNode, idMap.get('hero')!)!.animation?.type).toBe('fade-up');
  });

  it('DUPLICATE_NODE keeps a button pipeline pointing at a modal outside the duplicated subtree', () => {
    const doc = buildFormTemplateDoc();
    const { document: next, event } = duplicateNode(doc, { nodeId: 'hero' });
    const map = (event.payload as { idMap: Record<string, string> }).idMap;
    const dupBtn = findById(next.document, map['open-btn'])!;
    expect(dupBtn.actions![0].steps[0].payload).toEqual({ modalNodeId: 'thanks-modal' });
    expect(findById(next.document, map['hero'])!.animation?.duration).toBe(800);
  });
});
