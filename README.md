# Checklist de Produção — Portal Pronutrition (RED-029 Rev. 06)

Aplicação SPA pura em Vite + React 19 + TypeScript strict + Tailwind v4
(CSS-first). Backend e autenticação via Supabase (apenas client-side, com
`@supabase/supabase-js`). Schema e dados são gerenciados exclusivamente
pelo Supabase CLI e por migrations SQL versionadas em `supabase/migrations/`.

---

## Stack

- **Frontend**: Vite 7, React 19 (estável), TypeScript strict, Tailwind v4
  (`@tailwindcss/vite` + `@theme inline` em `src/index.css`; sem arquivo
  JavaScript de configuração do Tailwind).
- **Design System**: Tokens Pronutrition (paleta roxa dominante, sem
  gradient, sem box-shadow exceto focus ring, alvos 44×44). Componentes
  shadcn estilizados conforme manual de marca.
- **Backend/Auth**: `@supabase/supabase-js` (client-side).
- **Banco de dados local**: Supabase CLI + Docker. Ver seção abaixo.
- **Validação**: Zod 3 em `src/lib/env.ts` (ambiente) e formulários.

---

## Scripts

| Comando | Descrição |
|---|---|
| `pnpm dev` | Sobe o Vite em modo desenvolvimento. |
| `pnpm build` | Typecheck (`tsc --noEmit`) + build de produção. |
| `pnpm preview` | Sobe o build de produção localmente. |
| `pnpm typecheck` | Apenas o Typecheck, sem build. |

---

## Variáveis de ambiente

Apenas duas variáveis, expostas ao cliente via prefixo `VITE_`. Ambas são
obtidas em [supabase.com](https://supabase.com) → escolha o projeto →
**Project Settings → API**.

| Nome | Painel Supabase → campo |
|---|---|
| `VITE_SUPABASE_URL` | **Project URL** — normalmente `https://<ref>.supabase.co` |
| `VITE_SUPABASE_ANON_KEY` | **anon public** — chave anônima, visível no cliente, respeita RLS |

Copie `.env.example` para `.env` na raiz. A validação em `src/lib/env.ts`
interrompe o boot caso falte alguma, caso a URL não comece com `https://`,
ou caso a anon key tenha menos de 20 caracteres.

**NÃO USAR a chave `service_role` em lugar nenhum deste projeto.**
Arquitetura é 100% client-side e privilegia RLS, não key de administrador.
A variável `SUPABASE_SERVICE_ROLE_KEY` **não existe** neste repositório.

---

## Banco de dados

Banco de dados, storage e auth são gerenciados diretamente no projeto
Supabase hospedado em [supabase.com](https://supabase.com). **Não usamos
Supabase CLI, Docker ou stack local neste projeto.**

Toda alteração de schema (tabelas, colunas, índices, RLS policies,
funções, tipos enum, views) passa pelo seguinte fluxo obrigatório:

1. **Crie o arquivo de migration primeiro** — na pasta
   `supabase/migrations/`, com o próximo número inteiro, prefixo de 4
   dígitos e `_` separador:
   ```
   supabase/migrations/0001_criar_tabela_checklists.sql
   supabase/migrations/0002_criar_tabela_itens_controle.sql
   supabase/migrations/0003_criar_rls_policies.sql
   ```
   O SQL contido no arquivo é a **fonte de verdade oficial** da mudança.
   Commite esse arquivo antes de aplicá-lo no banco.

2. **Aplique no painel** — abra o projeto em supabase.com, vá em
   **SQL Editor**, cole o conteúdo do arquivo `.sql` e execute. Guarde o
   link da query salva no SQL Editor, se desejar auditoria futura.

3. **Atualize os tipos TypeScript manualmente** — abra
   `src/types/database.ts` e espelhe o schema recém aplicado. Há um
   placeholder inicial em `public.Tables` / `Views` / `Functions` /
   `Enums` / `CompositeTypes` (todos `Record<string, never>`). Não há
   geração automática por CLI; é você quem garante a sincronia.

### ⚠️ Governança (respeite sempre)

> **PROIBIDO** alterar qualquer objeto do schema (tabelas, colunas,
> policies, views, funções, enum, sequências, etc.) diretamente no
> painel do Supabase **sem** antes criar e commitar o arquivo `.sql`
> correspondente em `supabase/migrations/`.
>
> O SQL Editor do painel é só o executor. O repositório Git é a única
> fonte de verdade. Se for preciso ajustar algo em produção urgente:
> primeiro crie a migration, depois aplique, depois atualize
> `src/types/database.ts` e só então valide no painel.

---

## Design system (ambiente de desenvolvimento)

Em ambiente local (`import.meta.env.DEV`) a rota `/design-system` expõe a
página de validação com:

- Escala tipográfica completa (7 tokens)
- Tabela de swatches com contraste WCAG 2.1 calculado (todos os pares
  fg/bg em uso real)
- Variantes de logo Pronutrition (SVG, com área de reserva)
- Todos os controles shadcn estilizados (button, input, select,
  radio-group, checkbox, textarea, tabs, dialog, alert, badge, tooltip)

Esta página é `React.lazy` e guardada por `import.meta.env.DEV` — ela **não**
entra no bundle de produção (tree-shaken pelo Vite/Rollup).
