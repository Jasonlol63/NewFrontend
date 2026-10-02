# Admin 页 · Add User 弹窗设计规格

这份文档记录 Admin 页面里 **Add User** 弹窗目前的全部设计：入口、背景遮罩、整体布局、三张卡片、每个控件的颜色、字号、圆角、阴影，以及不同屏幕宽度和高度下的变化。

- 数值都直接取自代码（下面列出的文件），**没有在浏览器里实测**。
- 目前只做了 UI：Account / Process 列表用的是占位数据，Save 只是把填好的表单通过 `onSave` 交回去，然后关闭弹窗，还没有调接口。

| 文件 | 内容 |
|---|---|
| `src/pages/admin/AdminPage.jsx` | 入口按钮、控制弹窗开关 |
| `src/pages/admin/AddUserModal.jsx` | 弹窗外壳、User Information 卡片、权限按钮、输入框 |
| `src/pages/admin/AccessListCard.jsx` | Account / Process 两张列表卡片、`Count` 计数 |
| `src/pages/admin/addUserOptions.js` | 权限列表（8 项）、Role 下拉选项 |
| `src/pages/admin/addUserMockData.js` | Account 76 条、Process 76 条占位数据 |
| `src/components/layout/MainOverlay.jsx` | 把弹窗渲染进 `#main-overlay` |
| `src/layouts/AuthenticatedLayout.jsx` | `#main-overlay` 容器所在位置 |
| `src/index.css` | 颜色 token、渐变、动画、高度分档 |

---

## 0. 全局基准

| 项目 | 值 |
|---|---|
| 字体 | `Geist Variable` |
| 间距单位 | 1 = 4px（`px-3.5` = 14px，`gap-1.5` = 6px） |
| 圆角 | 本项目改过比例：`rounded-md` 8px · `rounded-lg` 10px · `rounded-xl` 14px · `rounded-2xl` 18px |

### 颜色 / 渐变 token（`index.css`）

| Token | 值 | 用在哪里 |
|---|---|---|
| `bg-brand-sweep` | `linear-gradient(100deg, #0a3fc9 0%, #2f8dff 55%, #3fc4ff 100%)` | 标题图标、Save 按钮、开关、选中的权限图标、筛选器选中项、全选框、选中的勾 |
| `text-brand-navy` | `#14336b` | 所有标题、Back / Cancel 按钮文字 |
| `bg-row-stripe` | `linear-gradient(90deg, #d6ebff 0%, #f0f8ff 100%)` | 选中的权限按钮、选中的 Account / Process 小卡 |
| `dash-line` | `#e5e7eb` | 输入框边框、未选中项的边框 |
| `dash-faint` | `#9ca3af` | 占位文字、图标灰色、"No matches" |
| 卡片边框 | `#dbe7fb` | 三张卡片的边框、footer 顶部分割线 |
| 卡片头部分割线 | `#eef2f7` | 卡片标题下方的线、Permissions 上方的分割线 |
| 选中边框 | `#7fb2ff` | 选中的权限按钮、选中的小卡、全选框 hover |
| hover 边框 | `#93c5fd` | 未选中项 hover |
| 浅蓝按钮 | 背景 `#eaf2ff`，边框 `#cfe0fb`，hover `#dce9ff` | Back、Cancel、搜索按钮、筛选器底色 |
| 重点蓝 | `#0d60ff` | 选中小卡的 code、计数（有选中时） |
| 次要蓝 | `#5b74a3` | 选中小卡的 name、未选中的筛选按钮文字 |

### 品牌阴影（重复使用）

- 大按钮 / 图标块：`0 10px 20px -8px rgba(20,90,220,0.55), inset 0 -3px 8px rgba(0,0,0,0.08), inset 0 2px 4px rgba(255,255,255,0.35)`
- 输入框：`0 1px 3px rgba(15,23,42,0.05)`
- 输入框 focus：边框 `#3b82f6` + `0 0 0 3px rgba(59,130,246,0.15)`

### 高度分档（`index.css` 自定义 variant）

| Variant | 条件 | 对应屏幕 |
|---|---|---|
| `modal-tall` | 高度 ≥ 970px | 1920×1080 |
| 默认 | 761 – 969px | 1920×950、1600×800 |
| `modal-compact` | 高度 ≤ 760px | 1440×760、1536×730、1366×768 |
| `modal-tiny` | 高度 ≤ 600px | 1280×560、1366×610（同时也满足 compact） |

### 宽度分档（按内容区宽度，`@container/main` = 屏幕宽 − 侧边栏）

| 分档 | 内容区宽度 | 布局 |
|---|---|---|
| 宽屏 3 栏 | ≥ 1100px | 左栏 `clamp(300px, 22cqw, 380px)` + 两个等宽列表 |
| 紧凑 3 栏 | 900 – 1099px | 左栏 `clamp(256px, 27cqw, 280px)` + 两个等宽列表，字号和间距整体缩小 |
| 平板 | 600 – 899px | 2 栏：User Information 占满第一行，两个列表在第二行（高 `minmax(420px, 62dvh)`），弹窗内容可以上下滚动 |
| 手机 | < 600px | 1 栏：三块上下排，两个列表各高 440px，Cancel / Save 平分宽度 |

侧边栏宽度：≥ 1200px 时是完整 Sidebar，宽 `clamp(220px, 15.5vw, 236px)`；< 1200px 时是 64px 的图标栏（`SidebarRail`）。

---

## 1. 入口

- Admin 页工具栏左边的 **Add User** 主按钮（`PrimaryButton`，图标 `UserPlus`）。
- 点击后 `addOpen = true`，渲染 `<AddUserModal>`；关闭时直接卸载，所以**每次打开都是一张空表单**。
- 关闭方式：Back 按钮、Cancel 按钮、按 `Esc`、点击遮罩空白处。Save 目前也会关闭弹窗。

## 2. 弹窗位置与背景

- 通过 `MainOverlay` 用 portal 渲染进 `AuthenticatedLayout` 里的 `#main-overlay`。这个节点**只盖住内容区**，所以**左侧 Sidebar / 图标栏一直可见、也可以点**。
- 外层：`absolute inset-0 z-30 flex`，进场动画 `animate-dialog-overlay`（`dialog-fade` 0.2s ease-out，从透明淡入）。系统设置"减少动画"时不播放。
- **背景遮罩**：铺满内容区，颜色 `rgba(214,230,252,0.72)`（浅蓝、72% 不透明），加 `backdrop-blur 12px`，后面的 Admin 列表页会被模糊。点击遮罩即关闭。
- **弹窗本体**：白色 `#ffffff`，圆角 22px（手机 18px），`overflow-hidden`，铺满内容区（`flex-1`），四周外边距 `clamp(8px, 1.6dvh, 16px)`（tiny 和手机固定 8px）。弹窗本体没有阴影和边框。
- 无障碍：`role="dialog"`、`aria-modal="true"`，标题 id 为 `add-user-title`。

### 弹窗内的两个间距变量

| 变量 | 默认 | 紧凑 3 栏 / compact | tiny |
|---|---|---|---|
| `--gap`（卡片之间、上下留白） | `clamp(8px, 1.5dvh, 14px)` | 8px | 6px |
| `--pad`（左右内边距） | `clamp(10px, 2dvh, 18px)` | 10px | 8px |

## 3. 弹窗结构

```
┌ header：[图标块] Add User ........................ [< Back] ┐
├ body（grid）                                                │
│  ┌ User Information ┐ ┌ Account 76/76 ┐ ┌ Process 76/76 ┐   │
│  │ 表单 + 权限       │ │ 列表           │ │ 列表           │   │
│  └──────────────────┘ └───────────────┘ └───────────────┘   │
├ footer（顶部 1px #dbe7fb 分割线）............ [Cancel] [Save] ┤
└─────────────────────────────────────────────────────────────┘
```

### 3.1 Header

- 左右内边距 `--pad + 6px`，顶部 `--pad`，两端对齐。
- **图标块**：40×40，圆角 14px，`bg-brand-sweep`，白色 `UserPlus` 图标 20px，品牌阴影。compact 下 32×32、圆角 10px；tiny 下 28×28、圆角 8px、图标 16px。
- **标题 "Add User"**：`clamp(20px, 2.6dvh, 26px)`，粗细 800，行高 1.1，字距 -0.3px，颜色 `#14336b`，不换行。compact 20px，tiny 18px。
- **Back 按钮**（浅蓝按钮样式）：高 36px，左右内边距 16px，圆角 10px，13px 粗体，`ChevronLeft` 图标 15px。compact 高 32px，tiny 高 30px。

### 3.2 Footer

- 右对齐，按钮间距 8px，顶部 1px `#dbe7fb` 分割线，上内边距 10px（compact 6px）。
- **Cancel**：浅蓝按钮，高 38px，最小宽 112px，左右内边距 22px，13.5px 粗体。
- **Save**：`bg-brand-sweep` 白字，同尺寸，品牌阴影，`Check` 图标 15px，hover 时亮度 105%。
- compact 下两个按钮高 32px，tiny 下 30px；手机下取消最小宽度、两个按钮平分一行。

## 4. 卡片通用样式

三张卡片外观一致：

- 白底、1px `#dbe7fb` 边框、圆角 18px、`overflow-hidden`，没有阴影。
- **卡片头**：底部 1px `#eef2f7` 分割线。内边距：左右 14px、上 12px、下 10px；紧凑 3 栏为左右 10px、上 9px、下 8px；compact 为左右 12px、上 7px、下 6px；tiny 为左右 10px、上 6px、下 5px。
- **标题**：16px，粗细 800，`#14336b`，不换行；紧凑 3 栏 14.5px；tiny 14px。
- **计数 `Count`**（例如 `12/76`）：11px，粗细 600，等宽数字；有选中时 `#0d60ff`，0 时 `#9cb7ec`。

## 5. User Information 卡片（左栏）

- 标题左边有一条 4×16 的竖条，圆角，渐变 `linear-gradient(180deg, #3fc4ff, #0a3fc9)`。
- 卡片内容区可以单独上下滚动（屏幕太矮时不会被裁掉），滚动条细、颜色 `#cbd5e1`。平板 / 手机下不单独滚动，由整个弹窗滚动。
- 内容区内边距：左右 14px、上 12px、下 14px；紧凑 3 栏四周 10px；compact 为左右 12px、上 8px、下 10px；tiny 为左右 10px、上 6px、下 8px。

### 5.1 表单

左栏宽度不足 560px 时排成 2 列，≥ 560px（平板、手机横向）时排成 3 列：

| 字段 | 2 列时 | 3 列时 | 说明 |
|---|---|---|---|
| Login ID | 占满一行 | 1 格 | `autoComplete=off` |
| Password | 占满一行 | 1 格 | 右侧有眼睛按钮切换明文 / 密文（`Eye` / `EyeOff` 16px，灰 → hover `#64748b`） |
| Name | 半行 | 1 格 | 输入内容显示为大写（`uppercase`） |
| Role | 半行 | 1 格 | 原生 `<select>`，见下 |
| Email | 占满一行 | 2 格 | `type=email` |

- 列间距 12px、行间距 10px；compact 10 / 6px；tiny 8 / 4px。
- **标签**：12.5px，粗细 600，`#374151`，左边距 2px，下边距 4px；后面跟红色必填星号 `#ef4444`。compact 12px，tiny 11.5px。
- **输入框**（`inputClass`）：高 36px，宽 100%，圆角 10px，1px `#e5e7eb` 边框，白底，左右内边距 12px，字号 13.5px，文字 `#111827`，轻阴影；focus 时边框变 `#3b82f6` 并加蓝色光圈。紧凑 3 栏高 32px、13px；compact 高 30px；tiny 高 28px、12.5px。
- **Role 下拉**：输入框样式 + 右内边距 32px 留给箭头；去掉浏览器默认外观（`appearance-none`），右侧 10px 处放一个 14px 的 `ChevronDown`（灰色，点击会穿透）。未选择时显示灰色的 "Select Role"。选项：Admin、Manager、Supervisor、Accountant、Audit、Customer Service（Owner / Partnership / Company 不能在这里创建）。

### 5.2 分割线

1px `#eef2f7`，上下各 12px；compact 上 10px、下 8px；tiny 上 8px、下 6px。

### 5.3 Permissions 标题行

- 左边：13px，粗细 800，`#14336b` 的 "Permissions" + 计数 `0/8`。
- 右边：**Read only 开关**（`role="switch"`）：轨道 32×18，圆角胶囊，关闭时 `#cbd5e1`，打开时 `bg-brand-sweep`；白色圆点 14px，带轻阴影，从左 2px 滑到左 16px；文字 12px，粗细 600，`#475569`。

### 5.4 权限按钮（8 个）

Home、Admin、Account、Process、Data Capture、Transaction Payment、Report、Maintenance，图标和侧边栏菜单一致。

- **排列**：左栏 < 560px 时 2 列，≥ 560px 时 4 列，间距 6px（tiny 4px）。
- **3 栏布局时（内容区 ≥ 900px）**：这块网格会撑满卡片剩余高度，每行高度 `minmax(38px, 1fr)`，总高最多 226px；compact 最多 160px、每行至少 30px；tiny 每行至少 28px；**modal-tall（≥ 970px 高）变成 1 列竖排**，总高最多 450px、每行至少 40px。
- **按钮**：最小高 38px，圆角 10px，1px 边框，左右内边距 8px、上下 6px，图标和文字间距 8px，12.5px 粗体，文字可换行（行高 1.2）。悬停显示完整名称。
  - 未选中：白底，`#e5e7eb` 边框，文字 `#374151`，hover 边框 `#93c5fd`。
  - 选中：`bg-row-stripe` 渐变底，`#7fb2ff` 边框，文字 `#14336b`。
- **图标块（兼作勾选框）**：24×24，圆角 7px，图标 14px。未选中为 `#f1f5f9` 底、`#94a3b8` 图标；选中为 `bg-brand-sweep` 底、白色图标，加阴影 `0 4px 8px -4px rgba(20,90,220,0.6)`。
- **逐级缩小**：紧凑 3 栏 → 图标块 20px、文字 11.5px；compact → 最小高 30px、图标块 20px、图标 12px、文字 12px；tiny → 最小高 28px；左栏 ≤ 250px（1024 / 1200 宽的屏幕）→ 图标块 18px、文字 11px，这一档优先级最高。

## 6. Account / Process 卡片（右边两栏）

两张卡片是同一个组件 `AccessListCard`，只有标题和数据不同。**新用户默认全选**所有 Account 和 Process，由管理员取消勾选不需要的。

### 6.1 卡片头

```
[☑] Account 76/76 ................ [All | Sel | Unsel] [🔍]
```

- **全选框**：18×18，圆角 5px，1.5px 边框。全部选中显示 ✓，部分选中显示 −，此时都是 `bg-brand-sweep` 底、白色符号、带阴影；一个都没选时是白底、`#c3d3ea` 边框（hover `#7fb2ff`）。**全选 / 清除只作用于当前搜索结果。**
- **标题 + 计数**：同第 4 节。
- **筛选器**（All / Sel / Unsel = 全部 / 已选 / 未选）：外框 `#eaf2ff`，圆角 9px，内边距 2px；每个按钮 11.5px 粗体，圆角 7px，左右 9px、上下 3px。选中项为 `bg-brand-sweep` 白字加阴影，未选中项为透明底、`#5b74a3` 文字。
- **搜索**：
  - 卡片宽 ≥ 620px：直接显示搜索框（宽 170px，最小 110px）。
  - 其他宽度：显示 28×28 的浅蓝搜索按钮；点击后搜索框覆盖整个卡片头（白底），右边有 ✕ 关闭按钮。搜索框里有内容时，按钮右上角显示一个 8px 的蓝色小圆点提醒。
  - 搜索框：高 32px，圆角 10px，1px `#e5e7eb` 边框，13px，focus 边框 `#3b82f6`。同时匹配 code 和 name。
- 卡片宽度 ≤ 380px / ≤ 340px 时，间距、筛选按钮内边距、标题字号（14px）会逐步收紧。

### 6.2 列表

- 网格，每行固定高 44px（紧凑 3 栏 40px），间距 6px（紧凑 3 栏 5px），左右内边距 10px，上 4px，下 12px。列表区自己上下滚动，细滚动条 `#cbd5e1`。
- **列数**：默认 2 列；屏幕 ≥ 1200px 且卡片宽 ≥ 474px 时 3 列。
- 没有匹配结果时显示居中的 "No matches"（13px，灰色）。

### 6.3 列表小卡

- 圆角 9px，1px 边框，左内边距 9px，右内边距 22px（给勾留位置），code 和 name 上下两行，间距 1px。
- **code**：12px 粗体，超长时显示省略号；**name**：10.5px，粗细 600，超长时显示省略号。悬停提示显示完整的 `code · name`。
- 未选中：白底，`#e5e7eb` 边框，code `#374151`，name `#9ca3af`；hover 边框 `#93c5fd`、底色 `#f8fbff`。
- 选中：`bg-row-stripe` 底，`#7fb2ff` 边框，code `#0d60ff`，name `#5b74a3`；右侧 7px 处有一个 11px 的 `bg-brand-sweep` 圆形白勾。
- 紧凑 3 栏或卡片宽 ≤ 340px 时：code 11px、name 10px、左右内边距 7 / 19px、勾 10px。卡片宽 474 – 560px 时：code 11.5px。

---

## 7. 已知问题：Role 下拉在小屏幕上显示不全

**现象**：选了 "Customer Service" 这种较长的角色后，下拉框只显示到 "Customer Serv"。

**原因**：Role 只占左栏的半行；而在 3 栏布局里左栏本身最窄只有 300px（紧凑 3 栏只有 256 – 280px）。下拉框右侧还要留 32px 给箭头，所以能放文字的空间很少。按 13.5px 估算，"Customer Service" 文字约 115px，下拉框总宽要约 160px 才能完整显示。

下表的数值根据代码推算得出，**没有在浏览器里实测**：

| 视口 | 侧边栏 | 左栏宽 | Role 框宽（估算） | 能完整显示？ |
|---|---|---|---|---|
| 1920×950 | 236 | ~370 | ~164 | 刚好能放下 |
| 1600×800 | 236 | 300 | ~129 | ✗ |
| 1440×760 | ~223 | 300 | ~132 | ✗ |
| 1536×730 | 236 | 300 | ~132 | ✗ |
| 1366×610 | 220 | 300 | ~135 | ✗ |
| 1280×560 | 220 | 280 | ~125 | ✗ |
| 1024（图标栏） | 64 | ~259 | ~112 | ✗ |

平板和手机布局下左栏占满整行，所以没有这个问题。
