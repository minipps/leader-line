/* eslint-env jasmine */
/* global loadPage:false */

describe('autoPosition', function () {
  'use strict';

  var window, document, pageDone, ll, positions;

  // `requestAnimationFrame` is `setTimeout(cb, 1000 / 60)` in the page.
  function afterFrames(frames, callback) {
    setTimeout(callback, (frames * 1000) / 60 + 50);
  }

  function startPoint() {
    return window.insProps[ll._id].linePath.getPathData()[0].values;
  }

  beforeEach(function (beforeDone) {
    loadPage('spec/auto-position/page.html', function (frmWindow, frmDocument, body, done) {
      window = frmWindow;
      document = frmDocument;
      pageDone = done;
      positions = 0;
      beforeDone();
    });
  });

  afterEach(function () {
    if (ll && window.insProps[ll._id]) {
      ll.remove();
    }
    pageDone();
  });

  function create(options) {
    ll = new window.LeaderLine(document.getElementById('elm1'), document.getElementById('elm2'), options);
    ll.addEventListener('position', function () {
      positions++;
    });
  }

  it('is off by default', function (done) {
    create();
    expect(ll.autoPosition).toBe(false);
    var point = startPoint();
    document.getElementById('container').classList.add('moved');
    afterFrames(3, function () {
      expect(startPoint()).toEqual(point);
      expect(positions).toBe(0);
      done();
    });
  });

  it('follows a class change of an ancestor', function (done) {
    create({ autoPosition: true });
    expect(ll.autoPosition).toBe(true);
    var x = startPoint()[0];
    afterFrames(2, function () {
      document.getElementById('container').classList.add('moved');
      afterFrames(2, function () {
        expect(startPoint()[0]).toBeCloseTo(x + 50, 0);
        done();
      });
    });
  });

  it('follows a resize that moves the element', function (done) {
    create({ autoPosition: true });
    var elm2 = document.getElementById('elm2'),
      before;
    afterFrames(2, function () {
      before = window.insProps[ll._id].linePath.getPathData().at(-1).values.slice(-2);
      elm2.style.height = '120px'; // style of the element itself, and a resize: the socket moves down
      afterFrames(2, function () {
        expect(window.insProps[ll._id].linePath.getPathData().at(-1).values.slice(-2)).not.toEqual(before);
        done();
      });
    });
  });

  it('follows the scrolling of a container', function (done) {
    ll = new window.LeaderLine(document.getElementById('elm3'), document.getElementById('elm4'), {
      autoPosition: true
    });
    var y;
    afterFrames(2, function () {
      y = startPoint()[1];
      document.getElementById('scroller').scrollTop = 40;
      afterFrames(2, function () {
        expect(startPoint()[1]).toBeCloseTo(y - 40, 0);
        done();
      });
    });
  });

  it('repositions frame by frame during a transition, and stops after it', function (done) {
    create({ autoPosition: true });
    var container = document.getElementById('container');
    afterFrames(2, function () {
      positions = 0;
      container.classList.add('sliding');
      container.classList.add('moved');
      setTimeout(function () {
        expect(positions).toBeGreaterThan(5); // 300 ms at 60 fps: about 18
        var settled = positions;
        afterFrames(10, function () {
          expect(positions).toBe(settled);
          done();
        });
      }, 450);
    });
  });

  it('is not kept going by an endless animation outside the elements', function (done) {
    var spinner = document.body.appendChild(document.createElement('div'));
    spinner.id = 'spinner';
    create({ autoPosition: true });
    afterFrames(5, function () {
      positions = 0;
      var requests = 0,
        raf = window.requestAnimationFrame;
      window.requestAnimationFrame = function (callback) {
        requests++;
        return raf(callback);
      };
      afterFrames(10, function () {
        window.requestAnimationFrame = raf;
        expect(requests).toBe(0);
        spinner.remove();
        done();
      });
    });
  });

  it('follows the new element when `end` changes', function (done) {
    create({ autoPosition: true });
    var elm4 = document.getElementById('elm4'),
      before;
    ll.end = elm4;
    afterFrames(2, function () {
      before = window.insProps[ll._id].linePath.getPathData().at(-1).values.slice(-2);
      elm4.style.left = '550px';
      afterFrames(2, function () {
        expect(window.insProps[ll._id].linePath.getPathData().at(-1).values.slice(-2)).not.toEqual(before);
        done();
      });
    });
  });

  it('stops when it is turned off, and when the line is removed', function (done) {
    create({ autoPosition: true });
    afterFrames(2, function () {
      ll.autoPosition = false;
      expect(window.insProps[ll._id].positionWatcher).toBeNull();
      positions = 0;
      document.getElementById('container').classList.add('moved');
      afterFrames(3, function () {
        expect(positions).toBe(0);

        ll.autoPosition = true;
        var watcher = window.insProps[ll._id].positionWatcher;
        spyOn(watcher, 'stop').and.callThrough();
        ll.remove();
        expect(watcher.stop).toHaveBeenCalled();
        expect(function () {
          document.getElementById('container').classList.remove('moved');
        }).not.toThrow();
        afterFrames(3, done);
      });
    });
  });
});
