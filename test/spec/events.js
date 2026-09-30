/* eslint-env jasmine */
/* global loadPage:false */

describe('events', function() {
  'use strict';

  var window, document, pageDone, ll, received;

  function listen(target, types) {
    types.forEach(function(type) {
      target.addEventListener(type, function(event) {
        received.push({type: event.type, detail: event.detail});
      });
    });
  }

  function types() {
    return received.map(function(event) { return event.type; });
  }

  // `requestAnimationFrame` is `setTimeout(cb, 1000 / 60)` in the page.
  function afterAnimation(duration, callback) {
    setTimeout(callback, duration + 200);
  }

  beforeEach(function(beforeDone) {
    loadPage('spec/common/page.html', function(frmWindow, frmDocument, body, done) {
      window = frmWindow;
      document = frmDocument;
      pageDone = done;
      received = [];
      ll = new window.LeaderLine(document.getElementById('elm1'), document.getElementById('elm2'));
      beforeDone();
    });
  });

  afterEach(function() {
    pageDone();
  });

  it('position: when the path changes, not when position() finds nothing to do', function() {
    listen(ll, ['position', 'update']);
    ll.position();
    expect(received).toEqual([]);

    document.getElementById('elm2').style.left = '300px';
    ll.position();
    expect(types()).toEqual(['update', 'position']);
    expect(received[0].detail.changed).toContain('path');
    expect(received[1].detail.line).toBe(ll);
  });

  it('update: lists what was redrawn', function() {
    listen(ll, ['update']);
    ll.color = 'red';
    expect(received.length).toBe(1);
    expect(received[0].detail.changed).toContain('line');
    expect(received[0].detail.changed).not.toContain('path');
  });

  it('options: after setOptions() and after setting a property', function() {
    listen(ll, ['options']);
    ll.setOptions({color: 'blue', size: 8});
    ll.path = 'straight';
    expect(received.map(function(event) { return event.detail.options; }))
      .toEqual([['color', 'size'], ['path']]);
  });

  it('show and shown, hide and hidden, without an effect', function() {
    listen(ll, ['show', 'shown', 'hide', 'hidden']);
    ll.hide('none');
    expect(types()).toEqual(['hide', 'hidden']);
    expect(received[0].detail.effect).toBe('none');
    received.length = 0;
    ll.show('none');
    expect(types()).toEqual(['show', 'shown']);
  });

  it('shown: once the effect has run to its end', function(done) {
    ll.hide('none');
    listen(ll, ['show', 'shown']);
    ll.show('fade', {duration: 100});
    expect(types()).toEqual(['show']);
    expect(received[0].detail.animOptions.duration).toBe(100);
    afterAnimation(100, function() {
      expect(types()).toEqual(['show', 'shown']);
      expect(received[1].detail.effect).toBe('fade');
      done();
    });
  });

  it('no shown or hidden when an effect is switched in the middle', function(done) {
    ll.hide('none');
    listen(ll, ['shown', 'hidden']);
    ll.show('fade', {duration: 300});
    setTimeout(function() {
      ll.show('draw', {duration: 100}); // reset of `fade`, `draw` continues
      expect(types()).toEqual([]);
      afterAnimation(300, function() {
        expect(types()).toEqual(['shown']);
        expect(received[0].detail.effect).toBe('draw');
        done();
      });
    }, 50);
  });

  it('remove: before the line is removed; the listeners can still be removed afterwards', function() {
    var onRemove = jasmine.createSpy('remove').and.callFake(function(event) {
      expect(document.querySelector('svg.leader-line')).not.toBeNull();
      expect(event.detail.line).toBe(ll);
    });
    ll.addEventListener('remove', onRemove);
    ll.remove();
    expect(onRemove).toHaveBeenCalledTimes(1);
    expect(document.querySelector('svg.leader-line')).toBeNull();
    expect(function() { ll.removeEventListener('remove', onRemove); }).not.toThrow();
  });

  it('removeEventListener() stops the events', function() {
    var listener = jasmine.createSpy('update');
    ll.addEventListener('update', listener);
    ll.color = 'red';
    ll.removeEventListener('update', listener);
    ll.color = 'blue';
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('LeaderLine.addEventListener(): the events of every line', function() {
    var ll2, lines = [];
    function onPosition(event) { lines.push(event.detail.line); }
    window.LeaderLine.addEventListener('position', onPosition);
    ll2 = new window.LeaderLine(document.getElementById('elm3'), document.getElementById('elm4'));
    expect(lines).toEqual([ll2]); // drawn by the constructor
    document.getElementById('elm1').style.top = '50px';
    document.getElementById('elm3').style.top = '300px';
    ll.position();
    ll2.position();
    expect(lines).toEqual([ll2, ll, ll2]);
    window.LeaderLine.removeEventListener('position', onPosition);
    ll2.remove();
  });

  it('an exception thrown by a listener does not stop the update', function() {
    var pathData, errors = [];
    function onError(event) {
      errors.push(event.message);
      event.preventDefault();
    }
    window.addEventListener('error', onError);
    // Created in the frame: an exception is reported to the global of the listener.
    ll.addEventListener('update', new window.Function('throw new Error("listener")'));
    pathData = window.insProps[ll._id].linePath.getPathData();
    document.getElementById('elm2').style.left = '300px';
    ll.position();
    window.removeEventListener('error', onError);
    expect(errors.length).toBe(1);
    expect(window.pathDataHasChanged(pathData, window.insProps[ll._id].linePath.getPathData())).toBe(true);
  });
});
