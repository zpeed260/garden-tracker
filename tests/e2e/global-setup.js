'use strict';

const TEST_PORT = 3001;

module.exports = async function globalSetup() {
  // The webServer starts before globalSetup on Playwright 1.59+, so the server is
  // already running here. Call the test-reset endpoint to wipe accumulated state
  // (fertiliser_log, notes, extra seed_types) so every run starts from a clean DB.
  const res = await fetch(`http://localhost:${TEST_PORT}/api/test/reset`, { method: 'POST' });
  if (!res.ok) throw new Error(`Test reset failed: ${res.status}`);
};
