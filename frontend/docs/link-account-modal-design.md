# Account 页 · Link Account 弹窗设计规格

Account 列表每一行 Action 列的 `+` 图标打开这个弹窗，给**这一行的账号**选择要关联哪些账号，每个账号可以各自选双向或单向。

外壳（背景、圆角、Header / Footer、卡片、颜色、高度/宽度分档）和 Add / Edit Account 完全共用，**见 `form-modal-shared-design.md`，这里不再重复**。本文只写 Link Account 独有的排版和行为。后端改动见 `Count/docs/account-link-modal-backend-changes.md`。

| 文件 | 内容 |
|---|---|
| `src/pages/account/AccountPage.jsx` | 入口：行内 `+` 图标（只读账号时灰掉）；控制弹窗开关 |
| `src/pages/account/link/LinkAccountModal.jsx` | 弹窗本体：Link Type、Selected、Accounts 三张卡片 |
| `src/pages/account/link/linkAccountApi.js` | 请求：读取（`/link/manage`）、新增 / 改方向 / 取消（`/link`、`/link/pair`） |
| `src/pages/account/link/linkAccountRules.js` | 规则（纯函数）：`diffLinks`，算出 Save 要发哪些改动 |
| `src/components/shared/form-modal/*` | 共用外壳、卡片、搜索条（`CheckListTools`） |

---

## 1. 关联类型

一对账号只存一行，每个被选的账号有三种状态（弹窗里用颜色和箭头徽章区分）：

| 状态 | 含义 | 颜色 / 徽章 |
|---|---|---|
| `bi` 双向 | 两个账号互相都能看到；两边的弹窗里都勾着 | 蓝色，`↔`（`ArrowLeftRight`） |
| `uni` 单向 | 当前账号 → 对方：只有当前账号能"看到"对方 | 青绿色，`→`（`ArrowRight`） |
| `in` 对方指向我 | 对方 → 当前账号的单向链接：弹窗里显示，但不是从这里发起的 | 浅青绿色，`←`（`ArrowLeft`） |

- `in` 只能**升级成双向**（点它的方块 / 箭头按钮；保存前可以再点一次退回），**不能取消**，也不能改成别的方向，要改得回发起方的账号里操作。
- 单向链接的数据可见性规则没变（只有发起方能看到对方的数据）；`in` 只是为了让弹窗里能看到、能升级。

---

## 2. 整体布局（按内容区宽度）

```
≥ 900px：两栏，1 : 2
┌ Link Type ┐ ┌ Accounts（方块网格）┐
│           │ │                     │
├ Selected ─┤ │                     │
│           │ │                     │
└───────────┘ └─────────────────────┘

< 900px：单栏，整个弹窗上下滚动
Link Type → Accounts → Selected
```

- `bodyClassName`：`grid-cols-[minmax(0,1fr)_minmax(0,2fr)]`；< 900 用 `@max-[899px]/main:flex flex-col overflow-y-auto`，卡片 `order` 依次为 1、2、3，左栏外层 `div` 用 `contents` 拆开。
- 卡片在桌面有各自的内部滚动；< 900 时整个 body 滚动（`stackCard` / `stackBody`）。

---

## 3. Link Type 卡片

- `flex-none`，从上到下三块：
  1. **Link from**：只读框（高 36px，圆角 10px，输入框配色），左边当前账号，右边 `THIS ACCOUNT` 小标签（9.5px，`#dbeafe` 底 `#1d4ed8` 字）。
  2. **Add clicked accounts as**：两段分段条（Bidirectional / Unidirectional），样式和 Account 弹窗的 Alert Type 条一样，容器圆角 10px，按钮高 30px、圆角 7px、12px 粗体。选中的一段用自己的颜色：双向 `bg-brand-sweep`，单向青绿渐变 `#0f9d8a → #3fd1bd`。它决定**接下来点账号方块时加成什么**，不会改已选的。
  3. **示意图**：虚线圆角 12px 框，里面 `当前账号 ⟷ / → Account` 加一句说明（12px，`#475569`）。双向写"Clicked accounts are added as bidirectional: data syncs both ways."，单向写"…data flows from {当前账号} to the account."。

---

## 4. Selected 卡片

- 标题右侧 `CardCount`："{N} selected"。卡片 `flex-1`。
- 三个分组，每组一行标题（图标 + 名称 + 右侧计数）加一排小标签：**Bidirectional**、**Unidirectional**、**From other accounts**（只在这个账号有 `in` 链接时才出现）。组里没有账号时显示虚线框 "None"。
- 小标签：高 28px，圆角 8px，12px 粗体，左内边距 10px，间距 5px，自动换行，颜色同方块的选中色。标签右侧有两个小图标按钮：
  - **箭头**：切到另一组（双向 ⇄ 单向）。`in` 的箭头是"升级成双向"；原本是 `in` 又被升级的，箭头是"退回对方指向我"。
  - **×**：移除这个账号。原本是 `in` 的没有 ×。

---

## 5. Accounts 卡片

- 标题右侧：图例（蓝 Bidirectional、青绿 Unidirectional；< 600px 隐藏）+ `CardCount`："{已选}/{总数} selected"。
- 第一行：`CheckListTools`（搜索框 + Select all + Clear），和 Company 列表一样的样式；Select all 只加**还没选的**账号，用当前模式；Clear 清掉自己加的，`in` 的保留。
- **账号方块网格**：`auto-fill minmax(124px, 1fr)`（内容区 ≤ 1209 时 104px），间距 8px（compact 6px）；账号池是当前列表的账号（排除自己），按 Account ID 字母顺序。
  - 方块：高 40px（compact 36px，tiny 32px），圆角 11px，左 14px 右 40px 内边距，13px 粗体，居左。
  - 未选：`bg-white/60`，边框 `border-modal-off-line`，hover 边框 `#93c5fd`。
  - 已选：双向蓝色（同 Currency 选中）、单向青绿、`in` 浅青绿；右侧有 24×18 的圆角徽章（图标 14px）。
- 点击规则：
  - 未选 → 按当前模式加入。
  - 已选且和当前模式相同 → 取消。
  - 已选但和当前模式不同 → 改成当前模式。
  - `in` 的方块 → 无视模式，在"保持原样"和"双向"之间切换。

---

## 6. 读取与保存

- **打开时**：`GET /api/account/link/manage?account_id=&tenant_id=`，把已有链接按状态预先勾好，同时记为"初始状态"。读取中底部显示 "Loading…"，Save 灰掉。
- **Save**：`diffLinks(初始, 当前)` 算出改动，**逐条发请求**：
  - 新增 → `POST /api/account/link`（单向时 `sourceAccountId` = 当前账号）
  - 取消 → `DELETE /api/account/link/pair`
  - 改方向（含 `in` 升级成双向）→ `PUT /api/account/link`
  - 没变的不发。全部成功后关闭弹窗。
- **中途失败**：不回滚，已成功的保留（不会重发），错误信息显示在底部（红色 12.5px）。
- 底部左侧平时显示汇总，例如 "2 bidirectional · 1 unidirectional · 1 from others"。
- 只读登录：入口 `+` 图标灰掉。

---

## 7. 改尺寸时去哪里找

| 想改 | 去哪里 |
|---|---|
| 栏数、栏宽比例（1 : 2）、单栏断点（900） | `LinkAccountModal.jsx` 的 `bodyClassName` |
| 双向 / 单向 / 对方指向我 的颜色、徽章 | `LinkAccountModal.jsx` 顶部的 `TYPES` |
| Link Type 卡片（分段条、示意图） | `LinkTypeCard` |
| Selected 的分组、小标签、箭头和 × 按钮 | `SelectedCard` |
| 账号方块大小、列宽 | `AccountsCard` 里 `grid-cols-[repeat(auto-fill,...` 和方块的 `className` |
| Save 发哪些请求 | `linkAccountRules.js` 的 `diffLinks`、`linkAccountApi.js` 的 `applyLinkOp` |
| 外壳、颜色、输入框尺寸 | 见 `form-modal-shared-design.md` |
