# WAR ROOM DASHBOARD

Central de Inteligencia da Empresa com foco em operacao, performance e financeiro.

## Stack

- Next.js (App Router)
- React
- Tailwind CSS
- Lucide Icons

## Como rodar do zero

```bash
npm install
npm run dev
```

Abra `http://localhost:3000`.

## Dashboard conectado a dados reais

O projeto aceita 4 fontes de dados via variavel de ambiente `WAR_ROOM_SOURCE`:

- `mock`: dados locais (fallback seguro)
- `api`: endpoint HTTP externo
- `sheet`: Google Sheets API
- `database`: PostgreSQL

Crie seu arquivo `.env.local` a partir do exemplo:

```bash
cp .env.example .env.local
```

### 1) Fonte por API externa

```env
WAR_ROOM_SOURCE=api
WAR_ROOM_API_URL=https://sua-api.com/war-room
WAR_ROOM_API_TOKEN=seu_token_opcional
```

Estrutura JSON esperada:

```json
{
  "updatedAt": "2026-03-20T12:00:00.000Z",
  "ads": {
    "investmentTotal": 250000,
    "avgRoas": 2.45,
    "avgCpm": 39.5,
    "creatives": [
      { "id": "CRTV-001", "hookRate": 33.5, "holdRate": 47.2, "roas": 2.9, "verdict": "Escalar" }
    ]
  },
  "copy": {
    "angles": ["..."],
    "hooksBacklog": ["..."],
    "productionFlow": {
      "roteirizando": ["..."],
      "gravando": ["..."],
      "editando": ["..."]
    }
  },
  "tech": {
    "pageLoadDropOff": 24.3,
    "pageLoadNote": "...",
    "vslRetention": 46.1,
    "vslNote": "...",
    "checkoutConversion": 6.2,
    "checkoutNote": "..."
  },
  "finance": {
    "revenue": 640000,
    "approvalRate": 88.4,
    "ltv": 1940
  }
}
```

### 2) Fonte por Google Sheets

```env
WAR_ROOM_SOURCE=sheet
GOOGLE_SHEETS_SPREADSHEET_ID=...
GOOGLE_SHEETS_API_KEY=...
```

Abas esperadas (editaveis por range no `.env.local`):

- `ads_metrics` (investmentTotal, avgRoas, avgCpm)
- `creatives` (id, hookRate, holdRate, roas, verdict)
- `copy_angles` (angle)
- `hooks_backlog` (hook)
- `production_flow` (status, item)
- `tech_metrics` (pageLoadDropOff, pageLoadNote, vslRetention, vslNote, checkoutConversion, checkoutNote)
- `finance_metrics` (revenue, approvalRate, ltv)

### 3) Fonte por PostgreSQL

```env
WAR_ROOM_SOURCE=database
DATABASE_URL=postgresql://usuario:senha@host:5432/banco
DATABASE_SSL=false
```

Tabelas esperadas:

- `war_room_ads_metrics`
- `war_room_creatives`
- `war_room_copy_angles`
- `war_room_hooks_backlog`
- `war_room_production_flow`
- `war_room_tech_metrics`
- `war_room_finance_metrics`

## Endpoint interno

- `GET /api/war-room` retorna o payload consolidado que alimenta o dashboard.

## Estrutura principal

- `src/components/Dashboard.tsx`: dashboard completo com sidebar e departamentos.
- `src/app/page.tsx`: entrada principal da aplicacao.
- `src/lib/war-room/*`: conectores de dados (API, Google Sheets e PostgreSQL).

## Regras de inteligencia implementadas

- **Health Score**: criativos com **Hook Rate < 20%** entram em alerta vermelho.
- **Winner Badge**: criativos com **ROAS > 2.2** recebem badge dourado.
