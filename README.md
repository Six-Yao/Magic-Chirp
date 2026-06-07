# Magic-Chirp
> 神奇啾啾在哪里！

作为南京大学 2026 EL 智能应用开发与创新大赛的交互组（以及可能的 AI 智能体创新专项组）项目
## 运行指南

### 1. 环境准备
确保你已安装以下环境：
- Python 3.9+
- Node.js 18+ & npm

### 2. 后端配置与运行
1. **创建虚拟环境**（推荐）：
   ```powershell
   python -m venv .venv
   .\.venv\Scripts\activate
   ```
2. **安装依赖**：
   ```powershell
   pip install -r requirements.txt
   ```
3. **配置文件**：
   - 复制 `.env.example` 并重命名为 `.env`。
   - 根据需要修改 `.env` 中的配置（如 `JWT_SECRET`、`USE_MOCK_AI` 等）。
4. **启动后端服务**：
   ```powershell
   python server.py
   ```
   或直接执行：
   ```powershell
   uvicorn server:app --reload
   ```
   服务将启动在 `http://127.0.0.1:8000`，接口文档请访问 `/docs`。

### 3. 前端配置与运行
1. **进入前端目录**：
   ```powershell
   cd frontend
   ```
2. **安装依赖**：
   ```powershell
   npm install
   ```
3. **启动开发服务器**：
   ```powershell
   npm run dev
   ```
   前端服务通常启动在 `http://localhost:5173`。

## 各个部分开发目标
详见 [Magic-Chirp 文件开发目标](./%E6%96%87%E4%BB%B6%E5%BC%80%E5%8F%91%E7%9B%AE%E6%A0%87.md)

## 依赖管理
- 后端：写入 `requirements.txt` 后提交。
- 前端：使用 `npm install [package]` 安装并提交 `package.json`。

## 贡献指南
1. 克隆仓库：`git clone [仓库地址]`
2. 基础维护：使用 `main` 分支进行合并，建议自建功能分支。

---
> 神奇啾啾在那里！ —— 作为南京大学 2026 EL 智能应用开发与创新大赛项目。