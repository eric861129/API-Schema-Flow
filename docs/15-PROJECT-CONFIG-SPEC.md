# Project Configuration 規格

> 狀態：草案，待專案負責人審閱  
> 文件版本：0.1.0  
> 最後更新：2026-09-01  
> 適用範圍：API Schema Flow MVP

## 1. 目的

`schema-flow.config.yaml` 描述 Project Source、Workflow、Inference、Mock、Execution、UI、Export 與 Security Policy。它是可版本控制的設定，不是 Secret Store。

## 2. 文件名稱與版本

預設檔名：

```text
schema-flow.config.yaml
schema-flow.config.yml
schema-flow.config.json
```

Root Version：

```yaml
schemaFlow: 1
```

Config Schema Version 與 Package Version 分開。Breaking Config Change 必須增加整數版本並提供 Migration。

## 3. 完整範例

```yaml
schemaFlow: 1

project:
  name: reservation-demo
  description: Stateful reservation workflow example

sources:
  - id: reservationApi
    type: openapi
    location: ./examples/reservation/openapi.yaml

  - id: reservationFlows
    type: arazzo
    location: ./examples/reservation/arazzo.yaml

inference:
  enabled: true
  minimumConfidence: 0.75
  includeLowConfidence: false
  topKPerTarget: 5
  rules:
    disable: []
    weights:
      INF-RESOURCE-ID: 25

mock:
  host: 127.0.0.1
  port: 4010
  validation: strict
  seed: reservation-demo
  sessions:
    header: X-Schema-Flow-Session
    ttl: 2h
  state:
    resetOnSourceChange: false
  controlPlane:
    enabled: true
    host: 127.0.0.1
  faults:
    defaults:
      delayMs: 0
      jitterMs: 0

execution:
  defaultMode: mock
  maxAttemptsPerStep: 5
  maxRetryDurationMs: 30000
  stepTimeoutMs: 10000
  live:
    allowedHosts: []
    allowWrites: false

ui:
  theme: system
  layoutDirection: RIGHT
  showMiniMap: true
  rememberRecentProjects: true

export:
  mode: canonical
  directory: ./generated
  redact: true

security:
  remoteReferences:
    allowHttp: false
    allowPrivateNetworks: false
    maxRedirects: 3
    timeoutMs: 10000
  redaction:
    headers:
      - authorization
      - cookie
      - set-cookie
      - x-api-key
    jsonPointers:
      - /password
      - /token
      - /refreshToken

secrets:
  bindings:
    apiToken:
      env: RESERVATION_API_TOKEN
```

## 4. Config Resolution

優先順序：

1. CLI Flag；
2. Environment；
3. Project Config；
4. User Config；
5. Built-in Default。

User Config 只能保存一般偏好，例如 Theme、Recent Projects、Default Port Range，不可弱化 Project Security Policy。安全設定採「更嚴格者優先」，除非使用者以明確 CLI Flag 開啟並得到警告。

## 5. Paths 與 URI

- 相對 Path 以 Config 所在目錄為 Base；
- Output Path 解析後必須仍在允許 Root，除非明確允許；
- URL 必須通過 Retrieval Policy；
- Windows/Unix Path 在 Project JSON 中使用 URI 或 normalized relative path；
- 不保存 Temporary Browser Blob URL；
- Symlink Resolution 依 Security Spec。

## 6. Sources

```yaml
sources:
  - id: bookingApi
    type: openapi
    location: ./openapi.yaml
    headers:
      Authorization:
        secret: sourceReadToken
```

要求：

- `id` 唯一、穩定；
- `type` 為 openapi/arazzo；
- `location` 為 Path/URL；
- Source Header 只能參照 Secret Binding；
- Browser Playground 不允許任意 Authenticated Remote Source；
- Source 可設定 `watch`、`strict`、`allowPath` 等受限 Override。

## 7. Inference

```yaml
inference:
  enabled: true
  minimumConfidence: 0.75
  topKPerTarget: 5
  rules:
    enable:
      - INF-AUTH-BEARER
    disable:
      - INF-OPERATION-NAME
    weights:
      INF-TAG-SAME: 2
```

限制：

- Rule ID 不存在時 Error；
- Weight 有合理範圍；
- 設定不可讓 Generic ID 單獨成為 High；
- Rule Set 與 Config 進入 Inference Fingerprint；
- `acceptAutomatically` 不在 MVP Schema。

## 8. Mock

### 8.1 Resource Override

```yaml
mock:
  resources:
    reservations:
      collectionOperationId: listReservations
      createOperationId: createReservation
      itemOperationId: getReservation
      idField: id
      idParameter: reservationId
```

### 8.2 Seed Data

```yaml
mock:
  seedData:
    reservations:
      - id: r-001
        status: confirmed
```

Seed Data 必須通過 Response/Entity Schema Validation。疑似 Secret Field 產生 Warning。

### 8.3 Fault

```yaml
mock:
  operations:
    createReservation:
      delayMs: 800
      attemptRules:
        - attempt: 1
          status: 429
```

Operation Reference 歧義時要求使用 Stable Key。

## 9. Execution

```yaml
execution:
  defaultMode: mock
  stepTimeoutMs: 10000
  maxAttemptsPerStep: 5
  live:
    allowedHosts:
      - api.example.com
    allowWrites: false
```

- Allowed Host 支援精確名稱與受限 Pattern；
- 不允許 `*` 作為預設；
- `allowWrites` 仍可被 CLI/UI 更嚴格限制；
- Retry 上限不能被 Workflow 無限放大。

## 10. Security 與 Secrets

Secret Binding：

```yaml
secrets:
  bindings:
    bookingToken:
      env: BOOKING_TOKEN
```

Project 保存名稱與 Env Var 名稱，不保存值。

可支援未來 Provider：

- OS Keychain；
- 1Password CLI；
- Vault；
- Interactive prompt。

MVP 先支援 Environment 與 Interactive Prompt。

禁止：

```yaml
secrets:
  bookingToken: actual-secret-value
```

Validator 應偵測高熵值與常見 Token Pattern，阻擋或強烈警告。

## 11. Redaction

Header 名稱 Case-insensitive。JSON Pointer 可套用到 Request、Response、Inputs、Outputs、State 與 Reports。

Built-in Redaction 不能被完全關閉於 Export；Debug Mode 若允許顯示敏感內容，必須只在本機 UI、不可自動存檔，且有明顯警告。

## 12. Environment Interpolation

一般字串可使用：

```yaml
port: ${SCHEMA_FLOW_MOCK_PORT:-4010}
```

規則：

- Secret 與一般 Env 分開；
- 未定義 Required Env 為 Config Error；
- Default 不可用於 Secret；
- 插值後 Config Export 不寫回值；
- Diagnostic 只顯示 Env Name。

## 13. JSON Schema 與 Editor Support

Repo 應發布 Config JSON Schema：

```text
https://.../schema-flow-config.schema.json
```

YAML 頂端可加：

```yaml
# yaml-language-server: $schema=...
```

Schema 提供：

- Completion；
- Enum；
- Description；
- Deprecation；
- Version；
- Conditional fields。

CLI `schema-flow config init` 可在 Post-MVP 加入，非 MVP 必需。

## 14. Migration

- v1 Config 由工具讀取；
- 新版 Migration 產生新檔或 Patch Preview；
- 不自動覆寫；
- Deprecated Field 至少保留一個 Minor；
- Secret Field Migration 不讀取或寫出 Secret；
- Migration 可在 `validate --fix-preview` 顯示。

## 15. Diagnostics

- `CFG-VERSION-UNSUPPORTED`
- `CFG-SOURCE-ID-DUPLICATE`
- `CFG-PATH-OUTSIDE-ROOT`
- `CFG-RULE-NOT-FOUND`
- `CFG-SECRET-LITERAL-FORBIDDEN`
- `CFG-ENV-MISSING`
- `CFG-HOST-PATTERN-INVALID`
- `CFG-PORT-CONFLICT`
- `CFG-RESOURCE-REFERENCE-AMBIGUOUS`
- `CFG-MIGRATION-REQUIRED`

## 16. Acceptance Criteria

1. YAML/JSON 行為一致；
2. Relative Path 以 Config Directory 解析；
3. CLI Override 正確；
4. Secret 值永不序列化；
5. Unknown Field 在 Strict Mode Error、Lenient Mode Warning；
6. Config Schema 提供 Editor Completion；
7. Security Setting 不會被 User Config 靜默弱化；
8. Migration 不覆寫原檔；
9. 相同 Config 產生相同 Effective Config Hash；
10. Invalid Rule/Operation Reference 有明確 Pointer。
