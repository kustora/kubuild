import { ImageResponse } from 'next/og';
import { siteUrl } from './shared';

export const ogSize = { width: 1200, height: 630 };

const host = new URL(siteUrl).host;

/** Branded 1200×630 social card shared by the home page, playground, and every docs page. */
export function renderOgImage({
  title,
  description,
  eyebrow,
}: {
  title: string;
  description?: string;
  eyebrow?: string;
}) {
  const titleSize = title.length > 48 ? 56 : title.length > 28 ? 68 : 80;

  return new ImageResponse(
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        padding: '64px 72px',
        backgroundColor: '#05123E',
        backgroundImage:
          'radial-gradient(80% 90% at 100% 0%, rgba(37,99,235,0.55), transparent 60%), radial-gradient(60% 70% at 0% 100%, rgba(37,99,235,0.25), transparent 60%)',
        color: '#E8EAFD',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
        <svg width="56" height="56" viewBox="0 0 24 24" fill="#3B82F6">
          <rect x="0.75" y="0.75" width="6.5" height="22.5" rx="1.25" />
          <rect x="8.75" y="8.75" width="6.5" height="6.5" rx="1.25" />
          <rect x="16.75" y="0.75" width="6.5" height="6.5" rx="1.25" />
          <rect x="16.75" y="16.75" width="6.5" height="6.5" rx="1.25" />
        </svg>
        <span style={{ fontSize: 36, fontWeight: 800, letterSpacing: '-0.02em', color: '#FFFFFF' }}>
          KUBUILD
        </span>
        {eyebrow ? (
          <span
            style={{
              marginLeft: 8,
              padding: '6px 14px',
              borderRadius: 8,
              border: '1px solid rgba(147,197,253,0.4)',
              backgroundColor: 'rgba(37,99,235,0.25)',
              fontSize: 22,
              color: '#BFDBFE',
            }}
          >
            {eyebrow}
          </span>
        ) : null}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
        <div
          style={{
            fontSize: titleSize,
            fontWeight: 700,
            lineHeight: 1.05,
            letterSpacing: '-0.035em',
            color: '#FFFFFF',
            maxWidth: 1000,
          }}
        >
          {title}
        </div>
        {description ? (
          <div
            style={{
              fontSize: 28,
              lineHeight: 1.4,
              color: 'rgba(232,234,253,0.75)',
              maxWidth: 960,
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
            }}
          >
            {description}
          </div>
        ) : null}
      </div>

      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          fontSize: 22,
          color: 'rgba(232,234,253,0.6)',
        }}
      >
        <span>{host}</span>
        <span>Open source · MIT · by Kustora</span>
      </div>
    </div>,
    ogSize,
  );
}
