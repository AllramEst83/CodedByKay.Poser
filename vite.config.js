import { defineConfig } from 'vite';

// GitHub Pages serves this repo from /CodedByKay.Poser/, so the default
// base: '/' yields 404s on every asset there. Netlify/Cloudflare Pages serve
// from root and want base: '/'. Set DEPLOY_TARGET=gh-pages to build for Pages;
// leave unset for root-served hosts. See PLAN.md §6.3.
const base = process.env.DEPLOY_TARGET === 'gh-pages' ? '/CodedByKay.Poser/' : '/';

export default defineConfig({
  base,
  test: {
    environment: 'node',
    // Unit tests live beside the code they test (src/**/*.test.js). The
    // Playwright smoke test in tests/ has its own runner (npm run test:e2e)
    // and must not be picked up here.
    include: ['src/**/*.test.js'],
  },
});
