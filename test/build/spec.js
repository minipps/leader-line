/* eslint-env jasmine */

// Smoke test of the published files, `/package/leader-line.min.js` and `/package/leader-line.mjs`:
// the specs in `/spec` run the source with its debug hooks, not what is shipped.
describe('built files', function () {
  'use strict';

  var PAGE =
    '<!DOCTYPE html><html><head><meta charset="utf-8"></head><body style="margin:0">' +
    '<div id="a" style="position:absolute;left:600px;top:300px;width:20px;height:20px"></div>' +
    '<div id="b" style="position:absolute;left:900px;top:500px;width:20px;height:20px"></div>' +
    '<div id="c" style="position:absolute;left:100px;top:100px;width:40px;height:40px"></div>';

  // Where `viewBox.baseVal` is a rect that is not tied to the attribute.
  var DETACH_VIEWBOX =
    '<script>[SVGSVGElement, SVGMarkerElement].forEach(function(type) {' +
    'Object.defineProperty(type.prototype, "viewBox", {configurable: true, get: function() {' +
    'return {baseVal: {x: 0, y: 0, width: 0, height: 0}}; }}); });</script>';

  var frames = [];

  /** A page in an iframe, resolved once `window.LeaderLine` is set (or an error was thrown). */
  function loadFrame(head) {
    return new Promise(function (resolve, reject) {
      var frame = document.body.appendChild(document.createElement('iframe'));
      frame.style.cssText = 'position:absolute;left:0;top:0;width:1200px;height:800px;visibility:hidden';
      frames.push(frame);
      window.addEventListener('message', function onMessage(event) {
        if (event.source !== frame.contentWindow) {
          return;
        }
        window.removeEventListener('message', onMessage);
        if (event.data.error) {
          reject(new Error(event.data.error));
        } else {
          resolve(frame.contentWindow);
        }
      });
      frame.srcdoc =
        PAGE +
        head +
        '<script>window.onerror = function(message) { parent.postMessage({error: message}, "*"); };</script>' +
        '<script type="module">' +
        'const wait = () => window.LeaderLine ? parent.postMessage({}, "*") : setTimeout(wait, 10); wait();' +
        '</script></body></html>';
    });
  }

  /** Box, in the page, of the painted line: the largest `<use>` in the SVG. */
  function paintedBox(svg) {
    return Array.prototype.map
      .call(svg.querySelectorAll(':scope > g use'), function (use) {
        return use.getBoundingClientRect();
      })
      .sort(function (a, b) {
        return b.width * b.height - a.width * a.height;
      })[0];
  }

  function expectLineBetweenElements(win) {
    var line = new win.LeaderLine(win.document.getElementById('a'), win.document.getElementById('b'), {
        path: 'straight',
        endPlug: 'arrow1',
      }),
      svg = win.document.querySelector('svg.leader-line'),
      box = paintedBox(svg),
      viewBox = svg.getAttribute('viewBox').split(' ').map(Number);
    expect(viewBox.length).toBe(4);
    expect(viewBox[0]).toBeCloseTo(parseFloat(svg.style.left), 0);
    expect(viewBox[1]).toBeCloseTo(parseFloat(svg.style.top), 0);
    // From the right edge of `a` to the left edge of `b`, inside the frame.
    expect(box.left).toBeGreaterThan(600);
    expect(box.left).toBeLessThan(640);
    expect(box.right).toBeLessThan(920);
    line.remove();
    expect(win.document.querySelector('svg.leader-line')).toBeNull();
  }

  afterEach(function () {
    frames.splice(0).forEach(function (frame) {
      frame.remove();
    });
  });

  it('leader-line.min.js defines the LeaderLine global in a classic script', async function () {
    var win = await loadFrame('<script src="/package/leader-line.min.js"></script>');
    expect(typeof win.LeaderLine).toBe('function');
    expect(typeof win.LeaderLine.pointAnchor).toBe('function');
    expectLineBetweenElements(win);
  });

  it('leader-line.min.js exports LeaderLine to CommonJS without a global', async function () {
    var source = await (await fetch('/package/leader-line.min.js')).text(),
      win = await loadFrame(
        '<script>window.__source = ' +
          JSON.stringify(source).replace(/<\//g, '<\\/') +
          '; var module = {exports: {}}; new Function("module", "exports", window.__source)(module, module.exports);' +
          'window.__global = typeof window.LeaderLine; window.LeaderLine = module.exports;</script>',
      );
    expect(win.__global).toBe('undefined');
    expectLineBetweenElements(win);
  });

  it('leader-line.mjs exports LeaderLine as default', async function () {
    var win = await loadFrame(
      '<script type="module">' +
        'import LeaderLine from "/package/leader-line.mjs"; window.LeaderLine = LeaderLine;</script>',
    );
    expectLineBetweenElements(win);
  });

  it('writes the viewBox to the attribute where baseVal is not tied to it', async function () {
    var win = await loadFrame(DETACH_VIEWBOX + '<script src="/package/leader-line.min.js"></script>'),
      area;
    expectLineBetweenElements(win);
    area = new win.LeaderLine(
      win.LeaderLine.areaAnchor(win.document.getElementById('c')),
      win.document.getElementById('a'),
    );
    expect(win.document.querySelector('svg.leader-line-areaAnchor').getAttribute('viewBox')).toBe('94 94 52 52');
    area.remove();
  });

  it('dispatches events to the line and to LeaderLine', async function () {
    var win = await loadFrame('<script src="/package/leader-line.min.js"></script>'),
      own = [],
      all = [],
      line;
    win.LeaderLine.addEventListener('position', function (event) {
      all.push(event.detail.line);
    });
    line = new win.LeaderLine(win.document.getElementById('a'), win.document.getElementById('b'));
    line.addEventListener('update', function (event) {
      own.push(event.detail.changed.includes('path'));
    });
    win.document.getElementById('b').style.left = '1000px';
    line.position();
    expect(own).toEqual([true]);
    expect(all).toEqual([line, line]); // constructor, position()
    line.remove();
  });

  it('autoPosition repositions the line when an element moves', async function () {
    var win = await loadFrame('<script src="/package/leader-line.min.js"></script>'),
      line = new win.LeaderLine(win.document.getElementById('a'), win.document.getElementById('b'), {
        autoPosition: true,
      }),
      moved = new Promise(function (resolve) {
        line.addEventListener('position', resolve);
      });
    win.document.getElementById('b').style.left = '1000px';
    await moved;
    expect(paintedBox(win.document.querySelector('svg.leader-line')).right).toBeGreaterThan(920);
    line.remove();
  });

  it('does not expose the debug hooks of the source', async function () {
    var win = await loadFrame('<script src="/package/leader-line.min.js"></script>');
    [
      'insProps',
      'insAttachProps',
      'traceLog',
      'engineFlags',
      'IS_BLINK',
      'ATTACHMENTS',
      'anim',
      'pathDataPolyfill',
    ].forEach(function (name) {
      expect(name in win)
        .withContext(name)
        .toBe(false);
    });
  });
});
