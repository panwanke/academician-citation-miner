---
name: academician-citation-miner
description: "A specialized data mining pipeline to retrieve all citing papers of a given target article (via DOI or Title), extract unique authors, resolve their affiliations and academic metrics via OpenAlex, and perform automated deep search to identify distinguished scholars (Academicians, Fellows) using Wikipedia. Maps academicians back to the source citing paper."
author: OpenCode Scholar
---

# Academician Citation Miner

## Purpose
This skill automates the citation network analysis and scholar identity mining for any given research paper. It answers the question: **"Which distinguished scholars (Academicians, Fellows, etc.) have cited my paper, and in which articles did they cite it?"**

## Workflow

When the user invokes this skill, follow these exact steps in order:

### 1. Environment Check
Run a fast check to ensure `node` is available in the environment.
```bash
node -v
```
If `node` is not found, advise the user to install Node.js before proceeding.

### 2. Information Gathering (Interactive)
Use the `AskUserQuestion` tool (or standard conversational prompt) to gather the execution parameters from the user. You must ask:

1.  **Target Article**: "What is the DOI or exact Title of the paper you want to analyze? (e.g., `10.1177/25152459241298700` or `dockerHDDM`)"
2.  **Search Depth Strategy**: "How should we filter the authors for deep Academician search?"
    *   *Option 1 (Default)*: By global H-Index threshold (e.g., H-Index >= 30)
    *   *Option 2*: By Top N count (e.g., Top 50 authors ranked by H-Index)
3.  **Search Depth Value**: "Please provide the value for your strategy (e.g., `30` for H-Index threshold, or `50` for Top N count)."
4.  **Target Identity/Keywords**: "Are you looking for Academicians/Fellows (Default), or do you have custom keywords (e.g., 'Editor, ICML, Nature, IEEE Fellow')? Provide custom keywords separated by commas, or press Enter/type 'Default' to use standard Academician search."

### 3. Execution - Stage 1 (Retrieval & Stratification)
Once the user provides the parameters, use the `Bash` tool to execute `miner.js` located in the skill's scripts directory, running ONLY Stage 1.

**Command Syntax:**
```bash
node ${CLAUDE_PLUGIN_ROOT}/scripts/miner.js --target="<TARGET>" --limit-by="<h-index OR count>" --limit-value="<VALUE>" --temp-dir="./temp_miner" --stage=1
```

*Example Execution Command:*
```bash
node ${CLAUDE_PLUGIN_ROOT}/scripts/miner.js --target="10.1177/25152459241298700" --limit-by="h-index" --limit-value="30" --temp-dir="./temp_miner" --stage=1
```

### 4. Human-in-the-Loop Pause 🚨
**CRITICAL**: After Stage 1 completes, you MUST pause the execution and wait for the user. Do not proceed to Stage 2 automatically.

Output the following message to the user:
> "初步筛选已完成 (Stage 1 Complete)。名单已保存至 `./temp_miner/step3_targets.json`。
> **您可以现在打开该文件，手动删除不需要检查的作者节点以节省时间，或者添加遗漏的重要作者。**
> 当您修改完成或确认无误后，请回复『继续』，我将开始对这些作者进行维基百科深度检索。"

### 5. Execution - Stage 2 (Deep Search & Reporting)
Once the user replies "继续" (or equivalent confirmation), execute Stage 2 of the script. This stage reads the potentially modified `step3_targets.json` and performs the Wikipedia search based on the keywords.

If the user provided custom keywords in Step 2, append the `--keywords="<KEYWORDS>"` flag. Otherwise, omit the `--keywords` flag to use the defaults.

**Command Syntax (Default):**
```bash
node ${CLAUDE_PLUGIN_ROOT}/scripts/miner.js --temp-dir="./temp_miner" --stage=2
```

**Command Syntax (Custom Keywords):**
```bash
node ${CLAUDE_PLUGIN_ROOT}/scripts/miner.js --temp-dir="./temp_miner" --stage=2 --keywords="editor, ICML, nature"
```

### 6. Output Management & Reporting
The script automatically manages directories:
*   All intermediate and raw JSON files are securely placed in the `./temp_miner` folder.
*   The final aggregated outputs are saved directly to the root working directory:
    *   `academicians_list.csv`: A spreadsheet of all identified academicians, their H-Index, Institution, and the citing paper.
    *   `academician_report.md`: A beautiful markdown report summarizing the citation statistics and highlighting top authors.

After Stage 2 finishes, use the `Read` tool to briefly inspect `academician_report.md` and print a short summary to the user in the chat, congratulating them on the successful extraction.

---

## Technical Notes for the Agent
- If the user provides a very generic title, the OpenAlex API might pick up the wrong paper. Encourage DOIs when possible.
- The `miner.js` script automatically searches for Preprints matching the title to combine all citation sources, ensuring a complete graph. It caps at 2000 citing papers to prevent memory overflow.
- The script includes rate-limiting (delays) and timeout controls (15s per request) to respect OpenAlex and Wikipedia API limits. If the execution takes a minute or two, reassure the user that it's normal.

<examples>
### Example Output from the Tool
**Gordon D. Logan**
- Identified Honors: American Academy of Arts and Sciences
- Institution: Vanderbilt University
- Academic Impact: H-Index 101, Citations ~47.7k
- Source Citing Paper(s): An Expert Guide to Planning Experimental Tasks For Evidence-Accumulation Modeling (2025)

**Michael N. Shadlen**
- Identified Honors: Academy of Sciences / National Academy
- Institution: Columbia University
- Academic Impact: H-Index 70, Citations ~41k
- Source Citing Paper(s): Human Exploration Strategically Balances Approaching and Avoiding Uncertainty (2024)
</examples>