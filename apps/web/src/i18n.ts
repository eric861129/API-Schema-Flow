import i18next, { type TFunction } from 'i18next'
import { initReactI18next, useTranslation } from 'react-i18next'
import { workspaceZhTw } from './i18n-workspace'

export const LOCALE_STORAGE_KEY = 'api-schema-flow.locale'
export const SUPPORTED_LOCALES = ['zh-TW', 'en'] as const
export type Locale = (typeof SUPPORTED_LOCALES)[number]
export const DEFAULT_LOCALE: Locale = 'zh-TW'

const appZhTw = {
  'API Schema Flow': 'API Schema Flow',
  'API Schema Flow · Local API review workspace': 'API Schema Flow · 本機 API 審查工作區',
  'Loading API workspace…': '正在載入 API 工作區…',
  'Workspace unavailable': '工作區無法使用',
  'Retry loading workspace': '重新載入工作區',
  'No API operations': '沒有 API 操作',
  'The loaded workspace does not contain operations to visualize.':
    '載入的工作區沒有可視化的操作。',
  'The workspace could not be opened.': '無法開啟工作區。',
  'The API workspace could not be loaded. Check the local server and retry.':
    '無法載入 API 工作區。請檢查本機伺服器後重試。',
  'The API workspace returned HTTP {{status}}.': 'API 工作區回傳 HTTP {{status}}。',
  'The workspace fixture is not valid JSON.': '工作區 fixture 不是有效的 JSON。',
  'The workspace fixture root must be an object.': '工作區 fixture 根節點必須是物件。',
  'The review workspace fixture does not match the Snapshot 1.1 contract.':
    '審查工作區 fixture 不符合 Snapshot 1.1 契約。',
  'This build requires review workspace snapshot 1.1, but received {{version}}.':
    '此版本需要審查工作區 snapshot 1.1，但收到 {{version}}。',
  'ACCEPTED TOPOLOGY': '已接受拓樸',
  '{{visible}} of {{total}} endpoints': '{{visible}}／{{total}} 個端點',
  'Explore confirmed data movement without changing the specification.':
    '探索已確認的資料流動，不會變更規格。',
  'Inference Review workspace': '推論審查工作區',
  Evidence: '證據',
  'Review candidate summary': '審查候選摘要',
  'No visible candidates to summarize.': '沒有可摘要的可見候選。',
  'Inference candidates, {{count}} visible': '推論候選，目前顯示 {{count}} 個',
  '{{visible}} of {{total}} candidates': '{{visible}}／{{total}} 個候選',
  '{{count}} candidate': '{{count}} 個候選',
  '{{count}} candidates': '{{count}} 個候選',
  '{{count}} accepted relationship': '{{count}} 個已接受關係',
  '{{count}} declared accepted': '{{count}} 個已宣告關係已接受',
  '{{count}} inferred accepted': '{{count}} 個推導關係已接受',
  '{{count}} manual accepted': '{{count}} 個手動關係已接受',
  '{{count}} pending candidates outside the graph': '{{count}} 個待處理候選在圖形外',
  '{{code}} sources': '{{code}} 的來源',
  '{{title}} array index {{index}}': '{{title}} 陣列索引 {{index}}',
  optional: '選填',
  'No schema example available.': '沒有可用的 Schema 範例。',
  'Sensitive example redacted.': '敏感範例已遮蔽。',
  'Applied manual mapping. Changes are not saved.': '已套用手動映射。變更尚未保存。',
  'Mapping was not applied: {{reason}}.': '未套用映射：{{reason}}。',
  unavailable: '無法使用',
  'Undid the latest review change. {{candidate}} is {{state}}.':
    '已復原最近一次審查變更。{{candidate}} 為{{state}}。',
  'candidate unavailable': '候選無法使用',
  'Array request-body targets are not supported by the current exporter.':
    '目前匯出器不支援陣列要求本文目標。',
  'Supported mapping shape; workflow binding and ordering still require export validation.':
    '映射形狀受支援；工作流程繫結與排序仍需匯出驗證。',
  'Unavailable until mapping validation passes.': '映射驗證通過前無法使用。',
  'Clear saved decisions and disable autosave for this project and source version? Current decisions remain available for export.':
    '要清除此專案與來源版本的已保存決策並停用自動保存嗎？目前決策仍可匯出。',
  'Reset saved decisions for this project and source version? Export a backup first.':
    '要重設此專案與來源版本的已保存決策嗎？請先匯出備份。',
  'API operations': 'API 操作',
  OPERATIONS: '操作',
  '{{count}} visible': '{{count}} 個可見',
  'Collapse operations panel': '收合操作面板',
  'Search operations': '搜尋操作',
  'Search path or operation ID': '搜尋路徑或 operation ID',
  'Filter by HTTP method': '依 HTTP 方法篩選',
  'No matching operations': '沒有符合的操作',
  'Clear the search or method filters to restore the topology.': '清除搜尋或方法篩選，以恢復拓樸。',
  'Clear filters': '清除篩選',
  '{{incoming}} incoming and {{outgoing}} outgoing relationships':
    '{{incoming}} 個傳入、{{outgoing}} 個傳出關係',
  'Workspace diagnostics': '工作區診斷',
  'Ready · {{operations}} operations · {{relationships}} accepted relationships · {{errors}} blocking errors':
    '就緒 · {{operations}} 個操作 · {{relationships}} 個已接受關係 · {{errors}} 個阻擋錯誤',
  'No diagnostics were reported for this workspace.': '此工作區沒有診斷結果。',
  ERROR: '錯誤',
  WARNING: '警告',
  INFO: '資訊',
  Untagged: '未分類',
  'Accepted API topology': '已接受的 API 拓樸',
  'Draft graph summary': '草稿圖形摘要',
  'Review graph preview': '審查圖形預覽',
  'Automatic layout is unavailable. Showing a simple linear preview.':
    '自動排版無法使用，目前顯示簡易線性預覽。',
  'Arranging draft topology…': '正在排列草稿拓樸…',
  'Arranging topology…': '正在排列拓樸…',
  'Large workspace: use Mapping preview and Review Summary to inspect decisions. The draft canvas is limited to {{limit}} operations.':
    '大型工作區：請使用「映射預覽」與「審查摘要」檢視決策。草稿畫布最多顯示 {{limit}} 個操作。',
  'Large workspace: filter to {{limit}} or fewer endpoints for the canvas, or use Outline to inspect all operations.':
    '大型工作區：請篩選至 {{limit}} 個以下端點再顯示畫布，或使用「大綱」檢視全部操作。',
  'Open operations panel': '開啟操作面板',
  'Open inspector': '開啟檢查器',
  'Topology direction': '拓樸方向',
  Horizontal: '水平',
  Vertical: '垂直',
  'Read-only workspace': '唯讀工作區',
  'Inference review workspace': '映射審查工作區',
  'Local API review workspace': '本機 API 審查工作區',
  'API Schema Flow workspace': 'API Schema Flow 工作區',
  'Workspace views': '工作區檢視',
  Topology: '拓樸',
  Outline: '大綱',
  'Inference Review': '映射審查',
  Diagnostics: '診斷',
  About: '關於',
  'Zoom In': '放大',
  'Zoom Out': '縮小',
  'Fit View': '符合檢視範圍',
  'React Flow controls': '圖形控制項',
  'Toggle interactivity': '切換互動模式',
  'React Flow node': '圖形節點',
  'React Flow edge': '圖形關係線',
  'React Flow handle': '圖形連接點',
  'The node is selected. Use the arrow keys to move it.': '已選取節點。請使用方向鍵移動。',
  'The node is not selected.': '未選取節點。',
  'The edge connects two nodes.': '此關係線連接兩個節點。',
  'Node moved to {{x}}, {{y}}.': '節點已移至 {{x}}、{{y}}。',
  'Endpoint inspector': '端點檢查器',
  'Relationship inspector': '關係檢查器',
  INSPECTOR: '檢查器',
  Endpoint: '端點',
  Relationship: '關係',
  'Close inspector': '關閉檢查器',
  Overview: '總覽',
  'Operation ID': '操作 ID',
  Tags: '標籤',
  Security: '安全性',
  Source: '來源',
  Request: '要求',
  'No request payload.': '沒有要求內容。',
  Responses: '回應',
  Connections: '連線',
  'No accepted relationships.': '沒有已接受的關係。',
  'Accepted inferred': '已接受的推導',
  Manual: '手動',
  Declared: '宣告',
  Accepted: '已接受',
  Target: '目標',
  'No mapping': '沒有映射',
  'Review evidence': '審查證據',
  Action: '動作',
  Decision: '決策',
  Candidate: '候選',
  'Declared by the source specification.': '由來源規格宣告。',
  'Relationship ID': '關係 ID',
  'Selection is no longer available.': '選取項目已不存在。',
  'Accessible alternative': '無障礙替代檢視',
  'Operation and relationship outline': '操作與關係大綱',
  'The tables contain the same accepted topology shown on the canvas.':
    '下列表格包含與畫布相同的已接受拓樸。',
  Method: '方法',
  Path: '路徑',
  Tag: '標籤',
  Incoming: '傳入',
  Outgoing: '傳出',
  'Accepted data mappings': '已接受的資料映射',
  Selector: '選取器',
  'Target field': '目標欄位',
  Provenance: '來源依據',
  'Project Save and Load': '專案保存與載入',
  Project: '專案',
  'Project Save / Load': '保存／載入專案',
  'Save review decisions, Undo history, node positions and canvas views for this source version. Source documents are referenced, not embedded.':
    '保存此來源版本的審查決策、復原紀錄、節點位置與畫布檢視。來源文件只建立參照，不會嵌入檔案。',
  'Project storage status': '專案儲存狀態',
  'Save Project': '保存專案',
  'Load Project': '載入專案',
  'Project file': '專案檔案',
  'Project load preview': '專案載入預覽',
  'Replace current project state?': '要取代目前的專案狀態嗎？',
  '{{changes}} review changes; {{decisions}} imported decisions. Layout: {{layout}}.':
    '{{changes}} 項審查變更；{{decisions}} 項已匯入決策。版面方向：{{layout}}。',
  'This replaces current decisions and both canvas layouts. Save your current project first if you need a backup. Autosave preference remains unchanged.':
    '這會取代目前的決策與兩個畫布版面。如果需要備份，請先保存目前專案。自動保存偏好不會變更。',
  'Cancel load': '取消載入',
  'Apply project': '套用專案',
  'Reset layout': '重設版面',
  'Close project': '關閉專案',
  'HUMAN REVIEW': '人工審查',
  'Inspect suggested data relationships before they become part of the accepted topology.':
    '在建議的資料關係加入已接受拓樸前先檢查它們。',
  'Review source identity': '審查來源識別資訊',
  DISCOVERY: '探索',
  'Candidate List': '候選清單',
  'No inference candidates are available in this snapshot.': '此快照沒有可用的推導候選。',
  '{{count}} inference candidates available.': '目前有 {{count}} 個推導候選。',
  'Candidate discovery is isolated from the accepted API topology.':
    '候選探索與已接受的 API 拓樸分開處理。',
  'Reset the review filters to see the available candidates.': '重設審查篩選器以查看可用候選。',
  PREVIEW: '預覽',
  'Mapping or Topology Preview': '映射或拓樸預覽',
  'Preview mode': '預覽模式',
  'Mapping preview': '映射預覽',
  'Topology preview': '拓樸預覽',
  'Edit Mapping': '編輯映射',
  RATIONALE: '理由',
  'Evidence Inspector': '證據檢查器',
  'Hide evidence': '隱藏證據',
  'Show evidence': '顯示證據',
  'Evidence is hidden for the selected candidate.': '目前已隱藏所選候選的證據。',
  'Select an inference candidate to inspect its evidence.': '選取推導候選以檢視證據。',
  DECISION: '決策',
  'Review Actions': '審查操作',
  'NON-SPATIAL VIEW': '非空間檢視',
  'Review Summary': '審查摘要',
  Candidates: '候選',
  Pending: '待處理',
  'Needs attention': '需要注意',
  'Review candidate filters': '審查候選篩選器',
  Search: '搜尋',
  'Search review candidates': '搜尋審查候選',
  'Path, operation, selector…': '路徑、operation、selector…',
  'Confidence filters': '信心篩選器',
  Confidence: '信心',
  High: '高',
  Medium: '中',
  Low: '低',
  Hidden: '隱藏',
  'Review state': '審查狀態',
  Rejected: '已拒絕',
  Edited: '已編輯',
  All: '全部',
  'Has blockers only': '僅顯示有阻擋項目',
  Sort: '排序',
  'Sort candidates': '排序候選',
  'Source endpoint': '來源端點',
  'Target endpoint': '目標端點',
  'Reset filters': '重設篩選器',
  'Reset review filters': '重設審查篩選器',
  'No review candidates': '沒有審查候選',
  'No candidates match the current review filters.': '沒有候選符合目前的審查篩選器。',
  'Review actions become available after a candidate is selected.': '選取候選後才能使用審查操作。',
  'Review state: {{state}}': '審查狀態：{{state}}',
  Accept: '接受',
  Reject: '拒絕',
  'Undo latest change': '復原最近一次變更',
  'No draft changes': '沒有草稿變更',
  '{{count}} review changes': '{{count}} 項審查變更',
  '{{count}} accepted relationships': '{{count}} 個已接受關係',
  'Selected {{id}}': '已選取 {{id}}',
  'No candidate selected': '未選取候選',
  'Review status': '審查狀態',
  'Local storage status': '本機儲存狀態',
  'Review announcement': '審查播報',
  'Source {{source}} {{sourceSelector}}; target {{target}} {{targetDescriptor}}; {{confidence}}; {{state}}; {{evidence}} evidence; {{blockers}}':
    '來源 {{source}} {{sourceSelector}}；目標 {{target}} {{targetDescriptor}}；{{confidence}}；{{state}}；{{evidence}} 項證據；{{blockers}}',
  '{{count}} blocker': '{{count}} 個阻擋項目',
  '{{count}} blockers': '{{count}} 個阻擋項目',
  '{{count}} evidence': '{{count}} 項證據',
  'Manual accepted': '手動接受',
  Stale: '過期',
  Orphaned: '孤立',
  Superseded: '已被取代',
  Conflict: '衝突',
  Invalid: '無效',
  'evidence sources': '證據來源',
  'Positive evidence': '正向證據',
  'Negative evidence': '負向證據',
  'Supporting context': '支援內容',
  'Inference evidence': '推導證據',
  'Why this mapping was suggested': '為什麼會建議這個映射',
  'Close evidence': '關閉證據',
  'Rule set': '規則集',
  State: '狀態',
  'This inference is a candidate, not an authoritative workflow fact.':
    '此推導是候選，不是具權威性的工作流程事實。',
  'Original inference blockers': '原始推導阻擋項目',
  Blockers: '阻擋項目',
  'Schema warnings': 'Schema 警告',
  'Mapping source pointers': '映射來源指標',
  'Candidate identity': '候選識別資訊',
  'Candidate ID': '候選 ID',
  Fingerprint: '指紋',
  'Schema type unknown': '未知 Schema 型別',
  'Select an inference candidate': '選取推導候選',
  'Select an inference candidate to preview its mapping or topology. Choose a candidate to inspect its source, target, compatibility, and evidence.':
    '選取推導候選以預覽映射或拓樸，再檢視來源、目標、相容性與證據。',
  'Review inferred data transfer': '審查推導的資料傳遞',
  'Source to target mapping': '來源到目標的映射',
  'Source response': '來源回應',
  'Data transfer': '資料傳遞',
  'Target request': '目標要求',
  required: '必填',
  Alias: '別名',
  Transform: '轉換',
  Compatibility: '相容性',
  'This manual mapping is accepted in the current draft. Original inference evidence is retained.':
    '此手動映射已在目前草稿中接受，原始推導證據仍會保留。',
  'This is an inference candidate, not an authoritative workflow relationship, until it is reviewed.':
    '在完成審查前，這是推導候選，不是具權威性的工作流程關係。',
  'No supported fields in this schema.': '此 Schema 沒有支援的欄位。',
  'array index {{index}}': '陣列索引 {{index}}',
  'Choose index, e.g. 0': '選擇索引，例如 0',
  'Select fields for this candidate. Applying creates a manual mapping.':
    '請為此候選選取欄位。套用後會建立手動映射。',
  'Transform template (optional)': '轉換範本（選填）',
  'Bearer {$value}': 'Bearer {$value}',
  'Use one {$value} placeholder. No scripts or expressions are executed.':
    '請使用一個 {$value} 佔位符，不會執行指令碼或運算式。',
  'Mapping validation': '映射驗證',
  'Mapping is compatible.': '映射相容。',
  'Runtime expression preview:': '執行階段運算式預覽：',
  'Example preview: {{example}}': '範例預覽：{{example}}',
  'Arazzo:': 'Arazzo：',
  Cancel: '取消',
  'Apply mapping': '套用映射',
  'Reject candidate': '拒絕候選',
  'Reason (required)': '原因（必填）',
  'Wrong resource': '資源錯誤',
  'Wrong field': '欄位錯誤',
  'Not a workflow': '不是工作流程',
  Duplicate: '重複',
  'Unsafe or ambiguous': '不安全或有歧義',
  Other: '其他',
  'Note (required for Other)': '備註（選擇「其他」時必填）',
  'Note (optional)': '備註（選填）',
  'Confirm rejection': '確認拒絕',
  'Import Decision Set preview': '匯入決策集預覽',
  'Import Decision Set': '匯入決策集',
  'Export Decision Set': '匯出決策集',
  '{{decisions}} decisions and {{edges}} manual edges in this file.':
    '此檔案包含 {{decisions}} 項決策與 {{edges}} 條手動關係線。',
  'Result after merging with current decisions:': '與目前決策合併後的結果：',
  '{{count}} accepted relationships. Stale, orphaned, invalid and conflicting decisions do not create accepted edges.':
    '{{count}} 個已接受關係。過期、孤立、無效與衝突的決策不會建立已接受關係線。',
  'Cancel import': '取消匯入',
  'Apply import': '套用匯入',
  'Decision Set file': '決策集檔案',
  'Clear saved data': '清除已保存資料',
  'Enable autosave': '啟用自動保存',
  'Reload saved data': '重新載入已保存資料',
  'Back up stored data': '備份已儲存資料',
  'Reset saved data': '重設已保存資料',
  'Loading saved decisions…': '正在載入已保存的決策…',
  'Local storage unavailable. Export decisions before closing.':
    '本機儲存無法使用，請在關閉前匯出決策。',
  'Autosave disabled. Export decisions before closing.': '自動保存已停用，請在關閉前匯出決策。',
  'Saved locally': '已保存至本機',
  'No saved changes': '沒有已保存的變更',
  'Saving locally…': '正在保存至本機…',
  Language: '語言',
  'Traditional Chinese': '繁體中文',
  English: 'English',
  'Interface language': '介面語言',
  'Status code': '狀態碼',
  'Request body': '要求本文',
  'Response body': '回應本文',
  'Request header': '要求標頭',
  'Request query': '要求查詢參數',
  'Request path': '要求路徑參數',
  'Response header': '回應標頭',
  'Workflow input': '工作流程輸入',
  'Path parameter': '路徑參數',
  'Query parameter': '查詢參數',
  'Querystring parameter': 'Querystring 參數',
  'Header parameter': '標頭參數',
  'Cookie parameter': 'Cookie 參數',
  'No schema declared': '未宣告 Schema',
  'array of {{schema}}': '陣列，元素為 {{schema}}',
  unknown: '未知',
  'Type compatible · {{type}}': '型別相容 · {{type}}',
  'Type mismatch · {{source}} → {{target}}': '型別不相容 · {{source}} → {{target}}',
  'Format compatible · {{format}}': '格式相容 · {{format}}',
  'Format differs · {{source}} → {{target}}': '格式不同 · {{source}} → {{target}}',
  'Source is nested in an array at depth {{depth}}': '來源位於陣列巢狀深度 {{depth}}',
  'The baseline changed. Existing review data has been preserved; export it before resetting.':
    '基準已變更。既有審查資料已保留，請在重設前先匯出。',
  'Another tab changed this review. Export your current decisions, then reload saved data.':
    '另一個分頁已變更此審查。請匯出目前決策，再重新載入已保存資料。',
  'Local save failed. Export your decisions before closing this page.':
    '本機保存失敗，請在關閉此頁面前匯出決策。',
  'Storage upgrade blocked by another tab. Close the other tab and retry.':
    '儲存升級被另一個分頁阻擋，請關閉另一個分頁後重試。',
  'Cannot open local storage.': '無法開啟本機儲存。',
  'Cannot read local review data.': '無法讀取本機審查資料。',
  'Cannot restore local decisions.': '無法還原本機決策。',
  'Cannot clear local decisions.': '無法清除本機決策。',
  'Stored review generation is damaged.': '已儲存的審查世代資料損壞。',
  'Cannot import this file.': '無法匯入此檔案。',
  'Cannot access local storage.': '無法存取本機儲存。',
  'Decision Set exceeds the 5 MB limit.': '決策集超過 5 MB 限制。',
  'Project file exceeds the 5 MB limit.': '專案檔案超過 5 MB 限制。',
  'Invalid project file.': '專案檔案無效。',
  'Unsupported project format or version.': '不支援的專案格式或版本。',
  'Unsupported project field.': '不支援的專案欄位。',
  'Project source does not match the loaded workspace. Load its source before opening this project.':
    '專案來源與已載入工作區不相符。請先載入相同來源，再開啟此專案。',
  'Invalid project review data.': '專案審查資料無效。',
  'Unsupported project review field.': '不支援的專案審查欄位。',
  'Unsupported project review version.': '不支援的專案審查版本。',
  'Decision revisions exceed the supported safe integer range.': '決策修訂超過支援的安全整數範圍。',
  'Imported mapping contains an unsupported transform template.':
    '匯入的映射包含不支援的轉換範本。',
  'Imported mapping is incompatible: {{errors}}': '匯入的映射不相容：{{errors}}',
  'Conflicting content for identifier {{id}}.': '識別碼 {{id}} 的內容互相衝突。',
  'Use exactly one {$value} placeholder and literal text only.':
    '請只使用一個 {$value} 佔位符與文字內容。',
  'Cannot load project.': '無法載入專案。',
  'Choose a reject reason.': '請選擇拒絕原因。',
  'A note is required when the reject reason is Other.': '拒絕原因選擇「其他」時必須填寫備註。',
  'Choose a source and target field.': '請選擇來源與目標欄位。',
  'Enter an explicit non-negative integer for every array index.':
    '請為每個陣列索引輸入明確的非負整數。',
  'Schema type is incomplete or unsupported.': 'Schema 型別不完整或不受支援。',
  'Source and target types are incompatible.': '來源與目標型別不相容。',
  'Nullable source cannot supply a non-null target.': '可為 null 的來源不能提供非 null 的目標。',
  'Optional source cannot guarantee a required target value.': '非必填來源無法保證必填目標有值。',
  'Target format is not guaranteed by the source.': '來源無法保證目標格式。',
  'Source values are not guaranteed to satisfy the target enum.': '來源值無法保證符合目標列舉。',
  'Sensitive values may only map to the Authorization header.':
    '敏感值只能映射到 Authorization 標頭。',
  'Ambiguous schema variants cannot be edited.': '有歧義的 Schema 變體無法編輯。',
  'Write-only fields are not response values.': '唯寫欄位不是回應值。',
  'Read-only fields cannot be request targets.': '唯讀欄位不能作為要求目標。',
  'Only scalar parameter mappings are supported.': '只支援純量參數映射。',
  'Schema exposes multiple possible types: {{types}}.': 'Schema 顯示多個可能型別：{{types}}。',
  'Source operation is missing.': '缺少來源操作。',
  'Target operation is missing.': '缺少目標操作。',
  'Source schema is ambiguous across successful response variants.':
    '成功回應變體之間的來源 Schema 有歧義。',
  'Source response schema could not be resolved.': '無法解析來源回應 Schema。',
  'Source request schema is ambiguous across media variants.':
    '媒體變體之間的來源要求 Schema 有歧義。',
  'Source request schema could not be resolved.': '無法解析來源要求 Schema。',
  'Source parameter schema is ambiguous.': '來源參數 Schema 有歧義。',
  'Source parameter schema could not be resolved.': '無法解析來源參數 Schema。',
  'Normalized response headers do not expose schema metadata yet.':
    '標準化回應標頭目前尚未提供 Schema 中繼資料。',
  'Workflow input schema is not part of this snapshot.': '此快照不包含工作流程輸入 Schema。',
  'Literal null has no concrete schema type.': 'Literal null 沒有具體 Schema 型別。',
  'Target schema is ambiguous across request media variants.':
    '要求媒體變體之間的目標 Schema 有歧義。',
  'Target request schema could not be resolved.': '無法解析目標要求 Schema。',
  'Target parameter schema is ambiguous.': '目標參數 Schema 有歧義。',
  'Target parameter schema could not be resolved.': '無法解析目標參數 Schema。',
  'Candidate mappings are invalid.': '候選映射無效。',
  'Candidate fingerprint changed.': '候選指紋已變更。',
  'Candidate is no longer present.': '候選已不存在。',
  'Candidate references a missing graph node.': '候選參照的圖形節點不存在。',
  'Schema type is incomplete': 'Schema 型別不完整',
  'Target value is required': '目標值為必填',
} as const

const zhTW = { ...appZhTw, ...workspaceZhTw }

const enOverrides = {
  '{{count}} review changes': '{{count}} review changes',
  '{{count}} accepted relationships': '{{count}} accepted relationships',
  '{{count}} blocker': '{{count}} blocker',
  '{{count}} blockers': '{{count}} blockers',
  '{{count}} evidence': '{{count}} evidence',
  'Review state: {{state}}': 'Review state: {{state}}',
  Language: 'Language',
  'array index {{index}}': 'array index {{index}}',
  'Example preview: {{example}}': 'Example preview: {{example}}',
} as const

const en = Object.fromEntries(
  Object.keys(zhTW).map((key) => [key, enOverrides[key as keyof typeof enOverrides] ?? key]),
)

export const i18n = i18next.createInstance().use(initReactI18next)

export function readStoredLocale(): Locale {
  try {
    const value = globalThis.localStorage?.getItem(LOCALE_STORAGE_KEY)
    return value === 'en' || value === 'zh-TW' ? value : DEFAULT_LOCALE
  } catch {
    return DEFAULT_LOCALE
  }
}

function syncDocumentLanguage(locale: string) {
  if (typeof document !== 'undefined')
    document.documentElement.lang = locale === 'en' ? 'en' : 'zh-TW'
}

void i18n.init({
  resources: {
    'zh-TW': { translation: zhTW },
    en: { translation: en },
  },
  lng: readStoredLocale(),
  fallbackLng: DEFAULT_LOCALE,
  supportedLngs: SUPPORTED_LOCALES,
  ns: ['translation'],
  defaultNS: 'translation',
  keySeparator: false,
  nsSeparator: false,
  interpolation: { escapeValue: false },
  initAsync: false,
})
syncDocumentLanguage(i18n.resolvedLanguage ?? i18n.language)
i18n.on('languageChanged', (locale) => {
  syncDocumentLanguage(locale)
  try {
    globalThis.localStorage?.setItem(LOCALE_STORAGE_KEY, locale === 'en' ? 'en' : 'zh-TW')
  } catch {
    // 私密瀏覽或受限環境可能禁止 localStorage，語言切換仍可在當前頁面生效。
  }
})

export function changeLocale(locale: Locale) {
  void i18n.changeLanguage(locale)
}

const rawMessagePatterns: readonly [RegExp, string][] = [
  [
    /^Inference schema traversal stopped at depth (\d+)\.$/,
    'Inference schema traversal stopped at depth {{depth}}.',
  ],
  [
    /^Schema exposes multiple possible types: (.+)\.$/,
    'Schema exposes multiple possible types: {{types}}.',
  ],
  [/^Imported mapping is incompatible: (.+)$/, 'Imported mapping is incompatible: {{errors}}'],
  [/^Conflicting content for identifier (.+)\.$/, 'Conflicting content for identifier {{id}}.'],
  [/^The API workspace returned HTTP (\d+)\.$/, 'The API workspace returned HTTP {{status}}.'],
  [
    /^This build requires review workspace snapshot 1\.1, but received (.+)\.$/,
    'This build requires review workspace snapshot 1.1, but received {{version}}.',
  ],
  [/^Type compatible · (.+)$/, 'Type compatible · {{type}}'],
  [/^Type mismatch · (.+) → (.+)$/, 'Type mismatch · {{source}} → {{target}}'],
  [/^Format compatible · (.+)$/, 'Format compatible · {{format}}'],
  [/^Format differs · (.+) → (.+)$/, 'Format differs · {{source}} → {{target}}'],
  [
    /^Source is nested in an array at depth (\d+)$/,
    'Source is nested in an array at depth {{depth}}',
  ],
]

export function localizeRawMessage(message: string, t: TFunction): string {
  for (const [pattern, key] of rawMessagePatterns) {
    const match = message.match(pattern)
    if (!match) continue
    const params: Record<string, string> = key.includes('{{types}}')
      ? { types: match[1] ?? '' }
      : key.includes('{{id}}')
        ? { id: match[1] ?? '' }
        : key.includes('{{errors}}')
          ? { errors: match[1] ?? '' }
          : key.includes('{{type}}')
            ? { type: match[1] ?? '' }
            : key.includes('{{source}}') && key.includes('{{target}}')
              ? { source: match[1] ?? '', target: match[2] ?? '' }
              : key.includes('{{format}}')
                ? { format: match[1] ?? '' }
                : key.includes('{{depth}}')
                  ? { depth: match[1] ?? '' }
                  : key.includes('{{status}}')
                    ? { status: match[1] ?? '' }
                    : { version: match[1] ?? '' }
    return t(key, params)
  }
  const translated = t(message)
  return translated === message && message.includes(' · ') ? message : translated
}

export function translateStatus(value: string, t: TFunction): string {
  const statusKey: Record<string, string> = {
    pending: 'Pending',
    accepted: 'Accepted',
    rejected: 'Rejected',
    edited: 'Edited',
    stale: 'Stale',
    orphaned: 'Orphaned',
    superseded: 'Superseded',
    conflict: 'Conflict',
    invalid: 'Invalid',
    'needs-attention': 'Needs attention',
    all: 'All',
    high: 'High',
    medium: 'Medium',
    low: 'Low',
    hidden: 'Hidden',
  }
  const key = statusKey[value] ?? value
  const translated = t(key)
  return translated === value ? value : translated
}

export function useI18n() {
  const { t, i18n: instance } = useTranslation()
  const locale: Locale = instance.resolvedLanguage === 'en' ? 'en' : 'zh-TW'
  return {
    t,
    locale,
    setLocale: changeLocale,
    localize: (message: string) => localizeRawMessage(message, t),
    status: (value: string) => translateStatus(value, t),
  }
}
