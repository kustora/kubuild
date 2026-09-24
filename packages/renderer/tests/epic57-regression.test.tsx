import { describe, it, expect, vi, afterEach } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import type { Node, PageDocument } from '@kubuild/schema';
import { starterPageFixture } from '@kubuild/schema';
import { cloneTemplateAsPage, createBlankDocument, createTemplateRecord } from '@kubuild/core';
import { createDefaultComponentRegistry, FORM_STARTER_BLOCKS } from '@kubuild/components';
import { NodeRenderer, useFormRuntime, type FormRuntimeContextValue } from '../src/index';

/**
 * STORA-534: end-to-end regression suite for Epic 57 (STORA-530..533).
 * Renders the starter fixture and the built-in form blocks through the real renderer and
 * checks that click / submit produce the expected navigation / HTTP request.
 * (The registry-coverage part lives in registry-coverage.test.tsx.)
 */

afterEach(() => {
  vi.unstubAllGlobals();
});

function findNode(root: Node, predicate: (node: Node) => boolean): Node | undefined {
  if (predicate(root)) return root;
  for (const child of root.children ?? []) {
    const hit = findNode(child, predicate);
    if (hit) return hit;
  }
  return undefined;
}

function collectFields(root: Node): Node[] {
  const fields: Node[] = [];
  const visit = (node: Node) => {
    if (['input', 'textarea', 'select'].includes(node.type) && typeof node.props?.name === 'string') {
      fields.push(node);
    }
    node.children?.forEach(visit);
  };
  visit(root);
  return fields;
}

function sampleValue(field: Node): string {
  const name = String(field.props?.name);
  if (field.props?.type === 'email' || /email/i.test(name)) return 'ada@example.com';
  if (field.type === 'select') {
    const options = field.props?.options as Array<{ value?: string } | string> | undefined;
    const first = options?.find((o) => (typeof o === 'string' ? o : o?.value));
    if (first) return typeof first === 'string' ? first : String(first.value);
  }
  if (field.props?.type === 'tel') return '+15555550123';
  return `Sample ${name} value with enough length`;
}

/** Simulates a click on a node rendered by NodeRenderer (no DOM in this test environment). */
async function clickNode(node: Node, document: PageDocument): Promise<void> {
  const registry = createDefaultComponentRegistry();
  const element = NodeRenderer({ node, document, registry, mode: 'runtime' }) as React.ReactElement;
  const inner = (element.props as { children: React.ReactElement }).children;
  const onClick = (inner.props as { onClick?: (e: React.MouseEvent) => unknown }).onClick;
  expect(onClick).toBeTypeOf('function');
  await onClick!({ stopPropagation: () => {}, preventDefault: () => {} } as unknown as React.MouseEvent);
}

/** Renders a form node with the real renderer and returns its live form runtime. */
function renderFormAndCapture(formNode: Node, document: PageDocument): FormRuntimeContextValue {
  const registry = createDefaultComponentRegistry();
  let captured: FormRuntimeContextValue | null = null;
  const Probe = () => {
    captured = useFormRuntime();
    return null;
  };
  registry.register({ type: 'test-form-probe', label: 'Probe', category: 'custom', renderer: Probe });
  const probedForm: Node = {
    ...formNode,
    children: [...(formNode.children ?? []), { id: 'probe', type: 'test-form-probe', props: {}, children: [] }],
  };
  renderToString(<NodeRenderer node={probedForm} document={document} registry={registry} mode="runtime" />);
  expect(captured).not.toBeNull();
  return captured!;
}

function okFetch() {
  return vi.fn().mockResolvedValue({
    ok: true,
    status: 200,
    statusText: 'OK',
    headers: new Headers({ 'content-type': 'application/json' }),
    text: async () => JSON.stringify({ ok: true }),
  });
}

describe('STORA-534: starter fixture', () => {
  it('uses the canonical pipeline format for the hero button (no legacy props.action)', () => {
    const hero = findNode(starterPageFixture.document, (n) => n.id === 'hero-button')!;
    expect(hero.props?.action).toBeUndefined();
    expect(hero.actions?.[0]).toMatchObject({ trigger: 'click', steps: [{ type: 'navigate', payload: { url: '/docs' } }] });
  });

  it('clicking "Get Started" navigates to /docs without any host action wiring', async () => {
    const location = { assign: vi.fn(), replace: vi.fn(), hash: '' };
    vi.stubGlobal('window', { location, open: vi.fn() });

    const hero = findNode(starterPageFixture.document, (n) => n.id === 'hero-button')!;
    await clickNode(hero, starterPageFixture);
    expect(location.assign).toHaveBeenCalledWith('/docs');
  });

  it('a legacy props.action navigate button still navigates without host wiring', async () => {
    const location = { assign: vi.fn(), replace: vi.fn(), hash: '' };
    vi.stubGlobal('window', { location, open: vi.fn() });

    const legacy: Node = {
      id: 'legacy-btn',
      type: 'button',
      props: { label: 'Docs', action: { type: 'navigate', payload: { url: '/docs' } } },
      children: [],
    };
    await clickNode(legacy, createBlankDocument('Legacy'));
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(location.assign).toHaveBeenCalledWith('/docs');
  });
});

describe('STORA-534: built-in form blocks submit their form data', () => {
  const blockIds = ['form-contact-us', 'form-newsletter', 'form-lead-gen'];

  it.each(blockIds)('%s posts every field value to its endpoint', async (blockId) => {
    const block = FORM_STARTER_BLOCKS.find((b) => b.id === blockId);
    expect(block, `block ${blockId} exists`).toBeDefined();

    const tree = block!.createNodeTree();
    const formNode = findNode(tree, (n) => n.type === 'form')!;
    const submitStep = formNode.actions!.find((p) => p.trigger === 'submit')!.steps.find(
      (s) => s.type === 'api_request',
    )!;
    // The bug: blocks never set `body`; the runner must default to the form values.
    expect(submitStep.payload?.body).toBeUndefined();

    const expected = Object.fromEntries(collectFields(formNode).map((f) => [String(f.props!.name), sampleValue(f)]));
    expect(Object.keys(expected).length).toBeGreaterThan(0);
    const seeded: Node = { ...formNode, props: { ...formNode.props, initialValues: expected } };

    const fetchMock = okFetch();
    vi.stubGlobal('fetch', fetchMock);

    const doc = createBlankDocument(blockId);
    const form = renderFormAndCapture(seeded, doc);
    await expect(form.handleFormSubmit()).resolves.toBe(true);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(submitStep.payload!.url);
    expect(JSON.parse(init.body)).toMatchObject(expected);
  });

  it('the submit pipeline survives cloning the block into a page from a template (STORA-530)', async () => {
    const block = FORM_STARTER_BLOCKS.find((b) => b.id === 'form-contact-us')!;
    const source = createBlankDocument('Contact template');
    source.document.children = [block.createNodeTree()];
    const template = createTemplateRecord({ id: 'tmpl_contact', name: 'Contact', document: source });

    const page = cloneTemplateAsPage(template);
    const formNode = findNode(page.document, (n) => n.type === 'form')!;
    expect(formNode.actions?.[0]?.trigger).toBe('submit');

    const expected = Object.fromEntries(collectFields(formNode).map((f) => [String(f.props!.name), sampleValue(f)]));
    const fetchMock = okFetch();
    vi.stubGlobal('fetch', fetchMock);

    const form = renderFormAndCapture({ ...formNode, props: { ...formNode.props, initialValues: expected } }, page);
    await expect(form.handleFormSubmit()).resolves.toBe(true);
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toMatchObject(expected);
  });
});
