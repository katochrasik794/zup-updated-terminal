#!/usr/bin/env node
// @ts-check

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const rootDir = path.resolve(__dirname, '..');
const srcDir = path.join(rootDir, 'src', 'trading_platform-master');
const publicDir = path.join(rootDir, 'public');

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  blue: '\x1b[34m',
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function runCommand(command, cwd, silent = false) {
  try {
    if (!silent) {
      log(`Running: ${command}`, 'blue');
    }
    execSync(command, { 
      cwd, 
      stdio: silent ? 'pipe' : 'inherit',
      env: { ...process.env, ENV: 'production' }
    });
    return true;
  } catch (error) {
    if (!silent) {
      log(`Error running command: ${command}`, 'red');
    }
    return false;
  }
}

function needsInstall(dir) {
  const nodeModulesPath = path.join(dir, 'node_modules');
  return !fs.existsSync(nodeModulesPath);
}

function copyDirectory(src, dest) {
  if (!fs.existsSync(src)) {
    log(`Source directory does not exist: ${src}`, 'red');
    return false;
  }

  // Create destination directory if it doesn't exist
  if (!fs.existsSync(dest)) {
    fs.mkdirSync(dest, { recursive: true });
  }

  // Copy all files from src to dest
  const files = fs.readdirSync(src);
  for (const file of files) {
    const srcPath = path.join(src, file);
    const destPath = path.join(dest, file);
    
    const stat = fs.statSync(srcPath);
    if (stat.isDirectory()) {
      copyDirectory(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
  return true;
}

async function buildBundles() {
  log('\n=== Building TradingView Bundles ===\n', 'yellow');

  // 1. Build datafeeds/udf
  log('Building datafeeds/udf...', 'blue');
  const datafeedsDir = path.join(srcDir, 'datafeeds', 'udf');
  if (needsInstall(datafeedsDir)) {
    log('Installing dependencies for datafeeds/udf...', 'blue');
    if (!runCommand('npm install --prefer-offline --no-audit', datafeedsDir, true)) {
      log('Failed to install dependencies for datafeeds/udf', 'red');
      process.exit(1);
    }
  }
  if (!runCommand('npm run build', datafeedsDir)) {
    log('Failed to build datafeeds/udf', 'red');
    process.exit(1);
  }
  
  const datafeedsDist = path.join(datafeedsDir, 'dist');
  const datafeedsPublic = path.join(publicDir, 'datafeeds', 'udf', 'dist');
  if (copyDirectory(datafeedsDist, datafeedsPublic)) {
    log('✓ Copied datafeeds/udf/dist to public/', 'green');
  }

  // 2. Build broker-sample
  log('\nBuilding broker-sample...', 'blue');
  const brokerDir = path.join(srcDir, 'broker-sample');
  if (needsInstall(brokerDir)) {
    log('Installing dependencies for broker-sample...', 'blue');
    if (!runCommand('npm install --prefer-offline --no-audit', brokerDir, true)) {
      log('Failed to install dependencies for broker-sample', 'red');
      process.exit(1);
    }
  }
  if (!runCommand('npm run build', brokerDir)) {
    log('Failed to build broker-sample', 'red');
    process.exit(1);
  }
  
  const brokerDist = path.join(brokerDir, 'dist');
  const brokerPublic = path.join(publicDir, 'broker-sample', 'dist');
  if (copyDirectory(brokerDist, brokerPublic)) {
    log('✓ Copied broker-sample/dist to public/', 'green');
  }

  // 3. Build custom-dialogs
  log('\nBuilding custom-dialogs...', 'blue');
  const customDialogsDir = path.join(srcDir, 'custom-dialogs');
  if (needsInstall(customDialogsDir)) {
    log('Installing dependencies for custom-dialogs...', 'blue');
    if (!runCommand('npm install --prefer-offline --no-audit', customDialogsDir, true)) {
      log('Failed to install dependencies for custom-dialogs', 'red');
      process.exit(1);
    }
  }
  if (!runCommand('npm run build', customDialogsDir)) {
    log('Failed to build custom-dialogs', 'red');
    process.exit(1);
  }
  
  const customDialogsDist = path.join(customDialogsDir, 'dist');
  const customDialogsPublic = path.join(publicDir, 'custom-dialogs', 'dist');
  if (copyDirectory(customDialogsDist, customDialogsPublic)) {
    log('✓ Copied custom-dialogs/dist to public/', 'green');
  }

  // 4. Copy charting_library files (including standalone.js) to ensure version match
  log('\nCopying charting_library files...', 'blue');
  const chartingLibSrc = path.join(srcDir, 'charting_library');
  const chartingLibPublic = path.join(publicDir, 'charting_library');
  
  // Copy standalone.js specifically to ensure it matches bundles
  const standaloneSrc = path.join(chartingLibSrc, 'charting_library.standalone.js');
  const standaloneDest = path.join(chartingLibPublic, 'charting_library.standalone.js');
  if (fs.existsSync(standaloneSrc)) {
    fs.copyFileSync(standaloneSrc, standaloneDest);
    log('✓ Copied charting_library.standalone.js to public/', 'green');
  } else {
    log('⚠ charting_library.standalone.js not found in source', 'yellow');
  }

  log('\n=== All bundles built successfully! ===\n', 'green');
}

buildBundles().catch((error) => {
  log(`\nFatal error: ${error.message}`, 'red');
  process.exit(1);
});
