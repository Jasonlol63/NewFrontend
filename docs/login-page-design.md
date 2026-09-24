# Login 页面设计规格（2026-09-24）

参考效果（可直接打开查看，随时会随对话更新到最新版本）：
https://claude.ai/artifact/U9TWkMbz6FHYPQiXQAoQ6F

> **状态：仅完成设计稿确认，尚未同步进实际项目代码。**
> `Count-web/src/pages/login/LoginPage.jsx` 和 `LoginPage.css` 目前还是**更早一版**的实现（shadcn 风格、卡片偏窄偏高、logo 没有旋转、输入框是全胶囊形状），跟这份文档描述的最终确认版**不一致**。继续做的时候要把下面的规格重新套进这两个文件（以及 `RoleTabs.jsx` / `PillSwitch.jsx` / `IconInput.jsx`）。

## 整体布局

- 外层容器 `.wrap`：宽度 `400px`，居中，`padding: 30px 0`
- 背景：`count_bg.png`（`public/images/count_bg.png`），`background-size: cover`，`background-position: center`，`background-repeat: no-repeat`，`background-color: #dbe9fb`（cover 模式理论上不会露底色，这个是保险）
  - 这张图设计上左右两侧是图案聚集区，正中间刻意留白给内容用——**不要再用放大 `background-size` 的方式去"填满空白"**，那样只会把中间空白区域也一起放大，两侧图案反而被推得更远。`cover` 已经是当前验证过不会让四周留白的写法。

## Logo

- 直接用现有的 `count_logo.png`（不要重新设计成多层堆叠图形）
- 容器 `.logo`：`width/height: 76px`，`margin: 0 auto 14px`
- `transform: rotate(-45deg)`
- `filter: drop-shadow(0 10px 14px rgba(20,90,200,0.35))`

## 标题 / 副标题

- 标题 `<h1>`："Accounting Management System"
  - `font-size: 21px`，`font-weight: 700`，`color: #14336b`，`letter-spacing: -0.2px`
  - `margin: 0 0 4px`
- 副标题 `.tagline`："SIMPLER ACCOUNTING BRIGHTER BUSINESS"
  - `font-size: 10px`，`font-weight: 600`，`letter-spacing: 3px`，`color: #7fa8d6`
  - `margin: 0 0 20px`

## 卡片 `.card`

- `background: linear-gradient(180deg, #ffffff 0%, #f5f9ff 100%)`
- `border-radius: 24px`
- `box-shadow: 0 30px 60px -20px rgba(20,70,160,0.35), 0 10px 25px -10px rgba(20,70,160,0.25), inset 0 1px 0 rgba(255,255,255,0.6)`
- `overflow: hidden`

## Tab 切换（Admin / Member）

- 容器 `.tabs`：`display: grid; grid-template-columns: 1fr 1fr`，紧贴卡片顶部（`rounded-t` 效果由卡片自身 `overflow: hidden` + 卡片圆角提供）
- **未选中**：纯色实心 `background: #dbe7f7`，文字 `color: #6f93c9`（刻意做成"暗淡"，跟选中态形成强对比）
- **选中**：`background: linear-gradient(100deg, #0a3fc9 0%, #2f8dff 55%, #3fc4ff 100%)`，文字白色，`box-shadow: inset 0 -3px 10px rgba(255,255,255,0.25), 0 6px 14px -2px rgba(20,90,220,0.55)`
- `padding: 14px 0`，`font-size: 14px`，`font-weight: 700`

## 输入框（Company/Group ID、Username、Password）

- 高度 `38px`，`border-radius: 13px`（**注意：偏方带圆角，不是满圆胶囊/椭圆**——这是改了两次才定下来的，不要再改回 `border-radius: 19px`+ 那种全椭圆样式）
- `border: 1px solid #d9e8fb`
- `background: linear-gradient(180deg, #ffffff 0%, #f7fbff 100%)`
- `padding: 0 14px 0 38px`（左侧留给图标）
- `font-size: 12.5px`，文字颜色 `#4a6fa5`，placeholder 颜色 `#a9c3e6`
- `box-shadow: inset 0 1px 2px rgba(20,70,160,0.06)`
- 图标（左侧）颜色 `#6fa8ea`，`width/height: 15px`
- 密码框右侧眼睛图标（显示/隐藏），同色 `#6fa8ea`

## Remember me / Forget password 行

- 左侧 `.remember`：自定义 checkbox 开关（不是 shadcn Radix Switch，用原生 `<input type="checkbox">` + CSS 伪元素做的滑块）
  - 轨道 `32x18px`，圆角 `999px`，未选中 `background: #dbe4f0`
  - 选中态：`background: linear-gradient(100deg, #0a3fc9 0%, #3fc4ff 100%)`，滑块（14px 圆点）向右平移 14px
- 右侧 "Forget Password?" 链接：`color: #2f6fef`，`font-weight: 600`

## Login 按钮

- 高度 `42px`，`border-radius: 21px`（**这个保持满圆胶囊形状，跟输入框的"偏方"不一样，不要改**）
- `background: linear-gradient(100deg, #0a3fc9 0%, #2f8dff 55%, #3fc4ff 100%)`（跟 Tab 选中态、语言开关选中态同一个渐变）
- `box-shadow: 0 14px 24px -8px rgba(20,90,220,0.55), inset 0 -3px 8px rgba(0,0,0,0.08), inset 0 2px 4px rgba(255,255,255,0.35)`
- 文字 "Login" + 右侧箭头图标（`ArrowRight`，15px）

## 语言切换（EN / 中）

- 外层胶囊容器 `.lang .pill`：`background: #dbe7f7`，`border-radius: 999px`，`padding: 3px`
- 按钮：`padding: 6px 22px`，`min-width: 44px`（**加长过一次，别再改回窄的 `padding: 4px 14px`**），`font-size: 11px`，`font-weight: 700`
- 选中态：同登录按钮的渐变 `linear-gradient(100deg, #0a3fc9 0%, #3fc4ff 100%)` + `box-shadow: 0 4px 10px -2px rgba(20,90,220,0.5)`
- 未选中：透明背景，`color: #6f93c9`

## 组件拆分（复用现有结构即可）

- `RoleTabs.jsx` → 对应「Tab 切换」
- `PillSwitch.jsx` → 对应「语言切换」（跟 RoleTabs 视觉不同，没有强行合并成一个共用组件）
- `IconInput.jsx` → 对应「输入框」
- Remember me 的开关目前直接写在 `LoginPage.jsx` 里，没有单独拆组件（够简单，没必要拆）

## 已经确认、不要再改动的点

这些是反复调整后才定下来的，继续做的时候不要再改回旧版本：
1. Logo 是**旋转现有图片**，不是重新设计的多层堆叠图形
2. 卡片宽度 `400px`（不是最初的 `340px`，也不是更早的 `440px`）
3. 输入框圆角 `13px`（偏方带圆角，不是满圆胶囊）
4. Login 按钮和语言切换保持满圆胶囊形状
5. Tab 未选中态是**实心暗色块**（`#dbe7f7`），不是白色/透明
6. 背景图用 `cover`，不要用放大 `background-size` 百分比的方式去减少留白
