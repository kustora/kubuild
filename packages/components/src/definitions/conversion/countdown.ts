import { isVariableBinding } from '@kubuild/schema';
import { ComponentDefinition } from '../../registry';
import { ariaLabelTrait, idTrait } from '../../traits';

export const COUNTDOWN_MODES = ['evergreen', 'fixed'] as const;
export const COUNTDOWN_FORMATS = ['mm:ss', 'hh:mm:ss', 'd h m s'] as const;
export const COUNTDOWN_EXPIRE_BEHAVIORS = ['text', 'hide', 'zero'] as const;
export const COUNTDOWN_STORAGE_TYPES = ['session', 'local'] as const;

/**
 * Countdown timer (STORA-543).
 *
 * - `evergreen`: every visitor gets `durationMinutes` from their first view; the
 *   per-visitor deadline is persisted in session/local storage (with an in-memory
 *   fallback when storage is unavailable or throws).
 * - `fixed`: counts down to `targetDate` (wall-clock `YYYY-MM-DDTHH:mm[:ss]`)
 *   interpreted in the IANA `timezone`.
 *
 * When it reaches zero the runtime fires the node's `expire` action pipelines once
 * and applies `expireBehavior`. In editor mode the timer is frozen.
 */
export const countdownDefinition: ComponentDefinition = {
  type: 'countdown',
  label: 'Countdown',
  category: 'interactive',
  icon: 'clock',
  description: 'Urgency timer for limited offers (evergreen per-visitor or fixed deadline).',
  acceptsChildren: false,
  defaultProps: {
    mode: 'evergreen',
    durationMinutes: 15,
    targetDate: '',
    timezone: 'UTC',
    format: 'hh:mm:ss',
    label: '',
    labelDays: 'Days',
    labelHours: 'Hours',
    labelMinutes: 'Minutes',
    labelSeconds: 'Seconds',
    expireBehavior: 'text',
    expiredText: 'This offer has expired.',
    storage: 'session',
    storageKey: '',
  },
  propFields: [
    {
      name: 'mode',
      label: 'Mode',
      type: 'select',
      defaultValue: 'evergreen',
      options: [
        { label: 'Evergreen (per visitor)', value: 'evergreen' },
        { label: 'Fixed date', value: 'fixed' },
      ],
    },
    {
      name: 'durationMinutes',
      label: 'Duration (minutes)',
      type: 'number',
      defaultValue: 15,
      description: 'Evergreen mode: how long each visitor gets from their first view.',
    },
    {
      name: 'targetDate',
      label: 'Target Date/Time',
      type: 'string',
      defaultValue: '',
      description: 'Fixed mode: wall-clock time "YYYY-MM-DDTHH:mm" in the selected timezone.',
    },
    {
      name: 'timezone',
      label: 'Timezone',
      type: 'string',
      defaultValue: 'UTC',
      description: 'Fixed mode: IANA timezone name, e.g. "Asia/Jakarta" or "Europe/London".',
    },
    {
      name: 'format',
      label: 'Format',
      type: 'select',
      defaultValue: 'hh:mm:ss',
      options: [
        { label: 'mm:ss', value: 'mm:ss' },
        { label: 'hh:mm:ss', value: 'hh:mm:ss' },
        { label: 'd h m s (unit blocks)', value: 'd h m s' },
      ],
    },
    {
      name: 'label',
      label: 'Label',
      type: 'string',
      defaultValue: '',
      description: 'Optional text shown before the timer, e.g. "Offer ends in".',
    },
    { name: 'labelDays', label: 'Days Label', type: 'string', defaultValue: 'Days' },
    { name: 'labelHours', label: 'Hours Label', type: 'string', defaultValue: 'Hours' },
    { name: 'labelMinutes', label: 'Minutes Label', type: 'string', defaultValue: 'Minutes' },
    { name: 'labelSeconds', label: 'Seconds Label', type: 'string', defaultValue: 'Seconds' },
    {
      name: 'expireBehavior',
      label: 'When Expired',
      type: 'select',
      defaultValue: 'text',
      options: [
        { label: 'Show expired text', value: 'text' },
        { label: 'Hide timer', value: 'hide' },
        { label: 'Keep showing zeros', value: 'zero' },
      ],
      description: 'Add an "On Expire" action pipeline to redirect, show a toast, open a modal, etc.',
    },
    {
      name: 'expiredText',
      label: 'Expired Text',
      type: 'string',
      defaultValue: 'This offer has expired.',
    },
    {
      name: 'storage',
      label: 'Evergreen Storage',
      type: 'select',
      defaultValue: 'session',
      options: [
        { label: 'Session (per browser session)', value: 'session' },
        { label: 'Local (persists across visits)', value: 'local' },
      ],
    },
    {
      name: 'storageKey',
      label: 'Storage Key',
      type: 'string',
      defaultValue: '',
      description: 'Share one deadline across pages by using the same key (defaults to the node id).',
    },
  ],
  traits: [
    idTrait(),
    ariaLabelTrait({ description: 'Accessible name for the timer, e.g. "Offer ends in".' }),
  ],
  defaultStyles: {
    base: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: '12px',
      fontSize: '28px',
      fontWeight: '700',
      fontVariantNumeric: 'tabular-nums',
    },
  },
  validateProps: (props) => {
    const errors: string[] = [];
    const checkEnum = (name: string, allowed: readonly string[]) => {
      const value = props[name];
      if (value === undefined || isVariableBinding(value)) return;
      if (typeof value !== 'string' || !allowed.includes(value)) {
        errors.push(`Countdown "${name}" must be one of: ${allowed.join(', ')}.`);
      }
    };
    checkEnum('mode', COUNTDOWN_MODES);
    checkEnum('format', COUNTDOWN_FORMATS);
    checkEnum('expireBehavior', COUNTDOWN_EXPIRE_BEHAVIORS);
    checkEnum('storage', COUNTDOWN_STORAGE_TYPES);
    const duration = props.durationMinutes;
    if (duration !== undefined && !isVariableBinding(duration)) {
      if (typeof duration !== 'number' || !Number.isFinite(duration) || duration < 0) {
        errors.push('Countdown "durationMinutes" must be a non-negative number.');
      }
    }
    return errors;
  },
};
