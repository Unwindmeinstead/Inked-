/** Simple HTML to Markdown (good enough for notes) */
function htmlToMarkdown(html: string): string {
  const div = document.createElement('div');
  div.innerHTML = html;
  let out = '';
  const walk = (node: Node) => {
    if (node.nodeType === Node.TEXT_NODE) {
      out += node.textContent || '';
      return;
    }
    if (node.nodeType !== Node.ELEMENT_NODE) return;
    const el = node as HTMLElement;
    const tag = el.tagName.toLowerCase();
    const children = () => Array.from(el.childNodes).forEach(walk);
    switch (tag) {
      case 'h1': out += '\n# '; children(); out += '\n\n'; return;
      case 'h2': out += '\n## '; children(); out += '\n\n'; return;
      case 'h3': out += '\n### '; children(); out += '\n\n'; return;
      case 'p':
        out += '\n\n';
        children();
        out += '\n\n';
        return;
      case 'br': out += '\n'; return;
      case 'strong':
      case 'b': out += '**'; children(); out += '**'; return;
      case 'em':
      case 'i': out += '_'; children(); out += '_'; return;
      case 'a': out += '['; children(); out += `](${el.getAttribute('href') || ''})`; return;
      case 'ul': out += '\n'; el.querySelectorAll(':scope > li').forEach(li => { out += '- '; Array.from(li.childNodes).forEach(walk); out += '\n'; }); return;
      case 'ol': out += '\n'; el.querySelectorAll(':scope > li').forEach((li, i) => { out += `${i + 1}. `; Array.from(li.childNodes).forEach(walk); out += '\n'; }); return;
      case 'blockquote': out += '\n> '; children(); out += '\n'; return;
      case 'pre': out += '\n```\n'; out += el.textContent || ''; out += '\n```\n'; return;
      case 'code': if (el.closest('pre')) return; out += '`'; children(); out += '`'; return;
      default: children(); return;
    }
  };
  walk(div);
  return out.replace(/\n{3,}/g, '\n\n').trim();
}

export function exportNoteAsMarkdown(title: string, content: string, filename?: string): void {
  const md = `# ${title}\n\n${htmlToMarkdown(content)}`;
  const blob = new Blob([md], { type: 'text/markdown;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = (filename || title || 'note') + '.md';
  a.click();
  URL.revokeObjectURL(a.href);
}

const exportStyles = `
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: 'Poppins', sans-serif; font-weight: 300; line-height: 1.8; letter-spacing: 0.01em; color: #18181b; background: #fff; padding: 2rem; max-width: 48rem; margin: 0 auto; }
  h1 { font-size: 1.875rem; font-weight: 600; margin: 0 0 1rem; }
  h2 { font-size: 1.5rem; font-weight: 600; margin: 1.5rem 0 0.75rem; }
  h3 { font-size: 1.25rem; font-weight: 600; margin: 1rem 0 0.5rem; }
  p { margin: 0.75rem 0; }
  a { color: #2563eb; }
  ul, ol { margin: 0.75rem 0; padding-left: 1.5rem; }
  blockquote { border-left: 4px solid #d4d4d8; padding-left: 1rem; margin: 0.75rem 0; font-style: italic; color: #52525b; }
  pre, code { background: #f4f4f5; padding: 0.125rem 0.375rem; border-radius: 0.25rem; font-size: 0.875em; }
  pre { padding: 1rem; overflow-x: auto; margin: 0.75rem 0; }
`;

export function exportNoteAsHTML(title: string, content: string, filename?: string): void {
  const html = `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"/><title>${escapeHtml(title)}</title><style>${exportStyles}</style></head><body><h1>${escapeHtml(title)}</h1><div class="content">${content}</div></body></html>`;
  const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = (filename || title || 'note') + '.html';
  a.click();
  URL.revokeObjectURL(a.href);
}

function escapeHtml(s: string): string {
  const div = document.createElement('div');
  div.textContent = s;
  return div.innerHTML;
}

export function exportNoteAsPDF(title: string, content: string): void {
  const win = window.open('', '_blank');
  if (!win) return;
  win.document.write(`
    <!DOCTYPE html><html><head><meta charset="utf-8"/><title>${escapeHtml(title)}</title>
    <style>${exportStyles}</style></head>
    <body><h1>${escapeHtml(title)}</h1><div class="content">${content}</div></body></html>
  `);
  win.document.close();
  win.onload = () => {
    win.print();
    win.onafterprint = () => win.close();
  };
}
