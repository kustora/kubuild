import { describe, it, expect, vi } from 'vitest';
import type { ActionPipeline, ActionStep, FormFieldBinding, ValidationRule } from '@kubuild/schema';
import {
  ActionCancellationError,
  ActionPipelineExecutor,
  ActionTimeoutError,
  evaluateCondition,
  evaluateConditionGroup,
  executeActionPipeline,
  isFormValid,
  RuntimeStateStore,
  validateForm,
  validateFormAsync,
} from '../src/index';

describe('STORA-315: Evaluator & Action Pipeline Engine Unit Tests', () => {
  describe('Scenario 1: API Request Berhasil -> Eksekusi Toast & Navigate', () => {
    it('executes sequential pipeline: API request -> responseMapping -> Toast -> Navigate', async () => {
      const executionLog: string[] = [];
      const executor = new ActionPipelineExecutor();

      // Register step handlers
      executor.registerHandler('api_request', async (step) => {
        executionLog.push(`api_request:${step.payload?.url}`);
        return {
          status: 200,
          data: {
            userId: 'usr_8829',
            name: 'Sarah Connor',
            role: 'admin',
            token: 'bearer_token_xyz123',
            redirectUrl: '/admin/dashboard',
          },
        };
      });

      executor.registerHandler('show_toast', async (step) => {
        executionLog.push(`show_toast:${step.payload?.variant || 'info'}`);
        // Toast is a presentation side-effect; returning undefined preserves previous response data in context
      });

      executor.registerHandler('navigate', async (step) => {
        executionLog.push(`navigate:${step.payload?.url}`);
        return {
          navigated: true,
          targetUrl: step.payload?.url,
        };
      });

      const loginPipeline: ActionPipeline = {
        id: 'pipeline_login_success',
        trigger: 'submit',
        steps: [
          // Step 1: API Request to authenticate
          {
            id: 'step_api_login',
            type: 'api_request',
            payload: {
              url: 'https://api.example.com/v1/auth/login',
              method: 'POST',
              body: {
                email: '{{form.email}}',
                password: '{{form.password}}',
              },
              responseMapping: {
                authToken: 'response.data.token',
                userId: 'response.data.userId',
                userName: 'response.data.name',
                userRole: 'response.data.role',
                destination: 'response.data.redirectUrl',
              },
            },
          },
          // Step 2: Show success toast with interpolated data
          {
            id: 'step_toast_success',
            type: 'show_toast',
            payload: {
              message: 'Welcome back, {{variables.userName}}! Authenticated as {{variables.userRole}}.',
              variant: 'success',
            },
          },
          // Step 3: Navigate to dashboard with token
          {
            id: 'step_navigate_dashboard',
            type: 'navigate',
            payload: {
              url: '{{variables.destination}}?session={{variables.authToken}}',
            },
          },
        ],
      };

      const initialContext = {
        form: {
          email: 'sarah@example.com',
          password: 'CorrectSecretPassword123',
        },
        variables: {},
      };

      const result = await executor.execute(loginPipeline, { context: initialContext });

      // Assert overall pipeline status
      expect(result.success).toBe(true);
      expect(result.status).toBe('completed');
      expect(result.stepResults).toHaveLength(3);

      // Assert execution order
      expect(executionLog).toEqual([
        'api_request:https://api.example.com/v1/auth/login',
        'show_toast:success',
        'navigate:/admin/dashboard?session=bearer_token_xyz123',
      ]);

      // Assert Step 1: API Request result and context mapping
      expect(result.stepResults[0].stepId).toBe('step_api_login');
      expect(result.stepResults[0].status).toBe('success');
      expect(result.context.variables?.authToken).toBe('bearer_token_xyz123');
      expect(result.context.variables?.userId).toBe('usr_8829');
      expect(result.context.variables?.userName).toBe('Sarah Connor');
      expect(result.context.variables?.userRole).toBe('admin');
      expect(result.context.variables?.destination).toBe('/admin/dashboard');

      // Assert Step 2: Toast step result
      expect(result.stepResults[1].stepId).toBe('step_toast_success');
      expect(result.stepResults[1].status).toBe('success');

      // Assert Step 3: Navigate step result
      expect(result.stepResults[2].stepId).toBe('step_navigate_dashboard');
      expect(result.stepResults[2].status).toBe('success');
      expect(result.stepResults[2].data).toEqual({
        navigated: true,
        targetUrl: '/admin/dashboard?session=bearer_token_xyz123',
      });
    });

    it('executes branching onSuccess flow with nested toast and navigation steps', async () => {
      const executedBranchSteps: string[] = [];
      const executor = new ActionPipelineExecutor();

      executor.registerHandler('api_request', async () => {
        return {
          orderId: 'ORD-54321',
          totalAmount: 450000,
          customerName: 'Budi Santoso',
          paymentStatus: 'PAID',
        };
      });

      executor.registerHandler('show_toast', async (step) => {
        executedBranchSteps.push(step.id);
        // Returns undefined so downstream sub-steps still access API response context
      });

      executor.registerHandler('navigate', async (step) => {
        executedBranchSteps.push(step.id);
        return { url: step.payload?.url };
      });

      const orderPipeline: ActionPipeline = {
        id: 'pipeline_checkout_branching',
        trigger: 'submit',
        steps: [
          {
            id: 'step_create_order',
            type: 'api_request',
            payload: {
              url: '/api/orders/create',
              body: { cartId: '{{variables.cartId}}' },
            },
            onSuccess: [
              {
                id: 'substep_toast_success',
                type: 'show_toast',
                payload: {
                  type: 'success',
                  message: 'Order {{response.orderId}} of Rp {{response.totalAmount}} confirmed!',
                },
              },
              {
                id: 'substep_navigate_receipt',
                type: 'navigate',
                payload: {
                  url: '/checkout/receipt/{{response.orderId}}?status={{response.paymentStatus}}',
                },
              },
            ],
            onError: [
              {
                id: 'substep_toast_error',
                type: 'show_toast',
                payload: { message: 'Failed to create order' },
              },
            ],
          },
        ],
      };

      const result = await executor.execute(orderPipeline, {
        context: {
          variables: { cartId: 'CART-999' },
        },
      });

      expect(result.success).toBe(true);
      expect(result.status).toBe('completed');
      expect(executedBranchSteps).toEqual(['substep_toast_success', 'substep_navigate_receipt']);

      // Sub-results inside the API step
      const apiStepResult = result.stepResults[0];
      expect(apiStepResult.status).toBe('success');
      expect(apiStepResult.subResults).toHaveLength(2);
      expect(apiStepResult.subResults?.[0].status).toBe('success');
      expect(apiStepResult.subResults?.[1].status).toBe('success');
      expect(apiStepResult.subResults?.[1].data).toEqual({
        url: '/checkout/receipt/ORD-54321?status=PAID',
      });
    });

    it('chains multiple API requests before executing toast and navigate', async () => {
      const executor = new ActionPipelineExecutor();
      const apiCalls: string[] = [];

      executor.registerHandler('api_request', async (step) => {
        const url = step.payload?.url as string;
        apiCalls.push(url);

        if (url.includes('/api/auth/token')) {
          return { accessToken: 'token_abc123' };
        }
        if (url.includes('/api/profile')) {
          return { profile: { id: 'prof_77', role: 'editor' } };
        }
        return {};
      });

      executor.registerHandler('show_toast', async (step) => {
        return { msg: step.payload?.message };
      });

      executor.registerHandler('navigate', async (step) => {
        return { destination: step.payload?.url };
      });

      const multiApiPipeline: ActionPipeline = {
        id: 'multi_api_pipeline',
        trigger: 'click',
        steps: [
          // Step 1: Exchange credentials for token
          {
            id: 'step_get_token',
            type: 'api_request',
            payload: {
              url: 'https://api.example.com/api/auth/token',
              responseMapping: { sessionToken: 'response.accessToken' },
            },
          },
          // Step 2: Fetch profile using token from step 1
          {
            id: 'step_get_profile',
            type: 'api_request',
            payload: {
              url: 'https://api.example.com/api/profile?token={{variables.sessionToken}}',
              responseMapping: { role: 'response.profile.role' },
            },
          },
          // Step 3: Show toast
          {
            id: 'step_toast',
            type: 'show_toast',
            payload: {
              message: 'Logged in as {{variables.role}} with token {{variables.sessionToken}}',
            },
          },
          // Step 4: Navigate
          {
            id: 'step_nav',
            type: 'navigate',
            payload: {
              url: '/workspace/{{variables.role}}',
            },
          },
        ],
      };

      const result = await executor.execute(multiApiPipeline);

      expect(result.success).toBe(true);
      expect(apiCalls).toEqual([
        'https://api.example.com/api/auth/token',
        'https://api.example.com/api/profile?token=token_abc123',
      ]);
      expect(result.stepResults[2].data).toEqual({
        msg: 'Logged in as editor with token token_abc123',
      });
      expect(result.stepResults[3].data).toEqual({
        destination: '/workspace/editor',
      });
    });
  });

  describe('Scenario 2: API Request Gagal -> Eksekusi Error Toast', () => {
    it('executes onError branch when API request throws an HTTP/Network error', async () => {
      const executedSteps: string[] = [];
      const executor = new ActionPipelineExecutor();

      executor.registerHandler('api_request', async (step) => {
        executedSteps.push(step.id);
        const error = new Error('HTTP 500 Internal Server Error: Database connection failed');
        (error as any).status = 500;
        throw error;
      });

      executor.registerHandler('show_toast', async (step) => {
        executedSteps.push(step.id);
        return {
          variant: 'error',
          renderedMessage: step.payload?.message,
        };
      });

      executor.registerHandler('navigate', async (step) => {
        executedSteps.push(step.id);
        return { navigated: true };
      });

      const failingPipeline: ActionPipeline = {
        id: 'failing_api_pipeline',
        trigger: 'submit',
        steps: [
          {
            id: 'step_api_call',
            type: 'api_request',
            payload: { url: '/api/submit-form' },
            onSuccess: [
              {
                id: 'step_success_toast',
                type: 'show_toast',
                payload: { message: 'Submission successful' },
              },
            ],
            onError: [
              {
                id: 'step_error_toast',
                type: 'show_toast',
                payload: {
                  message: 'Submission failed: {{error.message}}',
                },
              },
            ],
          },
          // Main sequence step that should be skipped on failure
          {
            id: 'step_subsequent_navigate',
            type: 'navigate',
            payload: { url: '/dashboard' },
          },
        ],
      };

      const result = await executor.execute(failingPipeline);

      // Pipeline marked as failed
      expect(result.success).toBe(false);
      expect(result.status).toBe('failed');

      // Executed steps are API request and error toast only
      expect(executedSteps).toEqual(['step_api_call', 'step_error_toast']);
      expect(executedSteps).not.toContain('step_success_toast');
      expect(executedSteps).not.toContain('step_subsequent_navigate');

      // Verify step error and onError sub-result
      const apiStep = result.stepResults[0];
      expect(apiStep.status).toBe('error');
      expect((apiStep.error as Error).message).toContain('HTTP 500 Internal Server Error');
      expect(apiStep.subResults).toHaveLength(1);
      expect(apiStep.subResults?.[0].status).toBe('success');
      expect(apiStep.subResults?.[0].data).toEqual({
        variant: 'error',
        renderedMessage: 'Submission failed: HTTP 500 Internal Server Error: Database connection failed',
      });
    });

    it('handles step timeout by executing onError branch with timeout error details', async () => {
      const executedSteps: string[] = [];
      const executor = new ActionPipelineExecutor();

      executor.registerHandler('api_request', async (step, _ctx, signal) => {
        executedSteps.push(step.id);
        return new Promise((resolve, reject) => {
          const timer = setTimeout(() => resolve({ done: true }), 200);
          signal.addEventListener('abort', () => {
            clearTimeout(timer);
            reject(signal.reason);
          });
        });
      });

      executor.registerHandler('show_toast', async (step) => {
        executedSteps.push(step.id);
        return {
          displayed: step.payload?.message,
        };
      });

      const timeoutPipeline: ActionPipeline = {
        id: 'timeout_pipeline',
        trigger: 'click',
        steps: [
          {
            id: 'slow_api_step',
            type: 'api_request',
            timeout: 30, // 30ms timeout
            onError: [
              {
                id: 'timeout_error_toast',
                type: 'show_toast',
                payload: {
                  message: 'Request timed out: {{error.message}}',
                },
              },
            ],
          },
        ],
      };

      const result = await executor.execute(timeoutPipeline);

      expect(result.success).toBe(false);
      expect(result.status).toBe('failed');
      expect(executedSteps).toEqual(['slow_api_step', 'timeout_error_toast']);

      const slowStep = result.stepResults[0];
      expect(slowStep.status).toBe('cancelled');
      expect(slowStep.error).toBeInstanceOf(ActionTimeoutError);
      expect(slowStep.subResults?.[0].data).toEqual({
        displayed: 'Request timed out: Step "slow_api_step" timed out after 30ms',
      });
    });

    it('continues pipeline execution when continueOnError is true and executes error toast and fallback steps', async () => {
      const executedSteps: string[] = [];
      const executor = new ActionPipelineExecutor();

      executor.registerHandler('api_request', async (step) => {
        executedSteps.push(step.id);
        throw new Error('Payment gateway 503 unavailable');
      });

      executor.registerHandler('show_toast', async (step) => {
        executedSteps.push(step.id);
        return { message: step.payload?.message };
      });

      executor.registerHandler('navigate', async (step) => {
        executedSteps.push(step.id);
        return { url: step.payload?.url };
      });

      const continueOnErrorPipeline: ActionPipeline = {
        id: 'continue_on_error_pipeline',
        trigger: 'click',
        steps: [
          {
            id: 'step_charge_card',
            type: 'api_request',
            continueOnError: true,
            onError: [
              {
                id: 'step_charge_failed_toast',
                type: 'show_toast',
                payload: { message: 'Warning: {{error.message}}' },
              },
            ],
          },
          // Step 2 executes because continueOnError was true
          {
            id: 'step_fallback_navigate',
            type: 'navigate',
            payload: { url: '/payment/retry-with-bank-transfer' },
          },
        ],
      };

      const result = await executor.execute(continueOnErrorPipeline);

      expect(result.success).toBe(true);
      expect(result.status).toBe('completed');
      expect(executedSteps).toEqual([
        'step_charge_card',
        'step_charge_failed_toast',
        'step_fallback_navigate',
      ]);
      expect(result.stepResults[0].status).toBe('error');
      expect(result.stepResults[1].status).toBe('success');
      expect(result.stepResults[1].data).toEqual({
        url: '/payment/retry-with-bank-transfer',
      });
    });

    it('handles business failure responses using conditional evaluation, error toast, and form reset', async () => {
      const executor = new ActionPipelineExecutor();
      const toastMessages: string[] = [];

      executor.registerHandler('api_request', async () => {
        return {
          success: false,
          errorCode: 'INVALID_CREDENTIALS',
          errorMessage: 'Email or password incorrect',
        };
      });

      executor.registerHandler('show_toast', async (step) => {
        toastMessages.push(step.payload?.message as string);
        // Returning undefined avoids overwriting context.response
      });

      const loginBusinessErrorPipeline: ActionPipeline = {
        id: 'pipeline_business_error',
        trigger: 'submit',
        steps: [
          // Step 1: Login API
          {
            id: 'step_login_call',
            type: 'api_request',
            payload: { url: '/auth' },
          },
          // Step 2: Error toast triggered when response.success is false
          {
            id: 'step_cond_error_toast',
            type: 'show_toast',
            condition: {
              field: 'response.success',
              operator: 'equals',
              value: false,
            },
            payload: {
              message: 'Authentication failed: {{response.errorMessage}} ({{response.errorCode}})',
            },
          },
          // Step 3: Reset form on failure
          {
            id: 'step_cond_reset_form',
            type: 'reset_form',
            condition: {
              field: 'response.success',
              operator: 'equals',
              value: false,
            },
          },
          // Step 4: Success toast (should be skipped)
          {
            id: 'step_cond_success_toast',
            type: 'show_toast',
            condition: {
              field: 'response.success',
              operator: 'equals',
              value: true,
            },
            payload: { message: 'Logged in successfully!' },
          },
        ],
      };

      const result = await executor.execute(loginBusinessErrorPipeline, {
        context: {
          form: { email: 'wrong@user.com', password: 'wrongpassword' },
        },
      });

      expect(result.success).toBe(true);
      expect(toastMessages).toEqual([
        'Authentication failed: Email or password incorrect (INVALID_CREDENTIALS)',
      ]);
      expect(result.stepResults[1].status).toBe('success');
      expect(result.stepResults[2].status).toBe('success');
      expect(result.stepResults[3].status).toBe('skipped');
      expect(result.context.form).toEqual({
        email: '',
        password: '',
      });
    });
  });

  describe('Scenario 3: Validasi Form Multi-Field', () => {
    const registrationFormConfig: FormFieldBinding[] = [
      {
        name: 'username',
        label: 'Username',
        required: true,
        transform: 'trim',
        rules: [
          { type: 'min_length', value: 4, message: 'Username must be at least 4 characters' },
          { type: 'max_length', value: 20, message: 'Username cannot exceed 20 characters' },
          {
            type: 'pattern',
            value: '^[a-zA-Z0-9_]+$',
            message: 'Username can only contain alphanumeric characters and underscores',
          },
        ],
      },
      {
        name: 'email',
        label: 'Email Address',
        required: true,
        transform: 'lowercase',
        rules: [{ type: 'email', message: 'Please enter a valid email address' }],
      },
      {
        name: 'age',
        label: 'Age',
        required: true,
        transform: 'number',
        rules: [
          { type: 'numeric_min', value: 18, message: 'You must be at least 18 years old' },
          { type: 'numeric_max', value: 120, message: 'Age cannot exceed 120' },
        ],
      },
      {
        name: 'portfolioUrl',
        label: 'Portfolio Website',
        required: false,
        transform: 'trim',
        rules: [{ type: 'url', message: 'Portfolio must be a valid HTTP or HTTPS URL' }],
      },
      {
        name: 'referralCode',
        label: 'Referral Code',
        required: false,
        transform: 'uppercase',
        rules: [
          {
            type: 'custom_regex',
            value: '^REF-[0-9]{4}$',
            message: 'Referral code format must be REF-XXXX',
          },
        ],
      },
      {
        name: 'password',
        label: 'Password',
        required: true,
        rules: [
          { type: 'min_length', value: 8, message: 'Password must be at least 8 characters long' },
        ],
      },
      {
        name: 'confirmPassword',
        label: 'Confirm Password',
        required: true,
        rules: [
          {
            type: 'match_field',
            value: 'password',
            message: 'Confirm password must match password',
          },
        ],
      },
      {
        name: 'agreeTerms',
        label: 'Terms of Service',
        required: true,
        rules: [{ type: 'required', message: 'You must agree to the terms and conditions' }],
      },
    ];

    it('returns an error map for every invalid field across the multi-field form', () => {
      const invalidFormInput = {
        username: '  a!  ', // trimmed to "a!" -> min_length 4 fails
        email: 'NOT_AN_EMAIL', // invalid email format
        age: '16', // transformed to 16 -> numeric_min 18 fails
        portfolioUrl: 'ftp://invalid-url.com', // invalid HTTP/HTTPS URL
        referralCode: 'abc-12', // fails custom regex REF-[0-9]{4}
        password: 'short', // min_length 8 fails
        confirmPassword: 'different_password', // match_field fails
        agreeTerms: false, // required boolean false is empty
      };

      const errors = validateForm(invalidFormInput, registrationFormConfig);

      expect(isFormValid(errors)).toBe(false);
      expect(Object.keys(errors)).toHaveLength(8);

      expect(errors.username).toBe('Username must be at least 4 characters');
      expect(errors.email).toBe('Please enter a valid email address');
      expect(errors.age).toBe('You must be at least 18 years old');
      expect(errors.portfolioUrl).toBe('Portfolio must be a valid HTTP or HTTPS URL');
      expect(errors.referralCode).toBe('Referral code format must be REF-XXXX');
      expect(errors.password).toBe('Password must be at least 8 characters long');
      expect(errors.confirmPassword).toBe('Confirm password must match password');
      expect(errors.agreeTerms).toBe('You must agree to the terms and conditions');
    });

    it('returns an empty error map and isFormValid=true when all multi-field inputs are valid', () => {
      const validFormInput = {
        username: '  john_builder  ', // transformed to 'john_builder'
        email: 'John.Builder@Kustora.io', // transformed to 'john.builder@kustora.io'
        age: '29', // transformed to 29
        portfolioUrl: 'https://kustora.io/portfolio',
        referralCode: 'ref-1234', // transformed to 'REF-1234'
        password: 'SuperSecret123Password!',
        confirmPassword: 'SuperSecret123Password!',
        agreeTerms: true,
      };

      const errors = validateForm(validFormInput, registrationFormConfig);

      expect(isFormValid(errors)).toBe(true);
      expect(errors).toEqual({});
    });

    it('validates optional fields correctly: empty values pass validation, non-empty invalid values fail', () => {
      const formWithoutOptionalValues = {
        username: 'alice_w',
        email: 'alice@example.com',
        age: 25,
        portfolioUrl: '', // empty optional URL
        referralCode: '', // empty optional referral code
        password: 'SecurePassword123',
        confirmPassword: 'SecurePassword123',
        agreeTerms: true,
      };

      const errors = validateForm(formWithoutOptionalValues, registrationFormConfig);
      expect(isFormValid(errors)).toBe(true);
      expect(errors).toEqual({});
    });

    it('validates multi-field form asynchronously via validateFormAsync', async () => {
      const input = {
        username: 'bob', // < 4 chars
        email: 'bob@example.com',
        age: 30,
        password: 'password123',
        confirmPassword: 'password123',
        agreeTerms: true,
      };

      const errors = await validateFormAsync(input, registrationFormConfig);
      expect(isFormValid(errors)).toBe(false);
      expect(errors.username).toBe('Username must be at least 4 characters');
      expect(errors.email).toBeUndefined();
    });
  });

  describe('Scenario 4: End-to-End Integrated Workflows (Validation + State + Pipeline)', () => {
    it('integrates Form Validation with Action Pipeline Execution Gate', async () => {
      const formConfig: FormFieldBinding[] = [
        {
          name: 'email',
          required: true,
          rules: [{ type: 'email', message: 'Valid email is required' }],
        },
        {
          name: 'amount',
          required: true,
          transform: 'number',
          rules: [{ type: 'numeric_min', value: 10000, message: 'Minimum deposit is Rp 10.000' }],
        },
      ];

      const executor = new ActionPipelineExecutor();
      const executedSteps: string[] = [];

      executor.registerHandler('api_request', async (step) => {
        executedSteps.push(step.id);
        return { transactionId: 'TXN_1001', success: true };
      });

      executor.registerHandler('show_toast', async (step) => {
        executedSteps.push(step.id);
        return { message: step.payload?.message };
      });

      executor.registerHandler('navigate', async (step) => {
        executedSteps.push(step.id);
        return { destination: step.payload?.url };
      });

      const depositPipeline: ActionPipeline = {
        id: 'deposit_pipeline',
        trigger: 'submit',
        steps: [
          {
            id: 'api_deposit',
            type: 'api_request',
            payload: {
              url: '/api/deposit',
              body: { email: '{{form.email}}', amount: '{{form.amount}}' },
              responseMapping: { txnId: 'response.transactionId' },
            },
          },
          {
            id: 'toast_deposit',
            type: 'show_toast',
            payload: { message: 'Deposit success for {{form.email}}! TXN: {{variables.txnId}}' },
          },
          {
            id: 'navigate_receipt',
            type: 'navigate',
            payload: { url: '/receipt/{{variables.txnId}}' },
          },
        ],
      };

      // 1. Invalid Form Submission Attempt
      const invalidForm = { email: 'invalid-email', amount: '500' };
      const validationErrors = validateForm(invalidForm, formConfig);

      expect(isFormValid(validationErrors)).toBe(false);
      expect(validationErrors.email).toBe('Valid email is required');
      expect(validationErrors.amount).toBe('Minimum deposit is Rp 10.000');

      // Because form is invalid, pipeline should not execute
      expect(executedSteps).toHaveLength(0);

      // 2. Valid Form Submission Attempt
      const validForm = { email: 'investor@kubuild.io', amount: '500000' };
      const validErrors = validateForm(validForm, formConfig);
      expect(isFormValid(validErrors)).toBe(true);

      const pipelineResult = await executor.execute(depositPipeline, {
        context: { form: validForm, variables: {} },
      });

      expect(pipelineResult.success).toBe(true);
      expect(executedSteps).toEqual(['api_deposit', 'toast_deposit', 'navigate_receipt']);
      expect(pipelineResult.stepResults[1].data).toEqual({
        message: 'Deposit success for investor@kubuild.io! TXN: TXN_1001',
      });
      expect(pipelineResult.stepResults[2].data).toEqual({
        destination: '/receipt/TXN_1001',
      });
    });

    it('evaluates complex condition groups (AND/OR) to dynamically route pipeline execution', async () => {
      const executor = new ActionPipelineExecutor();
      const capturedRoutes: string[] = [];

      executor.registerHandler('show_toast', async (step) => {
        capturedRoutes.push(step.payload?.message as string);
        return { msg: step.payload?.message };
      });

      executor.registerHandler('navigate', async (step) => {
        capturedRoutes.push(step.payload?.url as string);
        return { url: step.payload?.url };
      });

      // Pipeline that tests condition group logic
      const routingPipeline: ActionPipeline = {
        id: 'conditional_routing_pipeline',
        trigger: 'click',
        steps: [
          // Route A: Tier is 'enterprise' OR (Tier is 'pro' AND teamSize > 50)
          {
            id: 'step_vip_notice',
            type: 'show_toast',
            condition: {
              field: 'context.user.tier',
              operator: 'equals',
              value: 'enterprise',
            },
            payload: { message: 'Welcome VIP Enterprise user!' },
          },
          {
            id: 'step_vip_redirect',
            type: 'navigate',
            condition: {
              field: 'context.user.tier',
              operator: 'equals',
              value: 'enterprise',
            },
            payload: { url: '/vip-dashboard' },
          },
          // Route B: Tier is 'free'
          {
            id: 'step_free_notice',
            type: 'show_toast',
            condition: {
              field: 'context.user.tier',
              operator: 'equals',
              value: 'free',
            },
            payload: { message: 'Upgrade to unlock more features.' },
          },
          {
            id: 'step_free_redirect',
            type: 'navigate',
            condition: {
              field: 'context.user.tier',
              operator: 'equals',
              value: 'free',
            },
            payload: { url: '/pricing' },
          },
        ],
      };

      // Test Enterprise flow
      const enterpriseResult = await executor.execute(routingPipeline, {
        context: { context: { user: { tier: 'enterprise' } } },
      });
      expect(enterpriseResult.success).toBe(true);
      expect(capturedRoutes).toEqual(['Welcome VIP Enterprise user!', '/vip-dashboard']);

      capturedRoutes.length = 0;

      // Test Free flow
      const freeResult = await executor.execute(routingPipeline, {
        context: { context: { user: { tier: 'free' } } },
      });
      expect(freeResult.success).toBe(true);
      expect(capturedRoutes).toEqual(['Upgrade to unlock more features.', '/pricing']);
    });

    it('synchronizes pipeline state with RuntimeStateStore and evaluates conditions reactively', async () => {
      const store = new RuntimeStateStore({
        state: {
          isAuthenticated: false,
          currentProject: 'Kustora App',
          itemCount: 0,
        },
      });

      const stateChanges: unknown[] = [];
      store.subscribePath('state.isAuthenticated', (newVal) => {
        stateChanges.push(newVal);
      });

      const executor = new ActionPipelineExecutor();

      executor.registerHandler('api_request', async () => {
        return { token: 'jwt_valid', verified: true };
      });

      executor.registerHandler('sync_store', async (step, context) => {
        const key = step.payload?.key as string;
        const val = step.payload?.value;
        store.set(`state.${key}`, val);
        if (context.state) {
          context.state[key] = val;
        }
        return { synced: key, value: val };
      });

      executor.registerHandler('show_toast', async (step) => {
        return { message: step.payload?.message };
      });

      const syncPipeline: ActionPipeline = {
        id: 'sync_pipeline',
        trigger: 'click',
        steps: [
          {
            id: 'step_auth_api',
            type: 'api_request',
            payload: { url: '/auth' },
          },
          {
            id: 'step_sync_state',
            type: 'sync_store',
            payload: { key: 'isAuthenticated', value: true },
          },
          {
            id: 'step_toast_conditional',
            type: 'show_toast',
            condition: {
              field: 'state.isAuthenticated',
              operator: 'equals',
              value: true,
            },
            payload: {
              message: 'State verified: User authenticated in project {{state.currentProject}}',
            },
          },
        ],
      };

      const result = await executor.execute(syncPipeline, {
        context: {
          state: store.getSnapshot().state,
          variables: {},
        },
      });

      expect(result.success).toBe(true);
      expect(store.get('state.isAuthenticated')).toBe(true);
      expect(stateChanges).toEqual([true]);
      expect(result.stepResults[2].status).toBe('success');
      expect(result.stepResults[2].data).toEqual({
        message: 'State verified: User authenticated in project Kustora App',
      });
    });
  });
});

