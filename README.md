# WAR ROOM OS - 8-Figure Squad Engine

Single Page Application (SPA) para operacao de Direct Response com:

- alinhamento de squads (Copy, Trafego, Edicao),
- pipeline de producao estilo Kanban,
- tracking de anuncios em tempo real,
- inteligencia automatica por badges.

## Stack

- Next.js (App Router)
- React
- Tailwind CSS
- Lucide Icons
- Componentes UI estilo Shadcn (`src/components/ui`)

## Como rodar do zero

```bash
npm install
npm run dev
```

Abra `http://localhost:3000`.

## Modulos da aplicacao

1. **Global Overview**
   - Investimento vs Faturamento (Utmify)
   - ROAS macro consolidado
2. **Squad Facebook**
   - Live Ads Tracking + Daily Briefing + Creative Velocity
3. **Squad Google/YouTube**
   - Live Ads Tracking + Daily Briefing + Creative Velocity
4. **Creative Factory**
   - Kanban: Roteiro -> Gravacao -> Edicao -> Teste -> Winner

## Regras de inteligencia

- Hook Rate (3s/Imp) > 30% => **Gancho de Ouro**
- Hold Rate (15s/3s) < 20% => **Gargalo de Retencao**
- ROAS > 2.5 => **WINNER DETECTED**

## RBAC (Role-Based Access Control)

Perfis simulados no cabecalho com renderizacao por cargo:

- **CEO (Admin)**: visao total, acesso a faturamento liquido, margem de lucro e aprovacao de escala.
- **Media Buyer**: foco em leilao (CPM/CPC/Frequencia), input de dados brutos e botao **Alertar Squad**.
- **Copywriter / Creative Director**: foco em retencao e gestao do backlog de scripts/angulos.
- **Video Editor**: visao simplificada por criativo, acesso ao feedback e upload de novas versoes.

Regras de visibilidade:

- Perfil **Video Editor** nao visualiza cards de **Faturamento** e **ROAS Real**.
- Perfil **Copywriter** recebe destaque visual nas metricas de retencao.
- Secoes sem permissao aparecem bloqueadas (rota protegida).

Tambem foi adicionado o **Log de Atividades**, com trilha de acoes no formato:

- `[Gestor X] pausou criativo [Y] por baixo Hook Rate`

## Auditoria de Escalabilidade (upgrade corporativo)

- Escopo de dados por sessao no backend (`/api/war-room`) com sanitizacao por cargo.
- Troca de usuario simulada com cookie httpOnly (`/api/auth/switch-user`).
- Tabela de anuncios otimizada para alto volume com paginação de render.
- Formulas DR centralizadas com protecao contra `NaN`/`Infinity`:
  - Hook Rate = `3s / Imp`
  - Hold Rate = `15s / 3s`
  - VSL Efficiency = `IC / LP`
- Tooltips operacionais nas metricas principais.
- Componente **Recomendacoes da IA** para acao imediata.
- **Health Check** em tempo real com latencia API + indice de Page Drop.

## Modo 9D (Enterprise DR)

- **MER (Marketing Efficiency Ratio)**:
  - card de ROAS real do ecossistema usando receita bruta vs gasto consolidado por fonte.
- **Indice de Saturacao de Criativo**:
  - badge `FADIGA IMINENTE` quando frequencia sobe e CTR unico cai por 3 dias.
- **Funnel Deep-Dive**:
  - colunas por criativo para `AOV`, `Upsell %`, `LTV` e `CPA`.
  - priorizacao automatica com badge `PRIORIDADE LTV` (mesmo com CPA ate 10% acima da base).
- **Painel de Contingencia**:
  - monitor para dominios e contas com estados `ok | warning | blocked`.
  - alerta visual e sonoro imediato ao detectar risco critico.
- **Sparklines 24h**:
  - tendencia embutida na tabela para Hook, Hold e ROAS.

## Fontes de dados reais

O projeto aceita 4 fontes via `WAR_ROOM_SOURCE`:

- `mock`: dados locais (fallback seguro)
- `api`: endpoint HTTP externo
- `sheet`: Google Sheets API
- `database`: PostgreSQL

Crie seu arquivo `.env.local` a partir do exemplo:

```bash
cp .env.example .env.local
```

### 1) API externa

```env
WAR_ROOM_SOURCE=api
WAR_ROOM_API_URL=https://sua-api.com/war-room
WAR_ROOM_API_TOKEN=seu_token_opcional
```

Estrutura recomendada:

```json
{
  "updatedAt": "2026-03-20T12:00:00.000Z",
  "globalOverview": {
    "investment": 1920000,
    "revenue": 5580000,
    "utmifySyncAt": "Agora mesmo"
  },
  "squads": {
    "facebook": {
      "name": "Squad Facebook",
      "focus": "FB Ads + UGC",
      "creativeVelocity": 17,
      "creativeVelocityTarget": 14,
      "validatedCreatives": 11,
      "managerComment": "..."
    },
    "googleYoutube": {
      "name": "Squad Google/YouTube",
      "focus": "Search + VVC + Display",
      "creativeVelocity": 9,
      "creativeVelocityTarget": 12,
      "validatedCreatives": 5,
      "managerComment": "..."
    }
  },
  "liveAdsTracking": [
    {
      "id": "FB-101",
      "squad": "facebook",
      "campaign": "Scale UGC CBO",
      "adName": "Dor aguda + prova social",
      "impressions": 182440,
      "views3s": 63671,
      "views15s": 21200,
      "ic": 3102,
      "lp": 9741,
      "roas": 2.7
    }
  ],
  "creativeFactory": {
    "tasks": [
      {
        "id": "TASK-001",
        "squad": "facebook",
        "title": "V3 - Hook anti-erro",
        "owner": "Copy Ana",
        "status": "Roteiro",
        "metricContext": "Hold < 20%",
        "updatedAt": "09:40"
      }
    ]
  },
  "dailyBriefing": [
    {
      "id": "BRIEF-1",
      "squad": "facebook",
      "trafficManagerComment": "...",
      "replies": [
        {
          "role": "Copy",
          "author": "Ana",
          "version": "V2",
          "assetUrl": "https://...",
          "note": "..."
        }
      ]
    }
  ],
  "finance": {
    "approvalRate": 88.4,
    "ltv": 1940
  }
}
```

> O normalizador ainda aceita payload legado (`ads/copy/tech/finance`) para retrocompatibilidade.

### 2) Google Sheets

```env
WAR_ROOM_SOURCE=sheet
GOOGLE_SHEETS_SPREADSHEET_ID=...
GOOGLE_SHEETS_API_KEY=...
```

Abas legadas suportadas (editaveis por range no `.env.local`):

- `ads_metrics` (investmentTotal, avgRoas, avgCpm)
- `creatives` (id, hookRate, holdRate, roas, verdict)
- `copy_angles` (angle)
- `hooks_backlog` (hook)
- `production_flow` (status, item)
- `tech_metrics` (pageLoadDropOff, pageLoadNote, vslRetention, vslNote, checkoutConversion, checkoutNote)
- `finance_metrics` (revenue, approvalRate, ltv)

### 3) PostgreSQL

```env
WAR_ROOM_SOURCE=database
DATABASE_URL=postgresql://usuario:senha@host:5432/banco
DATABASE_SSL=false
```

Tabelas legadas suportadas:

- `war_room_ads_metrics`
- `war_room_creatives`
- `war_room_copy_angles`
- `war_room_hooks_backlog`
- `war_room_production_flow`
- `war_room_tech_metrics`
- `war_room_finance_metrics`

## Endpoint interno

- `GET /api/war-room` retorna:
  - `data`: payload consolidado (ja sanitizado pelo RBAC da sessao)
  - `session`: metadados da sessao ativa (role/userId)
- `POST /api/auth/switch-user` troca usuario de demonstracao e atualiza cookie httpOnly.
- `GET /api/health` retorna status para health check de latencia.

## Estrutura principal

- `src/components/Dashboard.tsx`: shell principal da SPA.
- `src/components/war-room/live-ads-table.tsx`: tabela de performance com calculo de Hook/Hold/VSL + badges.
- `src/components/war-room/daily-briefing.tsx`: fluxo de comentario tecnico + respostas com links V2/V3.
- `src/components/war-room/creative-factory-board.tsx`: pipeline Kanban de producao.
- `src/components/ui/*`: componentes UI estilo Shadcn.
- `src/app/page.tsx`: entrada principal da aplicacao.
- `src/lib/war-room/*`: conectores de dados (API, Google Sheets e PostgreSQL).
