/**
 * PDF Export Utility for Deep Research Reports
 * Produces a clean, elegant, publication-ready printable PDF report without
 * internal pipeline metadata, badges, or interactive UI clutter.
 */

export interface ResearchReportPdfOptions {
  title: string;
  contentHtml?: string | undefined;
  markdownText?: string | undefined;
  verifiedPapersCount?: number | undefined;
  subagentsCount?: number | undefined;
  temporalConstraints?: string | undefined;
}

function formatReportTitle(str: string): string {
  if (!str) return "Research Report";
  if (str === str.toLowerCase()) {
    return str
      .split(" ")
      .map((word) => (word ? word.charAt(0).toUpperCase() + word.slice(1) : ""))
      .join(" ");
  }
  return str;
}

/**
 * Sanitizes and strips interactive UI buttons, table action bars, copy/download
 * buttons, and SVG icons from the rendered HTML before printing.
 */
function cleanHtmlForPdf(rawHtml: string): string {
  if (typeof window === "undefined" || !rawHtml) return rawHtml;
  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(`<div>${rawHtml}</div>`, "text/html");
    const container = doc.body.firstElementChild || doc.body;

    // 1. Remove all interactive buttons, action bars, toolbars, and svgs
    const selectorsToRemove = [
      "button",
      "svg",
      "[role='toolbar']",
      "[role='tooltip']",
      "[data-radix-popper-content-wrapper]",
      "[aria-label*='copy' i]",
      "[aria-label*='download' i]",
      "[aria-label*='expand' i]",
      "[aria-label*='fullscreen' i]",
      "[class*='action' i]",
      "[class*='toolbar' i]",
      "[class*='copy' i]",
      "[class*='download' i]",
      "[class*='expand' i]",
      "[class*='fullscreen' i]",
      "[class*='button' i]",
      "[class*='btn' i]",
      "[class*='control' i]",
      ".no-print",
    ];

    for (const selector of selectorsToRemove) {
      const elements = container.querySelectorAll(selector);
      elements.forEach((el) => el.remove());
    }

    // 2. Clean up any empty containers or orphaned wrapper divs left by removed buttons
    const allDivs = container.querySelectorAll("div");
    allDivs.forEach((div) => {
      if (!div.textContent?.trim() && !div.querySelector("img, table, pre, code")) {
        div.remove();
      }
    });

    return container.innerHTML;
  } catch {
    return rawHtml;
  }
}

export function exportResearchReportPdf(options: ResearchReportPdfOptions) {
  const { title, contentHtml = "" } = options;

  const sanitizedHtml = cleanHtmlForPdf(contentHtml);
  const cleanTitle = formatReportTitle(title);

  const dateStr = new Date().toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const printDocument = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title></title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/katex.min.css">
  <style>
    @page {
      size: A4;
      margin: 20mm 18mm;
      @bottom-right {
        content: counter(page);
      }
    }
    
    *, *::before, *::after {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }

    body {
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      font-size: 11pt;
      line-height: 1.65;
      color: #1a1a1a;
      background: #ffffff;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
      padding: 0;
    }

    /* Aggressively hide any leftover UI buttons, toolbars, or SVGs */
    button,
    svg,
    [role='toolbar'],
    [role='tooltip'],
    [class*='action'],
    [class*='toolbar'],
    [class*='copy'],
    [class*='download'],
    [class*='expand'],
    [class*='fullscreen'],
    [class*='button'],
    [class*='btn'],
    [class*='control'],
    .no-print {
      display: none !important;
      visibility: hidden !important;
      opacity: 0 !important;
      height: 0 !important;
      width: 0 !important;
      margin: 0 !important;
      padding: 0 !important;
      border: 0 !important;
      overflow: hidden !important;
    }

    .report-header {
      border-bottom: 1.5px solid #e2e8f0;
      padding-bottom: 16px;
      margin-bottom: 24px;
    }

    .report-title {
      font-family: 'Plus Jakarta Sans', sans-serif;
      font-size: 22pt;
      font-weight: 800;
      line-height: 1.25;
      color: #0f172a;
      margin-bottom: 8px;
    }

    .report-date {
      font-size: 9.5pt;
      color: #64748b;
      font-weight: 500;
    }

    .report-body {
      color: #27272a;
    }

    .report-body h1 {
      font-family: 'Plus Jakarta Sans', sans-serif;
      font-size: 15pt;
      font-weight: 700;
      color: #0f172a;
      margin-top: 24px;
      margin-bottom: 10px;
      border-bottom: 1px solid #e2e8f0;
      padding-bottom: 6px;
      page-break-after: avoid;
    }

    .report-body h2 {
      font-family: 'Plus Jakarta Sans', sans-serif;
      font-size: 13pt;
      font-weight: 700;
      color: #1e293b;
      margin-top: 20px;
      margin-bottom: 8px;
      page-break-after: avoid;
    }

    .report-body h3 {
      font-family: 'Plus Jakarta Sans', sans-serif;
      font-size: 11.5pt;
      font-weight: 600;
      color: #334155;
      margin-top: 16px;
      margin-bottom: 6px;
      page-break-after: avoid;
    }

    .report-body p {
      margin-bottom: 12px;
      text-align: justify;
    }

    .report-body ul, .report-body ol {
      margin-left: 20px;
      margin-bottom: 14px;
    }

    .report-body li {
      margin-bottom: 6px;
    }

    .report-body strong {
      font-weight: 600;
      color: #0f172a;
    }

    .report-body blockquote {
      border-left: 3px solid #f59e0b;
      background: #fffbeb;
      padding: 10px 14px;
      margin: 14px 0;
      border-radius: 0 8px 8px 0;
      font-style: italic;
      color: #92400e;
    }

    /* Clean Publication-Grade Tables */
    .report-body table,
    table {
      width: 100% !important;
      border-collapse: collapse !important;
      margin: 16px 0 20px 0 !important;
      font-size: 9.5pt !important;
      page-break-inside: avoid !important;
      background: #ffffff !important;
      border: 1px solid #cbd5e1 !important;
      border-radius: 6px !important;
    }

    .report-body thead,
    thead {
      background: #f8fafc !important;
      border-bottom: 2px solid #cbd5e1 !important;
    }

    .report-body th,
    th {
      background: #f1f5f9 !important;
      color: #0f172a !important;
      font-family: 'Plus Jakarta Sans', sans-serif !important;
      font-weight: 700 !important;
      text-align: left !important;
      padding: 9px 12px !important;
      border: 1px solid #cbd5e1 !important;
      font-size: 9pt !important;
      letter-spacing: 0.02em !important;
    }

    .report-body td,
    td {
      padding: 8px 12px !important;
      border: 1px solid #e2e8f0 !important;
      vertical-align: top !important;
      line-height: 1.5 !important;
      color: #334155 !important;
    }

    .report-body tr:nth-child(even) td,
    tr:nth-child(even) td {
      background: #f8fafc !important;
    }

    .report-body code {
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
      font-size: 9pt;
      background: #f1f5f9;
      padding: 2px 5px;
      border-radius: 4px;
      color: #0f172a;
    }

    .report-body pre {
      background: #0f172a;
      color: #f8fafc;
      padding: 12px;
      border-radius: 8px;
      overflow-x: auto;
      margin: 14px 0;
      page-break-inside: avoid;
    }

    .report-body pre code {
      background: transparent;
      color: inherit;
      padding: 0;
    }

    .report-body a {
      color: #2563eb;
      text-decoration: underline;
    }

    @media print {
      body {
        width: 100%;
      }
      .no-print {
        display: none !important;
      }
    }
  </style>
</head>
<body>
  <div class="report-header">
    <h1 class="report-title">${cleanTitle}</h1>
    <div class="report-date">${dateStr}</div>
  </div>

  <div class="report-body">
    ${sanitizedHtml}
  </div>

  <script>
    window.onload = function() {
      setTimeout(function() {
        window.print();
      }, 400);
    };
  </script>
</body>
</html>`;

  // Create hidden iframe for seamless printing / PDF save
  const printFrame = document.createElement("iframe");
  printFrame.style.position = "fixed";
  printFrame.style.right = "0";
  printFrame.style.bottom = "0";
  printFrame.style.width = "0";
  printFrame.style.height = "0";
  printFrame.style.border = "0";
  document.body.appendChild(printFrame);

  const frameDoc = printFrame.contentWindow?.document;
  if (frameDoc) {
    frameDoc.open();
    frameDoc.write(printDocument);
    frameDoc.close();

    // Clean up iframe after printing
    setTimeout(() => {
      printFrame.remove();
    }, 60000);
  }
}
