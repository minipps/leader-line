/**
 * Type declarations for LeaderLine.
 * https://github.com/minipps/leader-line
 *
 * `types/leader-line.d.mts` is generated from this file by `grunt build`.
 */

declare namespace LeaderLine {
  /** Any CSS color notation, e.g. `'coral'`, `'#49acdf'`, `'rgba(73, 172, 223, 0.5)'`. */
  type Color = string;

  /** Pixels as a number, or a percentage of the element as a string, e.g. `'50%'`. */
  type Length = number | string;

  type PathType = 'straight' | 'arc' | 'fluid' | 'magnet' | 'grid';

  type SocketType = 'top' | 'right' | 'bottom' | 'left' | 'auto';

  /** Pull strength, `[x, y]` direction and strength, or `'auto'`. */
  type SocketGravity = number | [number, number] | 'auto';

  type PlugType = 'disc' | 'square' | 'arrow1' | 'arrow2' | 'arrow3' | 'hand' | 'crosshair' | 'behind';

  type ShowEffectName = 'none' | 'fade' | 'draw';

  type TimingKeyword = 'ease' | 'linear' | 'ease-in' | 'ease-out' | 'ease-in-out';

  interface AnimOptions {
    /** Milliseconds. */
    duration?: number;
    timing?: TimingKeyword | [number, number, number, number];
  }

  /** The object returned by `LeaderLine.pointAnchor()`, `LeaderLine.areaAnchor()` and so on. */
  interface Attachment {
    readonly isRemoved: boolean;
    remove(): void;
  }

  /** Something the line can start or end at. */
  type Anchor = Element | Attachment;

  /** A label on the line: plain text, or a `captionLabel` / `pathLabel` attachment. */
  type Label = string | Attachment;

  interface DashOptions {
    len?: number | 'auto';
    gap?: number | 'auto';
    animation?: boolean | AnimOptions;
  }

  interface GradientOptions {
    startColor?: Color | 'auto';
    endColor?: Color | 'auto';
  }

  interface DropShadowOptions {
    dx?: number;
    dy?: number;
    blur?: number;
    color?: Color;
    opacity?: number;
  }

  interface Options {
    start?: Anchor;
    end?: Anchor;
    color?: Color;
    size?: number;
    path?: PathType;
    startSocket?: SocketType;
    endSocket?: SocketType;
    startSocketGravity?: SocketGravity;
    endSocketGravity?: SocketGravity;
    startPlug?: PlugType;
    endPlug?: PlugType;
    startPlugColor?: Color | 'auto';
    endPlugColor?: Color | 'auto';
    startPlugSize?: number;
    endPlugSize?: number;
    outline?: boolean;
    outlineColor?: Color;
    outlineSize?: number;
    startPlugOutline?: boolean;
    endPlugOutline?: boolean;
    startPlugOutlineColor?: Color | 'auto';
    endPlugOutlineColor?: Color | 'auto';
    startPlugOutlineSize?: number;
    endPlugOutlineSize?: number;
    startLabel?: Label;
    middleLabel?: Label;
    endLabel?: Label;
    dash?: boolean | DashOptions;
    gradient?: boolean | GradientOptions;
    dropShadow?: boolean | DropShadowOptions;
  }

  interface ConstructorOptions extends Options {
    /** Create the line hidden; it is shown by `show()`. Only the constructor accepts it. */
    hide?: boolean;
  }

  interface PointAnchorOptions {
    element?: Element;
    x?: Length;
    y?: Length;
  }

  interface AreaAnchorOptions {
    element?: Element;
    shape?: 'rect' | 'circle' | 'polygon';
    x?: Length;
    y?: Length;
    width?: Length;
    height?: Length;
    radius?: number;
    /** Three or more `[x, y]` points, for `shape: 'polygon'`. */
    points?: Array<[Length, Length]>;
    color?: Color;
    fillColor?: Color;
    size?: number;
    dash?: boolean | { len?: number; gap?: number };
  }

  type StyleProperties = { [property: string]: string | null };

  interface MouseHoverAnchorOptions {
    element?: HTMLElement;
    showEffectName?: ShowEffectName;
    animOptions?: AnimOptions;
    style?: StyleProperties;
    hoverStyle?: StyleProperties;
    onSwitch?: (event: Event) => void;
  }

  interface LabelStyleOptions {
    color?: Color;
    outlineColor?: Color;
    fontFamily?: string;
    fontStyle?: string;
    fontVariant?: string;
    fontWeight?: string;
    fontStretch?: string;
    fontSize?: string;
    fontSizeAdjust?: string;
    kerning?: string;
    letterSpacing?: string;
    wordSpacing?: string;
    textDecoration?: string;
  }

  interface CaptionLabelOptions extends LabelStyleOptions {
    text?: string;
    offset?: [number, number];
    lineOffset?: number;
  }

  interface PathLabelOptions extends LabelStyleOptions {
    text?: string;
    lineOffset?: number;
  }
}

declare class LeaderLine {
  constructor(options: LeaderLine.ConstructorOptions);
  constructor(start: LeaderLine.Anchor, end: LeaderLine.Anchor, options?: LeaderLine.ConstructorOptions);

  /** Reposition the lines when the window is resized. Default `true`. */
  static positionByWindowResize: boolean;

  static pointAnchor(options: LeaderLine.PointAnchorOptions & { element: Element }): LeaderLine.Attachment;
  static pointAnchor(element: Element, options?: LeaderLine.PointAnchorOptions): LeaderLine.Attachment;

  static areaAnchor(options: LeaderLine.AreaAnchorOptions & { element: Element }): LeaderLine.Attachment;
  static areaAnchor(element: Element, options?: LeaderLine.AreaAnchorOptions): LeaderLine.Attachment;
  static areaAnchor(
    element: Element,
    shape: LeaderLine.AreaAnchorOptions['shape'],
    options?: LeaderLine.AreaAnchorOptions
  ): LeaderLine.Attachment;

  static mouseHoverAnchor(options: LeaderLine.MouseHoverAnchorOptions & { element: HTMLElement }): LeaderLine.Attachment;
  static mouseHoverAnchor(element: HTMLElement, options?: LeaderLine.MouseHoverAnchorOptions): LeaderLine.Attachment;
  static mouseHoverAnchor(
    element: HTMLElement,
    showEffectName: LeaderLine.ShowEffectName,
    options?: LeaderLine.MouseHoverAnchorOptions
  ): LeaderLine.Attachment;

  static captionLabel(options: LeaderLine.CaptionLabelOptions & { text: string }): LeaderLine.Attachment;
  static captionLabel(text: string, options?: LeaderLine.CaptionLabelOptions): LeaderLine.Attachment;

  static pathLabel(options: LeaderLine.PathLabelOptions & { text: string }): LeaderLine.Attachment;
  static pathLabel(text: string, options?: LeaderLine.PathLabelOptions): LeaderLine.Attachment;

  start: LeaderLine.Anchor;
  end: LeaderLine.Anchor;
  color: LeaderLine.Color;
  size: number;
  path: LeaderLine.PathType;
  startSocket: LeaderLine.SocketType;
  endSocket: LeaderLine.SocketType;
  startSocketGravity: LeaderLine.SocketGravity;
  endSocketGravity: LeaderLine.SocketGravity;
  startPlug: LeaderLine.PlugType;
  endPlug: LeaderLine.PlugType;
  startPlugColor: LeaderLine.Color;
  endPlugColor: LeaderLine.Color;
  startPlugSize: number;
  endPlugSize: number;
  outline: boolean;
  outlineColor: LeaderLine.Color;
  outlineSize: number;
  startPlugOutline: boolean;
  endPlugOutline: boolean;
  startPlugOutlineColor: LeaderLine.Color;
  endPlugOutlineColor: LeaderLine.Color;
  startPlugOutlineSize: number;
  endPlugOutlineSize: number;
  startLabel: LeaderLine.Label;
  middleLabel: LeaderLine.Label;
  endLabel: LeaderLine.Label;
  dash: boolean | LeaderLine.DashOptions;
  gradient: boolean | LeaderLine.GradientOptions;
  dropShadow: boolean | LeaderLine.DropShadowOptions;

  /** Set several options at once, with a single redraw. */
  setOptions(options: LeaderLine.Options): this;
  show(showEffectName?: LeaderLine.ShowEffectName, animOptions?: LeaderLine.AnimOptions): this;
  hide(showEffectName?: LeaderLine.ShowEffectName, animOptions?: LeaderLine.AnimOptions): this;
  /** Recompute the line from the current position and size of its elements. */
  position(): this;
  /** Remove the line from the page. It cannot be used afterwards. */
  remove(): void;
}

export default LeaderLine;
