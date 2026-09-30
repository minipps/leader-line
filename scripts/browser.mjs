// Headless Chromium for the tests and `build-defs`. Set `CHROME` to use a specific browser
// binary; otherwise the one installed by `npx playwright install chromium` is used.

import { chromium } from 'playwright-core';

export const launch = () => chromium.launch({ executablePath: process.env.CHROME || undefined });
