/* eslint-env jasmine */
/* global loadPage:false */

describe('animation', function () {
  'use strict';

  var window, document, pageDone, ll;

  beforeEach(function (beforeDone) {
    loadPage('spec/common/page.html', function (frmWindow, frmDocument, body, done) {
      window = frmWindow;
      document = frmDocument;
      pageDone = done;
      ll = new window.LeaderLine(document.getElementById('elm1'), document.getElementById('elm2'));
      beforeDone();
    });
  });

  afterEach(function () {
    window.LeaderLine.reducedMotion = 'auto';
    if (window.insProps[ll._id]) {
      ll.remove();
    }
    pageDone();
  });

  function props() {
    return window.insProps[ll._id];
  }

  function keyframeValues(animation, property) {
    return animation.effect.getKeyframes().map(function (keyframe) {
      return keyframe[property];
    });
  }

  describe('fade', function () {
    it('is a native animation of the opacity of the SVG', function (done) {
      var animations, onHidden = jasmine.createSpy('hidden');
      ll.addEventListener('hidden', onHidden);
      ll.hide('fade', { duration: 200, timing: [0.5, 0, 1, 0.42] });
      animations = props().svg.getAnimations();
      expect(animations.length).toBe(1);
      expect(keyframeValues(animations[0], 'opacity')).toEqual(['0', '1']);
      expect(animations[0].effect.getTiming().easing).toBe('cubic-bezier(0.5, 0, 1, 0.42)');
      expect(animations[0].playbackRate).toBe(-1);
      setTimeout(function () {
        expect(onHidden).toHaveBeenCalledTimes(1);
        expect(props().svg.getAnimations().length).toBe(0);
        expect(props().svg.style.opacity).toBe('0');
        expect(props().svg.style.visibility).toBe('hidden');
        done();
      }, 400);
    });

    it('turns back from where it is', function (done) {
      ll.hide('fade', { duration: 400 });
      setTimeout(function () {
        var animation = props().svg.getAnimations()[0],
          hidTime = animation.currentTime; // about 400 - 100
        ll.show();
        expect(props().svg.getAnimations()[0]).toBe(animation); // the same animation, played forward
        expect(animation.playbackRate).toBe(1);
        expect(Math.abs(animation.currentTime - hidTime)).toBeLessThan(40);
        expect(animation.currentTime).toBeGreaterThan(200);
        expect(animation.currentTime).toBeLessThan(380);
        done();
      }, 100);
    });
  });

  describe('dash', function () {
    it('animates the offset natively, and stops with the effect', function () {
      var animations;
      ll.setOptions({ size: 4, dash: { animation: { duration: 500 } } });
      animations = props().lineFace.getAnimations();
      expect(animations.length).toBe(1);
      expect(keyframeValues(animations[0], 'strokeDashoffset')).toEqual(['12px', '0px']); // len 8 + gap 4
      expect(animations[0].effect.getTiming().iterations).toBe(Infinity);
      ll.dash = true; // no animation
      expect(props().lineFace.getAnimations().length).toBe(0);
    });
  });

  describe('flow', function () {
    it('moves dots along the line at a constant speed', function () {
      var animation;
      ll.setOptions({ size: 4, flow: { speed: 120 } });
      expect(ll.flow).toEqual({ len: 'auto', gap: 'auto', speed: 120, reverse: false });
      expect(props().lineFace.style.strokeDasharray).toBe('0, 12'); // dots, gap: 3 * size
      expect(props().lineFace.style.strokeLinecap).toBe('round');
      animation = props().lineFace.getAnimations()[0];
      expect(keyframeValues(animation, 'strokeDashoffset')).toEqual(['0px', '-12px']);
      expect(animation.effect.getTiming().duration).toBeCloseTo(100, 6); // 12px at 120px/s
      expect(animation.effect.getTiming().iterations).toBe(Infinity);
    });

    it('flows backwards with `reverse`, and follows the size of the line', function () {
      ll.setOptions({ size: 4, flow: { len: 6, gap: 10, reverse: true } });
      expect(props().lineFace.style.strokeDasharray).toBe('6, 10');
      expect(keyframeValues(props().lineFace.getAnimations()[0], 'strokeDashoffset')).toEqual(['0px', '16px']);
      ll.flow = true;
      ll.size = 8;
      expect(props().lineFace.style.strokeDasharray).toBe('0, 24');
      expect(props().lineFace.getAnimations().length).toBe(1);
    });

    it('takes over from dash, which is back when flow is off', function () {
      ll.setOptions({ size: 4, dash: { len: 5, gap: 5 }, flow: true });
      expect(props().lineFace.style.strokeDasharray).toBe('0, 12');
      expect(props().aplStats.dash_enabled).toBe(false);
      ll.flow = false;
      expect(props().lineFace.style.strokeDasharray).toBe('5, 5');
      expect(props().lineFace.style.strokeLinecap).toBe('');
      expect(props().lineFace.getAnimations().length).toBe(0);
    });

    it('is cancelled when the line is removed', function () {
      var face;
      ll.flow = true;
      face = props().lineFace;
      ll.remove();
      expect(face.getAnimations().length).toBe(0);
    });
  });

  describe('reduced motion', function () {
    it('shows and hides at once, and keeps the effect for later', function () {
      var events = [];
      ['hide', 'hidden'].forEach(function (type) {
        ll.addEventListener(type, function (event) {
          events.push(type + ':' + event.detail.effect);
        });
      });
      window.LeaderLine.reducedMotion = true;
      ll.hide('fade', { duration: 1000 });
      expect(events).toEqual(['hide:none', 'hidden:none']);
      expect(props().svg.getAnimations().length).toBe(0);
      expect(props().svg.style.visibility).toBe('hidden');

      window.LeaderLine.reducedMotion = false;
      ll.show(); // the effect that was chosen
      expect(props().svg.getAnimations().length).toBe(1);
      expect(props().curStats.show_effect).toBe('fade');
    });

    it('follows `prefers-reduced-motion` by default', function () {
      var matchMedia = window.matchMedia;
      window.matchMedia = function (query) {
        return { matches: query === '(prefers-reduced-motion: reduce)' };
      };
      ll.hide('fade');
      window.matchMedia = matchMedia;
      expect(props().svg.getAnimations().length).toBe(0);
      expect(props().svg.style.visibility).toBe('hidden');
    });

    it('leaves the dashes and the dots static', function () {
      window.LeaderLine.reducedMotion = true;
      ll.setOptions({ dash: { animation: true } });
      expect(props().lineFace.getAnimations().length).toBe(0);
      ll.setOptions({ dash: false, flow: true });
      expect(props().lineFace.style.strokeDasharray).not.toBe('none');
      expect(props().lineFace.getAnimations().length).toBe(0);
    });
  });

  describe('smoothPosition', function () {
    function endPoint() {
      return props().linePath.getPathData().at(-1).values.slice(-2);
    }

    it('is off by default', function () {
      expect(ll.smoothPosition).toBe(false);
      document.getElementById('elm2').style.left = '300px';
      ll.position();
      expect(props().curStats.position_animId == null).toBe(true);
    });

    it('moves the line to its new position over the duration', function (done) {
      var target;
      ll.smoothPosition = { duration: 200, timing: 'linear' };
      expect(ll.smoothPosition).toEqual({ duration: 200, timing: 'linear' });
      var start = endPoint();
      document.getElementById('elm2').style.left = '400px';
      ll.position();
      target = props().pathList.baseVal.at(-1).at(-1);
      expect(endPoint()[0]).toBeCloseTo(start[0], 0); // not moved yet
      setTimeout(function () {
        var x = endPoint()[0];
        expect(x).toBeGreaterThan(start[0] + 20);
        expect(x).toBeLessThan(target.x - 20);
        setTimeout(function () {
          expect(endPoint()[0]).toBeCloseTo(target.x, 3);
          expect(props().pathList.animVal).toBeNull();
          done();
        }, 250);
      }, 100);
    });

    it('jumps between paths of different shapes', function () {
      ll.setOptions({ smoothPosition: true, path: 'straight' });
      ll.path = 'fluid'; // 2 points -> 4 points
      expect(props().curStats.position_animId == null).toBe(true);
    });

    it('jumps with reduced motion', function () {
      window.LeaderLine.reducedMotion = true;
      ll.smoothPosition = true;
      document.getElementById('elm2').style.left = '400px';
      ll.position();
      expect(props().curStats.position_animId == null).toBe(true);
      expect(props().pathList.animVal).toBeNull();
    });
  });
});
