// Helper, not a test: writes the sandbox's command list to test/e2e/out/commands.json.
import { browser } from '@wdio/globals';
import fs from 'node:fs';

describe('dump', () => {
  it('commands', async () => {
    const out = await browser.executeObsidian(({ app }) => ({
      version: navigator.userAgent,
      plugins: Object.keys(app.plugins.plugins),
      data: app.plugins.plugins['onenote-style'] ? Object.keys(app.plugins.plugins['onenote-style'].settings) : null,
      commands: Object.values(app.commands.commands).map((c) => ({ id: c.id, name: c.name, icon: c.icon || '' })),
    }));
    fs.mkdirSync('test/e2e/out', { recursive: true });
    fs.writeFileSync('test/e2e/out/commands.json', JSON.stringify(out, null, 1));
  });
});
