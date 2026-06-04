/**
 * app.js — Frontend FolhaIA
 * Chama o backend local (http://localhost:8000) para análise.
 * Nenhuma credencial Azure é manipulada aqui.
 */

// URL base do backend (mesmo origem, pois é servido pelo FastAPI)
const API_BASE = '';   // '' = URL relativa, funciona em localhost:8000

// ============================================================
// Estado global
// ============================================================
const State = {
  files: {
    folha: [],      // Array de File objects
    convencao: null // File object ou null
  },
  reportText: '',
  isAnalyzing: false,
  backendOk: false
};

// ============================================================
// Inicialização
// ============================================================
document.addEventListener('DOMContentLoaded', () => {
  checkBackendHealth();
});

// ============================================================
// Health Check — verifica se o backend está online
// ============================================================
async function checkBackendHealth() {
  updateStatusBar('loading', 'Verificando servidor...');

  try {
    const response = await fetch(`${API_BASE}/api/health`, { signal: AbortSignal.timeout(4000) });
    const data = await response.json();

    if (data.status === 'ok' && data.configured) {
      State.backendOk = true;
      updateStatusBar('ok', `Servidor online · ${data.deployment}`);
      hideBackendError();
    } else if (data.status === 'ok' && !data.configured) {
      State.backendOk = false;
      updateStatusBar('error', 'Credenciais inválidas no .env');

      const problemList = data.problems && data.problems.length > 0
        ? `<ul style="margin:0.4rem 0 0 1rem;">${data.problems.map(p => `<li>${p}</li>`).join('')}</ul>`
        : '';

      showBackendError(
        '⚠️ Credenciais do Azure OpenAI não configuradas corretamente',
        `Edite o arquivo <code>backend/.env</code> com os valores corretos e reinicie o servidor.${problemList}`
      );
    }
  } catch (_) {
    State.backendOk = false;
    updateStatusBar('error', 'Servidor offline');
    showBackendError(
      'Servidor backend não encontrado.',
      'Execute o arquivo <code>backend/start.bat</code> e acesse <code>http://localhost:8000</code>'
    );
  }
}

function showBackendError(title, detail) {
  const el = document.getElementById('backendError');
  if (!el) return;
  el.innerHTML = `
    <div class="backend-error-icon">
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
      </svg>
    </div>
    <div>
      <strong>${title}</strong>
      <p>${detail}</p>
    </div>
  `;
  el.style.display = 'flex';
}

function hideBackendError() {
  const el = document.getElementById('backendError');
  if (el) el.style.display = 'none';
}

// ============================================================
// Status Bar
// ============================================================
function updateStatusBar(state, message) {
  const dot  = document.getElementById('statusDot');
  const text = document.getElementById('statusText');
  if (!dot || !text) return;
  dot.className = `status-dot status-${state}`;
  text.textContent = message;
}

// ============================================================
// Drag & Drop e Upload de Arquivos
// ============================================================
function handleDragOver(event) {
  event.preventDefault();
  event.currentTarget.classList.add('drag-over');
}

function handleDragLeave(event) {
  event.currentTarget.classList.remove('drag-over');
}

function handleDrop(event, type) {
  event.preventDefault();
  event.currentTarget.classList.remove('drag-over');
  processFiles(Array.from(event.dataTransfer.files), type);
}

function handleFiles(event, type) {
  processFiles(Array.from(event.target.files), type);
}

function processFiles(files, type) {
  const allowed = ['.xlsx', '.xls', '.csv', '.pdf', '.txt'];
  const valid = files.filter(f => allowed.some(ext => f.name.toLowerCase().endsWith(ext)));

  if (type === 'folha') {
    State.files.folha = [...State.files.folha, ...valid];
    renderFileList('fileFolha', State.files.folha, 'folha');
    document.getElementById('uploadFolha').classList.toggle('has-files', State.files.folha.length > 0);
  } else if (type === 'convencao') {
    const file = valid[0];
    if (file) {
      State.files.convencao = file;
      renderFileList('fileConvencao', [file], 'convencao');
      document.getElementById('uploadConvencao').classList.add('has-files');
    }
  }
  updateFileCountBadge();
}

function renderFileList(containerId, files, type) {
  const container = document.getElementById(containerId);
  if (!container) return;
  container.innerHTML = files.map((f, idx) => `
    <div class="file-item">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
        <polyline points="14 2 14 8 20 8"/>
      </svg>
      <span title="${f.name}">${f.name}</span>
      <span class="file-size">${FileParser.formatSize(f.size)}</span>
      <button class="file-remove" onclick="removeFile('${type}', ${idx})" title="Remover">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
          <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
        </svg>
      </button>
    </div>
  `).join('');
}

function removeFile(type, index) {
  if (type === 'folha') {
    State.files.folha.splice(index, 1);
    renderFileList('fileFolha', State.files.folha, 'folha');
    document.getElementById('uploadFolha').classList.toggle('has-files', State.files.folha.length > 0);
  } else if (type === 'convencao') {
    State.files.convencao = null;
    renderFileList('fileConvencao', [], 'convencao');
    document.getElementById('uploadConvencao').classList.remove('has-files');
  }
  updateFileCountBadge();
}

function updateFileCountBadge() {
  const total = State.files.folha.length + (State.files.convencao ? 1 : 0);
  const badge = document.getElementById('fileCountBadge');
  if (!badge) return;
  if (total > 0) {
    badge.textContent = `${total} arquivo${total > 1 ? 's' : ''} selecionado${total > 1 ? 's' : ''}`;
    badge.style.display = 'inline-block';
  } else {
    badge.style.display = 'none';
  }
}

// ============================================================
// Análise Principal — POST /api/analyze com streaming SSE
// ============================================================
async function startAnalysis() {
  if (State.isAnalyzing) return;

  if (!State.backendOk) {
    await checkBackendHealth();
    if (!State.backendOk) {
      alert('⚠️ O servidor backend não está disponível. Execute o start.bat e tente novamente.');
      return;
    }
  }

  if (State.files.folha.length === 0) {
    alert('⚠️ Envie pelo menos um arquivo de folha de pagamento para análise.');
    document.getElementById('sectionUpload').scrollIntoView({ behavior: 'smooth' });
    return;
  }

  State.isAnalyzing = true;
  const btnAnalyze = document.getElementById('btnAnalyze');
  btnAnalyze.disabled = true;
  document.getElementById('analyzeText').textContent = 'Analisando...';
  showLoading('Lendo documentos...', 'Extraindo conteúdo dos arquivos');
  updateStatusBar('loading', 'Processando documentos...');

  try {
    // ── 1. Parsear arquivos da folha ──────────────────────────────────
    const { results: folhaTexts, errors: folhaErrors } = await FileParser.parseAll(State.files.folha);
    if (folhaErrors.length > 0) {
      console.warn('Erros ao ler arquivos:', folhaErrors);
    }

    // ── 2. Parsear Convenção Coletiva ─────────────────────────────────
    setLoadingMsg('Lendo documentos...', 'Extraindo Convenção Coletiva');
    let convencaoText = null;
    if (State.files.convencao) {
      try {
        convencaoText = await FileParser.parse(State.files.convencao);
      } catch (err) {
        console.warn('Erro ao ler convenção:', err.message);
      }
    }

    const convencaoManual  = document.getElementById('textConvencao').value;
    const contextoAdicional = document.getElementById('textContexto').value;

    // ── 3. Montar payload para o backend ──────────────────────────────
    const payload = {
      folhaTexts,
      convencaoText,
      convencaoManual,
      contextoAdicional
    };

    // ── 4. Mostrar área de resultado ──────────────────────────────────
    const sectionResult = document.getElementById('sectionResult');
    sectionResult.style.display = 'block';
    ReportRenderer.renderMeta({
      folhaFiles: State.files.folha,
      convencaoFile: State.files.convencao,
      deployment: '(Azure OpenAI)'
    });
    document.getElementById('reportBody').innerHTML =
      '<p style="color:var(--text-3);">⏳ Aguardando resposta da IA...</p>';

    setLoadingMsg('Consultando IA...', 'Enviando dados para o servidor de análise');
    hideLoading();
    sectionResult.scrollIntoView({ behavior: 'smooth', block: 'start' });
    updateStatusBar('loading', 'IA auditando documentos...');

    // ── 5. Chamada ao backend com streaming SSE ───────────────────────
    let fullText = '';

    const response = await fetch(`${API_BASE}/api/analyze`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const errData = await response.json().catch(() => ({ detail: response.statusText }));
      throw new Error(errData.detail || `Erro HTTP ${response.status}`);
    }

    // Lê o stream SSE
    const reader  = response.body.getReader();
    const decoder = new TextDecoder('utf-8');
    let   buffer  = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop(); // fragmento incompleto fica para a próxima iteração

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed.startsWith('data: ')) continue;

        const jsonStr = trimmed.slice(6);
        if (jsonStr === '[DONE]') break;

        try {
          const parsed = JSON.parse(jsonStr);

          if (parsed.error) {
            document.getElementById('reportBody').innerHTML = `
              <div class="alert-box error">
                <strong>❌ Erro na análise:</strong> ${parsed.error}
              </div>`;
            updateStatusBar('error', 'Erro na análise');
            finishAnalysis(btnAnalyze);
            return;
          }

          if (parsed.content) {
            fullText += parsed.content;
            ReportRenderer.renderStreaming(fullText);
          }
        } catch (_) { /* fragmento inválido */ }
      }
    }

    // ── 6. Finaliza ───────────────────────────────────────────────────
    State.reportText = fullText;
    ReportRenderer.finalize(fullText);
    updateStatusBar('ok', 'Análise concluída ✓');

  } catch (err) {
    hideLoading();
    const reportBody = document.getElementById('reportBody');
    if (reportBody) {
      reportBody.innerHTML = `
        <div class="alert-box error">
          <strong>❌ Erro:</strong> ${err.message}
        </div>`;
    }
    updateStatusBar('error', 'Erro na análise');
  } finally {
    finishAnalysis(btnAnalyze);
  }
}

function finishAnalysis(btn) {
  State.isAnalyzing = false;
  btn.disabled = false;
  document.getElementById('analyzeText').textContent = 'Iniciar Análise Investigativa';
  hideLoading();
}

function resetAnalysis() {
  document.getElementById('sectionResult').style.display = 'none';
  State.reportText = '';
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// ============================================================
// Loading Overlay
// ============================================================
function showLoading(title, msg) {
  document.getElementById('loadingTitle').textContent = title;
  document.getElementById('loadingMsg').textContent   = msg;
  document.getElementById('loadingOverlay').style.display = 'grid';
}

function setLoadingMsg(title, msg) {
  document.getElementById('loadingTitle').textContent = title;
  document.getElementById('loadingMsg').textContent   = msg;
}

function hideLoading() {
  document.getElementById('loadingOverlay').style.display = 'none';
}

// ============================================================
// Exportar / Copiar
// ============================================================
function exportReport() {
  if (!State.reportText) { alert('Nenhum relatório para exportar.'); return; }
  ReportRenderer.exportAsText(State.reportText);
}

function copyReport() {
  const text = State.reportText || ReportRenderer.getRawText();
  if (!text) { alert('Nenhum relatório para copiar.'); return; }

  navigator.clipboard.writeText(text).then(() => {
    const btn = document.getElementById('btnCopy');
    const orig = btn.innerHTML;
    btn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg> Copiado!`;
    btn.style.color = 'var(--green-light)';
    setTimeout(() => { btn.innerHTML = orig; btn.style.color = ''; }, 2000);
  });
}
