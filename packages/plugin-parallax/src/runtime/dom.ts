/** Scroll and layout plumbing, shared with every scroll-linked effect via `@kubuild/effect-kit`. */
export {
  getView,
  matchesMedia,
  MOBILE_QUERY,
  COARSE_POINTER_QUERY,
  findScrollParent,
  viewportBox,
  renderScale,
  untransformedBox,
  onScrollFrame,
} from '@kubuild/effect-kit/dom';
