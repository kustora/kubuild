import { describe, it, expect } from 'vitest';
import {
  ActionTriggerTypeSchema,
  ActionStepTypeSchema,
  ConditionOperatorSchema,
  ActionStepConditionSchema,
  ApiRequestStepPayloadSchema,
  NavigateStepPayloadSchema,
  SetStateStepPayloadSchema,
  ResetFormStepPayloadSchema,
  ShowToastStepPayloadSchema,
  OpenModalStepPayloadSchema,
  CloseModalStepPayloadSchema,
  CopyClipboardStepPayloadSchema,
  CustomEventStepPayloadSchema,
  ActionStepSchema,
  ActionPipelineSchema,
  isActionTriggerType,
  isActionStepType,
  isConditionOperator,
  isActionStepCondition,
  isActionStep,
  isActionPipeline,
  validateActionStepPayload,
  isSafeActionUrl,
  sanitizeActionUrl,
  sanitizeActionString,
  sanitizeActionPayload,
  sanitizeActionStep,
  sanitizeActionPipeline,
  type ActionPipeline,
  type ActionStep,
} from '../src/actions';

describe('ActionTriggerTypeSchema & Type Guards', () => {
  const validTriggers = ['click', 'submit', 'change', 'blur', 'focus', 'load'];

  it.each(validTriggers)('accepts valid trigger: %s', (trigger) => {
    expect(ActionTriggerTypeSchema.safeParse(trigger).success).toBe(true);
    expect(isActionTriggerType(trigger)).toBe(true);
  });

  it('rejects invalid or unknown triggers', () => {
    expect(ActionTriggerTypeSchema.safeParse('hover').success).toBe(false);
    expect(ActionTriggerTypeSchema.safeParse('keydown').success).toBe(false);
    expect(ActionTriggerTypeSchema.safeParse('').success).toBe(false);
    expect(isActionTriggerType(123)).toBe(false);
    expect(isActionTriggerType(null)).toBe(false);
  });
});

describe('ActionStepTypeSchema & Type Guards', () => {
  const validStepTypes = [
    'api_request',
    'navigate',
    'set_state',
    'reset_form',
    'show_toast',
    'open_modal',
    'close_modal',
    'copy_clipboard',
    'custom_event',
  ];

  it.each(validStepTypes)('accepts valid step type: %s', (stepType) => {
    expect(ActionStepTypeSchema.safeParse(stepType).success).toBe(true);
    expect(isActionStepType(stepType)).toBe(true);
  });

  it('rejects invalid step types', () => {
    expect(ActionStepTypeSchema.safeParse('execute_shell').success).toBe(false);
    expect(ActionStepTypeSchema.safeParse('eval_js').success).toBe(false);
    expect(ActionStepTypeSchema.safeParse('').success).toBe(false);
    expect(isActionStepType(undefined)).toBe(false);
  });
});

describe('ActionStepConditionSchema', () => {
  it('validates correct conditions across all operators', () => {
    const operators = [
      'equals',
      'not_equals',
      'contains',
      'not_contains',
      'is_truthy',
      'is_falsy',
      'gt',
      'gte',
      'lt',
      'lte',
      'regex',
    ] as const;

    for (const op of operators) {
      const parsed = ActionStepConditionSchema.safeParse({
        field: 'form.email',
        operator: op,
        value: 'test@example.com',
      });
      expect(parsed.success).toBe(true);
    }
  });

  it('rejects condition with empty field or invalid operator', () => {
    expect(
      ActionStepConditionSchema.safeParse({
        field: '',
        operator: 'equals',
        value: 'val',
      }).success
    ).toBe(false);

    expect(
      ActionStepConditionSchema.safeParse({
        field: 'form.name',
        operator: 'invalid_op',
        value: 'val',
      }).success
    ).toBe(false);
  });
});

describe('Step Payload Schemas & Security Validation', () => {
  describe('api_request payload', () => {
    it('accepts valid HTTP request payloads', () => {
      const validPayload = {
        url: 'https://api.example.com/v1/users',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer token',
        },
        queryParams: { page: 1, filter: 'active', secure: true },
        body: { name: 'John Doe', email: 'john@example.com' },
        timeout: 5000,
        responseMapping: { userId: 'response.data.id' },
      };

      const result = ApiRequestStepPayloadSchema.safeParse(validPayload);
      expect(result.success).toBe(true);
    });

    it('accepts relative URLs and template variable URLs', () => {
      expect(ApiRequestStepPayloadSchema.safeParse({ url: '/api/v1/submit' }).success).toBe(true);
      expect(
        ApiRequestStepPayloadSchema.safeParse({ url: 'https://api.example.com/items/{{form.id}}' })
          .success
      ).toBe(true);
    });

    it('rejects malicious/injection URLs', () => {
      const maliciousUrls = [
        'javascript:alert(1)',
        'javascript:fetch("https://attacker.com")',
        'vbscript:msgbox(1)',
        'data:text/html,<script>alert(1)</script>',
        '<script>alert("xss")</script>',
      ];

      for (const url of maliciousUrls) {
        expect(isSafeActionUrl(url)).toBe(false);
        const result = ApiRequestStepPayloadSchema.safeParse({ url });
        expect(result.success).toBe(false);
      }
    });

    it('rejects invalid timeouts', () => {
      expect(
        ApiRequestStepPayloadSchema.safeParse({
          url: 'https://api.example.com',
          timeout: -100,
        }).success
      ).toBe(false);

      expect(
        ApiRequestStepPayloadSchema.safeParse({
          url: 'https://api.example.com',
          timeout: 0,
        }).success
      ).toBe(false);
    });
  });

  describe('navigate payload', () => {
    it('accepts valid navigation targets and options', () => {
      expect(
        NavigateStepPayloadSchema.safeParse({
          url: '/pricing',
          target: '_blank',
          scroll: true,
        }).success
      ).toBe(true);

      expect(
        NavigateStepPayloadSchema.safeParse({
          url: 'https://kubuild.com',
          target: '_self',
          replace: true,
        }).success
      ).toBe(true);

      expect(
        NavigateStepPayloadSchema.safeParse({
          url: '#features',
        }).success
      ).toBe(true);
    });

    it('rejects dangerous javascript: navigation', () => {
      expect(
        NavigateStepPayloadSchema.safeParse({
          url: 'javascript:document.cookie',
        }).success
      ).toBe(false);
    });
  });

  describe('set_state payload', () => {
    it('accepts valid state updates', () => {
      expect(
        SetStateStepPayloadSchema.safeParse({
          key: 'user.profile.name',
          value: 'Jane Doe',
          scope: 'session',
        }).success
      ).toBe(true);

      expect(
        SetStateStepPayloadSchema.safeParse({
          key: 'counter',
          value: 42,
        }).success
      ).toBe(true);
    });

    it('rejects empty state keys', () => {
      expect(
        SetStateStepPayloadSchema.safeParse({
          key: '',
          value: 'test',
        }).success
      ).toBe(false);
    });
  });

  describe('reset_form payload', () => {
    it('accepts valid optional formId', () => {
      expect(ResetFormStepPayloadSchema.safeParse({}).success).toBe(true);
      expect(ResetFormStepPayloadSchema.safeParse({ formId: 'contact-form' }).success).toBe(true);
    });
  });

  describe('show_toast payload', () => {
    it('accepts valid toast payloads', () => {
      expect(
        ShowToastStepPayloadSchema.safeParse({
          message: 'Saved successfully!',
          type: 'success',
          title: 'Notification',
          duration: 3000,
        }).success
      ).toBe(true);
    });

    it('rejects empty messages', () => {
      expect(ShowToastStepPayloadSchema.safeParse({ message: '' }).success).toBe(false);
    });
  });

  describe('open_modal & close_modal payloads', () => {
    it('validates open_modal requires modalId', () => {
      expect(OpenModalStepPayloadSchema.safeParse({ modalId: 'modal-login' }).success).toBe(true);
      expect(OpenModalStepPayloadSchema.safeParse({ modalId: '' }).success).toBe(false);
      expect(OpenModalStepPayloadSchema.safeParse({}).success).toBe(false);
    });

    it('validates close_modal allows optional modalId', () => {
      expect(CloseModalStepPayloadSchema.safeParse({}).success).toBe(true);
      expect(CloseModalStepPayloadSchema.safeParse({ modalId: 'modal-login' }).success).toBe(true);
    });
  });

  describe('copy_clipboard payload', () => {
    it('accepts valid copy parameters', () => {
      expect(
        CopyClipboardStepPayloadSchema.safeParse({
          text: 'https://kubuild.com/share/123',
          notify: true,
          toastMessage: 'Link copied to clipboard!',
        }).success
      ).toBe(true);
    });
  });

  describe('custom_event payload', () => {
    it('accepts valid event names and details', () => {
      expect(
        CustomEventStepPayloadSchema.safeParse({
          eventName: 'cart:item_added',
          detail: { sku: 'PRO-100', qty: 2 },
          bubbles: true,
        }).success
      ).toBe(true);
    });

    it('rejects invalid or unsafe event names', () => {
      expect(
        CustomEventStepPayloadSchema.safeParse({
          eventName: '<script>evil()</script>',
        }).success
      ).toBe(false);

      expect(
        CustomEventStepPayloadSchema.safeParse({
          eventName: 'event with spaces',
        }).success
      ).toBe(false);
    });
  });
});

describe('ActionStepSchema (Recursive & Branching)', () => {
  it('validates a simple action step', () => {
    const step: ActionStep = {
      id: 'step_1',
      type: 'show_toast',
      label: 'Notify user',
      payload: {
        message: 'Form submitted!',
        type: 'success',
      },
    };

    const parsed = ActionStepSchema.safeParse(step);
    expect(parsed.success).toBe(true);
    expect(isActionStep(step)).toBe(true);
  });

  it('validates recursive branching with onSuccess and onError steps', () => {
    const complexStep: ActionStep = {
      id: 'api_submit',
      type: 'api_request',
      label: 'Submit Lead Form',
      payload: {
        url: 'https://api.example.com/leads',
        method: 'POST',
      },
      timeout: 10000,
      condition: {
        field: 'form.isValid',
        operator: 'is_truthy',
      },
      onSuccess: [
        {
          id: 'toast_success',
          type: 'show_toast',
          payload: { message: 'Thanks for signing up!' },
        },
        {
          id: 'nav_dashboard',
          type: 'navigate',
          payload: { url: '/welcome' },
        },
      ],
      onError: [
        {
          id: 'toast_error',
          type: 'show_toast',
          payload: { message: 'Submission failed. Please try again.', type: 'error' },
        },
      ],
    };

    const parsed = ActionStepSchema.safeParse(complexStep);
    expect(parsed.success).toBe(true);
    expect(isActionStep(complexStep)).toBe(true);
  });

  it('rejects step without id or valid type', () => {
    expect(
      ActionStepSchema.safeParse({
        type: 'show_toast',
      }).success
    ).toBe(false);

    expect(
      ActionStepSchema.safeParse({
        id: 's1',
        type: 'unknown_type',
      }).success
    ).toBe(false);
  });
});

describe('ActionPipelineSchema', () => {
  it('validates a complete ActionPipeline', () => {
    const pipeline: ActionPipeline = {
      id: 'pipeline_submit_lead',
      trigger: 'submit',
      label: 'Lead Form Submission Pipeline',
      debounceMs: 300,
      preventDuplicate: true,
      enabled: true,
      steps: [
        {
          id: 'step_post_api',
          type: 'api_request',
          payload: {
            url: 'https://api.example.com/lead',
            method: 'POST',
          },
          onSuccess: [
            {
              id: 'step_toast',
              type: 'show_toast',
              payload: { message: 'Success' },
            },
          ],
        },
        {
          id: 'step_reset',
          type: 'reset_form',
        },
      ],
    };

    const parsed = ActionPipelineSchema.safeParse(pipeline);
    expect(parsed.success).toBe(true);
    expect(isActionPipeline(pipeline)).toBe(true);
  });

  it('rejects pipeline with empty steps array', () => {
    const invalidPipeline = {
      id: 'pipe_1',
      trigger: 'click',
      steps: [],
    };

    expect(ActionPipelineSchema.safeParse(invalidPipeline).success).toBe(false);
    expect(isActionPipeline(invalidPipeline)).toBe(false);
  });

  it('rejects pipeline with invalid trigger', () => {
    const invalidPipeline = {
      id: 'pipe_1',
      trigger: 'on_scroll',
      steps: [{ id: 's1', type: 'show_toast', payload: { message: 'hi' } }],
    };

    expect(ActionPipelineSchema.safeParse(invalidPipeline).success).toBe(false);
  });
});

describe('validateActionStepPayload Helper', () => {
  it('validates payload against specific step schema', () => {
    const validToast = validateActionStepPayload('show_toast', { message: 'Hello!' });
    expect(validToast.success).toBe(true);

    const invalidToast = validateActionStepPayload('show_toast', { message: '' });
    expect(invalidToast.success).toBe(false);
    expect(invalidToast.error).toBeDefined();

    const validNav = validateActionStepPayload('navigate', { url: '/home' });
    expect(validNav.success).toBe(true);

    const invalidNav = validateActionStepPayload('navigate', { url: 'javascript:alert(1)' });
    expect(invalidNav.success).toBe(false);
  });
});

describe('STORA-303: Action Data Type Guards & Sanitization Utilities', () => {
  describe('Type Guards', () => {
    it('isConditionOperator accurately checks operators', () => {
      expect(isConditionOperator('equals')).toBe(true);
      expect(isConditionOperator('regex')).toBe(true);
      expect(isConditionOperator('not_contains')).toBe(true);
      expect(isConditionOperator('invalid_op')).toBe(false);
      expect(isConditionOperator(null)).toBe(false);
    });

    it('isActionStepCondition validates condition objects', () => {
      expect(isActionStepCondition({ field: 'form.email', operator: 'equals', value: 'a@b.com' })).toBe(true);
      expect(isActionStepCondition({ field: 'form.name', operator: 'is_truthy' })).toBe(true);
      expect(isActionStepCondition({ field: '', operator: 'equals' })).toBe(false);
      expect(isActionStepCondition({ field: 'foo', operator: 'invalid' })).toBe(false);
      expect(isActionStepCondition(null)).toBe(false);
    });
  });

  describe('sanitizeActionUrl', () => {
    it('returns trimmed safe URLs', () => {
      expect(sanitizeActionUrl('  https://api.example.com/data  ')).toBe('https://api.example.com/data');
      expect(sanitizeActionUrl('/dashboard')).toBe('/dashboard');
      expect(sanitizeActionUrl('#section')).toBe('#section');
      expect(sanitizeActionUrl('https://api.example.com/items/{{form.id}}')).toBe('https://api.example.com/items/{{form.id}}');
    });

    it('neutralizes dangerous protocols and scripts to fallback value', () => {
      expect(sanitizeActionUrl('javascript:alert(1)')).toBe('');
      expect(sanitizeActionUrl('javascript:document.cookie', '/fallback')).toBe('/fallback');
      expect(sanitizeActionUrl('vbscript:msgbox(1)')).toBe('');
      expect(sanitizeActionUrl('data:text/html,<script>alert(1)</script>')).toBe('');
      expect(sanitizeActionUrl('<script>alert("xss")</script>')).toBe('');
    });

    it('handles non-string inputs gracefully', () => {
      expect(sanitizeActionUrl(null)).toBe('');
      expect(sanitizeActionUrl(undefined, '/default')).toBe('/default');
      expect(sanitizeActionUrl(12345)).toBe('');
    });
  });

  describe('sanitizeActionString', () => {
    it('preserves clean strings', () => {
      expect(sanitizeActionString('Hello world')).toBe('Hello world');
      expect(sanitizeActionString('Submit Lead')).toBe('Submit Lead');
    });

    it('strips dangerous script tags from strings', () => {
      expect(sanitizeActionString('Title <script>alert(1)</script> text')).toBe('Title  text');
      expect(sanitizeActionString('<script src="evil.js"></script>')).toBe('');
    });
  });

  describe('sanitizeActionPayload', () => {
    it('cleans dangerous URL fields inside payloads', () => {
      const maliciousPayload = {
        url: 'javascript:alert(1)',
        target: '_blank',
        nested: {
          endpoint: 'javascript:steal()',
          safeUrl: 'https://api.example.com',
        },
      };

      const sanitized = sanitizeActionPayload(maliciousPayload);
      expect(sanitized.url).toBe('');
      expect(sanitized.target).toBe('_blank');
      expect((sanitized.nested as any).endpoint).toBe('');
      expect((sanitized.nested as any).safeUrl).toBe('https://api.example.com');
    });

    it('strips script tags within string payload values', () => {
      const payload = {
        message: 'Welcome <script>alert("xss")</script> friend',
        tags: ['safe', '<script>bad()</script>tag'],
      };

      const sanitized = sanitizeActionPayload(payload);
      expect(sanitized.message).toBe('Welcome  friend');
      expect((sanitized.tags as any)[0]).toBe('safe');
      expect((sanitized.tags as any)[1]).toBe('tag');
    });

    it('handles undefined or invalid payload values', () => {
      expect(sanitizeActionPayload(undefined)).toEqual({});
      expect(sanitizeActionPayload(null as any)).toEqual({});
      expect(sanitizeActionPayload('string' as any)).toEqual({});
    });
  });

  describe('sanitizeActionStep', () => {
    it('recursively sanitizes action step and its onSuccess and onError branches', () => {
      const step: ActionStep = {
        id: 'step_1',
        type: 'api_request',
        label: 'Submit <script>alert(1)</script>',
        payload: {
          url: 'javascript:alert(1)',
          method: 'POST',
        },
        onSuccess: [
          {
            id: 'step_nav',
            type: 'navigate',
            payload: {
              url: 'javascript:steal()',
            },
          },
        ],
        onError: [
          {
            id: 'step_toast',
            type: 'show_toast',
            payload: {
              message: 'Error <script>evil()</script>',
            },
          },
        ],
      };

      const sanitized = sanitizeActionStep(step);
      expect(sanitized.label).toBe('Submit ');
      expect(sanitized.payload?.url).toBe('');
      expect(sanitized.onSuccess?.[0].payload?.url).toBe('');
      expect(sanitized.onError?.[0].payload?.message).toBe('Error ');
    });
  });

  describe('sanitizeActionPipeline', () => {
    it('recursively sanitizes a full ActionPipeline', () => {
      const pipeline: ActionPipeline = {
        id: 'pipe_1',
        trigger: 'click',
        label: 'Pipeline <script>bad()</script>',
        steps: [
          {
            id: 'step_nav',
            type: 'navigate',
            payload: {
              url: 'javascript:evil()',
            },
          },
        ],
      };

      const sanitized = sanitizeActionPipeline(pipeline);
      expect(sanitized.label).toBe('Pipeline ');
      expect(sanitized.steps[0].payload?.url).toBe('');
    });
  });
});

