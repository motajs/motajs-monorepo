import { defineConfig } from '@pandacss/dev';

export default defineConfig({
  // Whether to use css reset
  preflight: false,

  syntax: 'template-literal',

  jsxFramework: 'react',

  // Where to look for your css declarations
  // 单一配置同时拥有 editor 与 editor-core 源码（D-09）：include 相对 panda 进程 cwd（editor 目录）解析。
  include: ['./src/**/*.{js,jsx,ts,tsx}', '../../libs/editor-core/lib/**/*.{ts,tsx}'],

  // Files to exclude
  exclude: [],

  // Useful for theme customization
  theme: {
    extend: {},
  },

  // The output directory for your css system
  outdir: 'styled-system',
});
