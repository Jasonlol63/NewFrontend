# Data Capture 自动抓取报表（Auto Fetch）

> 目标：Data Capture Table 不再需要人工去报表网站复制 Upline / Downline Payment 两张表再粘贴进来。
> 首个接入的网站类型是 **Citibet**（如 `riding168.com`），对应 Process 例子 `M99M06`（Day Use: MON, THU）。
> 最后更新：2026-10-17

---

## 1. 人工流程 vs 现在

| 步骤 | 以前（人工） | 现在 |
|---|---|---|
| 打开网站、输入用户名/密码/验证码 | 人工 | 后端代发，**验证码仍由人在前端输入** |
| `validate_pin.jsp` 输入 PIN | 人工点计算器键盘 | 后端代发（PIN 存在库里，加密） |
| `terms.jsp` → Agree | 人工点 | 后端代发 |
| `announcement.jsp` → Proceed | 人工点 | 后端代发 |
| `select.jsp` → SG Mode → GO | 人工点 | 后端代发 |
| Payment Report → 选周 → 复制两张表 | 人工复制 | 后端按周取回，前端自动填进表格 |
| 粘贴进 Data Capture Table | 人工粘贴 | 自动 |

**验证码为什么不自动**：那是网站用来确认「对面是人」的，我们不去绕过它。每个网站账号**一次登录会输入一次**，
之后会话在后端保留（最长闲置 6 小时），同一账号的后续抓取不再问。

---

## 2. 关键发现：报表数据本来就是 JSON

`newPayReport.jsp` 并不是把表格渲染成 HTML 发过来的，而是在页面里内嵌一段 JSON：

```js
CitibetHandler.data = {"upline":[[ ... ]],"downline":[[ ... ]]};
```

再由网站自己的 `/js/pay_report.js`（`CitibetHandler.setRacingData`）画成 Upline / Downline 两张表。

所以后端**直接取这段 JSON**，不用从 HTML 里抠文字，网站改样式也不会影响我们。

报表地址本身就是按周查询的，不用模拟点菜单：

```
/newPayReport.jsp?start=05-10-2026+Mon&end=11-10-2026+Sun&uid=m99m06&domain=
```

**取哪一周**：Data Capture 的 Date 所在周的**上一周**（周一到周日），等同于网站上的 **Last week** 按钮
（`CitibetPages.lastWeek`）。所以同一周的周一和周四抓到的是同一周的报表。

---

## 3. 为什么要先还原成「人工复制的文本」

粘贴这块历史上踩过很多坑（见 `Count-Frontend/src/pages/data-capture/shared/paste/README.md`）。
Summary 的公式是按 Data Capture Table 的**单元格位置**取数的，所以自动抓取**必须和人工粘贴落在完全相同的格子里**，
否则 Summary 会错。

因此前端拿到 JSON 后，先按网站 `setRacingData` 的列顺序还原成「人工复制那两张表会得到的文本」
（`dataCaptureCitibetReportText.js`），再喂给**现有的** `pasteIntoSheet`，走的是和人工粘贴一模一样的解析链路。

还原时要照抄的几个细节：

- Username 格是 `m99m06<br/>m06-KZ`，复制时会断成两行：`MG\tm99m06` 然后 `m06-KZ\tMajor\t...`；
- My Earnings 的标签带网站自己的 `&nbsp;`，所以前面有一个空格；
- 数据里每行都有 `detail` 和 `summary` 两份，按页面的 `racing_mode` 只取一份；
- cash mode 不出 Eat / Eat Tax 两列。

`dataCaptureCitibetReportText.test.js` 里有一条测试，断言还原出来的文本经现有解析器得到的矩阵，
和人工粘贴那段文本得到的矩阵**逐格相同**。

---

## 4. 配置在哪里

**Process 编辑页 → Auto Fetch 卡片**（只有 GAME 类别有）：网站地址、用户名、密码、PIN，加一个开关。

- 密码和 PIN 用 **AES-256-GCM** 加密后存 `process_auto_fetch`（`util/CredentialCipher.java`），
  **永远不会回传给前端**，页面上只知道「已保存」。编辑时留空＝不修改。
- 关掉开关会保留账号，重新打开不用再填。
- Copy From 会带上网站和用户名，但**不带**密码和 PIN（它们没出过服务器），需要重新输入。

### 上线前必须做的两件事

1. **建表**：
   ```bash
   mysql -u<用户> -p count168_site < ~/migrate_add_process_auto_fetch.sql
   ```
2. **配置密钥**（没有它 Auto Fetch 存不了也用不了）：
   ```bash
   # 生成一次，存进服务器环境变量，不要提交进仓库
   openssl rand -base64 32
   ```
   然后 `AUTOFETCH_SECRET_KEY=<上面的值>`（或写进 `application-site-local.yml` 的 `app.autofetch.secret-key`）。

   **换掉这个 key 等于所有已存密码都解不开**，只能让用户重新输入一次。

---

## 5. 接口

`POST /api/datacapture/autofetch/report`，body `{ tenantId, processId, captureDate, ticket?, captcha? }`，
回包两种：

| status | 含义 | 前端动作 |
|---|---|---|
| `REPORT` | 报表取到了，`report` 里是 `{ data, page, i18n }` | 还原成文本 → `pasteIntoSheet` 填表 |
| `CAPTCHA` | 要验证码，`captchaImage` 是 data URL，`ticket` 是一次性票据 | 弹窗让人输入，带 `ticket` 再请求一次 |

**保护**：同一网站账号连续 5 次登录被拒就锁 15 分钟（`AutoFetchSessions`），避免错密码一直打对面、
把账号在网站那边锁掉。

---

## 6. 前端行为

- 只在**选中的 Process 配了 Auto Fetch 且开着**时才动。能选到这个 Process，说明 Date 的星期已经在它的 Day Use 里了
  （`/games/form` 本来就只返回当天该跑的流程），所以不用再判断星期。
- 选中后**自动抓一次**；会话还在就直接把表填好，这就是「省掉人工复制」的那一步。
- **只在表格是空的时候填**（`canFill: () => !sheet.filled`），不会覆盖草稿或已经手输的内容。
- 表格工具条上有 **Auto Fetch** 按钮，可以重抓（例如 Reset 之后）。
- 只读账号不触发。

---

## 7. 相关文件

| 层 | 文件 |
|---|---|
| 建表 | `sql/migrate_add_process_auto_fetch.sql`、`sql/schema.sql` |
| 加解密 | `util/CredentialCipher.java` |
| 页面解析 / 哈希 / 周计算 | `autofetch/CitibetPages.java`（+ `CitibetPagesTest`） |
| 登录与取报表 | `autofetch/CitibetSession.java` |
| 会话与失败锁 | `autofetch/AutoFetchSessions.java` |
| 业务 | `service/impl/AutoFetchServiceImpl.java`、`controller/DataCaptureController.java` |
| 配置保存 | `service/impl/ProcessServiceImpl.java`（`saveAutoFetch`） |
| JSON → 粘贴文本 | `paste/vendors/dataCaptureCitibetReportText.js`（+ 同名 test） |
| 前端接线 | `shared/autoFetchApi.js`、`shared/useAutoFetch.js`、`shared/AutoFetchCaptchaDialog.jsx`、`games/GameCaptureView.jsx` |
| Process 表单 | `process/games/AutoFetchCard.jsx`、`processFormRules.js`、`processRules.js` |

---

## 8. 接别的网站类型

`process_auto_fetch.provider` 现在只有 `CITIBET`。再接一种网站时：新增一个 provider 值，
照 `CitibetPages` / `CitibetSession` 的分法写它自己的「页面怎么读」和「怎么登录取数」，
再写它自己的「还原成粘贴文本」模块 —— **不要改 Citibet 的，也不要改公共粘贴代码**（paste/README.md 的规矩一样适用）。
