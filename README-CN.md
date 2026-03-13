# TrackRecord - 个人运动数据同步与导出工具

> [!NOTE]
> 本项目是基于 [yihong0618/running_page](https://github.com/yihong0618/running_page) 的分支与增强版本，专注于数据同步与导出功能。

<p align="center">
  <img width="150" src="https://raw.githubusercontent.com/shaonianche/gallery/master/running_page/running_page_logo.png" />
</p>

## 🍱✨ 核心特性

TrackRecord 提供了一套强大的工具，用于从各种平台同步和导出您的运动数据：

*   **交互式同步菜单**：不再需要复杂的命令行参数！只需运行 `python running_page_menu.py` 即可在可视化菜单中一键同步各平台数据（支持行者、Keep、悦跑圈等）。
*   **行者 (Xingzhe) 完美同步**：
    *   **一键登录**：支持最新的 RSA 加密自动登录，彻底告别繁琐的 Session 抓包。
    *   **轨迹导出**：支持同步时自动生成 GPX 轨迹文件到 `GPX_OUT` 目录。
    *   **智能 ID 提取**：自动处理行者最新的 API 响应结构，获取用户信息更精准。
*   **多平台支持**：支持从 Nike, Garmin, Strava, Keep, Coros 等平台同步数据。
*   **数据导出**：生成 GPX, TCX 和 FIT 文件。支持保存数据到 SQLite 数据库以便后续分析。

## 🙏 特别感谢

本项目之所以能存在，完全仰仗于 **[yihong0618](https://github.com/yihong0618)** 及其开源项目 **[running_page](https://github.com/yihong0618/running_page)**。

---

## 🚀 快速开始

### 1. 安装依赖

```bash
pip install -r requirements.txt
```

### 2. 同步数据 (推荐方式)

我们为用户提供了最便捷的同步方式。只需在项目根目录运行：

```bash
python running_page_menu.py
```

按照菜单提示操作即可。无论是输入账号密码自动登录，还是使用高级 Session 模式，菜单都能引导您完成。

### 3. 手动同步 (CLI 模式)

如果您习惯使用 CLI 模式，脚本位于 `run_page/` 目录中。例如行者同步：

```bash
# 自动登录模式
python run_page/xingzhe_sync.py --account "你的手机号" --password "你的密码" --with-gpx

# 手动 Session 模式 (备用)
python run_page/xingzhe_sync.py --session "sessionidValue" --user-id 12345 --with-gpx
```

---

## 🛠️ 数据输出

同步的数据和导出的文件可以在以下目录找到：
- `activities/`: 原始运动数据。
- `GPX_OUT/`: 导出的 GPX 文件。
- `TCX_OUT/`: 导出的 TCX 文件。
- `FIT_OUT/`: 导出的 FIT 文件。
- `run_page/data.db`: 包含所有同步数据的 SQLite 数据库。

---

## 📜 开源协议

基于原项目协议。请继续尊重并保留原作者 [yihong0618](https://github.com/yihong0618) 的版权声明。

---

> “路就在脚下，出发，永远比向往更有意义。”
