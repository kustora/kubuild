import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { handleFormButtonClick } from '../src/nodes/form-nodes';
import { modalManager } from '../src/action-runners';
import { createBlankDocument } from '@kubuild/core';
import type { Node } from '@kubuild/schema';

const event = { stopPropagation: vi.fn() } as unknown as React.MouseEvent;
const document = createBlankDocument('Click test');

function toggleNode(modalId = 'mobile-nav-drawer'): Node {
  return {
    id: 'hamburger',
    type: 'button',
    props: { label: '☰', modalId, isEditable: false },
    actions: [
      {
        id: 'p1',
        trigger: 'click',
        label: 'Toggle menu',
        enabled: true,
        steps: [
          { id: 's1', type: 'open_modal', label: 'Toggle', payload: { modalId, toggle: true } },
        ],
      },
    ],
  };
}

describe('handleFormButtonClick', () => {
  beforeEach(() => {
    modalManager.reset();
  });

  it('runs the pipeline exactly once when an onClick owner is supplied', async () => {
    // NodeRenderer's own handleClick already executes node.actions, so this component must
    // not execute them again — a double run cancels any toggling action.
    const executeActions = vi.fn().mockResolvedValue(undefined);
    const onClick = vi.fn();

    await handleFormButtonClick({
      event,
      buttonType: 'button',
      node: toggleNode(),
      document,
      onClick,
      executeActions: executeActions as never,
    });

    expect(onClick).toHaveBeenCalledTimes(1);
    expect(executeActions).not.toHaveBeenCalled();
  });

  it('a toggle action ends up open, not back where it started', async () => {
    // The regression this guards: two executions per click left the menu closed forever.
    const node = toggleNode();
    let executions = 0;

    const onClick = () => {
      executions += 1;
      modalManager.toggleModal('mobile-nav-drawer');
    };

    await handleFormButtonClick({ event, buttonType: 'button', node, document, onClick });

    expect(executions).toBe(1);
    expect(modalManager.isModalOpen('mobile-nav-drawer')).toBe(true);
  });

  it('executes the pipeline itself when used standalone (no onClick owner)', async () => {
    const executeActions = vi.fn().mockResolvedValue(undefined);

    await handleFormButtonClick({
      event,
      buttonType: 'button',
      node: toggleNode(),
      document,
      executeActions: executeActions as never,
    });

    expect(executeActions).toHaveBeenCalledTimes(1);
    expect(executeActions.mock.calls[0][0]).toMatchObject({ trigger: 'click' });
  });

  it('accepts a bare actions array when no node is given', async () => {
    const executeActions = vi.fn().mockResolvedValue(undefined);

    await handleFormButtonClick({
      event,
      buttonType: 'button',
      actions: toggleNode().actions,
      document,
      executeActions: executeActions as never,
    });

    expect(executeActions).toHaveBeenCalledTimes(1);
  });

  it('does nothing at all when disabled', async () => {
    const executeActions = vi.fn();
    const onClick = vi.fn();

    await handleFormButtonClick({
      event,
      buttonType: 'button',
      disabled: true,
      node: toggleNode(),
      document,
      onClick,
      executeActions: executeActions as never,
    });

    expect(onClick).not.toHaveBeenCalled();
    expect(executeActions).not.toHaveBeenCalled();
  });

  describe('submit & reset semantics', () => {
    it('submits first, then hands off to the pipeline owner', async () => {
      const order: string[] = [];
      const formRuntime = {
        handleFormSubmit: vi.fn(async () => {
          order.push('submit');
          return true;
        }),
        resetForm: vi.fn(),
      };

      await handleFormButtonClick({
        event,
        buttonType: 'submit',
        formRuntime,
        node: toggleNode(),
        document,
        onClick: () => order.push('pipeline'),
      });

      expect(order).toEqual(['submit', 'pipeline']);
    });

    it('blocks the pipeline when submit validation fails', async () => {
      const executeActions = vi.fn();
      const onClick = vi.fn();
      const formRuntime = {
        handleFormSubmit: vi.fn(async () => false),
        resetForm: vi.fn(),
      };

      await handleFormButtonClick({
        event,
        buttonType: 'submit',
        formRuntime,
        node: toggleNode(),
        document,
        onClick,
        executeActions: executeActions as never,
      });

      expect(onClick).not.toHaveBeenCalled();
      expect(executeActions).not.toHaveBeenCalled();
    });

    it('resets the form, then still runs the pipeline', async () => {
      const onClick = vi.fn();
      const formRuntime = {
        handleFormSubmit: vi.fn(async () => true),
        resetForm: vi.fn(),
      };

      await handleFormButtonClick({
        event,
        buttonType: 'reset',
        formRuntime,
        node: toggleNode(),
        document,
        onClick,
      });

      expect(formRuntime.resetForm).toHaveBeenCalledTimes(1);
      expect(formRuntime.handleFormSubmit).not.toHaveBeenCalled();
      expect(onClick).toHaveBeenCalledTimes(1);
    });
  });
});
