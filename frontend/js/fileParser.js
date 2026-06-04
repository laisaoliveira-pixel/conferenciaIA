/**
 * fileParser.js
 * Leitura e extração de texto de Excel (.xlsx/.xls), CSV e PDF.
 * Depende de: SheetJS (XLSX global) e PDF.js (pdfjsLib global)
 */

const FileParser = (() => {

  // Configura worker do PDF.js
  if (typeof pdfjsLib !== 'undefined') {
    pdfjsLib.GlobalWorkerOptions.workerSrc =
      'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
  }

  /**
   * Formata tamanho em bytes para string legível
   */
  function formatSize(bytes) {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  }

  /**
   * Lê um arquivo Excel (.xlsx / .xls) e retorna texto estruturado
   */
  async function parseExcel(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const data = new Uint8Array(e.target.result);
          const wb = XLSX.read(data, { type: 'array' });
          let output = `=== ARQUIVO EXCEL: ${file.name} ===\n\n`;

          wb.SheetNames.forEach((sheetName) => {
            const ws = wb.Sheets[sheetName];
            const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
            if (rows.length === 0) return;

            output += `--- ABA: ${sheetName} ---\n`;

            // Converte cada linha em texto tabular
            rows.forEach((row, idx) => {
              const cells = row.map(c => {
                // Formata número com vírgula decimal no padrão BR
                if (typeof c === 'number') {
                  return c.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
                }
                return String(c).trim();
              });
              const line = cells.join(' | ');
              if (line.replace(/\|/g, '').trim()) {
                output += (idx === 0 ? '[CABEÇALHO] ' : '') + line + '\n';
              }
            });
            output += '\n';
          });

          resolve({ name: file.name, size: formatSize(file.size), type: 'excel', content: output });
        } catch (err) {
          reject(new Error(`Erro ao ler Excel "${file.name}": ${err.message}`));
        }
      };
      reader.onerror = () => reject(new Error(`Falha ao ler o arquivo "${file.name}"`));
      reader.readAsArrayBuffer(file);
    });
  }

  /**
   * Lê um arquivo CSV e retorna texto estruturado
   */
  async function parseCSV(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const text = e.target.result;
          // Detecta delimitador (;, ,, tab)
          const firstLine = text.split('\n')[0] || '';
          const delim = firstLine.includes(';') ? ';' : firstLine.includes('\t') ? '\t' : ',';

          const lines = text.split('\n');
          let output = `=== ARQUIVO CSV: ${file.name} ===\n\n`;

          lines.forEach((line, idx) => {
            const trimmed = line.trim();
            if (!trimmed) return;
            const cells = trimmed.split(delim).map(c => c.trim().replace(/^"|"$/g, ''));
            output += (idx === 0 ? '[CABEÇALHO] ' : '') + cells.join(' | ') + '\n';
          });

          resolve({ name: file.name, size: formatSize(file.size), type: 'csv', content: output });
        } catch (err) {
          reject(new Error(`Erro ao ler CSV "${file.name}": ${err.message}`));
        }
      };
      reader.onerror = () => reject(new Error(`Falha ao ler o arquivo "${file.name}"`));
      reader.readAsText(file, 'UTF-8');
    });
  }

  /**
   * Extrai texto de um arquivo PDF usando PDF.js
   */
  async function parsePDF(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = async (e) => {
        try {
          const typedArray = new Uint8Array(e.target.result);
          const pdf = await pdfjsLib.getDocument({ data: typedArray }).promise;
          let output = `=== ARQUIVO PDF: ${file.name} (${pdf.numPages} páginas) ===\n\n`;

          for (let i = 1; i <= pdf.numPages; i++) {
            const page = await pdf.getPage(i);
            const content = await page.getTextContent();
            const pageText = content.items.map(item => item.str).join(' ');
            output += `--- PÁGINA ${i} ---\n${pageText}\n\n`;
          }

          resolve({ name: file.name, size: formatSize(file.size), type: 'pdf', content: output });
        } catch (err) {
          reject(new Error(`Erro ao ler PDF "${file.name}": ${err.message}`));
        }
      };
      reader.onerror = () => reject(new Error(`Falha ao ler o arquivo "${file.name}"`));
      reader.readAsArrayBuffer(file);
    });
  }

  /**
   * Lê um arquivo TXT simples
   */
  async function parseTXT(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        resolve({
          name: file.name,
          size: formatSize(file.size),
          type: 'txt',
          content: `=== ARQUIVO TXT: ${file.name} ===\n\n${e.target.result}`
        });
      };
      reader.onerror = () => reject(new Error(`Falha ao ler o arquivo "${file.name}"`));
      reader.readAsText(file, 'UTF-8');
    });
  }

  /**
   * Roteador principal: detecta tipo e chama parser correto
   */
  async function parse(file) {
    const ext = file.name.split('.').pop().toLowerCase();
    switch (ext) {
      case 'xlsx':
      case 'xls':
        return parseExcel(file);
      case 'csv':
        return parseCSV(file);
      case 'pdf':
        return parsePDF(file);
      case 'txt':
        return parseTXT(file);
      default:
        throw new Error(`Formato não suportado: .${ext}`);
    }
  }

  /**
   * Processa múltiplos arquivos
   */
  async function parseAll(files) {
    const results = [];
    const errors = [];
    for (const file of files) {
      try {
        const result = await parse(file);
        results.push(result);
      } catch (err) {
        errors.push(err.message);
      }
    }
    return { results, errors };
  }

  return { parse, parseAll, formatSize };
})();
