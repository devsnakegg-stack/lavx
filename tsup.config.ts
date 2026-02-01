import { defineConfig } from 'tsup';

export default defineConfig({
  entry: {
    index: 'src/Index.ts'
  },
  format: ['cjs', 'esm'],
  dts: true,
  splitting: false,
  sourcemap: true,
  clean: true,
  minify: false,
  outDir: 'dist',
});
