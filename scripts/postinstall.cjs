#!/usr/bin/env node
// Cross-platform postinstall script — works on Windows, macOS, and Linux.
// Reads the SKIP_BUILD environment variable; if not "true", runs the trading bundle build.

const { execSync } = require('child_process');

if (process.env.SKIP_BUILD !== 'true') {
    execSync('npm run build:trading-bundles', { stdio: 'inherit', cwd: __dirname + '/..' });
}
