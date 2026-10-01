# Admin / Account 列表页尺寸规格

Admin（用户列表）和 Account（账户列表）共用同一套组件，所以下面的尺寸两个页面都一样；只有个别列不同，已在文中标出。

- 数值来自代码，并在浏览器里实测核对过（视口 1115×914）。
- 高度带小数的（如 35.5px）是浏览器实际渲染出来的结果：字号 × 行高 1.5 + 上下内边距 + 边框。
- 每一项都标了所在文件，方便直接去改。

---

## 0. 全局基准

| 项目 | 值 | 说明 |
|---|---|---|
| 字体 | `Geist Variable` | `index.css` 的 `--font-sans` |
| 默认行高 | 1.5 倍字号 | 13px 字 → 19.5px 行高，11px 字 → 16.5px |
| 间距单位 | 1 = 4px | Tailwind 默认：`px-4` = 16px，`py-2` = 8px，`gap-2.5` = 10px |
| 圆角基准 | `--radius: 10px` | **本项目改过圆角比例，和 Tailwind 默认不同** |

本项目的圆角对照（`index.css`）：

| 类名 | 实际圆角 |
|---|---|
| `rounded-sm` | 6px |
| `rounded-md` | 8px |
| `rounded-lg` | 10px |
| `rounded-xl` | 14px |
| `rounded-full` | 胶囊形 |

> 小屏幕（高度 ≤ 720px）会触发 `short:` 样式，部分内边距会收紧，下文用"小屏"标出。

---

## 1. 页面外框

文件：`src/pages/admin/AdminPage.jsx`、`src/pages/account/AccountPage.jsx`

| 项目 | 值 |
|---|---|
| 页面内边距 | `clamp(10px, 2dvh, 16px)`，随屏幕高度在 10–16px 之间变化 |
| 工具栏与表格的间距 | `clamp(8px, 1.5dvh, 12px)` |
| 最小高度 | 520px |

---

## 2. 顶部工具栏卡片

文件：`src/components/shared/list/ListToolbar.jsx`

| 项目 | 值 |
|---|---|
| 卡片圆角 | 14px（`rounded-xl`） |
| 卡片边框 | 1px `#e5e7eb` |
| 卡片阴影 | `0 2px 8px rgba(15,23,42,0.08)` |

### 2.1 第一行（按钮、搜索框、筛选标签）

| 项目 | 值 |
|---|---|
| 内边距 | 上下 10px、左右 16px（小屏上下 8px） |
| 元素间距 | 10px |
| 底部分隔线 | 1px `#e5e7eb` |
| 右侧按钮组 | 靠右对齐，按钮之间 10px |

### 2.2 按钮（Add User / Add Account / Currency Setting / Delete）

三种按钮的尺寸完全一样，只有颜色不同。

| 项目 | 值 |
|---|---|
| 高度 | 35.5px（内边距 8px + 行高 19.5px） |
| 内边距 | 上下 8px、左右 16px |
| 圆角 | 10px |
| 字号 / 粗细 | 13px / 700 |
| 图标 | 16×16px，图标与文字间距 6px |
| 宽度（实测） | Add Account 136px、Currency Setting 161.5px、Delete (0) 116.5px（宽度随文字变） |

| 按钮 | 背景 | 阴影 |
|---|---|---|
| 主按钮（Add User / Add Account） | 渐变 `#63c4ff → #0d60ff` | `0 6px 14px -6px rgba(13,96,255,0.6)` |
| 次按钮（Currency Setting） | 渐变 `#94a3b8 → #64748b` | `0 6px 14px -6px rgba(71,85,105,0.6)` |
| 删除（有勾选时） | 渐变 `#ff8a8a → #ef4444` | `0 6px 14px -6px rgba(239,68,68,0.6)` |
| 删除（没有勾选时） | 纯色 `#cbd5e1` | 无 |
| 不可用状态 | 透明度 60% | — |

### 2.3 搜索框

| 项目 | 值 |
|---|---|
| 高度 | 36px |
| 宽度 | 自适应，最小 180px、最大 260px |
| 圆角 | 10px |
| 边框 | 1px `#e5e7eb`，聚焦时 `#3b82f6` |
| 左右内边距 | 12px |
| 放大镜图标 | 16×16px，颜色 `#9ca3af`，与文字间距 8px |
| 字号 | 13px |
| 阴影 | `0 1px 3px rgba(15,23,42,0.05)` |

### 2.4 筛选标签（Show All / Show Active / Show Inactive）

文件：`src/components/shared/list/FilterChip.jsx`

| 项目 | 值 |
|---|---|
| 高度 | 29.5px |
| 内边距 | 上下 4px、左 4px、右 12px |
| 形状 | 胶囊形（`rounded-full`） |
| 字号 / 粗细 | 13px / 500 |
| 圆点 | 18×18px 圆形，点与文字间距 8px |
| 勾选图标 | 11×11px，线宽 3.5 |
| 标签之间 | 8px |

| 状态 | 边框 | 文字 | 圆点 |
|---|---|---|---|
| 未选 | `#e5e7eb` | `#475569` | `#e2e8f0` |
| 已选 | `rgba(13,96,255,0.45)` | `#0d60ff` | 渐变 `#63c4ff → #0d60ff` + 白色勾 |

### 2.5 第二行（Group ID / Company 筛选）

| 项目 | 值 |
|---|---|
| 内边距 | 上下 10px、左右 16px（小屏上下 8px） |
| 两行之间 | 8px（小屏 6px） |
| 左侧标签（Group ID: / Company:） | 宽 84px，13px / 700，颜色 `#1f2937` |
| 标签与按钮组间距 | 8px |

### 2.6 分段按钮（AP / IG / C168…）

文件：`src/components/shared/SegmentGroup.jsx`（Dashboard 也用同一个）

| 项目 | 值 |
|---|---|
| 外框高度 | 32.8px |
| 外框圆角 | 10px |
| 外框边框 | 1px `#e5e7eb` |
| 单个按钮高度 | 30.8px |
| 单个按钮内边距 | 上下 6px、左右 16px |
| 字号 / 粗细 | 12.5px / 600 |
| 按钮之间 | 1px 竖线 `#e5e7eb` |
| 选中 | 渐变 `#63c4ff → #0d60ff`，白字 |
| 未选 | 白底，文字 `#1f2937`，悬停 `slate-50` |

---

## 3. 表格卡片

文件：`src/components/shared/list/DataTable.jsx`

| 项目 | 值 |
|---|---|
| 卡片圆角 | 14px（`rounded-xl`） |
| 卡片边框 | 1px `#e5e7eb` |
| 卡片阴影 | `0 1px 3px rgba(15,23,42,0.06)` |
| 表格最小宽度 | 980px（窗口更窄时表格内部横向滚动） |
| 加载中 | 整张卡片透明度 60% |

### 3.1 表头

| 项目 | 值 |
|---|---|
| 高度 | 41.5px |
| 背景 | 渐变 `#60c1fe → #0f61ff`（从上到下） |
| 内边距 | 上下 10px、右 12px；第一列左 16px |
| 字号 / 粗细 | 13px / 700，白色 |
| 排序箭头 | ▲▼ 字号 8px、行高 5px，和标题间距 4px；当前排序列不透明，其余列 55% 透明度 |
| 勾选框列 | 宽 44px、右内边距 16px，勾选框 16×16px |
| 滚动时 | 表头固定在顶部 |

### 3.2 数据行

| 项目 | 值 |
|---|---|
| 行高 | **最小 38px**，会自动拉高以刚好铺满表格（见下方说明） |
| 单元格内边距 | 上下 0、右 12px；第一列左 16px；勾选框列右 16px |
| 行分隔线 | 1px `#eef2f7`（整页铺满时最后一行不显示） |
| 字号 / 粗细 | 13px / 400，行高 19.5px |
| 默认文字颜色 | `#111827` |

> **行高规则**（`src/components/shared/list/useListView.js`）
> 一页行数 = (表格可用高度 − 表头高度) ÷ 38，向下取整。
> 实际行高 = (表格可用高度 − 表头高度) ÷ 行数，保证最后一行刚好贴住底部。
> 所以 38px 是最小值，实际通常是 38–40px。点了 Show All 不分页时固定 38px。

| 行状态 | 背景 |
|---|---|
| 单数行（第 1、3、5…） | 渐变 `#d6ebff → #f0f8ff`（从左到右） |
| 双数行（第 2、4、6…） | 白色 |
| 鼠标悬停 | 渐变 `#9fd0ff → #d3eaff`（从左到右，条纹深一档） |
| 已勾选 | 纯色 `#c2dcff` |

### 3.3 各列内容

| 列 | 页面 | 宽度 | 字体 / 颜色 |
|---|---|---|---|
| No | 两页 | 固定 56px | 13px / 400，`#6b7280`，等宽数字 |
| Login ID | Admin | 自动 | 13px / 600，不换行 |
| Account | Account | 自动 | 13px / 600，不换行 |
| Name | 两页 | 自动 | 13px / 400，不换行 |
| Email | Admin | 自动 | 13px / 400，`#374151` |
| Role | 两页 | 自动 | 角色标签（见 3.4） |
| Alert | Account | 自动 | 开关（见 3.5） |
| Status | 两页 | 自动 | 状态标签（见 3.4） |
| Last Login | 两页 | 自动 | 13px / 400，只显示日期，悬停显示时间（见 3.6） |
| Last Logout | 两页 | 自动 | 同上，颜色 `#374151` |
| Created By | Admin | 自动 | 13px / 400，不换行 |
| Remark | Account | 最大 220px，超出显示省略号 | 13px / 400，`#374151` |
| Action | 两页 | 自动，居中 | 图标按钮（见 3.7） |
| 勾选框 | 两页 | 固定 44px | 16×16px |

> "自动"表示由浏览器根据内容分配宽度，窗口宽度不同时会变化。
> 实测（Account，1115px 宽）：No 56、Account 105、Name 82、Role 109、Alert 78、Status 96、Last Login 122、Last Logout 135、Remark 99、Action 92、勾选框 44。

### 3.4 Role 标签 / Status 标签

文件：`src/components/shared/list/cells.jsx`（`Badge`、`StatusBadge`）

| 项目 | 值 |
|---|---|
| 高度 | 22.5px |
| 内边距 | 上下 2px、左右 8px |
| 圆角 | 8px（`rounded-md`） |
| 边框 | 1px（颜色跟随角色） |
| 字号 / 粗细 | 11px / 700，全大写，字距 0.025em |
| 宽度 | 随文字变（实测 MEMBER 68.4px、ACTIVE 59.1px） |

Status 颜色（`src/components/shared/list/listFormat.js`）：

| 状态 | 背景 | 文字 | 边框 |
|---|---|---|---|
| ACTIVE | `#dcfce7` | `#15803d` | `#bbf7d0` |
| INACTIVE | `#fee2e2` | `#b91c1c` | `#fecaca` |

Status 可点击时，悬停透明度 80%；处理中透明度 50%。

Role 颜色：
- Admin：`src/pages/admin/userListRules.js` 的 `ROLE_BADGE`
- Account：`src/pages/account/accountRules.js` 的 `ROLE_BADGE`

### 3.5 Alert 开关（只有 Account）

文件：`src/pages/account/AccountPage.jsx`（`AlertPill`），渐变在 `src/index.css`

| 项目 | 值 |
|---|---|
| 尺寸 | 46 × 22px |
| 圆角 | 8px（`rounded-md`，和 Role / Status 标签一致） |
| 文字 | 9.5px / 700，字距 0.3px，白色 |
| 文字位置 | OFF 靠右（右内边距 7px）；ON 靠左（左内边距 8px） |
| 滑块 | 16 × 16px，圆角 4px，距上边 3px、距左（OFF）/右（ON）边 3px |
| 滑块颜色 | 渐变 `#ffffff → #f1f5f9` |

| 状态 | 背景 | 内描边 | 外投影 |
|---|---|---|---|
| OFF | 上半截白色高光 + 渐变 `#ff7b7b → #e53e3e` | `rgba(185,28,28,0.25)` | `0 4px 10px -4px rgba(229,62,62,0.6)` |
| ON | 上半截白色高光 + 渐变 `#34d399 → #059669` | `rgba(4,120,87,0.25)` | `0 4px 10px -4px rgba(5,150,105,0.6)` |

### 3.6 时间提示框（悬停在 Last Login / Last Logout 日期上）

文件：`src/components/shared/list/cells.jsx`（`DateText`）

| 项目 | 值 |
|---|---|
| 出现延迟 | 150ms |
| 位置 | 日期上方，间距 6px；上方放不下时自动翻到下方 |
| 圆角 | 10px |
| 边框 | 1px `#bcd9fb` |
| 背景 | 白色 |
| 内边距 | 上下 6px、左右 10px |
| 字号 / 粗细 | 12px / 600，颜色 `#14336b`，等宽数字 |
| 时钟图标 | 14×14px，颜色 `#2f6fef`，与文字间距 6px |
| 小箭头 | 12 × 6px，白底，斜边 `#bcd9fb` |
| 阴影 | `0 8px 20px -6px rgba(20,70,160,0.35)` |
| 内容 | 只显示时间，例如 `11:38:54` |

### 3.7 Action 图标按钮

文件：`src/components/shared/list/cells.jsx`（`IconAction`）

| 项目 | 值 |
|---|---|
| 尺寸 | 28 × 28px |
| 圆角 | 10px |
| 图标 | 16 × 16px，线宽 2.1，颜色 `#2563eb` |
| 悬停 | 背景 `#e8f1ff` |
| 不可用 | 透明度 40% |
| Account 页 | 两个按钮并排：编辑 + 加号 |

### 3.8 底部栏（Showing… + 翻页）

| 项目 | 值 |
|---|---|
| 高度 | 45px |
| 内边距 | 上下 8px、左右 16px |
| 顶部分隔线 | 1px `#e5e7eb` |
| 左侧文字 | 12px / 400，颜色 `#6b7280` |
| 翻页按钮 | 28 × 28px，圆角 10px，边框 1px `#e5e7eb`，按钮间距 4px |
| 箭头图标 | 16 × 16px |
| 当前页 | 渐变 `#63c4ff → #0d60ff`，白字 700 |
| 省略号 `…` | 左右内边距 4px，颜色 `#9ca3af` |
| 显示规则 | 只有超过 1 页时才显示翻页按钮 |

---

## 4. 常用颜色速查

| 用途 | 色值 | 在代码里的名字 |
|---|---|---|
| 主要文字 | `#111827` | `text-dash-ink` |
| 次要文字 | `#6b7280` | `text-dash-sub` |
| 浅灰文字 | `#9ca3af` | `text-dash-faint` |
| 分隔线 / 边框 | `#e5e7eb` | `border-dash-line` |
| 深蓝（品牌） | `#14336b` | `text-brand-navy` |
| 品牌蓝 | `#2f6fef` | `text-brand-blue` |
| 选中渐变 | `#63c4ff → #0d60ff` | `bg-seg-active` |
| 表头渐变 | `#60c1fe → #0f61ff` | `bg-brand-head` |
| 条纹行渐变 | `#d6ebff → #f0f8ff` | `bg-row-stripe` |
| 悬停行渐变 | `#9fd0ff → #d3eaff` | `bg-row-hover` |

以上色值都定义在 `src/index.css`。
