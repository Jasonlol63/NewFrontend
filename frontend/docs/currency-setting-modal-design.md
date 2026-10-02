# Account 页 · Currency Setting 弹窗设计规格

Currency Setting 管理"哪些账号持有哪个币种"：选一个币种，勾选持有它的账号；**所有币种的改动先暂存，点 Save 才弹出确认**，确认后才算保存。

外壳（背景、圆角、Header / Footer、卡片、输入框、颜色、高度/宽度分档）和 Admin / Account 的其他弹窗共用，**见 `form-modal-shared-design.md`，这里不再重复**。本文只写 Currency Setting 独有的排版和尺寸。

- 数值取自代码，并在 Chrome 预览里逐个尺寸量过（1280×560、1366×610、1440×760、1536×730、1600×800、1920×950、1100×600、1024×700、820×1000、600×900、375×812、320×640）：页面没有整页滚动，弹窗内容没有被盖住。
- 目前只做了 UI：账号用列表接口的数据（接口为空时用 `MOCK_ACCOUNTS` 占位），币种和持有关系是占位数据，Save 只是把结果交给 `onSave` 并关闭弹窗，没有调接口。
- 文中的"内容区宽度"指 `@container/main`（屏幕宽 − 侧边栏），不是屏幕宽。

| 文件 | 内容 |
|---|---|
| `src/pages/account/AccountPage.jsx` | 入口：工具栏 **Currency Setting** 按钮（只读账号时灰掉）；控制弹窗开关 |
| `src/pages/account/CurrencySettingModal.jsx` | 弹窗本体：Add Currency、Currency、Account 三张卡片；币种管理 `CurrencyManager`；Account 搜索 / 筛选 `AccountFilters` |
| `src/pages/account/CurrencyChangesDialog.jsx` | 点 Save 后的"确认改动"弹窗 |
| `src/pages/account/currencySettingRules.js` | 规则（纯函数，无界面）：持有状态、生成改动列表、筛选、占位数据 |
| `src/components/shared/form-modal/*`、`DeleteDialog.jsx` | 共用外壳和删除确认弹窗 |

---

## 1. 整体布局

```
≥ 900px：两栏
┌ Add Currency ──────┐ ┌ Account [MYR]  [搜索][筛选]  12 hold MYR [Select All] ┐
├ Currency ──────────┤ │ 图例：Holds / Will be removed / Newly added             │
│ 币种方块网格        │ │ 账号方块网格（卡片内滚动）                               │
└────────────────────┘ └─────────────────────────────────────────────────────────┘

< 900px：单栏，整个弹窗上下滚动
Add Currency → Currency → Account
```

| 档位 | `bodyClassName` | 栏宽 |
|---|---|---|
| ≥ 900 | `grid-cols-[clamp(290px,24vw,340px)_minmax(0,1fr)]` | 左栏 290–340px，右栏吃剩余 |
| < 900 | `@max-[899px]/main:flex flex-col overflow-y-auto` | 单栏，`order` 1 / 2 / 3 |

- 左栏外层 `div` 在 < 900 时用 `contents` 拆开，两张卡片直接参与单栏排序。
- 卡片在桌面各自内部滚动；< 900 时整个 body 滚动，卡片内不再滚（`stackCard` / `stackBody`）。
- Header 图标 `Coins`，标题 "Currency Setting"。

---

## 2. Add Currency 卡片（左栏上）

- `flex-none`，永远不被压缩。
- **一行三个元素，永远在同一行**（`flex items-center gap-2`）：

| 元素 | 尺寸 |
|---|---|
| 输入框 | 撑满剩余宽度（`flex-1 min-w-0`），占位 "e.g. MYR"，只允许字母、最多 5 位、大写，回车 = Add |
| **Add** | `primaryButtonClass`，高 36px，左右内边距 12px，12.5px，`Plus` 图标 14px |
| **Delete** | 高 36px，左右内边距 12px，圆角 10px，1px 边，12.5px 粗体，`Trash2` 图标 14px；平时红字 `#dc2626` + 白底（`white/70`）+ 边 `#fecaca`；删除模式下红底 `#dc2626` 白字，文字变 "Done" |

- compact（≤760）下两个按钮高 30px；tiny（≤600）高 28px。
- 因为左栏最窄 290px，三个元素放得下，所以不换行、不出滚动条。

---

## 3. Currency 卡片（左栏下）

- `flex-1`，吃掉左栏剩余高度；币种多时**只在卡片内部滚动**（不会撑出弹窗）。
- 标题右侧 `CardCount`："{N} added"。
- **没有说明小字**：Currency 下方不放提示文字；改动用币种方块上的小圆点表示。

### 3.1 币种方块

| 项目 | 值 |
|---|---|
| 网格 | `auto-fill minmax(72px, 1fr)`，间距 7px |
| 方块 | 高 36px，圆角 10px，1px 边，左右内边距 6px，13px 粗体，居中；compact 高 32px，tiny 高 30px |
| 内容 | 币种代码（13px，`#14336b`）+ 持有账号数（11px，粗体，`#6b86b3`） |
| 方块宽度 | 同一行等宽（`1fr`），不会因为有没有改动而长短不一 |
| 选中（当前编辑的币种） | `bg-row-stripe`，边框 `#7fb2ff` + 内圈 1px `#7fb2ff` + 阴影 `0 4px 10px -6px rgba(20,90,220,0.5)` |
| 未选 | `bg-modal-off`，边框 `border-modal-off-line`，hover 边框 `#93c5fd`、底 `white/85` |
| **有未保存改动** | 方块右上角一个 11px 琥珀色圆点（`#f59e0b`，2px 白边，阴影 `0 1px 3px rgba(180,83,9,0.4)`），位置 `-4px / -4px`；鼠标悬停提示 "Unsaved changes" |

### 3.2 删除模式

- 点 Add 旁边的 **Delete** 进入，按钮变 "Done"。
- 币种方块变红（边 `#fecaca`、底白、字 `#b91c1c`，hover 边 `#f87171` 底 `#fef2f2`），数量换成 12px 的红色 × （`#ef4444`），圆点隐藏。
- 点某个币种 → 弹出共用 **DeleteDialog**（noun = currency）→ 确认后才从列表和暂存数据里移除；如果删的是当前币种，自动切到列表第一个。
- 目前删币种是本地立即生效，**不进入暂存、不进入确认弹窗**。

---

## 4. Account 卡片（右栏）

### 4.1 标题行

| 位置 | 内容 |
|---|---|
| 标题 | "Account" + 当前币种小标签（高 22px，胶囊形，渐变底 `bg-brand-sweep`，白字 11.5px 粗体，字距 0.3px，阴影 `0 4px 10px -4px rgba(20,90,220,0.6)`；内容区 < 360px 时隐藏） |
| 右侧（从左到右） | 搜索框、筛选框、数量 "{N} hold {币种}"（`CardCount`，内容区 < 420px 时隐藏）、**Select All / Clear All** 按钮 |

- **Select All 按钮**：`primaryButtonClass`，高 32px，左右内边距 16px，12.5px；compact 高 28px，tiny 高 26px。作用对象是**当前筛选/搜索出来的账号**：全部已持有时显示 "Clear All"（清空），否则 "Select All"（全选）。没有账号可选时灰掉。

### 4.2 搜索框 + 筛选框（跟着内容区宽度换位置）

| 内容区宽度 | 位置 |
|---|---|
| **≥ 980px** | 放在标题行右侧、数量前面（`mr-1`，右对齐的一组） |
| **< 980px** | 退回标题行下面**单独一行**（`px 14 / py 8`，compact `px 12 / py 6`，≤ 599 `px 10`），底部 1px 分割线，可换行 |

| 控件 | 尺寸 |
|---|---|
| 搜索框 | 圆角胶囊（`rounded-full`），左侧搜索图标 14px（`left 10px`，输入框 `pl-8`）；占位 "Account or Name"。同一行时宽 220px（compact 200px），最窄收到 150px（`shrink`）；单独一行时 `flex-[1_1_200px]`，最小 120px，最大 300px（≤ 599 不限最大） |
| 筛选框 | `SelectField`，宽 124px（`flex-none`），选项：All / Selected / Changed / Unselected |

- 搜索匹配账号编号或名字（不区分大小写）。
- 筛选语义：Selected = 当前持有（含新加的）；Unselected = 当前不持有（含将被移除的）；Changed = 将被移除或新加的。

### 4.3 内容区

- 内容区自己滚动（`overflow-y-auto`，细滚动条）。内边距 12px（compact 10px，tiny 8px）。
- **图例**（网格上方）：11.5px，`text-dash-sub`，间距 14px × 4px，下边距 10px（compact 8px）。三个 10×10 小方块：Holds（蓝边）、Will be removed（红色虚线边）、Newly added（绿边）。

### 4.4 账号方块

| 项目 | 值 |
|---|---|
| 网格 | `auto-fill minmax(clamp(112px, 9vw, 140px), 1fr)`；内容区 ≤ 599px 时 `minmax(104px, 1fr)` |
| 间距 | 10px（compact 8px） |
| 方块 | 高 54px（compact 48px，tiny 42px），圆角 12px，左右内边距 12px，内容竖直居中，行间距 2px |
| 第一行 | 账号编号，13.5px，粗细 800，单行截断 |
| 第二行 | 账号名字，10.5px，粗体，大写，单行截断 |
| 没有匹配 | 居中文字 "No account matches."（13px，`dash-faint`，内边距 24px） |

四种状态（持有关系与保存值的对比）：

| 状态 | 含义 | 样式 |
|---|---|---|
| `on` 已持有 | 保存时就持有，现在仍持有 | `bg-row-stripe`，边框 `#7fb2ff` + 内圈 1px；编号 `#14336b`，名字 `#4a6aa5` |
| `new` 新加 | 保存时不持有，现在勾上了 | 底 `#ecfdf5`，边 `#34d399` + 内圈 1px；编号 `#065f46`，名字 `#059669`；右上角标签 "NEW"（`#d1fae5` 底 / `#047857` 字） |
| `rm` 将被移除 | 保存时持有，现在取消了 | 1.5px **虚线**边 `#f87171`，底 `#fff5f5`；编号 `#b91c1c` 并**加删除线**（1.5px），名字 `#d57a7a`；右上角标签 "REMOVE"（`#fee2e2` 底 / `#b91c1c` 字） |
| `off` 未持有 | 都不持有 | `bg-modal-off`，边框 `border-modal-off-line`，字 `#374151` / `#7b8794`；hover 边框 `#93c5fd`、底 `white/80` |

- 角标：高 15px，胶囊形，左右内边距 5px，9px 粗体大写，字距 0.4px，位置 `right 7px / top 6px`。
- 点击方块 = 切换当前币种下这个账号的持有；**改动在所有币种之间都保留**，切到别的币种再回来不会丢。

---

## 5. Footer 的 Save

- Save 是**唯一的保存入口**，没有额外的 Review 按钮或"x removed…"的提示条。
- 没有改动时灰掉（`saveDisabled`）。
- 有改动时按钮上多一个数量徽章：`h-5 min-w-5` 圆形，`bg-white/25`，11.5px 粗体，位置在文字右边（例如 "Save" 后面跟一个圆形的 5）。数量 = 所有币种里的改动总数（取消 + 新加）。
- 点击 Save → 打开"确认改动"弹窗。

---

## 6. 确认改动弹窗（`CurrencyChangesDialog`）

点 Save 后弹出，列出所有币种的改动，确认后才保存。是 Radix `Dialog`，遮罩和进场动画同 `DeleteDialog`（见共用文档）。

### 6.1 弹窗本体

| 项目 | 值 |
|---|---|
| 位置 / 层级 | 居中，z-50，盖在 Currency Setting 之上 |
| 宽 | `clamp(340px, 54vw, 740px)`，最大 `100vw − 32px` |
| 最大高 | `100dvh − 32px` |
| 圆角 / 底色 | 20px，白色，阴影同 DeleteDialog |
| 内边距 | 左右 `clamp(16px, 1.6vw, 24px)`，上 `clamp(16px, 2.6dvh, 24px)`，下 `clamp(14px, 2.2dvh, 20px)` |
| **大小固定** | 币种多、账号多时**弹窗不变大**，只有左侧币种列表和右侧账号网格各自滚动 |

### 6.2 顶部

- 左：**警告图标**（38px 圆形，底 `#fff4e0`，三角形 `#d97706`，外圈 `0 0 0 6px #fffaf0`）。动画：弹出（`status-pop`）、三角形线条描绘、感叹号竖线接着画、圆点淡入、一圈涟漪、之后柔光呼吸；减少动画时全部关闭。
- 标题 "Confirm changes"：`clamp(16px, 2.3dvh, 18px)`，粗体，`#14336b`。
- 右：汇总胶囊（高 24px，12px 粗体）：`N removed`（`#fee2e2` / `#b91c1c`）、`N added`（`#d1fae5` / `#047857`）、`N currencies`（`#eef3fb` / `#475569`）。数字随撤销实时变化，为 0 的不显示。
- **没有说明文字**（不再有 "These accounts…"）。

### 6.3 主体（固定高度）

- 高 `min(360px, 46dvh)`；宽度 ≤ 640px 时 `min(380px, 56dvh)`。
- 两栏：左 `clamp(120px, 24%, 170px)` 币种列表，右 1fr 账号面板，间距 12px。宽度 ≤ 640px 时变成**上下**两段：币种列表变成横向可滑的一行标签，下面是账号面板。

**左：币种列表**

- 每个币种一行：高 38px，圆角 10px，13px 粗体，右边 "−N"（`#b91c1c`）/ "+N"（`#047857`）11px 粗体。选中：`bg-row-stripe` + 边框 `#7fb2ff`；未选 hover `#f1f6fd`。
- 该币种的改动全部被撤销后，整行变淡（`opacity 45%`）。

**右：账号面板**（圆角 14px，1px 边 `#e6edf8`，底 `#fafcff`）

- 面板头（内边距 10px × 8px，下边线 `#e6edf8`）：
  - 分段切换（`#eef3fb` 底，内边距 2px，圆角 10px）：**Removed N / Added N**，按钮高 26px，12px 粗体；选中是白底 + 阴影，文字红（Removed）或绿（Added）。该币种只有一种改动时只显示一个、不可切换。
  - 提示 "Click an account to undo"：11.5px，`dash-faint`，**浏览器窗口宽度 ≥ 821px 才显示**。
  - **Undo all / Redo all**：高 28px，圆角 8px，1px 边 `#dbe5f3`，白底，12px 粗体；全部撤销后变成 Redo all。
- 账号网格：`auto-fill minmax(128px, 1fr)`，间距 8px，内边距 10px，内部滚动。
- **账号方块**：高 46px，圆角 10px，左 11px / 右 32px 内边距；第一行编号 13px 粗体，第二行名字 10.5px 粗体大写；右侧 20×20 的撤销图标（圆角 6px，白底半透明）。
  - Removed：底 `#fff5f5`，边 `#fecaca`，字 `#b91c1c`。
  - Added：底 `#ecfdf5`，边 `#a7f3d0`，字 `#047857`。
  - **已撤销**：灰色虚线（底 `#f4f6f9`，边 `#e1e7ef`，字 `#94a3b8`），编号加删除线，图标变"重做"。
- **点方块 = 撤销，再点一次 = 重做**，整块都是点击区域，误点也能立刻还原。

### 6.4 底部按钮

| 按钮 | 样式 |
|---|---|
| **Back to edit**（`Dialog.Close`） | 白底，边 `#dbe5f3`，圆角 12px，14px 粗体 600，`#14336b`；高 `clamp(36px, 5dvh, 42px)`，各占一半，间距 10px |
| **Confirm & Save (N)** | `#e5484d`，白字，阴影 `0 6px 14px -6px rgba(229,72,77,0.6)`；N = 撤销后剩下的改动数；全部撤销后变灰（`opacity 50%`），文字变 "Nothing to save" |

- **Back to edit / Esc / 点遮罩**：在弹窗里撤销过的账号会还原到页面上（回到保存时的状态），其余改动保留。
- **Confirm & Save**：撤销的先还原，再把剩下的改动作为新的"已保存"状态，关闭确认弹窗并调用 `onSave`（当前就是关闭 Currency Setting）。

---

## 7. 规则文件（`currencySettingRules.js`）

| 导出 | 作用 |
|---|---|
| `INITIAL_CURRENCIES` | 占位币种（取自 `MOCK_CURRENCIES`，10 个） |
| `MOCK_ACCOUNTS` | 接口没数据时的占位账号（41 个） |
| `mockHoldings(accounts, currencies)` | 占位持有关系：MYR 持有前 12 个账号，其他币种按规律分布 |
| `holdState(orig, draft, currency, accountId)` | 返回 `on` / `new` / `rm` / `off` |
| `buildChanges(accounts, orig, draft, currencies)` | 生成改动列表 `[{ currency, removed: [...], added: [...] }]`，只含有改动的币种，账号按列表顺序 |
| `countChanges(changes)` | 改动总数（取消 + 新加） |
| `FILTER_OPTIONS` / `visibleAccounts(...)` | 筛选选项和搜索 + 筛选的实现 |

接入接口时：把 `orig` 的初始值换成接口返回的持有关系，`onSave` 里提交 `{ currencies, holdings }`（`holdings` 是 `{币种: [账号编号]}`）。

---

## 8. 改尺寸时去哪里找

| 想改 | 去哪里 |
|---|---|
| 左右栏宽（290–340px）、两栏 / 单栏断点（900） | `CurrencySettingModal.jsx` 的 `bodyClassName` |
| Add / Delete 按钮大小 | `CurrencyManager` 里 Add Currency 卡片那一行 |
| 币种方块大小、列宽、小圆点 | `CurrencyManager` 里 `grid-cols-[repeat(auto-fill,minmax(72px,1fr))]` 和方块 `className` |
| 搜索框 / 筛选框宽度、位置（980 断点） | `AccountFilters` 和 Account 卡片 `right`、标题下那一行 |
| 账号方块大小、列宽、四种状态颜色 | Account 卡片内容区的 `grid-cols-[repeat(auto-fill,minmax(clamp(112px,9vw,140px),1fr))]` 和 `TILE_STATE` |
| Select All 按钮 | Account 卡片 `right` 里的 `button` |
| Save 数量徽章 | `CurrencySettingModal.jsx` 的 `saveLabel` |
| 确认弹窗的宽高、主体高度（360px / 46dvh） | `CurrencyChangesDialog.jsx` 的 `Dialog.Content` 和主体 `grid` |
| 确认弹窗里账号方块、撤销样式 | `CurrencyChangesDialog.jsx` 的 `pillClass` 和按钮 `className` |
| 警告图标动画 | `CurrencyChangesDialog.jsx` 的 `WarningIcon`；动画定义在 `index.css` |
| 外壳、颜色、输入框尺寸 | 见 `form-modal-shared-design.md` |
