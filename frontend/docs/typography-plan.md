# 字体大小与粗细规范

## 要解决的问题

1. 大屏幕字体偏小、页面显得空。
2. 字重没有层次:`font-bold` / `font-extrabold` 用得太多,`font-medium` 太少,中文在 800 下很糊。
3. 字号太碎:约 20 种写死的 px(`text-[12.5px]`、`text-[13.5px]` 等)。

## 现行体系(以 `src/index.css` 为准)

### 字号随屏幕宽度平滑放大

`html` 保持 100%。字号在 1366 以下是基准,到 2560 最多放大到 `--ts-max`(现为 1.1)倍。想让大屏更大或更小,只改 `--ts-max`。

### 正文角色 `type-*`(同时设定字号、字重、行高)

| 类 | 1366 下大小 / 字重 | 用在哪 |
|---|---|---|
| `type-page-title` | 20 / 600 | 页面标题 |
| `type-card-title` | 17 / 600 | 卡片标题 |
| `type-label` | 15 / 600 | 筛选区、表单标签 |
| `type-body` | 14 / 500 | 按钮、输入框、菜单项 |
| `type-table-head` | 14 / 600 | 表头 |
| `type-table-cell` | 13 / 500 | 表格内容、密集区域 |
| `type-caption` | 12 / 400 | 说明、小标签、状态标 |
| `type-kpi` | 28 / 600 | KPI 大数字 |

### 弹窗角色 `fm-*`

`fm-title`、`fm-section`、`fm-label`、`fm-opt`、`fm-help`、`fm-input`、`fm-btn`、`fm-btn-sm`、`fm-count`、`fm-empty`。除了随宽度放大,还会随屏幕高度变化(≤760、≤600),所以弹窗里不用再写 `modal-short:text-[…]` 去改字号。

### 字重

- 只用 400 / 500 / 600。`font-bold`、`font-extrabold`、`font-black`、`<b>`、`<strong>`、`<th>` 全局都已压成 600,新代码直接写 `font-semibold`。
- `type-*` 和 `fm-*` 自带字重。要换成别的字重,写 `font-medium!` 或 `font-semibold!`(带感叹号才能覆盖)。

### 写新代码的规则

- 不再写 `text-[12.5px]` 这类一次性字号,也不在窄屏里单独把字号写小,统一选一个角色。
- 有 `type-*` 的地方不用 `fm-*`,弹窗里用 `fm-*`。

## 中文字体

字体栈是 `Geist Variable`,然后是 `PingFang SC`、`Microsoft YaHei`、`Noto Sans SC`。微软雅黑只有 400 和 700 两档,所以 Windows 上中文的 500 和 600 会落到相邻一档。要让中文也有稳定的中间字重,需要自带 Noto Sans SC 可变字体。**待决定。**

## 进度

- 已完成:Login 相关页面（登录、二级密码、重置密码及其组件，`PillSwitch` 是共享组件未动）、Dashboard、Report、Maintenance、Auto Renew、Announcement 等大部分共享组件(列表、对话框、分段按钮等),以及 Data Capture(共用部件、表格、Bank、Game、Summary、公式弹窗,`paste/` 解析逻辑不涉及界面)。
- 其余页面按这套角色逐页迁移,遇到仍在用 `text-[…px]` 的地方就归并到上面的角色。
- 每页迁移后要在 1366×610、1536×730、1920×950 下检查:无页面滚动、无横向溢出。
- 全部完成后,把"字号只用 type-* / fm-*,字重只用 400/500/600"写进 `frontend/CLAUDE.md`。

## 参考

交互对比稿(早期方案,字号数值已被现行体系取代,只看字重和疏密):https://claude.ai/artifact/ARDb9tjzFw9DvAxaGcnFbj
