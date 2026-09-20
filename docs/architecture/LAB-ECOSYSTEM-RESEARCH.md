# 组件实验室生态候选（2026-09-20）

关联 IOT-LEARNING-001、REVIEW-004。本记录为依赖选择的研究输入，不是审核结论。2026-09-20 为执行用户要求的三端需求实现，各端已独立安装 PRD 指定的 Chart.js 4.5.1、D3.js 7.9.0 与 @types/d3 7.4.3，ECharts 沿用各端已有 6.1.0；React 端已独立安装 antd 6.6.4 和 @chakra-ui/react 3.37.0 并接入实验室原型；Vue 端已独立安装 vuetify 4.2.1、primevue 4.5.5、@primeuix/themes 2.0.3 与 vite-plugin-vuetify 2.1.3，在本端独立实验页面内运行示例；Angular 端已独立安装 ng-bootstrap 21.0.0 与 NG-ZORRO 22.1.0 候选原型；PrimeNG 22.1.1 随包许可证要求有效密钥，当前未安装。最终选型留待 REVIEW-004。

## 统计口径

2026-09-20 查询 npm 官方下载 API 的 `last-week` 包下载次数；接口返回的共同窗口为 **2026-09-12 至 2026-09-18**。按各框架中可用于组件实验室的 UI 包下载量排序。下载次数是生态热度的近似指标，包含自动化安装，不代表活跃用户数，也不证明表格、表单、弹窗、导航、主题五类能力均完整。正式选型仍需 REVIEW-004 审核版本、能力、许可、依赖体积和样式隔离。

| 框架 | 排名 | npm 包 | 7 日下载量 | 备注 |
| --- | ---: | --- | ---: | --- |
| React | 1 | [@mui/material](https://www.npmjs.com/package/@mui/material) | 7,218,821 | 现有主 UI |
| React | 2 | [antd](https://www.npmjs.com/package/antd) | 2,733,464 | 候选 |
| React | 3 | [@chakra-ui/react](https://www.npmjs.com/package/@chakra-ui/react) | 1,142,858 | 候选 |
| Vue | 1 | [vuetify](https://www.npmjs.com/package/vuetify) | 726,304 | 候选 |
| Vue | 2 | [primevue](https://www.npmjs.com/package/primevue) | 584,893 | 候选 |
| Vue | 3 | [element-plus](https://www.npmjs.com/package/element-plus) | 488,058 | 现有主 UI |
| Angular | 1 | [@angular/material](https://www.npmjs.com/package/@angular/material) | 1,702,194 | 现有主 UI |
| Angular | 2 | [primeng](https://www.npmjs.com/package/primeng) | 522,562 | 候选 |
| Angular | 3 | [@ng-bootstrap/ng-bootstrap](https://www.npmjs.com/package/@ng-bootstrap/ng-bootstrap) | 419,614 | 需验证主题与数据表格能力 |

下载量原始来源为 [npm Downloads API](https://github.com/npm/registry/blob/main/docs/download-counts.md)，各包数据可按 `https://api.npmjs.org/downloads/point/last-week/{包名}` 重查。Angular [ng-zorro-antd](https://www.npmjs.com/package/ng-zorro-antd) 同窗为 207,569 次；若 ng-bootstrap 的控件能力不满足需求，可作为替代候选。图表库 ECharts、Chart.js、D3.js 为 PRD 指定，现有版本与加载策略仍需 REVIEW-004 审核。

## 2026-09-20 版本兼容性核对（REVIEW-004 输入）

使用 npm 当前 `version` 与 `peerDependencies` 元数据核对本端已安装框架；以下为候选信息及已实施版本，不代表已批准最终 UI 选型。

| 框架 | 候选当前版 | 与本端版本关系 | 实现前待解决 |
| --- | --- | --- | --- |
| React 19 | antd 6.6.4 | React/React DOM >=18，范围兼容 | 样式与弹窗挂载隔离；固定数据的五类控件示例 |
| React 19 | @chakra-ui/react 3.37.0 | React/React DOM >=18，@emotion/react >=11，范围兼容 | Provider、主题及样式作用域；[官方安装说明](https://chakra-ui.com/docs/get-started/installation) |
| Vue 3.5 | vuetify 4.2.1 | Vue ^3.5 范围兼容 | 还需 vite-plugin-vuetify >=2.1；全局 CSS 与本端业务样式隔离 |
| Vue 3.5 | primevue 4.5.5（已实施） | MIT 许可，与本端 Vue 版本可用 | 5.0.1 需要 PrimeUI 许可证密钥，当前工程未获密钥；4.5.5 原型在独立实验页面运行，最终版本待 REVIEW-004 |
| Angular 22.1 | primeng 22.1.1 | Angular/CDK ^22.1，范围兼容 | 包内 LICENSE.md 要求有效 PrimeUI 密钥，当前未获密钥；未纳入可运行原型 |
| Angular 22.1 | @ng-bootstrap/ng-bootstrap 21.0.0（已实施） | Angular ^22；已安装 @angular/localize、@popperjs/core 与 Bootstrap CSS | 表格由 Bootstrap HTML/CSS 与 ng-bootstrap 分页组合，并非包内独立表格组件 |
| Angular 22.1 | ng-zorro-antd 22.1.0（替代原型） | Angular ^22，范围兼容，MIT | 完整表格、表单、弹窗、导航与暗亮 CSS 在独立 iframe 验证；是否代替 PrimeNG 待 REVIEW-004 |

下载排行只证明所定义口径下的热度，不能替代五类控件、隔离与性能验证。Vuetify 的全局样式现隔离在 Vue 本端候选 iframe 入口，业务页面不加载该入口；ng-bootstrap 的表格由 Bootstrap 样式和 ng-bootstrap 分页组合，缺少包内独立表格组件；NG-ZORRO 可作为完整控件的替代原型。PrimeVue 5 的许可要求来自已安装包随附 LICENSE.md 与[官方安装说明](https://primevue.dev/vite/)，最终版本仍待 REVIEW-004。

## Angular 候选的许可证与能力差异

`primeng@22.1.1` npm 包随附 `LICENSE.md` 明确要求有效许可证密钥；当前仓库没有密钥，因此仅用 `npm pack` 在仓库外核对条款，没有将其安装或作为已验收候选。`@ng-bootstrap/ng-bootstrap@21.0.0` 包导出包含分页、导航、弹窗与输入辅助组件，但没有独立表格组件；实验示例用 Bootstrap 表格样式和其分页控件展示同一数据。`ng-zorro-antd@22.1.0` 以 MIT 许可提供完整的表格等组件，已作为替代原型在本端隔离 iframe 验证。PrimeNG 密钥或替代选型由 REVIEW-004 决定。

2026-09-20 复核 `primeng@22.1.1` 包内条款：社区许可有组织规模和用途门槛，且社区与商业许可均要求有效密钥；仓库没有可用密钥，也没有组织资格结论。npm 元数据显示 22.1.1 的 Angular peer 为 `^22.1.0`，20.4.0 与 21.1.10 分别要求 Angular 20 与 21，不能作为本端 Angular 22 的直接替代。PrimeNG 官网旧版 [LTS 说明](https://primeng.org/lts) 所述“普通版 MIT、仅 LTS 需密钥”与当前 22.1.1 随包条款不一致；本次以具体安装包条款为准。正式许可与选型仍需 REVIEW-004 决定。
