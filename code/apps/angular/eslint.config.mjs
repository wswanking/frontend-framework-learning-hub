import js from '@eslint/js';
import ts from 'typescript-eslint';
import angular from 'angular-eslint';
export default ts.config({ ignores: ['node_modules/**', 'dist/**', 'reports/**', '.angular/**', 'coverage/**'] }, js.configs.recommended, { files: ['scripts/**/*.mjs'], languageOptions: { globals: { process: 'readonly', console: 'readonly', URL: 'readonly' } } }, ...ts.configs.recommended, { files: ['src/**/*.ts'], extends: [...angular.configs.tsRecommended], processor: angular.processInlineTemplates }, { files: ['src/**/*.html'], extends: [...angular.configs.templateRecommended, ...angular.configs.templateAccessibility] });
