# Galaxia RAG MindVault

一個基於 AI 的智能上下文管理系統，結合文檔管理功能與 AI 驅動的對話能力。

## ✨ 功能特色

### 🧠 智能對象管理
- **多類型對象支援**：人員、文件、信件、實體、議題、日誌、會議記錄
- **@提及系統**：類似 Notion 的智能引用功能
- **關係管理**：建立和視覺化對象間的關聯

### 🤖 AI 驅動功能
- **Gemini AI 整合**：使用 Google Gemini 2.5 Flash/Pro 模型
- **語義搜索**：基於向量嵌入的智能檢索
- **自動上下文檢索 (RAG)**：AI 自動找到相關文檔
- **函數調用**：AI 可執行數據庫操作和搜索

### 📄 文件處理
- **多格式支援**：PDF、Word 文檔上傳和處理
- **OCR 功能**：自動文字識別
- **智能分塊**：將長文檔分割成可檢索的片段
- **向量嵌入**：使用 Gemini 嵌入模型生成語義向量

### 🎨 現代化界面
- **響應式設計**：支援深色/淺色主題
- **模組化組件**：基於 Radix UI 的現代界面
- **實時更新**：WebSocket 支援實時對話

## 🛠 技術架構

### 後端
- **框架**: Node.js + Express
- **資料庫**: PostgreSQL + Drizzle ORM
- **向量搜索**: pgvector 擴展
- **AI 服務**: Google Gemini API
- **文件存儲**: Google Cloud Storage
- **語言**: TypeScript

### 前端
- **框架**: React 18 + TypeScript
- **路由**: Wouter
- **狀態管理**: TanStack Query
- **UI 組件**: Radix UI
- **樣式**: Tailwind CSS
- **構建工具**: Vite

### 資料庫結構
- `objects` - 所有類型的對象數據
- `chunks` - 文檔分塊和向量嵌入
- `conversations` - AI 對話記錄
- `messages` - 對話消息
- `relationships` - 對象間關係
- `settings` - 系統配置

## 🚀 快速開始

### 環境要求
- Node.js 18+
- PostgreSQL 14+
- Google Cloud Platform 帳號
- Google Gemini API 金鑰

### 安裝步驟

1. **克隆專案**
   ```bash
   git clone https://github.com/sora8964/galaxia-ragmindvault.git
   cd galaxia-ragmindvault
   ```

2. **安裝依賴**
   ```bash
   npm install
   ```

3. **設置資料庫**
   ```bash
   # 創建 PostgreSQL 資料庫
   createdb galaxia_mindvault
   
   # 啟用 pgvector 擴展
   psql -d galaxia_mindvault -c "CREATE EXTENSION IF NOT EXISTS vector;"
   
   # 推送資料庫 Schema
   npm run db:push
   ```

4. **環境變數配置**
   創建 `.env` 檔案：
   ```env
   # 資料庫配置
   DATABASE_URL=postgresql://username:password@localhost:5432/galaxia_mindvault
   
   # Google API 配置
   GEMINI_API_KEY=your_gemini_api_key
   GOOGLE_CLOUD_PROJECT_ID=your_project_id
   GOOGLE_CLOUD_STORAGE_BUCKET=your_bucket_name
   
   # 服務配置
   PORT=5000
   NODE_ENV=development
   ```

5. **啟動開發服務器**
   ```bash
   npm run dev
   ```

   應用程式將在 `http://localhost:5000` 啟動

## 📖 使用指南

### 對象管理
1. 在側邊欄選擇對象類型（人員、文件等）
2. 點擊「新增」建立新對象
3. 填寫相關資訊，可上傳文件
4. 系統自動生成向量嵌入

### AI 對話
1. 點擊「對話」開始新的對話
2. 使用 `@人員名稱` 或 `@文件標題` 引用對象
3. AI 將自動檢索相關上下文
4. 支援文檔問答和語義搜索

### 關係管理
1. 在對象詳情頁面管理關聯
2. 建立人員與文檔、會議的關係
3. 視覺化對象網絡

## 🔧 開發

### 項目結構
```
galaxia-ragmindvault/
├── client/                 # React 前端
│   ├── src/
│   │   ├── components/     # UI 組件
│   │   ├── pages/         # 頁面組件
│   │   ├── hooks/         # 自定義 Hooks
│   │   └── lib/           # 工具函數
├── server/                # Express 後端
│   ├── routes/           # API 路由
│   ├── functions/        # AI 函數
│   ├── services/         # 業務邏輯
│   └── db.ts            # 資料庫配置
├── shared/               # 共享類型定義
└── migrations/          # 資料庫遷移
```

### 可用腳本
```bash
npm run dev          # 開發模式
npm run build        # 構建生產版本
npm run start        # 啟動生產服務器
npm run check        # TypeScript 類型檢查
npm run db:push      # 推送資料庫 Schema
```

## 🤝 貢獻

歡迎提交 Issue 和 Pull Request！

1. Fork 這個專案
2. 創建功能分支 (`git checkout -b feature/amazing-feature`)
3. 提交變更 (`git commit -m 'feat: 新增驚人功能'`)
4. 推送到分支 (`git push origin feature/amazing-feature`)
5. 開啟 Pull Request

## 📄 授權

本專案採用 MIT 授權 - 詳見 [LICENSE](LICENSE) 檔案

## 🙏 致謝

- [Google Gemini](https://ai.google.dev/) - AI 模型和嵌入服務
- [Radix UI](https://www.radix-ui.com/) - 無障礙 UI 組件
- [Tailwind CSS](https://tailwindcss.com/) - 實用優先的 CSS 框架
- [Drizzle ORM](https://orm.drizzle.team/) - TypeScript ORM

## 📞 聯絡

如有問題或建議，請開啟 Issue 或聯絡專案維護者。

---

**Galaxia RAG MindVault** - 讓 AI 助力您的知識管理 🚀
