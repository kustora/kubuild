import { renderOgImage } from '@/lib/og';

export const revalidate = false;

export function GET() {
  return renderOgImage({
    eyebrow: 'Playground',
    title: 'Try the KUBUILD editor in your browser',
    description:
      'Load a template, edit it visually, and export a portable .stora package. No sign-up.',
  });
}
