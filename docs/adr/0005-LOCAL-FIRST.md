# ADR-0005：MVP 採 Local-first 與 No Telemetry by Default

- 狀態：Proposed
- 日期：2026-09-01
- 決策者：Project Owner
- 影響範圍：產品、架構、安全、Demo、商業模式
- 相關文件：[Security Threat Model](../19-SECURITY-THREAT-MODEL.md)

## Context

API 規格、內網 Host、Schema、Example、Token 與 Trace 可能屬敏感企業資料。若核心功能要求上傳雲端，會增加採用阻力、安全責任、營運成本與法規問題，也使開源專案過早投入帳號、儲存、隔離與多租戶。

本產品的 MVP 價值——匯入、拓撲、推導、Stateful Mock、執行、Trace、Export——可在本機完成。

## Decision

MVP 採 Local-first：

- 核心處理在使用者本機；
- 不需要帳號；
- 不需要 Hosted Backend；
- Mock 預設 Loopback；
- State 預設記憶體；
- Project/Export 由使用者明確保存；
- Telemetry、Crash Upload 與規格上傳預設關閉；
- Remote Source/Live API 需 Policy 與明確 Opt-in；
- 靜態 Playground 不保存使用者內容；
- 核心檔案格式保持 Vendor-neutral。

未來可提供 Hosted/Collaboration，但須另建 Product Spec、Threat Model、Data Retention、Tenant Isolation 與 ADR。Hosted 能力不得成為使用開源核心的必要條件。

## Consequences

### Positive

- 降低企業採用與隱私疑慮；
- 無雲端基礎設施即可發布；
- 開發者可離線使用；
- 核心更容易測試與自架；
- 避免初期被帳號、同步、計費分散；
- 產品定位清楚。

### Negative

- 初期缺少多人協作與跨裝置同步；
- 使用資料與產品分析較少；
- Bug Report 需要使用者主動提供已遮罩資訊；
- Browser/CLI 的本機整合較複雜；
- 使用者需管理 Project Artifact。

### Risks

- 宣稱 No Telemetry，但 Dependency/Hosting 仍有外部請求；
- Autosave 意外保存敏感資料；
- Remote Ref 造成 SSRF；
- Loopback Server 被惡意網頁呼叫；
- 未來 Hosted 與 Open-source Core 產生功能落差。

控制：

- Network Inventory 與 CSP；
- No Telemetry Test；
- Redaction/Storage Policy；
- Origin/Control Token；
- Remote Loader Policy；
- 公開 Vendor-neutral Format；
- Hosted Proposal 需單獨治理。

## Alternatives Considered

### Cloud-first Workspace

拒絕作為 MVP。增加大量與核心價值無關的安全與營運工作。

### 完全 Browser-only

拒絕作為唯一模式。CLI、Local HTTP Server、檔案與 CI 需要 Node Runtime。

### 匿名 Telemetry 預設開啟

拒絕。API 規格工具的信任成本高；未來即使收集也需明確 Opt-in 與可檢視 Payload。

### Desktop App

可作未來 Packaging，但不應先於 Web+CLI Core，避免增加 Update/Signing/Platform Adapter 成本。

## Acceptance

- Core Feature 無帳號/雲端仍可使用；
- Network Requests 有清楚來源與 Policy；
- Mock Loopback/CORS/Control Plane 安全測試；
- Project/Trace/Autosave 不含未遮罩 Secret；
- README 明確說明 Local-first；
- 未來 Telemetry 需新決策，不能在 Patch 中默默加入。
