import esbuild from 'esbuild'

await esbuild.build({
  entryPoints: ['src/handler.ts'],
  bundle: true,
  platform: 'node',
  target: 'node22',
  format: 'cjs',
  outfile: 'dist/index.js',
  // @neondatabase/serverless uses WebSocket, mark ws as external to avoid bundling issues
  external: [],
  banner: {
    // Required for __dirname/__filename usage in ESM-compiled CJS
    js: '',
  },
})

console.log('Build complete: dist/index.js')
