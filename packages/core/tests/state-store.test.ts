import { describe, expect, it, vi } from 'vitest';
import {
  createDefaultFormState,
  createRuntimeStore,
  RuntimeStateStore,
} from '../src/runtime/state-store';

describe('STORA-314: State Store & Context Manager (RuntimeStateStore)', () => {
  describe('Basic State Operations (get, set, delete, reset)', () => {
    it('sets and retrieves top-level and nested state values', () => {
      const store = new RuntimeStateStore();

      store.set('variables.theme', 'dark');
      store.set('variables.user.profile.name', 'Alice');

      expect(store.get('variables.theme')).toBe('dark');
      expect(store.get('variables.user.profile.name')).toBe('Alice');
      expect(store.get('{{variables.theme}}')).toBe('dark');
      expect(store.get('variables.nonExistent', 'fallbackVal')).toBe('fallbackVal');
    });

    it('returns full immutable snapshot when calling getSnapshot() or get() without arguments', () => {
      const store = new RuntimeStateStore({
        variables: { count: 10 },
      });

      const snapshot = store.getSnapshot();
      expect(snapshot.variables.count).toBe(10);

      // Mutating snapshot should not affect store internal state
      snapshot.variables.count = 99;
      expect(store.get('variables.count')).toBe(10);
    });

    it('deletes properties at dotted paths', () => {
      const store = new RuntimeStateStore({
        variables: { token: 'xyz', config: { debug: true, port: 8080 } },
      });

      expect(store.delete('variables.config.debug')).toBe(true);
      expect(store.get('variables.config.debug')).toBeUndefined();
      expect(store.get('variables.config.port')).toBe(8080);
      expect(store.delete('variables.nonExistent')).toBe(false);
    });

    it('resets store state to clean or specified initial state', () => {
      const store = new RuntimeStateStore({ variables: { a: 1 } });
      store.set('variables.b', 2);

      store.reset({ variables: { initialOnly: true } });
      expect(store.get('variables.a')).toBeUndefined();
      expect(store.get('variables.b')).toBeUndefined();
      expect(store.get('variables.initialOnly')).toBe(true);
    });

    it('protects against prototype pollution keys', () => {
      const store = new RuntimeStateStore();
      store.set('__proto__.polluted', true);
      store.set('constructor.prototype.polluted', true);

      expect((({} as any).polluted)).toBeUndefined();
      expect(store.get('__proto__.polluted')).toBeUndefined();
    });
  });

  describe('Reactive Subscriptions', () => {
    it('notifies global store listeners on state changes and handles unsubscription', () => {
      const store = new RuntimeStateStore({ variables: { counter: 0 } });
      const listener = vi.fn();

      const unsubscribe = store.subscribe(listener);

      store.set('variables.counter', 1);
      expect(listener).toHaveBeenCalledTimes(1);
      expect(listener).toHaveBeenCalledWith(
        expect.objectContaining({ variables: expect.objectContaining({ counter: 1 }) }),
        expect.objectContaining({ variables: expect.objectContaining({ counter: 0 }) }),
      );

      unsubscribe();
      store.set('variables.counter', 2);
      expect(listener).toHaveBeenCalledTimes(1);
    });

    it('notifies path listeners only when the target path value changes', () => {
      const store = new RuntimeStateStore();
      const emailListener = vi.fn();
      const nameListener = vi.fn();

      const unsubEmail = store.subscribePath('forms.contact.values.email', emailListener);
      const unsubName = store.subscribePath('forms.contact.values.name', nameListener);

      store.set('forms.contact.values.email', 'test@example.com');
      expect(emailListener).toHaveBeenCalledWith('test@example.com', undefined);
      expect(nameListener).not.toHaveBeenCalled();

      store.set('forms.contact.values.name', 'John');
      expect(nameListener).toHaveBeenCalledWith('John', undefined);
      expect(emailListener).toHaveBeenCalledTimes(1);

      unsubEmail();
      unsubName();
    });

    it('notifies key listeners for top-level keys', () => {
      const store = new RuntimeStateStore();
      const keyListener = vi.fn();

      const unsubscribe = store.subscribeKey('state', keyListener);
      store.set('state.activeModal', 'modal_1');

      expect(keyListener).toHaveBeenCalledTimes(1);
      unsubscribe();
    });

    it('performs batch updates and notifies subscribers only once', () => {
      const store = new RuntimeStateStore({ variables: { a: 1, b: 2 } });
      const listener = vi.fn();

      store.subscribe(listener);

      store.setBatch({
        'variables.a': 10,
        'variables.b': 20,
        'variables.c': 30,
      });

      expect(listener).toHaveBeenCalledTimes(1);
      expect(store.get('variables.a')).toBe(10);
      expect(store.get('variables.b')).toBe(20);
      expect(store.get('variables.c')).toBe(30);
    });
  });

  describe('Form State Management', () => {
    it('initializes default form state and updates field values', () => {
      const store = new RuntimeStateStore();
      const formListener = vi.fn();

      store.subscribeForm('loginForm', formListener);

      const form = store.getForm('loginForm');
      expect(form.values).toEqual({});
      expect(form.isValid).toBe(true);
      expect(form.isSubmitting).toBe(false);
      expect(form.dirty).toBe(false);

      store.setFormFieldValue('loginForm', 'email', 'user@example.com');
      expect(store.get('forms.loginForm.values.email')).toBe('user@example.com');
      expect(store.getForm('loginForm').dirty).toBe(true);
      expect(formListener).toHaveBeenCalled();
    });

    it('manages form errors and isValid flag', () => {
      const store = new RuntimeStateStore();

      store.setFormFieldError('loginForm', 'email', 'Invalid email address');
      expect(store.getForm('loginForm').errors.email).toBe('Invalid email address');
      expect(store.getForm('loginForm').isValid).toBe(false);

      // Clearing error
      store.setFormFieldError('loginForm', 'email', null);
      expect(store.getForm('loginForm').errors.email).toBeUndefined();
      expect(store.getForm('loginForm').isValid).toBe(true);

      // Batch errors
      store.setFormErrors('loginForm', { password: 'Required' });
      expect(store.getForm('loginForm').errors.password).toBe('Required');
      expect(store.getForm('loginForm').isValid).toBe(false);
    });

    it('manages touched state and submitting status', () => {
      const store = new RuntimeStateStore();

      store.setFormFieldTouched('regForm', 'phone', true);
      expect(store.getForm('regForm').touched.phone).toBe(true);

      store.setFormSubmitting('regForm', true);
      expect(store.getForm('regForm').isSubmitting).toBe(true);

      store.setFormSubmitting('regForm', false);
      expect(store.getForm('regForm').isSubmitting).toBe(false);
    });

    it('resets form back to default or specified initial values', () => {
      const store = new RuntimeStateStore();
      store.setFormValues('contactForm', {
        name: 'Jane',
        email: 'jane@example.com',
        message: 'Hello',
      });
      store.setFormFieldError('contactForm', 'email', 'Error');
      store.setFormFieldTouched('contactForm', 'name', true);

      store.resetForm('contactForm', { name: 'Default Name', email: '' });

      const form = store.getForm('contactForm');
      expect(form.values).toEqual({ name: 'Default Name', email: '' });
      expect(form.errors).toEqual({});
      expect(form.touched).toEqual({});
      expect(form.isValid).toBe(true);
      expect(form.dirty).toBe(false);
    });
  });

  describe('Scoped Store Isolation & Factory', () => {
    it('creates isolated child scope store with independent state and listeners', () => {
      const parentStore = new RuntimeStateStore({ variables: { globalConfig: 'prod' } });
      const pageScope = parentStore.createScope('page_about', { pageTitle: 'About Us' });

      pageScope.set('variables.pageTitle', 'New Title');
      pageScope.setFormFieldValue('feedbackForm', 'rating', 5);

      expect(pageScope.get('variables.pageTitle')).toBe('New Title');
      expect(parentStore.get('variables.pageTitle')).toBeUndefined();
      expect(parentStore.get('forms.feedbackForm')).toBeUndefined();
    });

    it('creates store instance via createRuntimeStore factory helper', () => {
      const store = createRuntimeStore({ variables: { appName: 'KUBUILD' } });
      expect(store).toBeInstanceOf(RuntimeStateStore);
      expect(store.get('variables.appName')).toBe('KUBUILD');
    });

    it('provides clean default form state via createDefaultFormState helper', () => {
      const defaultState = createDefaultFormState({ username: 'guest' });
      expect(defaultState.values.username).toBe('guest');
      expect(defaultState.initialValues?.username).toBe('guest');
      expect(defaultState.dirty).toBe(false);
      expect(defaultState.isValid).toBe(true);
    });
  });
});
