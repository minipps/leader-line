// The `[DEBUG]` hooks: internals `src/` exposes on `window` for the test pages. The build
// removes them. The helpers and the defs they read in the test pages are the globals of
// `anim.ts`, `defs.js` and `path-data-polyfill.js`, typed from their declarations.

interface Window {
  /** Blink-only; `IS_BLINK` detection. */
  chrome?: unknown;

  // Engine flags, overridable by `engineFlags()`.
  IS_BLINK: boolean;
  IS_GECKO: boolean;
  IS_WEBKIT: boolean;
  engineFlags: any;

  // anim.ts
  animTasks: any[];
  MSPF: number;
  anim_lastPlaying: any;
  anim_watchStart: any;
  anim_watchStop: any;
  anim_watchTimer: any;

  // leader-line.ts
  insProps: any;
  insAttachProps: any;
  EFFECTS: any;
  SHOW_EFFECTS: any;
  ATTACHMENTS: any;
  LeaderLineAttachment: any;
  bindWindow: any;
  copyTree: any;
  extendLine: any;
  forceReflow: any;
  getAllPathDataLen: any;
  getAllPathListLen: any;
  getAlpha: any;
  getBBox: any;
  getBBoxNest: any;
  getCommonWindow: any;
  getCubicLength: any;
  getCubicT: any;
  getIntersection: any;
  getOffsetCubic: any;
  getOffsetLine: any;
  getPointOnCubic: any;
  getPointOnLine: any;
  getPointsLength: any;
  hasChanged: any;
  isElement: any;
  isObject: any;
  mouseEnterLeave: any;
  newDropShadow: any;
  pathDataHasChanged: any;
  pathList2PathData: any;
}
