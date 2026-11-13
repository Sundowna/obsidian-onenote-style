// Bundles src/ into the single main.js that Obsidian loads.
import esbuild from 'esbuild';

await esbuild.build({
  entryPoints: ['src/main.js'],
  bundle: true,
  format: 'cjs',
  platform: 'browser',
  target: 'es2020',
  external: ['obsidian', 'electron', '@codemirror/*', '@lezer/*'],
  outfile: 'main.js',
  logLevel: 'info',
  banner: { js: '/* OneNote Style for Obsidian. Built from src/ with esbuild; edit the sources, not this file. */' },
});
