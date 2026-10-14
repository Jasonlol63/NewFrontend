# Reset Password 页面（Admin / Owner）

> **文件**：`src/pages/login/ResetPasswordPage.jsx`（路由 `/reset-password`，登录页的 Forget Password 链接进入）。
> **后端**：`Count/docs/reset-password-tac-implementation.md` 第 8 节。

## 1. 三步流程

| 步骤 | 内容 | 接口 |
|---|---|---|
| 1 | 角色（Admin / Owner）→ Company / Group ID → Login ID（或切换成 Name）→ 邮箱 | `POST /auth/send-reset-tac` |
| 2 | 输入 6 位验证码，可重发（60 秒冷却，与后端一致） | 重发再调 `send-reset-tac` |
| 3 | 新密码 + 确认密码（有强度条） | `POST /auth/reset-password`（带上验证码） |
| 4 | 成功页，回登录 | — |

- **第 2 步的 Continue 不请求后端**：验证码是一次性的，由后端在第 3 步提交新密码时一起校验并消耗。如果这时后端说验证码无效/过期，页面自动退回第 2 步并清空验证码。
- 第 1 步成功只代表「如果账号存在，验证码已发送」（后端对任何输入回同一句话），页面不暴露账号是否存在。
- 忘了登录 ID：登录 ID 输入框右侧有 `ID | Name` 小开关，切到 Name 就改填名字；仍需填登记的邮箱。
- 本页**没有二级密码输入**：重置只改主密码，二级密码保持不变（要改找客服）。

## 2. 校验

- 前端：新密码至少 6 位、两次一致；其余错误直接显示后端返回的 message（红字，`role="alert"`）。
- 后端同样校验（6 位以上、≤72 字节），前端校验只是提前提示。
- 公司 ID、登录 ID 输入时转大写（与登录页一致），名字保持原样。
