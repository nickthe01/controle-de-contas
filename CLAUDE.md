# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

**controle de contas** — aplicativo de controle de contas pessoais (finanças pessoais). Permite registrar receitas e despesas, visualizar saldo mensal e gerenciar transações do dia a dia.

## Stack

- **Framework:** Next.js 15 (App Router)
- **Estilização:** Tailwind CSS
- **Banco de dados:** Supabase (PostgreSQL)
- **Deploy:** Vercel (conectado ao GitHub `nickthe01/controle-de-contas`, branch `main`)

Sempre use Next.js e Tailwind CSS neste projeto, independentemente da funcionalidade sendo implementada.

## Estrutura

```
src/
  app/
    api/transactions/
      route.ts          # GET (listar) e POST (criar) transações
      [id]/route.ts     # DELETE transação por ID
    page.tsx            # Dashboard principal (client component)
    layout.tsx
    globals.css
  lib/
    types.ts            # Tipo Transaction
```

## Banco de dados (Supabase)

Tabela `transactions`:
| Coluna | Tipo | Descrição |
|--------|------|-----------|
| id | UUID | Chave primária |
| description | TEXT | Descrição da transação |
| amount | DECIMAL(10,2) | Valor |
| type | TEXT | `income` ou `expense` |
| category | TEXT | Categoria |
| date | DATE | Data da transação |
| created_at | TIMESTAMPTZ | Data de criação |

## Variáveis de ambiente

Necessárias tanto localmente (`.env.local`) quanto no Vercel:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
- `SUPABASE_SECRET_KEY`

## Deploy

Todo push na branch `main` dispara um deploy automático no Vercel.
