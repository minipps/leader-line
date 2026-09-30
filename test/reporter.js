/* eslint-env jasmine */

// Collects the results for `scripts/test.mjs` in `window.testResults`.
(function () {
  'use strict';

  var results = (window.testResults = {
      finished: false,
      specs: [],
      suiteErrors: [],
      overallStatus: null,
      runErrors: [],
    }),
    messages = function (expectations) {
      return expectations.map(function (expectation) {
        return expectation.message;
      });
    };

  jasmine.getEnv().addReporter({
    specDone: function (result) {
      results.specs.push({
        fullName: result.fullName,
        status: result.status,
        messages: messages(result.failedExpectations),
      });
    },
    suiteDone: function (result) {
      messages(result.failedExpectations).forEach(function (message) {
        results.suiteErrors.push(result.fullName + ': ' + message);
      });
    },
    jasmineDone: function (result) {
      results.overallStatus = result.overallStatus;
      results.runErrors = messages(result.failedExpectations);
      results.finished = true;
    },
  });
})();
