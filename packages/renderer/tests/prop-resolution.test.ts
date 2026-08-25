import { describe, expect, it } from 'vitest';
import { resolvePropsForNode } from '../src/prop-resolution';
import { headingDefinition, imageDefinition, buttonDefinition } from '@kubuild/components';
import type { Node } from '@kubuild/schema';
import type { RenderContext } from '@kubuild/core';

describe('resolvePropsForNode', () => {
  it('resolves a matching-type variable binding', () => {
    const node: Node = { id: 'h1', type: 'heading', props: { text: { type: 'variable', key: 'site.name' } } };
    const context: RenderContext = { variables: { site: { name: 'Hello' } } };

    const { props, diagnostics } = resolvePropsForNode(node, headingDefinition, context);
    expect(props.text).toBe('Hello');
    expect(diagnostics).toEqual([]);
  });

  it('falls back and emits a diagnostic on a type mismatch', () => {
    const node: Node = { id: 'img-1', type: 'image', props: { src: { type: 'variable', key: 'bad' }, alt: 'ok' } };
    const context: RenderContext = { variables: { bad: { nested: true } } };

    const { props, diagnostics } = resolvePropsForNode(node, imageDefinition, context);
    expect(props.src).toBe(imageDefinition.defaultProps?.src);
    expect(diagnostics).toEqual([
      {
        code: 'INCOMPATIBLE_BINDING_TYPE',
        nodeId: 'img-1',
        propName: 'src',
        expectedType: 'string',
        actualType: 'object',
        message: expect.any(String),
      },
    ]);
  });

  it('falls back to an empty-of-type value when no defaultProps/defaultValue exists', () => {
    const node: Node = { id: 'btn-1', type: 'button', props: { disabled: { type: 'variable', key: 'bad' } } };
    const context: RenderContext = { variables: { bad: 'not-a-boolean' } };

    const { props, diagnostics } = resolvePropsForNode(node, buttonDefinition, context);
    expect(props.disabled).toBe(false);
    expect(diagnostics).toHaveLength(1);
  });

  it('follows the existing missing-key fallback/empty policy, still type-checked', () => {
    const node: Node = { id: 'h2', type: 'heading', props: { text: { type: 'variable', key: 'missing' } } };
    const { props, diagnostics } = resolvePropsForNode(node, headingDefinition, { variables: {} });
    expect(props.text).toBe('');
    expect(diagnostics).toEqual([]);
  });

  it('leaves static values untouched', () => {
    const node: Node = { id: 'h3', type: 'heading', props: { text: 'Plain' } };
    const { props, diagnostics } = resolvePropsForNode(node, headingDefinition, undefined);
    expect(props.text).toBe('Plain');
    expect(diagnostics).toEqual([]);
  });

  it('passes props through unchanged when the component has no definition', () => {
    const node: Node = { id: 'x1', type: 'unknown-type', props: { anything: 'goes' } };
    const { props, diagnostics } = resolvePropsForNode(node, undefined, undefined);
    expect(props).toEqual({ anything: 'goes' });
    expect(diagnostics).toEqual([]);
  });

  it('leaves non-bindable fields (select/json/action) untouched', () => {
    const node: Node = {
      id: 'btn-2',
      type: 'button',
      props: { label: 'Go', variant: 'secondary', action: { type: 'navigate' } },
    };
    const { props } = resolvePropsForNode(node, buttonDefinition, undefined);
    expect(props.variant).toBe('secondary');
    expect(props.action).toEqual({ type: 'navigate' });
  });
});
