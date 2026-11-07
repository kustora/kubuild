/** Renders schema.org structured data. `<` is escaped so content can never close the script tag. */
export function JsonLd({ data }: { data: Record<string, unknown> | Record<string, unknown>[] }) {
  const json = JSON.stringify({
    '@context': 'https://schema.org',
    ...(Array.isArray(data) ? { '@graph': data } : data),
  }).replace(/</g, '\\u003c');

  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: json }} />;
}
