# Account Link 后端改动记录(Link Account 弹窗)

对应前端:`frontend/src/pages/account/LinkAccountModal.jsx`、`linkAccountApi.js`。前端设计见 `frontend/docs/mockups/link-account-modal.html`。

## 背景与规则

- 表 `account_link` **一对账号只存一行**(唯一键 `account_id_1, account_id_2, tenant_id`),行里记 `link_type`(BIDIRECTIONAL / UNIDIRECTIONAL)和 `source_account_id`(单向时的发起方)。**本次没有改表结构。**
- 每个被选的账号各自带方向:
  - 双向:两个账号的弹窗里都能看到对方并勾着。
  - 单向(A1 → A2):A1 的数据可见性规则不变,即只有 A1 能"看到" A2;但在 Link Account 弹窗里,A2 也能看到这一条,标记为"对方指向我"。
- 不再有"已经 link 过"的冲突:A2 选 A1 时按下面的合并规则处理。

## 改动清单

| 文件 | 改动 |
|---|---|
| `controller/UserController.java` | 新增 `GET /api/account/link/manage` |
| `service/UserService.java` | 新增 `getLinksForManage(accountId, tenantId)` |
| `service/impl/UserServiceImpl.java` | `insertAccountLink` 改成合并逻辑并加 `@Transactional`;新增 `getLinksForManage` |

### 1. `POST /api/account/link`(`insertAccountLink`)——已存在时合并,不再报错

以前这一对已存在就抛 `Accounts are already linked in this tenant`。现在:

| 已存在 | 请求 | 结果 |
|---|---|---|
| 双向 | 任何 | 不变(不会被降级) |
| 单向,source = X | 单向,source = X(同一方向) | 不变 |
| 单向,source = X | 双向 | 升级为双向 |
| 单向,source = X | 单向,source = Y(反方向) | 升级为双向(两个账号互相都能看到) |
| 不存在 | 任何 | 新增一行 |

- 升级的做法:删掉旧行,再插入一条双向(`source_account_id = NULL`)。方法已加 `@Transactional`,不会只做一半。
- "不变"的情况仍会设置 `userLink.id` 并写审计 after 快照,避免审计切面拿到空 id。
- 降级(双向 → 单向、改变单向方向)**不走这里**,仍由 `PUT /api/account/link`(先删后建)负责。

### 2. 新增 `GET /api/account/link/manage?account_id=&tenant_id=`

只给 Link Account 弹窗用,返回该账号参与的**所有**链接:

```json
{
  "accounts": [ /* 对端账号,UserListDTO */ ],
  "link_types_map": { "<对端 id>": "bidirectional" | "unidirectional" },
  "incoming_ids": [ /* 单向且 source 不是本账号,即"对方指向我" */ ],
  "tenant_id": 1
}
```

- 校验和 `/link/list` 一致:要登录,且 `tenant_id` 必须等于 session 的租户。
- **`GET /link/list`(`getLinkedAccounts`)没有改。** 它"单向只返回给 source 一方"的规则决定了谁能看到谁的数据(Member 页等),所以弹窗另开接口,不动它。

## 前端如何使用

- Save 时只发有变化的:新增 → `POST /link`;取消 → `DELETE /link/pair`;改方向 → `PUT /link`。
- "对方指向我"的链接:弹窗里只能升级为双向(发 `PUT /link`,双向),不能取消,也不能改成别的方向;要取消得到发起方账号里操作。
- 逐条请求,没有批量接口;中途某条失败不回滚,已成功的保留,底部显示错误。

## 上线与验证

- 不需要执行数据库迁移。
- 改了后端,需要重启后端服务。
- 验证:
  1. A1 单向选 A2 并保存 → A2 的弹窗里应看到 A1(浅色 ←),`/link/list?account_id=A2` 仍不返回 A1。
  2. 在 A2 把它升级成双向并保存 → A1 里 A2 变成双向。
  3. A1 已单向看 A2 时,A2 里选 A1(双向)→ 不再报 "already linked",结果为双向。
