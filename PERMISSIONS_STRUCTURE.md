# PERMISSIONS STRUCTURE - WAR ROOM OS (9D)

## Perfis oficiais

- CEO / Fundador (`ceo`)
- Chief Copy Officer (`cco`)
- Copywriter Senior (`copySenior`)
- Copywriter Junior (`copyJunior`)
- Head de Trafego (`headTraffic`)
- Gestor de Trafego Senior (`trafficSenior`)
- Gestor de Trafego Junior (`trafficJunior`)
- Editor de Video (`productionEditor`)
- Designer / Motion (`productionDesigner`)
- Closer (`closer`)
- SDR (`sdr`)
- Financeiro / CFO (`financeManager`, `cfo`)
- Tecnologia CTO/DEV (`techAdmin`, `ctoDev`)
- CX Manager (`cxManager`)

## Rotas protegidas

- `/copy`: `ceo`, `cco`, `copySenior`, `copyJunior`, `copywriter`
- `/traffic`: `ceo`, `headTraffic`, `trafficSenior`, `trafficJunior`, `mediaBuyer`
- `/admin`: `ceo`, `financeManager`, `cfo`, `techAdmin`, `ctoDev`

Regra de redirecionamento por login:

- Admins (`ceo`, `cfo`, `financeManager`, `techAdmin`, `ctoDev`) -> `/admin`
- Midia (`headTraffic`, `trafficSenior`, `trafficJunior`, `mediaBuyer`) -> `/traffic`
- Copy (`cco`, `copySenior`, `copyJunior`, `copywriter`) -> `/copy`
- Demais -> `/`

## Matriz de leitura/escrita por recurso de dados

| Recurso / Tabela logica | CEO | CCO / Copy Sr | Copy Jr | Trafego Sr / Head | Trafego Jr | Editor/Designer | Closer/SDR | Finance/CFO | Tech |
|---|---|---|---|---|---|---|---|---|---|
| `app_users`, `app_roles`, `role_permissions` | R/W/Admin | R | - | R | - | - | - | R | R/W/Admin |
| `offers_lab_offers` | R/W/Approve | R/W/Approve | R/W (sem approve) | R/W/Approve | R/W (sem approve) | R | R | R/W | R |
| `offers_lab_traffic_events` | R | R | R | R/W | R/W | R | - | R | R/W |
| `offers_lab_utm_aliases` | R/W | R | - | R/W | R | - | - | R/W | R/W |
| `offers_lab_quarantine_events` | R | R | - | R | R | - | - | R | R/W |
| `offers_lab_predictive_ltv_state` | R | R | - | R | - | - | - | R | R/W |
| `daily_task_logs` | R/W | R/W | R/W | R/W | R/W | R/W | R/W | R/W | R/W |
| `asset_workflow` | R | R/W (submit roteiro) | R/W (submit roteiro) | R | R | R/W (finalizar) | R | R | R |
| `asset_workflow_history` | R | R/W | R/W | R | R | R/W | R | R | R/W |
| `command_center_tasks` | R/W/Approve | R/W | R/W | R/W/Approve | R/W | R/W | R/W | R/W | R/W |
| `api_hub_tokens` | R/W/Admin | - | - | - | - | - | - | R | R/W/Admin |
| `finance_pnl` / boardroom configs | R/W | - | - | R (sem write) | R (sem write) | - | - | R/W | R |
| `sniper_leads` | R | - | - | R | - | - | R/W | R | R |

Legenda:
- `R`: leitura
- `W`: escrita
- `Approve`: pode validar/escalar (70k + ROAS >= 1.8)
- `Admin`: controle total e governanca

## Regras de validacao critica

1. Apenas `ceo`, `cco`, `copySenior`, `headTraffic`, `trafficSenior` (e alias legado `mediaBuyer`) podem definir status de oferta para `validada`/`escala`.
2. Workflow de ativo:
   - Copy sobe roteiro -> `aguardando_edicao`
   - Editor finaliza com URL -> `pronto_para_trafego`
3. Daily task obrigatoria operacional:
   - qualquer colaborador pode registrar sua entrega diaria
   - CEO recebe consolidado para leitura macro
