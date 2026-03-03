# Academician Citation Miner 🎓

**Academician Citation Miner** (院士/顶尖学者被引关系挖掘工具) is a specialized data mining pipeline designed to retrieve, analyze, and map the citation network of any given research paper. By leveraging the OpenAlex API and Wikipedia's search capabilities, it systematically identifies distinguished scholars (e.g., Academicians, Fellows, Top Editors) who have cited your work.

![](https://gitee.com/Epool/mypicgo/raw/master/images/1772550385632.png)

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

To use this skill, simply invoke it in the OpenCode interactive CLI by providing the target DOI or paper title:

```bash
opencode start academician-citation-miner
```

The agent will interactively ask you for:
1. **Target Article:** The DOI (recommended) or exact title.
2. **Search Depth Strategy:** Whether to filter by global H-Index or by Top N count.
3. **Search Depth Value:** The threshold value (e.g., `30` or `50`).
4. **Target Identity/Keywords:** Custom keywords to search for (or press Enter for defaults like Academicians/Fellows).

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
*Created by OpenCode Scholar for automated academic network discovery.*
