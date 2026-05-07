#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..');

const PLUGIN_REPO_PATH = path.join(
  repoRoot,
  '..',
  '..',
  'elementeer',
);

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function main() {
  if (!fs.existsSync(PLUGIN_REPO_PATH)) {
    console.error(`Plugin repository not found at: ${PLUGIN_REPO_PATH}`);
    console.error('Expected structure: ../elementeer relative to this repo');
    console.error('Clone: git clone git@github.com:elementeer/elementeer.git ../elementeer');
    process.exit(1);
  }

  assert(
    fs.existsSync(path.join(PLUGIN_REPO_PATH, 'elementeer.php')),
    'Main plugin file elementeer.php is missing.',
  );
  assert(
    fs.existsSync(path.join(PLUGIN_REPO_PATH, 'composer.json')),
    'composer.json is missing.',
  );
  assert(
    fs.existsSync(path.join(PLUGIN_REPO_PATH, 'readme.txt')),
    'readme.txt is missing.',
  );
  assert(
    fs.existsSync(path.join(PLUGIN_REPO_PATH, 'includes')),
    'includes/ directory is missing.',
  );

  const composer = JSON.parse(
    fs.readFileSync(path.join(PLUGIN_REPO_PATH, 'composer.json'), 'utf8'),
  );
  assert(
    composer.license === 'GPL-2.0-or-later',
    `Plugin license must be GPL-2.0-or-later, got: ${composer.license}`,
  );

  const bootstrap = fs.readFileSync(path.join(PLUGIN_REPO_PATH, 'elementeer.php'), 'utf8');
  assert(
    bootstrap.includes('Elementeer'),
    'Plugin bootstrap must reference Elementeer.',
  );
  assert(
    !bootstrap.includes('Elementify'),
    'Plugin bootstrap must not contain Elementify references.',
  );

  const readme = fs.readFileSync(path.join(PLUGIN_REPO_PATH, 'readme.txt'), 'utf8');
  assert(
    !readme.includes('elementify'),
    'readme.txt must not contain elementify references.',
  );

  console.log('Plugin mirror verification passed.');
  console.log(`Source: ${path.relative(repoRoot, PLUGIN_REPO_PATH)}`);
  console.log('elementeer.php: present and clean');
  console.log('composer.json: present, license GPL-2.0-or-later');
  console.log('readme.txt: present and clean');
  console.log('includes/: present');
}

main();
