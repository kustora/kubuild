import { describe, it, expect } from 'vitest';
import {
  ActionStepTypeSchema,
  ActionStepSchema,
  StepPayloadSchemas,
  ToggleModalStepPayloadSchema,
  isActionStepType,
  validateActionStepPayload,
} from '../src/actions';
import { getActionPipelineJsonSchema, getPageDocumentJsonSchema } from '../src/json-schema';

describe('toggle_modal action step', () => {
  it('is a valid action step type', () => {
    expect(ActionStepTypeSchema.safeParse('toggle_modal').success).toBe(true);
    expect(isActionStepType('toggle_modal')).toBe(true);
    expect(
      ActionStepSchema.safeParse({ id: 's1', type: 'toggle_modal', payload: { modalId: 'menu' } }).success,
    ).toBe(true);
  });

  it('has a payload schema registered in StepPayloadSchemas', () => {
    expect(StepPayloadSchemas.toggle_modal).toBe(ToggleModalStepPayloadSchema);
  });

  it.each(['modalId', 'modalNodeId', 'targetNodeId', 'nodeId'])('accepts target via %s', (field) => {
    expect(validateActionStepPayload('toggle_modal', { [field]: 'menu' }).success).toBe(true);
  });

  it('requires a non-empty target id', () => {
    expect(validateActionStepPayload('toggle_modal', {}).success).toBe(false);
    expect(validateActionStepPayload('toggle_modal', { modalId: '' }).success).toBe(false);
    expect(validateActionStepPayload('toggle_modal', { modalId: '   ' }).success).toBe(false);
  });

  it('is listed in the exported JSON Schemas', () => {
    const pageStepEnum = getPageDocumentJsonSchema().definitions.actionStep.properties.type.enum;
    const pipelineStepEnum = getActionPipelineJsonSchema().definitions.actionStep.properties.type.enum;
    expect(pageStepEnum).toContain('toggle_modal');
    expect(pipelineStepEnum).toContain('toggle_modal');
  });
});
