/* exported getSource, getSourceExport */

var getSource = (function() {
  'use strict';

  function getSource(url, cb) {
    var httpRequest;
    if (window.XMLHttpRequest) {
      httpRequest = new XMLHttpRequest();
      if (httpRequest.overrideMimeType) {
        httpRequest.overrideMimeType('text/plain');
      }
    } else if (window.ActiveXObject) {
      try {
        httpRequest = new ActiveXObject('Msxml2.XMLHTTP'); // eslint-disable-line no-undef
      } catch (e) {
        try {
          httpRequest = new ActiveXObject('Microsoft.XMLHTTP'); // eslint-disable-line no-undef
        } catch (e) { /* ignore */ }
      }
    }
    if (!httpRequest) { throw new Error('XMLHTTP'); }

    httpRequest.onreadystatechange = function() {
      if (httpRequest.readyState === 4) {
        return void (httpRequest.status === 200 ? cb(null, httpRequest.responseText) :
          cb(new Error(httpRequest.status)));
      }
    };
    httpRequest.open('GET', url, true);
    httpRequest.send('');
  }

  return getSource;
})();

/**
 * Gets the code between `/* @EXPORT[test:NAME]@ *\/` and `/* @/EXPORT@ *\/` in the source (served
 * with its types stripped): a part of `updatePosition()` that a spec runs alone, in its own context.
 */
function getSourceExport(name, cb) {
  'use strict';
  getSource('/src/leader-line.ts', function(error, source) {
    var start = '/* @EXPORT[test:' + name + ']@ */', i, end;
    if (error) { return void cb(error); }
    if ((i = source.indexOf(start)) < 0 || (end = source.indexOf('/* @/EXPORT@ */', i)) < 0) {
      return void cb(new Error('Not found in the source: ' + start));
    }
    // The formatter keeps the `(` of an immediate call before the end marker.
    cb(null, source.slice(i + start.length, end).replace(/\)\s*\(\s*$/, ')'));
  });
}
