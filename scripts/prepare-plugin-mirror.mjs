#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..');
const outputRoot = path.join(repoRoot, 'mirror', 'generated', 'plugin-public');

const PLUGIN_REPO_PATH = path.join(
  repoRoot,
  '..',
  '..',
  'elementeer',
);

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function cleanOutputRoot() {
  fs.rmSync(outputRoot, { recursive: true, force: true });
}

function copyDir(src, dest, exclude = []) {
  ensureDir(dest);
  const entries = fs.readdirSync(src, { withFileTypes: true });
  for (const entry of entries) {
    if (exclude.includes(entry.name)) continue;
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyDir(srcPath, destPath, exclude);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

function main() {
  if (!fs.existsSync(PLUGIN_REPO_PATH)) {
    console.error(`Plugin repository not found at: ${PLUGIN_REPO_PATH}`);
    console.error('Expected structure: ../elementeer relative to this repo');
    console.error('Clone: git clone git@github.com:elementeer/elementeer.git ../elementeer');
    process.exit(1);
  }

  cleanOutputRoot();
  ensureDir(outputRoot);

  const pluginDest = path.join(outputRoot, 'elementeer');
  const excludeDirs = ['tests', '__tests__', '.phpunit.cache', 'vendor', 'node_modules', '.git', '.github', '.understand-anything'];
  const excludeFiles = ['.phpunit.result.cache', '.gitignore'];

  copyDir(PLUGIN_REPO_PATH, pluginDest, [...excludeDirs, ...excludeFiles]);

  const composerJson = path.join(pluginDest, 'composer.json');
  if (fs.existsSync(composerJson)) {
    const composer = JSON.parse(fs.readFileSync(composerJson, 'utf8'));
    delete composer['require-dev'];
    delete composer['autoload-dev'];
    delete composer['scripts'];
    fs.writeFileSync(composerJson, JSON.stringify(composer, null, 2) + '\n', 'utf8');
  }

  console.log(`Prepared plugin mirror staging from ${path.relative(repoRoot, PLUGIN_REPO_PATH)}`);
  console.log(`Staging output: ${path.relative(repoRoot, outputRoot)}`);
}

main();
