/**
 * reportRenderer.js
 * Renderiza o relatório de auditoria em HTML formatado,
 * com suporte a markdown básico e badges de severidade.
 */

const ReportRenderer = (() => {

  /**
   * Converte markdown simples em HTML seguro
   */
  function markdownToHTML(text) {
    if (!text) return '';

    // Escapa HTML básico
    let html = text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');

    // Tabelas markdown
    html = parseMarkdownTables(html);

    // Headings
    html = html
      .replace(/^#{4}\s+(.+)$/gm, '<h4>$1</h4>')
      .replace(/^#{3}\s+(.+)$/gm, '<h3>$1</h3>')
      .replace(/^#{2}\s+(.+)$/gm, '<h2>$1</h2>')
      .replace(/^#{1}\s+(.+)$/gm, '<h1>$1</h1>');

    // Bold e itálico
    html = html
      .replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>')
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.+?)\*/g, '<em>$1</em>')
      .replace(/__(.+?)__/g, '<strong>$1</strong>')
      .replace(/_(.+?)_/g, '<em>$1</em>');

    // Código inline
    html = html.replace(/`([^`]+)`/g, '<code>$1</code>');

    // Linha horizontal
    html = html.replace(/^---+$/gm, '<hr>');

    // Badges de severidade
    html = html
      .replace(/🔴\s*CRÍTICO/g, '🔴 <span class="badge badge-critical">CRÍTICO</span>')
      .replace(/🟡\s*ATENÇÃO/g, '🟡 <span class="badge badge-warning">ATENÇÃO</span>')
      .replace(/🟢\s*OK/g, '🟢 <span class="badge badge-ok">OK</span>');

    // Listas não ordenadas
    html = html.replace(/^[*\-]\s+(.+)$/gm, '<li>$1</li>');
    html = html.replace(/(<li>.*<\/li>\n?)+/g, '<ul>$&</ul>');

    // Listas ordenadas
    html = html.replace(/^\d+\.\s+(.+)$/gm, '<li>$1</li>');

    // Blockquotes
    html = html.replace(/^&gt;\s+(.+)$/gm, '<blockquote>$1</blockquote>');

    // Parágrafos: linhas que não são tags HTML
    const lines = html.split('\n');
    const result = [];
    let inBlock = false;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const trimmed = line.trim();

      if (/^<(h[1-6]|ul|ol|li|hr|blockquote|pre|table|tr|td|th|thead|tbody)/.test(trimmed)) {
        inBlock = true;
        result.push(line);
      } else if (trimmed === '') {
        inBlock = false;
        result.push('');
      } else if (!inBlock) {
        result.push(`<p>${line}</p>`);
      } else {
        result.push(line);
      }
    }

    return result.join('\n');
  }

  /**
   * Converte tabelas markdown em HTML
   */
  function parseMarkdownTables(text) {
    const tableRegex = /^\|(.+)\|\n\|[-| :]+\|\n((?:\|.+\|\n?)*)/gm;
    return text.replace(tableRegex, (match, header, rows) => {
      const headers = header.split('|').map(h => h.trim()).filter(Boolean);
      const headerHTML = `<thead><tr>${headers.map(h => `<th>${h}</th>`).join('')}</tr></thead>`;

      const bodyRows = rows.trim().split('\n').map(row => {
        const cells = row.split('|').map(c => c.trim()).filter(Boolean);
        return `<tr>${cells.map(c => `<td>${c}</td>`).join('')}</tr>`;
      }).join('\n');
      const bodyHTML = `<tbody>${bodyRows}</tbody>`;

      return `<div style="overflow-x:auto;margin:1rem 0;border-radius:8px;border:1.5px solid #dde5f4;"><table style="width:100%;border-collapse:collapse;font-size:0.82rem;">
        <style>
          .report-table th { background:#f0f5ff; padding:0.5rem 0.875rem; text-align:left; border-bottom:2px solid #dde5f4; font-weight:700; color:#0f172a; font-size:0.75rem; text-transform:uppercase; letter-spacing:0.04em; }
          .report-table td { padding:0.45rem 0.875rem; border-bottom:1px solid #f0f5ff; color:#475569; vertical-align:top; }
          .report-table tr:last-child td { border-bottom:none; }
          .report-table tr:hover td { background:#f8faff; }
        </style>
        ${headerHTML}${bodyHTML}
      </table></div>`;
    });
  }

  /**
   * Renderiza o relatório final na div de resultado
   * @param {string} text - Texto markdown do relatório
   * @param {boolean} streaming - Se true, adiciona cursor de streaming
   */
  function render(text, streaming = false) {
    const reportBody = document.getElementById('reportBody');
    if (!reportBody) return;

    let html = markdownToHTML(text);
    if (streaming) {
      html += '<span class="streaming-cursor"></span>';
    }
    reportBody.innerHTML = html;
  }

  /**
   * Renderiza incrementalmente durante streaming
   * @param {string} fullText - Texto completo acumulado até agora
   */
  function renderStreaming(fullText) {
    render(fullText, true);
    // Auto-scroll suave
    const section = document.getElementById('sectionResult');
    if (section) {
      section.scrollIntoView({ behavior: 'smooth', block: 'end' });
    }
  }

  /**
   * Finaliza o relatório (remove cursor, fixa conteúdo)
   */
  function finalize(fullText) {
    render(fullText, false);
  }

  /**
   * Renderiza metadados do relatório
   */
  function renderMeta(data) {
    const meta = document.getElementById('reportMeta');
    if (!meta) return;

    const now = new Date().toLocaleString('pt-BR');
    const fileCount = (data.folhaFiles?.length || 0) + (data.convencaoFile ? 1 : 0);

    meta.innerHTML = `
      <div class="meta-item">
        <span class="meta-label">Data/Hora</span>
        <span class="meta-value">${now}</span>
      </div>
      <div class="meta-item">
        <span class="meta-label">Arquivos Analisados</span>
        <span class="meta-value">${fileCount} arquivo${fileCount !== 1 ? 's' : ''}</span>
      </div>
      <div class="meta-item">
        <span class="meta-label">Modelo IA</span>
        <span class="meta-value">${data.deployment || '—'}</span>
      </div>
      <div class="meta-item">
        <span class="meta-label">Status</span>
        <span class="meta-value" style="color:var(--green-light)">✅ Análise concluída</span>
      </div>
    `;
  }

  /**
   * Exporta relatório como arquivo .txt
   */
  function exportAsText(text) {
    const now = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 16);
    const filename = `relatorio-folha-${now}.txt`;
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  /**
   * Retorna o texto puro do relatório (sem HTML)
   */
  function getRawText() {
    const el = document.getElementById('reportBody');
    return el ? el.innerText : '';
  }

  return { render, renderStreaming, finalize, renderMeta, exportAsText, getRawText, markdownToHTML };
})();
