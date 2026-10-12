# 字体大小与粗细统一方案

## 要解决的问题

1. **大屏幕字体偏小、页面显得空。** 现在的字号在小屏幕(1366)下刚好,到 1920 以上就偏小。
2. **字重没有层次。** 全站 `font-bold` 约 207 处、`font-semibold` 137 处、`font-extrabold` 133 处,而 `font-medium` 只有 34 处、`font-normal` 只有 3 处。该粗的不够粗,粗的又太粗,中文在 800 下尤其糊。
3. **字号太碎。** 约 20 种写死的 px(`text-[12px]`、`text-[12.5px]`、`text-[13px]`、`text-[13.5px]`、`text-[11.5px]` 等),差 0.5px 肉眼看不出,维护很乱。
4. **没有任何缩放机制。** `html` 上只有 `font-sans`,所以屏幕变大文字不会变大。

## 思路

### 1. 只缩放根字号,字号和间距用 rem

不用 `vw` 做字体(那样会在小屏幕上变得不可控)。只在大屏幕提高 `html` 的 `font-size`:

| 屏幕宽度 | 根字号 | 倍数 |
|---|---|---|
| < 1440 | 16px | 1(与现在完全一样) |
| ≥ 1440 | 17px | 1.0625 |
| ≥ 1920 | 18px | 1.125 |
| ≥ 2400 | 20px | 1.25 |

Tailwind 的 `text-*`、`p-*`、`gap-*`、`size-*` 都是 rem,所以改根字号后字体、间距、按钮高度会一起按比例放大。小屏幕不动,不会变大。

**注意**:写死 px 的地方(如 `text-[13px]`、`w-[84px]`)不会跟着放大。要放大就必须改成 token 或 rem。

### 2. 六档字号 token(定义在 `src/index.css`)

| token | 大小 | 用途 |
|---|---|---|
| `text-caption` | 12px | 表头、说明、小标签、状态标 |
| `text-body` | 13px | 表格内容、输入框、列表 |
| `text-label` | 13px | 表单标签、按钮、菜单项 |
| `text-title` | 16px | 卡片、弹窗标题 |
| `text-heading` | 20px | 页面标题 |
| `text-display` | 28px | KPI 大数字 |

以后不再写 `text-[12.5px]` 这类一次性数值。没有对应档位的极小字(如日期选择器、甜甜圈图中心)暂时用 `text-[0.6875rem]`(11px,rem 写法,仍会缩放)。

### 3. 字重只用 400 / 500 / 600

| 位置 | 字重 |
|---|---|
| 正文、表格内容 | 400(`font-normal`,默认) |
| 标签、表头、按钮、菜单项 | 500(`font-medium`) |
| 标题、重点数字 | 600(`font-semibold`) |
| 极少数需要更强的地方 | 700(`font-bold`),尽量不用 |

- **`font-extrabold`(800)全部去掉。**
- 现有的 `font-bold` 逐处判断:标题降到 `font-semibold`,表格、正文、标签降到 `font-medium` 或 `font-normal`。

### 4. 中文字体

字体栈是 `Geist Variable`,后面是 `PingFang SC`、`Microsoft YaHei`、`Noto Sans SC`。Geist 只覆盖英文和数字,中文走后面的字体。

微软雅黑只有 400 和 700 两档,所以在 Windows 上中文的 500 和 600 会落到相邻一档,看不出差别。如果希望中文也有稳定的中间字重,需要在项目里自带 Noto Sans SC 可变字体(`@fontsource-variable/noto-sans-sc`),并放在字体栈中 Geist 之后、系统字体之前。**这一步还没做,待决定。**

## 已完成

- `src/index.css`:根字号的四档媒体查询,以及六个字号 token。
- Dashboard 页面全部改完:
  - `KpiCard.jsx`、`TrendChartCard.jsx`、`CurrencyBreakdownCard.jsx`、`DashboardFilterPanel.jsx`
  - 共享组件 `FilterRow.jsx`、`SegmentGroup.jsx`(其他页面里用到它们的地方也会跟着变)
- 生产构建通过,字号类能正常生成。

## 还没做(等 Dashboard 确认后再继续)

1. **确认 Dashboard 效果**,并在 1366×610、1536×730、1920×950 下检查没有页面滚动(见 `frontend/CLAUDE.md` 的"每个页面都要适配屏幕"规则)。
2. **批量归并字号**:把约 500 处 `text-[11px]` 到 `text-[14px]` 归到上面的 token。可以按档位写脚本替换,再抽查。
3. **批量降字重**:`font-extrabold` 全部降到 `font-semibold`,`font-bold` 逐处按层级判断。
4. **逐页检查**:根字号放大后内容会变高,每个页面要在上面三个视口下验证无滚动、无溢出。
5. **决定是否自带 Noto Sans SC 可变字体**。
6. 完成全局后,把"字号只用 token、字重只用 400/500/600"这条规则写进 `frontend/CLAUDE.md`。

## 参考

- 交互对比稿(现在 vs 建议,可切换页面和屏幕尺寸):https://claude.ai/artifact/ARDb9tjzFw9DvAxaGcnFbj
- 对比稿里把 label 定为 13px / 500,与最初讨论的 14px 不同,是为了避免比正文大一档显得突兀,实际 token 以 `index.css` 为准。
