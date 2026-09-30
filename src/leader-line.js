/*
 * LeaderLine
 * https://anseki.github.io/leader-line/
 *
 * Copyright (c) 2025 anseki
 * Licensed under the MIT license.
 */

// `var`: in a classic script, it is the `LeaderLine` global.
var LeaderLine = (() => {
  'use strict';

  /**
   * An object that simulates `DOMRect` to indicate a bounding-box.
   * @typedef {Object} BBox
   * @property {(number|null)} left - ScreenCTM
   * @property {(number|null)} top - ScreenCTM
   * @property {(number|null)} right - ScreenCTM
   * @property {(number|null)} bottom - ScreenCTM
   * @property {(number|null)} x - Substitutes for left
   * @property {(number|null)} y - Substitutes for top
   * @property {(number|null)} width
   * @property {(number|null)} height
   */

  /**
   * An object that has coordinates of ScreenCTM.
   * @typedef {Object} Point
   * @property {number} x
   * @property {number} y
   */

  /**
   * @typedef {Object} AnimOptions
   * @property {number} duration
   * @property {(string|number[])} timing - FUNC_KEYS or [x1, y1, x2, y2]
   */

  const APP_ID = 'leader-line'; // Supported SVG 2 features

  const SOCKET_TOP = 1;
  const SOCKET_RIGHT = 2;
  const SOCKET_BOTTOM = 3;
  const SOCKET_LEFT = 4;
  const SOCKET_KEY_2_ID = { top: SOCKET_TOP, right: SOCKET_RIGHT, bottom: SOCKET_BOTTOM, left: SOCKET_LEFT };
  const PATH_STRAIGHT = 1;
  const PATH_ARC = 2;
  const PATH_FLUID = 3;
  const PATH_MAGNET = 4;
  const PATH_GRID = 5;

  const PATH_KEY_2_ID = {
    straight: PATH_STRAIGHT,
    arc: PATH_ARC,
    fluid: PATH_FLUID,
    magnet: PATH_MAGNET,
    grid: PATH_GRID
  };

  /**
   * @typedef {Object} SymbolConf
   * @property {string} elmId
   * @property {BBox} bBox
   * @property {number} widthR
   * @property {number} heightR
   * @property {number} bCircle
   * @property {number} sideLen
   * @property {number} backLen
   * @property {number} overhead
   * @property {(boolean|null)} noRotate
   * @property {(number|null)} outlineBase
   * @property {(number|null)} outlineMax
   */

  /** @typedef {{symbolId: string, SymbolConf}} SYMBOLS */

  const PLUG_BEHIND = 'behind';

  const DEFS_ID = APP_ID + '-defs';

  // The build uncomments the first statement, with the code of `src/defs.js`, and drops the second.
  /* [DEBUG/]
  const DEFS_HTML = @INCLUDE[code:DEFS_HTML]@,
    SYMBOLS = @INCLUDE[code:SYMBOLS]@,
    PLUG_KEY_2_ID = @INCLUDE[code:PLUG_KEY_2_ID]@,
    PLUG_2_SYMBOL = @INCLUDE[code:PLUG_2_SYMBOL]@,
    DEFAULT_END_PLUG = @INCLUDE[code:DEFAULT_END_PLUG]@;
  [DEBUG/] */
  // [DEBUG]
  const DEFS_HTML = window.DEFS_HTML,
    SYMBOLS = window.SYMBOLS,
    PLUG_KEY_2_ID = window.PLUG_KEY_2_ID,
    PLUG_2_SYMBOL = window.PLUG_2_SYMBOL,
    DEFAULT_END_PLUG = window.DEFAULT_END_PLUG;
  // [/DEBUG]

  const SOCKET_IDS = [SOCKET_TOP, SOCKET_RIGHT, SOCKET_BOTTOM, SOCKET_LEFT];

  const KEYWORD_AUTO = 'auto';
  const BBOX_PROP = { x: 'left', y: 'top', width: 'width', height: 'height' };
  const MIN_GRAVITY = 80;
  const MIN_GRAVITY_SIZE = 4;
  const MIN_GRAVITY_R = 5;
  const MIN_OH_GRAVITY = 120;
  const MIN_OH_GRAVITY_OH = 8;
  const MIN_OH_GRAVITY_R = 3.75;
  const MIN_ADJUST_LEN = 10;
  const MIN_GRID_LEN = 30;
  const CIRCLE_CP = 0.5522847;
  const CIRCLE_8_RAD = (1 / 4) * Math.PI;
  const RE_PERCENT = /^\s*(-?[\d.]+)\s*(%)?\s*$/;
  const RE_COLOR_FUNC = /^(rgba|hsla|hwb|gray|device-cmyk)\s*\(([\s\S]+)\)$/i;
  const RE_COLOR_ARGS_SEPARATOR = /\s*,\s*/;
  const RE_COLOR_HEX_ALPHA = /^#(?:([\da-f]{6})([\da-f]{2})|([\da-f]{3})([\da-f]))$/i;
  const SVG_NS = 'http://www.w3.org/2000/svg';
  let IS_GECKO = 'MozAppearance' in document.documentElement.style;

  let // Future Gecko might have `window.chrome`.
    IS_BLINK = !IS_GECKO && !!window.chrome && !!window.CSS;

  let IS_WEBKIT =
    !IS_GECKO &&
    !IS_BLINK && // Some engines support `webkit-*` properties.
    !window.chrome &&
    'WebkitAppearance' in document.documentElement.style;

  const SHAPE_GAP = 0.1;

  const DEFAULT_OPTIONS = {
    path: PATH_FLUID,
    lineColor: 'coral',
    lineSize: 4,
    plugSE: [PLUG_BEHIND, DEFAULT_END_PLUG],
    plugSizeSE: [1, 1],
    lineOutlineEnabled: false,
    lineOutlineColor: 'indianred',
    lineOutlineSize: 0.25,
    plugOutlineEnabledSE: [false, false],
    plugOutlineSizeSE: [1, 1]
  };

  const isObject = (() => {
    const toString = {}.toString,
      fnToString = {}.hasOwnProperty.toString,
      objFnString = fnToString.call(Object);
    return (obj) => {
      let proto, constructor;
      return (
        obj &&
        toString.call(obj) === '[object Object]' &&
        (!(proto = Object.getPrototypeOf(obj)) ||
          ((constructor = Object.hasOwn(proto, 'constructor') && proto.constructor) &&
            typeof constructor === 'function' &&
            fnToString.call(constructor) === objFnString))
      );
    };
  })();

  const isFinite = Number.isFinite;

  // The build uncomments the first statement, with the code of the helpers, and drops the second.
  /* [DEBUG/]
  const anim = @INCLUDE[code:anim]@,
    pathDataPolyfill = @INCLUDE[code:pathDataPolyfill]@;
  [DEBUG/] */
  // [DEBUG]
  const anim = window.anim,
    pathDataPolyfill = window.pathDataPolyfill;
  // [/DEBUG]

  /**
   * Wrap `listener` so that it runs at most once per animation frame, with the last event.
   * @param {function} listener - Event listener.
   * @returns {function} Event listener to register.
   */
  const frameThrottle = (listener) => {
    let requestId, lastEvent;
    return (event) => {
      lastEvent = event;
      requestId ??= window.requestAnimationFrame(() => {
        requestId = null;
        listener(lastEvent);
      });
    };
  };

  /**
   * Observability: each instance is an event target of its own (kept here, so that the
   * listeners do not keep a removed instance alive), and `LeaderLine` receives the events of
   * every instance.
   * @type {WeakMap<LeaderLine, EventTarget>}
   */
  const eventTargets = new WeakMap();
  const globalEventTarget = new EventTarget();

  /**
   * Dispatch a `CustomEvent` whose `detail` is `{line, ...detail}` to the instance and to
   * `LeaderLine`. An exception thrown by a listener is reported, it does not stop the update.
   * @param {props} props - `props` of `LeaderLine` instance.
   * @param {string} type - Event type.
   * @param {Object} [detail] - Additional properties of `detail`.
   * @returns {void}
   */
  function emit(props, type, detail) {
    const line = props.instance;
    const target = eventTargets.get(line);
    const init = { detail: { line, ...detail } };
    if (target) {
      target.dispatchEvent(new CustomEvent(type, init));
    }
    globalEventTarget.dispatchEvent(new CustomEvent(type, init));
  }

  /** @typedef {{hasSE, hasProps, iniValue}} StatConf */
  /** @type {{statId: string, StatConf}} */
  const STATS = {
    line_altColor: { iniValue: false },
    line_color: {},
    line_colorTra: { iniValue: false },
    line_strokeWidth: {},
    plug_enabled: { iniValue: false },
    plug_enabledSE: { hasSE: true, iniValue: false },
    plug_plugSE: { hasSE: true, iniValue: PLUG_BEHIND },
    plug_colorSE: { hasSE: true },
    plug_colorTraSE: { hasSE: true, iniValue: false },
    plug_markerWidthSE: { hasSE: true },
    plug_markerHeightSE: { hasSE: true },
    lineOutline_enabled: { iniValue: false },
    lineOutline_color: {},
    lineOutline_colorTra: { iniValue: false },
    lineOutline_strokeWidth: {},
    lineOutline_inStrokeWidth: {},
    plugOutline_enabledSE: { hasSE: true, iniValue: false },
    plugOutline_plugSE: { hasSE: true, iniValue: PLUG_BEHIND },
    plugOutline_colorSE: { hasSE: true },
    plugOutline_colorTraSE: { hasSE: true, iniValue: false },
    plugOutline_strokeWidthSE: { hasSE: true },
    plugOutline_inStrokeWidthSE: { hasSE: true },
    position_socketXYSE: { hasSE: true, hasProps: true },
    position_plugOverheadSE: { hasSE: true },
    position_path: {},
    position_lineStrokeWidth: {},
    position_socketGravitySE: { hasSE: true },
    path_pathData: {},
    path_edge: { hasProps: true },
    viewBox_bBox: { hasProps: true },
    viewBox_plugBCircleSE: { hasSE: true },
    lineMask_enabled: { iniValue: false },
    lineMask_outlineMode: { iniValue: false },
    lineMask_x: {},
    lineMask_y: {},
    lineOutlineMask_x: {},
    lineOutlineMask_y: {},
    maskBGRect_x: {},
    maskBGRect_y: {},
    capsMaskAnchor_enabledSE: { hasSE: true, iniValue: false },
    capsMaskAnchor_pathDataSE: { hasSE: true },
    capsMaskAnchor_strokeWidthSE: { hasSE: true },
    capsMaskMarker_enabled: { iniValue: false },
    capsMaskMarker_enabledSE: { hasSE: true, iniValue: false },
    capsMaskMarker_plugSE: { hasSE: true, iniValue: PLUG_BEHIND },
    capsMaskMarker_markerWidthSE: { hasSE: true },
    capsMaskMarker_markerHeightSE: { hasSE: true },
    caps_enabled: { iniValue: false },
    attach_plugSideLenSE: { hasSE: true },
    attach_plugBackLenSE: { hasSE: true }
  };

  const SHOW_STATS = {
    show_on: {},
    show_effect: {},
    show_animOptions: {},
    show_animId: {},
    show_inAnim: {}
  };

  let EFFECTS;
  let SHOW_EFFECTS;
  let ATTACHMENTS;
  let LeaderLineAttachment;
  const DEFAULT_SHOW_EFFECT = 'fade';
  let isAttachment;
  let removeAttachment;
  let delayedProcs = [];
  let timerDelayedProc;

  /** @type {Object.<_id: number, props>} */
  const insProps = {};

  let insId = 0;

  /** @type {Object.<_id: number, props>} */
  const insAttachProps = {};

  let insAttachId = 0;
  let svg2SupportedReverse;
  let svg2SupportedPaintOrder;
  let svg2SupportedDropShadow;

  // [DEBUG]
  window.insProps = insProps;
  window.insAttachProps = insAttachProps;
  window.isObject = isObject;
  window.IS_BLINK = IS_BLINK;
  window.IS_GECKO = IS_GECKO;
  window.IS_WEBKIT = IS_WEBKIT;
  window.engineFlags = (flags) => {
    if (typeof flags.IS_BLINK === 'boolean') {
      window.IS_BLINK = IS_BLINK = flags.IS_BLINK;
    }
    if (typeof flags.IS_GECKO === 'boolean') {
      window.IS_GECKO = IS_GECKO = flags.IS_GECKO;
    }
    if (typeof flags.IS_WEBKIT === 'boolean') {
      window.IS_WEBKIT = IS_WEBKIT = flags.IS_WEBKIT;
    }
  };
  // [/DEBUG]

  function hasChanged(a, b) {
    let typeA, keysA;
    return (
      typeof a !== typeof b ||
      (typeA = isObject(a) ? 'obj' : Array.isArray(a) ? 'array' : '') !==
        (isObject(b) ? 'obj' : Array.isArray(b) ? 'array' : '') ||
      (typeA === 'obj'
        ? hasChanged((keysA = Object.keys(a).sort()), Object.keys(b).sort()) ||
          keysA.some((prop) => hasChanged(a[prop], b[prop]))
        : typeA === 'array'
          ? a.length !== b.length || a.some((aVal, i) => hasChanged(aVal, b[i]))
          : a !== b)
    );
  }
  window.hasChanged = hasChanged; // [DEBUG/]

  function copyTree(obj) {
    return !obj
      ? obj
      : isObject(obj)
        ? Object.keys(obj).reduce((copyObj, key) => {
            copyObj[key] = copyTree(obj[key]);
            return copyObj;
          }, {})
        : Array.isArray(obj)
          ? obj.map(copyTree)
          : obj;
  }
  window.copyTree = copyTree; // [DEBUG/]

  /**
   * Parse and get an alpha channel in color notation.
   * @param {string} color - A color notation such as `'rgba(10, 20, 30, 0.6)'`.
   * @returns {Array} Alpha channel ([0, 1]) such as `0.6`, and base color. e.g. [0.6, 'rgb(10, 20, 30)']
   */
  function getAlpha(color) {
    let matches,
      func,
      args,
      alpha = 1,
      baseColor = (color = (color + '').trim());

    function parseAlpha(value) {
      let alpha = 1;
      const matches = RE_PERCENT.exec(value);
      if (matches) {
        alpha = parseFloat(matches[1]);
        if (matches[2]) {
          alpha = alpha >= 0 && alpha <= 100 ? alpha / 100 : 1;
        } else if (alpha < 0 || alpha > 1) {
          alpha = 1;
        }
      }
      return alpha;
    }

    // Unsupported: `currentcolor`, `color()`, `deprecated-system-color`
    if ((matches = RE_COLOR_FUNC.exec(color))) {
      func = matches[1].toLowerCase();
      args = matches[2].trim().split(RE_COLOR_ARGS_SEPARATOR);
      if (func === 'rgba' && args.length === 4) {
        alpha = parseAlpha(args[3]);
        baseColor = 'rgb(' + args.slice(0, 3).join(', ') + ')';
      } else if (func === 'hsla' && args.length === 4) {
        alpha = parseAlpha(args[3]);
        baseColor = 'hsl(' + args.slice(0, 3).join(', ') + ')';
      } else if (func === 'hwb' && args.length === 4) {
        alpha = parseAlpha(args[3]);
        baseColor = 'hwb(' + args.slice(0, 3).join(', ') + ')';
      } else if (func === 'gray' && args.length === 2) {
        alpha = parseAlpha(args[1]);
        baseColor = 'gray(' + args[0] + ')';
      } else if (func === 'device-cmyk' && args.length >= 5) {
        alpha = parseAlpha(args[4]);
        baseColor = 'device-cmyk(' + args.slice(0, 4).join(', ') + ')'; // omit <F>
      }
    } else if ((matches = RE_COLOR_HEX_ALPHA.exec(color))) {
      if (matches[1]) {
        alpha = parseInt(matches[2], 16) / 255;
        baseColor = '#' + matches[1];
      } else {
        alpha = parseInt(matches[4] + matches[4], 16) / 255;
        baseColor = '#' + matches[3];
      }
    } else if (color.toLocaleLowerCase() === 'transparent') {
      alpha = 0;
    }
    return [alpha, baseColor];
  }
  window.getAlpha = getAlpha; // [DEBUG/]

  /**
   * Add `mouseenter` and `mouseleave` event listeners to the element.
   * @param {Element} element - Target element.
   * @param {Function} enter - Event listener.
   * @param {Function} leave - Event listener.
   * @returns {Function} Function that removes the added listeners.
   */
  function mouseEnterLeave(element, enter, leave) {
    let over, out;
    if ('onmouseenter' in element && 'onmouseleave' in element) {
      // Supported
      element.addEventListener('mouseenter', enter, false);
      element.addEventListener('mouseleave', leave, false);
      return () => {
        element.removeEventListener('mouseenter', enter, false);
        element.removeEventListener('mouseleave', leave, false);
      };
    } else {
      // Unsupported
      console.warn('mouseenter and mouseleave events polyfill is enabled.');
      over = function (event) {
        if (
          !event.relatedTarget ||
          (event.relatedTarget !== this &&
            !(this.compareDocumentPosition(event.relatedTarget) & Node.DOCUMENT_POSITION_CONTAINED_BY))
        ) {
          enter.apply(this, arguments);
        }
      };
      element.addEventListener('mouseover', over);
      out = function (event) {
        if (
          !event.relatedTarget ||
          (event.relatedTarget !== this &&
            !(this.compareDocumentPosition(event.relatedTarget) & Node.DOCUMENT_POSITION_CONTAINED_BY))
        ) {
          leave.apply(this, arguments);
        }
      };
      element.addEventListener('mouseout', out);
      return () => {
        element.removeEventListener('mouseover', over, false);
        element.removeEventListener('mouseout', out, false);
      };
    }
  }
  window.mouseEnterLeave = mouseEnterLeave; // [DEBUG/]

  function isElement(element) {
    // The checking the interface may not be required.
    // var win, doc;
    // return !!(element && (doc = element.ownerDocument) && (win = doc.defaultView) && win.HTMLElement &&
    //   element instanceof win.HTMLElement);
    return !!(element && element.nodeType === Node.ELEMENT_NODE && typeof element.getBoundingClientRect === 'function');
  }
  window.isElement = isElement; // [DEBUG/]

  /**
   * Get an element's bounding-box that contains coordinates relative to the element's document or window.
   * @param {Element} element - Target element.
   * @param {boolean} [relWindow] - Whether it's relative to the element's window, or document (i.e. `<html>`).
   * @returns {(BBox|null)} A bounding-box or null when failed.
   */
  function getBBox(element, relWindow) {
    const bBox = {};
    let rect;
    let prop;
    let doc;
    let win;
    if (!(doc = element.ownerDocument)) {
      console.error('Cannot get document that contains the element.');
      return null;
    }
    if (element.compareDocumentPosition(doc) & Node.DOCUMENT_POSITION_DISCONNECTED) {
      console.error('A disconnected element was passed.');
      return null;
    }

    rect = element.getBoundingClientRect();
    for (prop in rect) {
      bBox[prop] = rect[prop];
    }

    if (!relWindow) {
      if (!(win = doc.defaultView)) {
        console.error('Cannot get window that contains the element.');
        return null;
      }
      bBox.left += win.pageXOffset;
      bBox.right += win.pageXOffset;
      bBox.top += win.pageYOffset;
      bBox.bottom += win.pageYOffset;
    }

    return bBox;
  }
  window.getBBox = getBBox; // [DEBUG/]

  /**
   * Get distance between an element's bounding-box and its content (`<iframe>` element and its document).
   * @param {Element} element - Target element.
   * @returns {{left: number, top: number}} An object has `left` and `top`.
   */
  function getContentOffset(element) {
    const styles = element.ownerDocument.defaultView.getComputedStyle(element, '');
    return {
      left: element.clientLeft + parseFloat(styles.paddingLeft),
      top: element.clientTop + parseFloat(styles.paddingTop)
    };
  }

  /**
   * Get `<iframe>` elements in path to an element.
   * @param {Element} element - Target element.
   * @param {Window} [baseWindow] - Start searching at this window. This is excluded from result.
   * @returns {(Element[]|null)} An array of `<iframe>` elements or null when `baseWindow` was not found in the path.
   */
  function getFrames(element, baseWindow) {
    const frames = [];
    let curElement = element;
    let doc;
    let win;
    baseWindow = baseWindow || window;
    while (true) {
      if (!(doc = curElement.ownerDocument)) {
        console.error('Cannot get document that contains the element.');
        return null;
      }
      if (!(win = doc.defaultView)) {
        console.error('Cannot get window that contains the element.');
        return null;
      }
      if (win === baseWindow) {
        break;
      }
      if (!(curElement = win.frameElement)) {
        console.error('`baseWindow` was not found.'); // top-level window
        return null;
      }
      frames.unshift(curElement);
    }
    return frames;
  }

  /**
   * Get an element's bounding-box that contains coordinates relative to document of specified window.
   * @param {Element} element - Target element.
   * @param {Window} [baseWindow] - Window that is base of coordinates.
   * @returns {(BBox|null)} A bounding-box or null when failed.
   */
  function getBBoxNest(element, baseWindow) {
    let left = 0,
      top = 0,
      bBox,
      frames;
    baseWindow = baseWindow || window;
    if (!(frames = getFrames(element, baseWindow))) {
      return null;
    }
    if (!frames.length) {
      // no frame
      return getBBox(element);
    }
    frames.forEach((frame, i) => {
      let coordinates = getBBox(frame, i > 0); // relative to document when 1st one.
      left += coordinates.left;
      top += coordinates.top;
      coordinates = getContentOffset(frame);
      left += coordinates.left;
      top += coordinates.top;
    });
    bBox = getBBox(element, true);
    bBox.left += left;
    bBox.right += left;
    bBox.top += top;
    bBox.bottom += top;
    return bBox;
  }
  window.getBBoxNest = getBBoxNest; // [DEBUG/]

  /**
   * Get a common ancestor window.
   * @param {Element} elm1 - A contained element.
   * @param {Element} elm2 - A contained element.
   * @returns {Window} A common ancestor window.
   */
  function getCommonWindow(elm1, elm2) {
    let frames1, frames2, commonWindow;
    if (!(frames1 = getFrames(elm1)) || !(frames2 = getFrames(elm2))) {
      throw new Error('Cannot get frames.');
    }
    if (frames1.length && frames2.length) {
      frames1.reverse();
      frames2.reverse();
      frames1.some((frame1) =>
        frames2.some((frame2) => {
          if (frame2 === frame1) {
            commonWindow = frame2.contentWindow;
            return true;
          }
          return false;
        })
      );
    }
    return commonWindow || window;
  }
  window.getCommonWindow = getCommonWindow; // [DEBUG/]

  function getPointsLength(p0, p1) {
    const lx = p0.x - p1.x,
      ly = p0.y - p1.y;
    return Math.sqrt(lx * lx + ly * ly);
  }
  window.getPointsLength = getPointsLength; // [DEBUG/]

  function getPointOnLine(p0, p1, r) {
    const xA = p1.x - p0.x,
      yA = p1.y - p0.y;
    return {
      x: p0.x + xA * r,
      y: p0.y + yA * r,
      angle: Math.atan2(yA, xA) / (Math.PI / 180)
    };
  }
  window.getPointOnLine = getPointOnLine; // [DEBUG/]

  function getIntersection(line1P0, line1P1, line2P0, line2P1) {
    const sx1 = line1P1.x - line1P0.x,
      sy1 = line1P1.y - line1P0.y,
      sx2 = line2P1.x - line2P0.x,
      sy2 = line2P1.y - line2P0.y,
      s = (-sy1 * (line1P0.x - line2P0.x) + sx1 * (line1P0.y - line2P0.y)) / (-sx2 * sy1 + sx1 * sy2),
      t = (sx2 * (line1P0.y - line2P0.y) - sy2 * (line1P0.x - line2P0.x)) / (-sx2 * sy1 + sx1 * sy2);

    return s >= 0 && s <= 1 && t >= 0 && t <= 1 ? { x: line1P0.x + t * sx1, y: line1P0.y + t * sy1 } : null;
  }
  window.getIntersection = getIntersection; // [DEBUG/]

  function extendLine(p0, p1, len) {
    const angle = Math.atan2(p0.y - p1.y, p1.x - p0.x);
    return { x: p1.x + Math.cos(angle) * len, y: p1.y + Math.sin(angle) * len * -1 };
  }
  window.extendLine = extendLine; // [DEBUG/]

  function getPointOnCubic(p0, p1, p2, p3, t) {
    const t2 = t * t;
    const t3 = t2 * t;
    const t1 = 1 - t;
    const t12 = t1 * t1;
    const t13 = t12 * t1;
    const x = t13 * p0.x + 3 * t12 * t * p1.x + 3 * t1 * t2 * p2.x + t3 * p3.x;
    const y = t13 * p0.y + 3 * t12 * t * p1.y + 3 * t1 * t2 * p2.y + t3 * p3.y;
    const mx = p0.x + 2 * t * (p1.x - p0.x) + t2 * (p2.x - 2 * p1.x + p0.x);
    const my = p0.y + 2 * t * (p1.y - p0.y) + t2 * (p2.y - 2 * p1.y + p0.y);
    const nx = p1.x + 2 * t * (p2.x - p1.x) + t2 * (p3.x - 2 * p2.x + p1.x);
    const ny = p1.y + 2 * t * (p2.y - p1.y) + t2 * (p3.y - 2 * p2.y + p1.y);
    const ax = t1 * p0.x + t * p1.x;
    const ay = t1 * p0.y + t * p1.y;
    const cx = t1 * p2.x + t * p3.x;
    const cy = t1 * p2.y + t * p3.y;
    let angle = 90 - (Math.atan2(mx - nx, my - ny) * 180) / Math.PI;

    angle += angle > 180 ? -180 : 180;
    // from:  new path of side to p0
    // to:    new path of side to p3
    return {
      x,
      y,
      fromP2: { x: mx, y: my },
      toP1: { x: nx, y: ny },
      fromP1: { x: ax, y: ay },
      toP2: { x: cx, y: cy },
      angle
    };
  }
  window.getPointOnCubic = getPointOnCubic; // [DEBUG/]

  function getCubicLength(p0, p1, p2, p3, t) {
    function base3(t, p0v, p1v, p2v, p3v) {
      return t * (t * (-3 * p0v + 9 * p1v - 9 * p2v + 3 * p3v) + 6 * p0v - 12 * p1v + 6 * p2v) - 3 * p0v + 3 * p1v;
    }

    const TVALUES = [
      -0.1252, 0.1252, -0.3678, 0.3678, -0.5873, 0.5873, -0.7699, 0.7699, -0.9041, 0.9041, -0.9816, 0.9816
    ];

    const CVALUES = [0.2491, 0.2491, 0.2335, 0.2335, 0.2032, 0.2032, 0.1601, 0.1601, 0.1069, 0.1069, 0.0472, 0.0472];
    let sum = 0;
    let z2;
    let ct;
    let xbase;
    let ybase;
    let comb;

    t = t == null || t > 1 ? 1 : t < 0 ? 0 : t;
    z2 = t / 2;
    TVALUES.forEach((tValue, i) => {
      ct = z2 * tValue + z2;
      xbase = base3(ct, p0.x, p1.x, p2.x, p3.x);
      ybase = base3(ct, p0.y, p1.y, p2.y, p3.y);
      comb = xbase * xbase + ybase * ybase;
      sum += CVALUES[i] * Math.sqrt(comb);
    });
    return z2 * sum;
  }
  window.getCubicLength = getCubicLength; // [DEBUG/]

  function getCubicT(p0, p1, p2, p3, len) {
    const E = 0.01;
    let step = 1 / 2;
    let t2 = 1 - step;
    let l;
    while (true) {
      l = getCubicLength(p0, p1, p2, p3, t2);
      if (Math.abs(l - len) <= E) {
        break;
      }
      step /= 2;
      t2 += (l < len ? 1 : -1) * step;
    }
    return t2;
  }
  window.getCubicT = getCubicT; // [DEBUG/]

  function getOffsetLine(p0, p1, offsetLen) {
    const angle = Math.atan2(p0.y - p1.y, p1.x - p0.x) + Math.PI * 0.5;
    return [
      { x: p0.x + Math.cos(angle) * offsetLen, y: p0.y + Math.sin(angle) * offsetLen * -1 },
      { x: p1.x + Math.cos(angle) * offsetLen, y: p1.y + Math.sin(angle) * offsetLen * -1 }
    ];
  }
  window.getOffsetLine = getOffsetLine; // [DEBUG/]

  function getOffsetCubic(p0, p1, p2, p3, offsetLen, stepLen) {
    const parts = getCubicLength(p0, p1, p2, p3) / stepLen;
    const tStep = 1 / (offsetLen > stepLen ? parts * (offsetLen / stepLen) : parts);
    const points = [];
    let pointOnPath;
    let angle;
    let t = 0;

    while (true) {
      pointOnPath = getPointOnCubic(p0, p1, p2, p3, t);
      angle = (-pointOnPath.angle + 90) * (Math.PI / 180);
      points.push({
        x: pointOnPath.x + Math.cos(angle) * offsetLen,
        y: pointOnPath.y + Math.sin(angle) * offsetLen * -1
      });
      if (t >= 1) {
        break;
      }
      t += tStep;
      if (t > 1) {
        t = 1;
      }
    }
    return points;
  }
  window.getOffsetCubic = getOffsetCubic; // [DEBUG/]

  function pathList2PathData(pathList, cbPoint) {
    let pathData;
    pathList.forEach((pointsOrg) => {
      const points = cbPoint
        ? pointsOrg.map((pointOrg) => {
            const point = { x: pointOrg.x, y: pointOrg.y };
            cbPoint(point);
            return point;
          })
        : pointsOrg;
      // error is thrown if `points` has no data
      if (!pathData) {
        pathData = [{ type: 'M', values: [points[0].x, points[0].y] }];
      }
      pathData.push(
        !points.length
          ? { type: 'Z', values: [] }
          : points.length === 2
            ? { type: 'L', values: [points[1].x, points[1].y] }
            : { type: 'C', values: [points[1].x, points[1].y, points[2].x, points[2].y, points[3].x, points[3].y] }
      );
    });
    return pathData;
  }
  window.pathList2PathData = pathList2PathData; // [DEBUG/]

  function getAllPathListLen(pathList) {
    const pathSegsLen = [];
    let pathLenAll = 0;
    pathList.forEach((points) => {
      const pathLen = (points.length === 2 ? getPointsLength : getCubicLength)(...points);
      pathSegsLen.push(pathLen);
      pathLenAll += pathLen;
    });
    return { segsLen: pathSegsLen, lenAll: pathLenAll };
  }
  window.getAllPathListLen = getAllPathListLen; // [DEBUG/]

  function getAllPathDataLen(pathData) {
    let curPoint;
    return pathData.reduce((pathLenAll, pathSeg) => {
      const values = pathSeg.values;
      let endPoint;
      switch (pathSeg.type) {
        case 'M':
          curPoint = { x: values[0], y: values[1] };
          break;
        case 'L':
          endPoint = { x: values[0], y: values[1] };
          if (curPoint) {
            pathLenAll += getPointsLength(curPoint, endPoint);
          }
          curPoint = endPoint;
          break;
        case 'C':
          endPoint = { x: values[4], y: values[5] };
          if (curPoint) {
            pathLenAll += getCubicLength(
              curPoint,
              { x: values[0], y: values[1] },
              { x: values[2], y: values[3] },
              endPoint
            );
          }
          curPoint = endPoint;
          break;
        // no default
      }
      return pathLenAll;
    }, 0);
  }
  window.getAllPathDataLen = getAllPathDataLen; // [DEBUG/]

  function pathDataHasChanged(a, b) {
    return (
      a == null ||
      b == null ||
      a.length !== b.length ||
      a.some((aSeg, i) => {
        const bSeg = b[i];
        return aSeg.type !== bSeg.type || aSeg.values.some((aSegValue, i) => aSegValue !== bSeg.values[i]);
      })
    );
  }
  window.pathDataHasChanged = pathDataHasChanged; // [DEBUG/]

  function bBox2PathData(bBox) {
    const right = bBox.right ?? bBox.left + bBox.width,
      bottom = bBox.bottom ?? bBox.top + bBox.height;
    return [
      { type: 'M', values: [bBox.left, bBox.top] },
      { type: 'L', values: [right, bBox.top] },
      { type: 'L', values: [right, bottom] },
      { type: 'L', values: [bBox.left, bottom] },
      { type: 'Z', values: [] }
    ];
  }

  function addEventHandler(props, type, handler) {
    if (!props.events[type]) {
      props.events[type] = [handler];
    } else if (!props.events[type].includes(handler)) {
      props.events[type].push(handler);
    }
  }

  function removeEventHandler(props, type, handler) {
    let i;
    if (props.events[type] && (i = props.events[type].indexOf(handler)) > -1) {
      props.events[type].splice(i, 1);
    }
  }

  function addDelayedProc(proc) {
    function execDelayedProcs() {
      traceLog.add('<execDelayedProcs>'); // [DEBUG/]
      delayedProcs.forEach((proc) => {
        proc();
      });
      delayedProcs = [];
      traceLog.add('</execDelayedProcs>'); // [DEBUG/]
    }
    if (timerDelayedProc) {
      clearTimeout(timerDelayedProc);
    }
    delayedProcs.push(proc);
    timerDelayedProc = setTimeout(execDelayedProcs, 0);
  }

  function forceReflow(target) {
    // for BLINK bug (reflow like `offsetWidth` can't update)
    setTimeout(() => {
      const parent = target.parentNode,
        next = target.nextSibling;
      // It has to be removed first for BLINK.
      parent.insertBefore(parent.removeChild(target), next);
    }, 0);
  }
  window.forceReflow = forceReflow; // [DEBUG/]

  function forceReflowAdd(props, target) {
    if (!props.reflowTargets.includes(target)) {
      props.reflowTargets.push(target);
    }
  }

  function forceReflowApply(props) {
    props.reflowTargets.forEach((target) => {
      forceReflow(target);
    });
    props.reflowTargets = [];
  }

  /**
   * Apply `viewBox` to an element that has the attribute.
   * Writing to `viewBox.baseVal` is not enough: a browser may hand back a rect that is
   * not tied to the attribute (e.g. when it was absent), and then the element is left
   * without a user space of its own and the shapes in it are painted offset by the
   * position of the element. The attribute is always honored.
   * @param {SVGElement} element - `<svg>` or `<marker>` element.
   * @param {{x: number, y: number, width: number, height: number}} bBox - The rect.
   * @returns {void}
   */
  function setViewBox(element, bBox) {
    element.setAttribute('viewBox', [bBox.x, bBox.y, bBox.width, bBox.height].join(' '));
  }

  /**
   * Apply `orient` (and `viewBox`) to `marker`.
   * @param {props} props - `props` of `LeaderLine` instance.
   * @param {SVGMarkerElement} marker - Target `<marker>` element.
   * @param {string} orient - `'auto'`, `'auto-start-reverse'` or angle.
   * @param {BBox} bBox - `BBox` as `viewBox` of the marker.
   * @param {SVGSVGElement} svg - Parent `<svg>` element.
   * @param {SVGElement} shape - An element that is shown as marker.
   * @returns {void}
   */
  function setMarkerOrient(props, marker, orient, bBox, svg, shape) {
    let transform, reverseView;
    // `setOrientToAuto()`, `setOrientToAngle()`, `orientType` and `orientAngle` of
    // `SVGMarkerElement` don't work in browsers other than Chrome.
    if (orient === 'auto-start-reverse') {
      if (typeof svg2SupportedReverse !== 'boolean') {
        marker.setAttribute('orient', 'auto-start-reverse');
        svg2SupportedReverse = marker.orientType.baseVal === SVGMarkerElement.SVG_MARKER_ORIENT_UNKNOWN;
      }
      if (svg2SupportedReverse) {
        marker.setAttribute('orient', orient);
      } else {
        transform = svg.createSVGTransform();
        transform.setRotate(180, 0, 0);
        shape.transform.baseVal.appendItem(transform);
        marker.setAttribute('orient', 'auto');
        reverseView = true;
      }
    } else {
      marker.setAttribute('orient', orient);
      if (svg2SupportedReverse === false) {
        shape.transform.baseVal.clear();
      }
    }

    setViewBox(marker, {
      x: reverseView ? -bBox.right : bBox.left,
      y: reverseView ? -bBox.bottom : bBox.top,
      width: bBox.width,
      height: bBox.height
    });
  }

  function getMarkerProps(i, symbolConf) {
    return {
      prop: i ? 'markerEnd' : 'markerStart',
      orient: !symbolConf ? null : symbolConf.noRotate ? '0' : i ? 'auto' : 'auto-start-reverse'
    };
  }

  /**
   * @param {Document} document - document
   * @param {string} id - id
   * @returns {Object} {elmFilter, elmOffset, elmBlur, styleFlood, elmsAppend}
   */
  function newDropShadow(document, id) {
    const dropShadow = {};
    let filter;
    let element;

    if (typeof svg2SupportedDropShadow !== 'boolean') {
      // [WEBKIT] stdDeviation has bug
      svg2SupportedDropShadow = !!window.SVGFEDropShadowElement && !IS_WEBKIT;
    }

    dropShadow.elmsAppend = [(dropShadow.elmFilter = filter = document.createElementNS(SVG_NS, 'filter'))];
    // sizing for GECKO
    filter.filterUnits.baseVal = SVGUnitTypes.SVG_UNIT_TYPE_USERSPACEONUSE;
    filter.x.baseVal.newValueSpecifiedUnits(SVGLength.SVG_LENGTHTYPE_PX, 0);
    filter.y.baseVal.newValueSpecifiedUnits(SVGLength.SVG_LENGTHTYPE_PX, 0);
    filter.width.baseVal.newValueSpecifiedUnits(SVGLength.SVG_LENGTHTYPE_PERCENTAGE, 100);
    filter.height.baseVal.newValueSpecifiedUnits(SVGLength.SVG_LENGTHTYPE_PERCENTAGE, 100);
    filter.id = id;

    if (svg2SupportedDropShadow) {
      dropShadow.elmOffset =
        dropShadow.elmBlur =
        element =
          filter.appendChild(document.createElementNS(SVG_NS, 'feDropShadow'));
      dropShadow.styleFlood = element.style;
    } else {
      dropShadow.elmBlur = filter.appendChild(document.createElementNS(SVG_NS, 'feGaussianBlur'));
      dropShadow.elmOffset = element = filter.appendChild(document.createElementNS(SVG_NS, 'feOffset'));
      element.result.baseVal = 'offsetblur';
      element = filter.appendChild(document.createElementNS(SVG_NS, 'feFlood'));
      dropShadow.styleFlood = element.style;
      element = filter.appendChild(document.createElementNS(SVG_NS, 'feComposite'));
      element.in2.baseVal = 'offsetblur';
      element.operator.baseVal = SVGFECompositeElement.SVG_FECOMPOSITE_OPERATOR_IN;
      element = filter.appendChild(document.createElementNS(SVG_NS, 'feMerge'));
      element.appendChild(document.createElementNS(SVG_NS, 'feMergeNode'));
      element.appendChild(document.createElementNS(SVG_NS, 'feMergeNode')).in1.baseVal = 'SourceGraphic';
    }
    return dropShadow;
  }
  window.newDropShadow = newDropShadow; // [DEBUG/]

  function initStats(container, statsConf) {
    Object.keys(statsConf).forEach((statName) => {
      const statConf = statsConf[statName];
      container[statName] =
        statConf.iniValue != null
          ? statConf.hasSE
            ? [statConf.iniValue, statConf.iniValue]
            : statConf.iniValue
          : statConf.hasSE
            ? statConf.hasProps
              ? [{}, {}]
              : []
            : statConf.hasProps
              ? {}
              : null;
    });
  }

  function setStat(props, container, key, value, eventHandlers /* [DEBUG] */, log /* [/DEBUG] */) {
    if (value !== container[key]) {
      traceLog.add(log || key + '=%s', value); // [DEBUG/]
      container[key] = value;
      if (eventHandlers) {
        eventHandlers.forEach((handler) => {
          handler(props, value, key);
        });
      }
      return true;
    }
    return false;
  }

  /**
   * Get distance between `window` and its `<body>`.
   * @param {Window} window - Target `window`.
   * @returns {{x: number, y: number}} Length.
   */
  function getBodyOffset(window) {
    function sumProps(value, addValue) {
      return (value += parseFloat(addValue));
    }

    const baseDocument = window.document,
      stylesHtml = window.getComputedStyle(baseDocument.documentElement, ''),
      stylesBody = window.getComputedStyle(baseDocument.body, ''),
      bodyOffset = { x: 0, y: 0 };

    if (stylesBody.position !== 'static') {
      // When `<body>` has `position:(non-static)`,
      // `element{position:absolute}` is positioned relative to border-box of `<body>`.
      bodyOffset.x -= [
        stylesHtml.marginLeft,
        stylesHtml.borderLeftWidth,
        stylesHtml.paddingLeft,
        stylesBody.marginLeft,
        stylesBody.borderLeftWidth
      ].reduce(sumProps, 0);
      bodyOffset.y -= [
        stylesHtml.marginTop,
        stylesHtml.borderTopWidth,
        stylesHtml.paddingTop,
        stylesBody.marginTop,
        stylesBody.borderTopWidth
      ].reduce(sumProps, 0);
    } else if (stylesHtml.position !== 'static') {
      // When `<body>` has `position:static` and `<html>` has `position:(non-static)`
      // `element{position:absolute}` is positioned relative to border-box of `<html>`.
      bodyOffset.x -= [stylesHtml.marginLeft, stylesHtml.borderLeftWidth].reduce(sumProps, 0);
      bodyOffset.y -= [stylesHtml.marginTop, stylesHtml.borderTopWidth].reduce(sumProps, 0);
    }
    return bodyOffset;
  }

  function setupWindow(window) {
    const baseDocument = window.document;
    let defsSvg;
    if (!baseDocument.getElementById(DEFS_ID)) {
      // Add svg defs
      defsSvg = new window.DOMParser().parseFromString(DEFS_HTML, 'image/svg+xml');
      baseDocument.body.appendChild(defsSvg.documentElement);
      pathDataPolyfill(window, IS_GECKO);
    }
  }

  /**
   * Setup `baseWindow`, stats (`cur*` and `apl*`), SVG elements, etc.
   * @param {props} props - `props` of `LeaderLine` instance.
   * @param {Window} newWindow - A common ancestor `window`.
   * @returns {void}
   */
  function bindWindow(props, newWindow) {
    traceLog.add('<bindWindow>'); // [DEBUG/]
    const aplStats = props.aplStats;
    const baseDocument = newWindow.document;
    let svg;
    let defs;
    let maskCaps;
    let element;
    const prefix = APP_ID + '-' + props._id;
    let linePathId;
    let lineShapeId;
    let capsId;
    let maskBGRectId;
    let lineOutlineMaskId;
    let plugOutlineMaskIdSE;

    function setupMask(id) {
      const element = defs.appendChild(baseDocument.createElementNS(SVG_NS, 'mask'));
      element.id = id;
      element.maskUnits.baseVal = SVGUnitTypes.SVG_UNIT_TYPE_USERSPACEONUSE;
      [element.x, element.y, element.width, element.height].forEach((len) => {
        len.baseVal.newValueSpecifiedUnits(SVGLength.SVG_LENGTHTYPE_PX, 0);
      });
      return element;
    }

    function setupMarker(id) {
      const element = defs.appendChild(baseDocument.createElementNS(SVG_NS, 'marker'));
      element.id = id;
      element.markerUnits.baseVal = SVGMarkerElement.SVG_MARKERUNITS_STROKEWIDTH;
      element.setAttribute('viewBox', '0 0 0 0');
      return element;
    }

    function setWH100(element) {
      [element.width, element.height].forEach((len) => {
        len.baseVal.newValueSpecifiedUnits(SVGLength.SVG_LENGTHTYPE_PERCENTAGE, 100);
      });
      return element;
    }

    props.pathList = {};
    // Init stats
    initStats(aplStats, STATS);
    // effect (before props.svg is changed)
    Object.keys(EFFECTS).forEach((effectName) => {
      const keyEnabled = effectName + '_enabled';
      if (aplStats[keyEnabled]) {
        EFFECTS[effectName].remove(props);
        aplStats[keyEnabled] = false; // it might not have been disabled by remove().
      }
    });

    if (props.baseWindow && props.svg) {
      props.baseWindow.document.body.removeChild(props.svg);
    }
    props.baseWindow = newWindow;
    setupWindow(newWindow);
    props.bodyOffset = getBodyOffset(newWindow); // Get `bodyOffset`

    // Main SVG
    props.svg = svg = baseDocument.createElementNS(SVG_NS, 'svg');
    svg.className.baseVal = APP_ID;
    svg.setAttribute('viewBox', '0 0 0 0');
    props.defs = defs = svg.appendChild(baseDocument.createElementNS(SVG_NS, 'defs'));

    props.linePath = element = defs.appendChild(baseDocument.createElementNS(SVG_NS, 'path'));
    element.id = linePathId = prefix + '-line-path';
    element.className.baseVal = APP_ID + '-line-path';
    if (IS_WEBKIT) {
      // [WEBKIT] style in `use` is not updated
      element.style.fill = 'none';
    }

    props.lineShape = element = defs.appendChild(baseDocument.createElementNS(SVG_NS, 'use'));
    element.id = lineShapeId = prefix + '-line-shape';
    element.href.baseVal = '#' + linePathId;

    maskCaps = defs.appendChild(baseDocument.createElementNS(SVG_NS, 'g'));
    maskCaps.id = capsId = prefix + '-caps';

    props.capsMaskAnchorSE = [0, 1].map(() => {
      const element = maskCaps.appendChild(baseDocument.createElementNS(SVG_NS, 'path'));
      element.className.baseVal = APP_ID + '-caps-mask-anchor';
      return element;
    });

    props.lineMaskMarkerIdSE = [prefix + '-caps-mask-marker-0', prefix + '-caps-mask-marker-1'];
    props.capsMaskMarkerSE = [0, 1].map((i) => setupMarker(props.lineMaskMarkerIdSE[i]));
    props.capsMaskMarkerShapeSE = [0, 1].map((i) => {
      const element = props.capsMaskMarkerSE[i].appendChild(baseDocument.createElementNS(SVG_NS, 'use'));
      element.className.baseVal = APP_ID + '-caps-mask-marker-shape';
      return element;
    });

    props.capsMaskLine = element = maskCaps.appendChild(baseDocument.createElementNS(SVG_NS, 'use'));
    element.className.baseVal = APP_ID + '-caps-mask-line';
    element.href.baseVal = '#' + lineShapeId;

    props.maskBGRect = element = setWH100(defs.appendChild(baseDocument.createElementNS(SVG_NS, 'rect')));
    element.id = maskBGRectId = prefix + '-mask-bg-rect';
    element.className.baseVal = APP_ID + '-mask-bg-rect';
    if (IS_WEBKIT) {
      // [WEBKIT] style in `use` is not updated
      element.style.fill = 'white';
    }

    // lineMask
    props.lineMask = setWH100(setupMask((props.lineMaskId = prefix + '-line-mask')));
    props.lineMaskBG = element = props.lineMask.appendChild(baseDocument.createElementNS(SVG_NS, 'use'));
    element.href.baseVal = '#' + maskBGRectId;
    props.lineMaskShape = element = props.lineMask.appendChild(baseDocument.createElementNS(SVG_NS, 'use'));
    element.className.baseVal = APP_ID + '-line-mask-shape';
    element.href.baseVal = '#' + linePathId;
    element.style.display = 'none';
    props.lineMaskCaps = element = props.lineMask.appendChild(baseDocument.createElementNS(SVG_NS, 'use'));
    element.href.baseVal = '#' + capsId;

    // lineOutlineMask
    props.lineOutlineMask = setWH100(setupMask((lineOutlineMaskId = prefix + '-line-outline-mask')));
    element = props.lineOutlineMask.appendChild(baseDocument.createElementNS(SVG_NS, 'use'));
    element.href.baseVal = '#' + maskBGRectId;
    props.lineOutlineMaskShape = element = props.lineOutlineMask.appendChild(
      baseDocument.createElementNS(SVG_NS, 'use')
    );
    element.className.baseVal = APP_ID + '-line-outline-mask-shape';
    element.href.baseVal = '#' + linePathId;
    props.lineOutlineMaskCaps = element = props.lineOutlineMask.appendChild(
      baseDocument.createElementNS(SVG_NS, 'use')
    );
    element.href.baseVal = '#' + capsId;

    /* reserve for future version
    props.lineFGId = prefix + '-line-fg';
    props.lineFG = elmDefs.appendChild(baseDocument.createElementNS(SVG_NS, 'g'));
    props.lineFG.id = props.lineFGId;
    props.lineFGRect = setWH100(props.lineFG.appendChild(baseDocument.createElementNS(SVG_NS, 'rect')));
    */

    props.face = svg.appendChild(baseDocument.createElementNS(SVG_NS, 'g'));
    props.lineFace = element = props.face.appendChild(baseDocument.createElementNS(SVG_NS, 'use'));
    element.href.baseVal = '#' + lineShapeId;

    props.lineOutlineFace = element = props.face.appendChild(baseDocument.createElementNS(SVG_NS, 'use'));
    element.href.baseVal = '#' + lineShapeId;
    element.style.mask = 'url(#' + lineOutlineMaskId + ')';
    element.style.display = 'none';

    // plugMaskSE
    props.plugMaskIdSE = [prefix + '-plug-mask-0', prefix + '-plug-mask-1'];
    props.plugMaskSE = [0, 1].map((i) => setupMask(props.plugMaskIdSE[i]));
    props.plugMaskShapeSE = [0, 1].map((i) => {
      const element = props.plugMaskSE[i].appendChild(baseDocument.createElementNS(SVG_NS, 'use'));
      element.className.baseVal = APP_ID + '-plug-mask-shape';
      return element;
    });

    // plugOutlineMaskSE
    plugOutlineMaskIdSE = [];
    props.plugOutlineMaskSE = [0, 1].map((i) =>
      setupMask((plugOutlineMaskIdSE[i] = prefix + '-plug-outline-mask-' + i))
    );
    props.plugOutlineMaskShapeSE = [0, 1].map((i) => {
      const element = props.plugOutlineMaskSE[i].appendChild(baseDocument.createElementNS(SVG_NS, 'use'));
      element.className.baseVal = APP_ID + '-plug-outline-mask-shape';
      return element;
    });

    props.plugMarkerIdSE = [prefix + '-plug-marker-0', prefix + '-plug-marker-1'];
    props.plugMarkerSE = [0, 1].map((i) => {
      const element = setupMarker(props.plugMarkerIdSE[i]);
      if (IS_WEBKIT) {
        // [WEBKIT] mask in marker is resized with rasterise
        element.markerUnits.baseVal = SVGMarkerElement.SVG_MARKERUNITS_USERSPACEONUSE;
      }
      return element;
    });
    props.plugMarkerShapeSE = [0, 1].map((i) =>
      props.plugMarkerSE[i].appendChild(baseDocument.createElementNS(SVG_NS, 'g'))
    );

    props.plugFaceSE = [0, 1].map((i) =>
      props.plugMarkerShapeSE[i].appendChild(baseDocument.createElementNS(SVG_NS, 'use'))
    );
    props.plugOutlineFaceSE = [0, 1].map((i) => {
      const element = props.plugMarkerShapeSE[i].appendChild(baseDocument.createElementNS(SVG_NS, 'use'));
      element.style.mask = 'url(#' + plugOutlineMaskIdSE[i] + ')';
      element.style.display = 'none';
      return element;
    });

    props.plugsFace = element = props.face.appendChild(baseDocument.createElementNS(SVG_NS, 'use'));
    element.className.baseVal = APP_ID + '-plugs-face';
    element.href.baseVal = '#' + lineShapeId;
    element.style.display = 'none';

    // show effect (after SVG setup)
    if (props.curStats.show_inAnim) {
      props.isShown = 1;
      SHOW_EFFECTS[aplStats.show_effect].stop(props, true); // svgShow() is called
    } else if (!props.isShown) {
      svg.style.visibility = 'hidden';
    }

    baseDocument.body.appendChild(svg);

    // label (after appendChild(svg), bBox is used)
    [0, 1, 2].forEach((i) => {
      const label = props.options.labelSEM[i];
      let attachProps;
      if (label && isAttachment(label, 'label')) {
        attachProps = insAttachProps[label._id];
        if (attachProps.conf.initSvg) {
          attachProps.conf.initSvg(attachProps, props);
        }
      }
    });

    traceLog.add('</bindWindow>'); // [DEBUG/]
  }
  window.bindWindow = bindWindow; // [DEBUG/]

  /**
   * @param {props} props - `props` of `LeaderLine` instance.
   * @returns {boolean} `true` if it was changed.
   */
  function updateLine(props) {
    traceLog.add('<updateLine>'); // [DEBUG/]
    const options = props.options;
    const curStats = props.curStats;
    const events = props.events;
    let updated = false;

    updated = setStat(props, curStats, 'line_color', options.lineColor, events.cur_line_color) || updated;
    updated = setStat(props, curStats, 'line_colorTra', getAlpha(curStats.line_color)[0] < 1) || updated;
    updated = setStat(props, curStats, 'line_strokeWidth', options.lineSize, events.cur_line_strokeWidth) || updated;

    // [DEBUG]

    if (!updated) {
      traceLog.add('not-updated');
    }

    // [/DEBUG]
    traceLog.add('</updateLine>'); // [DEBUG/]
    return updated;
  }

  /**
   * @param {props} props - `props` of `LeaderLine` instance.
   * @returns {boolean} `true` if it was changed.
   */
  function updatePlug(props) {
    traceLog.add('<updatePlug>'); // [DEBUG/]
    const options = props.options;
    const curStats = props.curStats;
    const events = props.events;
    let updated = false;

    [0, 1].forEach((i) => {
      const plugId = options.plugSE[i];
      let symbolConf;
      let width;
      let height;
      let plugMarkerWidth;
      let plugMarkerHeight;
      let plugSideLen;
      let plugBackLen;
      let value;

      updated =
        setStat(
          props,
          curStats.plug_enabledSE,
          i,
          plugId !== PLUG_BEHIND,
          /* [DEBUG] */ null,
          'plug_enabledSE[' + i + ']=%s' /* [/DEBUG] */
        ) || updated;
      updated =
        setStat(
          props,
          curStats.plug_plugSE,
          i,
          plugId,
          /* [DEBUG] */ null,
          'plug_plugSE[' + i + ']=%s' /* [/DEBUG] */
        ) || updated;
      updated =
        setStat(
          props,
          curStats.plug_colorSE,
          i,
          (value = options.plugColorSE[i] || curStats.line_color),
          events.cur_plug_colorSE /* [DEBUG] */,
          'plug_colorSE[' + i + ']=%s' /* [/DEBUG] */
        ) || updated;
      updated =
        setStat(
          props,
          curStats.plug_colorTraSE,
          i,
          getAlpha(value)[0] < 1,
          /* [DEBUG] */ null,
          'plug_colorTraSE[' + i + ']=%s' /* [/DEBUG] */
        ) || updated;

      if (plugId !== PLUG_BEHIND) {
        // Not depend on `curStats.plug_enabledSE`
        symbolConf = SYMBOLS[PLUG_2_SYMBOL[plugId]];
        plugMarkerWidth = width = symbolConf.widthR * options.plugSizeSE[i];
        plugMarkerHeight = height = symbolConf.heightR * options.plugSizeSE[i];
        if (IS_WEBKIT) {
          // [WEBKIT] mask in marker is resized with rasterise
          plugMarkerWidth *= curStats.line_strokeWidth;
          plugMarkerHeight *= curStats.line_strokeWidth;
        }

        updated =
          setStat(
            props,
            curStats.plug_markerWidthSE,
            i,
            plugMarkerWidth,
            /* [DEBUG] */ null,
            'plug_markerWidthSE[' + i + ']%_' /* [/DEBUG] */
          ) || updated;
        updated =
          setStat(
            props,
            curStats.plug_markerHeightSE,
            i,
            plugMarkerHeight,
            /* [DEBUG] */ null,
            'plug_markerHeightSE[' + i + ']%_' /* [/DEBUG] */
          ) || updated;

        curStats.capsMaskMarker_markerWidthSE[i] = width;
        curStats.capsMaskMarker_markerHeightSE[i] = height;
      }

      curStats.plugOutline_plugSE[i] = curStats.capsMaskMarker_plugSE[i] = plugId;
      if (curStats.plug_enabledSE[i]) {
        value = (curStats.line_strokeWidth / DEFAULT_OPTIONS.lineSize) * options.plugSizeSE[i];
        curStats.position_plugOverheadSE[i] = symbolConf.overhead * value;
        curStats.viewBox_plugBCircleSE[i] = symbolConf.bCircle * value;
        plugSideLen = symbolConf.sideLen * value;
        plugBackLen = symbolConf.backLen * value;
      } else {
        curStats.position_plugOverheadSE[i] = -(curStats.line_strokeWidth / 2);
        curStats.viewBox_plugBCircleSE[i] = plugSideLen = plugBackLen = 0;
      }
      // Check events for attachment
      setStat(
        props,
        curStats.attach_plugSideLenSE,
        i,
        plugSideLen,
        events.cur_attach_plugSideLenSE,
        /* [DEBUG] */ 'attach_plugSideLenSE[' + i + ']%_' /* [/DEBUG] */
      );
      setStat(
        props,
        curStats.attach_plugBackLenSE,
        i,
        plugBackLen,
        events.cur_attach_plugBackLenSE,
        /* [DEBUG] */ 'attach_plugBackLenSE[' + i + ']%_' /* [/DEBUG] */
      );
      curStats.capsMaskAnchor_enabledSE[i] = !curStats.plug_enabledSE[i];
    });

    // It might be independent of `curStats.plug_enabledSE` in future version.
    updated =
      setStat(props, curStats, 'plug_enabled', curStats.plug_enabledSE[0] || curStats.plug_enabledSE[1]) || updated;

    // [DEBUG]

    if (!updated) {
      traceLog.add('not-updated');
    }

    // [/DEBUG]
    traceLog.add('</updatePlug>'); // [DEBUG/]
    return updated;
  }

  /**
   * @param {props} props - `props` of `LeaderLine` instance.
   * @returns {boolean} `true` if it was changed.
   */
  function updateLineOutline(props) {
    traceLog.add('<updateLineOutline>'); // [DEBUG/]
    const options = props.options;
    const curStats = props.curStats;
    let outlineWidth;
    let updated = false;

    updated = setStat(props, curStats, 'lineOutline_enabled', options.lineOutlineEnabled) || updated;
    updated = setStat(props, curStats, 'lineOutline_color', options.lineOutlineColor) || updated;
    updated = setStat(props, curStats, 'lineOutline_colorTra', getAlpha(curStats.lineOutline_color)[0] < 1) || updated;

    outlineWidth = curStats.line_strokeWidth * options.lineOutlineSize;

    updated =
      setStat(
        props,
        curStats,
        'lineOutline_strokeWidth',
        curStats.line_strokeWidth - outlineWidth * 2,
        /* [DEBUG] */ null,
        'lineOutline_strokeWidth%_' /* [/DEBUG] */
      ) || updated;
    updated =
      setStat(
        props,
        curStats,
        'lineOutline_inStrokeWidth',
        curStats.lineOutline_colorTra
          ? curStats.lineOutline_strokeWidth + SHAPE_GAP * 2
          : curStats.line_strokeWidth - outlineWidth /* half */,
        /* [DEBUG] */ null,
        'lineOutline_inStrokeWidth%_' /* [/DEBUG] */
      ) || updated;

    // [DEBUG]

    if (!updated) {
      traceLog.add('not-updated');
    }

    // [/DEBUG]
    traceLog.add('</updateLineOutline>'); // [DEBUG/]
    return updated;
  }

  /**
   * @param {props} props - `props` of `LeaderLine` instance.
   * @returns {boolean} `true` if it was changed.
   */
  function updatePlugOutline(props) {
    traceLog.add('<updatePlugOutline>'); // [DEBUG/]
    const options = props.options;
    const curStats = props.curStats;
    let updated = false;

    [0, 1].forEach((i) => {
      const plugId = curStats.plugOutline_plugSE[i];
      const symbolConf = plugId !== PLUG_BEHIND ? SYMBOLS[PLUG_2_SYMBOL[plugId]] : null;
      let value;

      updated =
        setStat(
          props,
          curStats.plugOutline_enabledSE,
          i,
          options.plugOutlineEnabledSE[i] &&
            // `curStats.plug_enabled` might be independent of `curStats.plug_enabledSE` in future version.
            curStats.plug_enabled &&
            curStats.plug_enabledSE[i] &&
            !!symbolConf &&
            !!symbolConf.outlineBase /* Not depend on `curStats.plug_enabledSE` */,
          /* [DEBUG] */ null,
          'plugOutline_enabledSE[' + i + ']=%s' /* [/DEBUG] */
        ) || updated;
      updated =
        setStat(
          props,
          curStats.plugOutline_colorSE,
          i,
          (value = options.plugOutlineColorSE[i] || curStats.lineOutline_color),
          /* [DEBUG] */ null,
          'plugOutline_colorSE[' + i + ']=%s' /* [/DEBUG] */
        ) || updated;
      updated =
        setStat(
          props,
          curStats.plugOutline_colorTraSE,
          i,
          getAlpha(value)[0] < 1,
          /* [DEBUG] */ null,
          'plugOutline_colorTraSE[' + i + ']=%s' /* [/DEBUG] */
        ) || updated;

      if (symbolConf && symbolConf.outlineBase) {
        // Not depend on `curStats.plugOutline_enabledSE`

        value = options.plugOutlineSizeSE[i];
        if (value > symbolConf.outlineMax) {
          value = symbolConf.outlineMax;
        }
        value *= symbolConf.outlineBase * 2;
        updated =
          setStat(
            props,
            curStats.plugOutline_strokeWidthSE,
            i,
            value,
            /* [DEBUG] */ null,
            'plugOutline_strokeWidthSE[' + i + ']%_' /* [/DEBUG] */
          ) || updated;
        updated =
          setStat(
            props,
            curStats.plugOutline_inStrokeWidthSE,
            i,
            curStats.plugOutline_colorTraSE[i]
              ? value - (SHAPE_GAP / (curStats.line_strokeWidth / DEFAULT_OPTIONS.lineSize) / options.plugSizeSE[i]) * 2
              : value / 2 /* half */,
            /* [DEBUG] */ null,
            'plugOutline_inStrokeWidthSE[' + i + ']%_' /* [/DEBUG] */
          ) || updated;
      }
    });

    // [DEBUG]

    if (!updated) {
      traceLog.add('not-updated');
    }

    // [/DEBUG]
    traceLog.add('</updatePlugOutline>'); // [DEBUG/]
    return updated;
  }

  /**
   * @param {props} props - `props` of `LeaderLine` instance.
   * @returns {boolean} `true` if it was changed.
   */
  function updateFaces(props) {
    traceLog.add('<updateFaces>'); // [DEBUG/]
    const curStats = props.curStats;
    const aplStats = props.aplStats;
    const events = props.events;
    let value;
    let updated = false;

    if (
      !curStats.line_altColor &&
      setStat(props, aplStats, 'line_color', (value = curStats.line_color), events.apl_line_color)
    ) {
      props.lineFace.style.stroke = value;
      updated = true;
    }

    if (
      setStat(props, aplStats, 'line_strokeWidth', (value = curStats.line_strokeWidth), events.apl_line_strokeWidth)
    ) {
      props.lineShape.style.strokeWidth = value + 'px';
      updated = true;
      if (IS_GECKO) {
        // [GECKO] plugsFace is ignored
        forceReflowAdd(props, props.lineShape);
      }
    }

    if (
      setStat(
        props,
        aplStats,
        'lineOutline_enabled',
        (value = curStats.lineOutline_enabled),
        events.apl_lineOutline_enabled
      )
    ) {
      props.lineOutlineFace.style.display = value ? 'inline' : 'none';
      updated = true;
    }

    if (curStats.lineOutline_enabled) {
      if (
        setStat(
          props,
          aplStats,
          'lineOutline_color',
          (value = curStats.lineOutline_color),
          events.apl_lineOutline_color
        )
      ) {
        props.lineOutlineFace.style.stroke = value;
        updated = true;
      }

      if (
        setStat(
          props,
          aplStats,
          'lineOutline_strokeWidth',
          (value = curStats.lineOutline_strokeWidth),
          events.apl_lineOutline_strokeWidth /* [DEBUG] */,
          'lineOutline_strokeWidth%_' /* [/DEBUG] */
        )
      ) {
        props.lineOutlineMaskShape.style.strokeWidth = value + 'px';
        updated = true;
      }

      if (
        setStat(
          props,
          aplStats,
          'lineOutline_inStrokeWidth',
          (value = curStats.lineOutline_inStrokeWidth),
          events.apl_lineOutline_inStrokeWidth /* [DEBUG] */,
          'lineOutline_inStrokeWidth%_' /* [/DEBUG] */
        )
      ) {
        props.lineMaskShape.style.strokeWidth = value + 'px';
        updated = true;
      }
    }

    if (setStat(props, aplStats, 'plug_enabled', (value = curStats.plug_enabled), events.apl_plug_enabled)) {
      props.plugsFace.style.display = value ? 'inline' : 'none';
      updated = true;
    }

    if (curStats.plug_enabled) {
      [0, 1].forEach((i) => {
        const plugId = curStats.plug_plugSE[i],
          symbolConf = plugId !== PLUG_BEHIND ? SYMBOLS[PLUG_2_SYMBOL[plugId]] : null,
          marker = getMarkerProps(i, symbolConf);

        if (
          setStat(
            props,
            aplStats.plug_enabledSE,
            i,
            (value = curStats.plug_enabledSE[i]),
            events.apl_plug_enabledSE /* [DEBUG] */,
            'plug_enabledSE[' + i + ']=%s' /* [/DEBUG] */
          )
        ) {
          props.plugsFace.style[marker.prop] = value ? 'url(#' + props.plugMarkerIdSE[i] + ')' : 'none';
          updated = true;
        }

        if (curStats.plug_enabledSE[i]) {
          if (
            setStat(
              props,
              aplStats.plug_plugSE,
              i,
              plugId,
              events.apl_plug_plugSE /* [DEBUG] */,
              'plug_plugSE[' + i + ']=%s' /* [/DEBUG] */
            )
          ) {
            props.plugFaceSE[i].href.baseVal = '#' + symbolConf.elmId;
            setMarkerOrient(
              props,
              props.plugMarkerSE[i],
              marker.orient,
              symbolConf.bBox,
              props.svg,
              props.plugMarkerShapeSE[i]
            );
            updated = true;
            if (IS_GECKO) {
              // [GECKO] plugsFace is not updated when plugSE is changed
              forceReflowAdd(props, props.plugsFace);
            }
          }

          if (
            setStat(
              props,
              aplStats.plug_colorSE,
              i,
              (value = curStats.plug_colorSE[i]),
              events.apl_plug_colorSE /* [DEBUG] */,
              'plug_colorSE[' + i + ']=%s' /* [/DEBUG] */
            )
          ) {
            props.plugFaceSE[i].style.fill = value;
            updated = true;
            if ((IS_BLINK || IS_WEBKIT) && !curStats.line_colorTra) {
              // [BLINK], [WEBKIT] capsMaskMarkerShapeSE is not updated when line has no alpha
              forceReflowAdd(props, props.capsMaskLine);
            }
          }

          // plug_markerWidthSE, plug_markerHeightSE
          ['markerWidth', 'markerHeight'].forEach((markerKey) => {
            const statKey = 'plug_' + markerKey + 'SE';
            if (
              setStat(
                props,
                aplStats[statKey],
                i,
                (value = curStats[statKey][i]),
                events['apl_' + statKey] /* [DEBUG] */,
                statKey + '[' + i + ']%_' /* [/DEBUG] */
              )
            ) {
              props.plugMarkerSE[i][markerKey].baseVal.value = value;
              updated = true;
            }
          });

          if (
            setStat(
              props,
              aplStats.plugOutline_enabledSE,
              i,
              (value = curStats.plugOutline_enabledSE[i]),
              events.apl_plugOutline_enabledSE,
              /* [DEBUG] */ 'plugOutline_enabledSE[' + i + ']=%s' /* [/DEBUG] */
            )
          ) {
            if (value) {
              props.plugFaceSE[i].style.mask = 'url(#' + props.plugMaskIdSE[i] + ')';
              props.plugOutlineFaceSE[i].style.display = 'inline';
            } else {
              props.plugFaceSE[i].style.mask = 'none';
              props.plugOutlineFaceSE[i].style.display = 'none';
            }
            updated = true;
          }

          if (curStats.plugOutline_enabledSE[i]) {
            if (
              setStat(
                props,
                aplStats.plugOutline_plugSE,
                i,
                plugId,
                events.apl_plugOutline_plugSE,
                /* [DEBUG] */ 'plugOutline_plugSE[' + i + ']=%s' /* [/DEBUG] */
              )
            ) {
              props.plugOutlineFaceSE[i].href.baseVal =
                props.plugMaskShapeSE[i].href.baseVal =
                props.plugOutlineMaskShapeSE[i].href.baseVal =
                  '#' + symbolConf.elmId;
              [props.plugMaskSE[i], props.plugOutlineMaskSE[i]].forEach((mask) => {
                mask.x.baseVal.value = symbolConf.bBox.left;
                mask.y.baseVal.value = symbolConf.bBox.top;
                mask.width.baseVal.value = symbolConf.bBox.width;
                mask.height.baseVal.value = symbolConf.bBox.height;
              });
              updated = true;
            }

            if (
              setStat(
                props,
                aplStats.plugOutline_colorSE,
                i,
                (value = curStats.plugOutline_colorSE[i]),
                events.apl_plugOutline_colorSE,
                /* [DEBUG] */ 'plugOutline_colorSE[' + i + ']=%s' /* [/DEBUG] */
              )
            ) {
              props.plugOutlineFaceSE[i].style.fill = value;
              updated = true;
            }

            if (
              setStat(
                props,
                aplStats.plugOutline_strokeWidthSE,
                i,
                (value = curStats.plugOutline_strokeWidthSE[i]),
                events.apl_plugOutline_strokeWidthSE,
                /* [DEBUG] */ 'plugOutline_strokeWidthSE[' + i + ']%_' /* [/DEBUG] */
              )
            ) {
              props.plugOutlineMaskShapeSE[i].style.strokeWidth = value + 'px';
              updated = true;
            }

            if (
              setStat(
                props,
                aplStats.plugOutline_inStrokeWidthSE,
                i,
                (value = curStats.plugOutline_inStrokeWidthSE[i]),
                events.apl_plugOutline_inStrokeWidthSE,
                /* [DEBUG] */ 'plugOutline_inStrokeWidthSE[' + i + ']%_' /* [/DEBUG] */
              )
            ) {
              props.plugMaskShapeSE[i].style.strokeWidth = value + 'px';
              updated = true;
            }
          }
        }
      });
    }

    // [DEBUG]

    if (!updated) {
      traceLog.add('not-updated');
    }

    // [/DEBUG]
    traceLog.add('</updateFaces>'); // [DEBUG/]
    return updated;
  }

  /**
   * @param {props} props - `props` of `LeaderLine` instance.
   * @returns {boolean} `true` if it was changed.
   */
  function updatePosition(props) {
    traceLog.add('<updatePosition>'); // [DEBUG/]
    const options = props.options;
    const curStats = props.curStats;
    const aplStats = props.aplStats;
    const curSocketXYSE = curStats.position_socketXYSE;
    let curSocketGravitySE;
    let anchorBBoxSE;
    let pathList;
    let updated = false;

    function getSocketXY(bBox, socketId) {
      const socketXY =
        socketId === SOCKET_TOP
          ? { x: bBox.left + bBox.width / 2, y: bBox.top }
          : socketId === SOCKET_RIGHT
            ? { x: bBox.right, y: bBox.top + bBox.height / 2 }
            : socketId === SOCKET_BOTTOM
              ? { x: bBox.left + bBox.width / 2, y: bBox.bottom }
              : /* SOCKET_LEFT */ { x: bBox.left, y: bBox.top + bBox.height / 2 };
      socketXY.socketId = socketId;
      return socketXY;
    }

    function socketXY2Point(socketXY) {
      return { x: socketXY.x, y: socketXY.y };
    }

    function socketXYHasChanged(a, b) {
      return a.x !== b.x || a.y !== b.y || a.socketId !== b.socketId;
    }

    function socketGravityHasChanged(a, b) {
      const aType = a == null ? 'auto' : Array.isArray(a) ? 'array' : 'number',
        bType = b == null ? 'auto' : Array.isArray(b) ? 'array' : 'number';
      return aType !== bType ? true : aType === 'array' ? a[0] !== b[0] || a[1] !== b[1] : a !== b;
    }

    curStats.position_path = options.path;
    curStats.position_lineStrokeWidth = curStats.line_strokeWidth;
    curStats.position_socketGravitySE = curSocketGravitySE = copyTree(options.socketGravitySE);

    anchorBBoxSE = [0, 1].map((i) => {
      const anchor = options.anchorSE[i],
        isAttach = props.optionIsAttach.anchorSE[i],
        attachProps = isAttach !== false ? insAttachProps[anchor._id] : null,
        strokeWidth =
          isAttach !== false && attachProps.conf.getStrokeWidth
            ? attachProps.conf.getStrokeWidth(attachProps, props)
            : 0,
        anchorBBox =
          isAttach !== false && attachProps.conf.getBBoxNest
            ? attachProps.conf.getBBoxNest(attachProps, props, strokeWidth)
            : getBBoxNest(anchor, props.baseWindow);

      curStats.capsMaskAnchor_pathDataSE[i] =
        isAttach !== false && attachProps.conf.getPathData
          ? attachProps.conf.getPathData(attachProps, props, strokeWidth)
          : bBox2PathData(anchorBBox);
      curStats.capsMaskAnchor_strokeWidthSE[i] = strokeWidth;
      return anchorBBox;
    });

    // Decide each socket
    (() => {
      let socketXYsWk,
        socketsLenMin = -1,
        iFix,
        iAuto;
      if (options.socketSE[0] && options.socketSE[1]) {
        curSocketXYSE[0] = getSocketXY(anchorBBoxSE[0], options.socketSE[0]);
        curSocketXYSE[1] = getSocketXY(anchorBBoxSE[1], options.socketSE[1]);
      } else {
        if (!options.socketSE[0] && !options.socketSE[1]) {
          socketXYsWk = SOCKET_IDS.map((socketId) => getSocketXY(anchorBBoxSE[1], socketId));
          SOCKET_IDS.map((socketId) => getSocketXY(anchorBBoxSE[0], socketId)).forEach((socketXY0) => {
            socketXYsWk.forEach((socketXY1) => {
              const len = getPointsLength(socketXY0, socketXY1);
              if (len < socketsLenMin || socketsLenMin === -1) {
                curSocketXYSE[0] = socketXY0;
                curSocketXYSE[1] = socketXY1;
                socketsLenMin = len;
              }
            });
          });
        } else {
          if (options.socketSE[0]) {
            iFix = 0;
            iAuto = 1;
          } else {
            iFix = 1;
            iAuto = 0;
          }
          curSocketXYSE[iFix] = getSocketXY(anchorBBoxSE[iFix], options.socketSE[iFix]);
          socketXYsWk = SOCKET_IDS.map((socketId) => getSocketXY(anchorBBoxSE[iAuto], socketId));
          socketXYsWk.forEach((socketXY) => {
            const len = getPointsLength(socketXY, curSocketXYSE[iFix]);
            if (len < socketsLenMin || socketsLenMin === -1) {
              curSocketXYSE[iAuto] = socketXY;
              socketsLenMin = len;
            }
          });
        }

        // Adjust auto-socket when no width/height
        [0, 1].forEach((i) => {
          let distanceX, distanceY;
          if (!options.socketSE[i]) {
            if (!anchorBBoxSE[i].width && !anchorBBoxSE[i].height) {
              distanceX = curSocketXYSE[i ? 0 : 1].x - anchorBBoxSE[i].left;
              distanceY = curSocketXYSE[i ? 0 : 1].y - anchorBBoxSE[i].top;
              curSocketXYSE[i].socketId =
                Math.abs(distanceX) >= Math.abs(distanceY)
                  ? distanceX >= 0
                    ? SOCKET_RIGHT
                    : SOCKET_LEFT
                  : distanceY >= 0
                    ? SOCKET_BOTTOM
                    : SOCKET_TOP;
            } else if (
              !anchorBBoxSE[i].width &&
              (curSocketXYSE[i].socketId === SOCKET_LEFT || curSocketXYSE[i].socketId === SOCKET_RIGHT)
            ) {
              curSocketXYSE[i].socketId =
                curSocketXYSE[i ? 0 : 1].x - anchorBBoxSE[i].left >= 0 ? SOCKET_RIGHT : SOCKET_LEFT;
            } else if (
              !anchorBBoxSE[i].height &&
              (curSocketXYSE[i].socketId === SOCKET_TOP || curSocketXYSE[i].socketId === SOCKET_BOTTOM)
            ) {
              curSocketXYSE[i].socketId =
                curSocketXYSE[i ? 0 : 1].y - anchorBBoxSE[i].top >= 0 ? SOCKET_BOTTOM : SOCKET_TOP;
            }
          }
        });
      }
    })();

    // [DEBUG]
    if (curStats.position_path !== aplStats.position_path) {
      traceLog.add('position_path');
    }
    if (curStats.position_lineStrokeWidth !== aplStats.position_lineStrokeWidth) {
      traceLog.add('position_lineStrokeWidth');
    }
    [0, 1].forEach((i) => {
      if (curStats.position_plugOverheadSE[i] !== aplStats.position_plugOverheadSE[i]) {
        traceLog.add('position_plugOverheadSE[' + i + ']');
      }
      if (socketXYHasChanged(curSocketXYSE[i], aplStats.position_socketXYSE[i])) {
        traceLog.add('position_socketXYSE[' + i + ']');
      }
      if (socketGravityHasChanged(curSocketGravitySE[i], aplStats.position_socketGravitySE[i])) {
        traceLog.add('position_socketGravitySE[' + i + ']');
      }
    });
    // [/DEBUG]

    if (
      curStats.position_path !== aplStats.position_path ||
      curStats.position_lineStrokeWidth !== aplStats.position_lineStrokeWidth ||
      [0, 1].some(
        (i) =>
          curStats.position_plugOverheadSE[i] !== aplStats.position_plugOverheadSE[i] ||
          socketXYHasChanged(curSocketXYSE[i], aplStats.position_socketXYSE[i]) ||
          socketGravityHasChanged(curSocketGravitySE[i], aplStats.position_socketGravitySE[i])
      )
    ) {
      // New position
      traceLog.add('new-position'); // [DEBUG/]
      const shownPathList = props.pathList.animVal || props.pathList.baseVal;
      props.pathList.baseVal = pathList = [];
      props.pathList.animVal = null;

      // Generate path segments
      switch (curStats.position_path) {
        case PATH_STRAIGHT:
          pathList.push([socketXY2Point(curSocketXYSE[0]), socketXY2Point(curSocketXYSE[1])]);
          break;

        case PATH_ARC:
          (() => {
            const downward =
                (typeof curSocketGravitySE[0] === 'number' && curSocketGravitySE[0] > 0) ||
                (typeof curSocketGravitySE[1] === 'number' && curSocketGravitySE[1] > 0),
              circle8rad = CIRCLE_8_RAD * (downward ? -1 : 1),
              angle = Math.atan2(curSocketXYSE[1].y - curSocketXYSE[0].y, curSocketXYSE[1].x - curSocketXYSE[0].x),
              cp1Angle = -angle + circle8rad,
              cp2Angle = Math.PI - angle - circle8rad,
              crLen = (getPointsLength(curSocketXYSE[0], curSocketXYSE[1]) / Math.sqrt(2)) * CIRCLE_CP,
              cp1 = {
                x: curSocketXYSE[0].x + Math.cos(cp1Angle) * crLen,
                y: curSocketXYSE[0].y + Math.sin(cp1Angle) * crLen * -1
              },
              cp2 = {
                x: curSocketXYSE[1].x + Math.cos(cp2Angle) * crLen,
                y: curSocketXYSE[1].y + Math.sin(cp2Angle) * crLen * -1
              };
            pathList.push([socketXY2Point(curSocketXYSE[0]), cp1, cp2, socketXY2Point(curSocketXYSE[1])]);
          })();
          break;

        case PATH_FLUID:
        case PATH_MAGNET:
          /* @EXPORT[file:../test/spec/func/PATH_FLUID]@ */ ((socketGravitySE) => {
            const cx = [],
              cy = [];
            curSocketXYSE.forEach((socketXY, i) => {
              const gravity = socketGravitySE[i];
              let offset;
              let anotherSocketXY;
              let overhead;
              let minGravity;
              let len;
              if (Array.isArray(gravity)) {
                // offset
                offset = { x: gravity[0], y: gravity[1] };
              } else if (typeof gravity === 'number') {
                // distance
                offset =
                  socketXY.socketId === SOCKET_TOP
                    ? { x: 0, y: -gravity }
                    : socketXY.socketId === SOCKET_RIGHT
                      ? { x: gravity, y: 0 }
                      : socketXY.socketId === SOCKET_BOTTOM
                        ? { x: 0, y: gravity }
                        : /* SOCKET_LEFT */ { x: -gravity, y: 0 };
              } else {
                // auto
                anotherSocketXY = curSocketXYSE[i ? 0 : 1];
                overhead = curStats.position_plugOverheadSE[i];
                minGravity =
                  overhead > 0
                    ? MIN_OH_GRAVITY +
                      (overhead > MIN_OH_GRAVITY_OH ? (overhead - MIN_OH_GRAVITY_OH) * MIN_OH_GRAVITY_R : 0)
                    : MIN_GRAVITY +
                      (curStats.position_lineStrokeWidth > MIN_GRAVITY_SIZE
                        ? (curStats.position_lineStrokeWidth - MIN_GRAVITY_SIZE) * MIN_GRAVITY_R
                        : 0);
                if (socketXY.socketId === SOCKET_TOP) {
                  len = (socketXY.y - anotherSocketXY.y) / 2;
                  if (len < minGravity) {
                    len = minGravity;
                  }
                  offset = { x: 0, y: -len };
                } else if (socketXY.socketId === SOCKET_RIGHT) {
                  len = (anotherSocketXY.x - socketXY.x) / 2;
                  if (len < minGravity) {
                    len = minGravity;
                  }
                  offset = { x: len, y: 0 };
                } else if (socketXY.socketId === SOCKET_BOTTOM) {
                  len = (anotherSocketXY.y - socketXY.y) / 2;
                  if (len < minGravity) {
                    len = minGravity;
                  }
                  offset = { x: 0, y: len };
                } else {
                  // SOCKET_LEFT
                  len = (socketXY.x - anotherSocketXY.x) / 2;
                  if (len < minGravity) {
                    len = minGravity;
                  }
                  offset = { x: -len, y: 0 };
                }
              }
              cx[i] = socketXY.x + offset.x;
              cy[i] = socketXY.y + offset.y;
            });
            pathList.push([
              socketXY2Point(curSocketXYSE[0]),
              { x: cx[0], y: cy[0] },
              { x: cx[1], y: cy[1] },
              socketXY2Point(curSocketXYSE[1])
            ]);
          })(
            /* @/EXPORT@ */ [curSocketGravitySE[0], curStats.position_path === PATH_MAGNET ? 0 : curSocketGravitySE[1]]
          );
          break;

        case PATH_GRID:
          /* @EXPORT[file:../test/spec/func/PATH_GRID]@ */ (() => {
            /**
             * @typedef {Object} DirPoint
             * @property {number} dirId - DIR_UP, DIR_RIGHT, DIR_DOWN, DIR_LEFT
             * @property {number} x
             * @property {number} y
             */
            const DIR_UP = 1;

            const DIR_RIGHT = 2;
            const DIR_DOWN = 3;

            const // Correspond with `socketId`
              DIR_LEFT = 4;

            const dpList = [[], []];
            const curDirPoint = [];
            let curPoint;

            function reverseDir(dirId) {
              return dirId === DIR_UP
                ? DIR_DOWN
                : dirId === DIR_RIGHT
                  ? DIR_LEFT
                  : dirId === DIR_DOWN
                    ? DIR_UP
                    : DIR_RIGHT;
            }

            function getAxis(dirId) {
              return dirId === DIR_RIGHT || dirId === DIR_LEFT ? 'x' : 'y';
            }

            function getNextDirPoint(dirPoint, len, dirId) {
              const newDirPoint = { x: dirPoint.x, y: dirPoint.y };
              if (dirId) {
                if (dirId === reverseDir(dirPoint.dirId)) {
                  throw new Error('Invalid dirId: ' + dirId);
                }
                newDirPoint.dirId = dirId;
              } else {
                newDirPoint.dirId = dirPoint.dirId;
              }

              if (newDirPoint.dirId === DIR_UP) {
                newDirPoint.y -= len;
              } else if (newDirPoint.dirId === DIR_RIGHT) {
                newDirPoint.x += len;
              } else if (newDirPoint.dirId === DIR_DOWN) {
                newDirPoint.y += len;
              } else {
                // DIR_LEFT
                newDirPoint.x -= len;
              }
              return newDirPoint;
            }

            function inAxisScope(point, dirPoint) {
              return dirPoint.dirId === DIR_UP
                ? point.y <= dirPoint.y
                : dirPoint.dirId === DIR_RIGHT
                  ? point.x >= dirPoint.x
                  : dirPoint.dirId === DIR_DOWN
                    ? point.y >= dirPoint.y
                    : point.x <= dirPoint.x;
            }

            function onAxisLine(point, dirPoint) {
              return dirPoint.dirId === DIR_UP || dirPoint.dirId === DIR_DOWN
                ? point.x === dirPoint.x
                : point.y === dirPoint.y;
            }

            // Must `scopeContains[0] !== scopeContains[1]`
            function getIndexWithScope(scopeContains) {
              return scopeContains[0] ? { contain: 0, notContain: 1 } : { contain: 1, notContain: 0 };
            }

            function getAxisDistance(point1, point2, axis) {
              return Math.abs(point2[axis] - point1[axis]);
            }

            // Must `fromPoint.[x|y] !== toPoint.[x|y]`
            function getDirIdWithAxis(fromPoint, toPoint, axis) {
              return axis === 'x'
                ? fromPoint.x < toPoint.x
                  ? DIR_RIGHT
                  : DIR_LEFT
                : fromPoint.y < toPoint.y
                  ? DIR_DOWN
                  : DIR_UP;
            }

            function joinPoints() {
              const scopeContains = [
                inAxisScope(curDirPoint[1], curDirPoint[0]),
                inAxisScope(curDirPoint[0], curDirPoint[1])
              ];

              const axis = [getAxis(curDirPoint[0].dirId), getAxis(curDirPoint[1].dirId)];
              let center;
              let axisScope;
              let distance;
              let points;

              if (axis[0] === axis[1]) {
                // Same axis
                if (scopeContains[0] && scopeContains[1]) {
                  if (!onAxisLine(curDirPoint[1], curDirPoint[0])) {
                    if (curDirPoint[0][axis[0]] === curDirPoint[1][axis[1]]) {
                      // vertical
                      dpList[0].push(curDirPoint[0]);
                      dpList[1].push(curDirPoint[1]);
                    } else {
                      center = curDirPoint[0][axis[0]] + (curDirPoint[1][axis[1]] - curDirPoint[0][axis[0]]) / 2;
                      dpList[0].push(getNextDirPoint(curDirPoint[0], Math.abs(center - curDirPoint[0][axis[0]])));
                      dpList[1].push(getNextDirPoint(curDirPoint[1], Math.abs(center - curDirPoint[1][axis[1]])));
                    }
                  }
                  return false;
                } else if (scopeContains[0] !== scopeContains[1]) {
                  // turn notContain 90deg
                  axisScope = getIndexWithScope(scopeContains);
                  distance = getAxisDistance(
                    curDirPoint[axisScope.notContain],
                    curDirPoint[axisScope.contain],
                    axis[axisScope.notContain]
                  );
                  if (distance < MIN_GRID_LEN) {
                    curDirPoint[axisScope.notContain] = getNextDirPoint(
                      curDirPoint[axisScope.notContain],
                      MIN_GRID_LEN - distance
                    );
                  }
                  dpList[axisScope.notContain].push(curDirPoint[axisScope.notContain]);
                  curDirPoint[axisScope.notContain] = getNextDirPoint(
                    curDirPoint[axisScope.notContain],
                    MIN_GRID_LEN,
                    onAxisLine(curDirPoint[axisScope.contain], curDirPoint[axisScope.notContain])
                      ? axis[axisScope.notContain] === 'x'
                        ? DIR_DOWN
                        : DIR_RIGHT
                      : getDirIdWithAxis(
                          curDirPoint[axisScope.notContain],
                          curDirPoint[axisScope.contain],
                          axis[axisScope.notContain] === 'x' ? 'y' : 'x'
                        )
                  );
                } else {
                  // turn both 90deg
                  distance = getAxisDistance(curDirPoint[0], curDirPoint[1], axis[0] === 'x' ? 'y' : 'x');
                  dpList.forEach((targetDpList, iTarget) => {
                    const iAnother = iTarget === 0 ? 1 : 0;
                    targetDpList.push(curDirPoint[iTarget]);
                    curDirPoint[iTarget] = getNextDirPoint(
                      curDirPoint[iTarget],
                      MIN_GRID_LEN,
                      distance >= MIN_GRID_LEN * 2
                        ? getDirIdWithAxis(
                            curDirPoint[iTarget],
                            curDirPoint[iAnother],
                            axis[iTarget] === 'x' ? 'y' : 'x'
                          )
                        : axis[iTarget] === 'x'
                          ? DIR_DOWN
                          : DIR_RIGHT
                    );
                  });
                }
              } else {
                // Different axis
                if (scopeContains[0] && scopeContains[1]) {
                  if (onAxisLine(curDirPoint[1], curDirPoint[0])) {
                    dpList[1].push(curDirPoint[1]); // Drop curDirPoint[0]
                  } else if (onAxisLine(curDirPoint[0], curDirPoint[1])) {
                    dpList[0].push(curDirPoint[0]); // Drop curDirPoint[1]
                  } else {
                    // Drop curDirPoint[0] and end
                    dpList[0].push(
                      axis[0] === 'x'
                        ? { x: curDirPoint[1].x, y: curDirPoint[0].y }
                        : { x: curDirPoint[0].x, y: curDirPoint[1].y }
                    );
                  }
                  return false;
                } else if (scopeContains[0] !== scopeContains[1]) {
                  // turn notContain 90deg
                  axisScope = getIndexWithScope(scopeContains);
                  dpList[axisScope.notContain].push(curDirPoint[axisScope.notContain]);
                  curDirPoint[axisScope.notContain] = getNextDirPoint(
                    curDirPoint[axisScope.notContain],
                    MIN_GRID_LEN,
                    getAxisDistance(
                      curDirPoint[axisScope.notContain],
                      curDirPoint[axisScope.contain],
                      axis[axisScope.contain]
                    ) >= MIN_GRID_LEN
                      ? getDirIdWithAxis(
                          curDirPoint[axisScope.notContain],
                          curDirPoint[axisScope.contain],
                          axis[axisScope.contain]
                        )
                      : curDirPoint[axisScope.contain].dirId
                  );
                } else {
                  // turn both 90deg
                  points = [
                    { x: curDirPoint[0].x, y: curDirPoint[0].y },
                    { x: curDirPoint[1].x, y: curDirPoint[1].y }
                  ];
                  dpList.forEach((targetDpList, iTarget) => {
                    const iAnother = iTarget === 0 ? 1 : 0,
                      distance = getAxisDistance(points[iTarget], points[iAnother], axis[iTarget]);
                    if (distance < MIN_GRID_LEN) {
                      curDirPoint[iTarget] = getNextDirPoint(curDirPoint[iTarget], MIN_GRID_LEN - distance);
                    }
                    targetDpList.push(curDirPoint[iTarget]);
                    curDirPoint[iTarget] = getNextDirPoint(
                      curDirPoint[iTarget],
                      MIN_GRID_LEN,
                      getDirIdWithAxis(curDirPoint[iTarget], curDirPoint[iAnother], axis[iAnother])
                    );
                  });
                }
              }
              return true;
            }

            curSocketXYSE.forEach((socketXY, i) => {
              const dirPoint = socketXY2Point(socketXY);
              let len = curSocketGravitySE[i];
              ((dirLen) => {
                dirPoint.dirId = dirLen[0];
                len = dirLen[1];
              })(
                Array.isArray(len) // offset
                  ? len[0] < 0
                    ? [DIR_LEFT, -len[0]] // ignore Y
                    : len[0] > 0
                      ? [DIR_RIGHT, len[0]] // ignore Y
                      : len[1] < 0
                        ? [DIR_UP, -len[1]]
                        : len[1] > 0
                          ? [DIR_DOWN, len[1]]
                          : [socketXY.socketId, 0] // (0, 0)
                  : typeof len !== 'number'
                    ? [socketXY.socketId, MIN_GRID_LEN] // auto
                    : len >= 0
                      ? [socketXY.socketId, len] // distance
                      : [reverseDir(socketXY.socketId), -len]
              );
              dpList[i].push(dirPoint);
              curDirPoint[i] = getNextDirPoint(dirPoint, len);
            });
            while (joinPoints()) {
              /* empty */
            }

            dpList[1].reverse();
            [...dpList[0], ...dpList[1]].forEach((dirPoint, i) => {
              const point = { x: dirPoint.x, y: dirPoint.y };
              if (i > 0) {
                pathList.push([curPoint, point]);
              }
              curPoint = point;
            });
          }) /* @/EXPORT@ */();
          break;

        // no default
      }

      // Adjust path with plugs
      (() => {
        const pathSegsLen = [];
        curStats.position_plugOverheadSE.forEach((plugOverhead, i) => {
          const start = !i;
          let pathPoints;
          let iSeg;
          let point;
          let sp;
          let cp;
          let angle;
          let len;
          let socketId;
          let axis;
          let dir;
          let minAdjustOffset;
          if (plugOverhead > 0) {
            pathPoints = pathList[(iSeg = start ? 0 : pathList.length - 1)];

            if (pathPoints.length === 2) {
              // Straight line
              pathSegsLen[iSeg] = pathSegsLen[iSeg] || getPointsLength(...pathPoints);
              if (pathSegsLen[iSeg] > MIN_ADJUST_LEN) {
                if (pathSegsLen[iSeg] - plugOverhead < MIN_ADJUST_LEN) {
                  plugOverhead = pathSegsLen[iSeg] - MIN_ADJUST_LEN;
                }
                point = getPointOnLine(
                  pathPoints[0],
                  pathPoints[1],
                  (start ? plugOverhead : pathSegsLen[iSeg] - plugOverhead) / pathSegsLen[iSeg]
                );
                pathList[iSeg] = start ? [point, pathPoints[1]] : [pathPoints[0], point];
                pathSegsLen[iSeg] -= plugOverhead;
              }
            } else {
              // Cubic bezier
              pathSegsLen[iSeg] = pathSegsLen[iSeg] || getCubicLength(...pathPoints);
              if (pathSegsLen[iSeg] > MIN_ADJUST_LEN) {
                if (pathSegsLen[iSeg] - plugOverhead < MIN_ADJUST_LEN) {
                  plugOverhead = pathSegsLen[iSeg] - MIN_ADJUST_LEN;
                }
                point = getPointOnCubic(
                  pathPoints[0],
                  pathPoints[1],
                  pathPoints[2],
                  pathPoints[3],
                  getCubicT(
                    pathPoints[0],
                    pathPoints[1],
                    pathPoints[2],
                    pathPoints[3],
                    start ? plugOverhead : pathSegsLen[iSeg] - plugOverhead
                  )
                );

                // Get direct distance and angle
                if (start) {
                  sp = pathPoints[0];
                  cp = point.toP1;
                } else {
                  sp = pathPoints[3];
                  cp = point.fromP2;
                }
                angle = Math.atan2(sp.y - point.y, point.x - sp.x);
                len = getPointsLength(point, cp);
                point.x = sp.x + Math.cos(angle) * plugOverhead;
                point.y = sp.y + Math.sin(angle) * plugOverhead * -1;
                cp.x = point.x + Math.cos(angle) * len;
                cp.y = point.y + Math.sin(angle) * len * -1;

                pathList[iSeg] = start
                  ? [point, point.toP1, point.toP2, pathPoints[3]]
                  : [pathPoints[0], point.fromP1, point.fromP2, point];
                pathSegsLen[iSeg] = null; // to re-calculate
              }
            }
          } else if (plugOverhead < 0) {
            pathPoints = pathList[(iSeg = start ? 0 : pathList.length - 1)];
            socketId = curSocketXYSE[i].socketId;
            axis = socketId === SOCKET_LEFT || socketId === SOCKET_RIGHT ? 'x' : 'y';
            minAdjustOffset = -anchorBBoxSE[i][axis === 'x' ? 'width' : 'height'];
            if (plugOverhead < minAdjustOffset) {
              plugOverhead = minAdjustOffset;
            }
            dir = plugOverhead * (socketId === SOCKET_LEFT || socketId === SOCKET_TOP ? -1 : 1);
            if (pathPoints.length === 2) {
              // Straight line
              pathPoints[start ? 0 : pathPoints.length - 1][axis] += dir;
            } else {
              // Cubic bezier
              (start ? [0, 1] : [pathPoints.length - 2, pathPoints.length - 1]).forEach((i) => {
                pathPoints[i][axis] += dir;
              });
            }
            pathSegsLen[iSeg] = null; // to re-calculate
          }
        });
      })();

      // apply
      aplStats.position_socketXYSE = copyTree(curSocketXYSE);
      aplStats.position_plugOverheadSE = copyTree(curStats.position_plugOverheadSE);
      aplStats.position_path = curStats.position_path;
      aplStats.position_lineStrokeWidth = curStats.position_lineStrokeWidth;
      aplStats.position_socketGravitySE = copyTree(curSocketGravitySE);
      updated = true;
      smoothPath(props, shownPathList);

      if (props.events.apl_position) {
        props.events.apl_position.forEach((handler) => {
          handler(props, pathList);
        });
      }
    }

    // [DEBUG]

    if (!updated) {
      traceLog.add('not-updated');
    }

    // [/DEBUG]
    traceLog.add('</updatePosition>'); // [DEBUG/]
    return updated;
  }

  /**
   * @param {props} props - `props` of `LeaderLine` instance.
   * @returns {boolean} `true` if it was changed.
   */
  const DEFAULT_SMOOTH_POSITION = { duration: 150, timing: 'ease-out' };

  /**
   * `smoothPosition`: move the shown path to the new one, point by point, instead of jumping.
   * Only between paths of the same shape (segments and points): a `grid` path that turns once
   * more jumps. Not while the `draw` effect draws the path, nor with reduced motion.
   * @param {props} props - `props` of `LeaderLine` instance.
   * @param {(Array|undefined)} fromPathList - The path list that was shown.
   * @returns {void}
   */
  function smoothPath(props, fromPathList) {
    const curStats = props.curStats,
      animOptions = props.options.smoothPosition,
      toPathList = props.pathList.baseVal;
    if (curStats.position_animId) {
      anim.remove(curStats.position_animId);
      curStats.position_animId = null;
    }
    if (
      !animOptions ||
      !fromPathList ||
      fromPathList.length !== toPathList.length ||
      fromPathList.some((points, i) => points.length !== toPathList[i].length) ||
      (curStats.show_inAnim && props.aplStats.show_effect === 'draw') ||
      isReducedMotion(props)
    ) {
      return;
    }
    traceLog.add('smoothPath'); // [DEBUG/]
    props.pathList.animVal = fromPathList;
    curStats.position_animId = anim.add(
      (outputRatio) =>
        fromPathList.map((points, i) =>
          points.map((point, j) => {
            const to = toPathList[i][j];
            return { x: point.x + (to.x - point.x) * outputRatio, y: point.y + (to.y - point.y) * outputRatio };
          })
        ),
      (value, finish) => {
        if (finish) {
          curStats.position_animId = null;
          props.pathList.animVal = null;
        } else {
          props.pathList.animVal = value;
        }
        update(props, { path: true });
      },
      animOptions.duration,
      1,
      animOptions.timing,
      false
    );
  }

  function updatePath(props) {
    traceLog.add('<updatePath>'); // [DEBUG/]
    const curStats = props.curStats;
    const aplStats = props.aplStats;
    const pathList = props.pathList.animVal || props.pathList.baseVal;
    let curPathData;
    const curEdge = curStats.path_edge;
    let updated = false;

    if (pathList) {
      curEdge.x1 = curEdge.x2 = pathList[0][0].x;
      curEdge.y1 = curEdge.y2 = pathList[0][0].y;
      curStats.path_pathData = curPathData = pathList2PathData(pathList, (point) => {
        if (point.x < curEdge.x1) {
          curEdge.x1 = point.x;
        }
        if (point.y < curEdge.y1) {
          curEdge.y1 = point.y;
        }
        if (point.x > curEdge.x2) {
          curEdge.x2 = point.x;
        }
        if (point.y > curEdge.y2) {
          curEdge.y2 = point.y;
        }
      });

      // Apply `pathData`
      if (pathDataHasChanged(curPathData, aplStats.path_pathData)) {
        traceLog.add('path_pathData'); // [DEBUG/]
        props.linePath.setPathData(curPathData);
        aplStats.path_pathData = curPathData; // Since curPathData is new anytime, it doesn't need copy.
        updated = true;

        if (IS_GECKO) {
          // [GECKO] path is not updated when path is changed
          forceReflowAdd(props, props.linePath);
        }

        if (props.events.apl_path) {
          props.events.apl_path.forEach((handler) => {
            handler(props, curPathData);
          });
        }
      }
    }

    // [DEBUG]

    if (!updated) {
      traceLog.add('not-updated');
    }

    // [/DEBUG]
    traceLog.add('</updatePath>'); // [DEBUG/]
    return updated;
  }

  /**
   * @param {props} props - `props` of `LeaderLine` instance.
   * @returns {boolean} `true` if it was changed.
   */
  function updateViewBox(props) {
    traceLog.add('<updateViewBox>'); // [DEBUG/]
    const curStats = props.curStats;
    const aplStats = props.aplStats;
    const curEdge = curStats.path_edge;
    let padding;
    let edge;
    const curBBox = curStats.viewBox_bBox;
    const aplBBox = aplStats.viewBox_bBox;
    const styles = props.svg.style;
    let updated = false;

    // Expand bBox with `line` or symbols, and event
    padding = Math.max(
      curStats.line_strokeWidth / 2,
      curStats.viewBox_plugBCircleSE[0] || 0,
      curStats.viewBox_plugBCircleSE[1] || 0
    );
    edge = { x1: curEdge.x1 - padding, y1: curEdge.y1 - padding, x2: curEdge.x2 + padding, y2: curEdge.y2 + padding };
    if (props.events.new_edge4viewBox) {
      props.events.new_edge4viewBox.forEach((handler) => {
        handler(props, edge);
      });
    }

    curBBox.x = curStats.lineMask_x = curStats.lineOutlineMask_x = curStats.maskBGRect_x = edge.x1;
    curBBox.y = curStats.lineMask_y = curStats.lineOutlineMask_y = curStats.maskBGRect_y = edge.y1;
    curBBox.width = edge.x2 - edge.x1;
    curBBox.height = edge.y2 - edge.y1;

    ['x', 'y', 'width', 'height'].forEach((boxKey) => {
      let value;
      if ((value = curBBox[boxKey]) !== aplBBox[boxKey]) {
        traceLog.add(boxKey); // [DEBUG/]
        aplBBox[boxKey] = value;
        styles[BBOX_PROP[boxKey]] = value + (boxKey === 'x' || boxKey === 'y' ? props.bodyOffset[boxKey] : 0) + 'px';
        updated = true;
      }
    });
    if (updated) {
      setViewBox(props.svg, aplBBox);
    }

    // [DEBUG]

    if (!updated) {
      traceLog.add('not-updated');
    }

    // [/DEBUG]
    traceLog.add('</updateViewBox>'); // [DEBUG/]
    return updated;
  }

  /**
   * @param {props} props - `props` of `LeaderLine` instance.
   * @returns {boolean} `true` if it was changed.
   */
  function updateMask(props) {
    traceLog.add('<updateMask>'); // [DEBUG/]
    const curStats = props.curStats;
    const aplStats = props.aplStats;
    let lineMaskBGEnabled;
    let value;
    let updated = false;

    if (curStats.plug_enabled) {
      [0, 1].forEach((i) => {
        curStats.capsMaskMarker_enabledSE[i] =
          (curStats.plug_enabledSE[i] && curStats.plug_colorTraSE[i]) ||
          (curStats.plugOutline_enabledSE[i] && curStats.plugOutline_colorTraSE[i]);
      });
    } else {
      curStats.capsMaskMarker_enabledSE[0] = curStats.capsMaskMarker_enabledSE[1] = false;
    }
    curStats.capsMaskMarker_enabled = curStats.capsMaskMarker_enabledSE[0] || curStats.capsMaskMarker_enabledSE[1];

    // reserve for future version
    // curStats.lineMask_outlineMode = curStats.lineOutline_enabled || lineFGEnabled;
    curStats.lineMask_outlineMode = curStats.lineOutline_enabled;
    curStats.caps_enabled =
      curStats.capsMaskMarker_enabled || curStats.capsMaskAnchor_enabledSE[0] || curStats.capsMaskAnchor_enabledSE[1];
    curStats.lineMask_enabled = curStats.caps_enabled || curStats.lineMask_outlineMode;
    lineMaskBGEnabled = curStats.lineMask_enabled && !curStats.lineMask_outlineMode;

    if (lineMaskBGEnabled || curStats.lineOutline_enabled) {
      // maskBGRect_x, maskBGRect_y
      ['x', 'y'].forEach((boxKey) => {
        const statKey = 'maskBGRect_' + boxKey;
        if (
          setStat(
            props,
            aplStats,
            statKey,
            (value = curStats[statKey]),
            /* [DEBUG] */ null,
            statKey + '%_' /* [/DEBUG] */
          )
        ) {
          props.maskBGRect[boxKey].baseVal.value = value;
          updated = true;
        }
      });
    }

    if (setStat(props, aplStats, 'lineMask_enabled', (value = curStats.lineMask_enabled))) {
      props.lineFace.style.mask = value ? 'url(#' + props.lineMaskId + ')' : 'none';
      updated = true;
      if (IS_WEBKIT) {
        forceReflowAdd(props, props.lineMask);
      }
    }

    if (curStats.lineMask_enabled) {
      // Includes `outlineMode`

      // lineMask_outlineMode
      if (setStat(props, aplStats, 'lineMask_outlineMode', (value = curStats.lineMask_outlineMode))) {
        if (value) {
          props.lineMaskBG.style.display = 'none';
          props.lineMaskShape.style.display = 'inline';
        } else {
          props.lineMaskBG.style.display = 'inline';
          props.lineMaskShape.style.display = 'none';
        }
        updated = true;
      }

      // lineMask_x, lineMask_y
      ['x', 'y'].forEach((boxKey) => {
        const statKey = 'lineMask_' + boxKey;
        if (
          setStat(
            props,
            aplStats,
            statKey,
            (value = curStats[statKey]),
            /* [DEBUG] */ null,
            statKey + '%_' /* [/DEBUG] */
          )
        ) {
          props.lineMask[boxKey].baseVal.value = value;
          updated = true;
        }
      });

      if (setStat(props, aplStats, 'caps_enabled', (value = curStats.caps_enabled))) {
        props.lineMaskCaps.style.display = props.lineOutlineMaskCaps.style.display = value ? 'inline' : 'none';
        updated = true;
        if (IS_WEBKIT) {
          forceReflowAdd(props, props.capsMaskLine);
        }
      }

      if (curStats.caps_enabled) {
        // capsMaskAnchor
        [0, 1].forEach((i) => {
          let curPathData;

          if (
            setStat(
              props,
              aplStats.capsMaskAnchor_enabledSE,
              i,
              (value = curStats.capsMaskAnchor_enabledSE[i]),
              /* [DEBUG] */ null,
              'capsMaskAnchor_enabledSE[' + i + ']=%s' /* [/DEBUG] */
            )
          ) {
            props.capsMaskAnchorSE[i].style.display = value ? 'inline' : 'none';
            updated = true;
            if (IS_WEBKIT) {
              forceReflowAdd(props, props.lineMask);
            }
          }

          if (curStats.capsMaskAnchor_enabledSE[i]) {
            // capsMaskAnchor_pathDataSE
            if (
              pathDataHasChanged(
                (curPathData = curStats.capsMaskAnchor_pathDataSE[i]),
                aplStats.capsMaskAnchor_pathDataSE[i]
              )
            ) {
              traceLog.add('capsMaskAnchor_pathDataSE[' + i + ']'); // [DEBUG/]
              props.capsMaskAnchorSE[i].setPathData(curPathData);
              aplStats.capsMaskAnchor_pathDataSE[i] = curPathData;
              updated = true;
            }

            // capsMaskAnchor_strokeWidthSE
            if (
              setStat(
                props,
                aplStats.capsMaskAnchor_strokeWidthSE,
                i,
                (value = curStats.capsMaskAnchor_strokeWidthSE[i]),
                /* [DEBUG] */ null,
                'capsMaskAnchor_strokeWidthSE[' + i + ']=%s' /* [/DEBUG] */
              )
            ) {
              props.capsMaskAnchorSE[i].style.strokeWidth = value + 'px';
              updated = true;
            }
          }
        });

        if (setStat(props, aplStats, 'capsMaskMarker_enabled', (value = curStats.capsMaskMarker_enabled))) {
          props.capsMaskLine.style.display = value ? 'inline' : 'none';
          updated = true;
        }

        if (curStats.capsMaskMarker_enabled) {
          // capsMaskMarker
          [0, 1].forEach((i) => {
            const plugId = curStats.capsMaskMarker_plugSE[i],
              symbolConf = plugId !== PLUG_BEHIND ? SYMBOLS[PLUG_2_SYMBOL[plugId]] : null,
              marker = getMarkerProps(i, symbolConf);

            if (
              setStat(
                props,
                aplStats.capsMaskMarker_enabledSE,
                i,
                (value = curStats.capsMaskMarker_enabledSE[i]),
                /* [DEBUG] */ null,
                'capsMaskMarker_enabledSE[' + i + ']=%s' /* [/DEBUG] */
              )
            ) {
              props.capsMaskLine.style[marker.prop] = value ? 'url(#' + props.lineMaskMarkerIdSE[i] + ')' : 'none';
              updated = true;
            }

            if (curStats.capsMaskMarker_enabledSE[i]) {
              // capsMaskMarker_plugSE
              if (
                setStat(
                  props,
                  aplStats.capsMaskMarker_plugSE,
                  i,
                  plugId,
                  /* [DEBUG] */ null,
                  'capsMaskMarker_plugSE[' + i + ']=%s' /* [/DEBUG] */
                )
              ) {
                props.capsMaskMarkerShapeSE[i].href.baseVal = '#' + symbolConf.elmId;
                setMarkerOrient(
                  props,
                  props.capsMaskMarkerSE[i],
                  marker.orient,
                  symbolConf.bBox,
                  props.svg,
                  props.capsMaskMarkerShapeSE[i]
                );
                updated = true;
                if (IS_GECKO) {
                  // [GECKO] plugsFace is not updated when plugSE is changed
                  forceReflowAdd(props, props.capsMaskLine);
                  forceReflowAdd(props, props.lineFace);
                }
              }

              // capsMaskMarker_markerWidthSE, capsMaskMarker_markerHeightSE
              ['markerWidth', 'markerHeight'].forEach((markerKey) => {
                const statKey = 'capsMaskMarker_' + markerKey + 'SE';
                if (
                  setStat(
                    props,
                    aplStats[statKey],
                    i,
                    (value = curStats[statKey][i]),
                    /* [DEBUG] */ null,
                    statKey + '[' + i + ']%_' /* [/DEBUG] */
                  )
                ) {
                  props.capsMaskMarkerSE[i][markerKey].baseVal.value = value;
                  updated = true;
                }
              });
            }
          });
        }
      }
    }

    if (curStats.lineOutline_enabled) {
      // lineOutlineMask_x, lineOutlineMask_y
      ['x', 'y'].forEach((boxKey) => {
        const statKey = 'lineOutlineMask_' + boxKey;
        if (
          setStat(
            props,
            aplStats,
            statKey,
            (value = curStats[statKey]),
            /* [DEBUG] */ null,
            statKey + '%_' /* [/DEBUG] */
          )
        ) {
          props.lineOutlineMask[boxKey].baseVal.value = value;
          updated = true;
        }
      });
    }

    // [DEBUG]

    if (!updated) {
      traceLog.add('not-updated');
    }

    // [/DEBUG]
    traceLog.add('</updateMask>'); // [DEBUG/]
    return updated;
  }

  /**
   * @param {props} props - `props` of `LeaderLine` instance.
   * @param {(boolean|number)} on - true:show | false:hide | 1:show(in anim)
   * @returns {void}
   */
  function svgShow(props, on) {
    traceLog.add('<svgShow>'); // [DEBUG/]
    if (on !== props.isShown) {
      traceLog.add('on=' + on); // [DEBUG/]
      if (!!on !== !!props.isShown) {
        props.svg.style.visibility = on ? '' : 'hidden';
      }
      props.isShown = on;
      if (props.events && props.events.svgShow) {
        props.events.svgShow.forEach((handler) => {
          handler(props, on);
        });
      }
    }
    traceLog.add('</svgShow>'); // [DEBUG/]
  }

  /**
   * Apply all of `effect`.
   * @param {props} props - `props` of `LeaderLine` instance.
   * @returns {void}
   */
  function setEffect(props) {
    traceLog.add('<setEffect>'); // [DEBUG/]
    const curStats = props.curStats;
    const aplStats = props.aplStats;
    let enabled;

    // `flow` and `dash` both dash the line, and `flow` wins: effects are removed before any is
    // applied, so that the one turned on is not undone by the one turned off.
    const isEnabled = (effectName) =>
      curStats[effectName + '_enabled'] && !(effectName === 'dash' && curStats.flow_enabled);
    Object.keys(EFFECTS).forEach((effectName) => {
      if (aplStats[effectName + '_enabled'] && !isEnabled(effectName)) {
        setStat(props, aplStats, effectName + '_enabled', false);
        EFFECTS[effectName].remove(props);
      }
    });

    Object.keys(EFFECTS).forEach((effectName) => {
      const effectConf = EFFECTS[effectName],
        keyEnabled = effectName + '_enabled',
        keyOptions = effectName + '_options',
        curOptions = curStats[keyOptions];

      enabled = isEnabled(effectName);
      if (setStat(props, aplStats, keyEnabled, enabled)) {
        // ON/OFF
        if (enabled) {
          aplStats[keyOptions] = copyTree(curOptions);
        }
        effectConf[enabled ? 'init' : 'remove'](props);
      } else if (enabled && hasChanged(curOptions, aplStats[keyOptions])) {
        // update options
        // traceLog is called by EFFECTS.*
        effectConf.remove(props);
        aplStats[keyEnabled] = true; // it might have been disabled by remove().
        aplStats[keyOptions] = copyTree(curOptions);
        effectConf.init(props);
      }
    });

    traceLog.add('</setEffect>'); // [DEBUG/]
  }

  // Transitions of these properties do not move anything: they don't keep `autoPosition` going.
  const RE_PAINT_ONLY_PROPERTY =
    /^(?:color|background(?:-color|-image)?|opacity|visibility|(?:box|text)-shadow|filter|backdrop-filter|outline(?:-color)?|border(?:-(?:top|right|bottom|left))?-color|fill|stroke|caret-color|text-decoration-color|accent-color)$/;

  /**
   * The elements `start` and `end` are drawn from (the element of an attachment).
   * @param {props} props - `props` of `LeaderLine` instance.
   * @returns {Element[]} `[start, end]`.
   */
  function getAnchorElements(props) {
    return props.options.anchorSE.map((anchor, i) =>
      props.optionIsAttach.anchorSE[i] !== false ? insAttachProps[anchor._id].element : anchor
    );
  }

  /**
   * `autoPosition`: reposition the line when its elements may have moved, at most once per frame.
   * Watched: resizing, `class` and `style` changes and child changes of the elements and their
   * ancestors (out of frames too), scrolling, and, frame by frame while they run, the CSS
   * transitions of the documents and the CSS animations of those elements.
   * @param {props} props - `props` of `LeaderLine` instance.
   * @param {Element[]} elements - The anchor elements.
   * @returns {{elements: Element[], stop: function}} The watcher.
   */
  function watchPosition(props, elements) {
    const chain = new Set();
    const views = new Set();
    elements.forEach((element) => {
      let node = element;
      while (node) {
        chain.add(node);
        views.add(node.ownerDocument.defaultView);
        node = node.parentElement ?? node.ownerDocument.defaultView.frameElement;
      }
    });

    const baseWindow = props.baseWindow;
    const observers = [];
    const listeners = [];
    let requestId = null;
    let stopped = false;

    function isMoving() {
      for (const view of views) {
        for (const animation of view.document.getAnimations()) {
          if (animation.playState === 'running' || animation.pending) {
            if (animation.transitionProperty != null) {
              if (!RE_PAINT_ONLY_PROPERTY.test(animation.transitionProperty)) {
                return true;
              }
            } else if (chain.has(animation.effect?.target)) {
              return true;
            }
          }
        }
      }
      return false;
    }

    function frame() {
      requestId = null;
      if (stopped) {
        return;
      }
      update(props, { position: true });
      if (isMoving()) {
        schedule();
      }
    }

    function schedule() {
      requestId ??= baseWindow.requestAnimationFrame(frame);
    }

    views.forEach((view) => {
      const resizeObserver = new view.ResizeObserver(schedule);
      const mutationObserver = new view.MutationObserver(schedule);
      chain.forEach((node) => {
        if (node.ownerDocument.defaultView === view) {
          resizeObserver.observe(node);
          mutationObserver.observe(node, { attributes: true, attributeFilter: ['class', 'style'], childList: true });
        }
      });
      observers.push(resizeObserver, mutationObserver);
      ['scroll', 'transitionrun', 'animationstart'].forEach((type) => {
        view.document.addEventListener(type, schedule, { capture: true, passive: true });
        listeners.push([view.document, type]);
      });
    });

    return {
      elements,
      stop() {
        stopped = true;
        observers.forEach((observer) => observer.disconnect());
        listeners.forEach(([target, type]) => target.removeEventListener(type, schedule, { capture: true }));
        if (requestId != null) {
          baseWindow.cancelAnimationFrame(requestId);
          requestId = null;
        }
      }
    };
  }

  /**
   * Start, restart (the elements changed) or stop the `autoPosition` watcher.
   * @param {props} props - `props` of `LeaderLine` instance.
   * @returns {void}
   */
  function syncAutoPosition(props) {
    const watcher = props.positionWatcher;
    const elements = props.options.autoPosition ? getAnchorElements(props) : null;
    if (watcher && elements && watcher.elements.every((element, i) => element === elements[i])) {
      return;
    }
    if (watcher) {
      watcher.stop();
      props.positionWatcher = null;
    }
    if (elements) {
      props.positionWatcher = watchPosition(props, elements);
    }
  }

  /**
   * Apply current `options`.
   * @param {props} props - `props` of `LeaderLine` instance.
   * @param {Object} needs - `group` of stats.
   * @returns {void}
   */
  function update(props, needs) {
    const updated = {};
    if (needs.line) {
      updated.line = updateLine(props);
    }
    if (needs.plug || updated.line) {
      updated.plug = updatePlug(props);
    }
    if (needs.lineOutline || updated.line) {
      updated.lineOutline = updateLineOutline(props);
    }
    if (needs.plugOutline || updated.line || updated.plug || updated.lineOutline) {
      updated.plugOutline = updatePlugOutline(props);
    }
    if (needs.faces || updated.line || updated.plug || updated.lineOutline || updated.plugOutline) {
      updated.faces = updateFaces(props);
    }
    if (needs.position || updated.line || updated.plug) {
      updated.position = updatePosition(props);
    }
    if (needs.path || updated.position) {
      updated.path = updatePath(props);
    }
    updated.viewBox = updateViewBox(props);
    updated.mask = updateMask(props);
    if (needs.effect) {
      setEffect(props);
    }

    if ((IS_BLINK || IS_WEBKIT) && updated.line && !updated.path) {
      // [BLINK], [WEBKIT] lineSize is not updated when path is not changed
      forceReflowAdd(props, props.lineShape);
    }
    if (IS_BLINK && updated.plug && !updated.line) {
      // [BLINK] plugColorSE is not updated when Line is not changed
      forceReflowAdd(props, props.plugsFace);
    }
    forceReflowApply(props);

    const changed = Object.keys(updated).filter((key) => updated[key]);
    if (changed.length) {
      emit(props, 'update', { changed });
      if (updated.path) {
        emit(props, 'position');
      }
    }

    // [DEBUG]
    traceLog.add('<update>');
    Object.keys(updated).forEach((key) => {
      if (updated[key]) {
        traceLog.add('updated.' + key);
      }
    });
    traceLog.add('</update>');
    // [/DEBUG]
  }

  /**
   * CSS `easing` of a `timing` option: a keyword, or `[x1, y1, x2, y2]` of `cubic-bezier()`.
   * @param {(string|number[])} timing - `timing` of `AnimOptions`.
   * @returns {string} `easing` of the Web Animations API.
   */
  function toEasing(timing) {
    return typeof timing === 'string' ? timing : 'cubic-bezier(' + timing.join(', ') + ')';
  }

  /**
   * Position [0, 1] of a native animation in its current iteration, in playing forward time.
   * @param {Animation} animation - Animation of the Web Animations API.
   * @returns {number} timeRatio
   */
  function getAnimTimeRatio(animation) {
    const duration = animation.effect.getTiming().duration;
    if (!duration) {
      return animation.playbackRate < 0 ? 0 : 1;
    }
    const time = animation.currentTime ?? 0;
    return animation.effect.getTiming().iterations === Infinity
      ? (time % duration) / duration
      : Math.min(Math.max(time / duration, 0), 1);
  }

  /**
   * Stop and drop an animation: a native `Animation`, or a task of `anim`.
   * @param {(Animation|number)} animId - The animation.
   * @returns {void}
   */
  function removeAnim(animId) {
    if (animId && typeof animId === 'object') {
      animId.onfinish = null;
      animId.cancel();
    } else if (animId) {
      anim.remove(animId);
    }
  }

  /**
   * Whether to leave the motion out: `LeaderLine.reducedMotion` overrides, with `true` or
   * `false`, the `prefers-reduced-motion` user preference that is followed by default.
   * @param {props} props - `props` of `LeaderLine` instance.
   * @returns {boolean} `true` when the animations have to be left out.
   */
  function isReducedMotion(props) {
    const setting = LeaderLine.reducedMotion;
    if (typeof setting === 'boolean') {
      return setting;
    }
    const win = props.baseWindow || window;
    return !!win.matchMedia && win.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  /**
   * Finish the show effect: it ran to its end, or it has no animation.
   * @param {props} props - `props` of `LeaderLine` instance.
   * @param {string} effectName - Key of `SHOW_EFFECTS`.
   * @returns {void}
   */
  function finishShow(props, effectName) {
    SHOW_EFFECTS[effectName].stop(props, true);
    emit(props, props.aplStats.show_on ? 'shown' : 'hidden', { effect: effectName });
  }

  function getValidAnimOptions(animOptions, defaultAnimOptions) {
    return {
      duration:
        isFinite(animOptions.duration) && animOptions.duration > 0 ? animOptions.duration : defaultAnimOptions.duration,
      timing: anim.validTiming(animOptions.timing) ? animOptions.timing : copyTree(defaultAnimOptions.timing)
    };
  }

  function show(props, on, showEffectName, animOptions) {
    const curStats = props.curStats;
    const aplStats = props.aplStats;
    const update = {};
    let timeRatio;

    function applyStats() {
      ['show_on', 'show_effect', 'show_animOptions'].forEach((statName) => {
        aplStats[statName] = curStats[statName];
      });
    }

    curStats.show_on = on;
    if (showEffectName && SHOW_EFFECTS[showEffectName]) {
      curStats.show_effect = showEffectName;
      curStats.show_animOptions = getValidAnimOptions(
        isObject(animOptions) ? animOptions : {},
        SHOW_EFFECTS[showEffectName].defaultAnimOptions
      );
    }
    // Reduced motion: no animation this time, the chosen effect is kept for the next times.
    const chosenEffect = isReducedMotion(props) && [curStats.show_effect, curStats.show_animOptions];
    if (chosenEffect) {
      curStats.show_effect = 'none';
      curStats.show_animOptions = {};
    }

    update.show_on = curStats.show_on !== aplStats.show_on;
    update.show_effect = curStats.show_effect !== aplStats.show_effect;
    update.show_animOptions = hasChanged(curStats.show_animOptions, aplStats.show_animOptions);

    // Before the effect starts: `shown`/`hidden` follows, at once when there is no animation.
    if (update.show_on) {
      emit(props, on ? 'show' : 'hide', {
        effect: curStats.show_effect,
        animOptions: copyTree(curStats.show_animOptions)
      });
    }

    if (update.show_effect || update.show_animOptions) {
      if (curStats.show_inAnim) {
        // change and continue
        timeRatio = update.show_effect
          ? SHOW_EFFECTS[aplStats.show_effect].stop(props, true, true) // reset prev effect
          : SHOW_EFFECTS[aplStats.show_effect].stop(props);
        applyStats();
        SHOW_EFFECTS[aplStats.show_effect].init(props, timeRatio);
      } else if (update.show_on) {
        // init
        if (aplStats.show_effect && update.show_effect) {
          SHOW_EFFECTS[aplStats.show_effect].stop(props, true, true); // reset prev effect
        }
        applyStats();
        SHOW_EFFECTS[aplStats.show_effect].init(props);
      }
    } else if (update.show_on) {
      // restart
      applyStats();
      SHOW_EFFECTS[aplStats.show_effect].start(props);
    }

    // [DEBUG]
    traceLog.add('<show>');
    Object.keys(update).forEach((key) => {
      if (update[key]) {
        traceLog.add('update.' + key);
      }
    });
    traceLog.add('</show>');
    // [/DEBUG]

    if (chosenEffect) {
      [curStats.show_effect, curStats.show_animOptions] = chosenEffect;
    }
  }

  /**
   * @param {props} props - `props` of `LeaderLine` instance.
   * @param {attachProps} attachProps - `attachProps` of `LeaderLineAttachment` instance.
   * @param {string} optionName - Name of bound option.
   * @returns {boolean} `true` when binding succeeded.
   */
  function bindAttachment(props, attachProps, optionName) {
    const bindTarget = { props, optionName };
    if (
      !props.attachments.includes(attachProps) &&
      (!attachProps.conf.bind || attachProps.conf.bind(attachProps, bindTarget))
    ) {
      props.attachments.push(attachProps);
      attachProps.boundTargets.push(bindTarget);
      return true;
    }
    return false;
  }

  /**
   * @param {props} props - `props` of `LeaderLine` instance.
   * @param {attachProps} attachProps - `attachProps` of `LeaderLineAttachment` instance.
   * @param {boolean} [dontRemove] - Don't call `removeAttachment()`.
   * @returns {void}
   */
  function unbindAttachment(props, attachProps, dontRemove) {
    let i = props.attachments.indexOf(attachProps);
    if (i > -1) {
      props.attachments.splice(i, 1);
    }

    if (
      attachProps.boundTargets.some((boundTarget, iTarget) => {
        if (boundTarget.props === props) {
          if (attachProps.conf.unbind) {
            attachProps.conf.unbind(attachProps, boundTarget);
          }
          i = iTarget;
          return true;
        }
        return false;
      })
    ) {
      attachProps.boundTargets.splice(i, 1);
      if (!dontRemove) {
        addDelayedProc(() => {
          // Do it after all binding and unbinding.
          if (!attachProps.boundTargets.length) {
            removeAttachment(attachProps);
          }
        });
      }
    }
  }

  /**
   * @param {props} props - `props` of `LeaderLine` instance.
   * @param {Object} newOptions - New options.
   * @returns {void}
   */
  function setOptions(props, newOptions) {
    /*
      Names of `options`      Keys of API (properties of `newOptions`)
      ----------------------------------------
      anchorSE                start, end
      lineColor               color
      lineSize                size
      socketSE                startSocket, endSocket
      socketGravitySE         startSocketGravity, endSocketGravity
      plugSE                  startPlug, endPlug
      plugColorSE             startPlugColor, endPlugColor
      plugSizeSE              startPlugSize, endPlugSize
      lineOutlineEnabled      outline
      lineOutlineColor        outlineColor
      lineOutlineSize         outlineSize
      plugOutlineEnabledSE    startPlugOutline, endPlugOutline
      plugOutlineColorSE      startPlugOutlineColor, endPlugOutlineColor
      plugOutlineSizeSE       startPlugOutlineSize, endPlugOutlineSize
      labelSEM                startLabel, endLabel, middleLabel
    */
    const options = props.options;

    let newWindow;
    let needsWindow;
    const needs = {};

    function getCurOption(root, propName, optionName, index, defaultValue) {
      const curOption = {};
      if (optionName) {
        if (index != null) {
          curOption.container = root[optionName];
          curOption.key = index;
        } else {
          curOption.container = root;
          curOption.key = optionName;
        }
      } else {
        curOption.container = root;
        curOption.key = propName;
      }
      curOption.default = defaultValue;
      curOption.acceptsAuto = curOption.default == null;
      return curOption;
    }

    function setValidId(root, newOptions, propName, key2Id, optionName, index, defaultValue) {
      const curOption = getCurOption(root, propName, optionName, index, defaultValue);
      let updated;
      let key;
      let id;
      if (
        newOptions[propName] != null &&
        (key = (newOptions[propName] + '').toLowerCase()) &&
        ((curOption.acceptsAuto && key === KEYWORD_AUTO) || (id = key2Id[key])) &&
        id !== curOption.container[curOption.key]
      ) {
        curOption.container[curOption.key] = id; // `undefined` when `KEYWORD_AUTO`
        updated = true;
      }
      if (curOption.container[curOption.key] == null && !curOption.acceptsAuto) {
        curOption.container[curOption.key] = curOption.default;
        updated = true;
      }
      return updated;
    }

    function setValidType(root, newOptions, propName, type, optionName, index, defaultValue, check, trim) {
      const curOption = getCurOption(root, propName, optionName, index, defaultValue);
      let updated;
      let value;

      function isValidType(value, type) {
        return type === 'number' ? isFinite(value) : typeof value === type;
      }

      if (!type) {
        if (curOption.default == null) {
          throw new Error('Invalid `type`: ' + propName);
        }
        type = typeof curOption.default;
      }
      if (
        newOptions[propName] != null &&
        ((curOption.acceptsAuto && (newOptions[propName] + '').toLowerCase() === KEYWORD_AUTO) ||
          (isValidType((value = newOptions[propName]), type) &&
            ((value = trim && type === 'string' && value ? value.trim() : value) || true) &&
            (!check || check(value)))) &&
        value !== curOption.container[curOption.key]
      ) {
        curOption.container[curOption.key] = value; // `undefined` when `KEYWORD_AUTO`
        updated = true;
      }
      if (curOption.container[curOption.key] == null && !curOption.acceptsAuto) {
        curOption.container[curOption.key] = curOption.default;
        updated = true;
      }
      return updated;
    }

    newOptions = newOptions || {};

    // anchorSE
    ['start', 'end'].forEach((optionName, i) => {
      const newOption = newOptions[optionName];
      let newIsAttachment = false;
      if (
        newOption &&
        (isElement(newOption) || (newIsAttachment = isAttachment(newOption, 'anchor'))) &&
        newOption !== options.anchorSE[i]
      ) {
        if (props.optionIsAttach.anchorSE[i] !== false) {
          unbindAttachment(props, insAttachProps[options.anchorSE[i]._id]); // Unbind old
        }

        if (newIsAttachment && !bindAttachment(props, insAttachProps[newOption._id], optionName)) {
          // Bind new
          throw new Error("Can't bind attachment");
        }
        options.anchorSE[i] = newOption;
        props.optionIsAttach.anchorSE[i] = newIsAttachment;
        needsWindow = needs.position = true;
      }
    });
    if (!options.anchorSE[0] || !options.anchorSE[1] || options.anchorSE[0] === options.anchorSE[1]) {
      throw new Error('`start` and `end` are required.');
    }

    if (Object.hasOwn(newOptions, 'autoPosition')) {
      options.autoPosition = !!newOptions.autoPosition;
    }
    if (Object.hasOwn(newOptions, 'smoothPosition')) {
      const value = newOptions.smoothPosition;
      options.smoothPosition = value
        ? getValidAnimOptions(isObject(value) ? value : {}, DEFAULT_SMOOTH_POSITION)
        : false;
    }

    // Check window.
    if (
      needsWindow &&
      (newWindow = getCommonWindow(
        props.optionIsAttach.anchorSE[0] !== false
          ? insAttachProps[options.anchorSE[0]._id].element
          : options.anchorSE[0],
        props.optionIsAttach.anchorSE[1] !== false
          ? insAttachProps[options.anchorSE[1]._id].element
          : options.anchorSE[1]
      )) !== props.baseWindow
    ) {
      bindWindow(props, newWindow);
      needs.line = needs.plug = needs.lineOutline = needs.plugOutline = needs.faces = needs.effect = true;
    }

    needs.position =
      setValidId(options, newOptions, 'path', PATH_KEY_2_ID, null, null, DEFAULT_OPTIONS.path) || needs.position;
    needs.position = setValidId(options, newOptions, 'startSocket', SOCKET_KEY_2_ID, 'socketSE', 0) || needs.position;
    needs.position = setValidId(options, newOptions, 'endSocket', SOCKET_KEY_2_ID, 'socketSE', 1) || needs.position;

    // socketGravitySE
    [newOptions.startSocketGravity, newOptions.endSocketGravity].forEach((newOption, i) => {
      function matchArray(array1, array2) {
        return array1.length === array2.length && array1.every((value1, i) => value1 === array2[i]);
      }

      let value = false; // `false` means no-update input.
      if (newOption != null) {
        if (Array.isArray(newOption)) {
          if (isFinite(newOption[0]) && isFinite(newOption[1])) {
            value = [newOption[0], newOption[1]];
            if (Array.isArray(options.socketGravitySE[i]) && matchArray(value, options.socketGravitySE[i])) {
              value = false;
            }
          }
        } else {
          if ((newOption + '').toLowerCase() === KEYWORD_AUTO) {
            value = null;
          } else if (isFinite(newOption) && newOption >= 0) {
            value = newOption;
          }
          if (value === options.socketGravitySE[i]) {
            value = false;
          }
        }
        if (value !== false) {
          options.socketGravitySE[i] = value;
          needs.position = true;
        }
      }
    });

    // Line
    needs.line =
      setValidType(options, newOptions, 'color', null, 'lineColor', null, DEFAULT_OPTIONS.lineColor, null, true) ||
      needs.line;
    needs.line =
      setValidType(
        options,
        newOptions,
        'size',
        null,
        'lineSize',
        null,
        DEFAULT_OPTIONS.lineSize,
        (value) => value > 0
      ) || needs.line;

    // Plug
    ['startPlug', 'endPlug'].forEach((propName, i) => {
      needs.plug =
        setValidId(options, newOptions, propName, PLUG_KEY_2_ID, 'plugSE', i, DEFAULT_OPTIONS.plugSE[i]) || needs.plug;
      needs.plug =
        setValidType(options, newOptions, propName + 'Color', 'string', 'plugColorSE', i, null, null, true) ||
        needs.plug;
      needs.plug =
        setValidType(
          options,
          newOptions,
          propName + 'Size',
          null,
          'plugSizeSE',
          i,
          DEFAULT_OPTIONS.plugSizeSE[i],
          (value) => value > 0
        ) || needs.plug;
    });

    // LineOutline
    needs.lineOutline =
      setValidType(
        options,
        newOptions,
        'outline',
        null,
        'lineOutlineEnabled',
        null,
        DEFAULT_OPTIONS.lineOutlineEnabled
      ) || needs.lineOutline;
    needs.lineOutline =
      setValidType(
        options,
        newOptions,
        'outlineColor',
        null,
        'lineOutlineColor',
        null,
        DEFAULT_OPTIONS.lineOutlineColor,
        null,
        true
      ) || needs.lineOutline;
    needs.lineOutline =
      setValidType(
        options,
        newOptions,
        'outlineSize',
        null,
        'lineOutlineSize',
        null,
        DEFAULT_OPTIONS.lineOutlineSize,
        (value) => value > 0 && value <= 0.48
      ) || needs.lineOutline;

    // PlugOutline
    ['startPlugOutline', 'endPlugOutline'].forEach((propName, i) => {
      needs.plugOutline =
        setValidType(
          options,
          newOptions,
          propName,
          null,
          'plugOutlineEnabledSE',
          i,
          DEFAULT_OPTIONS.plugOutlineEnabledSE[i]
        ) || needs.plugOutline;
      needs.plugOutline =
        setValidType(options, newOptions, propName + 'Color', 'string', 'plugOutlineColorSE', i, null, null, true) ||
        needs.plugOutline;
      // `outlineMax` is checked in `updatePlugOutline`.
      needs.plugOutline =
        setValidType(
          options,
          newOptions,
          propName + 'Size',
          null,
          'plugOutlineSizeSE',
          i,
          DEFAULT_OPTIONS.plugOutlineSizeSE[i],
          (value) => value >= 1
        ) || needs.plugOutline;
    });

    // label
    ['startLabel', 'endLabel', 'middleLabel'].forEach((optionName, i) => {
      let newOption = newOptions[optionName];

      const oldOption =
        options.labelSEM[i] && !props.optionIsAttach.labelSEM[i]
          ? insAttachProps[options.labelSEM[i]._id].text
          : options.labelSEM[i];

      let newIsAttachment = false;
      let plain;
      let attachProps;
      let label;

      if ((plain = typeof newOption === 'string')) {
        newOption = newOption.trim();
      }
      if ((plain || (newOption && (newIsAttachment = isAttachment(newOption, 'label')))) && newOption !== oldOption) {
        if (options.labelSEM[i]) {
          unbindAttachment(props, insAttachProps[options.labelSEM[i]._id]); // Unbind old
          options.labelSEM[i] = '';
        }

        if (newOption) {
          if (newIsAttachment) {
            label = newOption;
            // Only one target can be bound.
            attachProps = insAttachProps[label._id];
            attachProps.boundTargets.slice().forEach(
              // Copy boundTargets because removeOption may change array.
              (boundTarget) => {
                attachProps.conf.removeOption(attachProps, boundTarget);
              }
            );
          } else {
            label = new LeaderLineAttachment(ATTACHMENTS.captionLabel, [newOption]);
          }
          if (!bindAttachment(props, insAttachProps[label._id], optionName)) {
            throw new Error("Can't bind attachment");
          }
          options.labelSEM[i] = label;
        }
        props.optionIsAttach.labelSEM[i] = newIsAttachment;
      }
    });

    // effect
    Object.keys(EFFECTS).forEach((effectName) => {
      const effectConf = EFFECTS[effectName];
      const keyEnabled = effectName + '_enabled';
      const keyOptions = effectName + '_options';
      let newOption;
      let optionValue;

      function getValidOptions(newEffectOptions) {
        const effectOptions = {};
        effectConf.optionsConf.forEach((optionConf) => {
          const optionClass = optionConf[0],
            optionName = optionConf[3],
            i = optionConf[4];
          if (i != null && !effectOptions[optionName]) {
            effectOptions[optionName] = [];
          }
          (typeof optionClass === 'function' ? optionClass : optionClass === 'id' ? setValidId : setValidType)(
            effectOptions,
            newEffectOptions,
            ...optionConf.slice(1)
          );
        });
        return effectOptions;
      }

      function parseAnimOptions(newEffectOptions) {
        let optionValue;
        const keyAnimOptions = effectName + '_animOptions';

        if (!Object.hasOwn(newEffectOptions, 'animation')) {
          optionValue = !!effectConf.defaultEnabled;
          props.curStats[keyAnimOptions] = optionValue ? getValidAnimOptions({}, effectConf.defaultAnimOptions) : null;
        } else if (isObject(newEffectOptions.animation)) {
          optionValue = props.curStats[keyAnimOptions] = getValidAnimOptions(
            newEffectOptions.animation,
            effectConf.defaultAnimOptions
          );
        } else {
          // boolean
          optionValue = !!newEffectOptions.animation;
          props.curStats[keyAnimOptions] = optionValue ? getValidAnimOptions({}, effectConf.defaultAnimOptions) : null;
        }
        return optionValue;
      }

      if (Object.hasOwn(newOptions, effectName)) {
        newOption = newOptions[effectName];

        if (isObject(newOption)) {
          props.curStats[keyEnabled] = true;
          optionValue = props.curStats[keyOptions] = getValidOptions(newOption);
          if (effectConf.anim) {
            props.curStats[keyOptions].animation = parseAnimOptions(newOption);
          }
        } else {
          // boolean
          optionValue = props.curStats[keyEnabled] = !!newOption;
          if (optionValue) {
            props.curStats[keyOptions] = getValidOptions({});
            if (effectConf.anim) {
              props.curStats[keyOptions].animation = parseAnimOptions({});
            }
          }
        }

        if (hasChanged(optionValue, options[effectName])) {
          options[effectName] = optionValue;
          needs.effect = true;
        }
      }
    });

    // [DEBUG]
    traceLog.add('<setOptions>');
    Object.keys(needs).forEach((key) => {
      if (needs[key]) {
        traceLog.add('needs.' + key);
      }
    });
    traceLog.add('</setOptions>');
    // [/DEBUG]

    update(props, needs);
    syncAutoPosition(props);
    emit(props, 'options', { options: Object.keys(newOptions) });
  }

  /**
   * @typedef {Array} EffectOptionConf - Args for checking ID or Type (or function)
   *    ['id', propName, key2Id, optionName, index, defaultValue] or
   *    ['type', propName, type, optionName, index, defaultValue, check, trim] or
   *    [function(effectOptions, newEffectOptions, propName, type, optionName, index),
   *            propName, type, optionName, index]
   */

  /**
   * @typedef {Object} EffectConf
   * @property {{statName: string, StatConf}} stats - Additional stats.
   * @property {EffectOptionConf[]} optionsConf
   * @property {Function} init - function(props)
   * @property {Function} remove - function(props)
   * @property {Function} update - function(props[, valueByEvent])
   * @property {boolean} [anim] - Support animation.
   * @property {AnimOptions} [defaultAnimOptions]
   * @property {boolean} [defaultAnimEnabled]
   */

  /** @type {{effectName: string, EffectConf}} */
  EFFECTS = {
    dash: {
      stats: { dash_len: {}, dash_gap: {}, dash_maxOffset: {} },
      anim: true,
      defaultAnimOptions: { duration: 1000, timing: 'linear' },

      optionsConf: [
        ['type', 'len', 'number', null, null, null, (value) => value > 0],
        ['type', 'gap', 'number', null, null, null, (value) => value > 0]
      ],

      init(props) {
        traceLog.add('<EFFECTS.dash.init>'); // [DEBUG/]
        addEventHandler(props, 'apl_line_strokeWidth', EFFECTS.dash.update);
        props.lineFace.style.strokeDashoffset = 0;
        EFFECTS.dash.update(props);
        traceLog.add('</EFFECTS.dash.init>'); // [DEBUG/]
      },

      remove(props) {
        traceLog.add('<EFFECTS.dash.remove>'); // [DEBUG/]
        const curStats = props.curStats;
        removeEventHandler(props, 'apl_line_strokeWidth', EFFECTS.dash.update);
        if (curStats.dash_animId) {
          removeAnim(curStats.dash_animId);
          curStats.dash_animId = null;
        }
        props.lineFace.style.strokeDasharray = 'none';
        props.lineFace.style.strokeDashoffset = 0;
        initStats(props.aplStats, EFFECTS.dash.stats);
        traceLog.add('</EFFECTS.dash.remove>'); // [DEBUG/]
      },

      update(props) {
        traceLog.add('<EFFECTS.dash.update>'); // [DEBUG/]
        const curStats = props.curStats;
        const aplStats = props.aplStats;
        const effectOptions = aplStats.dash_options;
        let update = false;
        let timeRatio;

        curStats.dash_len = effectOptions.len || aplStats.line_strokeWidth * 2;
        curStats.dash_gap = effectOptions.gap || aplStats.line_strokeWidth;
        curStats.dash_maxOffset = curStats.dash_len + curStats.dash_gap;

        update = setStat(props, aplStats, 'dash_len', curStats.dash_len) || update;
        update = setStat(props, aplStats, 'dash_gap', curStats.dash_gap) || update;
        if (update) {
          props.lineFace.style.strokeDasharray = aplStats.dash_len + ',' + aplStats.dash_gap;
        }

        if (curStats.dash_animOptions) {
          update = setStat(props, aplStats, 'dash_maxOffset', curStats.dash_maxOffset);

          if (
            aplStats.dash_animOptions && // ON -> ON (update)
            // Normally, animOptions is not changed because the effect was removed when it was changed.
            (update || hasChanged(curStats.dash_animOptions, aplStats.dash_animOptions))
          ) {
            traceLog.add('anim.remove'); // [DEBUG/]
            if (curStats.dash_animId) {
              timeRatio = getAnimTimeRatio(curStats.dash_animId);
              removeAnim(curStats.dash_animId);
              curStats.dash_animId = null;
            }
            aplStats.dash_animOptions = null;
          }

          if (!aplStats.dash_animOptions) {
            // OFF -> ON
            traceLog.add('anim.add'); // [DEBUG/]
            // Native, endless; left out with reduced motion (static dashes).
            if (!isReducedMotion(props)) {
              const animation = (curStats.dash_animId = props.lineFace.animate(
                [{ strokeDashoffset: aplStats.dash_maxOffset + 'px' }, { strokeDashoffset: '0px' }],
                {
                  duration: curStats.dash_animOptions.duration,
                  easing: toEasing(curStats.dash_animOptions.timing),
                  iterations: Infinity
                }
              ));
              if (timeRatio != null) {
                animation.currentTime = timeRatio * curStats.dash_animOptions.duration;
              }
            }
            aplStats.dash_animOptions = copyTree(curStats.dash_animOptions);
          }
        } else if (aplStats.dash_animOptions) {
          // ON -> OFF
          // Normally, anim was already removed when effectOptions was changed.
          traceLog.add('anim.remove'); // [DEBUG/]
          if (curStats.dash_animId) {
            removeAnim(curStats.dash_animId);
            curStats.dash_animId = null;
          }
          props.lineFace.style.strokeDashoffset = 0;
          aplStats.dash_animOptions = null;
        }

        traceLog.add('</EFFECTS.dash.update>'); // [DEBUG/]
      }
    },

    /**
     * Dashes or dots that move along the line at a constant speed, e.g. traffic on a cable.
     * `len` (0: dots), `gap` (auto: 3 times the line size), `speed` (px/s), `reverse`.
     */
    flow: {
      stats: { flow_len: {}, flow_gap: {}, flow_speed: {}, flow_reverse: {} },

      optionsConf: [
        ['type', 'len', 'number', null, null, null, (value) => value >= 0],
        ['type', 'gap', 'number', null, null, null, (value) => value > 0],
        ['type', 'speed', 'number', null, null, 80, (value) => value > 0],
        ['type', 'reverse', 'boolean', null, null, false]
      ],

      init(props) {
        traceLog.add('<EFFECTS.flow.init>'); // [DEBUG/]
        addEventHandler(props, 'apl_line_strokeWidth', EFFECTS.flow.update);
        props.lineFace.style.strokeLinecap = 'round';
        EFFECTS.flow.update(props);
        traceLog.add('</EFFECTS.flow.init>'); // [DEBUG/]
      },

      remove(props) {
        traceLog.add('<EFFECTS.flow.remove>'); // [DEBUG/]
        const curStats = props.curStats,
          style = props.lineFace.style;
        removeEventHandler(props, 'apl_line_strokeWidth', EFFECTS.flow.update);
        removeAnim(curStats.flow_animId);
        curStats.flow_animId = null;
        style.strokeDasharray = 'none';
        style.strokeDashoffset = 0;
        style.strokeLinecap = '';
        initStats(props.aplStats, EFFECTS.flow.stats);
        traceLog.add('</EFFECTS.flow.remove>'); // [DEBUG/]
      },

      update(props) {
        traceLog.add('<EFFECTS.flow.update>'); // [DEBUG/]
        const curStats = props.curStats,
          aplStats = props.aplStats,
          effectOptions = aplStats.flow_options;
        let update = false;

        curStats.flow_len = effectOptions.len ?? 0;
        curStats.flow_gap = effectOptions.gap ?? aplStats.line_strokeWidth * 3;
        curStats.flow_speed = effectOptions.speed;
        curStats.flow_reverse = effectOptions.reverse;
        ['flow_len', 'flow_gap', 'flow_speed', 'flow_reverse'].forEach((key) => {
          update = setStat(props, aplStats, key, curStats[key]) || update;
        });

        if (update) {
          const period = aplStats.flow_len + aplStats.flow_gap;
          props.lineFace.style.strokeDasharray = aplStats.flow_len + ',' + aplStats.flow_gap;
          removeAnim(curStats.flow_animId);
          curStats.flow_animId = null;
          // Native, endless; left out with reduced motion (static dots).
          if (!isReducedMotion(props)) {
            curStats.flow_animId = props.lineFace.animate(
              [{ strokeDashoffset: '0px' }, { strokeDashoffset: (aplStats.flow_reverse ? period : -period) + 'px' }],
              { duration: (period / aplStats.flow_speed) * 1000, iterations: Infinity }
            );
          }
        }
        traceLog.add('</EFFECTS.flow.update>'); // [DEBUG/]
      }
    },

    gradient: {
      stats: { gradient_colorSE: { hasSE: true }, gradient_pointSE: { hasSE: true, hasProps: true } },

      optionsConf: [
        ['type', 'startColor', 'string', 'colorSE', 0, null, null, true],
        ['type', 'endColor', 'string', 'colorSE', 1, null, null, true]
      ],

      init(props) {
        traceLog.add('<EFFECTS.gradient.init>'); // [DEBUG/]
        const baseDocument = props.baseWindow.document;
        const defs = props.defs;
        let element;
        const id = APP_ID + '-' + props._id + '-gradient';

        props.efc_gradient_gradient = element = defs.appendChild(
          baseDocument.createElementNS(SVG_NS, 'linearGradient')
        );
        element.id = id;
        element.gradientUnits.baseVal = SVGUnitTypes.SVG_UNIT_TYPE_USERSPACEONUSE;
        [element.x1, element.y1, element.x2, element.y2].forEach((len) => {
          len.baseVal.newValueSpecifiedUnits(SVGLength.SVG_LENGTHTYPE_PX, 0);
        });
        props.efc_gradient_stopSE = [0, 1].map((i) => {
          const element = props.efc_gradient_gradient.appendChild(baseDocument.createElementNS(SVG_NS, 'stop'));
          element.offset.baseVal = i; // offset === index
          return element;
        });

        addEventHandler(props, 'cur_plug_colorSE', EFFECTS.gradient.update);
        addEventHandler(props, 'apl_path', EFFECTS.gradient.update);
        props.curStats.line_altColor = true;
        props.lineFace.style.stroke = 'url(#' + id + ')';
        EFFECTS.gradient.update(props);
        traceLog.add('</EFFECTS.gradient.init>'); // [DEBUG/]
      },

      remove(props) {
        traceLog.add('<EFFECTS.gradient.remove>'); // [DEBUG/]
        if (props.efc_gradient_gradient) {
          props.defs.removeChild(props.efc_gradient_gradient);
          props.efc_gradient_gradient = props.efc_gradient_stopSE = null;
        }

        removeEventHandler(props, 'cur_plug_colorSE', EFFECTS.gradient.update);
        removeEventHandler(props, 'apl_path', EFFECTS.gradient.update);
        props.curStats.line_altColor = false;
        props.lineFace.style.stroke = props.curStats.line_color;
        initStats(props.aplStats, EFFECTS.gradient.stats);
        traceLog.add('</EFFECTS.gradient.remove>'); // [DEBUG/]
      },

      update(props) {
        traceLog.add('<EFFECTS.gradient.update>'); // [DEBUG/]
        const curStats = props.curStats;
        const aplStats = props.aplStats;
        const effectOptions = aplStats.gradient_options;
        const pathList = props.pathList.animVal || props.pathList.baseVal;
        let pathSeg;
        let point;

        [0, 1].forEach((i) => {
          curStats.gradient_colorSE[i] = effectOptions.colorSE[i] || curStats.plug_colorSE[i];
        });

        point = pathList[0][0];
        curStats.gradient_pointSE[0] = { x: point.x, y: point.y }; // first point of first seg
        pathSeg = pathList.at(-1);
        point = pathSeg.at(-1);
        curStats.gradient_pointSE[1] = { x: point.x, y: point.y }; // last point of last seg

        [0, 1].forEach((i) => {
          let value;

          if (
            setStat(
              props,
              aplStats.gradient_colorSE,
              i,
              (value = curStats.gradient_colorSE[i]),
              /* [DEBUG] */ null,
              'gradient_colorSE[' + i + ']=%s' /* [/DEBUG] */
            )
          ) {
            if (IS_WEBKIT) {
              // [WEBKIT] stopColor doesn't support alpha channel
              value = getAlpha(value);
              props.efc_gradient_stopSE[i].style.stopColor = value[1];
              props.efc_gradient_stopSE[i].style.stopOpacity = value[0];
            } else {
              props.efc_gradient_stopSE[i].style.stopColor = value;
            }
          }

          ['x', 'y'].forEach((pointKey) => {
            if ((value = curStats.gradient_pointSE[i][pointKey]) !== aplStats.gradient_pointSE[i][pointKey]) {
              traceLog.add('gradient_pointSE[' + i + '].' + pointKey); // [DEBUG/]
              props.efc_gradient_gradient[pointKey + (i + 1)].baseVal.value = aplStats.gradient_pointSE[i][pointKey] =
                value;
            }
          });
        });
        traceLog.add('</EFFECTS.gradient.update>'); // [DEBUG/]
      }
    },

    dropShadow: {
      stats: {
        dropShadow_dx: {},
        dropShadow_dy: {},
        dropShadow_blur: {},
        dropShadow_color: {},
        dropShadow_opacity: {},
        dropShadow_x: {},
        dropShadow_y: {}
      },

      optionsConf: [
        ['type', 'dx', null, null, null, 2],
        ['type', 'dy', null, null, null, 4],
        ['type', 'blur', null, null, null, 3, (value) => value >= 0],
        ['type', 'color', null, null, null, '#000', null, true],
        ['type', 'opacity', null, null, null, 0.8, (value) => value >= 0 && value <= 1]
      ],

      init(props) {
        traceLog.add('<EFFECTS.dropShadow.init>'); // [DEBUG/]
        const baseDocument = props.baseWindow.document,
          defs = props.defs,
          id = APP_ID + '-' + props._id + '-dropShadow',
          dropShadow = newDropShadow(baseDocument, id);

        ['elmFilter', 'elmOffset', 'elmBlur', 'styleFlood', 'elmsAppend'].forEach((key) => {
          props['efc_dropShadow_' + key] = dropShadow[key];
        });

        dropShadow.elmsAppend.forEach((elm) => {
          defs.appendChild(elm);
        });
        props.face.setAttribute('filter', 'url(#' + id + ')');

        addEventHandler(props, 'new_edge4viewBox', EFFECTS.dropShadow.adjustEdge);
        EFFECTS.dropShadow.update(props);
        traceLog.add('</EFFECTS.dropShadow.init>'); // [DEBUG/]
      },

      remove(props) {
        traceLog.add('<EFFECTS.dropShadow.remove>'); // [DEBUG/]
        const defs = props.defs;
        if (props.efc_dropShadow_elmsAppend) {
          props.efc_dropShadow_elmsAppend.forEach((elm) => {
            defs.removeChild(elm);
          });
          props.efc_dropShadow_elmFilter =
            props.efc_dropShadow_elmOffset =
            props.efc_dropShadow_elmBlur =
            props.efc_dropShadow_styleFlood =
            props.efc_dropShadow_elmsAppend =
              null;
        }

        removeEventHandler(props, 'new_edge4viewBox', EFFECTS.dropShadow.adjustEdge);
        update(props, {}); // To call updateViewBox()
        props.face.removeAttribute('filter');
        initStats(props.aplStats, EFFECTS.dropShadow.stats);
        traceLog.add('</EFFECTS.dropShadow.remove>'); // [DEBUG/]
      },

      update(props) {
        traceLog.add('<EFFECTS.dropShadow.update>'); // [DEBUG/]
        const curStats = props.curStats;
        const aplStats = props.aplStats;
        const effectOptions = aplStats.dropShadow_options;
        let value;
        let updateBBox;

        curStats.dropShadow_dx = value = effectOptions.dx;
        if (setStat(props, aplStats, 'dropShadow_dx', value)) {
          props.efc_dropShadow_elmOffset.dx.baseVal = value;
          updateBBox = true;
        }

        curStats.dropShadow_dy = value = effectOptions.dy;
        if (setStat(props, aplStats, 'dropShadow_dy', value)) {
          props.efc_dropShadow_elmOffset.dy.baseVal = value;
          updateBBox = true;
        }

        curStats.dropShadow_blur = value = effectOptions.blur;
        if (setStat(props, aplStats, 'dropShadow_blur', value)) {
          props.efc_dropShadow_elmBlur.setStdDeviation(value, value);
          updateBBox = true;
        }

        if (updateBBox) {
          update(props, {});
        } // To call updateViewBox()

        curStats.dropShadow_color = value = effectOptions.color;
        if (setStat(props, aplStats, 'dropShadow_color', value)) {
          props.efc_dropShadow_styleFlood.floodColor = value;
        }

        curStats.dropShadow_opacity = value = effectOptions.opacity;
        if (setStat(props, aplStats, 'dropShadow_opacity', value)) {
          props.efc_dropShadow_styleFlood.floodOpacity = value;
        }

        traceLog.add('</EFFECTS.dropShadow.update>'); // [DEBUG/]
      },

      adjustEdge(props, edge) {
        traceLog.add('<EFFECTS.dropShadow.adjustEdge>'); // [DEBUG/]
        const curStats = props.curStats;
        const aplStats = props.aplStats;
        let margin;
        let shadowEdge;
        if (curStats.dropShadow_dx != null) {
          margin = curStats.dropShadow_blur * 3; // nearly standard deviation
          shadowEdge = {
            x1: edge.x1 - margin + curStats.dropShadow_dx,
            y1: edge.y1 - margin + curStats.dropShadow_dy,
            x2: edge.x2 + margin + curStats.dropShadow_dx,
            y2: edge.y2 + margin + curStats.dropShadow_dy
          };
          if (shadowEdge.x1 < edge.x1) {
            edge.x1 = shadowEdge.x1;
          }
          if (shadowEdge.y1 < edge.y1) {
            edge.y1 = shadowEdge.y1;
          }
          if (shadowEdge.x2 > edge.x2) {
            edge.x2 = shadowEdge.x2;
          }
          if (shadowEdge.y2 > edge.y2) {
            edge.y2 = shadowEdge.y2;
          }

          // position filter
          ['x', 'y'].forEach((boxKey) => {
            const statKey = 'dropShadow_' + boxKey;
            let value;
            curStats[statKey] = value = edge[boxKey + '1'];
            if (setStat(props, aplStats, statKey, value)) {
              props.efc_dropShadow_elmFilter[boxKey].baseVal.value = value;
            }
          });
        }
        traceLog.add('</EFFECTS.dropShadow.adjustEdge>'); // [DEBUG/]
      }
    }
  };
  window.EFFECTS = EFFECTS; // [DEBUG/]

  Object.keys(EFFECTS).forEach((effectName) => {
    const effectConf = EFFECTS[effectName],
      effectStats = effectConf.stats;
    effectStats[effectName + '_enabled'] = { iniValue: false };
    effectStats[effectName + '_options'] = { hasProps: true };
    if (effectConf.anim) {
      effectStats[effectName + '_animOptions'] = {};
      effectStats[effectName + '_animId'] = {};
    }
  });

  /**
   * @typedef {Object} ShowEffectConf
   * @property {{statName: string, StatConf}} stats - Additional stats. *** NOT SUPPORTED
   * @property {Function} init - function(props[, timeRatio])
   * @property {Function} start - function(props[, timeRatio])
   * @property {Function} stop - function(props[, finish[, on]]) returns previous timeRatio
   * @property {AnimOptions} defaultAnimOptions
   */

  /** @type {{showEffectName: string, ShowEffectConf}} */
  SHOW_EFFECTS = {
    none: {
      defaultAnimOptions: {},

      init(props, timeRatio) {
        traceLog.add('<SHOW_EFFECTS.none.init>'); // [DEBUG/]
        const curStats = props.curStats;
        if (curStats.show_animId) {
          removeAnim(curStats.show_animId);
          curStats.show_animId = null;
        }
        SHOW_EFFECTS.none.start(props, timeRatio);
        traceLog.add('</SHOW_EFFECTS.none.init>'); // [DEBUG/]
      },

      start(props, timeRatio) {
        traceLog.add('<SHOW_EFFECTS.none.start>'); // [DEBUG/]
        // [DEBUG]
        traceLog.add('timeRatio=' + (timeRatio != null ? 'timeRatio' : 'NONE'));
        // [/DEBUG]
        finishShow(props, 'none');
        traceLog.add('</SHOW_EFFECTS.none.start>'); // [DEBUG/]
      },

      stop(props, finish, on) {
        traceLog.add('<SHOW_EFFECTS.none.stop>'); // [DEBUG/]
        traceLog.add('finish=' + finish); // [DEBUG/]
        // [DEBUG]
        const dbgLog = 'on=' + (on != null ? 'on' : 'aplStats.show_on');
        // [/DEBUG]
        const curStats = props.curStats;
        on = on ?? props.aplStats.show_on;
        traceLog.add(dbgLog + '=' + on); // [DEBUG/]
        curStats.show_inAnim = false;
        if (finish) {
          svgShow(props, on);
        }
        traceLog.add('</SHOW_EFFECTS.none.stop>'); // [DEBUG/]
        return on ? 1 : 0;
      }
    },

    fade: {
      defaultAnimOptions: { duration: 300, timing: 'linear' },

      init(props, timeRatio) {
        traceLog.add('<SHOW_EFFECTS.fade.init>'); // [DEBUG/]
        const curStats = props.curStats,
          aplStats = props.aplStats;
        removeAnim(curStats.show_animId);
        // Native: the opacity of the SVG is animated by the browser, off the main thread.
        const animation = (curStats.show_animId = props.svg.animate([{ opacity: 0 }, { opacity: 1 }], {
          duration: aplStats.show_animOptions.duration,
          easing: toEasing(aplStats.show_animOptions.timing),
          fill: 'both'
        }));
        animation.pause();
        animation.onfinish = () => {
          finishShow(props, 'fade');
        };
        SHOW_EFFECTS.fade.start(props, timeRatio);
        traceLog.add('</SHOW_EFFECTS.fade.init>'); // [DEBUG/]
      },

      start(props, timeRatio) {
        traceLog.add('<SHOW_EFFECTS.fade.start>'); // [DEBUG/]
        const curStats = props.curStats,
          animation = curStats.show_animId,
          on = props.aplStats.show_on;
        let prevTimeRatio;
        if (curStats.show_inAnim) {
          prevTimeRatio = getAnimTimeRatio(animation);
        }
        svgShow(props, 1);
        // [DEBUG]
        traceLog.add(
          'timeRatio=' + (timeRatio != null ? 'timeRatio' : prevTimeRatio != null ? 'prevTimeRatio' : 'NONE')
        );
        // [/DEBUG]
        curStats.show_inAnim = true;
        animation.playbackRate = on ? 1 : -1;
        animation.currentTime = (timeRatio ?? prevTimeRatio ?? (on ? 0 : 1)) * animation.effect.getTiming().duration;
        animation.play();
        traceLog.add('</SHOW_EFFECTS.fade.start>'); // [DEBUG/]
      },

      stop(props, finish, on) {
        traceLog.add('<SHOW_EFFECTS.fade.stop>'); // [DEBUG/]
        traceLog.add('finish=' + finish); // [DEBUG/]
        // [DEBUG]
        const dbgLog = 'on=' + (on != null ? 'on' : 'aplStats.show_on');
        // [/DEBUG]
        const curStats = props.curStats,
          animation = curStats.show_animId;
        let timeRatio;
        on = on ?? props.aplStats.show_on;
        traceLog.add(dbgLog + '=' + on); // [DEBUG/]
        if (curStats.show_inAnim && animation) {
          timeRatio = getAnimTimeRatio(animation);
          animation.pause();
        } else {
          timeRatio = on ? 1 : 0;
        }
        curStats.show_inAnim = false;
        if (finish) {
          if (animation) {
            animation.cancel(); // It can be played again by `start()`.
          }
          props.svg.style.opacity = on ? '' : '0';
          svgShow(props, on);
        }
        traceLog.add('</SHOW_EFFECTS.fade.stop>'); // [DEBUG/]
        return timeRatio;
      }
    },

    draw: {
      defaultAnimOptions: { duration: 500, timing: [0.58, 0, 0.42, 1] },

      init(props, timeRatio) {
        traceLog.add('<SHOW_EFFECTS.draw.init>'); // [DEBUG/]
        const curStats = props.curStats,
          aplStats = props.aplStats,
          pathList = props.pathList.baseVal,
          allPathLen = getAllPathListLen(pathList),
          pathSegsLen = allPathLen.segsLen,
          pathLenAll = allPathLen.lenAll;
        removeAnim(curStats.show_animId);

        curStats.show_animId = anim.add(
          (outputRatio) => {
            let pathLen,
              i = -1,
              newPathList,
              points,
              point;

            if (outputRatio === 0) {
              // This path might show incorrect angle of plug because it can't get the angle.
              // This path is for updatePath only when show_on === true.
              newPathList = [[pathList[0][0], pathList[0][0]]]; // line from start to start
            } else if (outputRatio === 1) {
              newPathList = pathList;
            } else {
              pathLen = pathLenAll * outputRatio;
              newPathList = [];
              while (pathLen >= pathSegsLen[++i]) {
                newPathList.push(pathList[i]);
                pathLen -= pathSegsLen[i];
              }
              if (pathLen) {
                points = pathList[i];
                if (points.length === 2) {
                  newPathList.push([points[0], getPointOnLine(points[0], points[1], pathLen / pathSegsLen[i])]);
                } else {
                  point = getPointOnCubic(
                    points[0],
                    points[1],
                    points[2],
                    points[3],
                    getCubicT(points[0], points[1], points[2], points[3], pathLen)
                  );
                  newPathList.push([points[0], point.fromP1, point.fromP2, point]);
                }
              }
            }
            return newPathList;
          },
          (value, finish) => {
            if (finish) {
              finishShow(props, 'draw');
            } else {
              props.pathList.animVal = value;
              update(props, { path: true });
            }
          },
          aplStats.show_animOptions.duration,
          1,
          aplStats.show_animOptions.timing,
          null,
          false
        );
        SHOW_EFFECTS.draw.start(props, timeRatio);
        traceLog.add('</SHOW_EFFECTS.draw.init>'); // [DEBUG/]
      },

      start(props, timeRatio) {
        traceLog.add('<SHOW_EFFECTS.draw.start>'); // [DEBUG/]
        const curStats = props.curStats;
        let prevTimeRatio;
        if (curStats.show_inAnim) {
          prevTimeRatio = anim.stop(curStats.show_animId);
        }
        svgShow(props, 1);
        // [DEBUG]
        traceLog.add(
          'timeRatio=' + (timeRatio != null ? 'timeRatio' : prevTimeRatio != null ? 'prevTimeRatio' : 'NONE')
        );
        // [/DEBUG]
        curStats.show_inAnim = true;
        addEventHandler(props, 'apl_position', SHOW_EFFECTS.draw.update);
        anim.start(curStats.show_animId, !props.aplStats.show_on, timeRatio ?? prevTimeRatio);
        traceLog.add('</SHOW_EFFECTS.draw.start>'); // [DEBUG/]
      },

      stop(props, finish, on) {
        traceLog.add('<SHOW_EFFECTS.draw.stop>'); // [DEBUG/]
        traceLog.add('finish=' + finish); // [DEBUG/]
        // [DEBUG]
        const dbgLog = 'on=' + (on != null ? 'on' : 'aplStats.show_on');

        // [/DEBUG]
        const curStats = props.curStats;

        let timeRatio;
        on = on ?? props.aplStats.show_on;
        traceLog.add(dbgLog + '=' + on); // [DEBUG/]
        timeRatio = curStats.show_inAnim ? anim.stop(curStats.show_animId) : on ? 1 : 0;
        curStats.show_inAnim = false;
        if (finish) {
          if (on) {
            props.pathList.animVal = null;
            update(props, { path: true });
          } else {
            // This path might show incorrect angle of plug because it can't get the angle.
            // But this is hidden. This path is for updatePath.
            props.pathList.animVal = [[props.pathList.baseVal[0][0], props.pathList.baseVal[0][0]]]; // line from start to start
            update(props, { path: true });
          }
          svgShow(props, on);
        }
        traceLog.add('</SHOW_EFFECTS.draw.stop>'); // [DEBUG/]
        return timeRatio;
      },

      update(props) {
        removeEventHandler(props, 'apl_position', SHOW_EFFECTS.draw.update);
        if (props.curStats.show_inAnim) {
          SHOW_EFFECTS.draw.init(props, SHOW_EFFECTS.draw.stop(props)); // reset
        } else {
          props.aplStats.show_animOptions = {}; // Make show() reset for new path at next time
        }
      }
    }
  };
  window.SHOW_EFFECTS = SHOW_EFFECTS; // [DEBUG/]

  /**
   * @class
   * @param {Element} [start] - Alternative to `options.start`.
   * @param {Element} [end] - Alternative to `options.end`.
   * @param {Object} [options] - Initial options.
   */
  function LeaderLine(start, end, options) {
    const props = {
      // Initialize properties as array.
      options: {
        anchorSE: [],
        socketSE: [],
        socketGravitySE: [],
        plugSE: [],
        plugColorSE: [],
        plugSizeSE: [],
        plugOutlineEnabledSE: [],
        plugOutlineColorSE: [],
        plugOutlineSizeSE: [],
        labelSEM: ['', '', '']
      },
      optionIsAttach: { anchorSE: [false, false], labelSEM: [false, false, false] },
      curStats: {},
      aplStats: {},
      attachments: [],
      events: {},
      reflowTargets: []
    };

    initStats(props.curStats, STATS);
    initStats(props.aplStats, STATS);
    Object.keys(EFFECTS).forEach((effectName) => {
      const effectStats = EFFECTS[effectName].stats;
      initStats(props.curStats, effectStats);
      initStats(props.aplStats, effectStats);
      props.options[effectName] = false;
    });
    initStats(props.curStats, SHOW_STATS);
    initStats(props.aplStats, SHOW_STATS);
    props.curStats.show_effect = DEFAULT_SHOW_EFFECT;
    props.curStats.show_animOptions = copyTree(SHOW_EFFECTS[DEFAULT_SHOW_EFFECT].defaultAnimOptions);

    Object.defineProperty(this, '_id', { value: ++insId });
    props._id = this._id;
    props.instance = this;
    insProps[this._id] = props;
    eventTargets.set(this, new EventTarget());

    if (arguments.length === 1) {
      options = start;
      start = null;
    }
    options = options || {};
    if (start || end) {
      options = copyTree(options);
      if (start) {
        options.start = start;
      }
      if (end) {
        options.end = end;
      }
    }
    props.isShown = props.aplStats.show_on = !options.hide; // isShown is applied in setOptions -> bindWindow
    this.setOptions(options);
  }

  (() => {
    function createSetter(propName) {
      return function (value) {
        const options = {};
        options[propName] = value;
        this.setOptions(options);
      };
    }

    // Setup option accessor methods (direct)
    [
      ['start', 'anchorSE', 0],
      ['end', 'anchorSE', 1],
      ['color', 'lineColor'],
      ['size', 'lineSize'],
      ['startSocketGravity', 'socketGravitySE', 0],
      ['endSocketGravity', 'socketGravitySE', 1],
      ['startPlugColor', 'plugColorSE', 0],
      ['endPlugColor', 'plugColorSE', 1],
      ['startPlugSize', 'plugSizeSE', 0],
      ['endPlugSize', 'plugSizeSE', 1],
      ['outline', 'lineOutlineEnabled'],
      ['outlineColor', 'lineOutlineColor'],
      ['outlineSize', 'lineOutlineSize'],
      ['startPlugOutline', 'plugOutlineEnabledSE', 0],
      ['endPlugOutline', 'plugOutlineEnabledSE', 1],
      ['startPlugOutlineColor', 'plugOutlineColorSE', 0],
      ['endPlugOutlineColor', 'plugOutlineColorSE', 1],
      ['startPlugOutlineSize', 'plugOutlineSizeSE', 0],
      ['endPlugOutlineSize', 'plugOutlineSizeSE', 1]
    ].forEach((conf) => {
      const propName = conf[0],
        optionName = conf[1],
        i = conf[2];
      Object.defineProperty(LeaderLine.prototype, propName, {
        get() {
          const value = // Don't use closure.
            i != null
              ? insProps[this._id].options[optionName][i]
              : optionName
                ? insProps[this._id].options[optionName]
                : insProps[this._id].options[propName];
          return value == null ? KEYWORD_AUTO : copyTree(value);
        },
        set: createSetter(propName),
        enumerable: true
      });
    });
    // Setup option accessor methods (key-to-id)
    [
      ['path', PATH_KEY_2_ID],
      ['startSocket', SOCKET_KEY_2_ID, 'socketSE', 0],
      ['endSocket', SOCKET_KEY_2_ID, 'socketSE', 1],
      ['startPlug', PLUG_KEY_2_ID, 'plugSE', 0],
      ['endPlug', PLUG_KEY_2_ID, 'plugSE', 1]
    ].forEach((conf) => {
      const propName = conf[0],
        key2Id = conf[1],
        optionName = conf[2],
        i = conf[3];
      Object.defineProperty(LeaderLine.prototype, propName, {
        get() {
          const value = // Don't use closure.
            i != null
              ? insProps[this._id].options[optionName][i]
              : optionName
                ? insProps[this._id].options[optionName]
                : insProps[this._id].options[propName];

          let key;
          return !value
            ? KEYWORD_AUTO
            : Object.keys(key2Id).some((optKey) => {
                  if (key2Id[optKey] === value) {
                    key = optKey;
                    return true;
                  }
                  return false;
                })
              ? key
              : new Error("It's broken");
        },
        set: createSetter(propName),
        enumerable: true
      });
    });
    // Setup option accessor methods (effect)
    Object.keys(EFFECTS).forEach((effectName) => {
      const effectConf = EFFECTS[effectName];

      function getOptions(optionValue) {
        const effectOptions = effectConf.optionsConf.reduce((effectOptions, optionConf) => {
          const optionClass = optionConf[0];
          const propName = optionConf[1];
          const key2Id = optionConf[2];
          const optionName = optionConf[3];
          const i = optionConf[4];

          const value =
            i != null ? optionValue[optionName][i] : optionName ? optionValue[optionName] : optionValue[propName];

          let key;
          effectOptions[propName] =
            optionClass === 'id'
              ? !value
                ? KEYWORD_AUTO
                : Object.keys(key2Id).some((optKey) => {
                      if (key2Id[optKey] === value) {
                        key = optKey;
                        return true;
                      }
                      return false;
                    })
                  ? key
                  : new Error("It's broken")
              : value == null
                ? KEYWORD_AUTO
                : copyTree(value);
          return effectOptions;
        }, {});
        if (effectConf.anim) {
          effectOptions.animation = copyTree(optionValue.animation);
        }
        return effectOptions;
      }

      Object.defineProperty(LeaderLine.prototype, effectName, {
        get() {
          const value = insProps[this._id].options[effectName];
          return isObject(value) ? getOptions(value) : value;
        },
        set: createSetter(effectName),
        enumerable: true
      });
    });
    // Setup option accessor methods (label)
    ['startLabel', 'endLabel', 'middleLabel'].forEach((propName, i) => {
      Object.defineProperty(LeaderLine.prototype, propName, {
        get() {
          const props = insProps[this._id],
            options = props.options; // Don't use closure.
          return options.labelSEM[i] && !props.optionIsAttach.labelSEM[i]
            ? insAttachProps[options.labelSEM[i]._id].text
            : options.labelSEM[i] || '';
        },
        set: createSetter(propName),
        enumerable: true
      });
    });
  })();

  LeaderLine.prototype.setOptions = function (newOptions) {
    setOptions(insProps[this._id], newOptions);
    return this;
  };

  LeaderLine.prototype.position = function () {
    update(insProps[this._id], { position: true });
    return this;
  };

  LeaderLine.prototype.remove = function () {
    const props = insProps[this._id],
      curStats = props.curStats;

    emit(props, 'remove');
    if (props.positionWatcher) {
      props.positionWatcher.stop();
      props.positionWatcher = null;
    }
    Object.keys(EFFECTS).forEach((effectName) => {
      removeAnim(curStats[effectName + '_animId']);
    });
    removeAnim(curStats.show_animId);
    removeAnim(curStats.position_animId);
    props.attachments.slice().forEach((attachProps) => {
      unbindAttachment(props, attachProps);
    });

    if (props.baseWindow && props.svg) {
      props.baseWindow.document.body.removeChild(props.svg);
    }
    delete insProps[this._id];
  };

  Object.defineProperty(LeaderLine.prototype, 'smoothPosition', {
    get() {
      const value = insProps[this._id].options.smoothPosition;
      return value ? copyTree(value) : false;
    },
    set(value) {
      this.setOptions({ smoothPosition: value });
    },
    enumerable: true
  });

  Object.defineProperty(LeaderLine.prototype, 'autoPosition', {
    get() {
      return !!insProps[this._id].options.autoPosition;
    },
    set(value) {
      this.setOptions({ autoPosition: value });
    },
    enumerable: true
  });

  /**
   * Listen to the events of this line: `update`, `position`, `options`, `show`, `hide`,
   * `shown`, `hidden` and `remove`. Same arguments as `EventTarget.addEventListener()`.
   * @returns {void}
   */
  LeaderLine.prototype.addEventListener = function (type, listener, options) {
    eventTargets.get(this).addEventListener(type, listener, options);
  };

  LeaderLine.prototype.removeEventListener = function (type, listener, options) {
    eventTargets.get(this).removeEventListener(type, listener, options);
  };

  /** Listen to the events of every line, as `LeaderLine.prototype.addEventListener()`. */
  LeaderLine.addEventListener = (type, listener, options) => {
    globalEventTarget.addEventListener(type, listener, options);
  };

  LeaderLine.removeEventListener = (type, listener, options) => {
    globalEventTarget.removeEventListener(type, listener, options);
  };

  LeaderLine.prototype.show = function (showEffectName, animOptions) {
    show(insProps[this._id], true, showEffectName, animOptions);
    return this;
  };

  LeaderLine.prototype.hide = function (showEffectName, animOptions) {
    show(insProps[this._id], false, showEffectName, animOptions);
    return this;
  };

  /**
   * @param {attachProps} attachProps - `attachProps` of `LeaderLineAttachment` instance.
   * @returns {void}
   */
  removeAttachment = (attachProps) => {
    traceLog.add('<removeAttachment>'); // [DEBUG/]
    if (attachProps && insAttachProps[attachProps._id]) {
      attachProps.boundTargets.slice().forEach((boundTarget) => {
        unbindAttachment(boundTarget.props, attachProps, true);
      });
      if (attachProps.conf.remove) {
        attachProps.conf.remove(attachProps);
      }
      delete insAttachProps[attachProps._id];
    } else {
      // [DEBUG/]
      traceLog.add('not-found'); // [DEBUG/]
    }
    traceLog.add('</removeAttachment>'); // [DEBUG/]
  };

  LeaderLineAttachment = (() => {
    /**
     * @class
     * @param {AttachConf} conf - Target AttachConf.
     * @param {Array} args - Initial options.
     */
    function LeaderLineAttachment(conf, args) {
      const attachProps = { conf, curStats: {}, aplStats: {}, boundTargets: [] };
      let attachOptions;
      const shortOptions = {};

      // Parse arguments
      conf.argOptions.every((argOption) => {
        if (
          args.length &&
          (typeof argOption.type === 'string'
            ? typeof args[0] === argOption.type
            : typeof argOption.type === 'function'
              ? argOption.type(args[0])
              : false)
        ) {
          shortOptions[argOption.optionName] = args.shift();
          return true;
        } else {
          return false;
        }
      });
      attachOptions = args.length && isObject(args[0]) ? copyTree(args[0]) : {};
      Object.keys(shortOptions).forEach((optionName) => {
        attachOptions[optionName] = shortOptions[optionName];
      });

      if (conf.stats) {
        initStats(attachProps.curStats, conf.stats);
        initStats(attachProps.aplStats, conf.stats);
      }

      Object.defineProperty(this, '_id', { value: ++insAttachId });
      Object.defineProperty(this, 'isRemoved', {
        get() {
          return !insAttachProps[this._id];
        }
      });
      attachProps._id = this._id;

      // isRemoved has to be set before this because init() might throw.
      if (!conf.init || conf.init(attachProps, attachOptions)) {
        insAttachProps[this._id] = attachProps;
      }
    }

    LeaderLineAttachment.prototype.remove = function () {
      traceLog.add('<LeaderLineAttachment.remove>'); // [DEBUG/]
      const that = this,
        attachProps = insAttachProps[that._id];
      if (attachProps) {
        attachProps.boundTargets.slice().forEach(
          // Copy boundTargets because removeOption may change array.
          (boundTarget) => {
            attachProps.conf.removeOption(attachProps, boundTarget);
          }
        );

        addDelayedProc(() => {
          const attachProps = insAttachProps[that._id];
          traceLog.add('<LeaderLineAttachment.remove.delayedProc>'); // [DEBUG/]
          if (attachProps) {
            // it should be removed by unbinding all
            traceLog.add('error-not-removed'); // [DEBUG/]
            console.error('LeaderLineAttachment was not removed by removeOption');
            removeAttachment(attachProps); // force
          }
          traceLog.add('</LeaderLineAttachment.remove.delayedProc>'); // [DEBUG/]
        });
      }
      traceLog.add('</LeaderLineAttachment.remove>'); // [DEBUG/]
    };

    return LeaderLineAttachment;
  })();
  window.LeaderLineAttachment = LeaderLineAttachment;

  /**
   * @param {any} obj - An object to be checked.
   * @param {string} [type] - A required type of LeaderLineAttachment.
   * @returns {(boolean|null)} true: Enabled LeaderLineAttachment, false: Not instance, null: Disabled it
   */
  isAttachment = (obj, type) =>
    !(obj instanceof LeaderLineAttachment)
      ? false
      : !obj.isRemoved && (!type || insAttachProps[obj._id].conf.type === type)
        ? true
        : null;

  /**
   * @typedef {Object} AttachConf
   * @property {string} type
   * @property {{string, (string|Class)}[]} argOptions - Shortcuts to options, in arguments. (Not Object)
   * @property {{statName: string, StatConf}} stats - Additional stats.
   * @property {Function} init - function(attachProps, attachOptions) returns `true` when succeeded.
   * @property {Function} bind - function(attachProps, bindTarget) returns `true` when succeeded.
   * @property {Function} unbind - function(attachProps, boundTarget)
   * @property {Function} removeOption - function(attachProps, boundTarget)
   * @property {Function} remove - function(attachProps)
   * @property {Function} [getStrokeWidth] - function(attachProps, props) type:anchor (update trigger)
   * @property {Function} [getPathData] - function(attachProps, props, strokeWidth) type:anchor
   * @property {Function} [getBBoxNest] - function(attachProps, props, strokeWidth) type:anchor
   * @property {Function} [initSvg] - function(attachProps, props) type:label
   */

  /** @type {{attachmentName: string, AttachConf}} */
  ATTACHMENTS = {
    pointAnchor: {
      type: 'anchor',
      argOptions: [{ optionName: 'element', type: isElement }],

      // attachOptions: element, x, y
      init(attachProps, attachOptions) {
        traceLog.add('<ATTACHMENTS.pointAnchor.init>'); // [DEBUG/]
        attachProps.element = ATTACHMENTS.pointAnchor.checkElement(attachOptions.element);
        attachProps.x = ATTACHMENTS.pointAnchor.parsePercent(attachOptions.x, true) || [0.5, true];
        attachProps.y = ATTACHMENTS.pointAnchor.parsePercent(attachOptions.y, true) || [0.5, true];
        traceLog.add('</ATTACHMENTS.pointAnchor.init>'); // [DEBUG/]
        return true;
      },

      removeOption(attachProps, boundTarget) {
        traceLog.add('<ATTACHMENTS.pointAnchor.removeOption>'); // [DEBUG/]
        traceLog.add('optionName=%s', boundTarget.optionName); // [DEBUG/]
        const props = boundTarget.props;
        const newOptions = {};
        let element = attachProps.element;
        const another = props.options.anchorSE[boundTarget.optionName === 'start' ? 1 : 0];
        if (element === another) {
          // must be not another
          element =
            another === document.body ? new LeaderLineAttachment(ATTACHMENTS.pointAnchor, [element]) : document.body;
        }
        newOptions[boundTarget.optionName] = element;
        setOptions(props, newOptions);
        traceLog.add('</ATTACHMENTS.pointAnchor.removeOption>'); // [DEBUG/]
      },

      getBBoxNest(attachProps, props) {
        const bBox = getBBoxNest(attachProps.element, props.baseWindow),
          width = bBox.width,
          height = bBox.height;
        bBox.width = bBox.height = 0;
        bBox.left = bBox.right = bBox.left + attachProps.x[0] * (attachProps.x[1] ? width : 1);
        bBox.top = bBox.bottom = bBox.top + attachProps.y[0] * (attachProps.y[1] ? height : 1);
        return bBox;
      },

      parsePercent(value, allowNegative) {
        let matches,
          num,
          ratio = false;
        if (isFinite(value)) {
          num = value;
        } else if (typeof value === 'string' && (matches = RE_PERCENT.exec(value)) && matches[2]) {
          num = parseFloat(matches[1]) / 100;
          ratio = num !== 0;
        }
        return num != null && (allowNegative || num >= 0) ? [num, ratio] : null;
      },

      checkElement(element) {
        if (element == null) {
          element = document.body;
        } else if (!isElement(element)) {
          throw new Error('`element` must be Element');
        }
        return element;
      }
    },

    areaAnchor: {
      type: 'anchor',
      argOptions: [
        { optionName: 'element', type: isElement },
        { optionName: 'shape', type: 'string' }
      ],
      stats: {
        color: {},
        strokeWidth: {},
        elementWidth: {},
        elementHeight: {},
        elementLeft: {},
        elementTop: {},
        pathListRel: {},
        bBoxRel: {},
        pathData: {},
        viewBoxBBox: { hasProps: true },
        dashLen: {},
        dashGap: {}
      },

      // attachOptions: element, color(A), fillColor, size(A), dash, shape, x, y, width, height, radius, points
      init(attachProps, attachOptions) {
        traceLog.add('<ATTACHMENTS.areaAnchor.init>'); // [DEBUG/]
        const points = [];
        let baseDocument;
        let svg;
        let window;
        attachProps.element = ATTACHMENTS.pointAnchor.checkElement(attachOptions.element);
        if (typeof attachOptions.color === 'string') {
          attachProps.color = attachOptions.color.trim();
        }
        if (typeof attachOptions.fillColor === 'string') {
          attachProps.fill = attachOptions.fillColor.trim();
        }
        if (isFinite(attachOptions.size) && attachOptions.size >= 0) {
          attachProps.size = attachOptions.size;
        }
        if (attachOptions.dash) {
          attachProps.dash = true;
          if (isFinite(attachOptions.dash.len) && attachOptions.dash.len > 0) {
            attachProps.dashLen = attachOptions.dash.len;
          }
          if (isFinite(attachOptions.dash.gap) && attachOptions.dash.gap > 0) {
            attachProps.dashGap = attachOptions.dash.gap;
          }
        }

        if (attachOptions.shape === 'circle') {
          attachProps.shape = attachOptions.shape;
        } else if (
          attachOptions.shape === 'polygon' &&
          Array.isArray(attachOptions.points) &&
          attachOptions.points.length >= 3 &&
          attachOptions.points.every((point) => {
            const validPoint = {};
            if (
              (validPoint.x = ATTACHMENTS.pointAnchor.parsePercent(point[0], true)) &&
              (validPoint.y = ATTACHMENTS.pointAnchor.parsePercent(point[1], true))
            ) {
              points.push(validPoint);
              if (validPoint.x[1] || validPoint.y[1]) {
                attachProps.hasRatio = true;
              }
              return true;
            }
            return false;
          })
        ) {
          attachProps.shape = attachOptions.shape;
          attachProps.points = points;
        } else {
          attachProps.shape = 'rect';
          attachProps.radius = isFinite(attachOptions.radius) && attachOptions.radius >= 0 ? attachOptions.radius : 0;
        }

        if (attachProps.shape === 'rect' || attachProps.shape === 'circle') {
          attachProps.x = ATTACHMENTS.pointAnchor.parsePercent(attachOptions.x, true) || [-0.05, true];
          attachProps.y = ATTACHMENTS.pointAnchor.parsePercent(attachOptions.y, true) || [-0.05, true];
          attachProps.width = ATTACHMENTS.pointAnchor.parsePercent(attachOptions.width) || [1.1, true];
          attachProps.height = ATTACHMENTS.pointAnchor.parsePercent(attachOptions.height) || [1.1, true];
          if (attachProps.x[1] || attachProps.y[1] || attachProps.width[1] || attachProps.height[1]) {
            attachProps.hasRatio = true;
          }
        }

        // SVG
        baseDocument = attachProps.element.ownerDocument;
        attachProps.svg = svg = baseDocument.createElementNS(SVG_NS, 'svg');
        svg.className.baseVal = APP_ID + '-areaAnchor';
        svg.setAttribute('viewBox', '0 0 0 0');
        attachProps.path = svg.appendChild(baseDocument.createElementNS(SVG_NS, 'path'));
        attachProps.path.style.fill = attachProps.fill || 'none';
        attachProps.isShown = false;
        svg.style.visibility = 'hidden';
        baseDocument.body.appendChild(svg);
        setupWindow((window = baseDocument.defaultView));
        attachProps.bodyOffset = getBodyOffset(window); // Get `bodyOffset`

        // event handler for this instance
        attachProps.updateColor = () => {
          traceLog.add('<ATTACHMENTS.areaAnchor.updateColor>'); // [DEBUG/]
          const curStats = attachProps.curStats;
          const aplStats = attachProps.aplStats;
          const llStats = attachProps.boundTargets.length ? attachProps.boundTargets[0].props.curStats : null;
          let value;

          curStats.color = value = attachProps.color || (llStats ? llStats.line_color : DEFAULT_OPTIONS.lineColor);
          if (setStat(attachProps, aplStats, 'color', value)) {
            attachProps.path.style.stroke = value;
          }
          traceLog.add('</ATTACHMENTS.areaAnchor.updateColor>'); // [DEBUG/]
        };

        attachProps.updateShow = () => {
          svgShow(
            attachProps,
            attachProps.boundTargets.some((boundTarget) => boundTarget.props.isShown === true)
          );
        };
        // event handler to update `strokeWidth` is unnecessary
        // because `getStrokeWidth` is triggered by `updateLine` and `updatePosition`

        traceLog.add('</ATTACHMENTS.areaAnchor.init>'); // [DEBUG/]
        return true;
      },

      bind(attachProps, bindTarget) {
        traceLog.add('<ATTACHMENTS.areaAnchor.bind>'); // [DEBUG/]
        const props = bindTarget.props;
        if (!attachProps.color) {
          addEventHandler(props, 'cur_line_color', attachProps.updateColor);
        }
        addEventHandler(props, 'svgShow', attachProps.updateShow);
        addDelayedProc(() => {
          // after updating `attachProps.boundTargets`
          attachProps.updateColor();
          attachProps.updateShow();
        });
        traceLog.add('</ATTACHMENTS.areaAnchor.bind>'); // [DEBUG/]
        return true;
      },

      unbind(attachProps, boundTarget) {
        traceLog.add('<ATTACHMENTS.areaAnchor.unbind>'); // [DEBUG/]
        const props = boundTarget.props;
        if (!attachProps.color) {
          removeEventHandler(props, 'cur_line_color', attachProps.updateColor);
        }
        removeEventHandler(props, 'svgShow', attachProps.updateShow);

        if (attachProps.boundTargets.length > 1) {
          // It's not removed yet.
          addDelayedProc(() => {
            // after updating `attachProps.boundTargets`
            traceLog.add('<ATTACHMENTS.areaAnchor.unbind.delayedProc>'); // [DEBUG/]
            attachProps.updateColor();
            attachProps.updateShow();
            if (ATTACHMENTS.areaAnchor.update(attachProps)) {
              // it's not called by unbound ll
              traceLog.add('update-boundTargets'); // [DEBUG/]
              attachProps.boundTargets.forEach((boundTarget) => {
                // Update other instances.
                update(boundTarget.props, { position: true });
              });
            }
            traceLog.add('</ATTACHMENTS.areaAnchor.unbind.delayedProc>'); // [DEBUG/]
          });
        }
        traceLog.add('</ATTACHMENTS.areaAnchor.unbind>'); // [DEBUG/]
      },

      removeOption(attachProps, boundTarget) {
        ATTACHMENTS.pointAnchor.removeOption(attachProps, boundTarget);
      },

      remove(attachProps) {
        traceLog.add('<ATTACHMENTS.areaAnchor.remove>'); // [DEBUG/]
        if (attachProps.boundTargets.length) {
          // it should be unbound by LeaderLineAttachment.remove
          traceLog.add('error-not-unbound'); // [DEBUG/]
          console.error('LeaderLineAttachment was not unbound by remove');
          attachProps.boundTargets.forEach((boundTarget) => {
            ATTACHMENTS.areaAnchor.unbind(attachProps, boundTarget);
          });
        }
        attachProps.svg.parentNode.removeChild(attachProps.svg);
        traceLog.add('</ATTACHMENTS.areaAnchor.remove>'); // [DEBUG/]
      },

      getStrokeWidth(attachProps, props) {
        traceLog.add('<ATTACHMENTS.areaAnchor.getStrokeWidth>'); // [DEBUG/]
        if (ATTACHMENTS.areaAnchor.update(attachProps) && attachProps.boundTargets.length > 1) {
          traceLog.add('update-boundTargets'); // [DEBUG/]
          addDelayedProc(() => {
            attachProps.boundTargets.forEach((boundTarget) => {
              // Update other instances.
              if (boundTarget.props !== props) {
                update(boundTarget.props, { position: true });
              }
            });
          });
        }
        traceLog.add('</ATTACHMENTS.areaAnchor.getStrokeWidth>'); // [DEBUG/]
        return attachProps.curStats.strokeWidth;
      },

      getPathData(attachProps, props) {
        const bBox = getBBoxNest(attachProps.element, props.baseWindow);
        return pathList2PathData(attachProps.curStats.pathListRel, (point) => {
          point.x += bBox.left;
          point.y += bBox.top;
        });
      },

      getBBoxNest(attachProps, props) {
        const bBox = getBBoxNest(attachProps.element, props.baseWindow),
          bBoxRel = attachProps.curStats.bBoxRel;
        return {
          left: bBoxRel.left + bBox.left,
          top: bBoxRel.top + bBox.top,
          right: bBoxRel.right + bBox.left,
          bottom: bBoxRel.bottom + bBox.top,
          width: bBoxRel.width,
          height: bBoxRel.height
        };
      },

      update(attachProps) {
        traceLog.add('<ATTACHMENTS.areaAnchor.update>'); // [DEBUG/]
        const curStats = attachProps.curStats;
        const aplStats = attachProps.aplStats;
        const llStats = attachProps.boundTargets.length ? attachProps.boundTargets[0].props.curStats : null;
        let elementBBox;
        let value;
        const updated = {};

        updated.strokeWidth = setStat(
          attachProps,
          curStats,
          'strokeWidth',
          attachProps.size ?? (llStats ? llStats.line_strokeWidth : DEFAULT_OPTIONS.lineSize)
        );

        elementBBox = getBBox(attachProps.element);
        updated.elementWidth = setStat(attachProps, curStats, 'elementWidth', elementBBox.width);
        updated.elementHeight = setStat(attachProps, curStats, 'elementHeight', elementBBox.height);
        updated.elementLeft = setStat(attachProps, curStats, 'elementLeft', elementBBox.left);
        updated.elementTop = setStat(attachProps, curStats, 'elementTop', elementBBox.top);

        if (updated.strokeWidth || (attachProps.hasRatio && (updated.elementWidth || updated.elementHeight))) {
          // generate path
          traceLog.add('generate-path'); // [DEBUG/]
          switch (attachProps.shape) {
            case 'rect':
              (() => {
                let areaBBox, radius, maxRadius, side, strokePadding, offsetC, padding, points, cpR;
                areaBBox = {
                  left: attachProps.x[0] * (attachProps.x[1] ? elementBBox.width : 1),
                  top: attachProps.y[0] * (attachProps.y[1] ? elementBBox.height : 1),
                  width: attachProps.width[0] * (attachProps.width[1] ? elementBBox.width : 1),
                  height: attachProps.height[0] * (attachProps.height[1] ? elementBBox.height : 1)
                };
                areaBBox.right = areaBBox.left + areaBBox.width;
                areaBBox.bottom = areaBBox.top + areaBBox.height;

                strokePadding = curStats.strokeWidth / 2;
                side = Math.min(areaBBox.width, areaBBox.height);
                maxRadius = side ? (side / 2) * Math.SQRT2 + strokePadding : 0;
                radius = !attachProps.radius ? 0 : attachProps.radius <= maxRadius ? attachProps.radius : maxRadius;
                if (radius) {
                  offsetC = (radius - strokePadding) / Math.SQRT2;
                  padding = radius - offsetC;
                  cpR = radius * CIRCLE_CP;

                  points = [
                    { x: areaBBox.left - padding, y: areaBBox.top + offsetC }, // 0 left-top-start
                    { x: areaBBox.left + offsetC, y: areaBBox.top - padding }, // 1 left-top-end
                    { x: areaBBox.right - offsetC, y: areaBBox.top - padding }, // 2 right-top-start
                    { x: areaBBox.right + padding, y: areaBBox.top + offsetC }, // 3 right-top-end
                    { x: areaBBox.right + padding, y: areaBBox.bottom - offsetC }, // 4 right-bottom-start
                    { x: areaBBox.right - offsetC, y: areaBBox.bottom + padding }, // 5 right-bottom-end
                    { x: areaBBox.left + offsetC, y: areaBBox.bottom + padding }, // 6 left-bottom-start
                    { x: areaBBox.left - padding, y: areaBBox.bottom - offsetC } // 7 left-bottom-end
                  ];
                  curStats.pathListRel = [
                    [
                      points[0],
                      { x: points[0].x, y: points[0].y - cpR },
                      { x: points[1].x - cpR, y: points[1].y },
                      points[1]
                    ]
                  ];
                  if (points[1].x !== points[2].x) {
                    curStats.pathListRel.push([points[1], points[2]]);
                  }
                  curStats.pathListRel.push([
                    points[2],
                    { x: points[2].x + cpR, y: points[2].y },
                    { x: points[3].x, y: points[3].y - cpR },
                    points[3]
                  ]);
                  if (points[3].y !== points[4].y) {
                    curStats.pathListRel.push([points[3], points[4]]);
                  }
                  curStats.pathListRel.push([
                    points[4],
                    { x: points[4].x, y: points[4].y + cpR },
                    { x: points[5].x + cpR, y: points[5].y },
                    points[5]
                  ]);
                  if (points[5].x !== points[6].x) {
                    curStats.pathListRel.push([points[5], points[6]]);
                  }
                  curStats.pathListRel.push([
                    points[6],
                    { x: points[6].x - cpR, y: points[6].y },
                    { x: points[7].x, y: points[7].y + cpR },
                    points[7]
                  ]);
                  if (points[7].y !== points[0].y) {
                    curStats.pathListRel.push([points[7], points[0]]);
                  }
                  curStats.pathListRel.push([]);

                  padding = radius - offsetC + curStats.strokeWidth / 2;
                  points = [
                    { x: areaBBox.left - padding, y: areaBBox.top - padding }, // left-top
                    { x: areaBBox.right + padding, y: areaBBox.bottom + padding }
                  ]; // right-bottom
                  curStats.bBoxRel = {
                    left: points[0].x,
                    top: points[0].y,
                    right: points[1].x,
                    bottom: points[1].y,
                    width: points[1].x - points[0].x,
                    height: points[1].y - points[0].y
                  };
                } else {
                  padding = curStats.strokeWidth / 2;
                  points = [
                    { x: areaBBox.left - padding, y: areaBBox.top - padding }, // left-top
                    { x: areaBBox.right + padding, y: areaBBox.bottom + padding }
                  ]; // right-bottom
                  curStats.pathListRel = [
                    [points[0], { x: points[1].x, y: points[0].y }],
                    [{ x: points[1].x, y: points[0].y }, points[1]],
                    [points[1], { x: points[0].x, y: points[1].y }],
                    []
                  ];

                  points = [
                    { x: areaBBox.left - curStats.strokeWidth, y: areaBBox.top - curStats.strokeWidth }, // left-top
                    { x: areaBBox.right + curStats.strokeWidth, y: areaBBox.bottom + curStats.strokeWidth }
                  ]; // right-bottom
                  curStats.bBoxRel = {
                    left: points[0].x,
                    top: points[0].y,
                    right: points[1].x,
                    bottom: points[1].y,
                    width: points[1].x - points[0].x,
                    height: points[1].y - points[0].y
                  };
                }
              })();
              break;

            case 'circle':
              (() => {
                let areaBBox,
                  cx,
                  cy,
                  radiusX,
                  radiusY,
                  cpRX,
                  cpRY,
                  strokePadding,
                  offsetCX,
                  offsetCY,
                  paddingX,
                  paddingY,
                  points;
                areaBBox = {
                  left: attachProps.x[0] * (attachProps.x[1] ? elementBBox.width : 1),
                  top: attachProps.y[0] * (attachProps.y[1] ? elementBBox.height : 1),
                  width: attachProps.width[0] * (attachProps.width[1] ? elementBBox.width : 1),
                  height: attachProps.height[0] * (attachProps.height[1] ? elementBBox.height : 1)
                };
                if (!areaBBox.width && !areaBBox.height) {
                  areaBBox.width = areaBBox.height = 10; // values are required
                }
                if (!areaBBox.width) {
                  areaBBox.width = areaBBox.height;
                }
                if (!areaBBox.height) {
                  areaBBox.height = areaBBox.width;
                }
                areaBBox.right = areaBBox.left + areaBBox.width;
                areaBBox.bottom = areaBBox.top + areaBBox.height;

                cx = areaBBox.left + areaBBox.width / 2;
                cy = areaBBox.top + areaBBox.height / 2;
                strokePadding = curStats.strokeWidth / 2;
                offsetCX = areaBBox.width / 2;
                offsetCY = areaBBox.height / 2;
                radiusX = offsetCX * Math.SQRT2 + strokePadding;
                radiusY = offsetCY * Math.SQRT2 + strokePadding;
                cpRX = radiusX * CIRCLE_CP;
                cpRY = radiusY * CIRCLE_CP;

                points = [
                  { x: cx - radiusX, y: cy }, // 0 left
                  { x: cx, y: cy - radiusY }, // 1 top
                  { x: cx + radiusX, y: cy }, // 2 right
                  { x: cx, y: cy + radiusY } // 3 bottom
                ];
                curStats.pathListRel = [
                  [
                    points[0],
                    { x: points[0].x, y: points[0].y - cpRY },
                    { x: points[1].x - cpRX, y: points[1].y },
                    points[1]
                  ],
                  [
                    points[1],
                    { x: points[1].x + cpRX, y: points[1].y },
                    { x: points[2].x, y: points[2].y - cpRY },
                    points[2]
                  ],
                  [
                    points[2],
                    { x: points[2].x, y: points[2].y + cpRY },
                    { x: points[3].x + cpRX, y: points[3].y },
                    points[3]
                  ],
                  [
                    points[3],
                    { x: points[3].x - cpRX, y: points[3].y },
                    { x: points[0].x, y: points[0].y + cpRY },
                    points[0]
                  ],
                  []
                ];

                paddingX = radiusX - offsetCX + curStats.strokeWidth / 2;
                paddingY = radiusY - offsetCY + curStats.strokeWidth / 2;
                points = [
                  { x: areaBBox.left - paddingX, y: areaBBox.top - paddingY }, // left-top
                  { x: areaBBox.right + paddingX, y: areaBBox.bottom + paddingY }
                ]; // right-bottom
                curStats.bBoxRel = {
                  left: points[0].x,
                  top: points[0].y,
                  right: points[1].x,
                  bottom: points[1].y,
                  width: points[1].x - points[0].x,
                  height: points[1].y - points[0].y
                };
              })();
              break;

            case 'polygon':
              (() => {
                let areaBBox, curPoint, padding, points;
                attachProps.points.forEach((point) => {
                  const x = point.x[0] * (point.x[1] ? elementBBox.width : 1),
                    y = point.y[0] * (point.y[1] ? elementBBox.height : 1);
                  if (areaBBox) {
                    if (x < areaBBox.left) {
                      areaBBox.left = x;
                    }
                    if (x > areaBBox.right) {
                      areaBBox.right = x;
                    }
                    if (y < areaBBox.top) {
                      areaBBox.top = y;
                    }
                    if (y > areaBBox.bottom) {
                      areaBBox.bottom = y;
                    }
                  } else {
                    areaBBox = { left: x, right: x, top: y, bottom: y };
                  }

                  if (curPoint) {
                    curStats.pathListRel.push([curPoint, { x, y }]);
                  } else {
                    curStats.pathListRel = [];
                  }
                  curPoint = { x, y };
                });
                curStats.pathListRel.push([]);

                padding = curStats.strokeWidth / 2;
                points = [
                  { x: areaBBox.left - padding, y: areaBBox.top - padding }, // left-top
                  { x: areaBBox.right + padding, y: areaBBox.bottom + padding }
                ]; // right-bottom
                curStats.bBoxRel = {
                  left: points[0].x,
                  top: points[0].y,
                  right: points[1].x,
                  bottom: points[1].y,
                  width: points[1].x - points[0].x,
                  height: points[1].y - points[0].y
                };
              })();
              break;

            // no default
          }
          updated.pathListRel = updated.bBoxRel = true;
        }
        if (updated.pathListRel || updated.elementLeft || updated.elementTop) {
          curStats.pathData = pathList2PathData(curStats.pathListRel, (point) => {
            point.x += elementBBox.left;
            point.y += elementBBox.top;
          });
        }

        if (setStat(attachProps, aplStats, 'strokeWidth', (value = curStats.strokeWidth))) {
          attachProps.path.style.strokeWidth = value + 'px';
        }

        // Apply `pathData`
        if (pathDataHasChanged((value = curStats.pathData), aplStats.pathData)) {
          traceLog.add('pathData'); // [DEBUG/]
          attachProps.path.setPathData(value);
          aplStats.pathData = value;
          updated.pathData = true;
        }

        // dash
        if (attachProps.dash) {
          if (updated.pathData || (updated.strokeWidth && (!attachProps.dashLen || !attachProps.dashGap))) {
            curStats.dashLen = attachProps.dashLen || curStats.strokeWidth * 2;
            curStats.dashGap = attachProps.dashGap || curStats.strokeWidth;
            /* necessity? (it's necessary when animation is supported)
            (function() { // Adjust dash with pathLen
              var pathLenAll, dashCount;
              pathLenAll = getAllPathDataLen(curStats.pathData);
              dashCount = Math.floor(pathLenAll / (curStats.dashLen + curStats.dashGap));
              if (dashCount >= 2) {
                curStats.dashLen = pathLenAll / dashCount - curStats.dashGap;
              }
            })();
            */
          }
          updated.dash = setStat(attachProps, aplStats, 'dashLen', curStats.dashLen) || updated.dash;
          updated.dash = setStat(attachProps, aplStats, 'dashGap', curStats.dashGap) || updated.dash;
          if (updated.dash) {
            attachProps.path.style.strokeDasharray = aplStats.dashLen + ',' + aplStats.dashGap;
          }
        }

        // ViewBox
        (() => {
          const curVBBBox = curStats.viewBoxBBox;
          const aplVBBBox = aplStats.viewBoxBBox;
          const styles = attachProps.svg.style;
          let viewBoxUpdated = false;
          curVBBBox.x = curStats.bBoxRel.left + elementBBox.left;
          curVBBBox.y = curStats.bBoxRel.top + elementBBox.top;
          curVBBBox.width = curStats.bBoxRel.width;
          curVBBBox.height = curStats.bBoxRel.height;
          ['x', 'y', 'width', 'height'].forEach((boxKey) => {
            if ((value = curVBBBox[boxKey]) !== aplVBBBox[boxKey]) {
              traceLog.add(boxKey); // [DEBUG/]
              aplVBBBox[boxKey] = value;
              styles[BBOX_PROP[boxKey]] =
                value + (boxKey === 'x' || boxKey === 'y' ? attachProps.bodyOffset[boxKey] : 0) + 'px';
              viewBoxUpdated = true;
            }
          });
          if (viewBoxUpdated) {
            setViewBox(attachProps.svg, aplVBBBox);
          }
        })();

        traceLog.add('</ATTACHMENTS.areaAnchor.update>'); // [DEBUG/]
        // Returns `true`, when stats anchors use are updated.
        return updated.strokeWidth || updated.pathListRel || updated.bBoxRel;
      }
    },

    mouseHoverAnchor: {
      type: 'anchor',
      argOptions: [
        { optionName: 'element', type: isElement },
        { optionName: 'showEffectName', type: 'string' }
      ],

      style: {
        backgroundImage:
          "url('data:image/svg+xml;charset=utf-8;base64,PHN2ZyB2ZXJzaW9uPSIxLjEiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyIgd2lkdGg9IjI0IiBoZWlnaHQ9IjI0Ij48cG9seWdvbiBwb2ludHM9IjI0LDAgMCw4IDgsMTEgMCwxOSA1LDI0IDEzLDE2IDE2LDI0IiBmaWxsPSJjb3JhbCIvPjwvc3ZnPg==')",
        backgroundSize: '', // It's set in init().
        backgroundRepeat: 'no-repeat',
        backgroundColor: '#f8f881',
        cursor: 'default'
      },
      hoverStyle: {
        backgroundImage: 'none',
        backgroundColor: '#fadf8f'
      },
      padding: { top: 1, right: 15 /* >(backgroundSize.width + backgroundPosition.right) */, bottom: 1, left: 2 },
      minHeight: 15,
      backgroundPosition: { right: 2, top: 2 },
      backgroundSize: { width: 12, height: 12 },

      dirKeys: [
        ['top', 'Top'],
        ['right', 'Right'],
        ['bottom', 'Bottom'],
        ['left', 'Left']
      ],

      // attachOptions: element, style, hoverStyle, showEffectName, animOptions, onSwitch
      init(attachProps, attachOptions) {
        traceLog.add('<ATTACHMENTS.mouseHoverAnchor.init>'); // [DEBUG/]
        const conf = ATTACHMENTS.mouseHoverAnchor;
        let curStyle;
        let elmStyle;
        let bBox;
        let displaySave;
        const paddingSave = {};
        let showEffectName;
        let animOptions;
        let onSwitch;
        attachProps.element = ATTACHMENTS.pointAnchor.checkElement(attachOptions.element);
        // Check HTML element
        if (
          !((element) => {
            let win, doc;
            return !!(
              (doc = element.ownerDocument) &&
              (win = doc.defaultView) &&
              win.HTMLElement &&
              element instanceof win.HTMLElement
            );
          })(attachProps.element)
        ) {
          throw new Error('`element` must be HTML element');
        }

        conf.style.backgroundSize = conf.backgroundSize.width + 'px ' + conf.backgroundSize.height + 'px';

        // copy default
        ['style', 'hoverStyle'].forEach((key) => {
          const defaultStyle = conf[key];
          attachProps[key] = Object.keys(defaultStyle).reduce((copyObj, propName) => {
            copyObj[propName] = defaultStyle[propName];
            return copyObj;
          }, {});
        });

        curStyle = attachProps.element.ownerDocument.defaultView.getComputedStyle(attachProps.element, '');
        // display
        if (curStyle.display === 'inline') {
          attachProps.style.display = 'inline-block';
        } else if (curStyle.display === 'none') {
          attachProps.style.display = 'block'; // Can't get default `display` when it is `none`.
        }
        // padding (simulate min-padding)
        ATTACHMENTS.mouseHoverAnchor.dirKeys.forEach((key) => {
          const confKey = key[0],
            styleKey = 'padding' + key[1];
          if (parseFloat(curStyle[styleKey]) < conf.padding[confKey]) {
            attachProps.style[styleKey] = conf.padding[confKey] + 'px';
          }
        });

        // Make box layout temporarily to get size before binding.
        if (attachProps.style.display) {
          displaySave = attachProps.element.style.display;
          attachProps.element.style.display = attachProps.style.display;
        }
        ATTACHMENTS.mouseHoverAnchor.dirKeys.forEach((key) => {
          const styleKey = 'padding' + key[1];
          if (attachProps.style[styleKey]) {
            paddingSave[styleKey] = attachProps.element.style[styleKey];
            attachProps.element.style[styleKey] = attachProps.style[styleKey];
          }
        });
        bBox = attachProps.element.getBoundingClientRect();

        // height (simulate min-height with current style (particularly box-sizing))
        if (bBox.height < conf.minHeight) {
          attachProps.style.height = parseFloat(curStyle.height) + (conf.minHeight - bBox.height) + 'px';
        }

        if (IS_WEBKIT) {
          // [WEBKIT] rel-position is not supported
          attachProps.style.backgroundPosition =
            // bBox.width should be larger than (backgroundSize.width + backgroundPosition.right) by padding.
            bBox.width -
            conf.backgroundSize.width -
            conf.backgroundPosition.right +
            'px ' +
            conf.backgroundPosition.top +
            'px';
        } else {
          attachProps.style.backgroundPosition =
            'right ' + conf.backgroundPosition.right + 'px top ' + conf.backgroundPosition.top + 'px';
        }

        // Restore
        if (attachProps.style.display) {
          attachProps.element.style.display = displaySave;
        }
        ATTACHMENTS.mouseHoverAnchor.dirKeys.forEach((key) => {
          const styleKey = 'padding' + key[1];
          if (attachProps.style[styleKey]) {
            attachProps.element.style[styleKey] = paddingSave[styleKey];
          }
        });

        // merge
        ['style', 'hoverStyle'].forEach((key) => {
          const propStyle = attachProps[key],
            optionStyle = attachOptions[key];
          if (isObject(optionStyle)) {
            Object.keys(optionStyle).forEach((propName) => {
              if (typeof optionStyle[propName] === 'string' || isFinite(optionStyle[propName])) {
                propStyle[propName] = optionStyle[propName];
              } else if (optionStyle[propName] == null) {
                delete propStyle[propName];
              }
            });
          }
        });

        if (typeof attachOptions.onSwitch === 'function') {
          onSwitch = attachOptions.onSwitch;
        }

        if (attachOptions.showEffectName && SHOW_EFFECTS[attachOptions.showEffectName]) {
          attachProps.showEffectName = showEffectName = attachOptions.showEffectName;
        }
        animOptions = attachOptions.animOptions;
        attachProps.elmStyle = elmStyle = attachProps.element.style;

        // event handler for this instance
        attachProps.mouseenter = (event) => {
          traceLog.add('<ATTACHMENTS.mouseHoverAnchor.mouseenter>'); // [DEBUG/]
          attachProps.hoverStyleSave = conf.getStyles(elmStyle, Object.keys(attachProps.hoverStyle));
          conf.setStyles(elmStyle, attachProps.hoverStyle);
          attachProps.boundTargets.forEach((boundTarget) => {
            show(boundTarget.props, true, showEffectName, animOptions);
          });
          if (onSwitch) {
            onSwitch(event);
          }
          traceLog.add('</ATTACHMENTS.mouseHoverAnchor.mouseenter>'); // [DEBUG/]
        };

        attachProps.mouseleave = (event) => {
          traceLog.add('<ATTACHMENTS.mouseHoverAnchor.mouseleave>'); // [DEBUG/]
          conf.setStyles(elmStyle, attachProps.hoverStyleSave);
          attachProps.boundTargets.forEach((boundTarget) => {
            show(boundTarget.props, false, showEffectName, animOptions);
          });
          if (onSwitch) {
            onSwitch(event);
          }
          traceLog.add('</ATTACHMENTS.mouseHoverAnchor.mouseleave>'); // [DEBUG/]
        };

        traceLog.add('</ATTACHMENTS.mouseHoverAnchor.init>'); // [DEBUG/]
        return true;
      },

      bind(attachProps, bindTarget) {
        traceLog.add('<ATTACHMENTS.mouseHoverAnchor.bind>'); // [DEBUG/]
        if (bindTarget.props.svg) {
          ATTACHMENTS.mouseHoverAnchor.llShow(bindTarget.props, false, attachProps.showEffectName);
        } else {
          // SVG is not setup yet.
          addDelayedProc(() => {
            ATTACHMENTS.mouseHoverAnchor.llShow(bindTarget.props, false, attachProps.showEffectName);
          });
        }
        if (!attachProps.enabled) {
          attachProps.styleSave = ATTACHMENTS.mouseHoverAnchor.getStyles(
            attachProps.elmStyle,
            Object.keys(attachProps.style)
          );
          ATTACHMENTS.mouseHoverAnchor.setStyles(attachProps.elmStyle, attachProps.style);
          attachProps.removeEventListener = mouseEnterLeave(
            attachProps.element,
            attachProps.mouseenter,
            attachProps.mouseleave
          );
          attachProps.enabled = true;
        }
        traceLog.add('</ATTACHMENTS.mouseHoverAnchor.bind>'); // [DEBUG/]
        return true;
      },

      unbind(attachProps, boundTarget) {
        traceLog.add('<ATTACHMENTS.mouseHoverAnchor.unbind>'); // [DEBUG/]
        if (attachProps.enabled && attachProps.boundTargets.length <= 1) {
          // last one that is unbound
          attachProps.removeEventListener();
          ATTACHMENTS.mouseHoverAnchor.setStyles(attachProps.elmStyle, attachProps.styleSave);
          attachProps.enabled = false;
        }
        ATTACHMENTS.mouseHoverAnchor.llShow(boundTarget.props, true, attachProps.showEffectName);
        traceLog.add('</ATTACHMENTS.mouseHoverAnchor.unbind>'); // [DEBUG/]
      },

      removeOption(attachProps, boundTarget) {
        ATTACHMENTS.pointAnchor.removeOption(attachProps, boundTarget);
      },

      remove(attachProps) {
        traceLog.add('<ATTACHMENTS.mouseHoverAnchor.remove>'); // [DEBUG/]
        if (attachProps.boundTargets.length) {
          // it should be unbound by LeaderLineAttachment.remove
          traceLog.add('error-not-unbound'); // [DEBUG/]
          console.error('LeaderLineAttachment was not unbound by remove');
          attachProps.boundTargets.forEach((boundTarget) => {
            ATTACHMENTS.mouseHoverAnchor.unbind(attachProps, boundTarget);
          });
        }
        traceLog.add('</ATTACHMENTS.mouseHoverAnchor.remove>'); // [DEBUG/]
      },

      getBBoxNest(attachProps, props) {
        return getBBoxNest(attachProps.element, props.baseWindow);
      },

      // show/hide immediately
      llShow(props, on, showEffectName) {
        SHOW_EFFECTS[showEffectName || props.curStats.show_effect].stop(props, true, on);
        props.aplStats.show_on = on; // It is not updated by svgShow(). (It is used in show().)
      },

      getStyles(elmStyle, propNames) {
        return propNames.reduce((copyObj, propName) => {
          copyObj[propName] = elmStyle[propName];
          return copyObj;
        }, {});
      },

      setStyles(elmStyle, styles) {
        Object.keys(styles).forEach((propName) => {
          elmStyle[propName] = styles[propName];
        });
      }
    },

    captionLabel: {
      type: 'label',
      argOptions: [{ optionName: 'text', type: 'string' }],
      stats: { color: {}, x: {}, y: {} },
      textStyleProps: [
        'fontFamily',
        'fontStyle',
        'fontVariant',
        'fontWeight',
        'fontStretch',
        'fontSize',
        'fontSizeAdjust',
        'kerning',
        'letterSpacing',
        'wordSpacing',
        'textDecoration'
      ],

      // attachOptions: text, color(A), outlineColor, offset(A), lineOffset, <textStyleProps>
      init(attachProps, attachOptions) {
        traceLog.add('<ATTACHMENTS.captionLabel.init>'); // [DEBUG/]
        if (typeof attachOptions.text === 'string') {
          attachProps.text = attachOptions.text.trim();
        }
        if (!attachProps.text) {
          traceLog.add('</ATTACHMENTS.captionLabel.init>'); // [DEBUG/]
          return false;
        }
        if (typeof attachOptions.color === 'string') {
          attachProps.color = attachOptions.color.trim();
        }
        attachProps.outlineColor =
          typeof attachOptions.outlineColor === 'string' ? attachOptions.outlineColor.trim() : '#fff'; // default
        if (
          Array.isArray(attachOptions.offset) &&
          isFinite(attachOptions.offset[0]) &&
          isFinite(attachOptions.offset[1])
        ) {
          attachProps.offset = { x: attachOptions.offset[0], y: attachOptions.offset[1] };
        }
        if (isFinite(attachOptions.lineOffset)) {
          attachProps.lineOffset = attachOptions.lineOffset;
        }
        ATTACHMENTS.captionLabel.textStyleProps.forEach((propName) => {
          if (attachOptions[propName] != null) {
            attachProps[propName] = attachOptions[propName];
          }
        });

        // event handler for this instance
        attachProps.updateColor = (props) => {
          traceLog.add('<ATTACHMENTS.captionLabel.updateColor>'); // [DEBUG/]
          ATTACHMENTS.captionLabel.updateColor(attachProps, props);
          traceLog.add('</ATTACHMENTS.captionLabel.updateColor>'); // [DEBUG/]
        };

        attachProps.updateSocketXY = (props) => {
          traceLog.add('<ATTACHMENTS.captionLabel.updateSocketXY>'); // [DEBUG/]
          const curStats = attachProps.curStats;
          const aplStats = attachProps.aplStats;
          const llStats = props.curStats;
          const socketXY = llStats.position_socketXYSE[attachProps.socketIndex];
          let margin;
          let plugSideLen;
          let anotherSocketXY;
          let value;
          // It's not ready yet.
          if (socketXY.x == null) {
            traceLog.add('not-ready'); // [DEBUG/]
            traceLog.add('</ATTACHMENTS.captionLabel.updateSocketXY>'); // [DEBUG/]
            return;
          }

          if (attachProps.offset) {
            curStats.x = socketXY.x + attachProps.offset.x;
            curStats.y = socketXY.y + attachProps.offset.y;
          } else {
            margin = attachProps.height / 2; // Half of line height
            plugSideLen = Math.max(
              llStats.attach_plugSideLenSE[attachProps.socketIndex] || 0,
              llStats.line_strokeWidth / 2
            );
            anotherSocketXY = llStats.position_socketXYSE[attachProps.socketIndex ? 0 : 1];
            if (socketXY.socketId === SOCKET_LEFT || socketXY.socketId === SOCKET_RIGHT) {
              curStats.x =
                socketXY.socketId === SOCKET_LEFT ? socketXY.x - margin - attachProps.width : socketXY.x + margin;
              curStats.y =
                anotherSocketXY.y < socketXY.y
                  ? socketXY.y + plugSideLen + margin
                  : socketXY.y - plugSideLen - margin - attachProps.height;
            } else {
              curStats.x =
                anotherSocketXY.x < socketXY.x
                  ? socketXY.x + plugSideLen + margin
                  : socketXY.x - plugSideLen - margin - attachProps.width;
              curStats.y =
                socketXY.socketId === SOCKET_TOP ? socketXY.y - margin - attachProps.height : socketXY.y + margin;
            }
          }

          if (setStat(attachProps, aplStats, 'x', (value = curStats.x), /* [DEBUG] */ null, 'x%_' /* [/DEBUG] */)) {
            attachProps.elmPosition.x.baseVal.getItem(0).value = value;
          }
          if (setStat(attachProps, aplStats, 'y', (value = curStats.y), /* [DEBUG] */ null, 'y%_' /* [/DEBUG] */)) {
            attachProps.elmPosition.y.baseVal.getItem(0).value = value + attachProps.height;
          }
          traceLog.add('</ATTACHMENTS.captionLabel.updateSocketXY>'); // [DEBUG/]
        };

        attachProps.updatePath = (props) => {
          traceLog.add('<ATTACHMENTS.captionLabel.updatePath>'); // [DEBUG/]
          const curStats = attachProps.curStats;
          const aplStats = attachProps.aplStats;
          const pathList = props.pathList.animVal || props.pathList.baseVal;
          let point;
          let value;
          // It's not ready yet.
          if (!pathList) {
            traceLog.add('not-ready'); // [DEBUG/]
            traceLog.add('</ATTACHMENTS.captionLabel.updatePath>'); // [DEBUG/]
            return;
          }

          point = ATTACHMENTS.captionLabel.getMidPoint(pathList, attachProps.lineOffset);
          curStats.x = point.x - attachProps.width / 2;
          curStats.y = point.y - attachProps.height / 2;

          if (setStat(attachProps, aplStats, 'x', (value = curStats.x))) {
            attachProps.elmPosition.x.baseVal.getItem(0).value = value;
          }
          if (setStat(attachProps, aplStats, 'y', (value = curStats.y))) {
            attachProps.elmPosition.y.baseVal.getItem(0).value = value + attachProps.height;
          }
          traceLog.add('</ATTACHMENTS.captionLabel.updatePath>'); // [DEBUG/]
        };

        attachProps.updateShow = (props) => {
          traceLog.add('<ATTACHMENTS.captionLabel.updateShow>'); // [DEBUG/]
          ATTACHMENTS.captionLabel.updateShow(attachProps, props);
          traceLog.add('</ATTACHMENTS.captionLabel.updateShow>'); // [DEBUG/]
        };

        if (IS_WEBKIT) {
          // [WEBKIT] overflow:visible is ignored
          attachProps.adjustEdge = (props, edge) => {
            traceLog.add('<ATTACHMENTS.captionLabel.adjustEdge>'); // [DEBUG/]
            const curStats = attachProps.curStats;
            if (curStats.x != null) {
              ATTACHMENTS.captionLabel.adjustEdge(
                edge,
                { x: curStats.x, y: curStats.y, width: attachProps.width, height: attachProps.height },
                attachProps.strokeWidth / 2
              );
            }
            traceLog.add('</ATTACHMENTS.captionLabel.adjustEdge>'); // [DEBUG/]
          };
        }

        traceLog.add('</ATTACHMENTS.captionLabel.init>'); // [DEBUG/]
        return true;
      },

      updateColor(attachProps, props) {
        const curStats = attachProps.curStats;
        const aplStats = attachProps.aplStats;
        const llStats = props.curStats;
        let value;

        curStats.color = value = attachProps.color || llStats.line_color;
        if (setStat(attachProps, aplStats, 'color', value)) {
          attachProps.styleFill.fill = value;
        }
      },

      updateShow(attachProps, props) {
        const on = props.isShown === true;
        if (on !== attachProps.isShown) {
          traceLog.add('on=' + on); // [DEBUG/]
          attachProps.styleShow.visibility = on ? '' : 'hidden';
          attachProps.isShown = on;
        }
      },

      adjustEdge(edge, bBox, margin) {
        const textEdge = {
          x1: bBox.x - margin,
          y1: bBox.y - margin,
          x2: bBox.x + bBox.width + margin,
          y2: bBox.y + bBox.height + margin
        };
        if (textEdge.x1 < edge.x1) {
          edge.x1 = textEdge.x1;
        }
        if (textEdge.y1 < edge.y1) {
          edge.y1 = textEdge.y1;
        }
        if (textEdge.x2 > edge.x2) {
          edge.x2 = textEdge.x2;
        }
        if (textEdge.y2 > edge.y2) {
          edge.y2 = textEdge.y2;
        }
      },

      /**
       * @param {string} text - Content of `<text>` element.
       * @param {Document} document - Document that contains `<svg>`.
       * @param {SVGSVGElement} svg - Parent `<svg>` element.
       * @param {string} id - ID for `href`.
       * @param {boolean} [stroke] - Setup for `stroke`.
       * @returns {Object} {elmPosition, styleText, styleFill, styleStroke, styleShow, elmsAppend}
       */
      newText(text, document, svg, id, stroke) {
        let elmText, elmG, elmDefs, elmUseFill, elmUseStroke, style;

        elmText = document.createElementNS(SVG_NS, 'text');
        elmText.textContent = text;
        [elmText.x, elmText.y].forEach((list) => {
          const len = svg.createSVGLength();
          len.newValueSpecifiedUnits(SVGLength.SVG_LENGTHTYPE_PX, 0);
          list.baseVal.initialize(len);
        });

        if (typeof svg2SupportedPaintOrder !== 'boolean') {
          svg2SupportedPaintOrder = 'paintOrder' in elmText.style;
        }
        if (stroke && !svg2SupportedPaintOrder) {
          elmDefs = document.createElementNS(SVG_NS, 'defs');
          elmText.id = id;
          elmDefs.appendChild(elmText);
          elmG = document.createElementNS(SVG_NS, 'g');
          elmUseStroke = elmG.appendChild(document.createElementNS(SVG_NS, 'use'));
          elmUseStroke.href.baseVal = '#' + id;
          elmUseFill = elmG.appendChild(document.createElementNS(SVG_NS, 'use'));
          elmUseFill.href.baseVal = '#' + id;
          style = elmUseStroke.style;
          style.strokeLinejoin = 'round';
          return {
            elmPosition: elmText,
            styleText: elmText.style,
            styleFill: elmUseFill.style,
            styleStroke: style,
            styleShow: elmG.style,
            elmsAppend: [elmDefs, elmG]
          };
        } else {
          style = elmText.style;
          if (stroke) {
            style.strokeLinejoin = 'round';
            style.paintOrder = 'stroke';
          }
          return {
            elmPosition: elmText,
            styleText: style,
            styleFill: style,
            styleStroke: stroke ? style : null,
            styleShow: style,
            elmsAppend: [elmText]
          };
        }
      },

      getMidPoint(pathList, offset) {
        const allPathLen = getAllPathListLen(pathList);
        const pathSegsLen = allPathLen.segsLen;
        const pathLenAll = allPathLen.lenAll;
        let pointLen;
        let points;
        let i = -1;
        let newPathList;

        pointLen = pathLenAll / 2 + (offset || 0);
        if (pointLen <= 0) {
          points = pathList[0];
          return points.length === 2
            ? getPointOnLine(points[0], points[1], 0)
            : getPointOnCubic(points[0], points[1], points[2], points[3], 0);
        } else if (pointLen >= pathLenAll) {
          points = pathList.at(-1);
          return points.length === 2
            ? getPointOnLine(points[0], points[1], 1)
            : getPointOnCubic(points[0], points[1], points[2], points[3], 1);
        } else {
          newPathList = [];
          while (pointLen > pathSegsLen[++i]) {
            newPathList.push(pathList[i]);
            pointLen -= pathSegsLen[i];
          }
          points = pathList[i];
          return points.length === 2
            ? getPointOnLine(points[0], points[1], pointLen / pathSegsLen[i])
            : getPointOnCubic(
                points[0],
                points[1],
                points[2],
                points[3],
                getCubicT(points[0], points[1], points[2], points[3], pointLen)
              );
        }
      },

      initSvg(attachProps, props) {
        traceLog.add('<ATTACHMENTS.captionLabel.initSvg>'); // [DEBUG/]

        const text = ATTACHMENTS.captionLabel.newText(
          attachProps.text,
          props.baseWindow.document,
          props.svg,
          APP_ID + '-captionLabel-' + attachProps._id,
          attachProps.outlineColor
        );

        let bBox;
        let strokeWidth;

        ['elmPosition', 'styleFill', 'styleShow', 'elmsAppend'].forEach((key) => {
          attachProps[key] = text[key];
        });

        attachProps.isShown = false;
        attachProps.styleShow.visibility = 'hidden';
        ATTACHMENTS.captionLabel.textStyleProps.forEach((propName) => {
          if (attachProps[propName] != null) {
            text.styleText[propName] = attachProps[propName];
          }
        });

        text.elmsAppend.forEach((elm) => {
          props.svg.appendChild(elm);
        });
        bBox = text.elmPosition.getBBox();
        attachProps.width = bBox.width;
        attachProps.height = bBox.height;
        if (attachProps.outlineColor) {
          strokeWidth = bBox.height / 9;
          strokeWidth = strokeWidth > 10 ? 10 : strokeWidth < 2 ? 2 : strokeWidth;
          text.styleStroke.strokeWidth = strokeWidth + 'px';
          text.styleStroke.stroke = attachProps.outlineColor;
        }
        attachProps.strokeWidth = strokeWidth || 0;

        initStats(attachProps.aplStats, ATTACHMENTS.captionLabel.stats); // for bindWindow again
        attachProps.updateColor(props);
        if (attachProps.refSocketXY) {
          attachProps.updateSocketXY(props);
        } else {
          attachProps.updatePath(props);
        }
        if (IS_WEBKIT) {
          update(props, {});
        } // [WEBKIT] overflow:visible is ignored (To call updateViewBox())
        attachProps.updateShow(props);
        traceLog.add('</ATTACHMENTS.captionLabel.initSvg>'); // [DEBUG/]
      },

      bind(attachProps, bindTarget) {
        traceLog.add('<ATTACHMENTS.captionLabel.bind>'); // [DEBUG/]
        traceLog.add('optionName=%s', bindTarget.optionName); // [DEBUG/]
        const props = bindTarget.props;

        if (!attachProps.color) {
          addEventHandler(props, 'cur_line_color', attachProps.updateColor);
        }
        if (
          (attachProps.refSocketXY = bindTarget.optionName === 'startLabel' || bindTarget.optionName === 'endLabel')
        ) {
          attachProps.socketIndex = bindTarget.optionName === 'startLabel' ? 0 : 1;
          addEventHandler(props, 'apl_position', attachProps.updateSocketXY);
          if (!attachProps.offset) {
            addEventHandler(props, 'cur_attach_plugSideLenSE', attachProps.updateSocketXY);
            addEventHandler(props, 'cur_line_strokeWidth', attachProps.updateSocketXY);
          }
        } else {
          addEventHandler(props, 'apl_path', attachProps.updatePath);
        }
        addEventHandler(props, 'svgShow', attachProps.updateShow);
        // [WEBKIT] overflow:visible is ignored
        if (IS_WEBKIT) {
          addEventHandler(props, 'new_edge4viewBox', attachProps.adjustEdge);
        }

        // after set attachProps.refSocketXY
        ATTACHMENTS.captionLabel.initSvg(attachProps, props);

        traceLog.add('</ATTACHMENTS.captionLabel.bind>'); // [DEBUG/]
        return true;
      },

      unbind(attachProps, boundTarget) {
        traceLog.add('<ATTACHMENTS.captionLabel.unbind>'); // [DEBUG/]
        const props = boundTarget.props;

        if (attachProps.elmsAppend) {
          attachProps.elmsAppend.forEach((elm) => {
            props.svg.removeChild(elm);
          });
          attachProps.elmPosition = attachProps.styleFill = attachProps.styleShow = attachProps.elmsAppend = null;
        }
        initStats(attachProps.curStats, ATTACHMENTS.captionLabel.stats);
        initStats(attachProps.aplStats, ATTACHMENTS.captionLabel.stats);

        if (!attachProps.color) {
          removeEventHandler(props, 'cur_line_color', attachProps.updateColor);
        }
        if (attachProps.refSocketXY) {
          removeEventHandler(props, 'apl_position', attachProps.updateSocketXY);
          if (!attachProps.offset) {
            removeEventHandler(props, 'cur_attach_plugSideLenSE', attachProps.updateSocketXY);
            removeEventHandler(props, 'cur_line_strokeWidth', attachProps.updateSocketXY);
          }
        } else {
          removeEventHandler(props, 'apl_path', attachProps.updatePath);
        }
        removeEventHandler(props, 'svgShow', attachProps.updateShow);
        if (IS_WEBKIT) {
          // [WEBKIT] overflow:visible is ignored
          removeEventHandler(props, 'new_edge4viewBox', attachProps.adjustEdge);
          // addDelayedProc(function() { update(props, {}); }); // reset path_edge
          update(props, {}); // To call updateViewBox()
        }
        traceLog.add('</ATTACHMENTS.captionLabel.unbind>'); // [DEBUG/]
      },

      removeOption(attachProps, boundTarget) {
        traceLog.add('<ATTACHMENTS.captionLabel.removeOption>'); // [DEBUG/]
        traceLog.add('optionName=%s', boundTarget.optionName); // [DEBUG/]
        const props = boundTarget.props,
          newOptions = {};
        newOptions[boundTarget.optionName] = '';
        setOptions(props, newOptions);
        traceLog.add('</ATTACHMENTS.captionLabel.removeOption>'); // [DEBUG/]
      },

      remove(attachProps) {
        traceLog.add('<ATTACHMENTS.captionLabel.remove>'); // [DEBUG/]
        if (attachProps.boundTargets.length) {
          // it should be unbound by LeaderLineAttachment.remove
          traceLog.add('error-not-unbound'); // [DEBUG/]
          console.error('LeaderLineAttachment was not unbound by remove');
          attachProps.boundTargets.forEach((boundTarget) => {
            ATTACHMENTS.captionLabel.unbind(attachProps, boundTarget);
          });
        }
        traceLog.add('</ATTACHMENTS.captionLabel.remove>'); // [DEBUG/]
      }
    },

    pathLabel: {
      type: 'label',
      argOptions: [{ optionName: 'text', type: 'string' }],
      stats: { color: {}, startOffset: {}, pathData: {} },

      // attachOptions: text, color(A), outlineColor, lineOffset, <textStyleProps>
      init(attachProps, attachOptions) {
        traceLog.add('<ATTACHMENTS.pathLabel.init>'); // [DEBUG/]
        if (typeof attachOptions.text === 'string') {
          attachProps.text = attachOptions.text.trim();
        }
        if (!attachProps.text) {
          traceLog.add('</ATTACHMENTS.pathLabel.init>'); // [DEBUG/]
          return false;
        }
        if (typeof attachOptions.color === 'string') {
          attachProps.color = attachOptions.color.trim();
        }
        attachProps.outlineColor =
          typeof attachOptions.outlineColor === 'string' ? attachOptions.outlineColor.trim() : '#fff'; // default
        if (isFinite(attachOptions.lineOffset)) {
          attachProps.lineOffset = attachOptions.lineOffset;
        }
        ATTACHMENTS.captionLabel.textStyleProps.forEach((propName) => {
          if (attachOptions[propName] != null) {
            attachProps[propName] = attachOptions[propName];
          }
        });

        // event handler for this instance
        attachProps.updateColor = (props) => {
          traceLog.add('<ATTACHMENTS.pathLabel.updateColor>'); // [DEBUG/]
          ATTACHMENTS.captionLabel.updateColor(attachProps, props);
          traceLog.add('</ATTACHMENTS.pathLabel.updateColor>'); // [DEBUG/]
        };

        attachProps.updatePath = (props) => {
          traceLog.add('<ATTACHMENTS.pathLabel.updatePath>'); // [DEBUG/]
          const curStats = attachProps.curStats;
          const aplStats = attachProps.aplStats;
          const llStats = props.curStats;
          const pathList = props.pathList.animVal || props.pathList.baseVal;
          let value;
          // It's not ready yet.
          if (!pathList) {
            traceLog.add('not-ready'); // [DEBUG/]
            traceLog.add('</ATTACHMENTS.pathLabel.updatePath>'); // [DEBUG/]
            return;
          }

          curStats.pathData = value = ATTACHMENTS.pathLabel.getOffsetPathData(
            pathList,
            // margin between line and base-line: attachProps.height / 4
            // llStats.line_strokeWidth / 2 + attachProps.strokeWidth / 2 + attachProps.height / 2,
            llStats.line_strokeWidth / 2 + attachProps.strokeWidth / 2 + attachProps.height / 4,
            // margin between corner and text: attachProps.height * 1.25
            attachProps.height * 1.25
          );

          // Apply `pathData`
          if (pathDataHasChanged(value, aplStats.pathData)) {
            traceLog.add('pathData'); // [DEBUG/]
            attachProps.elmPath.setPathData(value);
            aplStats.pathData = value;
            attachProps.bBox = attachProps.elmPosition.getBBox(); // for adjustEdge
            attachProps.updateStartOffset(props);
          }
          traceLog.add('</ATTACHMENTS.pathLabel.updatePath>'); // [DEBUG/]
        };

        attachProps.updateStartOffset = (props) => {
          traceLog.add('<ATTACHMENTS.pathLabel.updateStartOffset>'); // [DEBUG/]
          const curStats = attachProps.curStats;
          const aplStats = attachProps.aplStats;
          const llStats = props.curStats;
          let pathLenAll;
          let plugBackLen;
          let startOffset;
          // It's not ready yet.
          if (!curStats.pathData) {
            traceLog.add('not-ready'); // [DEBUG/]
            traceLog.add('</ATTACHMENTS.pathLabel.updateStartOffset>'); // [DEBUG/]
            return;
          }
          if (attachProps.semIndex === 2 && !attachProps.lineOffset) {
            traceLog.add('static'); // [DEBUG/]
            traceLog.add('</ATTACHMENTS.pathLabel.updateStartOffset>'); // [DEBUG/]
            return;
          }

          pathLenAll = getAllPathDataLen(curStats.pathData);
          startOffset = attachProps.semIndex === 0 ? 0 : attachProps.semIndex === 1 ? pathLenAll : pathLenAll / 2;
          if (attachProps.semIndex !== 2) {
            plugBackLen =
              Math.max(llStats.attach_plugBackLenSE[attachProps.semIndex] || 0, llStats.line_strokeWidth / 2) +
              // margin between plug and text: attachProps.height / 4
              attachProps.strokeWidth / 2 +
              attachProps.height / 4;
            startOffset += attachProps.semIndex === 0 ? plugBackLen : -plugBackLen;
            startOffset = startOffset < 0 ? 0 : startOffset > pathLenAll ? pathLenAll : startOffset;
          }
          if (attachProps.lineOffset) {
            startOffset += attachProps.lineOffset;
            startOffset = startOffset < 0 ? 0 : startOffset > pathLenAll ? pathLenAll : startOffset;
          }

          curStats.startOffset = startOffset;
          if (
            setStat(
              attachProps,
              aplStats,
              'startOffset',
              startOffset,
              /* [DEBUG] */ null,
              'startOffset%_' /* [/DEBUG] */
            )
          ) {
            attachProps.elmOffset.startOffset.baseVal.value = startOffset;
          }
          traceLog.add('</ATTACHMENTS.pathLabel.updateStartOffset>'); // [DEBUG/]
        };

        attachProps.updateShow = (props) => {
          traceLog.add('<ATTACHMENTS.pathLabel.updateShow>'); // [DEBUG/]
          ATTACHMENTS.captionLabel.updateShow(attachProps, props);
          traceLog.add('</ATTACHMENTS.pathLabel.updateShow>'); // [DEBUG/]
        };

        if (IS_WEBKIT) {
          // [WEBKIT] overflow:visible is ignored
          attachProps.adjustEdge = (props, edge) => {
            traceLog.add('<ATTACHMENTS.pathLabel.adjustEdge>'); // [DEBUG/]
            if (attachProps.bBox) {
              ATTACHMENTS.captionLabel.adjustEdge(edge, attachProps.bBox, attachProps.strokeWidth / 2);
            }
            traceLog.add('</ATTACHMENTS.pathLabel.adjustEdge>'); // [DEBUG/]
          };
        }

        traceLog.add('</ATTACHMENTS.pathLabel.init>'); // [DEBUG/]
        return true;
      },

      getOffsetPathData(pathList, offsetLen, cornerMargin) {
        const STEP_LEN = 16;
        const TOLERANCE = 3;
        const parts = [];
        let lastLineSeg;
        let curPoint;

        function nearPoints(a, b) {
          return Math.abs(a.x - b.x) < TOLERANCE && Math.abs(a.y - b.y) < TOLERANCE;
        }

        pathList.forEach((points) => {
          let offsetPoints, lineSeg, lastPoints, angle, exPoint, exPointLast, intPoint;
          if (points.length === 2) {
            offsetPoints = getOffsetLine(points[0], points[1], offsetLen);

            if (lastLineSeg) {
              // continued line
              lastPoints = lastLineSeg.points;
              angle =
                Math.atan2(lastPoints[1].y - lastPoints[0].y, lastPoints[0].x - lastPoints[1].x) -
                Math.atan2(points[0].y - points[1].y, points[1].x - points[0].x);
              if (angle >= 0 && angle <= Math.PI) {
                // Inside
                lineSeg = { type: 'line', points: offsetPoints, inside: true };
              } else {
                // Try to join the outer points of corner.
                exPointLast = extendLine(lastPoints[0], lastPoints[1], offsetLen);
                exPoint = extendLine(offsetPoints[1], offsetPoints[0], offsetLen); // reverse
                if ((intPoint = getIntersection(lastPoints[0], exPointLast, exPoint, offsetPoints[1]))) {
                  // Join the intersecting lines that were extended.
                  lastPoints[1] = intPoint;
                  lineSeg = { type: 'line', points: [intPoint, offsetPoints[1]] };
                } else {
                  lastPoints[1] = nearPoints(exPoint, exPointLast) ? exPoint : exPointLast;
                  lineSeg = { type: 'line', points: [exPoint, offsetPoints[1]] };
                }
                lastLineSeg.len = getPointsLength(lastPoints[0], lastPoints[1]);
              }
            } else {
              // new line
              lineSeg = { type: 'line', points: offsetPoints };
            }
            lineSeg.len = getPointsLength(lineSeg.points[0], lineSeg.points[1]);
            parts.push((lastLineSeg = lineSeg));
          } else {
            parts.push({
              type: 'cubic',
              points: getOffsetCubic(points[0], points[1], points[2], points[3], offsetLen, STEP_LEN)
            });
            lastLineSeg = null;
          }
        });

        // Adjust the inner points of corner. (after adjusting outer points)
        lastLineSeg = null;
        parts.forEach((part) => {
          let points;
          if (part.type === 'line') {
            if (part.inside) {
              // lastLineSeg should exist
              // subtract offsetLen from prev-line
              if (lastLineSeg.len > offsetLen) {
                points = lastLineSeg.points;
                points[1] = extendLine(points[0], points[1], -offsetLen);
                lastLineSeg.len = getPointsLength(points[0], points[1]);
              } else {
                // disable line
                lastLineSeg.points = null;
                lastLineSeg.len = 0;
              }
              // subtract (offsetLen + cornerMargin) from cur-line
              if (part.len > offsetLen + cornerMargin) {
                points = part.points;
                points[0] = extendLine(points[1], points[0], -(offsetLen + cornerMargin));
                part.len = getPointsLength(points[0], points[1]);
              } else {
                // disable line
                part.points = null;
                part.len = 0;
              }
            }
            lastLineSeg = part;
          } else {
            lastLineSeg = null;
          }
        });

        return parts.reduce((pathData, pathSeg) => {
          const points = pathSeg.points;
          if (points) {
            if (!curPoint || !nearPoints(points[0], curPoint)) {
              pathData.push({ type: 'M', values: [points[0].x, points[0].y] });
            }
            if (pathSeg.type === 'line') {
              pathData.push({ type: 'L', values: [points[1].x, points[1].y] });
            } else {
              // cubic
              points.shift();
              points.forEach((point) => {
                pathData.push({ type: 'L', values: [point.x, point.y] });
              });
            }
            curPoint = points.at(-1);
          }
          return pathData;
        }, []);
      },

      /**
       * @param {string} text - Content of `<text>` element.
       * @param {Document} document - Document that contains `<svg>`.
       * @param {string} id - ID for `href`.
       * @param {boolean} [stroke] - Setup for `stroke`.
       * @returns {Object} {elmPosition, elmPath, elmOffset,
       *    styleText, styleFill, styleStroke, styleShow, elmsAppend}
       */
      newText(text, document, id, stroke) {
        let pathId, textId, elmDefs, elmPath, elmText, elmTextPath, elmG, elmUseFill, elmUseStroke, style;

        elmDefs = document.createElementNS(SVG_NS, 'defs');
        elmPath = elmDefs.appendChild(document.createElementNS(SVG_NS, 'path'));
        elmPath.id = pathId = id + '-path';

        elmText = document.createElementNS(SVG_NS, 'text');
        elmTextPath = elmText.appendChild(document.createElementNS(SVG_NS, 'textPath'));
        elmTextPath.href.baseVal = '#' + pathId;
        elmTextPath.startOffset.baseVal.newValueSpecifiedUnits(SVGLength.SVG_LENGTHTYPE_PX, 0);
        elmTextPath.textContent = text;

        if (typeof svg2SupportedPaintOrder !== 'boolean') {
          svg2SupportedPaintOrder = 'paintOrder' in elmText.style;
        }
        if (stroke && !svg2SupportedPaintOrder) {
          elmText.id = textId = id + '-text';
          elmDefs.appendChild(elmText);
          elmG = document.createElementNS(SVG_NS, 'g');
          elmUseStroke = elmG.appendChild(document.createElementNS(SVG_NS, 'use'));
          elmUseStroke.href.baseVal = '#' + textId;
          elmUseFill = elmG.appendChild(document.createElementNS(SVG_NS, 'use'));
          elmUseFill.href.baseVal = '#' + textId;
          style = elmUseStroke.style;
          style.strokeLinejoin = 'round';
          return {
            elmPosition: elmText,
            elmPath,
            elmOffset: elmTextPath,
            styleText: elmText.style,
            styleFill: elmUseFill.style,
            styleStroke: style,
            styleShow: elmG.style,
            elmsAppend: [elmDefs, elmG]
          };
        } else {
          style = elmText.style;
          if (stroke) {
            style.strokeLinejoin = 'round';
            style.paintOrder = 'stroke';
          }
          return {
            elmPosition: elmText,
            elmPath,
            elmOffset: elmTextPath,
            styleText: style,
            styleFill: style,
            styleStroke: stroke ? style : null,
            styleShow: style,
            elmsAppend: [elmDefs, elmText]
          };
        }
      },

      initSvg(attachProps, props) {
        traceLog.add('<ATTACHMENTS.pathLabel.initSvg>'); // [DEBUG/]

        const text = ATTACHMENTS.pathLabel.newText(
          attachProps.text,
          props.baseWindow.document,
          APP_ID + '-pathLabel-' + attachProps._id,
          attachProps.outlineColor
        );

        let bBox;
        let strokeWidth;

        ['elmPosition', 'elmPath', 'elmOffset', 'styleFill', 'styleShow', 'elmsAppend'].forEach((key) => {
          attachProps[key] = text[key];
        });

        attachProps.isShown = false;
        attachProps.styleShow.visibility = 'hidden';
        ATTACHMENTS.captionLabel.textStyleProps.forEach((propName) => {
          if (attachProps[propName] != null) {
            text.styleText[propName] = attachProps[propName];
          }
        });

        text.elmsAppend.forEach((elm) => {
          props.svg.appendChild(elm);
        });
        // Get size in straight
        text.elmPath.setPathData([
          { type: 'M', values: [0, 100] },
          { type: 'h', values: [100] }
        ]);
        // [BLINK] getBBox() produces incorrect results for transformed children
        // https://bugs.chromium.org/p/chromium/issues/detail?id=377665
        let hrefSave;
        if (IS_BLINK) {
          hrefSave = text.elmOffset.href.baseVal;
          text.elmOffset.href.baseVal = '';
        }
        bBox = text.elmPosition.getBBox();
        if (IS_BLINK) {
          text.elmOffset.href.baseVal = hrefSave;
        }
        // textAnchor and startOffset might affect the size.
        text.styleText.textAnchor = ['start', 'end', 'middle'][attachProps.semIndex];
        if (attachProps.semIndex === 2 && !attachProps.lineOffset) {
          // The position never change.
          text.elmOffset.startOffset.baseVal.newValueSpecifiedUnits(SVGLength.SVG_LENGTHTYPE_PERCENTAGE, 50);
        }

        attachProps.height = bBox.height;
        if (attachProps.outlineColor) {
          strokeWidth = bBox.height / 9;
          strokeWidth = strokeWidth > 10 ? 10 : strokeWidth < 2 ? 2 : strokeWidth;
          text.styleStroke.strokeWidth = strokeWidth + 'px';
          text.styleStroke.stroke = attachProps.outlineColor;
        }
        attachProps.strokeWidth = strokeWidth || 0;

        initStats(attachProps.aplStats, ATTACHMENTS.pathLabel.stats); // for bindWindow again
        attachProps.updateColor(props);
        attachProps.updatePath(props);
        attachProps.updateStartOffset(props);
        if (IS_WEBKIT) {
          update(props, {});
        } // [WEBKIT] overflow:visible is ignored (To call updateViewBox())
        attachProps.updateShow(props);
        traceLog.add('</ATTACHMENTS.pathLabel.initSvg>'); // [DEBUG/]
      },

      bind(attachProps, bindTarget) {
        traceLog.add('<ATTACHMENTS.pathLabel.bind>'); // [DEBUG/]
        traceLog.add('optionName=%s', bindTarget.optionName); // [DEBUG/]
        const props = bindTarget.props;

        if (!attachProps.color) {
          addEventHandler(props, 'cur_line_color', attachProps.updateColor);
        }
        addEventHandler(props, 'cur_line_strokeWidth', attachProps.updatePath);
        addEventHandler(props, 'apl_path', attachProps.updatePath);
        attachProps.semIndex =
          bindTarget.optionName === 'startLabel' ? 0 : bindTarget.optionName === 'endLabel' ? 1 : 2;
        if (attachProps.semIndex !== 2 || attachProps.lineOffset) {
          addEventHandler(props, 'cur_attach_plugBackLenSE', attachProps.updateStartOffset);
        }
        addEventHandler(props, 'svgShow', attachProps.updateShow);
        // [WEBKIT] overflow:visible is ignored
        if (IS_WEBKIT) {
          addEventHandler(props, 'new_edge4viewBox', attachProps.adjustEdge);
        }

        // after set attachProps.semIndex
        ATTACHMENTS.pathLabel.initSvg(attachProps, props);

        traceLog.add('</ATTACHMENTS.pathLabel.bind>'); // [DEBUG/]
        return true;
      },

      unbind(attachProps, boundTarget) {
        traceLog.add('<ATTACHMENTS.pathLabel.unbind>'); // [DEBUG/]
        const props = boundTarget.props;

        if (attachProps.elmsAppend) {
          attachProps.elmsAppend.forEach((elm) => {
            props.svg.removeChild(elm);
          });
          attachProps.elmPosition =
            attachProps.elmPath =
            attachProps.elmOffset =
            attachProps.styleFill =
            attachProps.styleShow =
            attachProps.elmsAppend =
              null;
        }
        initStats(attachProps.curStats, ATTACHMENTS.pathLabel.stats);
        initStats(attachProps.aplStats, ATTACHMENTS.pathLabel.stats);

        if (!attachProps.color) {
          removeEventHandler(props, 'cur_line_color', attachProps.updateColor);
        }
        removeEventHandler(props, 'cur_line_strokeWidth', attachProps.updatePath);
        removeEventHandler(props, 'apl_path', attachProps.updatePath);
        if (attachProps.semIndex !== 2 || attachProps.lineOffset) {
          removeEventHandler(props, 'cur_attach_plugBackLenSE', attachProps.updateStartOffset);
        }
        removeEventHandler(props, 'svgShow', attachProps.updateShow);
        if (IS_WEBKIT) {
          // [WEBKIT] overflow:visible is ignored
          removeEventHandler(props, 'new_edge4viewBox', attachProps.adjustEdge);
          // addDelayedProc(function() { update(props, {}); }); // reset path_edge
          update(props, {}); // To call updateViewBox()
        }
        traceLog.add('</ATTACHMENTS.pathLabel.unbind>'); // [DEBUG/]
      },

      removeOption(attachProps, boundTarget) {
        traceLog.add('<ATTACHMENTS.pathLabel.removeOption>'); // [DEBUG/]
        traceLog.add('optionName=%s', boundTarget.optionName); // [DEBUG/]
        const props = boundTarget.props,
          newOptions = {};
        newOptions[boundTarget.optionName] = '';
        setOptions(props, newOptions);
        traceLog.add('</ATTACHMENTS.pathLabel.removeOption>'); // [DEBUG/]
      },

      remove(attachProps) {
        traceLog.add('<ATTACHMENTS.pathLabel.remove>'); // [DEBUG/]
        if (attachProps.boundTargets.length) {
          // it should be unbound by LeaderLineAttachment.remove
          traceLog.add('error-not-unbound'); // [DEBUG/]
          console.error('LeaderLineAttachment was not unbound by remove');
          attachProps.boundTargets.forEach((boundTarget) => {
            ATTACHMENTS.pathLabel.unbind(attachProps, boundTarget);
          });
        }
        traceLog.add('</ATTACHMENTS.pathLabel.remove>'); // [DEBUG/]
      }
    }
  };
  window.ATTACHMENTS = ATTACHMENTS; // [DEBUG/]

  Object.keys(ATTACHMENTS).forEach((attachmentName) => {
    LeaderLine[attachmentName] = (...args) => new LeaderLineAttachment(ATTACHMENTS[attachmentName], args);
  });

  // `'auto'`: follow the `prefers-reduced-motion` user preference; `true`/`false` override it.
  LeaderLine.reducedMotion = 'auto';

  // Update position automatically
  LeaderLine.positionByWindowResize = true;
  window.addEventListener(
    'resize',
    frameThrottle(() => /* event */ {
      traceLog.add('<positionByWindowResize>'); // [DEBUG/]
      // var eventWindow;
      if (LeaderLine.positionByWindowResize) {
        // eventWindow = event.target;
        Object.keys(insProps).forEach((id) => {
          // Checking window may be needed when managing each window is supported.
          /*
        var props = insProps[id];
        if (props.baseWindow === eventWindow) {
          traceLog.add('id=%s', id); // [DEBUG/]
          update(props, {position: true});
        }
        */
          traceLog.add('id=%s', id); // [DEBUG/]
          update(insProps[id], { position: true });
        });
      }
      traceLog.add('</positionByWindowResize>'); // [DEBUG/]
    }),
    false
  );

  return LeaderLine;
})();
