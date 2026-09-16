import js from '@eslint/js';
import ts from 'typescript-eslint';
import vue from 'eslint-plugin-vue';
export default ts.config({ ignores: ['node_modules/**', 'dist/**', 'reports/**', '.angular/**', 'coverage/**'] }, js.configs.recommended, { files: ['scripts/**/*.mjs'], languageOptions: { globals: { process: 'readonly', console: 'readonly', URL: 'readonly' } } }, ...ts.configs.recommended, ...vue.configs['flat/essential'], { files: ['**/*.vue'], languageOptions: { parserOptions: { parser: ts.parser } }, rules: { 'vue/multi-word-component-names': 'off' } });
