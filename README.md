# dsh-auto-load-earlier

DSH（DeepSeek Harness）Web 客户端的滚动自动加载插件：**往上翻不再需要停下来点「加载更早」。**

聊天页只驻留历史尾部的窗口，翻到顶会停住，必须手动点一下按钮再等一页回来。这个插件把这个动作接掉 —— 检测到你在往上翻，就替你去点那个按钮。它调用的是官方 `loadEarlier()` 的同一条路径（取消进行中的工作 → 保持滚动锚点 → 暂停跟随底部），不碰数据层，也不修改任何官方包。

## 两种触发

| 档位 | 条件 | 用途 |
|---|---|---|
| 慢速（接近顶部） | 距顶 ≤ 140px，且累计上滑 ≥ 48px | 一页一页往回读 |
| 快速（速度预取） | 上滑 **≥ 900 px/s** 或 160ms 内滑过 1 屏，且距顶 ≤ 3 屏 | 快速跳回很早的位置 |

快速档会**提前 3 屏**开始抢，所以冲到顶时上面已经在加载了。连续预取有上限（一次甩动最多 8 页，静默 2 秒后计数清零），避免一口气把几千条历史全塞进 DOM。

慢滚不会误触发：实测 Firefox 行模式 4–16 格/秒、像素模式 3–6 格/秒，触发次数均为 0。

## 安装

作为本地插件挂到 profile 上。

1. 把本仓库放进 `dsh-home/plugins-local/`，目录名 `dsh-auto-load-earlier`。
2. 在 `dsh-home/profiles/web/cordis.patch.yml` 末尾追加：

```yaml
- insert:
    - id: auto-load-earlier
      name: ../../plugins-local/dsh-auto-load-earlier/lib/index.js
```

3. 保存后 patch 会热加载（约 1 分钟），然后 **Ctrl+Shift+R 硬刷新页面**。

停用：删掉这一段，或给它加 `disabled: true`，约 1 分钟还原，不用重启。

> 不建议用 `dsh plugin add` 装配：它会重链接 `node_modules`，在 Windows 上可能让运行中的进程崩掉（原生模块已被加载，无法替换）。按路径 insert 更稳。

## 调参

运行时改，刷新页面即生效，不用重载插件：

```js
// 控制台
__DSH_AUTOLOAD_TUNING__ = {
  thresholdPx: 140,        // 接近顶部的距离（px）
  minUpScrollPx: 48,       // 慢速档需要累计的上滑距离
  cooldownMs: 900,         // 慢速档两次触发的最小间隔
  fastWheelPxPerSec: 900,  // 快速档速度门槛
  fastBurstScreens: 1,     // 或：一个采样窗口内滑过几屏
  fastZoneScreens: 3,      // 快速档提前几屏开始预取
  fastSampleMs: 160,       // 速度采样窗口
  fastGapMs: 150,          // 快速档重入间隔
  fastMaxRun: 8,           // 一次甩动最多预取几页
  fastRunResetMs: 2000,    // 静默多久后计数清零
};

__DSH_AUTOLOAD_TUNING__ = null; // 恢复默认
```

嫌太敏感：把 `fastWheelPxPerSec` 提到 1500，或 `fastZoneScreens` 降到 2。

## 工作原理

- 滚动容器靠 `[data-chat-flow]` 这个稳定属性定位（不用 CSS module 的哈希类名，那些随构建变）。
- 「加载更早」是历史列里渲染的第一个 `button`，插件只认这个位置 + 文案 `加载更早 / Load earlier`。
- 触发方式是对该按钮调 `click()` —— 和真人点击走完全一样的代码路径。
- 按钮处于 `disabled` 或文案变成「加载中」时一律不点，所以不会重入。

插件不持有数据、不暴露 API。按钮消失或禁用时，所有触发都是空操作。

## 已知限制

- **只改触发，不改渲染。** 一次翻页仍然是 500 行全量挂载，主线程 300–630 ms 的顿挫依旧存在，只是被滚动的惯性盖住了。真正的渲染窗口化见上游讨论 [#7579](https://github.com/deepseek-ai/deepseek-harness/discussions/7579)。
- 页面向上接近顶部前，未驻留的历史不占内存（只驻留尾部窗口）；载入后不会自动卸载。
- 依赖 DOM 结构 `[data-chat-flow]` 和按钮文案，官方改这两样会失效。
- 仅在 Firefox（159）上实测校准过；Chromium 走像素模式，速度归一化已处理，但未逐档验证。

## 相关

- 上游是 Discussions 而非 Issues（仓库关闭了 Issues 入口）。
- 相关讨论：`#359`（长任务后卡死）、`#7579`（聊天折叠只隐藏不卸载，渲染窗口化方案已有实现）、`#3726`（单页十几 MB 导致历史拉取超时）、`#6200`（分页未完成时过程折叠被禁用）。

## License

MIT
