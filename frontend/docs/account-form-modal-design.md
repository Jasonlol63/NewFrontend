# Account 页 · Add / Edit Account 弹窗设计规格

Add Account 和 Edit Account 是**同一个弹窗**（`AccountFormModal.jsx`），只有标题、图标、初始值和 Password 提示不同。

外壳（背景、圆角、Header / Footer、卡片、输入框、颜色、高度/宽度分档）和 Admin 的 Add User 完全共用，**见 `form-modal-shared-design.md`，这里不再重复**。本文只写 Account 弹窗独有的排版和尺寸。

- 数值取自代码；目前只做了 UI：币种用的是占位数据（`MOCK_CURRENCIES`），Save 只是把填好的数据交给 `onSave` 并关闭弹窗，没有调接口。
- 文中的"内容区宽度"指 `@container/main`（屏幕宽 − 侧边栏），不是屏幕宽。

| 文件 | 内容 |
|---|---|
| `src/pages/account/AccountPage.jsx` | 入口：Add Account 按钮、行内编辑图标；控制弹窗开关 |
| `src/pages/account/AccountFormModal.jsx` | 弹窗本体：5 个卡片 / 区块 |
| `src/pages/account/accountFormOptions.js` | 角色选项、占位币种（10 个）、Payment Alert 的选项和日期工具 |
| `src/components/shared/form-modal/*` | 共用外壳、卡片、控件 |

---

## 1. 入口与模式

| | Add | Edit |
|---|---|---|
| 入口 | 工具栏左边 **Add Account** 主按钮（`UserPlus`，只读账号时灰掉） | 表格行 Action 列的编辑图标（只读账号时灰掉） |
| 标题 / 图标 | "Add Account" / `UserPlus` | "Edit Account" / `UserPen` |
| 初始值 | 全空；Payment Alert 关；币种只勾 MYR；Company 只勾当前公司 | 带入该行的 Account ID、Name、Role、Remark、Payment Alert 开关 |
| Password | 必填 | 选填，留空 = 保持原密码，占位文字 "Keep current" |

- 弹窗挂载即打开、卸载即关闭，所以每次打开都是初始状态。

---

## 2. 整体布局（按内容区宽度）

```
≥ 1210px（约 1440+ 屏幕）：三栏等宽
┌ Account Information ┐ ┌ Currency ┐ ┌ Company（独立卡片） ┐
│ Payment Alert       │ │          │ │                     │
└─────────────────────┘ └──────────┘ └─────────────────────┘

900 – 1209px：两栏，左栏更宽
┌ Account Information ┐ ┌ Currency          ┐
│ Payment Alert       │ │ Company（小方块） │
└─────────────────────┘ └───────────────────┘

< 900px（竖屏平板、手机）：单栏，整个弹窗上下滚动
Account Information → Payment Alert → Currency → Company（小方块）
```

| 档位 | `bodyClassName` 里的写法 | 栏宽 |
|---|---|---|
| ≥ 1210 | `@min-[1210px]/main:grid-cols-3` | 3 等分 |
| 900–1209 | 默认 `grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]` | 左 1.3 : 右 1 |
| < 900 | `@max-[899px]/main:flex flex-col overflow-y-auto` | 单栏，卡片 `order` 依次为 1、2、3、4 |

- 左栏、中栏的外层 `div` 在 < 900 时用 `contents` 拆开，卡片直接参与单栏排序。
- 卡片在桌面有各自的内部滚动；< 900 时整个 body 滚动，卡片内不再滚（`stackCard` / `stackBody`）。

---

## 3. Account Information 卡片

- `flex-none`：**永远不被压缩**，保证字段不会躲到滚动里；下面的 Payment Alert 吃剩余高度。
- 表单网格：

| 项目 | 默认（900–1209） | ≥ 1210 | compact（≤760） | tiny（≤600） |
|---|---|---|---|---|
| 列数 | 3 列 | 2 列 | 同上 | 同上 |
| 列间距 / 行间距 | 12px / 10px | 同 | 10px / 6px | 8px / 4px |

- 字段顺序与列：

| 字段 | 3 列时 | 2 列时 | 说明 |
|---|---|---|---|
| Account ID | 第 1 列 | 第 1 列 | 大写显示（`uppercase`），`autoComplete=off` |
| Name | 第 2 列 | 第 2 列 | 大写显示 |
| Role | 第 3 列 | 第 1 列（第二行） | 下拉，选项来自 `ROLE_PRIORITY`（CAPITAL … DEBTOR 共 12 项） |
| Password | 第 1 列（第二行） | 第 2 列（第二行） | 带眼睛图标；Edit 时选填 |
| Remark | 跨 2 列（第二行） | 跨整行 | 选填 |

---

## 4. Payment Alert 卡片

- 标题行右侧是 On / Off 开关（粗体）。
- 卡片 `min-h-[140px] flex-1`，吃掉左栏剩余高度；内容区下内边距 10px（compact 8px，tiny 6px）。
- 在 900px 以上且高度 < 880px（`modal-cozy`）时，内容区变成纵向 flex，日期格子可以撑满剩余空间。

### 4.1 关闭状态

- 一个虚线框填满内容区：`rounded-xl`，1px 虚线 `border-modal-off-line`，内边距 10px，最小高 80px，文字居中 12.5px `#8a96a8`："Payment alert is off. Switch it on to set how often to remind, from when, and the amount."

### 4.2 打开状态：三块内容，顺序固定

1. **Start Date + Alert (Amount)**：2 列，列间距 14px。日期用 `DateField`，金额占位 `e.g. -5,000.00`，失焦时规范成负数并保留 2 位小数。
2. **Alert Type**：一行，左边标签 "Alert Type *"（12.5px / compact 12px / tiny 11.5px，不换行），右边分段条。上边距 10px（compact 8px，snug 5px）。
3. **Custom 的 1–31 日格**：只有选了 Custom（或当前天数不在预设里）才出现，位置在 Alert Type 下方。

- **矮屏、双栏（内容区 ≤ 1209 且高度 ≤ 700）**：Start Date、Amount、Alert Type 三个挤成一行，`grid-cols-[146px_144px_minmax(0,1fr)]`，列间距 12px，标签挪到分段条上方。目的是让 31 个日期格仍然放得下。

### 4.3 Alert Type 分段条（Weekly / 15 Days / Monthly / Custom）

- 容器：4 等分，间距 2px，圆角 10px，1px `border-modal-off-line`，底 `white/45`，内边距 2px。
- 按钮：高 26px，圆角 7px，12px 粗体，不换行截断。选中 `bg-brand-sweep` 白字 + `0 4px 10px -4px rgba(20,90,220,0.6)`；未选 `#64748b`，hover `white/60`。

| 场景 | 按钮高 |
|---|---|
| 默认 | 26px |
| 内容区 900–1099 | 24px |
| compact（≤760） | 22px |
| tiny（≤600） | 20px（文字 11.5px） |
| 矮屏双栏（short，≤1209 宽） | 24px；tiny 下 22px |

- 保存的值：Weekly = 7，15 Days = 15，Monthly = `"monthly"`，Custom = 1–31 的天数。

### 4.4 Custom 日格（`DayGrid`）

- 外框：虚线圆角 12px，`border-modal-off-line`，底 `white/30`，内边距 `pt 6 / pb 8 / px 8`，上边距 6px。标题 "Remind every … days"：12px 粗体 `#475569`，行高 15px，下边距 4px。

| 场景 | 单元格 | 排布 |
|---|---|---|
| 默认 | 30×30，圆角 7px，12.5px，间距 4px | 每行放得下几个放几个，空隙均分（`justify-between`） |
| 矮屏（short，≤700） | 同上，间距 3px | |
| 高屏（roomy，≥880） | 48×44，圆角 9px，14.5px，间距 6px；外框内边距加大 | 每行 48px 一格 |
| 900 以上且高度 < 880（cozy） | 格子拉伸填满剩余空间 | **11 列**，间距 4px，网格高在 98–164px 之间 |
| 同上且内容区 1210–1330 | | **8 列**，网格高在 132–220px 之间 |

- 选中格：边框 `#3b82f6` + 内圈 1px `#3b82f6`，`bg-row-stripe`，字 `#0d4fd6` 粗体；未选：`bg-modal-off`，边框 `border-modal-off-line`，字 `#475569`，hover 边框 `#93c5fd`。

---

## 5. Currency 卡片

- 标题右侧 `CardCount`："{N} selected"。卡片 `flex-1`。
- **第一行（输入 + 两个按钮，永远在同一行）**：
  - 输入框：撑满，最小宽 72px，只允许字母、最多 5 位、大写，回车 = Create。
  - **Create**：`primaryButtonClass`，高 36px，左右内边距 14px，12.5px，`Plus` 图标 14px。
  - **Delete**：高 36px，左右内边距 14px，圆角 10px，1px 边；平时红字 `#dc2626` 白底边 `#fecaca`，进入删除模式后变红底白字且文字变 "Done"。
  - compact 下两个按钮高 30px，tiny 28px。
- **币种方块网格**：上边距 10px（compact 8px），最大宽 700px。

| 项目 | ≥ 1210 | 900–1209 | compact 附加 |
|---|---|---|---|
| 列 | `auto-fill minmax(104px, 1fr)` | `auto-fill minmax(72px, 1fr)` | |
| 间距 | 8px | 6px | 6px |
| 方块高 | 40px | 34px | 36px（≥1210） / 32px（<1210）；tiny 32px / 30px |
| 方块 | 圆角 11px，左 14px 右 32px 内边距，13px 粗体，居左 | 居中，左右内边距 4px | |
| 勾选圆圈 | 16px，右侧 11px | **隐藏**（改用蓝色整块表示选中） | |

- 选中：`bg-row-stripe`，边框 `#7fb2ff`，字 `#14336b`（< 1210 加内圈 1px）；未选：`bg-white/60`，边框 `border-modal-off-line`，字 `#374151`，hover 边框 `#93c5fd`。
- **删除模式**：点 Delete 后，**未勾选**的币种变红（边 `#fecaca`、字 `#b91c1c`）并显示 × ；已勾选的币种变灰不可点（`opacity 45%`）。点红色币种会弹出共用的 **DeleteDialog**（noun = currency），确认后才从列表里移除。下方提示 11.5px `#b91c1c`："Click × to delete an unticked currency. Ticked currencies can't be deleted."

---

## 6. Company

| 内容区宽度 | 形态 |
|---|---|
| ≥ 1210 | **独立卡片**（第三栏）：标题 "Company *"，右侧 "{选中}/{总数} selected"；`CheckListTools` 搜索条（内边距 14px × 10px，compact 12px × 8px，底部分割线）+ 可滚动的勾选行（内边距 8px，行距 4px，`boxed`）；当前公司带 `CURRENT` 标签 |
| < 1210 | **小方块**（在 Currency 下面）：圆角 18px 卡片风格（`rounded-2xl`、`border-modal-line`、`bg-modal-card`、`shadow-modal-card`），内边距 14px × 10px（compact 12px × 9px）；左边标签 "Company *"（12.5px / compact 12px，上内边距 5px），右边一排**切换小标签** |

- 小标签：高 28px，圆角 8px，左右内边距 10px，12px 粗体，间距 5px，自动换行；选中 `bg-row-stripe` + 内圈 `#7fb2ff`，未选 `bg-modal-off`。最大高 94px 内部滚动（< 900 时不限高）。
- 公司选项来自 Account 页顶部选择的 Group 下的公司；没有选项时只显示当前公司。

---

## 7. 改尺寸时去哪里找

| 想改 | 去哪里 |
|---|---|
| 栏数、栏宽比例（1.3fr / 3 栏 / 1210 与 900 断点） | `AccountFormModal.jsx` 的 `bodyClassName` |
| Account Information 列数、间距 | `AccountInfoCard` 里 `grid grid-cols-3 ...` 那一行 |
| Payment Alert 最小高、内边距 | `PaymentAlertCard` 的 `className` / `bodyClassName` |
| Alert Type 分段条高度 | `AlertTypeBar` |
| 日期格大小、列数、高度范围 | `DayGrid` |
| 币种方块大小、列宽、勾选圆圈 | `CurrencyCard` 的 `grid-cols-[repeat(auto-fill,...` 和方块的 `className` |
| Create / Delete 按钮 | `CurrencyCard` 第一行 |
| Company 卡片 / 小方块 | `CompanyCard` / `CompanyChipsBox` |
| 外壳、颜色、输入框尺寸 | 见 `form-modal-shared-design.md` |
