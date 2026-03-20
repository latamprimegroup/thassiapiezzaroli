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

## Estrutura principal

- `src/components/Dashboard.tsx`: dashboard completo com sidebar e departamentos.
- `src/app/page.tsx`: entrada principal da aplicacao.

## Regras de inteligencia implementadas

- **Health Score**: criativos com **Hook Rate < 20%** entram em alerta vermelho.
- **Winner Badge**: criativos com **ROAS > 2.2** recebem badge dourado.
