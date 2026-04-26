# Pro One Hours & Invoice

Aplicacao web responsiva para controle pessoal de horas trabalhadas e geracao de invoice semanal para trabalho ABN com a Pro One.

## Rodar localmente

```bash
npm install
npm run dev
```

Depois abra `http://localhost:3000`.

Para checar tipos:

```bash
npm run typecheck
```

## Regras implementadas

- Semana de trabalho de quinta-feira a quarta-feira.
- Registro por dia com data, local, entrada, saida, intervalo e observacoes.
- Persistencia local no navegador via `localStorage`.
- Payroll real:
  - ate 9h no mesmo dia: `$35/h`
  - acima de 9h no mesmo dia: overtime de `1.5x`, ou `$52.50/h`
- Invoice:
  - quando a semana tem ate 24h reais, sugere declarar as horas reais.
  - quando a semana passa de 24h reais, sugere declarar 24h.
  - o unit price automatico e recalculado para o total do invoice bater com o total real da semana.
  - modo manual permite editar horas declaradas e unit price por linha.
  - se o modo manual gerar diferenca, o PDF so e liberado apos confirmar o total diferente.
- PDF com tabela de itens, subtotal, tax 0% e total.

## Supabase + Vercel

O projeto agora esta preparado para rodar com banco de dados no Supabase e deploy na Vercel.

### Variaveis de ambiente

Crie um arquivo `.env.local` com:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

### Banco de dados

No painel do Supabase:

1. Abra o projeto
2. Va em `SQL Editor`
3. Rode o arquivo [supabase/schema.sql](/Users/renanluz/Documents/New%20project/supabase/schema.sql)

Esse schema cria:

- `app_settings`
- `work_entries`
- triggers de `updated_at`
- policies de Row Level Security por usuario autenticado

### Autenticacao

O app usa email + senha com Supabase Auth.

No Supabase:

1. Va em `Authentication`
2. Confirme que `Email` esta habilitado
3. Para evitar envio de email na criacao da conta, deixe `Confirm email` desabilitado
3. Em `URL Configuration`, adicione:
   - `http://localhost:3000`
   - `http://localhost:3001`
   - sua futura URL da Vercel

### Deploy na Vercel

1. Suba o projeto para GitHub
2. Importe o repo na Vercel
3. Adicione as mesmas env vars:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
4. Deploy

Depois disso, o login com email e senha vai sincronizar os mesmos dados entre iPhone e desktop.

## Dados demo

A primeira abertura carrega registros de exemplo para a semana `09/04/2026 - 15/04/2026`:

- `09/04/2026`: 8h normais em Cockatoo Hill Park.
- `10/04/2026`: 10h, sendo 9h normais e 1h overtime.
- `14/04/2026`: 10h, sendo 9h normais e 1h overtime.
- `15/04/2026`: 8h normais em Walton Bridge Reserve.

Essa semana soma 36h reais, passa do limite declarado de 24h e demonstra o ajuste do unit price no invoice.

## Estrutura

```text
app/                 Rotas Next.js e CSS global
components/          UI da aplicacao
lib/calculations/    Horas, payroll, datas e semana quinta-quarta
lib/invoice/         Linhas de invoice, totais e PDF
lib/storage/         localStorage, configuracoes e dados demo
types/               Interfaces TypeScript do dominio
```

## Pontos principais da logica

- `getWorkWeekStart` calcula sempre a quinta-feira da semana de referencia.
- `calculateDailyPayroll` separa horas normais e overtime por dia.
- `createInvoiceLines` separa horas reais de horas declaradas.
- `calculateInvoiceTotals` compara o total declarado com o total real alvo.

Os valores monetarios sao arredondados de forma consistente em centavos, e o unit price do invoice aceita precisao extra quando necessario para distribuir o total real em apenas 24h declaradas.
