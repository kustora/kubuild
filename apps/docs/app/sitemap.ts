import type { MetadataRoute } from 'next';
import { source } from '@/lib/source';
import { siteUrl } from '@/lib/shared';

export const revalidate = false;

export default function sitemap(): MetadataRoute.Sitemap {
  const url = (path: string) => new URL(path, siteUrl).toString();

  return [
    { url: url('/docs'), changeFrequency: 'weekly', priority: 1 },
    { url: url('/playground'), changeFrequency: 'monthly', priority: 0.8 },
    ...source.getPages().map((page) => ({
      url: url(page.url),
      changeFrequency: 'weekly' as const,
      priority: 0.6,
    })),
  ];
}
