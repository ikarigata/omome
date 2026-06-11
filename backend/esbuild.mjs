import esbuild from 'esbuild'

await esbuild.build({
  entryPoints: ['src/handler.ts'],
  bundle: true,
  platform: 'node',
  target: 'node22',
  format: 'cjs',
  outfile: 'dist/index.js',
  // @libsql/client/web は pure-JS（fetch/WebSocket ベース）。ネイティブの `libsql`
  // バイナリには依存しないのでそのままバンドルできる。external 不要。
  external: [],
  banner: {
    // Required for __dirname/__filename usage in ESM-compiled CJS
    js: '',
  },
})

console.log('Build complete: dist/index.js')
