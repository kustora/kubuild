import { createMDX } from 'fumadocs-mdx/next';

const withMDX = createMDX();

/** @type {import('next').NextConfig} */
const config = {
  reactStrictMode: true,
  transpilePackages: [
    '@kubuild/schema',
    '@kubuild/renderer',
    '@kubuild/components',
    '@kubuild/react',
    '@kubuild/core',
    '@kubuild/editor',
  ],
};

export default withMDX(config);
