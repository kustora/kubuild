import React from 'react';
import ReactDOM from 'react-dom';
import type { Artboard, Node } from '@kubuild/schema';
import { type ComponentRegistry, createDefaultComponentRegistry } from '@kubuild/components';
import { RenderContext, DEFAULT_RENDER_CONTEXT, Diagnostic } from './render-context';
import { useModals, modalManager, type ModalManager } from './action-runners';
import { NodeRenderer, KubuildRenderer, type KubuildRendererProps } from './renderer';

export interface ArtboardPortalHostProps {
  /**
   * Component artboards eligible for portal rendering. Defaults to
   * `context.componentArtboards` when omitted.
   */
  artboards?: readonly Artboard[];
  registry?: ComponentRegistry;
  context?: RenderContext;
  viewport?: 'desktop' | 'tablet' | 'mobile';
  /**
   * Editor mode renders nothing: while authoring, a component artboard is shown as its own
   * canvas surface instead, which is precisely what keeps it from covering the page being
   * edited. Portals exist only for runtime/preview.
   */
  mode?: 'editor' | 'runtime';
  modalManager?: ModalManager;
  /** Portal target; defaults to `document.body`. */
  container?: Element | null;
  onDiagnostic?: (diagnostic: Diagnostic) => void;
  onActionDispatch?: (actionType: string, payload: Record<string, unknown> | undefined, nodeId: string) => void;
}

/**
 * Returns the node a component artboard actually represents: its synthetic `page` root
 * holds the detached subtree as its only child.
 */
export function getArtboardContentNode(artboard: Artboard): Node | undefined {
  const root = artboard.document?.document;
  if (!root) return undefined;
  return root.children?.[0] ?? undefined;
}

/**
 * Pick the component artboards that should currently be on screen, given ModalManager's
 * state snapshot. Kept as a pure function so the open/closed decision is testable without
 * a DOM, and so the portal component itself stays a thin shell around it.
 */
export function selectOpenComponentArtboards(
  artboards: readonly Artboard[],
  modalState: Record<string, boolean>,
): Artboard[] {
  return artboards.filter(
    (artboard) =>
      artboard.artboardType === 'component' &&
      Boolean(artboard.triggerId) &&
      Boolean(modalState[artboard.triggerId as string]) &&
      Boolean(getArtboardContentNode(artboard)),
  );
}

/**
 * Renders every open component artboard into a portal.
 *
 * Detaching a modal/drawer into its own artboard means its content is no longer part of the
 * page's own node tree, so at runtime something has to put it back on screen when a trigger
 * fires. ModalManager is a plain string-keyed singleton, so a trigger in one artboard already
 * addresses content in another with no extra wiring — this host just watches that state and
 * renders whichever component artboards are currently open.
 */
export const ArtboardPortalHost: React.FC<ArtboardPortalHostProps> = ({
  artboards,
  registry,
  context = DEFAULT_RENDER_CONTEXT,
  viewport = 'desktop',
  mode = 'runtime',
  modalManager: managerProp,
  container,
  onDiagnostic,
  onActionDispatch,
}) => {
  const manager = managerProp || modalManager;
  const { modals } = useModals(manager);

  const resolvedRegistry = React.useMemo(
    () => registry || createDefaultComponentRegistry(),
    [registry],
  );

  const candidates = React.useMemo(() => {
    const list = artboards ?? context.componentArtboards ?? [];
    return list.filter((artboard) => artboard.artboardType === 'component');
  }, [artboards, context.componentArtboards]);

  if (mode === 'editor') {
    return null;
  }

  const openArtboards = selectOpenComponentArtboards(candidates, modals);

  if (openArtboards.length === 0) {
    return null;
  }

  const target =
    container !== undefined
      ? container
      : typeof globalThis.document !== 'undefined'
        ? globalThis.document.body
        : null;

  if (!target) {
    return null;
  }

  return (
    <>
      {openArtboards.map((artboard) => {
        const contentNode = getArtboardContentNode(artboard);
        if (!contentNode) return null;

        return ReactDOM.createPortal(
          // `pointerEvents: auto` restores interaction for hosts that mark the portal
          // container `pointer-events: none` so an empty container can't swallow clicks
          // meant for the page underneath.
          <div
            key={artboard.id}
            data-kubuild-artboard-portal={artboard.id}
            style={{ pointerEvents: 'auto' }}
          >
            <NodeRenderer
              node={contentNode}
              document={artboard.document}
              registry={resolvedRegistry}
              context={context}
              viewport={viewport}
              mode="runtime"
              onDiagnostic={onDiagnostic}
              onActionDispatch={onActionDispatch}
            />
          </div>,
          target,
          artboard.id,
        );
      })}
    </>
  );
};

export interface KubuildProjectRendererProps extends KubuildRendererProps {
  /**
   * Component artboards belonging to the same project as `document`. Their content is
   * portal-rendered on top of the page whenever a trigger opens them (runtime only).
   * Defaults to `context.componentArtboards`.
   */
  componentArtboards?: readonly Artboard[];
  modalManager?: ModalManager;
  portalContainer?: Element | null;
}

/**
 * Renders one page artboard plus the portal host for its project's component artboards.
 *
 * Use this instead of KubuildRenderer wherever a published page must be able to open
 * detached modals/drawers. Dependency direction stays one-way (this composes the renderer;
 * the renderer knows nothing about projects), so single-document rendering is unaffected.
 */
export const KubuildProjectRenderer: React.FC<KubuildProjectRendererProps> = ({
  componentArtboards,
  modalManager: managerProp,
  portalContainer,
  ...rendererProps
}) => {
  return (
    <>
      <KubuildRenderer {...rendererProps} />
      <ArtboardPortalHost
        artboards={componentArtboards}
        registry={rendererProps.registry}
        context={rendererProps.context}
        viewport={rendererProps.viewport}
        mode={rendererProps.mode}
        modalManager={managerProp}
        container={portalContainer}
        onDiagnostic={rendererProps.onDiagnostic}
        onActionDispatch={rendererProps.onActionDispatch}
      />
    </>
  );
};
