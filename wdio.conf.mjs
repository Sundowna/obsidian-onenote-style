// End-to-end tests: a sandboxed Obsidian (downloaded into .obsidian-cache) opens a copy
// of the vault prepared by test/e2e/prepare-vault.mjs. The real vault is never opened.
import path from 'node:path';
import { prepareVault } from './test/e2e/prepare-vault.mjs';

const vault = prepareVault();

export const config = {
  runner: 'local',
  framework: 'mocha',
  specs: ['./test/e2e/*.e2e.mjs'],
  maxInstances: 1,
  capabilities: [{
    browserName: 'obsidian',
    browserVersion: 'latest',
    'wdio:obsidianOptions': {
      installerVersion: 'latest',
      plugins: ['.'],
      vault,
    },
  }],
  services: ['obsidian'],
  reporters: ['obsidian'],
  cacheDir: path.resolve('.obsidian-cache'),
  mochaOpts: { ui: 'bdd', timeout: 120000 },
  logLevel: 'warn',
};
