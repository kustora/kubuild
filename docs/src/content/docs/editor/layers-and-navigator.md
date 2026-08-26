---
title: 'Layers Panel & Tree Navigator'
description: 'Manage component hierarchies, reorder nodes, and toggle visibility in KUBUILD.'
---

# Layers Panel & Tree Navigator

The **Layers Panel** (also known as the Tree Navigator) renders the document AST as an interactive tree view. It gives creators full control over deep nested components, section ordering, container hierarchies, and item organization.

## Display Modes

The navigator supports two distinct workspace modes:

1. **Docked Mode**: Sits alongside the component library panel on the left side of the workspace.
2. **Floating Mode**: Transforms into a draggable, resizable floating panel that can be repositioned anywhere over the canvas for maximum screen real estate.

Toggle between modes directly from the top toolbar or using the panel header toggle button.

```tsx
// Using the editor store to toggle navigator display mode
const { navigatorMode, setNavigatorMode } = useEditorStore();

setNavigatorMode('floating'); // or 'docked' | 'hidden'
```

## Core Tree Features

### 1. Drag & Drop Reordering
Drag any layer or container node to reorder siblings or move children into new parent containers (e.g. dragging a `Button` into a `FlexBox` or `Card`).

### 2. Node Selection & Deep Highlighting
Clicking any item in the tree automatically selects the node on the visual canvas and scrolls it into view. Hovering over a tree node renders a blue bounding highlight on the canvas.

### 3. Visibility & Lock Toggles
- **Eye Icon (Visibility)**: Toggle `hidden: true` to temporarily conceal elements without deleting them from the document.
- **Lock Icon**: Protect complex sections or locked layout containers from accidental editing or repositioning.

### 4. Node Renaming
Double-click the label of any tree item to assign a semantic custom name (e.g., `"Main Hero Section"`, `"Pricing Grid Table"`), making large pages easy to navigate.

### 5. Context Actions
Right-click or click the `•••` action menu on any layer item to:
- **Duplicate**: Clones the node and all its children with new unique IDs.
- **Wrap in Container**: Wraps the node inside a new `Box` or `FlexBox`.
- **Delete**: Removes the element from the document AST.
