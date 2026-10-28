# 本轮最终本地验证

这些是2026-10-28重建版本的新执行记录，运行时代码绑定 `bfe3de601e0b6b39df0054e326e7f0960d04c85e`。不是遗失版本的旧测试结果。最终XML汇总见 [results.json](results.json)，463个应用跟踪文件及末次核验见 [final-app-files.json](final-app-files.json)。

| 应用 | unit | 完整桌面/手机E2E | 视觉候选capture | 详细说明 |
| --- | --- | --- | --- | --- |
| React | 126/126 | 224/224 | 2/2 | [React](react/README.md) |
| Vue | 131/131 | 222/222 | 2/2 | [Vue](vue/README.md) |
| Angular | 151/151 | 246/246 | 2/2 | [Angular](angular/RESULTS.md) |

三端完整E2E均零失败、零跳过、零重试；边界、type、lint、build通过。React全套后仅视觉metadata改动并单独验证；Vue最终CSS修复后重新全量222及unit131。每端目录保存最终XML、日志和源码冻结摘要；`阶段记录/`保存失败、中断、未运行和针对性复验原始日志，不与最终通过数混算。应用说明中的其他HTML报告、trace与截图仍位于各端本地 `reports/v3-rebuild/`，不意味着所有本地产物都已归档至此。

[外层工具12项](tool-tests.log)、[旧180场景DTO一致性](legacy-contract-parity.log)单独记录。V3独立60领域/84页axe等抽查在上级目录；不要把不同范围数字相加当作一个suite。

显式系统Chromium154.0.8037.57、Node24.19.0/npm11.9.0。远端CI使用工作流安装的浏览器，最终精确SHA的CI结果见草稿PR；这些本地文件不冒充远端结果。视觉人工仍 **VISUAL_PENDING**；本地Mock、未真实后端接入，未合并或部署。
