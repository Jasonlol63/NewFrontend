# 弹窗共用设计规格（Admin / Account 通用）

Admin 的 **Add / Edit User**、Account 的 **Add / Edit Account**、Account 的 **Currency Setting** 三个全区弹窗，以及 Admin / Account 列表页的 **Delete 确认弹窗**，共用同一套外壳、卡片、输入框、颜色和动画。**下面这些尺寸在 Admin 和 Account 两边完全一样**，各页面的文档不会重复写，只写它们自己独有的部分。

- 数值取自代码，高度/宽度分档的断点在 Chrome 预览里实测过（Currency Setting 开发时逐个尺寸量过）。
- 页面独有的设计见：
  - `account-form-modal-design.md`：Add / Edit Account
  - `currency-setting-modal-design.md`：Currency Setting
- 旧文档 `add-user-modal-design.md` 写的是改成"毛玻璃"风格之前的版本（那时弹窗是白底、没有卡片边框），**颜色和外壳以本文为准**；它里面 User Information 卡片、权限按钮、Account / Process 列表的细节仍可参考。

| 文件 | 内容 |
|---|---|
| `src/components/shared/form-modal/FormModal.jsx` | 弹窗外壳：遮罩、标题栏、Back、底部 Cancel / Save |
| `src/components/shared/form-modal/FormCard.jsx` | 卡片：蓝条 + 标题 + 右侧计数；`CardCount` |
| `src/components/shared/form-modal/fields.jsx` | 输入框、下拉、标签、开关、浅色按钮、蓝色主按钮 |
| `src/components/shared/form-modal/CheckList.jsx` | 搜索 + 全选 + 可勾选行（Company 列表） |
| `src/components/shared/form-modal/DateField.jsx`、`MultiSelectField.jsx`、`listSelection.js` | 日期选择、多选下拉、选择辅助函数 |
| `src/components/shared/DeleteDialog.jsx` | 删除确认弹窗（列表页、币种删除共用） |
| `src/components/shared/StatusDialog.jsx` | 状态弹窗（成功/警告/失败）和动画片段 |
| `src/components/layout/MainOverlay.jsx` | 把弹窗渲染进 `#main-overlay`（只盖内容区） |
| `src/layouts/AuthenticatedLayout.jsx` | `#main-overlay` 所在位置 |
| `src/index.css` | 颜色 token、渐变、动画、高度分档 |

---

## 0. 基准

| 项目 | 值 |
|---|---|
| 字体 | `Geist Variable` |
| 间距单位 | 1 = 4px（`px-3.5` = 14px，`gap-2.5` = 10px） |
| 圆角（本项目改过比例） | `rounded-md` 8px · `rounded-lg` 10px · `rounded-xl` 14px · `rounded-2xl` 18px；写成 `rounded-[22px]` 的是固定值 |

### 0.1 毛玻璃颜色 token（`index.css`）

| Token | 值 | 用在哪里 |
|---|---|---|
| `bg-modal-bg` | `rgba(222,232,246,0.62)` | 弹窗本体底色 |
| `bg-modal-card` | `rgba(255,255,255,0.42)` | 卡片底色 |
| `border-modal-line` | `rgba(255,255,255,0.7)` | 卡片边框、底部分割线 |
| `border-modal-divider` | `rgba(130,155,195,0.22)` | 卡片标题下方的线 |
| `bg-modal-input` | `rgba(255,255,255,0.62)` | 输入框底色 |
| `border-modal-input-line` | `rgba(130,155,195,0.38)` | 输入框边框 |
| `bg-modal-off` | `rgba(255,255,255,0.5)` | 未选中的方块、币种、日期格 |
| `border-modal-off-line` | `rgba(130,155,195,0.3)` | 未选中项边框 |
| `bg-modal-float` | `rgba(244,248,253,0.94)` | 下拉列表、悬浮层（几乎不透明，防止后面文字透出） |
| `shadow-modal-card` | `0 8px 24px -18px rgba(20,51,107,0.4)` | 卡片阴影 |

### 0.2 品牌色

| Token / 值 | 用在哪里 |
|---|---|
| `bg-brand-sweep` = `linear-gradient(100deg, #0a3fc9 0%, #2f8dff 55%, #3fc4ff 100%)` | 标题图标块、Save / Add / Create 按钮、开关打开、选中的勾 |
| `text-brand-navy` `#14336b` | 标题、Back / Cancel 文字、选中项文字 |
| `bg-row-stripe` = `linear-gradient(90deg, #d6ebff 0%, #f0f8ff 100%)` | 选中的方块、币种、勾选行 |
| 选中边框 `#7fb2ff` | 选中的方块、币种 |
| hover 边框 `#93c5fd` | 未选中项 hover |
| 计数蓝 `#3b82f6` | `CardCount` 文字、输入框 focus 边框 |
| 危险红 `#dc2626` / `#e5484d` | Delete 按钮 `#dc2626`；确认弹窗的 Delete 按钮 `#e5484d` |
| 次要灰 `#374151`（正文）、`#475569`（次要标签）、`#8a96a8`（提示）、`dash-faint #9ca3af`（占位文字） | 文字 |

### 0.3 品牌阴影（重复使用）

- 大按钮 / 图标块（`primaryButtonClass`）：`0 10px 20px -8px rgba(20,90,220,0.55), inset 0 -3px 8px rgba(0,0,0,0.08), inset 0 2px 4px rgba(255,255,255,0.35)`，hover 亮度 105%。
- 输入框：`0 1px 3px rgba(15,23,42,0.05)`；focus：边框 `#3b82f6` + `0 0 0 3px rgba(59,130,246,0.15)`。

---

## 1. 高度 / 宽度分档

### 1.1 高度分档（`index.css` 自定义 variant）

| Variant | 条件 | 对应屏幕 |
|---|---|---|
| `modal-roomy` | 高度 ≥ 880px | 1920×950、1920×1080 |
| `modal-cozy` | 高度 ≤ 879px | 与 roomy 互补 |
| `modal-tall` | 高度 ≥ 970px | 1920×1080 |
| `modal-compact` | 高度 ≤ 760px | 1440×760、1536×730、1366×768 |
| `modal-short` | 高度 ≤ 700px | 1366×690 附近 |
| `modal-snug` | 高度 ≤ 640px | 1366×610 附近 |
| `modal-tiny` | 高度 ≤ 600px | 1280×560、1366×610 |

> 同一屏幕会同时命中多档（例如 1280×560 同时是 compact、short、snug、tiny），越小的档越晚生效、覆盖前面的值。

### 1.2 宽度分档（按**内容区**宽度，`@container/main` = 屏幕宽 − 侧边栏）

内容区的容器就是 `FormModal` 最外层的 `@container/main`。**所有宽度判断用的是弹窗自己的宽度，不是屏幕宽度**，所以侧边栏变成图标栏（< 1200px）时布局会跟着变。

| 写法 | 含义 |
|---|---|
| `@min-[900px]/main:@max-[1099px]/main:` | "窄内容区"：1200–1366 屏幕带完整侧边栏，或 1024–1180 屏幕带图标栏。字号、间距、输入框整体缩小一档 |
| `@max-[899px]/main:` | 平板竖屏：多栏退成单栏，弹窗**自己上下滚动** |
| `@max-[599px]/main:` | 手机：边距变 8px，按钮平分宽度 |

侧边栏宽度：屏幕 ≥ 1200px 时是完整 Sidebar，宽 `clamp(220px, 15.5vw, 236px)`；< 1200px 时是 64px 的图标栏。弹窗内容区 = 屏幕宽 − 这个宽度。

---

## 2. 弹窗位置与背景（`FormModal`）

- 用 `MainOverlay` 通过 portal 渲染进 `#main-overlay`，这个节点**只盖住内容区**，所以左侧 Sidebar / 图标栏一直可见、可点。
- 外层：`absolute inset-0 z-30 flex`，进场动画 `animate-dialog-overlay`（0.2s 淡入）。系统设置"减少动画"时不播放。
- **遮罩**：`rgba(214,230,252,0.72)` + `backdrop-blur 12px`，点击遮罩关闭。
- **弹窗本体**：`bg-modal-bg` + `backdrop-blur 22px` + `saturate 1.15`，圆角 **22px**（手机 18px），`overflow-hidden`，铺满内容区（`flex-1`），无阴影无边框。
- 无障碍：`role="dialog"`、`aria-modal="true"`，标题 id 由 `useId()` 生成。
- 关闭方式：Back、Cancel、`Esc`（若内部下拉已处理 Esc 则不关）、点遮罩。Save 目前只调用 `onSave`，**挂载即打开，卸载即关闭**，所以每次打开都从初始值开始。

### 2.1 外边距与两个间距变量

| 项目 | 默认 | 窄内容区 900–1099 | compact（≤760） | tiny（≤600） | 手机（<600 宽） |
|---|---|---|---|---|---|
| 弹窗外边距 | `clamp(8px, 1.6dvh, 16px)` | 同左 | 同左 | 8px | 8px |
| `--gap`（卡片之间、body 上下留白） | `clamp(8px, 1.5dvh, 14px)` | 8px | 8px | 6px | — |
| `--pad`（左右内边距） | `clamp(10px, 2dvh, 18px)` | 10px | 10px | 8px | — |

---

## 3. 结构

```
┌ header：[图标块] 标题 ........................ [< Back] ┐
├ body（卡片排布由各弹窗自己的 bodyClassName 决定）        │
│  ┌ 卡片 ┐ ┌ 卡片 ┐ ┌ 卡片 ┐                             │
├ footer（顶部 1px 分割线）........... [Cancel] [Save] ┤
└──────────────────────────────────────────────────────┘
```

### 3.1 Header

- 左右内边距 `--pad + 6px`，顶部 `--pad`，两端对齐。
- **图标块**：40×40，圆角 14px，`bg-brand-sweep`，白色图标 20px，品牌阴影。compact 32×32 / 圆角 10px；tiny 28×28 / 圆角 8px / 图标 16px。
- **标题**：`clamp(20px, 2.6dvh, 26px)`，粗细 800，行高 1.1，字距 -0.3px，`#14336b`，不换行。compact 20px，tiny 18px。
- **Back 按钮**（`SoftButton`）：高 36px，左右内边距 16px，圆角 10px，13px 粗体，`ChevronLeft` 15px。compact 高 32px，tiny 高 30px / 内边距 12px。

### 3.2 Body

- `min-h-0 flex-1`，左右内边距 `--pad`，上下 `--gap`，卡片间距 `--gap`。
- 具体栏数、栏宽由各弹窗通过 `bodyClassName` 给出（User / Account / Currency Setting 各不相同）。

### 3.3 Footer

- 右对齐，间距 8px，顶部 1px `border-modal-line`，上内边距 10px（compact 6px），下内边距 `--pad`。
- `footerStart`：左边放校验提示（User 弹窗的二级密码错误）。
- **Cancel**：`SoftButton`，高 38px，最小宽 112px，左右内边距 22px，13.5px 粗体。
- **Save**：`primaryButtonClass`，同尺寸，`Check` 图标 15px。`saveLabel` 可以是带计数的节点；`saveDisabled` 时 `opacity 50%`、去掉阴影、`cursor-not-allowed`。
- compact 下按钮高 32px，tiny 下 30px；手机（< 600px 宽）下取消最小宽度、两个按钮平分一行。

---

## 4. 卡片（`FormCard`）

- 外壳：`rounded-2xl`（18px），1px `border-modal-line`，`bg-modal-card`，`shadow-modal-card`，`overflow-hidden`，纵向 flex。
- **标题行**：下边线 1px `border-modal-divider`。内边距：默认左右 14px、上 12px、下 10px；窄内容区 10/9/8px；compact 12px / 7px / 6px；tiny 10px / 6px / 5px。
- **蓝条**：4×16px，圆角 2px，渐变 `#3fc4ff → #0a3fc9`。
- **标题文字**：16px，粗细 800，`#14336b`，不换行（窄内容区 14.5px，tiny 14px）。
- `right`：标题行右侧（计数、开关、按钮），`ml-auto`，间距 8px。
- **卡片内容区**：自己上下滚动（`overflow-y-auto`，细滚动条 `#cbd5e1`）。内边距：默认 `px 14 / pb 14 / pt 12`；窄内容区 10px；compact `px 12 / pb 10 / pt 8`；tiny `px 10 / pb 8 / pt 6`。
- `body={false}`：不套内容区，由使用者自己写（Currency Setting 的 Account 卡片、Company 列表）。
- **`CardCount`**：11.5px，粗体，`#3b82f6`（例如 "12 hold MYR"、"10 added"）。

---

## 5. 表单控件（`fields.jsx`）

| 控件 | 尺寸 | 说明 |
|---|---|---|
| `TextInput` | 高 36px，圆角 10px，左右内边距 12px，13.5px | 窄内容区高 32px / 13px；compact 高 30px；tiny 高 28px / 12.5px。底色 `bg-modal-input`，边框 `border-modal-input-line` |
| `Field` 标签 | 12.5px，粗细 600，`#374151`，下边距 4px | compact 12px / 2px；tiny 11.5px / 1px。必填加红星 `*`（`#ef4444`），选填显示 `(opt.)`（10px，`#8a96a8`） |
| `PasswordInput` | 同输入框，右侧留 36px | 右侧眼睛图标 16px |
| `SelectField` | 触发器同输入框；右侧 `ChevronDown` 14px | 弹出层宽度等于触发器，圆角 12px，`bg-modal-float`，阴影 `0 14px 32px -10px rgba(20,51,107,0.32)`，`backdrop-blur-xl`；选项高 34px（compact 30px，tiny 28px），选中项 `bg-row-stripe` + 边框 `#7fb2ff` + 右侧渐变小圆勾（16px） |
| `ToggleSwitch` | 轨道 32×18px，圆点 14px | 打开 `bg-brand-sweep`，关闭 `#cbd5e1`；文字 12px 粗体 `#475569` |
| `SoftButton` | 圆角 10px，1px 白边，`bg-white/55`，13px 粗体 `#14336b` | Back / Cancel；hover `bg-white/75` |
| `primaryButtonClass` | 圆角 10px，`bg-brand-sweep`，白字粗体，品牌阴影 | Save / Add / Create / Select All（各处自己给高度） |

### 5.1 Company 列表（`CheckList.jsx`）

- **搜索条**：高 32px（tiny 28px），圆角 9px，12.5px，右边两个文字按钮 "Select all"（`#1d7bff`）和 "Clear"（`#64748b`），12px 粗体。
- **勾选行**：高 ≥ 34px（tiny 30px），圆角 9px，13px，行距 2px；选中 `bg-row-stripe` + 边框 `#bfd8ff`；未选 boxed `bg-white/35`；左侧 16px 勾框（圆角 5px，选中渐变）；右侧 `tag`（9.5px，`#dbeafe` 底 `#1d4ed8` 字）。

---

## 6. 删除确认弹窗（`DeleteDialog`）

用于 Admin / Account 列表页的批量删除，以及 Currency Setting / Account 表单里删除币种。

- **遮罩**：`rgba(20,51,107,0.22)` + `backdrop-blur 6px`，z-50（盖在全区弹窗之上）。
- **弹窗**：白色，圆角 20px，居中，阴影 `0 30px 60px -20px rgba(20,51,107,0.45), 0 8px 20px -10px rgba(20,70,160,0.25)`，进场 `animate-dialog-in`（0.25s，上浮 8px + 缩放 0.97→1）。最大高 `100dvh − 32px`，最大宽 `100vw − 32px`，超出时自己滚动。
- **尺寸随屏幕连续变化**（没有断点）：

| 项目 | 值 |
|---|---|
| 宽 | `clamp(300px, 22vw, 400px)` |
| 左右内边距 | `clamp(20px, 1.5vw, 28px)` |
| 上内边距 | `clamp(20px, 3.4dvh, 30px)`，下内边距为其 75% |
| 图标 | `clamp(42px, 6dvh, 52px)` 圆形，底 `#ffecec`，垃圾桶 `#e5484d`，外圈 `0 0 0 8px #fff6f6` |
| 元素间距 | `clamp(14px, 2.4dvh, 22px)` |
| 按钮高 | `clamp(36px, 5dvh, 42px)` |
| 标题 | `clamp(16px, 2.3dvh, 18px)`，粗体，`#14336b` |
| 说明 | `clamp(13px, 1.8dvh, 14px)`，`#5b74a3`，名字用 `#14336b` 粗体 |

- **按钮**：Cancel（白底，边框 `#dbe5f3`，圆角 12px）+ Delete（`#e5484d`，白字，阴影 `0 6px 14px -6px rgba(229,72,77,0.6)`，hover `#d63b40`），各占一半，间距 10px，14px 粗体 600。
- **文案**：单个 "Delete {noun}? Are you sure you want to delete **名字**? This action can't be undone."；多个 "Delete N {noun}s? The N selected {noun}s will be deleted."
- **动画**：图标弹出（`status-pop`），垃圾桶线条依次画出（`status-draw` / `status-draw-late`），一圈涟漪 + 柔光；减少动画时全部关闭。

---

## 7. 状态弹窗与动画片段（`StatusDialog`）

- 弹窗宽 `min(360px, 100% − 32px)`，圆角 24px，渐变底 `#fff → #f5f9ff`，内边距 `30px 26px 24px`。
- 色调：error `#d93a3a`、warning `#c27406`、success `#12925f`（含浅色底和光环）。
- 图标是圆角方块（72px），包含弹出、涟漪、8 个爆点、柔光。
- 可复用的动画（`index.css` 的 `@theme`）：

| 名称 | 动画 |
|---|---|
| `animate-dialog-overlay` | 遮罩 0.2s 淡入 |
| `animate-dialog-in` | 弹窗 0.25s 上浮 + 轻微放大 |
| `animate-status-pop` | 图标 0.5s 回弹弹出 |
| `animate-status-draw` / `-draw-late` | 线条描绘（0.4s 延迟 0.3s / 0.25s 延迟 0.6s） |
| `animate-status-dot` | 圆点 0.2s 淡入，延迟 0.75s |
| `animate-status-ripple` | 涟漪 0.9s，放大到 1.9 倍并淡出 |
| `animate-status-glow` | 柔光 3.2s 呼吸，延迟 1.6s |
| `drawFirst` / `drawLate`（`StatusDialog.jsx` 导出） | 给 SVG 线条加 `pathLength=1` 后用的描绘 class |

---

## 8. 改尺寸时去哪里找

| 想改 | 去哪里 |
|---|---|
| 弹窗外边距、`--gap`、`--pad` | `FormModal.jsx`，搜 `--gap` |
| 圆角 22px、模糊、背景色 | `FormModal.jsx` 外壳 class；颜色在 `index.css` 的 `--color-modal-*` |
| 标题大小、图标块大小 | `FormModal.jsx` header 部分 |
| 底部按钮高度 / 宽度 | `FormModal.jsx` footer 部分 |
| 卡片标题行内边距、标题字号 | `FormCard.jsx` |
| 输入框高度 / 字号 | `fields.jsx` 的 `inputClass` |
| 高度分档的断点 | `index.css` 顶部的 `@custom-variant modal-*` |
| 品牌渐变 | `index.css` 的 `@utility bg-brand-sweep` / `bg-row-stripe` |
| 删除弹窗尺寸 | `DeleteDialog.jsx` 顶部的 `FLUID` |
