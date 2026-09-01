# ADR-0003：Mock Runtime 與傳輸 Adapter 分離

- 狀態：Proposed
- 日期：2026-09-01
- 決策者：Project Owner
- 影響範圍：Mock、CLI、Web、Execution、Testing
- 相關文件：[Stateful Mock Runtime Spec](../11-STATEFUL-MOCK-RUNTIME-SPEC.md)

## Context

MVP 需要：

- CLI 啟動真正本機 HTTP Mock Server；
- Browser Playground 可攔截 Request；
- Workflow Executor 可直接呼叫 Mock；
- Test 可無 Port 快速執行；
- 所有入口共用相同 Stateful CRUD、Session、Seed、Fault、Snapshot 與 Trace。

Fastify 與 MSW 解決不同問題：Fastify 建立 HTTP Server；MSW 在目前 Process/Browser 攔截 Request。若把 State/Business Logic 寫在兩者的 Handler 中，行為會分叉。

## Decision

建立 Framework-neutral Shared Mock Runtime：

```ts
interface MockRuntime {
  handle(
    request: RuntimeRequest,
    context: RuntimeContext
  ): Promise<RuntimeResponse>
}
```

核心包含：

- Route Matching；
- Resource Lifecycle；
- In-memory Store；
- Session Isolation；
- Seed/ID Generation；
- Fault Profile；
- Snapshot/Restore；
- State Mutation/Trace Events；
- Redaction Boundary。

Adapter：

- `adapter-fastify`：HTTP/Data Plane 與 Local Server Lifecycle；
- `adapter-msw`：Browser/Test Interception；
- `execution` 可透過 Direct Mock Transport 或 HTTP Transport；
- 未來 Adapter 必須通過同一 Contract Test。

Control Plane 與 Mock Data Plane 分離。Reset/Snapshot/Fault 管理不得隱藏成一般 Mock Route。

## Consequences

### Positive

- Stateful 行為只實作一次；
- CLI、Playground、Test 行為一致；
- Runtime 易於純函式/狀態機測試；
- 未來可加入 Hono/Bun/Worker；
- 不把 MSW 誤當外部 Process 可呼叫的 Server；
- Adapter 可各自處理 Protocol 細節。

### Negative

- 需要定義協定中立 Request/Response；
- Streaming、Multipart、Cookie、Binary 等能力需明確抽象；
- Adapter Parity Test 成本增加；
- Direct Transport 與 HTTP Transport 的細微差異需記錄。

### Risks

- 為追求完全抽象而設計過度複雜；
- Framework-specific Header/Stream 語意遺失；
- Control/Data Plane 認證錯誤；
- Adapter 各自產生不同 Trace。

控制：

- MVP 先支援 JSON/Text 與明確 Binary 限制；
- Contract Test；
- Capability Flag；
- Trace Event 由 Runtime 產生；
- Protocol-specific Diagnostic；
- 不提前支援所有 HTTP Edge Case。

## Alternatives Considered

### Fastify Handler 直接實作 Stateful Mock

拒絕。Browser/Test 需要重寫，核心被 Node Framework 綁定。

### 只使用 MSW

拒絕。無法作為外部前端程式或其他 Process 可連線的獨立 Local Server。

### 同時維護 Fastify/MSW 兩套 Handler

拒絕。狀態、Fault 與錯誤語意容易漂移。

### 先做 Static Mock，再重構

只允許短期 Spike，不作正式架構。Stateful Mock 是核心價值，應從一開始保留正確邊界。

## Acceptance

- Mock Runtime Package 不依賴 Fastify/MSW；
- Fastify Contract Test 通過；
- MSW 進入版本時套用相同 Contract；
- 同一 Seed/Session/Request 產生等價結果；
- Control Plane 分離；
- Adapter-specific Type 不進入 Domain/Runtime Public API。
