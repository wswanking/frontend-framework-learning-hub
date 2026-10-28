# 第二轮精确提交 CI：测试等待边界失败

[运行40690310405](https://github.com/wswanking/frontend-framework-learning-hub/actions/runs/40690310405)对应HEAD `0905a2a2a32360f95f66a74a6dca5beb3dd1fd92`，整体failure。Vue、Angular、tooling任务成功；React任务失败，总装skipped。

React原先的14模块56异常状态矩阵在桌面和手机均通过，路由状态覆盖问题已修复。完整browser仍为222通过、2失败，原因变为新增导航helper统一等待目标h1，而两个“取消离开”操作本来应保留settings页面；正确取消后，helper错误等待devices标题并超时。本地也复现，不能隐藏为环境波动。

修复仅拆分测试helper：`clickNav`触发实际点击；`nav`用于成功导航并等目标标题。两处取消操作使用前者，其余取消URL、保存后再次编辑和保护断言不变。产品源码未再修改；修改后重新完整零重试套件，以后续结果为准。

[React job日志](https://github.com/wswanking/frontend-framework-learning-hub/actions/runs/40690310405/job/122823129593)。不重跑旧失败job冒充新测试，也不通过降低断言或重试隐藏问题。
