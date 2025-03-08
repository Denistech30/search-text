// Debounce function for performance
function debounce(func, delay) {
    let timeout;
    return function (...args) {
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(this, args), delay);
    };
}

// Escape special characters for non-regex mode
function escapeRegExp(string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// Highlight matches
function highlight(text, searchTerm, caseSensitive, regexEnabled, wholeWord) {
    let pattern;
    try {
        if (regexEnabled) {
            pattern = new RegExp(searchTerm, caseSensitive ? "g" : "gi");
        } else {
            pattern = wholeWord
                ? new RegExp(`\\b${escapeRegExp(searchTerm)}\\b`, caseSensitive ? "g" : "gi")
                : new RegExp(escapeRegExp(searchTerm), caseSensitive ? "g" : "gi");
        }
    } catch (e) {
        return text; // Fallback to plain text if regex fails
    }
    return text.replace(pattern, match => `<span class="highlight">${match}</span>`);
}

// Scroll to a specific line
function scrollToLine(lineNumber) {
    const textArea = document.getElementById("text-input");
    const lines = textArea.value.split("\n");
    let charIndex = 0;
    for (let i = 0; i < lineNumber - 1; i++) {
        charIndex += lines[i].length + 1;
    }
    textArea.focus();
    textArea.setSelectionRange(charIndex, charIndex);
    textArea.scrollTop = textArea.scrollHeight * (lineNumber / lines.length);
}

// Undo/Redo State Management
let history = [];
let historyIndex = -1;

function saveState() {
    const text = document.getElementById("text-input").value;
    history = history.slice(0, historyIndex + 1); // Truncate forward history
    history.push(text);
    historyIndex++;
    if (history.length > 20) history.shift(); // Limit to 20 states
}

function undo() {
    if (historyIndex > 0) {
        historyIndex--;
        document.getElementById("text-input").value = history[historyIndex];
        searchText(); // Refresh results
    }
}

function redo() {
    if (historyIndex < history.length - 1) {
        historyIndex++;
        document.getElementById("text-input").value = history[historyIndex];
        searchText(); // Refresh results
    }
}

// Notification function for error and success messages
function showNotification(message, type = 'error') {
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.textContent = message;
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.style.opacity = '0';
        setTimeout(() => document.body.removeChild(notification), 300);
    }, 2500);
}

// Inject basic styles for notifications
document.head.insertAdjacentHTML('beforeend', `
    <style>
    .notification {
        position: fixed;
        top: 20px;
        right: 20px;
        background: #ff4d4d;
        color: white;
        padding: 10px 15px;
        border-radius: 5px;
        opacity: 1;
        transition: opacity 0.3s ease-in-out;
        font-size: 14px;
        z-index: 10000;
    }
    .notification.success {
        background: #4caf50;
    }
    </style>
`);

// Core Search Function with Loading indicator and error handling
function searchText() {
    const text = document.getElementById("text-input").value;
    const searchTerm = document.getElementById("search-term").value.trim();
    const caseSensitive = document.getElementById("case-sensitive").checked;
    const regexEnabled = document.getElementById("regex-mode").checked;
    const wholeWord = document.getElementById("whole-word").checked;
    const resultsDiv = document.getElementById("results");
    const statsDiv = document.getElementById("stats");
    const startTime = performance.now();

    if (!text) {
        showNotification("Please enter some text.");
        resultsDiv.innerHTML = "<p>Please enter some text.</p>";
        statsDiv.innerHTML = "";
        return;
    }
    if (!searchTerm) {
        showNotification("Please enter a search term.");
        resultsDiv.innerHTML = "<p>Please enter a search term.</p>";
        statsDiv.innerHTML = "";
        return;
    }

    try {
        resultsDiv.innerHTML = "<p>Searching...</p>";

        const flags = caseSensitive ? "g" : "gi";
        const regex = regexEnabled
            ? new RegExp(searchTerm, flags)
            : new RegExp(wholeWord ? `\\b${escapeRegExp(searchTerm)}\\b` : escapeRegExp(searchTerm), flags);
        const lines = text.split("\n");
        const matches = [];

        lines.forEach((line, index) => {
            if (regex.test(line)) {
                matches.push({ line: index + 1, content: line });
            }
        });

        resultsDiv.innerHTML = matches.length > 0
            ? `<ul>${matches.map(match => `
                <li class="match" onclick="scrollToLine(${match.line})">
                    <strong>Line ${match.line}:</strong> ${highlight(match.content, searchTerm, caseSensitive, regexEnabled, wholeWord)}
                </li>`).join("")}</ul>`
            : `<p>No matches found for "${searchTerm}".</p>`;

        const endTime = performance.now();
        statsDiv.innerHTML = `
            Words: ${text.split(/\s+/).filter(Boolean).length} | 
            Matches: ${matches.length} | 
            Time: ${(endTime - startTime).toFixed(2)}ms
        `;
        
        saveSearch(searchTerm);
    } catch (e) {
        showNotification("Invalid regex pattern: " + e.message);
        resultsDiv.innerHTML = `<p>Invalid regex pattern: ${e.message}</p>`;
        statsDiv.innerHTML = "";
    }
}

// Proximity Search Function
function proximitySearch() {
    const text = document.getElementById("text-input").value;
    const term1 = document.getElementById("search-term").value.trim();
    const term2 = document.getElementById("proximity-term").value.trim();
    const distance = parseInt(document.getElementById("proximity-distance").value) || 5;
    const caseSensitive = document.getElementById("case-sensitive").checked;
    const resultsDiv = document.getElementById("results");
    const statsDiv = document.getElementById("stats");
    const startTime = performance.now();

    if (!text || !term1 || !term2) {
        resultsDiv.innerHTML = "<p>Please enter text and both search terms.</p>";
        statsDiv.innerHTML = "";
        return;
    }

    const words = text.split(/\s+/);
    const matches = [];
    const regex1 = new RegExp(escapeRegExp(term1), caseSensitive ? "" : "i");
    const regex2 = new RegExp(escapeRegExp(term2), caseSensitive ? "" : "i");

    for (let i = 0; i < words.length; i++) {
        if (regex1.test(words[i])) {
            for (let j = i + 1; j < Math.min(i + distance + 1, words.length); j++) {
                if (regex2.test(words[j])) {
                    const start = Math.max(0, i - 5);
                    const end = Math.min(words.length, j + 5);
                    const snippet = words.slice(start, end).join(" ");
                    const lineNum = text.slice(0, text.indexOf(snippet)).split("\n").length;
                    matches.push({ line: lineNum, content: snippet });
                    break;
                }
            }
        }
    }

    resultsDiv.innerHTML = matches.length > 0
        ? `<ul>${matches.map(match => `
            <li class="match" onclick="scrollToLine(${match.line})">
                <strong>Line ${match.line}:</strong> ${highlight(match.content, term1, caseSensitive, false, false)} ... ${highlight(match.content, term2, caseSensitive, false, false)}
            </li>`).join("")}</ul>`
        : `<p>No proximity matches found for "${term1}" and "${term2}" within ${distance} words.</p>`;

    const endTime = performance.now();
    statsDiv.innerHTML = `
        Words: ${words.length} | 
        Matches: ${matches.length} | 
        Time: ${(endTime - startTime).toFixed(2)}ms
    `;
}

// Replace All Function
function replaceText() {
    const textArea = document.getElementById("text-input");
    const searchTerm = document.getElementById("search-term").value.trim();
    const replaceTerm = document.getElementById("replace-term").value;
    const caseSensitive = document.getElementById("case-sensitive").checked;
    const regexEnabled = document.getElementById("regex-mode").checked;
    const wholeWord = document.getElementById("whole-word").checked;

    if (!textArea.value || !searchTerm) {
        document.getElementById("results").innerHTML = "<p>Please enter text and a search term.</p>";
        return;
    }

    try {
        const flags = caseSensitive ? "g" : "gi";
        const regex = regexEnabled
            ? new RegExp(searchTerm, flags)
            : new RegExp(wholeWord ? `\\b${escapeRegExp(searchTerm)}\\b` : escapeRegExp(searchTerm), flags);
        const newText = textArea.value.replace(regex, replaceTerm);
        if (newText !== textArea.value) {
            textArea.value = newText;
            saveState();
            searchText();
        }
    } catch (e) {
        document.getElementById("results").innerHTML = `<p>Invalid regex pattern: ${e.message}</p>`;
    }
}

// Replace Next Function
function replaceNext() {
    const textArea = document.getElementById("text-input");
    const searchTerm = document.getElementById("search-term").value.trim();
    const replaceTerm = document.getElementById("replace-term").value;
    const caseSensitive = document.getElementById("case-sensitive").checked;
    const regexEnabled = document.getElementById("regex-mode").checked;
    const wholeWord = document.getElementById("whole-word").checked;

    if (!textArea.value || !searchTerm) {
        document.getElementById("results").innerHTML = "<p>Please enter text and a search term.</p>";
        return;
    }

    try {
        const flags = caseSensitive ? "" : "i";
        const regex = regexEnabled
            ? new RegExp(searchTerm, flags)
            : new RegExp(wholeWord ? `\\b${escapeRegExp(searchTerm)}\\b` : escapeRegExp(searchTerm), flags);
        const match = regex.exec(textArea.value);
        if (match) {
            textArea.value = textArea.value.substring(0, match.index) + replaceTerm + textArea.value.substring(match.index + match[0].length);
            saveState();
            searchText();
        } else {
            showNotification("No more occurrences found.");
        }
    } catch (e) {
        document.getElementById("results").innerHTML = `<p>Invalid regex pattern: ${e.message}</p>`;
    }
}

/* ---------------- Document Import Functions ---------------- */

async function importPDF(file) {
    pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.7.570/pdf.worker.min.js';
    const arrayBuffer = await file.arrayBuffer();
    try {
        const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
        let text = '';
        for (let i = 1; i <= pdf.numPages; i++) {
            const page = await pdf.getPage(i);
            const content = await page.getTextContent();
            let pageText = '';
            let lastY = null;
            content.items.forEach(item => {
                if (lastY !== null && Math.abs(item.transform[5] - lastY) > 5) {
                    pageText += '\n';
                }
                pageText += item.str + ' ';
                lastY = item.transform[5];
            });
            text += pageText.trim() + '\n\n';
        }
        document.getElementById("text-input").value = text.trim();
        saveState();
        searchText();
    } catch (e) {
        showNotification("Error processing PDF: " + e.message);
    }
}

function importDOCX(file) {
    const reader = new FileReader();
    reader.onload = function(e) {
        mammoth.extractRawText({ arrayBuffer: e.target.result })
            .then(function(result) {
                document.getElementById("text-input").value = result.value;
                saveState();
                searchText();
            })
            .catch(function(err) {
                showNotification("Error processing DOCX: " + err.message);
            });
    };
    reader.readAsArrayBuffer(file);
}

function importCSV(file) {
    const reader = new FileReader();
    reader.onload = function(e) {
        const rows = e.target.result.split("\n").map(row => row.split(",").join(" "));
        document.getElementById("text-input").value = rows.join("\n");
        saveState();
        searchText();
    };
    reader.readAsText(file);
}

function importText(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    const fileExtension = file.name.split('.').pop().toLowerCase();
    
    if (fileExtension === 'pdf') {
        importPDF(file);
    } else if (fileExtension === 'docx') {
        importDOCX(file);
    } else if (fileExtension === 'txt') {
        const reader = new FileReader();
        reader.onload = function(e) {
            document.getElementById("text-input").value = e.target.result;
            saveState();
            searchText();
        };
        reader.readAsText(file);
    } else if (fileExtension === 'csv') {
        importCSV(file);
    } else {
        showNotification("Unsupported file type: " + fileExtension);
    }
    event.target.value = "";
}

/* ---------------- Export Functions ---------------- */

function exportAsTXT(text) {
    if (!text) {
        showNotification("No text to export!");
        return;
    }
    const blob = new Blob([text], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "search_replace_text.txt";
    a.click();
    URL.revokeObjectURL(url);
    toggleExportOptions();
}

async function exportAsPDF(text) {
    if (!text) {
        showNotification("No text to export!");
        return;
    }
    try {
        const { PDFDocument, StandardFonts, rgb } = PDFLib;
        const pdfDoc = await PDFDocument.create();
        let page = pdfDoc.addPage([595, 842]);
        const { width, height } = page.getSize();
        const fontSize = 12;
        const margin = 50;
        const lineHeight = fontSize + 5;
        const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
        const maxWidth = width - 2 * margin;

        const lines = text.split("\n");
        let yPosition = height - margin;

        for (let line of lines) {
            const words = line.split(" ");
            let currentLine = "";
            
            for (let word of words) {
                const testLine = currentLine + (currentLine ? " " : "") + word;
                const textWidth = font.widthOfTextAtSize(testLine, fontSize);
                
                if (textWidth > maxWidth) {
                    if (yPosition < margin + lineHeight) {
                        page = pdfDoc.addPage([595, 842]);
                        yPosition = height - margin;
                    }
                    page.drawText(currentLine.trim(), {
                        x: margin,
                        y: yPosition,
                        size: fontSize,
                        font: font,
                        color: rgb(0, 0, 0)
                    });
                    yPosition -= lineHeight;
                    currentLine = word;
                } else {
                    currentLine = testLine;
                }
            }

            if (currentLine) {
                if (yPosition < margin + lineHeight) {
                    page = pdfDoc.addPage([595, 842]);
                    yPosition = height - margin;
                }
                page.drawText(currentLine.trim(), {
                    x: margin,
                    y: yPosition,
                    size: fontSize,
                    font: font,
                    color: rgb(0, 0, 0)
                });
                yPosition -= lineHeight;
            }
        }

        const pdfBytes = await pdfDoc.save();
        const blob = new Blob([pdfBytes], { type: "application/pdf" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "search_replace_text.pdf";
        a.click();
        URL.revokeObjectURL(url);
        toggleExportOptions();
    } catch (error) {
        showNotification("Error exporting PDF: " + error.message);
    }
}

function exportAsCSV(text) {
    if (!text) {
        showNotification("No text to export!");
        return;
    }
    const lines = text.split("\n").map(line => `"${line.replace(/"/g, '""')}"`);
    const csvContent = lines.join("\n");
    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "search_replace_text.csv";
    a.click();
    URL.revokeObjectURL(url);
    toggleExportOptions();
}

async function exportAsDOCX(text) {
    if (!text) {
        showNotification("No text to export!");
        return;
    }
    try {
        if (typeof HTMLDocx === "undefined") {
            throw new Error("HTMLDocx library not loaded. Falling back to basic export.");
        }

        // Convert plain text to basic HTML for better formatting
        const htmlContent = `
            <html>
                <body style="font-family: Arial, sans-serif; font-size: 12pt;">
                    ${text.split("\n").map(line => `<p>${line || " "}</p>`).join("")}
                </body>
            </html>
        `;

        // Use html-to-docx to generate the DOCX file
        const fileBuffer = await HTMLDocx(htmlContent, {
            pageSize: { width: 595, height: 842 }, // A4 size in points
            margins: { top: 72, bottom: 72, left: 72, right: 72 }, // 1 inch margins
            orientation: "portrait",
        });

        const blob = new Blob([fileBuffer], { type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "search_replace_text.docx";
        a.click();
        URL.revokeObjectURL(url);
    } catch (error) {
        showNotification("DOCX export failed: " + error.message);
        // Fallback to basic HTML-to-DOCX
        const basicHtmlContent = `<html><body>${text.replace(/\n/g, "<br>")}</body></html>`;
        const blob = new Blob([basicHtmlContent], { type: "application/msword" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "search_replace_text_fallback.docx";
        a.click();
        URL.revokeObjectURL(url);
    }
    toggleExportOptions();
}

function toggleExportOptions() {
    const exportOptions = document.getElementById("export-options");
    exportOptions.style.display = exportOptions.style.display === "none" ? "flex" : "none";
}

/* ---------------- Theme Toggle and Custom Themes ---------------- */
function toggleTheme() {
    const currentTheme = document.body.getAttribute("data-theme") || "light";
    const newTheme = currentTheme === "light" ? "dark" : "light";
    document.body.setAttribute("data-theme", newTheme);
    updateThemeIcon();
}

function applyTheme(theme) {
    document.body.setAttribute("data-theme", theme);
    updateThemeIcon();
}

function updateThemeIcon() {
    const toggleBtn = document.getElementById("theme-toggle");
    const icon = toggleBtn.querySelector("i");
    const currentTheme = document.body.getAttribute("data-theme") || "light";
    icon.classList.remove("fa-sun", "fa-moon");
    icon.classList.add(currentTheme === "light" || currentTheme === "blue" ? "fa-sun" : "fa-moon");
}

/* ---------------- Search History Functions ---------------- */
function saveSearch(term) {
    let history = JSON.parse(localStorage.getItem("searchHistory")) || [];
    history.unshift(term);
    history = [...new Set(history)].slice(0, 10);
    localStorage.setItem("searchHistory", JSON.stringify(history));
    updateHistory();
}

function updateHistory() {
    const historyList = document.getElementById("history-list");
    const history = JSON.parse(localStorage.getItem("searchHistory")) || [];
    historyList.innerHTML = history.map(term => `
        <li onclick="useSearchTerm('${term}')">${term}</li>
    `).join("");
}

function useSearchTerm(term) {
    document.getElementById("search-term").value = term;
    searchText();
    toggleSidebar();
}

function toggleSidebar() {
    const sidebar = document.getElementById("search-history");
    sidebar.classList.toggle("open");
}

/* ---------------- Word Frequency Analysis ---------------- */
function showFrequency() {
    const text = document.getElementById("text-input").value;
    const frequencyDiv = document.getElementById("frequency");
    
    if (!text) {
        frequencyDiv.innerHTML = "<p>No text to analyze.</p>";
        frequencyDiv.style.display = "block";
        return;
    }

    const words = text.toLowerCase().match(/\w+/g) || [];
    const frequency = {};
    words.forEach(word => frequency[word] = (frequency[word] || 0) + 1);
    const sortedFreq = Object.entries(frequency)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10);

    frequencyDiv.innerHTML = sortedFreq.length > 0
        ? `<ul>${sortedFreq.map(([word, count]) => `<li>${word}: ${count}</li>`).join("")}</ul>`
        : "<p>No words found.</p>";
    frequencyDiv.style.display = frequencyDiv.style.display === "block" ? "none" : "block";
}

/* ---------------- AI-Powered Suggestions (Simulated) ---------------- */
function showSuggestions() {
    const searchTerm = document.getElementById("search-term").value.trim();
    const suggestionsDiv = document.getElementById("suggestions");
    
    if (!searchTerm) {
        suggestionsDiv.innerHTML = "<p>Enter a search term to see suggestions.</p>";
        suggestionsDiv.style.display = "block";
        return;
    }

    const synonymMap = {
        "good": ["great", "excellent", "fine"],
        "bad": ["poor", "terrible", "awful"],
        "happy": ["joyful", "cheerful", "glad"],
        "big": ["large", "huge", "vast"],
        "small": ["tiny", "little", "mini"]
    };
    const suggestions = synonymMap[searchTerm.toLowerCase()] || ["No suggestions available"];

    suggestionsDiv.innerHTML = `
        <ul>${suggestions.map(suggestion => `
            <li onclick="useSearchTerm('${suggestion}')">${suggestion}</li>
        `).join("")}</ul>
    `;
    suggestionsDiv.style.display = suggestionsDiv.style.display === "block" ? "none" : "block";
}

/* ---------------- Initialization ---------------- */
document.addEventListener("DOMContentLoaded", () => {
    saveState();
    updateHistory();
    document.getElementById("search-term").addEventListener("input", debounce(searchText, 300));
    document.getElementById("text-input").addEventListener("input", debounce(saveState, 500));
    document.getElementById("theme-toggle").addEventListener("click", toggleTheme);
    document.getElementById("theme-select").addEventListener("change", (e) => applyTheme(e.target.value));

    document.body.setAttribute("data-theme", "light");
    updateThemeIcon();
});