# WAR ROOM OS - Wireframe Completo do ERP (9D / DR)

Este documento representa o wireframe funcional do ERP para operacao de Direct Response.

Objetivo:
- padronizar interface e fluxo de uso por squad;
- apoiar design, produto, engenharia e operacao;
- servir como referencia unica para evolucoes futuras.

---

## 1) Arquitetura de navegacao (IA)

```
WAR ROOM OS
|
+-- Sidebar
|   +-- CEO & Financeiro
|   +-- Copy & Pesquisa
|   +-- Trafego & Atribuicao
|   +-- Test Laboratory
|   +-- Command Center
|   +-- Squad Sync
|   +-- Editores & Producao
|   +-- Tech & CRO
|
+-- Header Global
|   +-- Switch de Usuario (RBAC)
|   +-- Modo CEO
|   +-- Estado da Sirene (global)
|
+-- Footer Global
    +-- Sessao ativa
    +-- Timestamp / sincronizacao
```

---

## 2) Layout base - Desktop

```
+--------------------------------------------------------------------------------------+
|                              WAR ROOM OS - HEADER                                   |
| [Perfil ativo] [Switch Usuario] [Modo CEO] [SIREN STATUS]                           |
+---------------------------+----------------------------------------------------------+
|         SIDEBAR           |                     CONTEUDO MODULO                      |
|---------------------------|----------------------------------------------------------|
| > CEO & Financeiro        | [Card 1] [Card 2] [Card 3] [Card 4]                     |
| > Copy & Pesquisa         | [Tabela] [Grafico] [Kanban] [Painel]                    |
| > Trafego & Atribuicao    |                                                          |
| > Test Laboratory         |                                                          |
| > Command Center          |                                                          |
| > Squad Sync              |                                                          |
| > Editores & Producao     |                                                          |
| > Tech & CRO              |                                                          |
|---------------------------|----------------------------------------------------------|
| Sync status               | Actionable Insights + Activity Log (rodape da pagina)    |
+---------------------------+----------------------------------------------------------+
```

---

## 3) Layout base - Mobile (CEO first)

```
+--------------------------------------+
| HEADER                               |
| [Menu] WAR ROOM OS [Perfil]          |
+--------------------------------------+
| KPI STRIP                            |
| Invest | Receita | Lucro | MER       |
+--------------------------------------+
| MODULO ATIVO                         |
| [Cards empilhados]                   |
| [Tabelas com scroll horizontal]      |
+--------------------------------------+
| Bottom Nav                           |
| CEO | Trafego | Test Lab | Tech      |
+--------------------------------------+
```

---

## 4) Wireframe por modulo

## 4.1 CEO & Financeiro

```
+--------------------------------------------------------------------------------------+
| CEO & FINANCEIRO                                                                     |
| [MER Gauge] [Lucro Liquido] [Payback] [Tax Provision]                               |
+--------------------------------------------------------------------------------------+
| Receita consolidada x AdSpend | LTV Cohorts D30/D60/D90 | Reconciliacao Ledger      |
+--------------------------------------------------------------------------------------+
| Opportunity Lost (R$/min) | Worker Queue Stats | Recovery Leaderboard               |
+--------------------------------------------------------------------------------------+
| THE VAULT: dominios, cloudflare, safe browsing, pixel sync, siren                   |
+--------------------------------------------------------------------------------------+
```

Campos principais:
- MER global
- lucro liquido real
- reconciliacao (expected vs observed)
- incidentes de perda de oportunidade

---

## 4.2 Copy & Pesquisa

```
+--------------------------------------------------------------------------------------+
| COPY & PESQUISA                                                                      |
| [Unique Mechanism Problem] [Unique Mechanism Solution]                               |
+--------------------------------------------------------------------------------------+
| BIG IDEA VAULT (cards)                                                               |
| [Idea A: Fresh] [Idea B: Fatiguing] [Idea C: Saturated]                             |
+--------------------------------------------------------------------------------------+
| Ficha de Desconstrucao 9D                                                            |
| Headline | Lead Type | Emotion | Mecanismo | 3 Provas | Swipe                        |
+--------------------------------------------------------------------------------------+
| Naming Builder Universal                                                             |
| [produto]_[big_idea]_[mecanismo]_[formato]_[Hxx]_[IDxxxx]                           |
+--------------------------------------------------------------------------------------+
| Score de Copy + tabela de comparacao de angulos (CPA/ROAS)                          |
+--------------------------------------------------------------------------------------+
```

---

## 4.3 Trafego & Atribuicao

```
+--------------------------------------------------------------------------------------+
| TRAFEGO & ATRIBUICAO                                                                 |
| [Meta] [Google] [Native] - alvo CPA vs CPA atual                                     |
+--------------------------------------------------------------------------------------+
| Processador de Ativos                                                                |
| ID1450  [ESCALA]                                                                      |
| ID1402  [ESCALA]                                                                      |
| ID1059  [PAUSA]                                                                       |
| ID1076  [PAUSA]                                                                       |
+--------------------------------------------------------------------------------------+
| Deep Attribution (Utmify)                                                            |
| Criativo | Source | Profit Real | LTV                                                |
+--------------------------------------------------------------------------------------+
| Scale Calculator + recomendacao DSS                                                  |
+--------------------------------------------------------------------------------------+
```

---

## 4.4 Test Laboratory

```
+--------------------------------------------------------------------------------------+
| TEST LABORATORY & SCALING PIPELINE                                                   |
| Testes Hoje: 08/10 | Slot A: 2/2 | Slot B: 6/8 | MER mode: Scaling                 |
+--------------------------------------------------------------------------------------+
| DAILY INPUT                                                                          |
| Slot A (novos angulos) | Slot B (hooks de vencedores)                                |
| DNA Preview + Validacao regex                                                        |
| [Adicionar na fila] [Exportar CSV Meta]                                              |
+--------------------------------------------------------------------------------------+
| KANBAN DE TESTE                                                                       |
| Em Producao | Ready to Upload | Testing Phase | Decision Made                        |
+--------------------------------------------------------------------------------------+
| Scatter Plot 24h (CPA vs Hook Rate) + legenda por veredito                           |
+--------------------------------------------------------------------------------------+
| Burn/Capacity Alert: Ready queue vazia => RISCO DE FADIGA                            |
+--------------------------------------------------------------------------------------+
```

Regras de decisao:
- APPROVED
- HOOK FAILURE
- KILLED
- CONTINUE TESTING

---

## 4.5 Command Center

```
+--------------------------------------------------------------------------------------+
| COMMAND CENTER                                                                       |
| Throughput de Escala | Gargalo Detector | Workflow Espelho                           |
+--------------------------------------------------------------------------------------+
| COPY BOARD              | TRAFEGO BOARD           | EDICAO BOARD      | TECH BOARD   |
| Backlog/Doing/Review/Done (drag and drop)                                            |
+--------------------------------------------------------------------------------------+
| Card: titulo, owner, impacto, SLA, dependencias, decision log                        |
+--------------------------------------------------------------------------------------+
```

Gate de qualidade:
- tarefas de edicao com aprovacao obrigatoria (CEO/Media Buyer) antes de Done.

---

## 4.6 Squad Sync

```
+--------------------------------------------------------------------------------------+
| SQUAD SYNC                                                                           |
| Status de sincronia | Recorte de demanda | Benchmarks (Hook/Hold/IC/MER)            |
+--------------------------------------------------------------------------------------+
| Daily Feedback (Ontem vs Hoje)                                                       |
| Hook | Hold 15s | CTR Out | IC | Frequencia | Sentimento                              |
+--------------------------------------------------------------------------------------+
| Feedback Editores (urgencia) | Feedback Copy (angulos)                               |
+--------------------------------------------------------------------------------------+
| Actionable Messages + botoes de notificacao (Slack/WhatsApp)                         |
+--------------------------------------------------------------------------------------+
```

---

## 4.7 Editores & Producao

```
+--------------------------------------------------------------------------------------+
| EDITORES & PRODUCAO                                                                  |
| Hook Library | Retention Heatmap | Pattern Checklist                                 |
+--------------------------------------------------------------------------------------+
| Creative Factory Board (pipeline)                                                    |
+--------------------------------------------------------------------------------------+
| Live Ads view simplificada + ROI real por criativo                                   |
+--------------------------------------------------------------------------------------+
```

---

## 4.8 Tech & CRO

```
+--------------------------------------------------------------------------------------+
| TECH & CRO                                                                           |
| API Status (Utmify/Appmax/Kiwify/Yampi) + Sparklines                                 |
+--------------------------------------------------------------------------------------+
| Observability Command                                                                 |
| SLO: Queue Drain | Error Rate | MTTR                                                 |
+--------------------------------------------------------------------------------------+
| Incident Center                                                                       |
| Open/Resolved/SLA breached + MTTR por squad + resolver incidente                     |
+--------------------------------------------------------------------------------------+
| LCP Monitor | A/B Test Center | Checkout Efficiency | Upsell Flow                    |
+--------------------------------------------------------------------------------------+
| Health Check                                                                          |
+--------------------------------------------------------------------------------------+
```

---

## 5) Estados globais de UX

### 5.1 Loading
```
[Skeleton cards]
[Skeleton table rows]
[Carregando dados estrategicos...]
```

### 5.2 Empty state
```
Sem dados para este modulo no momento.
[Botao: Recarregar]
[Botao: Ver configuracao de integracao]
```

### 5.3 Error state
```
Falha ao sincronizar modulo.
Erro: <mensagem>
[Tentar novamente]
[Abrir Incident Center]
```

### 5.4 Critical state (Siren)
```
HEADER em destaque critico
Badge: SIREN ON
Razoes: MER baixo | dominio bloqueado | pixel unhealthy | approval drop
```

---

## 6) Wireframe de fluxo operacional diario (macro)

```
08:00  Trafego sincroniza dados -> Squad Sync gera ordens
08:15  Test Lab cria lote do dia (Slot A/B)
09:00  Upload Meta + inicio de testes
11:00  Decision engine marca approved/hook failure/killed
12:00  Command Center abre tarefas espelho automaticas
15:00  Tech/CRO monitora SLO/Incidents e resolve gargalos
18:00  CEO confere MER/Lucro/Incident Center/Opportunity Lost
```

---

## 7) Modelo de permissao (wireframe RBAC)

```
CEO
  acesso total + financeiro sensivel + aprovacoes

Media Buyer
  trafego/testes/sync/command + aprovacoes de qualidade

Copywriter
  copy/pesquisa/sync/command + sem financeiro sensivel

Video Editor
  edicao/producao/testes/sync/command + visao simplificada
```

---

## 8) Componentes de tela (biblioteca)

- Card KPI
- Badge de status
- Gauge MER
- Sparkline 12h/24h
- Tabela paginada
- Kanban board
- Scatter plot
- Alert panel
- Incident list panel
- Decision log timeline

---

## 9) Checklist de completude do wireframe

- [x] Desktop layout
- [x] Mobile layout
- [x] Todos os modulos 9D
- [x] Estados (loading/empty/error/critical)
- [x] Fluxo operacional diario
- [x] RBAC
- [x] Componentes reutilizaveis

---

## 10) Proxima etapa recomendada

Converter este wireframe em:
1. prototipo navegavel (Figma),
2. tokens de design oficiais,
3. checklists de QA por modulo.
