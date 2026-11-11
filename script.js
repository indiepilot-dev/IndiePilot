
 // Parse CSV text, including quoted commas, line breaks, and escaped quotes.
function parseCSV(text) {
    const rows = [];
    let row = [];
    let cell = "";
    let inQuotes = false;

    text = text.replace(/^\uFEFF/, "");

    for (let i = 0; i < text.length; i++) {
        const char = text[i];
        const nextChar = text[i + 1];

        if (char === '"') {
            if (inQuotes && nextChar === '"') {
                cell += '"';
                i++;
            } else {
                inQuotes = !inQuotes;
            }
        } else if (char === "," && !inQuotes) {
            row.push(cell);
            cell = "";
        } else if ((char === "\n" || char === "\r") && !inQuotes) {
            if (char === "\r" && nextChar === "\n") {
                i++;
            }

            row.push(cell);
            rows.push(row);
            row = [];
            cell = "";
        } else {
            cell += char;
        }
    }

    if (inQuotes) {
        throw new Error("Invalid CSV: Unclosed quotation mark.");
    }

    if (cell !== "" || row.length > 0) {
        row.push(cell);
        rows.push(row);
    }

    return rows;
}

const fileInput = document.getElementById("fileInput");
const fileName = document.getElementById("fileName");
const preview = document.getElementById("preview");
const maxLengthInput = document.getElementById("maxLength");

let cachedCSVData = null;

// Display an error without interpreting file content as HTML.
function showError(message) {
    preview.textContent = message;
    preview.classList.add("error-message");
}

function getVariables(text) {
    return text.match(/\{[^{}]+\}/g) || [];
}

// Quote CSV cells and neutralize possible spreadsheet formulas.
// Spreadsheet applications may treat =, +, -, @ as formula starters.
function escapeReportCSVCell(value) {
    const original = String(value ?? "");

    const formulaLike =
        /^[\s\uFEFF]*[=+\-@]/u.test(original) ||
        /^[\t\r\n]/u.test(original);

    const safe = formulaLike ? "'" + original : original;

    return '"' + safe.replace(/"/g, '""') + '"';
}

// Read the selected CSV and rebuild the analysis.
fileInput.addEventListener("change", async function () {
    const file = fileInput.files[0];

    if (!file) return;

    cachedCSVData = null;

    // Limit uploaded files to 5 MB.
    const MAX_FILE_SIZE = 5 * 1024 * 1024;

    if (file.size > MAX_FILE_SIZE) {
        showError("File Too Large: Please select a CSV file smaller than 5 MB.");
        return;
    }

    fileName.textContent = "Selected: " + file.name;

    let text;

    try {
        text = await file.text();
    } catch (error) {
        showError("File Read Error: Unable to read the selected file.");
        return;
    }

    if (text.trim() === "") {
        showError("Empty CSV File: Please select a CSV file containing translation data.");
        return;
    }

    let data;

    try {
        data = parseCSV(text);
    } catch (error) {
        cachedCSVData = null;
        showError(error.message);
        return;
    }

    preview.classList.remove("error-message");

    // Require key, English, Japanese as the first three columns.
    if (
        data.length === 0 ||
        data[0].length < 3 ||
        data[0][0].trim().toLowerCase() !== "key" ||
        data[0][1].trim().toLowerCase() !== "english" ||
        data[0][2].trim().toLowerCase() !== "japanese"
    ) {
        showError("Invalid CSV format. Please use: key, English, Japanese.");
        return;
    }

    const expectedColumns = data[0].length;

    for (let i = 1; i < data.length; i++) {
        const actualColumns = data[i].length;

        if (actualColumns !== expectedColumns) {
            showError(
                `Invalid CSV Row: Row ${i + 1}: Expected ${expectedColumns} columns, but found ${actualColumns}.`
            );
            return;
        }
    }

    cachedCSVData = data;
    analyzeCSV(data);
});

function analyzeCSV(data) {
    const MAX_LENGTH = Number(maxLengthInput.value);

    if (!Number.isInteger(MAX_LENGTH) || MAX_LENGTH < 1) {
        showError("Invalid character limit. Please enter a whole number greater than 0.");
        return;
    }

    preview.classList.remove("error-message");

    // Render the table using textContent to avoid HTML injection.
    preview.replaceChildren();

    const table = document.createElement("table");

    data.forEach((row, index) => {
        const tr = document.createElement("tr");

        row.forEach(cell => {
            const element = document.createElement(index === 0 ? "th" : "td");
            element.textContent = cell;
            tr.appendChild(element);
        });

        table.appendChild(tr);
    });

    preview.appendChild(table);

    // Analyze missing translations and placeholder mismatches.
    const issues = [];
    const headers = data[0];

    for (let i = 1; i < data.length; i++) {
        const key = data[i][0];

        if (!key) continue;

        const english = data[i][1] || "";

        for (let j = 1; j < headers.length; j++) {
            const value = data[i][j] || "";

            if (value.trim() === "") {
                issues.push({
                    type: "Missing Translation",
                    key,
                    language: headers[j],
                    message: "Translation is missing."
                });
            }
        }

        const englishVariables = getVariables(english).sort();

        for (let j = 2; j < headers.length; j++) {
            const translatedText = data[i][j] || "";

            if (translatedText.trim() === "") continue;

            const translatedVariables = getVariables(translatedText).sort();

            if (JSON.stringify(englishVariables) !== JSON.stringify(translatedVariables)) {
                issues.push({
                    type: "Variable Mismatch",
                    key,
                    language: headers[j],
                    message: "Variables do not match the English version."
                });
            }
        }
    }

    // Check Japanese text length (Unicode code points).
    for (let i = 1; i < data.length; i++) {
        const key = data[i][0];

        if (!key) continue;

        const japanese = data[i][2] || "";
        const actualLength = [...japanese].length;

        if (actualLength > MAX_LENGTH) {
            const overBy = actualLength - MAX_LENGTH;

            issues.push({
                type: "Text Too Long",
                key,
                language: "Japanese",
                message: `Shorten this translation by ${overBy} characters.`,
                limit: MAX_LENGTH,
                actual: actualLength,
                overBy
            });
        }
    }

    const missingCount = issues.filter(
        issue => issue.type === "Missing Translation"
    ).length;

    const mismatchCount = issues.filter(
        issue => issue.type === "Variable Mismatch"
    ).length;

    const tooLongCount = issues.filter(
        issue => issue.type === "Text Too Long"
    ).length;

    // Display analysis results.
    const resultsTitle = document.createElement("h2");
    resultsTitle.textContent = "Analysis Results";
    preview.appendChild(resultsTitle);

    const resultMessage = document.createElement("p");

    resultMessage.textContent = issues.length === 0
        ? "No issues found!"
        : `${issues.length} issue(s) found.`;

    preview.appendChild(resultMessage);

    if (issues.length > 0) {
        const summary = document.createElement("div");
        summary.className = "issue-summary";

        const counts = [
            `Missing Translation: ${missingCount}`,
            `Variable Mismatch: ${mismatchCount}`,
            `Text Too Long: ${tooLongCount}`
        ];

        counts.forEach(count => {
            const p = document.createElement("p");
            p.textContent = count;
            summary.appendChild(p);
        });

        preview.appendChild(summary);

        issues.forEach(issue => {
            const card = document.createElement("div");
            card.className = "issue";

            if (issue.type === "Missing Translation") {
                card.classList.add("missing");
            } else if (issue.type === "Variable Mismatch") {
                card.classList.add("mismatch");
            } else if (issue.type === "Text Too Long") {
                card.classList.add("too-long");
            }

            const heading = document.createElement("strong");
            heading.textContent = issue.type;
            card.appendChild(heading);

            const location = document.createElement("p");
            const locationLabel = document.createElement("strong");

            locationLabel.textContent = "Where: ";
            location.appendChild(locationLabel);

            location.appendChild(
                document.createTextNode(`${issue.key} → ${issue.language}`)
            );

            card.appendChild(location);

            if (issue.type === "Text Too Long") {
                const details = document.createElement("div");
                details.className = "length-details";

                const values = [
                    ["Limit", issue.limit],
                    ["Actual", issue.actual],
                    ["Over by", `+${issue.overBy}`]
                ];

                values.forEach(([label, value]) => {
                    const box = document.createElement("div");
                    const span = document.createElement("span");
                    span.textContent = label;

                    const number = document.createElement("strong");
                    number.textContent = value;

                    box.appendChild(span);
                    box.appendChild(number);

                    details.appendChild(box);
                });

                card.appendChild(details);

                const message = document.createElement("p");
                message.textContent = issue.message;
                card.appendChild(message);
            } else {
                const message = document.createElement("p");
                const problemLabel = document.createElement("strong");

                problemLabel.textContent = "Problem: ";
                message.appendChild(problemLabel);

                message.appendChild(
                    document.createTextNode(issue.message)
                );

                card.appendChild(message);
            }

            preview.appendChild(card);
        });
    }

    // Download the issue report as UTF-8 CSV.
    const downloadButton = document.createElement("button");

    downloadButton.textContent = "Download Analysis Report";
    downloadButton.className = "upload-button";
    preview.appendChild(downloadButton);

    downloadButton.addEventListener("click", function () {
        const csvHeaders = ["Type", "Key", "Language", "Message"];

        const csvRows = [
            csvHeaders.join(","),
            ...issues.map(issue => [
                issue.type,
                issue.key,
                issue.language,
                issue.message
            ].map(escapeReportCSVCell).join(","))
        ];

        const csvContent = "\uFEFF" + csvRows.join("\n");

        const blob = new Blob(
            [csvContent],
            { type: "text/csv;charset=utf-8;" }
        );

        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");

        link.href = url;
        link.download = "IndiePilot-Report.csv";
        link.click();

        setTimeout(() => URL.revokeObjectURL(url), 1000);
    });
}

// Reanalyze cached CSV data when the character limit changes.
maxLengthInput.addEventListener("input", function () {
    if (cachedCSVData === null) return;

    analyzeCSV(cachedCSVData);
});
