import { getMDXComponents } from './components/mdx';
import { InteractiveRenderer, InteractiveSandbox } from './components/interactive-renderer';
import type { MDXComponents } from 'mdx/types';

export function useMDXComponents(components?: MDXComponents): MDXComponents {
  return {
    ...getMDXComponents(components),
    InteractiveRenderer,
    InteractiveSandbox,
  };
}
