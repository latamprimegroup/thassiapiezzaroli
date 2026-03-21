# DEPARTAMENTOS MAP - WAR ROOM OS (DR 9D)

## Matriz de perfis e permissões (RBAC)

| Cargo | Seções principais | Ferramentas diárias | Permissões-chave |
|---|---|---|---|
| CEO (Admin) | Todas (inclui API Hub) | Command Center CEO, Boardroom, Drill-down global | Financeiro sensível, escala, edição de custos/impostos, visão API/manual |
| Tech Admin | API Hub, Tech/CRO, Compliance, Command Center | Gestão de tokens e modo offline/manual | Acesso secreto ao API Hub, saúde sistêmica |
| Financeiro | CEO & Financeiro, Compliance, Tech/CRO | Input de custos fixos/impostos, DRE live | Visualiza sensível, edita Boardroom |
| Copy Junior | Copy & Pesquisa, Squad Sync, Produção | Gerador UTM pré-aprovada, input de hooks | Sem aprovação de roteiro, sem financeiro |
| Copy Senior | Copy & Pesquisa, Offers Lab, Tráfego, Command Center | Dashboard retenção por VSL, aprovação de roteiros | Aprova scripts, acesso ao Vault avançado |
| Tráfego Junior | Tráfego & Atribuição, Offers Lab, Squad Sync | Input diário de gastos por plataforma | Sem “escala em 1 clique” |
| Tráfego Senior | Tráfego & Atribuição, Offers Lab, Tech/CRO, Command Center | Scaling Advisor, decisão de escala em 1 clique | Aprovação de done (edição), visão health mode |
| Produção (Editor) | Produção, Command Center, Test Lab | Fila de produção por impacto, upload final por UTM ID | Gestão de fila, upload de versões |
| Produção (Designer) | Produção, Command Center, Test Lab | Execução de demanda visual e entregas | Gestão de fila, upload de versões |
| Comercial (Closer) | Sales Recovery, Squad Sync, Command Center | Sniper List (score 90+) + One-Tap WhatsApp | Sem financeiro |
| CX Manager | Customer Experience, Squad Sync, Command Center | LTV/churn e follow-up de safra | Sem financeiro |

## Estrutura completa de profissoes por squad (DR 9D)

### 1) Squad de Copywriting (Coracao Intelectual)
- Chief Copy Officer (CCO)
- Copywriter Senior
- Copywriter Junior
- Especialista de Pesquisa (Researcher)
- Editor de Texto (Copy Editor)

### 2) Squad de Trafego e Dados (Motor de Escala)
- Head de Trafego
- Gestor de Trafego Senior
- Gestor de Trafego Junior
- Cientista de Dados / Analista de BI
- Especialista em Atribuicao

### 3) Squad de Producao Criativa (Fabrica de Ganchos)
- Diretor de Arte / Motion Designer
- Editor de Video (VSL Specialist)
- Editor de Video (Ads/Hooks)
- Videografo / Produtor

### 4) Squad de Operacoes e Tecnologia (Blindagem)
- CTO / Diretor de Tecnologia
- Desenvolvedor Full-Stack
- Analista de Compliance
- Gerente de Projetos (Agile Coach)

### 5) Squad Comercial e Pos-venda (Snipers de Lucro)
- Head de Vendas / Closer
- SDR / Recuperador de Vendas
- Gerente de Customer Experience (CX)
- Especialista de Onboarding

### 6) Setor Administrativo e Estrategico (Tabuleiro)
- CEO / Fundador
- CFO / Diretor Financeiro
- Gerente de Networking

## Fluxo de demandas entre setores (Ticketing)

1. Tráfego (junior/senior) identifica gargalo ou fadiga.
2. Command Center cria/espelha tarefa para Copy e Produção.
3. Produção recebe fila priorizada por impacto financeiro.
4. Entrega final é vinculada a um `UTM ID` (Drive/Vimeo) no módulo de Produção.
5. Log global registra autoria e decisão.

## Regras operacionais

- **Aba secreta API Hub:** somente `techAdmin` e `ceo`.
- **Modo Offline/Manual:** pode ser ativado no API Hub e no Traffic Hub.
- **Boardroom financeiro:** edição de custos/impostos permitida para `financeManager` e `ceo`.
- **Aprovação de qualidade em Done (edição):** `ceo`, `trafficSenior` e compatibilidade legada `mediaBuyer`.

## Compatibilidade legada

Para não quebrar sessões antigas:

- `mediaBuyer` -> alias de `trafficSenior`
- `copywriter` -> alias de `copySenior`
- `videoEditor` -> alias de `productionEditor`
