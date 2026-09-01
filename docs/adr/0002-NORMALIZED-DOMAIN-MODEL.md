# ADR-0002：採用自有 Normalized Domain Model

- 狀態：Proposed
- 日期：2026-09-01
- 決策者：Project Owner
- 影響範圍：所有核心 Package
- 相關文件：[Domain Model](../07-DOMAIN-MODEL.md)、[System Architecture](../06-SYSTEM-ARCHITECTURE.md)

## Context

API Schema Flow 需要同時處理：

- OpenAPI 3.0/3.1 與較新版本的相容模式；
- Arazzo Workflow；
- Parser-specific AST/Type；
- OpenAPI Link；
- Inferred/Manual/Observed Edge；
- Stateful Mock；
- Run/Trace；
- Project Persistence；
- Web、CLI、Fastify、MSW 與未來 CI。

若直接把 Parser AST、React Flow Node、ELK Graph 或 Fastify Request 當成核心模型，Framework/Library 升級會擴散到全專案，且 CLI/Web 可能產生不同語意。

## Decision

建立框架無關、版本化的 `@api-schema-flow/domain`，作為唯一共享語意模型。

Domain Model：

- 不依賴 React、React Flow、ELK、Fastify、MSW、Parser 或 Faker；
- 使用 Stable ID 與 Source Pointer；
- 明確表示 Provenance、Evidence、Decision 與 Mapping；
- 區分 Source Document、Normalized Operation、Workflow、Mock 與 Trace；
- 所有持久化結構有 Schema Version；
- 保留必要 Unknown/Extension Data；
- 使用 Runtime Validation 驗證外部資料；
- 以 Adapter 將 Parser/UI/Transport 型別轉換進出 Domain。

## Consequences

### Positive

- Parser 與 Framework 可替換；
- Web/CLI/CI 共用同一語意；
- Flow-aware Diff 有穩定關係資料；
- Project/Run 格式可版本化與遷移；
- 核心邏輯可快速單元與 Property Test；
- 避免 React Flow Graph 成為資料庫。

### Negative

- 初期需要額外 Mapping 層；
- 必須維護 Domain Schema 與 Migration；
- 可能與上游規格 Type 有重複；
- Unknown Field Preservation 需要設計；
- 團隊必須遵守 Package Boundary。

### Risks

- Normalized Model 過度抽象而丟失標準細節；
- Stable ID 演算法改變造成 Project Diff；
- Domain 成為過大的「God Package」。

控制：

- Source Pointer 與 Raw Extension Preservation；
- 以小型 Subdomain Type 組成；
- Public API Review；
- Boundary/Dependency Test；
- Arazzo/OpenAPI Round-trip Tests；
- Schema Migration Policy。

## Alternatives Considered

### 直接使用 Scalar/Swagger Parser Type

拒絕。讓 Parser 變成整體 Public Contract，難以替換，且無法自然涵蓋 Mock/Trace。

### 直接使用 React Flow Node/Edge

拒絕。UI 的 Position/Selection 不等於 Workflow 語意，CLI 也不應依賴 React。

### 每個 Package 自己定義 Type

拒絕。會產生重複 Mapping、語意漂移與不可追蹤關係。

### 以 JSON Schema 作唯一模型、不使用 TypeScript Domain

拒絕作為唯一策略。JSON Schema 適合格式驗證，但核心行為仍需要清楚的 Domain API 與 Invariants。

## Acceptance

- `domain` 無 Framework Runtime Dependency；
- Parser/UI/Adapter Type 不出現在 Public Domain API；
- Stable ID、Serialization、Migration 有測試；
- Package Boundary CI 能阻止 Deep Import/Cycle；
- Canonical Example 在 Web/CLI 使用同一 Project Model。
