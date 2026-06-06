export const DEFAULT_TABLE_MARKDOWN = `| Column 1 | Column 2 |
| --- | --- |
|  |  |
|  |  |`;

export function previewMissingTableControls(root: HTMLElement): boolean {
  for (const table of root.querySelectorAll("table")) {
    if (!table.closest(".gdd-table-wrap")?.querySelector(".gdd-table-control")) {
      return true;
    }
  }
  return false;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function renderInline(text: string): string {
  const escaped = escapeHtml(text);
  // Deliberately simple inline rules; avoids cross-block regex hacks.
  return escaped
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>");
}

type Block =
  | { type: "h"; level: 1 | 2 | 3; text: string }
  | { type: "p"; lines: string[] }
  | { type: "ul"; items: string[] }
  | { type: "ol"; items: string[] }
  | { type: "hr" }
  | { type: "table"; headers: string[]; rows: string[][] };

function isHrLine(line: string): boolean {
  const t = line.trim();
  return t === "---" || t === "***" || t === "___";
}

function parseMarkdown(md: string): Block[] {
  const lines = md.replace(/\r\n/g, "\n").split("\n");
  const blocks: Block[] = [];
  let i = 0;

  const parseTableLine = (raw: string) => {
    const line = raw.trim();
    const inner =
      line.startsWith("|") && line.endsWith("|") && line.length >= 2
        ? line.slice(1, -1)
        : line.startsWith("|")
          ? line.slice(1)
          : line.endsWith("|")
            ? line.slice(0, -1)
            : line;

    // Preserve empty cells between pipes by not filtering falsy values.
    return inner.split("|").map((c) => c.trim());
  };

  const flushParagraph = (acc: string[]) => {
    const cleaned = acc.join("\n").trim();
    if (!cleaned) return;
    blocks.push({ type: "p", lines: cleaned.split("\n") });
  };

  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();

    if (!trimmed) {
      i++;
      continue;
    }

    // Table block
    if (
      trimmed.startsWith("|") &&
      i + 1 < lines.length &&
      /^\s*\|?[\s:-]+\|\s*[\s|:-]*\s*$/.test(lines[i + 1])
    ) {
      const headerLine = lines[i];
      i += 2;
      const body: string[] = [];
      while (i < lines.length && lines[i].trim().startsWith("|")) {
        body.push(lines[i]);
        i++;
      }
      const headers = parseTableLine(headerLine);
      const rows = body.map(parseTableLine);
      blocks.push({ type: "table", headers, rows });
      continue;
    }

    // Headings
    const hMatch = /^(#{1,3})\s+(.+)$/.exec(trimmed);
    if (hMatch) {
      const level = hMatch[1].length as 1 | 2 | 3;
      blocks.push({ type: "h", level, text: hMatch[2] });
      i++;
      continue;
    }

    // Horizontal rule
    if (isHrLine(trimmed)) {
      blocks.push({ type: "hr" });
      i++;
      continue;
    }

    // Lists
    const ulItems: string[] = [];
    const olItems: string[] = [];
    let listMode: "ul" | "ol" | null = null;
    let j = i;
    while (j < lines.length) {
      const t = lines[j].trim();
      if (!t) break;
      const ul = /^[-*]\s+(.+)$/.exec(t);
      const ol = /^(\d+)\.\s+(.+)$/.exec(t);
      if (ul) {
        if (listMode && listMode !== "ul") break;
        listMode = "ul";
        ulItems.push(ul[1]);
        j++;
        continue;
      }
      if (ol) {
        if (listMode && listMode !== "ol") break;
        listMode = "ol";
        olItems.push(ol[2]);
        j++;
        continue;
      }
      break;
    }
    if (listMode === "ul") {
      blocks.push({ type: "ul", items: ulItems });
      i = j;
      continue;
    }
    if (listMode === "ol") {
      blocks.push({ type: "ol", items: olItems });
      i = j;
      continue;
    }

    // Paragraph (collect until blank line or a new block start)
    const paragraph: string[] = [];
    while (i < lines.length) {
      const l = lines[i];
      const t = l.trim();
      if (!t) break;
      if (/^(#{1,3})\s+/.test(t)) break;
      if (isHrLine(t)) break;
      if (/^[-*]\s+/.test(t)) break;
      if (/^\d+\.\s+/.test(t)) break;
      if (
        t.startsWith("|") &&
        i + 1 < lines.length &&
        /^\s*\|?[\s:-]+\|\s*[\s|:-]*\s*$/.test(lines[i + 1])
      ) {
        break;
      }
      paragraph.push(l);
      i++;
    }
    flushParagraph(paragraph);
    continue;
  }

  return blocks;
}

export function renderMarkdown(md: string): string {
  if (!md.trim()) {
    return "<p class='empty-preview'>Click here to start writing…</p>";
  }

  const blocks = parseMarkdown(md);
  const out: string[] = [];

  for (const b of blocks) {
    if (b.type === "h") {
      out.push(`<h${b.level}>${renderInline(b.text)}</h${b.level}>`);
    } else if (b.type === "p") {
      const body = b.lines.map(renderInline).join("<br>");
      out.push(`<p>${body}</p>`);
    } else if (b.type === "ul") {
      const items = b.items
        .map((t) => `<li>${renderInline(t)}</li>`)
        .join("");
      out.push(`<ul>${items}</ul>`);
    } else if (b.type === "ol") {
      const items = b.items
        .map((t) => `<li>${renderInline(t)}</li>`)
        .join("");
      out.push(`<ol>${items}</ol>`);
    } else if (b.type === "hr") {
      out.push("<hr>");
    } else if (b.type === "table") {
      const th = b.headers.map((h) => `<th>${renderInline(h)}</th>`).join("");
      const trs = b.rows
        .map(
          (row) =>
            `<tr>${row.map((c) => `<td>${renderInline(c)}</td>`).join("")}</tr>`
        )
        .join("");
      out.push(
        `<div class='gdd-table-wrap'>` +
          `<table class='gdd-table'>` +
            `<thead><tr>${th}</tr></thead>` +
            `<tbody>${trs}</tbody>` +
          `</table>` +
          `<button type='button' class='gdd-table-control gdd-table-add-row' contenteditable='false' tabindex='-1' aria-label='Add row'>+</button>` +
          `<button type='button' class='gdd-table-control gdd-table-del-row' contenteditable='false' tabindex='-1' aria-label='Delete row'>-</button>` +
          `<button type='button' class='gdd-table-control gdd-table-add-col' contenteditable='false' tabindex='-1' aria-label='Add column'>+</button>` +
          `<button type='button' class='gdd-table-control gdd-table-del-col' contenteditable='false' tabindex='-1' aria-label='Delete column'>-</button>` +
        `</div>`
      );
    }
  }

  return out.join("");
}

export const DEFAULT_TABLE_HTML = renderMarkdown(DEFAULT_TABLE_MARKDOWN);
