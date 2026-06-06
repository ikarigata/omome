import esbuild from 'esbuild'

await esbuild.build({
  entryPoints: ['src/postConfirmation.ts'],
  bundle: true,
  platform: 'node',
  target: 'node22',
  format: 'cjs',
  outfile: 'dist/index.js',
})

console.log('Build complete: dist/index.js')
