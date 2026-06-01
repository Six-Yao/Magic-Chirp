# Magic-Chirp
> 神奇啾啾在哪里！

作为南京大学 2026 EL 智能应用开发与创新大赛的交互组（以及可能的 AI 智能体创新专项组）项目
## 创建环境（可选，提供 Windows 系统的案例）
```
python -m venv .venv
.venv\scripts\activate
pip install -r requirements.txt
```
## 运行项目
```
uvicorn server:app --reload
```
> 可以使用[postman](https://www.postman.com/downloads/)进行测试
## 添加依赖
写入 `requirements.txt` 后提交
## 贡献指南
```
git clone [仓库地址]
git pull origin main
git checkout -b [你的自建分支]
```
## 各个部分开发目标详见 [Magic-Chirp 文件开发目标](./%E6%96%87%E4%BB%B6%E5%BC%80%E5%8F%91%E7%9B%AE%E6%A0%87.md)