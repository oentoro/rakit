import { defineConfig } from '@playwright/test';
import config from './playwright.config';
const server=Array.isArray(config.webServer)?config.webServer[0]:config.webServer;
export default defineConfig({...config,webServer:{...server!,command:'npm start -- --port 3010'}});
