import { defineConfig } from 'vitest/config';
import plugin from '@vitejs/plugin-vue';
export default defineConfig({ plugins: [plugin()], test: { environment: 'jsdom', setupFiles: ['./tests/setup.ts'], include: ['src/**/*.spec.{ts,tsx}'], reporters: ['default', 'junit'], outputFile: { junit: 'reports/unit.xml' } } });
