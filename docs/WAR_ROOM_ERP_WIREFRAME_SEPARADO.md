# WAR ROOM OS - Wireframe Separado (Projeto Completo)

Este documento separa o wireframe completo do projeto em blocos independentes para facilitar:
- alinhamento entre produto, design, dev e operação;
- criação de tarefas por squad;
- execução de QA por módulo.

Referencia base: `docs/WAR_ROOM_ERP_WIREFRAME_9D.md`

---

## BLOCO 01 - Estrutura Global (Navegação)

```
WAR ROOM OS
|- Header Global
|  |- Perfil ativo (RBAC)
|  |- Switch de usuário
|  |- Modo CEO / Apresentação
|  |- Siren status global
|
|- Sidebar
|  |- The Command Center
|  |- Offers Lab
|  |- CEO & Financeiro
|  |- Copy & Pesquisa
|  |- Tráfego & Atribuição
|  |- Test Laboratory
|  |- Command Center (Demandas)
|  |- Squad Sync
|  |- Editores & Produção
|  |- Tech & CRO
|  |- Sales Recovery
|  |- Customer Experience
|  |- Finance & Compliance
|
`- Footer Global
   |- Sessão ativa
   `- Timestamp / Sync
```

---

## BLOCO 02 - Wireframe Desktop (Base)

```
+--------------------------------------------------------------------------------------+
| HEADER                                                                               |
| [Perfil] [Switch Usuário] [Modo CEO] [Siren] [Sync]                                 |
+------------------------------+-------------------------------------------------------+
| SIDEBAR                      | ÁREA PRINCIPAL DO MÓDULO                              |
|----------------------------- |-------------------------------------------------------|
| > Command Center             | KPIs / Tabelas / Gráficos / Kanban / Alertas          |
| > Offers Lab                 |                                                       |
| > CEO & Financeiro           |                                                       |
| > Copy & Pesquisa            |                                                       |
| > Tráfego & Atribuição       |                                                       |
| > Test Laboratory            |                                                       |
| > Command Center (Demandas)  |                                                       |
| > Squad Sync                 |                                                       |
| > Editores & Produção        |                                                       |
| > Tech & CRO                 |                                                       |
| > Sales Recovery             |                                                       |
| > Customer Experience        |                                                       |
| > Finance & Compliance       |                                                       |
+------------------------------+-------------------------------------------------------+
| Rodapé do módulo: Actionable Insights + Activity Log                                 |
+--------------------------------------------------------------------------------------+
```

---

## BLOCO 03 - Wireframe Mobile (CEO First)

```
+--------------------------------------+
| HEADER MOBILE                        |
| [Menu] WAR ROOM OS [Perfil]          |
+--------------------------------------+
| KPI STRIP                            |
| MER | Lucro | Receita | Velocidade   |
+--------------------------------------+
| MÓDULO ATIVO                         |
| [Cards empilhados]                   |
| [Tabela com scroll horizontal]       |
+--------------------------------------+
| BOTTOM NAV                           |
| CEO | Tráfego | Test Lab | Tech      |
+--------------------------------------+
```

---

## BLOCO 04 - The Command Center (CEO View 10D)

```
+--------------------------------------------------------------------------------------+
| STATUS GLOBAL: MER | Net Profit | Sales Velocity | Valuation                         |
+--------------------------------------------------------------------------------------+
| GRID 6 SQUADS (cards clicáveis / drill-down)                                         |
| Copy/IP | Mídia | Edição | Comercial | CX/LTV | Tech/Compliance                      |
+--------------------------------------------------------------------------------------+
| SIDEBAR DE EVENTOS CRÍTICOS (THE SIREN)                                               |
+--------------------------------------------------------------------------------------+
```

---

## BLOCO 05 - Offers Lab (Production & Validation)

```
+--------------------------------------------------------------------------------------+
| KPI BAR: Ofertas | Validadas >=70k | Último sync UTMify | Estado sync                |
+--------------------------------------------------------------------------------------+
| INPUT COPY: Big Idea | Mecanismo | Sofisticação | Hooks | Owner | Nicho               |
+--------------------------------------------------------------------------------------+
| CHECKLIST UTM (gate): source, campaign|id, content|id, term|id, utm_brought_by       |
+--------------------------------------------------------------------------------------+
| FONTES DE TRÁFEGO (origem real): source | vendas | receita | spend | roas             |
+--------------------------------------------------------------------------------------+
| OFERTAS VALIDADAS: filtros por nicho, owner, roas                                    |
+--------------------------------------------------------------------------------------+
```

Regras:
- Validar para escala quando `revenue7d >= 70.000` e `roas7d >= 1.8`.
- Para networking, `utm_brought_by` obrigatório.

---

## BLOCO 06 - CEO & Financeiro

```
+--------------------------------------------------------------------------------------+
| MER Gauge | Lucro Líquido Real | Payback | Tax Provision                             |
+--------------------------------------------------------------------------------------+
| Coortes LTV D30/D60/D90 | Reconciliation Ledger | Opportunity Lost                     |
+--------------------------------------------------------------------------------------+
| Vault (domínios/pixel/cloudflare/safe browsing) + Queue/Worker                       |
+--------------------------------------------------------------------------------------+
```

---

## BLOCO 07 - Copy & Pesquisa

```
+--------------------------------------------------------------------------------------+
| Big Idea Vault | Rule of One | Ficha de Desconstrução 9D                             |
+--------------------------------------------------------------------------------------+
| Swipe File Dinâmico | Hook Suggestion Engine | Comparação de Ângulos                 |
+--------------------------------------------------------------------------------------+
| Naming Builder Universal + Registry                                                    |
+--------------------------------------------------------------------------------------+
```

---

## BLOCO 08 - Tráfego & Atribuição

```
+--------------------------------------------------------------------------------------+
| Squads de mídia: Meta/Google/Native com meta vs atual                                |
+--------------------------------------------------------------------------------------+
| Processador de Ativos (scale/stabilize/pause) + tracking override                    |
+--------------------------------------------------------------------------------------+
| Deep Attribution (ROI real / Profit / LTV por criativo)                              |
+--------------------------------------------------------------------------------------+
| Scale Advisor + Stop-Loss + alertas de fadiga                                         |
+--------------------------------------------------------------------------------------+
```

---

## BLOCO 09 - Test Laboratory & Scaling Pipeline

```
+--------------------------------------------------------------------------------------+
| Produção diária (Slot A/B), DNA naming preview, export CSV                           |
+--------------------------------------------------------------------------------------+
| Kanban: Produção | Ready | Testing | Decision                                         |
+--------------------------------------------------------------------------------------+
| Verdict engine: APPROVED | HOOK FAILURE | KILLED | CONTINUE                          |
+--------------------------------------------------------------------------------------+
| Scatter plot (CPA x Hook Rate) + alerta de fadiga de fila                            |
+--------------------------------------------------------------------------------------+
```

---

## BLOCO 10 - Command Center de Demandas

```
+--------------------------------------------------------------------------------------+
| Throughput | Gargalo | SLA | Dependências                                             |
+--------------------------------------------------------------------------------------+
| Boards por squad: Copy | Mídia | Edição | Tech                                        |
+--------------------------------------------------------------------------------------+
| Cards: owner, impacto financeiro, timer SLA, decision log                             |
+--------------------------------------------------------------------------------------+
```

Gate:
- cards de edição exigem aprovação (CEO/Media Buyer) antes de Done.

---

## BLOCO 11 - Squad Sync

```
+--------------------------------------------------------------------------------------+
| Status de sincronia + Benchmarks Hook/Hold/IC/MER                                    |
+--------------------------------------------------------------------------------------+
| Daily feedback (ontem x hoje) + sentimento                                            |
+--------------------------------------------------------------------------------------+
| Feedback para Editores + Feedback para Copy + mensagens acionáveis                   |
+--------------------------------------------------------------------------------------+
```

---

## BLOCO 12 - Editores & Produção

```
+--------------------------------------------------------------------------------------+
| Priority Queue por impacto financeiro + Hook Testing Pipeline (10 variações)         |
+--------------------------------------------------------------------------------------+
| Asset Library por retenção + visual simplificado por criativo                         |
+--------------------------------------------------------------------------------------+
```

---

## BLOCO 13 - Tech & CRO

```
+--------------------------------------------------------------------------------------+
| API Status badges + Sparklines                                                        |
+--------------------------------------------------------------------------------------+
| Observability Command (SLO/MTTR/Error Rate/Queue) + Incident Center                  |
+--------------------------------------------------------------------------------------+
| LCP Monitor | A/B Test Center | Checkout Efficiency | Upsell Flow                    |
+--------------------------------------------------------------------------------------+
```

---

## BLOCO 14 - Comercial, CX e Finance/Compliance

### 14.1 Sales Recovery
```
Sniper List | One-Tap WhatsApp | conversão de recuperação
```

### 14.2 Customer Experience
```
Satisfaction Tracker | Churn risk | Upsell trigger | Yield optimizer
```

### 14.3 Finance & Compliance
```
DRE live | Compliance Scanner | Legal Vault | Audit Log de governança
```

---

## BLOCO 15 - Estados Críticos (UX)

- **Loading:** skeletons em cards/tabelas.
- **Empty:** mensagem + ação de recarregar/configurar integração.
- **Error:** causa + botão retry + atalho para incidentes.
- **Critical / Siren:** destaque global no header com razões.

---

## BLOCO 16 - Fluxo Diário Operacional (macro)

1. Tráfego sincroniza dados (UTMify/gateways).  
2. Squad Sync gera ordens automáticas.  
3. Test Lab prepara lote do dia (A/B).  
4. Engine decide verdict dos testes.  
5. Command Center cria tarefas espelho por impacto.  
6. Tech/CRO remove gargalos de infraestrutura.  
7. CEO fecha ciclo com MER/Lucro/Riscos/Valuation.

---

## BLOCO 17 - RBAC (visão separada por cargo)

- **CEO:** visão total + financeiro sensível + aprovações.
- **Media Buyer:** tráfego/testes/sync/command + alertas.
- **Copywriter:** IP/copy/sync/command, sem financeiro sensível.
- **Video Editor:** edição/testes/sync, visão simplificada.
- **Closer/CX/Finance Manager:** acesso focado por função.

---

## BLOCO 18 - Entrega para time (Design/Dev/QA)

Para execução:
1. transformar cada bloco em frame no Figma;
2. criar checklist de QA por bloco;
3. mapear owner técnico por módulo;
4. validar desktop + mobile + estados críticos por role.

