/* global LeaderLine:false */

window.traceLog.enabled = true;
window.addEventListener('load', function() {
  'use strict';

  var anchor1 = document.getElementById('anchor-1'),
    ll = new LeaderLine(document.getElementById('anchor-0'), anchor1, {
      color: 'rgba(255, 0, 0, 0.5)', endPlug: 'disc', endPlugSize: 4
    });

  // Drag the anchor, relative to its offset parent `#view`.
  anchor1.addEventListener('pointerdown', function(event) {
    var dx = event.clientX - anchor1.offsetLeft, dy = event.clientY - anchor1.offsetTop;
    function move(event) {
      anchor1.style.left = event.clientX - dx + 'px';
      anchor1.style.top = event.clientY - dy + 'px';
      ll.position();
    }
    anchor1.setPointerCapture(event.pointerId);
    anchor1.addEventListener('pointermove', move, false);
    anchor1.addEventListener('pointerup', function() {
      anchor1.removeEventListener('pointermove', move, false);
    }, {once: true});
  }, false);

  // switcher - label
  (function() {
    var select = document.getElementById('attachment-name');

    function initLabel() {
      switch (select.value) {
        case 'captionLabel':
          ll.setOptions({
            startLabel: '[startLabel]',
            endLabel: '[endLabel]',
            // startLabel: LeaderLine.captionLabel({text: '[startLabel]', offset: [0, 0]}),
            // endLabel: LeaderLine.captionLabel({text: '[endLabel]', offset: [0, 0]}),
            middleLabel: '[middleLabel]'
          });
          break;

        case 'pathLabel':
          ll.setOptions({
            startLabel: LeaderLine.pathLabel({text: '[startLabel]'}),
            endLabel: LeaderLine.pathLabel({text: '[endLabel]'}),
            middleLabel: LeaderLine.pathLabel({text: '[middleLabel]'})
          });
          break;
        // no default
      }
    }

    select.addEventListener('change', initLabel, false);
    initLabel();
  })();

  // switcher - path
  (function() {
    var select = document.getElementById('path');
    function initPath() { ll.path = select.value; }
    select.addEventListener('change', initPath, false);
    initPath();
  })();

  window.ll = ll;
}, false);
