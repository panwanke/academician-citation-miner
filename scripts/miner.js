const fs = require('fs');
const path = require('path');

// Parsing CLI arguments
const args = process.argv.slice(2);
const options = {};
args.forEach(arg => {
    const [key, value] = arg.split('=');
    if (key && value) {
        options[key.replace('--', '')] = value;
    }
});

const targetStr = options.target; // DOI or Title
const limitBy = options['limit-by']; // 'h-index' or 'count'
const limitValue = options['limit-value']; // e.g. "30" for h-index, "50" for top N
const tempDir = options['temp-dir'] || './temp_miner';
const stage = parseInt(options.stage || '0', 10);
const customKeywords = options.keywords; // Optional comma-separated list of keywords

if (stage === 1 && !targetStr) {
    console.error("Stage 1 requires --target=<DOI_or_Title>");
    process.exit(1);
}

// Ensure temp directory exists
if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir);
}

// Robust Fetch with Timeout (15s)
async function fetchJsonWithTimeout(url, timeoutMs = 15000) {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeoutMs);

    try {
        const response = await fetch(url, {
            headers: { 'User-Agent': 'mailto:test@example.com' },
            signal: controller.signal
        });
        clearTimeout(id);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status} url: ${url}`);
        }
        return await response.json();
    } catch (error) {
        clearTimeout(id);
        if (error.name === 'AbortError') {
            throw new Error(`Request timed out after ${timeoutMs}ms: ${url}`);
        }
        throw error;
    }
}

function chunkArray(array, size) {
    const chunked = [];
    let index = 0;
    while (index < array.length) {
        chunked.push(array.slice(index, size + index));
        index += size;
    }
    return chunked;
}

function getLatestInstitution(author) {
    if (author.last_known_institution && author.last_known_institution.display_name) {
        return author.last_known_institution.display_name;
    }
    if (author.last_known_institutions && author.last_known_institutions.length > 0) {
        return author.last_known_institutions[0].display_name;
    }
    if (author.affiliations && author.affiliations.length > 0) {
        const sortedAffils = [...author.affiliations].sort((a, b) => {
            const maxYearA = Math.max(...(a.years || [0]));
            const maxYearB = Math.max(...(b.years || [0]));
            return maxYearB - maxYearA;
        });
        if (sortedAffils[0] && sortedAffils[0].institution) {
            return sortedAffils[0].institution.display_name;
        }
    }
    return 'Unknown';
}

async function runStage1() {
    console.log(`\n==============================================`);
    console.log(`🔍 Stage 1: Academician Citation Miner - Target Resolution`);
    console.log(`==============================================`);
    console.log(`Target: ${targetStr}`);
    console.log(`Depth : Limit by ${limitBy} (${limitValue})`);

    // -----------------------------------------------------------------
    // PHASE 1: Retrieval
    // -----------------------------------------------------------------
    console.log(`\n[Phase 1] Resolving target and finding citing papers...`);
    let mainPaperId = '';
    let targetTitle = targetStr;

    if (targetStr.includes('10.')) {
        // Assume DOI
        const doiData = await fetchJsonWithTimeout(`https://api.openalex.org/works/https://doi.org/${targetStr}`);
        mainPaperId = doiData.id.split('/').pop();
        targetTitle = doiData.title;
        console.log(`Resolved DOI to OpenAlex ID: ${mainPaperId} ("${targetTitle}")`);
    } else {
        // Assume Title Search
        const searchData = await fetchJsonWithTimeout(`https://api.openalex.org/works?search=${encodeURIComponent(targetStr)}`);
        if (searchData.results.length === 0) {
            throw new Error("Target title not found in OpenAlex.");
        }
        mainPaperId = searchData.results[0].id.split('/').pop();
        targetTitle = searchData.results[0].title;
        console.log(`Resolved Title to OpenAlex ID: ${mainPaperId}`);
    }

    // Find all versions (Preprints) by title to get complete citation list
    console.log(`Searching for related preprints to combine citations...`);
    const titleSearchUrl = `https://api.openalex.org/works?search=${encodeURIComponent(targetTitle)}`;
    const titleData = await fetchJsonWithTimeout(titleSearchUrl);

    // Exact matches or strong partials
    const targetIds = titleData.results
        .filter(r => r.title && r.title.toLowerCase() === targetTitle.toLowerCase())
        .map(r => r.id.split('/').pop());

    if (!targetIds.includes(mainPaperId)) targetIds.push(mainPaperId);

    console.log(`Found ${targetIds.length} related work(s). Fetching citations...`);

    const citesFilter = targetIds.join('|');
    // HARD LIMIT: max 2000 citing papers to prevent memory blowups for mega papers like ResNet
    const citesData = await fetchJsonWithTimeout(`https://api.openalex.org/works?filter=cites:${citesFilter}&per-page=200`);
    
    // Naive fetch of all pages up to 2000
    let papers = citesData.results;
    let page = 1;
    let totalCites = citesData.meta.count;
    
    console.log(`Total reported citations: ${totalCites}. Fetching pages (capped at 2000)...`);
    
    while(papers.length < totalCites && papers.length < 2000 && citesData.results.length === 200) {
        page++;
        try {
            const nextData = await fetchJsonWithTimeout(`https://api.openalex.org/works?filter=cites:${citesFilter}&per-page=200&page=${page}`);
            if(nextData.results && nextData.results.length > 0) {
                 papers = papers.concat(nextData.results);
                 console.log(`Fetched page ${page}... (Total so far: ${papers.length})`);
            } else {
                break;
            }
        } catch(e) {
            console.error(`Warning: Failed to fetch page ${page}:`, e.message);
            break;
        }
        // Small delay to respect rate limits
        await new Promise(r => setTimeout(r, 200));
    }

    // Write context info
    fs.writeFileSync(path.join(tempDir, 'step1_context.json'), JSON.stringify({
        targetStr, targetTitle, mainPaperId, targetIds, totalFetched: papers.length
    }, null, 2));
    
    console.log(`✅ Collected ${papers.length} citing papers.\n`);

    // -----------------------------------------------------------------
    // PHASE 2: Stratification (Author Extraction)
    // -----------------------------------------------------------------
    console.log(`[Phase 2] Extracting unique authors...`);
    const authorMap = new Map();
    const authorPapers = {}; // Maps author -> [paper titles]

    papers.forEach(paper => {
        const paperRef = paper.doi || paper.id;
        const paperTitle = paper.title ? paper.title.replace(/"/g, "'").replace(/,/g, "") : paperRef;
        const shortRef = `${paperTitle} (${paper.publication_year})`;

        (paper.authorships || []).forEach(authorship => {
            const author = authorship.author;
            if (!author) return;
            const authorId = author.id;
            if (!authorId) return; // Must have OpenAlex ID

            if (!authorPapers[authorId]) authorPapers[authorId] = [];
            if (!authorPapers[authorId].includes(shortRef)) {
                authorPapers[authorId].push(shortRef);
            }

            if (!authorMap.has(authorId)) {
                authorMap.set(authorId, {
                    id: authorId,
                    name: author.display_name,
                    orcid: author.orcid || '',
                    papers_cited_in: 1
                });
            } else {
                authorMap.get(authorId).papers_cited_in += 1;
            }
        });
    });

    const uniqueAuthorsBase = Array.from(authorMap.values());
    console.log(`✅ Extracted ${uniqueAuthorsBase.length} unique authors.\n`);

    // -----------------------------------------------------------------
    // PHASE 3: Author Metrics & Filtering
    // -----------------------------------------------------------------
    console.log(`[Phase 3] Fetching detailed author metrics (batches of 40)...`);
    const authorDetailsMap = new Map();
    const chunks = chunkArray(uniqueAuthorsBase, 40);

    for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i];
        const ids = chunk.map(a => a.id.split('/').pop());
        const filter = ids.join('|');
        const url = `https://api.openalex.org/authors?filter=openalex:${filter}&per-page=50`;

        try {
            const data = await fetchJsonWithTimeout(url);
            if (data && data.results) {
                data.results.forEach(author => {
                    authorDetailsMap.set(author.id, {
                        h_index: author.summary_stats?.h_index || 0,
                        cited_by_count: author.cited_by_count || 0,
                        works_count: author.works_count || 0,
                        last_known_institution: getLatestInstitution(author),
                        wikipedia_url: author.ids?.wikipedia || null
                    });
                });
            }
            process.stdout.write(`.`);
        } catch (e) {
             process.stdout.write(`x`);
            console.error(`\nError fetching batch ${i + 1}:`, e.message);
        }
        // Respect rate limit
        await new Promise(r => setTimeout(r, 200));
    }
    console.log();

    const completeAuthors = uniqueAuthorsBase.map(base => {
        const details = authorDetailsMap.get(base.id) || {
            h_index: 0, cited_by_count: 0, works_count: 0, last_known_institution: 'Unknown', wikipedia_url: null
        };
        return {
            ...base,
            ...details,
            citing_papers: authorPapers[base.id]
        };
    });

    // Write full backup
    fs.writeFileSync(path.join(tempDir, 'step3_detailed_authors_full.json'), JSON.stringify(completeAuthors, null, 2));

    // FILTER TARGETS BASED ON DEPTH
    let deepSearchTargets = [];
    if (limitBy === 'h-index' || !limitBy) {
        const threshold = parseInt(limitValue) || 30;
        deepSearchTargets = completeAuthors.filter(a => a.h_index >= threshold);
    } else if (limitBy === 'count') {
        const count = parseInt(limitValue) || 50;
        deepSearchTargets = [...completeAuthors].sort((a, b) => b.h_index - a.h_index).slice(0, count);
    }

    console.log(`\n✅ Stage 1 Complete. Filtered down to ${deepSearchTargets.length} distinguished authors.`);
    
    // Write TARGET file for human-in-the-loop review
    const targetFile = path.join(tempDir, 'step3_targets.json');
    fs.writeFileSync(targetFile, JSON.stringify(deepSearchTargets, null, 2));
    
    console.log(`==============================================`);
    console.log(`🛑 PAUSED: Please review and modify ${targetFile} if needed.`);
    console.log(`Run with --stage=2 to continue the process.`);
    console.log(`==============================================\n`);
}

async function runStage2() {
    console.log(`\n==============================================`);
    console.log(`🔍 Stage 2: Deep Wikipedia Search & Reporting`);
    console.log(`==============================================`);

    const targetFile = path.join(tempDir, 'step3_targets.json');
    if (!fs.existsSync(targetFile)) {
        console.error(`Error: ${targetFile} not found. Please run Stage 1 first.`);
        process.exit(1);
    }

    const contextFile = path.join(tempDir, 'step1_context.json');
    let targetTitle = 'Unknown Target';
    if(fs.existsSync(contextFile)) {
        const ctx = JSON.parse(fs.readFileSync(contextFile, 'utf8'));
        targetTitle = ctx.targetTitle;
    }

    let deepSearchTargets = JSON.parse(fs.readFileSync(targetFile, 'utf8'));
    console.log(`Loaded ${deepSearchTargets.length} authors from step3_targets.json for deep search.`);

    // -----------------------------------------------------------------
    // PHASE 4: Deep Identities and Honors Search (Wikipedia)
    // -----------------------------------------------------------------
    console.log(`\n[Phase 4] Searching Wikipedia for target keywords...`);
    let keywords = ['fellow', 'academician', 'academy of sciences', 'national academy', 'royal society', 'american academy of arts and sciences', 'ieee', 'american psychological association'];
    if (customKeywords) {
        keywords = customKeywords.split(',').map(k => k.trim().toLowerCase()).filter(k => k);
        console.log(`Using custom keywords: ${keywords.join(', ')}`);
    } else {
        console.log(`Using default Academician/Fellow keywords...`);
    }
    
    const foundAcademicians = [];

    for (let i = 0; i < deepSearchTargets.length; i++) {
        const target = deepSearchTargets[i];
        process.stdout.write(`Checking ${target.name}... `);
        
        try {
            const searchUrl = `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent('"' + target.name + '"')}&utf8=&format=json`;
            const searchData = await fetchJsonWithTimeout(searchUrl, 10000);

            if (searchData && searchData.query && searchData.query.search && searchData.query.search.length > 0) {
                let honors = [];
                let isAcademician = false;
                let matchingTitle = "";

                for (let j = 0; j < searchData.query.search.length; j++) {
                    const match = searchData.query.search[j];
                    const textToSearch = (match.title + " " + match.snippet).toLowerCase();

                    keywords.forEach(kw => {
                        if (textToSearch.includes(kw) && !honors.includes(kw)) {
                            isAcademician = true;
                            honors.push(kw);
                            matchingTitle = match.title;
                        }
                    });
                }

                // Fallback to page summary if search snippets missed it
                if (!isAcademician) {
                    const bestMatch = searchData.query.search[0];
                    const summaryUrl = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(bestMatch.title)}`;
                    try {
                        const summaryData = await fetchJsonWithTimeout(summaryUrl, 5000);
                        if (summaryData.extract) {
                            const lowerText = summaryData.extract.toLowerCase();
                            keywords.forEach(kw => {
                                if (lowerText.includes(kw) && !honors.includes(kw)) {
                                    isAcademician = true;
                                    honors.push(kw);
                                    matchingTitle = bestMatch.title;
                                }
                            });
                        }
                    } catch (e) {} // Ignore summary errors
                }

                if (isAcademician) {
                    console.log(`FOUND honors: ${honors.join(', ')}`);
                    foundAcademicians.push({
                        id: target.id,
                        name: target.name,
                        h_index: target.h_index,
                        citations: target.cited_by_count,
                        institution: target.last_known_institution,
                        wikipedia_title: matchingTitle,
                        matched_honors: honors,
                        citing_papers: target.citing_papers
                    });
                } else {
                     console.log(`No match.`);
                }
            } else {
                 console.log(`No wiki results.`);
            }
        } catch (e) {
            console.log(`Error: ${e.message}`);
        }
        await new Promise(r => setTimeout(r, 200)); // Rate limit wiki api
    }

    fs.writeFileSync(path.join(tempDir, 'step4_academicians.json'), JSON.stringify(foundAcademicians, null, 2));
    console.log(`\n✅ Found ${foundAcademicians.length} distinguished scholars with titles!\n`);

    // -----------------------------------------------------------------
    // PHASE 5: Report Generation (Output to root)
    // -----------------------------------------------------------------
    console.log(`[Phase 5] Generating final reports...`);

    // CSV
    const step5CsvLines = ['Author_ID,Name,Institution,H_Index,Citations,Wikipedia_Title,Honors,Citing_Papers'];
    foundAcademicians.forEach(acad => {
        const papersList = acad.citing_papers.join('; ');
        step5CsvLines.push(`"${acad.id}","${acad.name}","${acad.institution}",${acad.h_index},${acad.citations},"${acad.wikipedia_title}","${acad.matched_honors.join('; ')}","${papersList.replace(/"/g, '""')}"`);
    });
    fs.writeFileSync('./academicians_list.csv', step5CsvLines.join('\n'));

    // MD
    let md = `# Citation Analysis & Scholar Identity Report\n\n`;
    md += `**Target Article:** ${targetTitle}\n\n`;
    md += `## Executive Summary\nWe extracted citing literature, resolved affiliations, automatically searched for targeted identities (e.g., Academicians, Fellows, Members) via Wikipedia, and mapped them back to their source citing papers.\n\n`;

    md += `\n## Identified Scholars\n`;
    md += `Through our automated identity extraction pipeline, we successfully identified the following scholars from the citation network based on the search keywords:\n\n`;

    if (foundAcademicians.length === 0) {
        md += `*No matching titles or keywords were automatically identified from Wikipedia for the reviewed authors.*`;
    } else {
        // Sort by H-index descending
        foundAcademicians.sort((a,b) => b.h_index - a.h_index).forEach(acad => {
            md += `* **${acad.name}**\n`;
            const uniqueHonorsSet = new Set();
            acad.matched_honors.forEach(h => {
                // Keep the original formatting for default ones, but just title case custom ones
                if (h.includes('american academy')) uniqueHonorsSet.add('American Academy of Arts and Sciences');
                else if (h.includes('academy of sciences') || h.includes('national academy')) uniqueHonorsSet.add('Academy of Sciences / National Academy');
                else if (h.includes('american psychological association')) uniqueHonorsSet.add('American Psychological Association');
                else uniqueHonorsSet.add(h.replace(/\w\S*/g, (txt) => txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase()));
            });
            md += `  - **Identified Attributes/Honors:** ${Array.from(uniqueHonorsSet).join(', ')}\n`;
            md += `  - **Institution:** ${acad.institution}\n`;
            md += `  - **Academic Impact:** H-Index ${acad.h_index}, Citations ~${acad.citations}\n`;
            md += `  - **Source Citing Paper(s):** ${acad.citing_papers.join('; ')}\n\n`;
        });
    }

    fs.writeFileSync('./academician_report.md', md);
    console.log(`✅ Reports saved as 'academician_report.md' and 'academicians_list.csv'.`);
    console.log(`🎉 Pipeline complete!`);
}

// Main dispatcher
if (stage === 1) {
    runStage1().catch(console.error);
} else if (stage === 2) {
    runStage2().catch(console.error);
} else {
    console.error("Please specify --stage=1 or --stage=2");
    process.exit(1);
}
