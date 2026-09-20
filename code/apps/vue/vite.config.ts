import { defineConfig } from 'vitest/config';
import plugin from '@vitejs/plugin-vue';
import vuetify from 'vite-plugin-vuetify';
export default defineConfig({ plugins: [plugin(), vuetify({ autoImport: false })], build: { rollupOptions: { input: { main: 'index.html', labVuetify: 'labs-vuetify.html', labPrimeVue: 'labs-primevue.html' } } }, test: { environment: 'jsdom', setupFiles: ['./tests/setup.ts'], include: ['src/**/*.spec.{ts,tsx}'], reporters: ['default', 'junit'], outputFile: { junit: 'reports/unit.xml' } } });
