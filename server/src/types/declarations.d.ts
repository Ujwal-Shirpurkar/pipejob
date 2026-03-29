declare module 'puppeteer-extra-plugin-stealth' {
  import type { Plugin } from 'playwright-extra';
  function StealthPlugin(): Plugin;
  export = StealthPlugin;
}
