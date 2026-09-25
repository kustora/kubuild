import React, { useEffect, useRef, useState } from 'react';
import type { RenderNodeContentOptions } from '../render-node-content';
import { executeNodeActions } from '../../action-dispatcher';
import { readAriaLabel, readNumber, readString } from './shared';

export type CountdownFormat = 'mm:ss' | 'hh:mm:ss' | 'd h m s';

export interface CountdownParts {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  totalSeconds: number;
}

/** Splits a millisecond duration into whole d/h/m/s parts (never negative). */
export function splitCountdown(ms: number): CountdownParts {
  const totalSeconds = Math.max(0, Math.ceil((Number.isFinite(ms) ? ms : 0) / 1000));
  return {
    days: Math.floor(totalSeconds / 86400),
    hours: Math.floor((totalSeconds % 86400) / 3600),
    minutes: Math.floor((totalSeconds % 3600) / 60),
    seconds: totalSeconds % 60,
    totalSeconds,
  };
}

const pad2 = (n: number) => String(n).padStart(2, '0');

/**
 * Formats a remaining duration. `mm:ss` rolls hours into minutes and `hh:mm:ss`
 * rolls days into hours, so no time is ever hidden by the chosen format.
 */
export function formatCountdown(ms: number, format: CountdownFormat): string {
  const p = splitCountdown(ms);
  if (format === 'mm:ss') {
    return `${pad2(Math.floor(p.totalSeconds / 60))}:${pad2(p.seconds)}`;
  }
  if (format === 'd h m s') {
    return `${p.days}d ${pad2(p.hours)}h ${pad2(p.minutes)}m ${pad2(p.seconds)}s`;
  }
  return `${pad2(Math.floor(p.totalSeconds / 3600))}:${pad2(p.minutes)}:${pad2(p.seconds)}`;
}

/** Offset (ms) of `timeZone` from UTC at the instant `utcMs`. Throws on an unknown zone. */
export function getTimeZoneOffsetMs(utcMs: number, timeZone: string): number {
  const dtf = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
  const parts: Record<string, number> = {};
  for (const part of dtf.formatToParts(new Date(utcMs))) {
    if (part.type !== 'literal') parts[part.type] = Number(part.value);
  }
  const asUtc = Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour === 24 ? 0 : parts.hour,
    parts.minute,
    parts.second,
  );
  const wholeSecondUtc = utcMs - (((utcMs % 1000) + 1000) % 1000);
  return asUtc - wholeSecondUtc;
}

const WALL_TIME_RE = /^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2})(?::(\d{2}))?)?$/;
const EXPLICIT_OFFSET_RE = /(?:Z|[+-]\d{2}:?\d{2})$/i;

/**
 * Resolves a fixed countdown target to a UTC epoch. A value carrying an explicit
 * offset (`...Z`, `...+07:00`) is used as-is; a bare wall-clock value is interpreted
 * in `timeZone` (DST-aware). An invalid timezone falls back to UTC. Returns `null`
 * for an empty or unparseable target.
 */
export function resolveFixedDeadline(targetDate: string, timeZone = 'UTC'): number | null {
  const value = (targetDate || '').trim();
  if (!value) return null;

  if (EXPLICIT_OFFSET_RE.test(value)) {
    const parsed = Date.parse(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  const match = WALL_TIME_RE.exec(value);
  if (!match) return null;
  const [, y, mo, d, h = '0', mi = '0', s = '0'] = match;
  const wallAsUtc = Date.UTC(
    Number(y),
    Number(mo) - 1,
    Number(d),
    Number(h),
    Number(mi),
    Number(s),
  );
  if (!Number.isFinite(wallAsUtc)) return null;

  const zone = timeZone && timeZone.trim() ? timeZone.trim() : 'UTC';
  try {
    // Two passes so a target near a DST transition picks the offset in effect at the target.
    const firstGuess = wallAsUtc - getTimeZoneOffsetMs(wallAsUtc, zone);
    return wallAsUtc - getTimeZoneOffsetMs(firstGuess, zone);
  } catch {
    return wallAsUtc;
  }
}

export interface CountdownStorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

/** In-memory fallback so evergreen deadlines survive re-renders when storage is unusable. */
const memoryDeadlines = new Map<string, string>();

/** Test hook: clears the in-memory evergreen fallback store. */
export function resetCountdownMemoryStore(): void {
  memoryDeadlines.clear();
}

/** Returns the requested Web Storage, or `null` when unavailable (SSR, privacy mode, sandbox). */
export function getCountdownStorage(kind: 'session' | 'local'): CountdownStorageLike | null {
  try {
    if (typeof window === 'undefined') return null;
    const storage = kind === 'local' ? window.localStorage : window.sessionStorage;
    return storage ?? null;
  } catch {
    return null;
  }
}

/**
 * Resolves (and persists) the per-visitor evergreen deadline. A stored deadline is
 * reused only when it was created for the same duration, so editing the duration
 * restarts the timer instead of keeping a stale deadline. Every storage access is
 * guarded: when reading or writing throws, the in-memory store is used instead.
 */
export function resolveEvergreenDeadline(options: {
  key: string;
  durationMs: number;
  now: number;
  storage: CountdownStorageLike | null;
}): number {
  const { key, durationMs, now, storage } = options;

  const parse = (raw: string | null | undefined): number | null => {
    if (!raw) return null;
    try {
      const data = JSON.parse(raw) as { deadline?: unknown; duration?: unknown };
      if (
        typeof data.deadline === 'number' &&
        Number.isFinite(data.deadline) &&
        data.duration === durationMs
      ) {
        return data.deadline;
      }
    } catch {
      // Corrupt entry: start over.
    }
    return null;
  };

  let stored: string | null | undefined;
  try {
    stored = storage ? storage.getItem(key) : undefined;
  } catch {
    stored = undefined;
  }
  const existing = parse(stored) ?? parse(memoryDeadlines.get(key));
  if (existing !== null) return existing;

  const deadline = now + durationMs;
  const serialized = JSON.stringify({ deadline, duration: durationMs });
  memoryDeadlines.set(key, serialized);
  try {
    storage?.setItem(key, serialized);
  } catch {
    // Quota exceeded / storage disabled: memory fallback already holds the deadline.
  }
  return deadline;
}

/** Fires the node's `expire` action pipelines (STORA-543). */
export function fireCountdownExpire(options: RenderNodeContentOptions): Promise<unknown> {
  return executeNodeActions({
    node: options.node,
    trigger: 'expire',
    document: options.document,
    context: options.context,
    onDiagnostic: options.onDiagnostic,
    onActionDispatch: options.onActionDispatch,
  });
}

function normalizeFormat(value: string): CountdownFormat {
  return value === 'mm:ss' || value === 'd h m s' ? value : 'hh:mm:ss';
}

const CountdownView: React.FC<{ options: RenderNodeContentOptions }> = ({ options }) => {
  const { node, domId, styles, mode, handleClick } = options;
  const isEditor = mode === 'editor';

  const countdownMode =
    readString(options, 'mode', 'evergreen') === 'fixed' ? 'fixed' : 'evergreen';
  const durationMs = Math.max(0, readNumber(options, 'durationMinutes', 15)) * 60_000;
  const targetDate = readString(options, 'targetDate');
  const timezone = readString(options, 'timezone', 'UTC');
  const format = normalizeFormat(readString(options, 'format', 'hh:mm:ss'));
  const label = readString(options, 'label');
  const expireBehavior = readString(options, 'expireBehavior', 'text');
  const expiredText = readString(options, 'expiredText', 'This offer has expired.');
  const storageKind = readString(options, 'storage', 'session') === 'local' ? 'local' : 'session';
  const storageKey = `kubuild:countdown:${readString(options, 'storageKey') || node.id}`;
  const unitLabels = [
    readString(options, 'labelDays', 'Days'),
    readString(options, 'labelHours', 'Hours'),
    readString(options, 'labelMinutes', 'Minutes'),
    readString(options, 'labelSeconds', 'Seconds'),
  ];

  // Deterministic first render (identical on server and client): evergreen shows the
  // full duration, fixed shows a placeholder until the effect knows the current time.
  const [remainingMs, setRemainingMs] = useState<number | null>(() => {
    if (countdownMode === 'evergreen') return durationMs;
    if (isEditor) {
      const deadline = resolveFixedDeadline(targetDate, timezone);
      return deadline === null ? null : Math.max(0, deadline - Date.now());
    }
    return null;
  });
  const [expired, setExpired] = useState(false);
  const firedRef = useRef(false);
  const optionsRef = useRef(options);
  optionsRef.current = options;

  // Editor: frozen — keep showing the full duration / a static snapshot as props change.
  useEffect(() => {
    if (!isEditor) return;
    if (countdownMode === 'evergreen') {
      setRemainingMs(durationMs);
    } else {
      const deadline = resolveFixedDeadline(targetDate, timezone);
      setRemainingMs(deadline === null ? null : Math.max(0, deadline - Date.now()));
    }
    setExpired(false);
  }, [isEditor, countdownMode, durationMs, targetDate, timezone]);

  // Runtime: tick every second until the deadline, then fire `expire` exactly once.
  useEffect(() => {
    if (isEditor) return;
    const deadline =
      countdownMode === 'fixed'
        ? resolveFixedDeadline(targetDate, timezone)
        : resolveEvergreenDeadline({
            key: storageKey,
            durationMs,
            now: Date.now(),
            storage: getCountdownStorage(storageKind),
          });
    if (deadline === null) {
      setRemainingMs(null);
      return;
    }

    let intervalId: ReturnType<typeof setInterval> | undefined;
    const tick = () => {
      const left = Math.max(0, deadline - Date.now());
      setRemainingMs(left);
      if (left <= 0) {
        if (intervalId !== undefined) clearInterval(intervalId);
        setExpired(true);
        if (!firedRef.current) {
          firedRef.current = true;
          void fireCountdownExpire(optionsRef.current);
        }
        return false;
      }
      return true;
    };

    if (tick()) {
      intervalId = setInterval(tick, 1000);
    }
    return () => {
      if (intervalId !== undefined) clearInterval(intervalId);
    };
  }, [isEditor, countdownMode, durationMs, targetDate, timezone, storageKey, storageKind]);

  const accessibleName = readAriaLabel(options) || label || 'Countdown';

  if (!isEditor && expired && expireBehavior === 'hide') {
    return (
      <div
        id={domId}
        style={{ ...styles, display: 'none' }}
        data-kubuild-node={node.id}
        data-kubuild-countdown-state="expired"
        aria-hidden="true"
      />
    );
  }

  if (!isEditor && expired && expireBehavior === 'text') {
    return (
      <div
        id={domId}
        style={styles}
        onClick={handleClick}
        data-kubuild-node={node.id}
        data-kubuild-countdown-state="expired"
        role="status"
      >
        {expiredText}
      </div>
    );
  }

  const parts = remainingMs === null ? null : splitCountdown(remainingMs);
  const state = isEditor ? 'frozen' : expired ? 'expired' : 'running';

  let display: React.ReactNode;
  if (format === 'd h m s') {
    const values = parts
      ? [parts.days, parts.hours, parts.minutes, parts.seconds]
      : [null, null, null, null];
    display = values.map((value, i) => (
      <span
        key={i}
        data-kubuild-countdown-unit={['days', 'hours', 'minutes', 'seconds'][i]}
        style={{
          display: 'inline-flex',
          flexDirection: 'column',
          alignItems: 'center',
          minWidth: '2.5em',
        }}
      >
        <span>{value === null ? '--' : i === 0 ? String(value) : pad2(value)}</span>
        {unitLabels[i] ? (
          <span
            style={{
              fontSize: '0.4em',
              fontWeight: 500,
              opacity: 0.75,
              textTransform: 'uppercase',
            }}
          >
            {unitLabels[i]}
          </span>
        ) : null}
      </span>
    ));
  } else {
    display = (
      <span data-kubuild-countdown-value="">
        {remainingMs === null
          ? format === 'mm:ss'
            ? '--:--'
            : '--:--:--'
          : formatCountdown(remainingMs, format)}
      </span>
    );
  }

  return (
    <div
      id={domId}
      style={styles}
      onClick={handleClick}
      data-kubuild-node={node.id}
      data-kubuild-countdown-state={state}
      role="timer"
      aria-live="off"
      aria-atomic="true"
      aria-label={accessibleName}
    >
      {label ? <span data-kubuild-countdown-label="">{label}</span> : null}
      {display}
    </div>
  );
};

export function renderCountdown(options: RenderNodeContentOptions): React.ReactElement {
  return <CountdownView options={options} />;
}
