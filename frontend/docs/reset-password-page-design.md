# Reset Password 页面（Admin / Owner）

> **文件**：`src/pages/login/ResetPasswordPage.jsx`（路由 `/reset-password`，登录页的 Forget Password 链接进入）。
> **后端**：`Count/docs/reset-password-tac-implementation.md` 第 8 节。

## 1. 三步流程

| 步骤 | 内容 | 接口 |
|---|---|---|
| 1 | 角色（Admin / Owner）→ Company / Group ID → Login ID（或切换成 Name）→ 邮箱 | `POST /auth/send-reset-tac` |
| 2 | 输入 6 位验证码，可重发（60 秒冷却，与后端一致） | `POST /auth/verify-reset-tac`；重发再调 `send-reset-tac` |
| 3 | 新密码 + 确认密码（有强度条） | `POST /auth/reset-password`（带上验证码） |
| 4 | 成功页，回登录 | — |

- **第 2 步的 Continue 会请求后端校验验证码**（`POST /auth/verify-reset-tac`，只检查、不消耗）：验证码错误或过期就留在这一步并弹窗提示；通过才进入第 3 步。最后 `reset-password` 会再校验一次并消耗验证码。
- 第 1 步如果公司、登录ID、名字或邮箱有误，后端会说明哪一项不对，页面用弹窗显示（中英文）；验证码发送成功才进入第 2 步。
- 忘了登录 ID：登录 ID 输入框右侧有 `ID | Name` 小开关，切到 Name 就改填名字；仍需填登记的邮箱。
- 本页**没有二级密码输入**：重置只改主密码，二级密码保持不变（要改找客服）。

## 2. 校验

- 前端：新密码不设任何强度限制（强度条仅作提示），只检查两次输入一致；其余错误直接显示后端返回的 message（红字，`role="alert"`）。
- 后端也不限制长度下限，只保留 bcrypt 的 72 字节上限。
- 公司 ID、登录 ID 输入时转大写（与登录页一致），名字保持原样。

## 3. 中英文与报错弹窗（登录相关页面）

- 登录页、二级密码页、重置密码页的文案都在 `i18n/locales/{en,zh}/login.json`（命名空间 `login`）；语言用全局的 i18n（只有登录页底部有 EN / 中 开关（调用 `i18n.changeLanguage`，选择会存到 `ec-lang`）；重置密码、二级密码页不放开关，直接沿用登录页选的语言，进入系统后也沿用）。
- 报错一律是 `StatusDialog` 弹窗（系统里面才用小窗 Toast）：弹窗标题由 `pages/login/loginErrors.js` 的 `loginErrorTitle(err)` 决定——几条常见的登录错误有短标题（`login:errorTitles.*`），其余走 `i18n/backendMessages.js` 的 `localizeBackend` 翻成中文，没收录的按后端原文显示。
- 后端新增的重置密码报错（需要登录ID或名字、密码过长、`Please wait Ns…`、维护中等）已补进 `backendMessages.js`。
- 重置密码页的前端校验（验证码没填满、两次密码不一致）也用同样的弹窗。
- 表单都带 `noValidate`，不用浏览器自带的“请填写此字段 / 请包含 @”气泡；必填和邮箱格式由页面自己检查，错误同样走弹窗（文案在 `login:validation.*`）。
