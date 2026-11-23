-- ERP acadêmico — schema. Dinheiro em centavos; quantidades numeric(14,3); datas timestamptz/date.
create extension if not exists pgcrypto;

create table orgs (
  id uuid primary key default gen_random_uuid(),
  nome text not null check (length(trim(nome)) > 0),
  cnpj text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table org_members (
  org_id uuid not null references orgs(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  papel text not null default 'vendedor' check (papel in ('admin','vendedor','financeiro','estoquista')),
  created_at timestamptz not null default now(),
  primary key (org_id, user_id)
);
create index on org_members (user_id);

create or replace function is_member(o uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from org_members where org_id = o and user_id = auth.uid());
$$;

create or replace function tem_papel(o uuid, papeis text[]) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from org_members where org_id = o and user_id = auth.uid() and papel = any (papeis));
$$;

-- numeração sem buracos por empresa (pedido, nota, cliente, produto)
create table contadores (
  org_id uuid not null references orgs(id) on delete cascade,
  nome text not null,
  valor integer not null default 0,
  primary key (org_id, nome)
);

create table vendedores (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references orgs(id) on delete cascade,
  nome text not null,
  user_id uuid references auth.users(id) on delete set null,
  ativo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on vendedores (org_id);

create table clientes (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references orgs(id) on delete cascade,
  codigo integer not null,
  nome text not null check (length(trim(nome)) > 0),
  documento text,
  email text, telefone text,
  endereco jsonb not null default '{}',
  bloqueado boolean not null default false,
  ativo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (org_id, codigo),
  unique (org_id, documento)
);
create index on clientes (org_id, nome);

create table grupos_produto (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references orgs(id) on delete cascade,
  nome text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (org_id, nome)
);

create table produtos (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references orgs(id) on delete cascade,
  codigo integer not null,
  descricao text not null check (length(trim(descricao)) > 0),
  grupo_id uuid references grupos_produto(id) on delete set null,
  unidade text not null default 'UN',
  preco_centavos integer not null default 0 check (preco_centavos >= 0),  -- preço padrão (tabelas de preço vêm depois)
  ncm text,
  controla_estoque boolean not null default true,
  ativo boolean not null default true,
  imagem_path text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (org_id, codigo)
);
create index on produtos (org_id, descricao);
create index on produtos (grupo_id);

create table produto_volumes (
  id uuid primary key default gen_random_uuid(),
  produto_id uuid not null references produtos(id) on delete cascade,
  unidade text not null,
  fator numeric(14,4) not null check (fator > 0),
  unique (produto_id, unidade)
);
create table produto_componentes (
  produto_id uuid not null references produtos(id) on delete cascade,
  componente_id uuid not null references produtos(id) on delete no action,
  quantidade numeric(14,3) not null check (quantidade > 0),
  primary key (produto_id, componente_id),
  check (produto_id <> componente_id)
);
create index on produto_componentes (componente_id);
create table produto_alternativos (
  produto_id uuid not null references produtos(id) on delete cascade,
  alternativo_id uuid not null references produtos(id) on delete cascade,
  primary key (produto_id, alternativo_id),
  check (produto_id <> alternativo_id)
);
create index on produto_alternativos (alternativo_id);

-- ===== Estoque =====
create table locais_estoque (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references orgs(id) on delete cascade,
  nome text not null,
  ativo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (org_id, nome)
);

create table estoque_saldos (
  org_id uuid not null references orgs(id) on delete cascade,
  produto_id uuid not null references produtos(id) on delete cascade,
  local_id uuid not null references locais_estoque(id) on delete no action,
  saldo numeric(14,3) not null default 0 check (saldo >= 0),   -- trava final: saldo nunca negativo
  updated_at timestamptz not null default now(),
  primary key (produto_id, local_id)
);
create index on estoque_saldos (org_id, local_id);

create table estoque_movimentos (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references orgs(id) on delete cascade,
  produto_id uuid not null references produtos(id) on delete no action,
  local_id uuid not null references locais_estoque(id) on delete no action,
  tipo text not null check (tipo in ('entrada','saida','ajuste','estorno')),
  quantidade numeric(14,3) not null check (quantidade <> 0),
  origem_tipo text, origem_id uuid,
  motivo text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);
create index on estoque_movimentos (org_id, produto_id, created_at desc);
create index on estoque_movimentos (origem_tipo, origem_id);

create or replace function aplica_movimento() returns trigger
language plpgsql as $$
begin
  -- atualiza primeiro: num INSERT ... ON CONFLICT o CHECK (saldo >= 0) valida a linha proposta
  -- ANTES de resolver o conflito, o que barraria toda saída de estoque.
  loop
    update estoque_saldos set saldo = saldo + new.quantidade, updated_at = now()
      where produto_id = new.produto_id and local_id = new.local_id;
    exit when found;
    begin
      insert into estoque_saldos (org_id, produto_id, local_id, saldo) values (new.org_id, new.produto_id, new.local_id, new.quantidade);
      exit;
    exception when unique_violation then
      -- outra transação criou a linha agora; tenta o update de novo
    end;
  end loop;
  return new;
end $$;
create trigger trg_aplica_movimento after insert on estoque_movimentos
for each row execute function aplica_movimento();

-- ===== Preços (estrutura pronta; telas vêm depois) =====
create table tabelas_preco (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references orgs(id) on delete cascade,
  nome text not null,
  vigencia_inicio date, vigencia_fim date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (org_id, nome),
  check (vigencia_fim is null or vigencia_inicio is null or vigencia_fim >= vigencia_inicio)
);
create table precos (
  tabela_id uuid not null references tabelas_preco(id) on delete cascade,
  produto_id uuid not null references produtos(id) on delete cascade,
  valor_centavos integer not null check (valor_centavos >= 0),
  primary key (tabela_id, produto_id)
);
create index on precos (produto_id);

-- ===== Financeiro (cadastros) =====
create table naturezas (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references orgs(id) on delete cascade,
  nome text not null, tipo text not null check (tipo in ('receita','despesa')),
  unique (org_id, nome)
);
create table centros_resultado (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references orgs(id) on delete cascade,
  nome text not null, unique (org_id, nome)
);
create table contas_bancarias (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references orgs(id) on delete cascade,
  nome text not null, banco text, unique (org_id, nome)
);
create table tipos_pagamento (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references orgs(id) on delete cascade,
  nome text not null,
  parcelas integer not null default 1 check (parcelas between 1 and 48),
  dias_entre_parcelas integer not null default 30 check (dias_entre_parcelas >= 0),
  unique (org_id, nome)
);

-- ===== Vendas =====
create table pedidos (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references orgs(id) on delete cascade,
  numero integer not null,
  cliente_id uuid not null references clientes(id) on delete no action,
  vendedor_id uuid references vendedores(id) on delete set null,
  tabela_preco_id uuid references tabelas_preco(id) on delete set null,
  tipo_pagamento_id uuid references tipos_pagamento(id) on delete set null,
  local_id uuid references locais_estoque(id) on delete no action,
  status text not null default 'rascunho' check (status in ('rascunho','confirmado','faturado','cancelado')),
  total_centavos integer not null default 0 check (total_centavos >= 0),
  parcelas integer not null default 1,
  dias_entre integer not null default 30,
  observacao text,
  motivo_cancelamento text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (org_id, numero)
);
create index on pedidos (org_id, status, created_at desc);
create index on pedidos (cliente_id);
create index on pedidos (vendedor_id);

create table pedido_itens (
  id uuid primary key default gen_random_uuid(),
  pedido_id uuid not null references pedidos(id) on delete cascade,
  produto_id uuid not null references produtos(id) on delete no action,
  quantidade numeric(14,3) not null check (quantidade > 0),
  preco_unit_centavos integer not null check (preco_unit_centavos >= 0),
  desconto_centavos integer not null default 0 check (desconto_centavos >= 0),
  total_centavos integer not null check (total_centavos >= 0)
);
create index on pedido_itens (pedido_id);
create index on pedido_itens (produto_id);

create table notas_fiscais (   -- SIMULADA, sem SEFAZ
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references orgs(id) on delete cascade,
  pedido_id uuid references pedidos(id) on delete no action,
  tipo text not null default 'venda' check (tipo in ('venda','devolucao','remessa','retorno')),
  serie integer not null default 1,
  numero integer not null,
  status text not null default 'emitida' check (status in ('emitida','cancelada')),
  total_centavos integer not null check (total_centavos >= 0),
  impostos_centavos integer not null default 0 check (impostos_centavos >= 0),
  emitida_em timestamptz not null default now(),
  cancelada_em timestamptz,
  unique (org_id, serie, numero)
);
create index on notas_fiscais (pedido_id);
create index on notas_fiscais (org_id, emitida_em desc);
create unique index uq_nota_venda_por_pedido on notas_fiscais (pedido_id) where tipo = 'venda' and status = 'emitida';

create table nota_itens (
  id uuid primary key default gen_random_uuid(),
  nota_id uuid not null references notas_fiscais(id) on delete cascade,
  produto_id uuid not null references produtos(id) on delete no action,
  quantidade numeric(14,3) not null check (quantidade > 0),
  valor_unit_centavos integer not null check (valor_unit_centavos >= 0),
  total_centavos integer not null check (total_centavos >= 0)
);
create index on nota_itens (nota_id);

-- ===== Financeiro =====
create table financeiros (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references orgs(id) on delete cascade,
  tipo text not null check (tipo in ('receita','despesa')),
  descricao text,
  cliente_id uuid references clientes(id) on delete no action,
  nota_id uuid references notas_fiscais(id) on delete set null,
  pedido_id uuid references pedidos(id) on delete set null,
  natureza_id uuid references naturezas(id) on delete set null,
  centro_resultado_id uuid references centros_resultado(id) on delete set null,
  conta_bancaria_id uuid references contas_bancarias(id) on delete set null,
  tipo_pagamento_id uuid references tipos_pagamento(id) on delete set null,
  parcela integer not null default 1,
  total_parcelas integer not null default 1,
  valor_centavos integer not null check (valor_centavos > 0),
  moeda text not null default 'BRL',
  vencimento date not null,
  status text not null default 'aberto' check (status in ('aberto','parcial','baixado','cancelado')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on financeiros (org_id, tipo, status, vencimento);
create index on financeiros (cliente_id);
create index on financeiros (nota_id);
create index on financeiros (pedido_id);

create table financeiro_baixas (
  id uuid primary key default gen_random_uuid(),
  financeiro_id uuid not null references financeiros(id) on delete cascade,
  valor_centavos integer not null check (valor_centavos > 0),
  juros_centavos integer not null default 0 check (juros_centavos >= 0),
  baixado_em timestamptz not null default now(),
  conta_bancaria_id uuid references contas_bancarias(id) on delete set null,
  created_by uuid references auth.users(id) on delete set null
);
create index on financeiro_baixas (financeiro_id);
