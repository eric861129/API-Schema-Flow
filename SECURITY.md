# Security Policy

API Schema Flow 會處理 OpenAPI/Arazzo 文件、遠端 `$ref`、HTTP Request、Response、Token、Cookie 與本機 Mock Server，因此安全性不是附加功能，而是核心需求。

## 回報方式

公開 Repo 上線前必須啟用 **GitHub Private Vulnerability Reporting**。安全問題請優先透過該機制私下回報，不要先建立公開 Issue。

一般 Bug 可以使用公開 Issue；可能造成 Secret 外洩、任意程式執行、SSRF、Path Traversal、XSS、權限繞過或遠端 DoS 的問題，應使用私人安全回報。

## 支援範圍

| 版本 | 安全修補 |
|---|---|
| `main` | 支援 |
| 最新公開 Pre-release | 支援 |
| 較舊 Pre-release | 僅在可合理 Backport 時處理 |
| 尚未公開的本機修改版 | 不提供正式支援 |

v1.0 後將改為「最新 Minor 與前一個 Minor」政策，並在 Release 文件中公告。

## 回應目標

- 3 個工作天內確認已收到；
- 7 個工作天內提供初步嚴重度與處理方向；
- 修補發布前與回報者協調 Disclosure；
- CVE、GHSA 與公開說明依影響程度決定。

這些是維護目標，不是法律或服務層級承諾。

## Secure Defaults

- UI 與 Mock Server 預設只綁定 Loopback；
- 預設不傳送 Telemetry；
- 預設不保存 Authorization、Cookie、Set-Cookie、API Key；
- 遠端 URL 與 `$ref` 受協定、大小、Redirect、Private Network 與 Timeout Policy 約束；
- MVP 不允許任意 JavaScript Resolver；
- 使用者提供的 Markdown 必須 Sanitization；
- Snapshot 與 Run Report 輸出前必須 Redaction；
- Cloud Playground 不得代理任意私有網路資源。

完整威脅分析請見 [docs/19-SECURITY-THREAT-MODEL.md](docs/19-SECURITY-THREAT-MODEL.md)。

## Dependency Security

- 鎖定 Lockfile；
- 自動 Dependency Update PR；
- CI 執行 Audit、License Check 與 Secret Scan；
- 高風險 Parser、YAML、Markdown 與 HTTP 依賴需優先評估；
- 發布套件使用 Provenance 與最小 npm 權限；
- 發布 Token 不得提供給一般 CI Job。

## 安全研究範圍

在不存取他人資料、不攻擊第三方服務、不造成資源耗盡的前提下，歡迎測試：

- Parser 與 Reference Resolution；
- Project File 與 Snapshot Import；
- Mock Control Plane；
- Markdown/Schema Rendering；
- CLI File/URL Handling；
- Session Isolation；
- Report Redaction。

不接受對第三方 API、npm、GitHub 或無關基礎設施的破壞性測試。
