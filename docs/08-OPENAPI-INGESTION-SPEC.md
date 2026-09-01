# OpenAPI 匯入與正規化規格

> 狀態：草案，待專案負責人審閱  
> 文件版本：0.1.0  
> 最後更新：2026-09-01  
> 適用範圍：API Schema Flow MVP

## 1. 範圍

本規格定義 OpenAPI Source 如何被載入、驗證、解析、Dereference、正規化並轉換為 Domain Model。Parser 可以替換，但輸出與 Diagnostic 行為必須一致。

## 2. 支援層級

| OpenAPI 版本 | Import | Normalize | Visualize | Mock/Execute |
|---|---|---|---|---|
| 3.0.x | Supported | Supported | Supported | Supported Profile |
| 3.1.x | Supported | Supported | Supported | Supported Profile |
| 3.2.x | Supported with compatibility diagnostics | Core HTTP model | Core model | Feature-dependent |
| 2.0 | Detect/diagnose | No official MVP guarantee | No official guarantee | No |

3.2.x 的新欄位不得造成 Crash。可安全保留但尚未支援的內容標記為 `preserved-unsupported`。

## 3. Source Types

```ts
type SourceLocation =
  | { kind: 'file'; path: string }
  | { kind: 'url'; url: string }
  | { kind: 'inline'; content: string; mediaType?: string }
  | { kind: 'browser-file'; name: string }
```

MVP 必須支援 YAML 與 JSON。格式判斷順序：

1. 明確 Media Type；
2. 副檔名；
3. 安全內容偵測；
4. 無法判斷時要求使用者選擇，不做寬鬆執行。

## 4. Pipeline

```text
Acquire
  → Enforce Retrieval Policy
  → Detect Syntax
  → Parse
  → Identify Specification Version
  → Validate Structural Requirements
  → Resolve References
  → Extract Source Map
  → Normalize
  → Extract Links/Security/Examples
  → Compute Fingerprint
  → Emit Diagnostics + Domain Model
```

每一階段都必須可測試，且不得只回傳例外字串。

## 5. Retrieval Policy

### 5.1 本機檔案

- 相對 `$ref` 以 Entry Document 所在目錄為 Base；
- 必須阻擋超出允許 Root 的 Path Traversal，除非 CLI 明確 `--allow-path`；
- Symbolic Link Resolution 後仍需檢查 Root；
- 單檔與總讀取大小有上限；
- Binary 或非 UTF-8 內容產生 Diagnostic。

### 5.2 URL

預設：

- 僅 `https:`；Local CLI 可用明確 Flag 允許 `http:`；
- 限制 Redirect 次數；
- 每個 Resource 與總下載大小有限制；
- Connect/Read/Total Timeout；
- Cloud Playground 阻擋 Loopback、Link-local、Private Network 與 Metadata Endpoint；
- Local CLI 允許 Private Network 前必須顯示目標並由 Flag 開啟；
- 不自動帶入使用者 Browser Cookie；
- Authorization 只能由 Environment Reference 提供，且不進入 Project。

### 5.3 Cache

Cache Key 包含 Canonical URI、ETag/Last-Modified（若有）、Retrieval Policy Version。Cache 不得跨不同 Authorization Context 共用敏感內容。

## 6. Parser Adapter

```ts
interface OpenApiParserAdapter {
  parse(input: ParserInput, options: ParserOptions): Promise<ParserResult>
}
```

`ParserResult` 必須包含：

- Entry Document；
- 所有載入 Documents；
- Resolved Reference Graph；
- Source Location Map；
- Parser Diagnostics；
- Detected Version；
- 原始 Extension。

第一個 Adapter 使用 Scalar OpenAPI Parser，但：

- Parser Type 只存在 Adapter Package；
- Domain Model 測試不得依賴 Scalar Snapshot；
- Adapter 可由另一 Parser 進行 A/B Conformance Test；
- Parser Upgrade 必須跑全部 Golden Fixtures。

## 7. Reference Resolution

規則：

- 支援 Internal、Relative File、Relative URL 與 Absolute URL Reference；
- 保留「使用位置」與「定義位置」；
- 偵測 Cycle，不因 Cycle 直接 Crash；
- JSON Schema Recursive/Dynamic Reference 只在 Parser 能正確處理時展開，否則保留 Reference；
- Reference Error 必須包含 Ref String、Base URI 與使用 Pointer；
- 不把 Dereferenced Copy 當作新的獨立 Schema ID。

## 8. Normalization

### 8.1 Paths 與 Methods

- Method 轉為 Uppercase 顯示；
- Path 保留原始 Template；
- Operation 取得 Stable Key；
- 無 `operationId` 時建立 Internal Display ID，例如 `get__reservations_by_id`，但不寫回原文件；
- 重複 `operationId` 產生 Error，仍可用 Stable Key 顯示；
- OAS 3.2 `additionalOperations` 可保留為 Generic Method；
- 不認識的 Operation Field 保留於 Extension/Passthrough。

### 8.2 Parameter 合併

Path Item Parameters 與 Operation Parameters 依規格合併：

- 同 Name + Location 視為同一 Parameter；
- Operation Override Path Item；
- Path Parameter 必須 Required；
- Header Name 比對 Case-insensitive；
- `query` 與 `querystring` 衝突需 Diagnostic。

### 8.3 Request Body

每個 Media Type 形成獨立 `MediaTypeSchema`。UI 可選 Preferred Media Type，預設優先：

1. `application/json`
2. `application/*+json`
3. Form；
4. Text；
5. Binary。

Mock/Executor 不支援的 Serialization 必須標示，不得假裝以 JSON 發送。

### 8.4 Responses

- 保留所有 Status Pattern 與 `default`；
- 選擇成功 Response 時，優先使用最具體、已宣告的 2xx；
- Create 偏好 201、Delete 偏好 204，但只有在 Spec 宣告時；
- Response Header、Content、Links 與 Examples 都需保留；
- Mock 不得產生 Spec 未宣告的 Content Type，除非使用者開啟 Lenient Mode。

### 8.5 Security

正規化：

- API Key（header/query/cookie）；
- HTTP Bearer/Basic；
- OAuth2/OpenID Connect Metadata；
- Operation Override；
- Optional Security `{}`。

Project 只保存 Secret Reference，例如 `${SCHEMA_FLOW_TOKEN}`，不得保存解析後值。

### 8.6 Examples

優先順序：

1. Operation/Media Type 明確 Example；
2. Example Object；
3. Schema `examples`；
4. Schema `default`；
5. Deterministic Generator。

非法 Example 產生 Warning；是否阻擋由 Strict Mode 決定。

## 9. OpenAPI Link

Link 轉換為 Declared Edge：

- `operationRef` 優先解析；
- `operationId` 必須唯一；
- Parameters Key 可含 Location Qualification；
- Runtime Expression 轉為 Data Mapping；
- Request Body Mapping 保留；
- Link 無法唯一解析時為 Error；
- Link 只表達可追蹤關係，不保證權限或執行成功。

## 10. Source Pointer

每個 Operation、Parameter、Schema、Response、Link 都應可回到：

```ts
interface SourceReference {
  sourceId: string
  documentUri: string
  pointer: string
  line?: number
  column?: number
}
```

若 Parser 無法提供 Line/Column，Pointer 仍為必需。UI 的「Open Source」功能以此為基礎。

## 11. Diagnostics 範例

- `OAS-UNSUPPORTED-VERSION`
- `OAS-DUPLICATE-OPERATION-ID`
- `OAS-UNRESOLVED-REF`
- `OAS-REF-POLICY-BLOCKED`
- `OAS-PATH-PARAM-NOT-REQUIRED`
- `OAS-LINK-TARGET-NOT-FOUND`
- `OAS-LINK-TARGET-AMBIGUOUS`
- `OAS-EXAMPLE-SCHEMA-MISMATCH`
- `OAS-UNSUPPORTED-SERIALIZATION`
- `SEC-REMOTE-PRIVATE-NETWORK-BLOCKED`

## 12. 效能與資源限制

預設限額應可設定：

- 單一文件大小；
- 總文件數；
- 總下載大小；
- Reference Depth；
- YAML Alias Expansion；
- JSON Nesting Depth；
- Operation Count；
- Schema Node Count。

超限時提供可調整的錯誤，不進行部分不可信解析。

## 13. Acceptance Criteria

1. Multi-file Relative `$ref` 能解析且 Pointer 正確；
2. Circular Schema 不造成 Stack Overflow；
3. Duplicate Operation ID 可顯示所有 Operation 並阻擋 Arazzo operationId 歧義；
4. OpenAPI Link 轉換為 Declared Edge；
5. Header Case 不造成重複 Parameter；
6. 相同 Source 產生相同 Stable Key 與 Fingerprint；
7. 3.2 未支援欄位保留並有 Support Metadata；
8. Remote Ref 政策在 Browser、Local CLI 與 CI 模式有明確差異；
9. Parser Exception 不洩漏 Secret 或完整敏感 Payload。
