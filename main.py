"""
FolhaIA — Backend FastAPI
Servidor que mantém as credenciais do Azure OpenAI seguras,
serve o frontend como arquivos estáticos e expõe a API de análise.
"""

import os
import json
import httpx
import asyncio
from pathlib import Path
from typing import Optional, List

from fastapi import FastAPI, HTTPException
from fastapi.responses import StreamingResponse, FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from dotenv import dotenv_values

# ── Carrega as credenciais do arquivo .env ─────────────────────────────────
# Lê direto do arquivo, ignorando variáveis de ambiente do sistema
_env = dotenv_values(Path(__file__).parent / ".env")

AZURE_ENDPOINT   = _env.get("AZURE_OPENAI_ENDPOINT", "").rstrip("/")
AZURE_API_KEY    = _env.get("AZURE_OPENAI_API_KEY", "")
AZURE_DEPLOYMENT = _env.get("AZURE_OPENAI_DEPLOYMENT", "")
AZURE_API_VERSION = _env.get("AZURE_OPENAI_API_VERSION", "2024-02-01")

# ── Caminhos ───────────────────────────────────────────────────────────────
BASE_DIR     = Path(__file__).parent          # .../Folha_IA/backend/
FRONTEND_DIR = BASE_DIR.parent / "frontend"   # .../Folha_IA/frontend/

# ── Validação das variáveis ────────────────────────────────────────────────
PLACEHOLDERS = {"SEU-RECURSO", "cole-sua-api-key-aqui", "sua-api-key-aqui", "sua-chave-aqui"}

def _is_placeholder(value: str) -> bool:
    return not value or any(p in value for p in PLACEHOLDERS)

def _api_key_parece_url(value: str) -> bool:
    return value.startswith("http://") or value.startswith("https://")

IS_CONFIGURED = (
    not _is_placeholder(AZURE_ENDPOINT)
    and not _is_placeholder(AZURE_API_KEY)
    and not _api_key_parece_url(AZURE_API_KEY)
    and not _is_placeholder(AZURE_DEPLOYMENT)
)

# ── App ────────────────────────────────────────────────────────────────────
app = FastAPI(title="FolhaIA API", version="1.0.0", docs_url=None, redoc_url=None)


# ── Models ─────────────────────────────────────────────────────────────────
class FileData(BaseModel):
    name: str
    size: str
    type: str
    content: str

class AnalyzeRequest(BaseModel):
    folhaTexts: List[FileData]
    convencaoText: Optional[FileData] = None
    convencaoManual: Optional[str] = ""
    contextoAdicional: Optional[str] = ""


# ── Prompt ─────────────────────────────────────────────────────────────────
SYSTEM_PROMPT = """Você é um auditor especialista em folha de pagamento brasileira, com profundo conhecimento em:

- **Legislação Trabalhista**: CLT, MP 936/2020, Reforma Trabalhista (Lei 13.467/2017)
- **eSocial**: tabelas de rubricas, obrigações acessórias e validações
- **Cálculos obrigatórios**:
  - INSS (tabela progressiva vigente, tetos por faixa salarial)
  - IRRF (tabela progressiva com deduções: dependentes, INSS, pensão alimentícia)
  - FGTS (8% sobre a base de cálculo correta)
  - Horas extras (50% nas primeiras 2h, 75% acima de 2h — ou conforme CCT)
  - Adicional noturno (20% para horários entre 22h e 5h)
  - DSR (Descanso Semanal Remunerado) sobre comissões e horas extras variáveis
  - 13º salário (1/12 por mês trabalhado, gratificação natalina)
  - Férias + 1/3 constitucional
  - Salário-família, auxílio-doença, acidente de trabalho
- **Convenção Coletiva de Trabalho (CCT)**: análise de piso salarial, benefícios,
  adicionais e cláusulas específicas da categoria
- **Identificação de inconsistências**: rubricas lançadas incorretamente, bases de
  cálculo erradas, alíquotas desatualizadas, verbas indevidas ou faltantes

Sua análise deve ser **investigativa, detalhada e estruturada**. Você deve:
1. Identificar TODAS as inconsistências encontradas
2. Explicar o problema e a fundamentação legal/convencional
3. Calcular o impacto financeiro quando possível (valor correto vs. valor pago)
4. Classificar cada inconsistência por severidade: 🔴 CRÍTICO, 🟡 ATENÇÃO ou 🟢 OK
5. Ao final, fornecer um resumo executivo com total de ocorrências e impacto financeiro estimado

Seja preciso, objetivo e use linguagem técnica adequada ao contexto de RH e Contabilidade."""


def build_user_prompt(data: AnalyzeRequest) -> str:
    prompt = "## SOLICITAÇÃO DE AUDITORIA DE FOLHA DE PAGAMENTO\n\n"

    if data.contextoAdicional and data.contextoAdicional.strip():
        prompt += f"### FOCO DA ANÁLISE (instruções específicas)\n{data.contextoAdicional.strip()}\n\n"

    # Documentos da folha
    if data.folhaTexts:
        prompt += f"### DOCUMENTOS DA FOLHA DE PAGAMENTO\n"
        prompt += f"Foram enviados {len(data.folhaTexts)} arquivo(s):\n\n"
        for i, f in enumerate(data.folhaTexts, 1):
            content = f.content[:8000] + "\n\n[... conteúdo truncado ...]" if len(f.content) > 8000 else f.content
            prompt += f"**Arquivo {i}: {f.name}** ({f.size})\n{content}\n\n"
    else:
        prompt += "### DOCUMENTOS DA FOLHA DE PAGAMENTO\nNenhum arquivo de folha enviado.\n\n"

    # Convenção Coletiva — arquivo
    if data.convencaoText:
        content = data.convencaoText.content
        content = content[:6000] + "\n\n[... conteúdo truncado ...]" if len(content) > 6000 else content
        prompt += f"### CONVENÇÃO COLETIVA DE TRABALHO (CCT) — ARQUIVO\n{content}\n\n"

    # Convenção Coletiva — texto manual
    if data.convencaoManual and data.convencaoManual.strip():
        prompt += f"### REGRAS DA CCT (texto informado pelo usuário)\n{data.convencaoManual.strip()}\n\n"

    if not data.convencaoText and not (data.convencaoManual and data.convencaoManual.strip()):
        prompt += "### CONVENÇÃO COLETIVA\nNenhuma CCT fornecida. Analise com base na legislação trabalhista vigente (CLT, tabelas INSS/IRRF/FGTS).\n\n"

    prompt += """---

## ESTRUTURE SUA ANÁLISE DA SEGUINTE FORMA:

### 1. 📋 RESUMO EXECUTIVO
- Total de inconsistências encontradas (por severidade)
- Impacto financeiro total estimado (se calculável)
- Principais categorias de problemas

### 2. 🔴 INCONSISTÊNCIAS CRÍTICAS
Para cada item: rubrica/funcionário afetado, problema identificado, base legal/convencional, impacto financeiro estimado e recomendação.

### 3. 🟡 PONTOS DE ATENÇÃO
Para cada item: o que foi observado, possível problema e recomendação.

### 4. ✅ CONFORMIDADES VERIFICADAS
Liste o que está correto e em conformidade.

### 5. 💡 RECOMENDAÇÕES GERAIS
Ações preventivas e melhorias no processo de folha.

### 6. 📊 TABELA RESUMO DE INCONSISTÊNCIAS
| Severidade | Rubrica/Item | Descrição do Problema | Impacto Estimado |
|------------|-------------|----------------------|-----------------|
| (preencha para cada ocorrência) |

---

Inicie a análise agora de forma completa e detalhada."""

    return prompt


# ── Endpoints da API ────────────────────────────────────────────────────────

@app.get("/api/health")
async def health():
    """Verifica se o backend está online e as credenciais configuradas."""
    problems = []
    if _is_placeholder(AZURE_ENDPOINT):
        problems.append("AZURE_OPENAI_ENDPOINT não configurado")
    if _is_placeholder(AZURE_API_KEY):
        problems.append("AZURE_OPENAI_API_KEY não configurado")
    elif _api_key_parece_url(AZURE_API_KEY):
        problems.append("AZURE_OPENAI_API_KEY está com uma URL no lugar da chave — copie a chave (não a URL)")
    if _is_placeholder(AZURE_DEPLOYMENT):
        problems.append("AZURE_OPENAI_DEPLOYMENT não configurado")

    return {
        "status": "ok",
        "configured": IS_CONFIGURED,
        "deployment": AZURE_DEPLOYMENT if IS_CONFIGURED else None,
        "endpoint_domain": AZURE_ENDPOINT.split("/")[2] if IS_CONFIGURED and "/" in AZURE_ENDPOINT else None,
        "problems": problems
    }


@app.post("/api/analyze")
async def analyze(data: AnalyzeRequest):
    """
    Recebe os textos extraídos dos documentos e faz streaming do relatório
    da IA de volta para o frontend via Server-Sent Events (SSE).
    """
    if not IS_CONFIGURED:
        # Diagnóstico detalhado
        problems = []
        if _is_placeholder(AZURE_ENDPOINT):
            problems.append("AZURE_OPENAI_ENDPOINT não preenchido")
        if _is_placeholder(AZURE_API_KEY):
            problems.append("AZURE_OPENAI_API_KEY não preenchido")
        elif _api_key_parece_url(AZURE_API_KEY):
            problems.append("AZURE_OPENAI_API_KEY contém uma URL — você deve colocar a chave de API, não a URL do endpoint")
        if _is_placeholder(AZURE_DEPLOYMENT):
            problems.append("AZURE_OPENAI_DEPLOYMENT não preenchido")
        raise HTTPException(
            status_code=503,
            detail="Credenciais inválidas no arquivo .env: " + " | ".join(problems)
        )

    if not data.folhaTexts:
        raise HTTPException(status_code=400, detail="Nenhum documento de folha enviado.")

    url = f"{AZURE_ENDPOINT}/openai/deployments/{AZURE_DEPLOYMENT}/chat/completions?api-version={AZURE_API_VERSION}"

    messages = [
        {"role": "system", "content": SYSTEM_PROMPT},
        {"role": "user",   "content": build_user_prompt(data)}
    ]

    request_body = {
        "messages": messages,
        "max_tokens": 4000,
        "temperature": 0.2,
        "top_p": 0.9,
        "stream": True
    }

    async def stream_generator():
        try:
            async with httpx.AsyncClient(timeout=httpx.Timeout(120.0)) as client:
                async with client.stream(
                    "POST", url,
                    headers={
                        "api-key": AZURE_API_KEY,
                        "Content-Type": "application/json"
                    },
                    json=request_body
                ) as response:

                    # Trata erros HTTP
                    if response.status_code != 200:
                        body = await response.aread()
                        error_text = body.decode("utf-8", errors="replace")
                        try:
                            err_json = json.loads(error_text)
                            msg = err_json.get("error", {}).get("message", error_text)
                        except Exception:
                            msg = error_text

                        # Mensagens amigáveis em português
                        if response.status_code == 401:
                            msg = "API Key inválida ou sem permissão. Verifique o arquivo .env."
                        elif response.status_code == 404:
                            msg = "Deployment não encontrado. Verifique AZURE_OPENAI_DEPLOYMENT no .env."
                        elif response.status_code == 429:
                            msg = "Limite de requisições atingido. Aguarde alguns segundos e tente novamente."

                        yield f"data: {json.dumps({'error': msg})}\n\n"
                        return

                    # Lê o stream SSE linha a linha
                    buffer = ""
                    async for chunk in response.aiter_bytes():
                        buffer += chunk.decode("utf-8", errors="replace")
                        while "\n" in buffer:
                            line, buffer = buffer.split("\n", 1)
                            line = line.strip()
                            if not line or not line.startswith("data: "):
                                continue
                            json_str = line[6:]
                            if json_str == "[DONE]":
                                yield "data: [DONE]\n\n"
                                return
                            try:
                                parsed = json.loads(json_str)
                                delta = parsed["choices"][0]["delta"].get("content", "")
                                if delta:
                                    yield f"data: {json.dumps({'content': delta})}\n\n"
                            except Exception:
                                pass

        except httpx.TimeoutException:
            yield f"data: {json.dumps({'error': 'Tempo limite da requisição atingido (120s). Tente com menos arquivos.'})}\n\n"
        except httpx.RequestError as exc:
            msg = str(exc)
            if "getaddrinfo failed" in msg or "Name or service not known" in msg:
                domain = AZURE_ENDPOINT.replace("https://","").replace("http://","").split("/")[0]
                msg = (f"Não foi possível conectar ao Azure: o endereço '{domain}' não foi encontrado. "
                       f"Verifique se AZURE_OPENAI_ENDPOINT no arquivo .env está correto e se há conexão com a internet.")
            yield f"data: {json.dumps({'error': msg})}\n\n"
        except Exception as exc:
            yield f"data: {json.dumps({'error': f'Erro inesperado no servidor: {str(exc)}'})}\n\n"

    return StreamingResponse(
        stream_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache, no-transform",
            "X-Accel-Buffering": "no",
            "Connection": "keep-alive"
        }
    )


# ── Serve o frontend como arquivos estáticos ────────────────────────────────
# IMPORTANTE: deve ser montado APÓS os endpoints de API
if FRONTEND_DIR.exists():
    app.mount("/", StaticFiles(directory=str(FRONTEND_DIR), html=True), name="frontend")
else:
    @app.get("/")
    async def root():
        return {"message": "Frontend não encontrado. Verifique a pasta frontend/."}
