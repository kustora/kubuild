import { renderOgImage } from '@/lib/og';
import { siteTagline } from '@/lib/seo';

export const revalidate = false;

export function GET() {
  return renderOgImage({
    title: siteTagline,
    description:
      'Embed a visual editor in your React app. Every page is a portable .stora JSON document you store and render yourself.',
  });
}
