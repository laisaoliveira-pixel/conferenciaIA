# conferenciaIA 🧾🤖
> Auditoria inteligente de folha de pagamento usando IA (Azure OpenAI)
Aplicação fullstack com backend em FastAPI e frontend em JavaScript puro,
realizando comunicação em tempo real via streaming (SSE).
> 
![Python](https://img.shields.io/badge/Python-3776AB?style=flat&logo=python&logoColor=white)
![FastAPI](https://img.shields.io/badge/FastAPI-009688?style=flat&logo=fastapi&logoColor=white)
![Azure](https://img.shields.io/badge/Azure%20OpenAI-0078D4?style=flat&logo=microsoftazure&logoColor=white)
![Java](https://img.shields.io/badge/JavaScript-yellow?logo=javascript&logoColor=f5f5f5)
---

## 📌 Sobre

O **conferenciaIA (FolhaIA)** é uma aplicação que utiliza Inteligência Artificial para **auditar folhas de pagamento automaticamente**, identificando inconsistências, erros de cálculo e não conformidades com a legislação trabalhista brasileira.

A solução analisa documentos enviados pelo usuário e gera um relatório estruturado com:
- problemas encontrados
- fundamentação legal
- impacto financeiro estimado

Ideal para equipes de **RH, DP e contabilidade** que desejam ganhar produtividade e reduzir riscos.

---

## ✨ Funcionalidades

- 📑 Análise automática de folhas de pagamento
- 📊 Validação de cálculos:
  - INSS
  - IRRF
  - FGTS
  - horas extras, adicional noturno e DSR
- 📚 Interpretação de Convenção Coletiva (CCT)
- 🚨 Identificação de inconsistências com classificação:
  - 🔴 Crítico
  - 🟡 Atenção
  - ✅ OK
- 💰 Estimativa de impacto financeiro
- 📡 Resposta em tempo real via streaming (SSE)

---

## 🧠 Como funciona

1. O usuário envia arquivos da folha + opcionalmente CCT
2. O backend FastAPI processa os dados
3. Um prompt estruturado é enviado ao **Azure OpenAI**
4. A IA realiza a auditoria
5. O resultado é retornado em tempo real para o frontend

---

## 🛠️ Tecnologias

- **Backend:** FastAPI (Python)
- **Frontend:** JavaScript (app.js)
- **IA:** Azure OpenAI
- **Comunicação:** HTTP + Server-Sent Events (SSE)
- **Outros:**
  - httpx (requisições async)
  - dotenv (configuração)
  - Pydantic (validação de dados)
---

## 🚀 Como rodar o projeto

```bash
# Clonar o repositório
git clone https://github.com/SEU-USUARIO/conferenciaIA.git
cd conferenciaIA

# Criar ambiente virtual
python -m venv venv
source venv/bin/activate  # Linux/macOS
venv\Scripts\activate     # Windows

# Instalar dependências
pip install -r requirements.txt

# Configurar variáveis de ambiente (.env)
cp .env.example .env

# Rodar o backend
uvicorn main:app --reload
