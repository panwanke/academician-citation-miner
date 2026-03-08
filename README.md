# Academician Citation Miner 🎓

**Academician Citation Miner** (院士/顶尖学者被引关系挖掘工具) is a specialized data mining pipeline designed to retrieve, analyze, and map the citation network of any given research paper. By leveraging the OpenAlex API and Wikipedia's search capabilities, it systematically identifies distinguished scholars (e.g., Academicians, Fellows, Top Editors) who have cited your work.

![](https://gitee.com/Epool/mypicgo/raw/master/images/1772550385632.png)

---

## 🌐 Language / 语言切换

- **[🇨🇳 中文版本](#中文版本)** - 查看中文说明
- **[🇺🇸 English Version](#english-version)** - View English documentation

---

<a name="english-version"></a>

## 📦 Installation (OpenCode Skill Setup)

This skill follows the **OpenCode skill directory structure**. You can install it in two ways:

### Option 1: Global Installation (Recommended for AI Agents)

AI agents should default to global installation so the skill is available across all projects.

**Installation Path:** `~/.opencode/skills/academician-citation-miner/`

```bash
# Create the global skills directory if it doesn't exist
mkdir -p ~/.opencode/skills/academician-citation-miner

# Clone or copy this skill repository to the global path
git clone <repository-url> ~/.opencode/skills/academician-citation-miner
# OR manually copy all files to: ~/.opencode/skills/academician-citation-miner/
```

**Usage after global installation:**
```bash
opencode start academician-citation-miner
```

### Option 2: Project-Level Installation

Install the skill within a specific project directory.

**Installation Path:** `<project-root>/.opencode/skills/academician-citation-miner/`

```bash
# Create the project-level skills directory
mkdir -p .opencode/skills/academician-citation-miner

# Clone or copy this skill repository to the project path
git clone <repository-url> .opencode/skills/academician-citation-miner
# OR manually copy all files to: .opencode/skills/academician-citation-miner/
```

**Usage after project installation:**
```bash
# Run from the project root directory
opencode start academician-citation-miner
```

### 🤖 Special Instructions for AI Agents

When you (the AI agent) need to install this skill:

1. **Default to Global Installation**: Always prefer installing to `~/.opencode/skills/` unless the user explicitly requests a project-level installation.

2. **Verify Installation Path**: After installation, confirm the skill files exist:
   ```bash
   ls -la ~/.opencode/skills/academician-citation-miner/
   # Should contain: SKILL.md, README.md, scripts/, example/
   ```

3. **Check OpenCode Configuration**: Ensure OpenCode is configured to recognize the global skills directory:
   ```bash
   # Verify opencode can discover the skill
   opencode list --skills
   ```

4. **If Installation Fails**: Fall back to project-level installation in the current working directory.

---

## ✨ Features

- **Comprehensive Citation Retrieval:** Automatically fetches all citing papers for a target article using its DOI or Title, including citations from its preprints.
- **Author Demuplication & Stratification:** Extracts unique authors, resolves their affiliations, and calculates their academic impact (H-Index). Filters authors based on user-defined thresholds (e.g., H-Index >= 30, or Top 50 authors).
- **Automated Deep Search:** Queries Wikipedia to extract scholar identities and identify academic honors such as "Fellow", "Academy of Sciences", or "American Academy of Arts and Sciences".
- **Human-in-the-Loop (HITL):** Pauses execution after the initial retrieval stage, allowing users to manually review, add, or remove authors from the target list before initiating the time-consuming deep search.
- **Robust & Safe Execution:** Built-in rate limiting, request timeout controls (`AbortController`), and a memory safety lock (capped at 2000 citing papers) to ensure stability during large-scale network scraping.
- **Source Mapping:** Back-traces and maps each identified top scholar to the specific citing paper(s) they authored.

## 🚀 Workflow

The execution of this skill is divided into two main stages:

### Stage 1: Retrieval & Stratification
1. The user provides the target **DOI** or **Title**.
2. The agent queries OpenAlex to find all citing papers (and preprint citations).
3. The agent deduplicates authors, retrieves their latest affiliations, and filters them based on a configured depth strategy (H-Index threshold or Top N count).
4. **🚨 Human-in-the-Loop Pause:** The filtered list is saved to `./temp_miner/step3_targets.json`. The agent pauses and waits for user confirmation or manual modification of the target list.

### Stage 2: Deep Search & Reporting
1. Upon user confirmation, the agent reads the (potentially modified) target list.
2. It performs a deep Wikipedia search for each author using default or custom keywords (e.g., "Editor", "Fellow", "Nature").
3. Final reports are generated mapping the identified distinguished scholars to the papers that cited your work.

## 🛠 Usage

### For Humans (人类用户)

To use this skill, simply invoke it in the OpenCode interactive CLI by providing the target DOI or paper title:

```bash
opencode start academician-citation-miner
```

The agent will interactively ask you for:
1. **Target Article:** The DOI (recommended) or exact title.
2. **Search Depth Strategy:** Whether to filter by global H-Index or by Top N count.
3. **Search Depth Value:** The threshold value (e.g., `30` or `50`).
4. **Target Identity/Keywords:** Custom keywords to search for (or press Enter for defaults like Academicians/Fellows).

### For AI Agents (AI 助手)

When acting as an AI agent executing this OpenCode skill, follow these steps:

1. **Environment Check**: Verify Node.js is installed
   ```bash
   node -v
   ```

2. **Gather Parameters**: Ask the user for:
   - Target DOI or Title
   - Search depth strategy (H-Index threshold or Top N count)
   - Search depth value
   - Custom keywords (optional)

3. **Execute Stage 1**:
   ```bash
   node ${CLAUDE_PLUGIN_ROOT}/scripts/miner.js --target="<TARGET>" --limit-by="<h-index OR count>" --limit-value="<VALUE>" --temp-dir="./temp_miner" --stage=1
   ```

4. **⚠️ CRITICAL: Human-in-the-Loop Pause**: After Stage 1 completes, MUST pause and wait for user confirmation. Display the message asking users to review `./temp_miner/step3_targets.json`.

5. **Execute Stage 2** (after user confirms):
   ```bash
   node ${CLAUDE_PLUGIN_ROOT}/scripts/miner.js --temp-dir="./temp_miner" --stage=2
   ```

6. **Report Results**: Read and summarize `academician_report.md` for the user.

## 📄 Outputs

Once the pipeline completes, the following output files will be generated in your project root:

- **`academicians_list.csv`**: A spreadsheet detailing all identified top scholars, their H-Index, Institution, identified honors, and the source citing paper.
- **`academician_report.md`**: A formatted markdown report summarizing the citation statistics, network metrics, and highlighting top authors.
- **`./temp_miner/`**: A temporary directory containing intermediate JSON files (e.g., `step3_targets.json` for manual intervention).

## 📜 Changelog History

- **v1.0.0**: 
  - Standardized as an OpenCode skill.
  - Implemented Human-in-the-Loop pause mechanism.
  - Parameterized scripts with memory locks, timeout control, and parallel rate protection.
  - Added support for custom keyword searches and preprint citation aggregation.

---

<a name="中文版本"></a>

## 📦 安装说明 (OpenCode Skill 配置)

本技能遵循 **OpenCode skill 目录结构**。您可以通过两种方式安装：

### 方式一：全局安装（AI 助手默认推荐）

AI 助手应默认选择全局安装，以便在所有项目中都能使用此技能。

**安装路径：** `~/.opencode/skills/academician-citation-miner/`

```bash
# 如果不存在，创建全局 skills 目录
mkdir -p ~/.opencode/skills/academician-citation-miner

# 克隆或复制本技能仓库到全局路径
git clone <repository-url> ~/.opencode/skills/academician-citation-miner
# 或者手动将所有文件复制到：~/.opencode/skills/academician-citation-miner/
```

**全局安装后的使用方法：**
```bash
opencode start academician-citation-miner
```

### 方式二：项目级安装

将技能安装在特定项目目录内。

**安装路径：** `<项目根目录>/.opencode/skills/academician-citation-miner/`

```bash
# 创建项目级 skills 目录
mkdir -p .opencode/skills/academician-citation-miner

# 克隆或复制本技能仓库到项目路径
git clone <repository-url> .opencode/skills/academician-citation-miner
# 或者手动将所有文件复制到：.opencode/skills/academician-citation-miner/
```

**项目安装后的使用方法：**
```bash
# 从项目根目录运行
opencode start academician-citation-miner
```

### 🤖 AI 助手特别说明

当您（AI 助手）需要安装此技能时：

1. **默认全局安装**：始终优先安装到 `~/.opencode/skills/`，除非用户明确要求项目级安装。

2. **验证安装路径**：安装后确认技能文件存在：
   ```bash
   ls -la ~/.opencode/skills/academician-citation-miner/
   # 应该包含：SKILL.md, README.md, scripts/, example/
   ```

3. **检查 OpenCode 配置**：确保 OpenCode 已配置为识别全局 skills 目录：
   ```bash
   # 验证 opencode 能否发现此技能
   opencode list --skills
   ```

4. **如果安装失败**：回退到在当前工作目录进行项目级安装。

---

## ✨ 功能特性

- **全面的引用检索：** 自动获取目标文章的所有引用论文（通过 DOI 或标题），包括预印本的引用。
- **作者去重与分层：** 提取唯一作者，解析其所属机构，并计算学术影响力（H 指数）。根据用户定义的阈值筛选作者（如 H 指数 >= 30，或前 50 名作者）。
- **自动化深度搜索：** 查询维基百科以提取学者身份，识别学术荣誉，如"Fellow"、"科学院院士"或"美国艺术与科学院院士"。
- **人在回路（HITL）：** 在初始检索阶段后暂停执行，允许用户在启动耗时的深度搜索之前手动审查、添加或移除目标作者列表中的作者。
- **稳健安全的执行：** 内置速率限制、请求超时控制（`AbortController`）和内存安全锁（限制在 2000 篇引用论文内），确保大规模网络爬取时的稳定性。
- **来源映射：** 回溯并将每位识别出的顶尖学者与其引用的具体论文进行映射。

## 🚀 工作流程

本技能的执行分为两个主要阶段：

### 第一阶段：检索与分层
1. 用户提供目标 **DOI** 或 **标题**。
2. Agent 查询 OpenAlex 查找所有引用论文（包括预印本引用）。
3. Agent 对作者去重，获取其最新所属机构，并根据配置的深度策略（H 指数阈值或前 N 名数量）进行筛选。
4. **🚨 人在回路暂停：** 筛选后的列表保存至 `./temp_miner/step3_targets.json`。Agent 暂停并等待用户确认或手动修改目标列表。

### 第二阶段：深度搜索与报告
1. 用户确认后，Agent 读取（可能已修改的）目标列表。
2. 使用默认或自定义关键词（如"Editor"、"Fellow"、"Nature"）对每位作者进行维基百科深度搜索。
3. 生成最终报告，将识别出的顶尖学者与引用您工作的论文进行映射。

## 🛠 使用方法

### 人类用户

在 OpenCode 交互式 CLI 中调用此技能，只需提供目标 DOI 或论文标题：

```bash
opencode start academician-citation-miner
```

Agent 将交互式地询问您：
1. **目标文章：** DOI（推荐）或确切标题。
2. **搜索深度策略：** 按全局 H 指数筛选还是按前 N 名数量筛选。
3. **搜索深度值：** 阈值（如 `30` 或 `50`）。
4. **目标身份/关键词：** 自定义搜索关键词（或直接回车使用默认的院士/Fellow 搜索）。

### AI 助手

当作为 AI 助手执行此 OpenCode 技能时，请遵循以下步骤：

1. **环境检查：** 验证 Node.js 已安装
   ```bash
   node -v
   ```

2. **收集参数：** 向用户询问：
   - 目标 DOI 或标题
   - 搜索深度策略（H 指数阈值或前 N 名数量）
   - 搜索深度值
   - 自定义关键词（可选）

3. **执行第一阶段：**
   ```bash
   node ${CLAUDE_PLUGIN_ROOT}/scripts/miner.js --target="<TARGET>" --limit-by="<h-index OR count>" --limit-value="<VALUE>" --temp-dir="./temp_miner" --stage=1
   ```

4. **⚠️ 关键：人在回路暂停：** 第一阶段完成后，必须暂停并等待用户确认。显示消息请用户审查 `./temp_miner/step3_targets.json`。

5. **执行第二阶段**（用户确认后）：
   ```bash
   node ${CLAUDE_PLUGIN_ROOT}/scripts/miner.js --temp-dir="./temp_miner" --stage=2
   ```

6. **报告结果：** 读取并为用户总结 `academician_report.md`。

## 📄 输出文件

管道完成后，以下输出文件将生成在项目根目录中：

- **`academicians_list.csv`**：电子表格，详述所有识别出的顶尖学者、其 H 指数、机构、识别出的荣誉以及来源引用论文。
- **`academician_report.md`**：格式化的 Markdown 报告，总结引用统计、网络指标，并突出显示顶尖作者。
- **`./temp_miner/`**：临时目录，包含中间 JSON 文件（如用于人工干预的 `step3_targets.json`）。

## 📜 变更历史

- **v1.0.0**: 
  - 标准化为 OpenCode 技能。
  - 实现人在回路暂停机制。
  - 脚本参数化，具备内存锁、超时控制和并行速率保护。
  - 添加自定义关键词搜索和预印本引用聚合支持。

---

*Created by OpenCode Scholar for automated academic network discovery.*  
*由 OpenCode Scholar 创建，用于自动化学术网络发现。*
