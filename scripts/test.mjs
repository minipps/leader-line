// Runs the Jasmine suite (`test/index.html`) in headless Chromium and the smoke test of the
// built files (`test/build/index.html`), and exits non-zero when a spec fails.
//
//   node scripts/test.mjs [page ...]    e.g. `node scripts/test.mjs index.html`

import { startServer } from '../test/server.mjs';
import { launch } from './browser.mjs';

const pages = process.argv.slice(2).length ? process.argv.slice(2) : ['index.html', 'build/index.html'];
const TIMEOUT = 10 * 60 * 1000;

const server = await startServer(0);
const browser = await launch();
let failed = 0;
try {
  for (const page of pages) {
    const tab = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    const errors = [];
    tab.on('pageerror', (error) => errors.push(error.message));
    await tab.goto(`http://127.0.0.1:${server.address().port}/${page}`);
    await tab.waitForFunction(() => globalThis.testResults?.finished, null, { timeout: TIMEOUT });
    // `test/reporter.js`. Errors outside the specs (a spec file that does not load, a failing
    // `afterAll`) are reported by Jasmine on the run and on the suites, not on any spec.
    const { specs, suiteErrors, overallStatus, runErrors } = await tab.evaluate(() => globalThis.testResults);
    errors.push(...runErrors, ...suiteErrors);
    const failures = specs.filter(({ status }) => status === 'failed');
    const passed = specs.filter(({ status }) => status === 'passed').length;
    console.log(
      `${page}: ${passed} passed, ${failures.length} failed, ${specs.length - passed - failures.length} skipped`,
    );
    for (const { fullName, messages } of failures) console.log(`  ✗ ${fullName}\n      ${messages.join('\n      ')}`);
    for (const message of errors) console.log(`  ! ${message}`);
    failed += failures.length + errors.length + (overallStatus === 'passed' ? 0 : 1);
    if (overallStatus !== 'passed') console.log(`  overall status: ${overallStatus}`);
    await tab.close();
  }
} finally {
  await browser.close();
  server.close();
}
process.exitCode = failed ? 1 : 0;
