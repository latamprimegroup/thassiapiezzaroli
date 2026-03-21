# SYSTEM MATURITY LOG — WAR ROOM OS vs AGORA INC. (10D)

Data da auditoria: 2026-03-21  
Escopo: estrutura de pastas, rotas API, Offers Lab, engine de UTMs, gatilho 70k, performance de escala, UX de adoção e prontidão de publicação.

---

## 0) Veredito Executivo

**Status atual:** forte para operação real, porém **ainda não “infalível 10D”**.  
Classificação de maturidade (auditoria técnica): **8.3 / 10**.

- **Pronto para:** piloto em produção + operação com governança.
- **Ainda não pronto para:** escala global “sem fricção” no padrão Agora Inc. sem reforços de arquitetura distribuída e inteligência preditiva formal.

---

## 1) Integridade do Offers Lab (conforme backlog)

## 1.1 Módulo 1 de UTMs está blindado?
**Parcialmente blindado (bom nível, não nível máximo).**

### O que está sólido
- Normalização de fontes e parser robusto em:
  - `src/lib/offers/utm-normalization.ts`
  - mapeamento para Meta/Google/TikTok/Kwai/Networking.
- Parsing de `Nome|ID` para campaign/content/term.
- Enforcement de `utm_brought_by` para networking em:
  - serviço: `src/lib/offers/offers-lab-service.ts`
  - banco (constraint): `src/lib/offers/offers-lab-db.ts` e `docs/sql/war_room_ops_schema.sql`.

### Risco residual
- Falta de **governança canônica de aliases UTM** (tabela oficial de aliases/versionamento + aprovação).
- Falta de **quarentena automática** de eventos com UTM inconsistente (hoje há warning, mas não bloqueio/quarantine pipeline).

---

## 1.2 Regra 70k + ROAS 1.8 está triggerando automaticamente?
**Sim, implementada e operante.**

- Cálculo em 7 dias:
  - `revenue7d >= 70000` e `roas7d >= 1.8` (ou alvo mínimo da oferta).
- Atualização automática de status da oferta + sinalização de candidata a lançamento para networking.
- Referência: `src/lib/offers/offers-lab-service.ts`.

### Risco residual
- O trigger está embutido no fluxo de leitura do dashboard (write-on-read), o que pode gerar **write amplification** sob alto tráfego de leitura.

---

## 2) GAP Analysis — Agora Inc. vs estado atual

## 2.1 O que falta para virar “arma de guerra” completa

### GAP A — Customer graph de pós-clique (frio/quente)
Existe `traffic_events` com suporte a `click/sale`, mas ainda falta:
- modelagem de jornada por Lead (sessão, touchpoints, janela de atribuição multi-toque),
- score comportamental pós-clique para reciclagem de ofertas.

### GAP B — LTV preditivo de verdade (MLOps leve)
Há lógica preditiva heurística (pesos + baseline) no ecossistema, mas falta:
- treino supervisionado real (coortes D7→D90),
- monitor de drift, calibração e re-treino automático,
- feature store e validação de qualidade de modelo.

### GAP C — IP management fechado com performance real
Existem módulos de Big Idea, hooks, naming e swipe, porém falta:
- vínculo analítico formal “Hook/Mecanismo -> ID Anúncio -> Receita líquida incremental”,
- ranking de IP por impacto financeiro líquido (não só por métrica intermediária).

---

## 3) Auditoria de rotas, erros e performance

## 3.1 Rotas e callbacks suportam escala agressiva?
**Melhorou bastante** (batch ingestion, rate limit, validação, índices), mas há pontos críticos:

### Pontos fortes
- Callback Offers Lab com:
  - ingestão em lote,
  - rate limit,
  - limite de payload.
- Webhook central com fila assíncrona e reprocessamento.
- Índices de banco para `offers_lab_traffic_events`.

### Riscos de escala
1. **Rate limit em memória local** (não distribuído): em múltiplas instâncias, limite não é global.  
2. **Cache em memória local** (não distribuído): inconsistência entre réplicas sob scale-out.  
3. **Persistência em arquivo** ainda disponível como modo fallback: inadequada para volume enterprise contínuo.  
4. Falta de partição/retention operacional explícita para `offers_lab_traffic_events` em cenários de crescimento prolongado.

---

## 3.2 Layout e adoção por time
**Acima de painel administrativo comum**, já com:
- dark mode denso,
- checklist operacional,
- skeleton loading,
- seção dedicada por função.

### Onde ainda melhorar para engajamento “Agora”
- rotinas guiadas por persona (wizard de criação de oferta por cargo),
- atalhos de decisão “1-clique” (escala/kill/briefing),
- analytics de uso por squad (adoção diária, abandono de fluxo).

---

## 3.3 Erros, gargalos e caching
### O que está bom
- captura silenciosa de erros (server/client) com endpoint dedicado.
- cache inteligente no dashboard do Offers Lab.

### Gargalos remanescentes
- ausência de métricas distribuídas de latência p95/p99 por rota (APM real-time),
- ausência de rate limit distribuído (Redis/Upstash),
- ausência de política de backpressure explícita por tenant/squad.

---

## 4) Gestão de contingência e sinais de falha

### Já existe
- monitor de contingência, sirene, kill switch, health de domínios e gateway no War Room.

### Falta crítica
- alerta dedicado “**UTMs pararam de chegar**” com:
  - detector de silêncio por canal (Meta/Google/TikTok/Kwai),
  - incident auto-open + escalonamento por SLA.

---

## 5) Prontidão para publicação

## 5.1 Está pronto para servidor de produção?
**Pronto para publicação controlada (staging + rollout progressivo).**  
**Ainda não pronto para “infalível 10D” sem os reforços abaixo.**

---

## 6) Top 3 funcionalidades “Killer” para codar AGORA

1. **Attribution Governance Engine (Quarantine + Canonical Alias)**
   - tabela de aliases UTM canônicos,
   - auto-correção auditável,
   - quarentena de evento inválido antes de contaminar métricas.

2. **Lead Journey & Cold Behavior Graph**
   - timeline por LeadID (click -> page depth -> no-buy -> reactivation),
   - score de aquecimento para reciclagem de ofertas,
   - gatilhos automáticos de retomada por ângulo.

3. **Predictive LTV Service (D7→D90) com Drift Monitor**
   - treino supervisionado versionado,
   - monitor de drift e recalibração,
   - decisão de escala baseada em LTV preditivo com confiança.

---

## 7) Plano de ação para “Publicação 10D”

## Onda 1 (segurança e estabilidade operacional)
- Migrar limiter/cache para camada distribuída (Redis).
- Forçar `WAR_ROOM_OPS_PERSISTENCE_MODE=database` em produção.
- Criar detector de silêncio de UTM (incident + alerta).

## Onda 2 (governança de dado e atribuição)
- Canonical alias table para UTMs.
- Quarantine pipeline de eventos inválidos.
- Reconciliação automática spend/revenue por canal com tolerância e incidentes.

## Onda 3 (inteligência de crescimento estilo Agora)
- Feature store + pipeline de treino LTV.
- Score de IP por lucro incremental.
- Motor de recomendação de nova oferta por comportamento pós-clique.

---

## 8) Conclusão técnica

O WAR ROOM OS já está em patamar avançado e operacional.  
Para atingir o padrão **Agora Inc. 10D**, a próxima fronteira não é só UI: é **governança de atribuição, inteligência preditiva formal e infraestrutura distribuída de escala**.

