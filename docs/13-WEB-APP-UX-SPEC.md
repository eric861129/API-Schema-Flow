# Web Application UX 規格

> 狀態：草案，待專案負責人審閱  
> 文件版本：0.1.0  
> 最後更新：2026-09-01  
> 適用範圍：API Schema Flow MVP

## 1. 產品介面定位

Web App 是「API Workflow Workbench」，不是傳統 Swagger Reference，也不是完整 API Client。畫面設計必須讓使用者快速回答四個問題：

1. 我載入了哪些 API？
2. 哪些 Operation 可能形成流程？
3. 資料如何從前一步流到下一步？
4. 這段流程實際執行時發生了什麼？

MVP 採 Desktop-first。建議最小可編輯寬度 1024 px；較小尺寸提供 Read-only/Inspector 模式，不承諾完整拖拉編輯。

## 2. Information Architecture

```text
Welcome / Import
  └─ Workspace
      ├─ Sources
      ├─ Topology
      ├─ Workflows
      ├─ Inference Review
      ├─ Mock Sessions
      ├─ Runs
      ├─ Exports
      └─ Diagnostics
```

## 3. Workspace Layout

```text
┌────────────────────────────────────────────────────────────┐
│ Project / Source / Run Mode / Search / Run / Export       │
├──────────────┬──────────────────────────────┬──────────────┤
│ Left Panel   │ Canvas                       │ Inspector    │
│ Sources      │ Nodes, Edges, Groups         │ Schema       │
│ Workflows    │ MiniMap, Controls            │ Mapping      │
│ Candidates   │                              │ Mock/Fault   │
├──────────────┴──────────────────────────────┴──────────────┤
│ Bottom Panel: Diagnostics / Trace / State / Console       │
└────────────────────────────────────────────────────────────┘
```

Panel 必須可收合、調整寬度與恢復預設。Layout State 與 Workflow Semantic State 分開保存。

## 4. 首次進入與 Import

### 4.1 Welcome Screen

包含：

- 拖拉 OpenAPI/Arazzo；
- 選擇本機檔案；
- 輸入 URL；
- 開啟 Sample；
- 開啟 Project JSON；
- 顯示「資料只在本機處理」；
- 顯示目前支援版本。

不得：

- 要求登入；
- 預設上傳；
- 使用「完全自動理解所有流程」等誤導文案；
- 在尚未發布時顯示可用的 npm 指令。

### 4.2 Import Progress

階段化顯示：

```text
Loading → Parsing → Resolving refs → Normalizing → Building graph → Laying out
```

每階段顯示：

- 已完成數量；
- 當前 Source；
- 可取消；
- Warning Count；
- 超過 2 秒後顯示具體進度。

取消後不得殘留半完成 Project；可保留已產生的 Diagnostics。

### 4.3 Import Result

- 成功：直接進 Workspace，顯示來源與 Operation Count；
- 有 Warning：進 Workspace，Diagnostics Badge；
- Blocking Error：保留 Source Viewer 與 Diagnostics，不建立可執行 Project；
- Partial Support：顯示 Compatibility Banner。

## 5. Canvas

### 5.1 Endpoint Node

最小資訊：

- HTTP Method Badge；
- Path；
- Summary 或 Operation ID；
- Auth Lock；
- Request/Response Warning Count；
- Mock Support Status；
- Workflow Participation Count。

Method 不可只靠顏色。Badge 同時顯示文字與可辨識 Shape/Icon。

### 5.2 Node States

- Default；
- Hover；
- Selected；
- Running；
- Passed；
- Failed；
- Unsupported；
- Dimmed by filter；
- Has candidate edges；
- Has diagnostics。

狀態應有 Border、Icon、Text 或 Pattern，顏色只是輔助。

### 5.3 Edge

Edge 顯示：

- Source → Target；
- Mapping 摘要；
- Provenance；
- Status；
- Confidence（只對 Inferred/Observed）；
- Evidence Count；
- Execution Animation。

建議視覺：

- Declared：實線 + 標籤；
- Manual：實線 + 手動 Icon；
- Inferred Candidate：虛線；
- Rejected：預設隱藏；
- Observed：點線 + Observation Count；
- Control Edge 與 Data Edge 使用不同線型/箭頭。

### 5.4 大型圖

必須提供：

- 搜尋；
- Method/Tag/Service/Workflow/Provenance Filter；
- Focus Mode；
- Collapse Group；
- Hide Isolated；
- Show only neighbors；
- Fit Selection；
- Layout Direction；
- MiniMap 可關閉；
- Progressive Rendering。

不得一次將所有 Schema Field 展開在 Node 內。

## 6. Inspector

Tabs：

1. Overview
2. Request
3. Responses
4. Security
5. Links/Dependencies
6. Mock
7. Source

### 6.1 Schema Tree

- Required、Type、Format、Nullable、Read/Write-only；
- Example/Default；
- Copy JSON Pointer；
- Search；
- Recursion Marker；
- 展開深度限制；
- Source Link；
- 不安全 Markdown 只以 sanitized renderer 顯示。

### 6.2 Source

顯示 YAML/JSON 與 Pointer。MVP 可 Read-only；若提供 Editor，必須有 Validate Before Apply 與 Unsaved Indicator。

## 7. Inference Review

### 7.1 Candidate List

每張卡顯示：

```text
POST /reservations → GET /reservations/{id}
reservationId → path.id
Confidence: High · 0.93
Evidence:
  ✓ normalized name match
  ✓ string schema compatible
  ✓ same resource
  ✓ create-to-read lifecycle
```

Actions：

- Accept；
- Reject；
- Edit Mapping；
- Show on Canvas；
- Open Source/Target Schema；
- Explain Score。

### 7.2 Review Rules

- 預設依 Confidence + Target Importance 排序；
- High/Medium/Low 分組；
- Batch Accept 只對 High，仍需二次摘要；
- Reject 可選原因：wrong resource、wrong field、not a workflow、duplicate、other；
- Reject Reason 可匿名輸出至本機 Benchmark，但不預設上傳；
- Accepted Edge 立即從 Candidate 移至 Workflow Draft。

### 7.3 Mapping Editor

左右欄：

- Source Response Tree；
- Target Path/Query/Header/Body Tree。

使用者拖拉或點選 Mapping，系統即時顯示：

- Type Compatibility；
- Required；
- Transform；
- Example Preview；
- Runtime Expression Preview；
- 是否可輸出 Arazzo。

## 8. Workflow Editor

### 8.1 View

Workflow Instance Node 必須顯示 Step ID，不可只顯示 Operation。左側列出 Workflow，Canvas 顯示 Step Order 與 Data Mapping。

### 8.2 Editing

MVP 支援：

- Rename Workflow/Step；
- Reorder synchronous Steps；
- Add/remove Operation Step；
- Map Inputs/Outputs；
- Edit Parameters/JSON Body；
- Add Simple Success Criteria；
- Configure Timeout/Retry；
- Validate；
- Export Arazzo。

不支援的控制結構顯示 Read-only，不允許產生表面上可編輯但實際無法執行的狀態。

### 8.3 Execution Readiness

Run Button 狀態：

- Ready；
- Missing input；
- Missing secret；
- Unsupported feature；
- Invalid mapping；
- Blocking diagnostic。

Disabled Button 必須有原因，不只改成灰色。

## 9. Mock Controls

### 9.1 Session

- Current Session；
- Create；
- Reset；
- Snapshot；
- Restore；
- Seed；
- TTL/Expiry；
- State Entity Count。

Reset/Restore 需要明確確認；UI 應顯示影響範圍。

### 9.2 Operation Fault

每個 Operation 可設定：

- Delay 0–設定上限；
- Jitter；
- Failure Rate；
- Forced Status；
- Timeout；
- Attempt-specific Fault；
- Reset to inherited。

Slider 必須搭配數字輸入與鍵盤操作。Fault 生效時 Node 顯示 Badge。

### 9.3 State Inspector

- Resource List；
- Entity JSON；
- Revision；
- Last Mutation；
- Diff；
- Delete/seed operations（需確認）；
- 不顯示 Secret。

## 10. Run 與 Live Trace

### 10.1 Run Drawer

Run 前：

- Mode：Mock / Dry Run / Live；
- Workflow Inputs；
- Secret Bindings；
- Session；
- Seed；
- Target Host；
- Write Warning；
- Blocking Diagnostics。

Live + Write 需要二次確認，並列出所有 Mutation Methods。

### 10.2 Trace Panel

每個 Step 顯示：

- Status；
- Attempts；
- Duration；
- Request/Response；
- Criteria；
- Outputs；
- State Mutation；
- Retry/Fault；
- Diagnostics。

Canvas Animation 與 Trace Selection 雙向同步。

### 10.3 Reduced Motion

使用者偏好 Reduced Motion 時：

- 不播放流動粒子；
- 使用靜態 Edge Highlight；
- 以 Step Status、Border 與 Timeline 更新；
- 不影響可理解性。

## 11. Diagnostics

Diagnostics Panel 支援：

- Severity；
- Code；
- Source；
- Blocking Type；
- Filter；
- Copy；
- Open Source；
- Suggested Fix；
- Documentation Link。

相同根因可 Group，但每個使用位置仍可展開。

## 12. Export UX

Export Dialog 顯示：

- Format；
- Included Workflows；
- Mode（canonical/preserve/generated）；
- Redaction Summary；
- Unsupported/Lossy Warning；
- File Names；
- Preview；
- Copy/Download。

Export 前若包含 Candidate Edge，應提示它們不會輸出，而不是自動加入。

## 13. Accessibility

MUST：

- 主要流程可用鍵盤完成；
- Canvas Node 可 Tab Focus；
- Edge/Graph 提供可讀的 List/Outline Alternative；
- Focus Indicator 清楚；
- Contrast 符合 WCAG 2.2 AA；
- Form Error 與 Field 關聯；
- Icon 有 Accessible Name；
- Live Trace 不過度使用 `aria-live`；
- 支援 200% Zoom；
- Reduce Motion；
- 非顏色唯一編碼。

Graph Alternative View 應以 Workflow Step List、Operation Table 與 Mapping Table 提供同等資訊。

## 14. Empty、Loading、Error States

每個 Panel 都需定義：

- Empty Project；
- No workflow；
- No candidate；
- No mock session；
- No run；
- Filter returned none；
- Unsupported source；
- Loading；
- Cancelled；
- Permission/network blocked。

文案應告訴使用者下一步，不使用空泛的「Something went wrong」。

## 15. Visual Style

- 現代化、工具型、資訊密度適中；
- Dark/Light/System Theme；
- HTTP Method 顏色遵循一致語意，但搭配文字；
- 動畫只用於執行證據與狀態轉換；
- 不使用大量 Neon Glow 影響可讀性；
- Hero Demo 可具視覺吸引力，Workspace 以專業清晰為主。

## 16. UX Acceptance Criteria

1. 新使用者可不看外部文件完成 Sample Golden Path；
2. Canvas 內容可由鍵盤與 Alternative List 存取；
3. Candidate 原因可在兩次操作內看到；
4. Run disabled 時有具體原因；
5. Live Write 有明確 Host/Methods Confirmation；
6. Candidate 不會在 Export 時偷偷加入；
7. Trace 與 Canvas 狀態同步；
8. 500 Node 圖仍可搜尋、Focus、Filter；
9. Reduce Motion 下完整可用；
10. 所有 Sensitive Value 在 UI 預設遮罩。
