# CLI 規格

> 狀態：草案，待專案負責人審閱  
> 文件版本：0.1.0  
> 最後更新：2026-09-01  
> 適用範圍：API Schema Flow MVP

## 1. 目的

CLI 提供與 Web 相同的核心能力，適用於：

- 本機快速啟動；
- Headless Validation；
- CI；
- Workflow Execution；
- Export；
- Debug Bundle。

Binary 名稱暫定 `schema-flow`，公開前需確認 npm、GitHub 與一般搜尋的名稱可用性。

## 2. 全域語法

```text
schema-flow <command> [input] [options]
```

Global Options：

```text
--config <path>
--cwd <path>
--log-level <silent|error|warn|info|debug>
--json
--no-color
--strict
--offline
--version
--help
```

優先順序：

```text
CLI flag > environment > project config > user config > defaults
```

## 3. Commands

### 3.1 `open`

```bash
schema-flow open ./openapi.yaml
schema-flow open ./schema-flow.config.yaml --port 4173 --mock-port 4010
```

責任：

- 載入 Source/Project；
- 啟動本機 Control Plane、Web UI 與可選 Mock；
- 只綁 Loopback，除非明確 `--host`；
- 選擇可用 Port 或依設定 Fail；
- 顯示 URL、Source Count、Operation Count、Mock URL；
- Ctrl+C 優雅關閉。

Options：

```text
--host <host>
--port <port>
--mock
--mock-port <port>
--open-browser / --no-open-browser
--session <id>
--seed <value>
--allow-path <path>
--allow-private-network
```

若 `--host` 不是 Loopback，CLI 必須顯示安全警告；Control Plane 預設不得對外開放。

### 3.2 `validate`

```bash
schema-flow validate ./openapi.yaml
schema-flow validate ./arazzo.yaml --json
schema-flow validate ./schema-flow.config.yaml --strict
```

輸出：

- Source；
- Detected version；
- Errors/Warnings；
- Support Profile；
- Exit Code。

支援 Project、OpenAPI、Arazzo 與 Config 自動偵測。

### 3.3 `infer`

```bash
schema-flow infer ./openapi.yaml
schema-flow infer ./openapi.yaml --min-confidence 0.75 --output candidates.json
```

預設只輸出 Candidate，不修改 Source。

Options：

```text
--min-confidence <0..1>
--top-k <number>
--rule <id>
--disable-rule <id>
--include-low
--output <path>
--format <table|json|project>
```

`--accept-high` 不列入初始 MVP，避免在 CI 無人審核自動寫入流程。未來若加入，需明確 Policy。

### 3.4 `mock`

```bash
schema-flow mock ./openapi.yaml --port 4010
schema-flow mock ./schema-flow.config.yaml --session test-001 --seed 42
```

輸出：

- Base URL；
- Session；
- Loaded Operations；
- Stateful/Stateless Handler Count；
- Control Plane Status；
- Diagnostics。

Options：

```text
--host <host>
--port <port>
--session <id>
--seed <value>
--validation <strict|warn|off>
--control-port <port>
--no-control-plane
--snapshot <path>
--watch
```

### 3.5 `run`

```bash
schema-flow run ./arazzo.yaml --workflow createReservation
schema-flow run ./project.json --workflow checkout --mode mock --input inputs.json
```

Options：

```text
--workflow <id>
--mode <mock|dry-run|live>
--input <file>
--set <path=value>
--secret <name=ENV_VAR>
--session <id>
--seed <value>
--server <url>
--allow-host <host>
--allow-write
--report <path>
--fail-on-warning
```

規則：

- Live Write 預設阻擋；
- Secret 只能參照 Environment；
- `--set` 不允許標記為 Secret 的欄位；
- Multiple Workflow 且未指定時，TTY 可選；CI 直接 Error；
- Report 預設 Redact。

### 3.6 `export`

```bash
schema-flow export ./project.json --format arazzo --output ./arazzo.yaml
schema-flow export ./project.json --format mermaid --output ./flow.md
```

Options：

```text
--format <arazzo|mermaid|project|run-report>
--workflow <id>
--mode <canonical|preserve|generated>
--output <path>
--stdout
--force
```

不覆寫現有檔案，除非 `--force`。Binary Artifacts 不在 MVP。

### 3.7 `diff`（Post-MVP）

```bash
schema-flow diff base.yaml head.yaml --project project.json --format markdown
```

列入 CLI Namespace，但在實作前不得出現在 Help 中。

### 3.8 `diagnostics`

```bash
schema-flow diagnostics ./project.json --output diagnostics.zip
```

Bundle 預設包含：

- Tool/Node/OS Version；
- Config（Secret Reference only）；
- Diagnostic Codes；
- Timing；
- Source Fingerprint；
- Sanitized Logs。

不含 Source Body、完整 Path、Payload、Token；使用者可明確加入匿名化 Fixture。

## 4. Output Modes

### 4.1 Human-readable

- Stable headings；
- Table 對 TTY Width 自適應；
- Color 只是輔助；
- Error Code 必須可 Copy；
- `--no-color` 與非 TTY 自動關閉 ANSI。

### 4.2 JSON

所有 Command 的 JSON Envelope：

```json
{
  "schemaVersion": 1,
  "command": "validate",
  "status": "failed",
  "result": {},
  "diagnostics": [],
  "timing": {},
  "toolVersion": "0.1.0"
}
```

- Stdout 只有 JSON；
- Logs 到 Stderr；
- Field Additions 在同 Schema Version 可向後相容；
- Breaking 變更增加 `schemaVersion`。

## 5. Exit Codes

| Code | 意義 |
|---:|---|
| 0 | 成功 |
| 1 | Validation、Workflow 或測試失敗 |
| 2 | CLI Usage/Argument Error |
| 3 | Source/File/Network I/O Error |
| 4 | Execution Failure |
| 5 | Security Policy Block |
| 6 | Unsupported Feature |
| 7 | Internal Tool Error |
| 130 | 使用者中斷（SIGINT 慣例） |

`--fail-on-warning` 可將 Warning 轉 Code 1。

## 6. Environment Variables

Prefix：`SCHEMA_FLOW_`

一般設定：

```text
SCHEMA_FLOW_CONFIG
SCHEMA_FLOW_LOG_LEVEL
SCHEMA_FLOW_HOST
SCHEMA_FLOW_PORT
SCHEMA_FLOW_MOCK_PORT
SCHEMA_FLOW_SESSION
SCHEMA_FLOW_SEED
```

Secret 不使用固定名稱，由 Config/CLI Binding 指向使用者自定 Env Var。

CLI `--json` 不得輸出 Env Var 的值。

## 7. Watch Mode

`open`/`mock` 可 `--watch`：

- Watch Entry 與已解析 Local References；
- Debounce；
- 新版解析成功後原子切換 Project；
- 解析失敗時保留上一個可用版本並顯示 Error；
- Existing Session 是否 Reset 由 Config 決定，預設保留但標記 Source Drift；
- 不 Watch Remote URL，除非明確 Poll Interval。

## 8. Port 與 Process

- 使用者指定 Port 已占用：Fail 並提供 Process/替代建議；
- 自動 Port：依固定範圍尋找；
- PID/Lock File 只在需要避免重複啟動時使用；
- Ctrl+C 關閉 HTTP、Watcher、Worker；
- 兩次 SIGINT 強制退出；
- 不留下 Background Daemon。

## 9. Security

- File Path 正規化；
- URL Policy；
- Host Binding Warning；
- Secret Redaction；
- Live Write Gate；
- Shell Output 不回顯 Secret；
- Config Error 不印完整 Environment；
- `--open-browser` URL 不含 Secret Query；
- Debug Log 仍使用 Redaction Layer。

## 10. CLI Acceptance Criteria

1. Web 與 CLI Validation 結果一致；
2. JSON Output 可由 `jq` 解析且 Stdout 無混雜 Log；
3. Exit Codes 穩定；
4. Ctrl+C 優雅退出；
5. Live Write 預設阻擋；
6. Loopback 是預設 Host；
7. 相同 Seed/Project 的 Run 可重現；
8. `--offline` 不發出 Network Request；
9. Existing Output 不被意外覆蓋；
10. Unsupported Feature 使用 Code 6，而非 Internal Error。
