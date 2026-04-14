import { resolve } from 'path';
import { defineConfig } from 'vite';

export default defineConfig({
  root: 'src',
  envDir: '../',
  publicDir: 'public',
  build: {
    outDir: '../dist',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        main:   resolve(__dirname, 'src/index.html'),
        match:  resolve(__dirname, 'src/match/index.html'),
        player: resolve(__dirname, 'src/player/index.html'),
        team:   resolve(__dirname, 'src/team/index.html'),
      },
    },
  },
});
