---
'@kubuild/ai': patch
'@kubuild/components': patch
'@kubuild/core': patch
'@kubuild/editor': patch
'@kubuild/react': patch
'@kubuild/renderer': patch
'@kubuild/schema': patch
---

- **Pinch-to-zoom & Two-finger Pan**: Implemented natural multi-touch gestures on the editor canvas for mobile and tablet devices.
- **Mobile Floating Action Pill**: Added a compact bottom action bar when an element is selected on mobile screens, providing quick access to Move Up, Move Down, Quick Edit, and Delete.
- **Move Up / Down Hierarchy Controls**: Added `moveComponentUp` and `moveComponentDown` in the editor store and floating action badges to allow effortless reordering without dragging.
- **Smart Component Insertion**: Intelligently inserts new components as siblings after the active leaf node if the selected element cannot accept children.

- **Auto-close Mobile Drawers**: Automatically dismisses the mobile component/block sidebar when an item is added to the canvas (`onItemInserted`).
- **Touch & Small Screen Optimization**:
  - Disabled resource-heavy radial grid canvas background and snapping indicators on small touch screens.
  - Disabled hover states for coarse pointer devices to avoid sticky selection states.
  - Throttled bounding-box recomputation during window resize and canvas scroll using `requestAnimationFrame`.
  - Configured proper CSS `touch-action` styles to prevent native browser gesture collisions.
