import { EditorLocale } from '../store';

export type { EditorLocale };

export interface TranslationSchema {
  // Top Level & Tabs
  styleTab: string;
  settingsTab: string;
  textSettings: string;
  componentSettings: (componentLabel: string) => string;
  resetStyle: string;
  resetStyleTooltip: string;
  collapseAll: string;
  expandAll: string;

  // Element State
  stateLabel: string;
  normal: string;
  hover: string;
  pressed: string;
  focused: string;
  editingStateBadge: (friendlyName: string, stateCode: string) => string;

  // Dimension & Layout
  dimensionSector: string;
  dimensionSectorDesc: string;
  flexSector: string;
  flexSectorDesc: string;
  typographySector: string;
  typographySectorDesc: string;
  decorationsSector: string;
  decorationsSectorDesc: string;
  motionSector: string;
  motionSectorDesc: string;
  sizingModes: string;
  widthMode: string;
  heightMode: string;
  hug: string;
  hugSub: string;
  hugTooltip: string;
  fill: string;
  fillSub: string;
  fillTooltip: string;
  fixed: string;
  fixedSub: string;
  fixedTooltip: string;
  display: string;
  displayTooltip: string;
  displayBlock: string;
  displayFlex: string;
  displayInlineFlex: string;
  displayInlineBlock: string;
  displayInline: string;
  displayGrid: string;
  displayInlineGrid: string;
  displayNone: string;
  overflow: string;
  overflowTooltip: string;
  overflowVisible: string;
  overflowHidden: string;
  overflowScroll: string;
  overflowAuto: string;
  spacingGap: string;
  rowGap: string;
  columnGap: string;

  // Spacing (Box Model)
  spacingSector: string;
  spacingSectorDesc: string;
  outerSpaceGroup: string;
  innerSpaceGroup: string;
  margin: string;
  border: string;
  padding: string;
  content: string;
  top: string;
  right: string;
  bottom: string;
  left: string;
  marginTop: string;
  marginRight: string;
  marginBottom: string;
  marginLeft: string;
  borderTopWidth: string;
  borderRightWidth: string;
  borderBottomWidth: string;
  borderLeftWidth: string;
  paddingTop: string;
  paddingRight: string;
  paddingBottom: string;
  paddingLeft: string;

  // Typography & Styling
  fontFamily: string;
  defaultFont: string;
  opacity: string;
  cornerRadius: string;
  frostedBlur: string;

  // Animation & Motion
  hoverEffect: string;
  motionCurve: string;
  duration: string;
  delay: string;

  // Heading levels
  titleSize: string;
  h1: string;
  h2: string;
  h3: string;
  h4: string;
  h5: string;
  h6: string;
}
