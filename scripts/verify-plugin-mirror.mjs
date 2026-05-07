import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..');

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function main() {
  const pluginRoot = path.join(repoRoot, 'plugin');

  assert(
    fs.existsSync(path.join(pluginRoot, 'elementeer.php')),
    'Main plugin file elementeer.php is missing.',
  );
  assert(
    fs.existsSync(path.join(pluginRoot, 'composer.json')),
    'plugin/composer.json is missing.',
  );
  assert(
    fs.existsSync(path.join(pluginRoot, 'readme.txt')),
    'plugin/readme.txt is missing.',
  );
  assert(
    fs.existsSync(path.join(pluginRoot, 'includes')),
    'plugin/includes/ directory is missing.',
  );

  const composer = JSON.parse(
    fs.readFileSync(path.join(pluginRoot, 'composer.json'), 'utf8'),
  );
  assert(
    composer.license === 'GPL-2.0-or-later',
    `Plugin license must be GPL-2.0-or-later, got: ${composer.license}`,
  );

  const bootstrap = fs.readFileSync(path.join(pluginRoot, 'elementeer.php'), 'utf8');
  assert(
    bootstrap.includes('Elementeer'),
    'Plugin bootstrap must reference Elementeer.',
  );
  assert(
    !bootstrap.includes('Elementify'),
    'Plugin bootstrap must not contain Elementify references.',
  );

  const readme = fs.readFileSync(path.join(pluginRoot, 'readme.txt'), 'utf8');
  assert(
    !readme.includes('elementify'),
    'plugin/readme.txt must not contain elementify references.',
  );

  console.log('Plugin mirror verification passed.');
  console.log('plugin/elementeer.php: present and clean');
  console.log('plugin/composer.json: present, license GPL-2.0-or-later');
  console.log('plugin/readme.txt: present and clean');
  console.log('plugin/includes/: present');
}

main();
