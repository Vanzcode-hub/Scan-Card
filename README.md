<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# ElectraPF Pulse ⚡

> **Intelligent Power Analytics & Commercial Proposal Engine** for industrial and commercial electrical power factor optimization.

---

## 📖 Comprehensive Documentation

For complete mathematical models, component breakdown, pricing algorithms, and architecture details, please refer to:
👉 **[PROJECT_DOCUMENTATION.md](PROJECT_DOCUMENTATION.md)**

---

## 🚀 Quick Start

### Prerequisites
- Node.js (v18+)
- Google Gemini API Key

### Installation & Run

1. **Install dependencies**:
   ```bash
   npm install
   ```

2. **Configure API Key**:
   Set `GEMINI_API_KEY` in `.env`:
   ```env
   GEMINI_API_KEY=your_gemini_api_key
   ```

3. **Run development server**:
   ```bash
   npm run dev
   ```
   Access the dashboard at [http://localhost:3000](http://localhost:3000).

---

## 🛠️ Tech Stack
- **Frontend**: React 19, TypeScript, Vite, Tailwind CSS v4, Motion (Framer Motion v12)
- **AI / OCR Engine**: `@google/genai` (Gemini Flash Vision)
- **Data Visualization**: Recharts
- **Document & Spreadsheet Export**: `docx`, `exceljs`, `file-saver`

