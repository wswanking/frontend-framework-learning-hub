# 首轮精确提交 CI：失败，保留记录

[运行40688405912](https://github.com/wswanking/frontend-framework-learning-hub/actions/runs/40688405912)对应PR #2 HEAD `2f00616eeb45125edd43cdcfed310d5858eff20e`。实际checkout为GitHub合成的PR merge引用 `765c6ddb743564e2213ca73c9c7daae330c3dd7c`；已通过git fetch验证它的tree与该HEAD同为 `ded159c1e88a097add2e77bb518bf943339f29b4`。这不是实际合并操作。

- tooling：12通过。
- Vue：unit131通过；browser222通过，零flaky/实际重试；capture2通过、V2候选88张。
- Angular：unit151通过；browser246通过，零flaky/实际重试；capture2通过、V2候选88张。
- React：guards4、unit126、type/lint/build通过；browser222通过、2失败。桌面/移动的同一56异常状态矩阵，在选择loading之后找不到“正在加载工作区”heading；两项既有CI retry仍失败，不能算flaky通过。后续证据门禁失败，封包/候选采集跳过。
- 候选总装：因React失败而skipped。

[React失败日志](https://github.com/wswanking/frontend-framework-learning-hub/actions/runs/40688405912/job/122816647559)，[诊断产物及trace](https://github.com/wswanking/frontend-framework-learning-hub/actions/runs/40688405912/artifacts/12816745001)。只读下载该trace的返回文件主机被环境Tunnel403拒绝；本地安装CI Chromium153被cdn域名策略403拒绝，已停止未绕过。现有系统Chromium154可正常执行；精确153最终需要远端复验。下载失败不等于产品测试通过。

本轮已暴露React路由提交与延后scenario重置的竞态窗口，后续修复与完整复验另记。不用本地先前224通过覆盖本次远端失败；视觉人工始终VISUAL_PENDING。
