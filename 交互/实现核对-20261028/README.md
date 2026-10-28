# V3 实现核对（2026-10-28）

本目录保存本轮重建后的真实三端截图、独立自动审阅结果与复核脚本。批准的交互原型仍从 [上级 index.html](../index.html) 打开；这里的截图不是可运行应用。正式应用请依照 [三框架教程](../../docs/learning/README.md) 分别安装启动，入口 `/v3/workspace`。

| 实现 | 桌面 1440×1000 | 手机 390×844 |
| --- | --- | --- |
| React | [桌面](react-desktop.png) | [手机](react-mobile.png) |
| Vue | [桌面](vue-desktop.png) | [手机](vue-mobile.png) |
| Angular | [桌面](angular-desktop.png) | [手机](angular-mobile.png) |

[审阅汇总](summary.json)记录60领域场景、42模块导航、168异常状态、36未保存/历史/刷新检查、84页axe零违规。另有6项嵌套弹窗焦点返回验证。各端完整单元/浏览器与CI结果见 [QUALITY](../../docs/architecture/QUALITY.md)，不与独立抽查数字混算。

`source-provenance.json`绑定本轮运行时代码提交 `0905a2a2a32360f95f66a74a6dca5beb3dd1fd92`；各端 `*-capture.json`保存构建与截图SHA、浏览器版本。完整矩阵后仅按改动复核影响项，再捕获最终六图；不是声称每次构建都重跑全部独立矩阵。详见 [审阅说明](REVIEW.md)。脚本原执行位置为仓库 `reports/v3-rebuild-parity/`，在该位置恢复本目录的脚本及JSON后可使用说明中的命令复核；需各端独立依赖与生产构建。

四条业务流程均为本地Mock：无真实设备控制、邮件发送、MQTT、IAM或生产OTA服务。自动axe的incomplete项目仍需人工判断；截图对照不承诺逐像素一致。**VISUAL_PENDING：未代用户批准视觉基线或最终验收。**
