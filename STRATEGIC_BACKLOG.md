# STRATEGIC BACKLOG - GAP ANALYSIS 10D (PADRAO AGORA INC.)

Data: 2026-03-21  
Escopo auditado: WAR ROOM OS + Offers Lab + Customer/CX + Fortress + Test Lab + Webhooks/Integracoes.

---

## 0) Veredito executivo (estado atual)

O sistema ja esta em nivel enterprise para operacao real (RBAC, Offers Lab, observabilidade, kill switch, reconciliacao, LTV baseline, automacao de demandas).  
**Gap principal para 100M/ano:** sair de inteligencia agregada por oferta/campanha para **inteligencia por LeadID com timeline comportamental e decisao automatica multi-canal**.

Resumo:
- **Forte:** governanca de UTM, regra 70k/7d, monitor de dominios, contingencia, fila/worker, SLO/MTTR, modules por squad.
- **Parcial:** churn control, LTV preditivo de alta confianca, experimentacao estatistica formal.
- **Ausente/insuficiente:** deep tracking pos-clique por sessao/leitura de VSL, retargeting dinamico nativo, traffic reroute automatico de links.

---

## 1) O QUE ESTA A FALTAR (GAP ANALYSIS)

## 1.1 Diferenciais de DR 9-10 digitos ainda ausentes

1. **Lead Graph completo (source of truth por LeadID)**
   - Hoje ha `customerCentrality` com indicadores consolidados, mas sem event store completo por Lead (sessao, eventos minuto a minuto da VSL, jornada entre touchpoints).
   - Falta tabela de timeline canonica para analise e ativacao.

2. **Recorrencia/Churn Control de verdade (nao heuristico)**
   - Existe detecao basica de risco no modulo CX (silencio + baixa retencao), mas nao existe:
     - modelo de risco de refund/churn por janela temporal,
     - runbooks automaticos por severidade,
     - tracking de resultado da acao (resgatou ou nao).

3. **Deep Tracking pos-clique para nao compradores**
   - Offers Lab registra `click/sale` e UTM metadata, mas nao modela comportamento granular de quem nao comprou:
     - ponto exato de abandono da VSL,
     - scroll depth, CTA clicks, formulario iniciado/abandonado,
     - segmentos dinamicos para retarget.

4. **Experimentacao estatistica nativa (decisao confiavel)**
   - Test Lab avalia por regra de negocio (CPA/Hook/CTR), mas sem:
     - significancia estatistica,
     - MDE,
     - stop rules formais,
     - protecao contra falso positivo.

5. **Motor de contingencia de links (auto-reroute)**
   - Ha monitor de dominio + kill switch com bloqueio de trafego, mas falta troca automatica de URL de destino (router de contingencia) mantendo consistencia de tracking.

---

## 1.2 Perguntas diretas do prompt

### Temos mecanismo de recorrencia/churn control?
**Parcial.** Existe sinalizacao de risco no CX, mas ainda sem score probabilistico, cohort de assinatura/recorrencia, e orquestracao automatica por playbook.

### Existe centro de atribuicao pos-clique (deep tracking)?
**Nao em nivel 10D.** Atribuicao atual e boa para conversao e UTM governance, mas falta camada comportamental de no-buy e ativacao de audiencias dinamicas.

---

## 2) INTELIGENCIA DE COPY E PROPRIEDADE INTELECTUAL (IP)

## 2.1 Creative Performance Heatmap (utm_content x retencao da pagina)

**Gap atual:** existe `retentionHeatmap` e dados de criativo, mas sem correlacao persistida por `utm_content` e sem detecao automatica do "ponto de esfriamento" por bloco da VSL.

**Implementacao recomendada:**
- Criar tabela `lead_vsl_events` (lead_id, session_id, utm_content, second_marker, event_type, page_variant, created_at).
- Criar agregacao `creative_retention_heatmap_agg` por:
  - `utm_content`
  - bucket de segundos (0-5, 6-15, 16-30, ...)
  - taxa de continuacao e drop.
- Gerar insight automatico para copy:
  - "esfria no bloco X"
  - "gancho forte, corpo fraco"
  - "objecao dominante por minuto"

## 2.2 Vault de Gatilhos Mentais e Big Ideas

**Gap atual:** ha Big Idea Vault e Swipe, mas falta base estruturada de gatilhos com performance historica por contexto.

**Implementacao recomendada:**
- Tabelas:
  - `ip_trigger_library` (gatilho, categoria, definicao, exemplos, risco de compliance).
  - `ip_trigger_performance` (trigger_id, utm_content, hook_rate, hold_rate, cpa, roas, ltv90, periodo).
- Score de "reusabilidade":
  - win rate por nicho, estagio de sofisticacao, formato (VSL/UGC/ADVERT).
- Composer assistido:
  - ao criar roteiro, sugerir 3 triggers com maior lift historico no mesmo contexto.

---

## 3) RECOMENDACOES DE ENGENHARIA E ESCALA

## 3.1 LTV preditivo (o que coletar hoje para IA em 3 meses)

Coletar **eventos por LeadID** (obrigatorio):
- Aquisição:
  - source, campaign_id, content_id, term_id, cost_at_click, timestamp.
- Comportamento:
  - watch_seconds, completion_pct, checkpoints por bloco da VSL.
  - page scroll depth, CTA click, checkout start, checkout abandon.
- Relacionamento:
  - email sent/open/click, WhatsApp send/read/reply.
- Monetizacao:
  - purchases, upsells, refunds, chargebacks, intervalo entre compras.
- CX:
  - tickets, NPS, onboarding milestones, suporte.

Pipeline:
- Event ingestion -> `lead_events_raw`.
- Normalizacao -> `lead_feature_daily`.
- Modelo -> `ltv_model_versions` com treino semanal, drift monitor e fallback.

Meta minima de qualidade:
- cobertura de `lead_id` >= 95% dos eventos de receita.
- latencia de feature diaria < 2h.

## 3.2 Contingencia automatica com troca de links

Criar **Traffic Router de contingencia**:
- `routing_domains` (primary, backup1, backup2, health, last_switch_at).
- API `POST /api/routing/resolve` que devolve URL ativa por oferta/funil.
- Integracao com Fortress:
  - se dominio `blocked` -> switch automatico para backup.
  - gerar incidente + log de auditoria + notificar heads.
- Guardrails:
  - manter UTM intacta na troca.
  - cooldown de switch para evitar flapping.
  - rollback automatico quando saude voltar.

---

## 4) OTIMIZACAO DE WORKFLOW (ERP mais "viciante")

Automacoes de baixo esforco e alto impacto (meta: economizar 2h/dia por role):

1. **Auto-brief de iteracao (Trafego -> Copy/Edicao)**
   - 1 clique gera briefing com: criativo, KPI ruim, hipotese e tarefa espelho pronta.

2. **Autopreenchimento inteligente de UTM**
   - ao criar ativo, preencher campanha/content/term com naming validado e checks de compliance.

3. **Fila priorizada por R$/hora perdido**
   - ordenar tarefas por impacto financeiro estimado por minuto.

4. **Daily digest por persona (08h e 19h)**
   - cada role recebe 3 acoes do dia + risco + bloqueio.

5. **Copilot operacional in-app**
   - slash commands:
     - `/escalar OFERTA_X`
     - `/brief hook ID1450`
     - `/risco churn hoje`

---

## 5) TOP 5 PRIORIDADES (fora do radar e obrigatorias para 100M/ano)

## P1) Lead Timeline & Deep Tracking Engine (P0)
**Objetivo:** transformar atribuicao em decisao por LeadID.  
**Entregaveis tecnicos:**
- tabelas `lead_events_raw`, `lead_sessions`, `lead_journey_snapshot`.
- SDK de tracking first-party (landing + checkout + VSL checkpoints).
- dashboard de no-buy behavior + segmentos dinamicos.

## P2) Churn/Refund Early Warning + Playbooks CX (P0)
**Objetivo:** reduzir reembolso antes de acontecer.  
**Entregaveis:**
- score de risco por lead (0-100) com explicabilidade.
- automacao de playbook (whatsapp, onboarding humano, oferta de suporte).
- medicao de lift por acao.

## P3) Creative Heatmap Intelligence (P1)
**Objetivo:** dizer exatamente onde a copy perde dinheiro.  
**Entregaveis:**
- correlacao `utm_content` x retenção por bloco.
- alertas "esfriou no minuto X".
- sugestao de refatoracao por bloco (hook/body/offer/close).

## P4) Statistical Experiment Engine (P1)
**Objetivo:** parar de escalar falso positivo.  
**Entregaveis:**
- significancia, intervalo de confianca, MDE.
- stop rules e winner lock.
- trilha de decisao auditavel.

## P5) Automated Domain/Checkout Traffic Router (P1)
**Objetivo:** preservar caixa durante incidentes sem depender de acao manual.  
**Entregaveis:**
- roteador de links com failover automatico.
- health gates (Safe Browsing + gateway + pixel).
- rollback seguro com logs.

---

## 6) Dashboard adicional recomendado (pulo do gato)

1. **Revenue per Lead (RPL) por source/campaign/content**
2. **Breakeven Day por coorte de entrada**
3. **Whale Alert (compra funil completo) com playbook VIP**
4. **Retarget Gap Report (nao compradores de alto potencial)**
5. **IP ROI Ranking (Big Idea/Trigger por lucro incremental)**

---

## 7) Sequencia de implementacao sugerida (3 ondas)

### Onda 1 - Base de dados e ativacao (P0)
- Lead Timeline + Deep Tracking
- Churn/Refund Early Warning
- RPL Dashboard

### Onda 2 - Otimizacao de criativo e decisao (P1)
- Creative Heatmap Intelligence
- Experiment Engine estatistico
- IP Trigger Vault com ranking financeiro

### Onda 3 - Resiliencia autonoma (P1/P2)
- Traffic Router de contingencia
- Playbooks totalmente automatizados por role
- Copilot operacional in-app

---

## 8) Definicao de pronto (DoD) para cada iniciativa critica

- Cobertura de dados >= 95% para eventos obrigatorios.
- Alertas com falso positivo < 10% apos calibracao inicial.
- Tempo de resposta da automacao critica < 2 min.
- Auditoria completa (quem, quando, por que, impacto em R$).
- Rollback seguro habilitado para toda automacao que altera trafego.

