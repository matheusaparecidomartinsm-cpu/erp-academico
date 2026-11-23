"""Testa as migrações num Postgres local: isolamento entre empresas (RLS), papéis, regras de negócio,
concorrência e exclusão de conta. Uso: PGDSN="host=/tmp port=5544 dbname=erp user=postgres" python3 rls_e_regras.py
Pré-requisito: banco criado com tests/bootstrap_local.sql + as 4 migrações."""
import os, threading, uuid
import psycopg

DSN = os.environ.get("PGDSN", "host=/tmp port=5544 dbname=erp user=postgres")
ok = 0

def run(uid, sql, params=(), role="authenticated"):
    """Executa 1 comando numa transação, como o usuário uid (ou anon se uid=None). Retorna linhas."""
    with psycopg.connect(DSN) as c:
        with c.transaction():
            cur = c.cursor()
            cur.execute(f"set local role {role if uid or role=='anon' else 'authenticated'}")
            if uid: cur.execute("select set_config('request.jwt.claim.sub', %s, true)", (str(uid),))
            cur.execute(sql, params)
            try: return cur.fetchall()
            except psycopg.ProgrammingError: return []

def admin(sql, params=()):
    with psycopg.connect(DSN, autocommit=True) as c:
        cur = c.cursor(); cur.execute(sql, params)
        try: return cur.fetchall()
        except psycopg.ProgrammingError: return []

def falha(uid, sql, trecho, params=(), role="authenticated"):
    try: run(uid, sql, params, role)
    except psycopg.Error as e:
        msg = e.diag.message_primary or str(e)
        assert trecho.lower() in msg.lower(), f"esperava '{trecho}', veio '{msg}'"
        return
    raise AssertionError(f"deveria ter falhado ({trecho}): {sql}")

def t(nome):
    def deco(fn):
        global ok; fn(); ok += 1; print("ok  " + nome); return fn
    return deco

# ---- preparação ----
admin("truncate auth.users cascade")
A, B, C = (uuid.uuid4() for _ in range(3))
for u, e in ((A, "a@teste"), (B, "b@teste"), (C, "c@teste")): admin("insert into auth.users (id, email) values (%s, %s)", (str(u), e))
orgA = run(A, "select criar_org('Empresa A', true)")[0][0]
orgB = run(B, "select criar_org('Empresa B', false)")[0][0]
admin("insert into org_members (org_id, user_id, papel) values (%s, %s, 'vendedor')", (str(orgA), str(C)))
pid = lambda cod: run(A, "select id from produtos where org_id=%s and codigo=%s", (str(orgA), cod))[0][0]
cli = lambda cod: run(A, "select id from clientes where org_id=%s and codigo=%s", (str(orgA), cod))[0][0]
saldo = lambda cod: float(run(A, "select coalesce(sum(saldo),0) from estoque_saldos where produto_id=%s", (str(pid(cod)),))[0][0])
item = lambda cod, q, preco=100: {"produto_id": str(pid(cod)), "quantidade": q, "preco_centavos": preco, "desconto_centavos": 0}
import json
def novo_pedido(cod_cli, itens, user=A):
    return run(user, "select (criar_pedido(%s, %s, %s::jsonb, null)).id", (str(orgA), str(cli(cod_cli)), json.dumps(itens)))[0][0]

@t("exemplo: A vê dados; painel calcula vencido e itens sem saldo")
def _():
    assert run(A, "select count(*) from clientes")[0][0] == 4
    d = run(A, "select dashboard(%s)", (str(orgA),))[0][0]
    assert d["receber_vencido_centavos"] == 35100 + 0 or d["receber_vencido_centavos"] > 0, d
    assert d["itens_sem_saldo"] == 1 and d["pedidos_abertos"] == 2, d   # só fita adesiva sem saldo

@t("RLS: B não enxerga NADA da empresa A (todas as tabelas)")
def _():
    for tb in ("clientes","produtos","pedidos","pedido_itens","notas_fiscais","nota_nao" if False else "nota_itens","financeiros","financeiro_baixas","estoque_saldos","estoque_movimentos","locais_estoque","grupos_produto","orgs","org_members"):
        n = run(B, f"select count(*) from {tb} where false or true")[0][0]
        # B só pode ver linhas da própria empresa (B): conferimos que nenhuma é da A
        if tb in ("orgs",): assert run(B, "select count(*) from orgs where id=%s", (str(orgA),))[0][0] == 0
        elif tb == "org_members": assert run(B, "select count(*) from org_members where org_id=%s", (str(orgA),))[0][0] == 0
        elif tb in ("pedido_itens","nota_itens","financeiro_baixas"): assert n == 0, tb
        elif tb in ("locais_estoque",): assert run(B, "select count(*) from locais_estoque where org_id=%s", (str(orgA),))[0][0] == 0
        else: assert run(B, f"select count(*) from {tb} where org_id=%s", (str(orgA),))[0][0] == 0, tb
    assert run(B, "select count(*) from clientes")[0][0] == 0 and run(B, "select count(*) from pedidos")[0][0] == 0

@t("B não consegue escrever nos dados da A (funções e acesso direto)")
def _():
    ped = novo_pedido(1, [item(1, 1)])
    falha(B, "select confirmar_pedido(%s)", "não encontrado", (str(ped),))
    falha(B, "select faturar_pedido(%s, 1, 30)", "não encontrado", (str(ped),))
    falha(B, "select cancelar_pedido(%s, 'x')", "não encontrado", (str(ped),))
    falha(B, "select criar_cliente(%s, 'X', null, null)", "permissão", (str(orgA),))
    falha(B, "select ajustar_estoque(%s, %s, 5, 'x')", "permissão", (str(orgA), str(pid(1))))
    falha(B, "select lancar_despesa(%s, 'x', 100, current_date)", "permissão", (str(orgA),))
    falha(B, "select dashboard(%s)", "permissão", (str(orgA),))
    fin = run(A, "select id from financeiros where tipo='receita' limit 1")[0][0]
    falha(B, "select baixar_financeiro(%s, 100, 0)", "não encontrado", (str(fin),))
    falha(B, "insert into pedidos (org_id, numero, cliente_id) values (%s, 9999, %s)", "permission denied", (str(orgA), str(cli(1))))
    falha(B, "insert into estoque_movimentos (org_id, produto_id, local_id, tipo, quantidade) select %s, %s, id, 'entrada', 999 from locais_estoque limit 1", "permission denied", (str(orgA), str(pid(1))))
    falha(B, "update financeiros set status='baixado'", "permission denied")
    falha(B, "update clientes set nome='hack' where org_id=%s", "permission denied", (str(orgA),))
    falha(B, "delete from produtos where org_id=%s", "permission denied", (str(orgA),))
    falha(B, "insert into clientes (org_id, codigo, nome) values (%s, 99, 'invasor')", "permission denied", (str(orgA),))

@t("anônimo não lê tabelas nem executa funções")
def _():
    falha(None, "select * from clientes", "permission denied", role="anon")
    falha(None, "select criar_org('x')", "permission denied", role="anon")
    falha(None, "select dashboard(%s)", "permission denied", (str(orgA),), role="anon")

@t("papéis: vendedor (C) cria/confirma pedido, mas não fatura, cancela, baixa nem ajusta estoque")
def _():
    ped = run(C, "select (criar_pedido(%s, %s, %s::jsonb, null)).id", (str(orgA), str(cli(2)), json.dumps([item(3, 2, 210)])))[0][0]
    run(C, "select confirmar_pedido(%s)", (str(ped),))
    falha(C, "select faturar_pedido(%s, 1, 30)", "permissão", (str(ped),))
    falha(C, "select cancelar_pedido(%s, 'x')", "permissão", (str(ped),))
    falha(C, "select ajustar_estoque(%s, %s, 1, 'x')", "permissão", (str(orgA), str(pid(3))))
    falha(C, "select lancar_despesa(%s, 'x', 100, current_date)", "permissão", (str(orgA),))
    fin = run(A, "select id from financeiros where tipo='receita' limit 1")[0][0]
    falha(C, "select baixar_financeiro(%s, 100, 0)", "permissão", (str(fin),))
    falha(C, "select criar_produto(%s, 'x', null, 'UN', 100, true)", "permissão", (str(orgA),))
    assert run(C, "select count(*) from clientes")[0][0] == 4   # leitura ok

@t("F01: faturar baixa estoque, gera NF e parcelas (última absorve a diferença)")
def _():
    antes = saldo(4)
    ped = novo_pedido(1, [item(4, 10, 320)]); run(A, "select confirmar_pedido(%s)", (str(ped),))
    nf = run(A, "select (faturar_pedido(%s, 3, 30)).numero", (str(ped),))[0][0]
    assert saldo(4) == antes - 10
    vals = [r[0] for r in run(A, "select valor_centavos from financeiros where pedido_id=%s order by parcela", (str(ped),))]
    assert vals == [1066, 1066, 1068], vals
    assert run(A, "select status, total_centavos from notas_fiscais where pedido_id=%s", (str(ped),))[0] == ("emitida", 3200)
    assert nf >= 2

@t("estoque insuficiente bloqueia confirmar; cliente bloqueado também")
def _():
    ped = novo_pedido(1, [item(5, 1)])   # fita adesiva sem saldo
    falha(A, "select confirmar_pedido(%s)", "saldo insuficiente", (str(ped),))
    ped2 = novo_pedido(4, [item(1, 1)])
    falha(A, "select confirmar_pedido(%s)", "bloqueado", (str(ped2),))

@t("faturar 2x não duplica; falha no meio não grava nada (atomicidade)")
def _():
    ped = novo_pedido(1, [item(1, 1)]); run(A, "select confirmar_pedido(%s)", (str(ped),))
    run(A, "select faturar_pedido(%s, 1, 30)", (str(ped),))
    falha(A, "select faturar_pedido(%s, 1, 30)", "confirmado", (str(ped),))
    assert run(A, "select count(*) from notas_fiscais where pedido_id=%s", (str(ped),))[0][0] == 1
    ped2 = novo_pedido(1, [item(1, 1)]); run(A, "select confirmar_pedido(%s)", (str(ped2),))
    s0 = saldo(1)
    falha(A, "select faturar_pedido(%s, 99, 30)", "parcelas", (str(ped2),))
    assert saldo(1) == s0 and run(A, "select status from pedidos where id=%s", (str(ped2),))[0][0] == "confirmado"
    assert run(A, "select count(*) from notas_fiscais where pedido_id=%s", (str(ped2),))[0][0] == 0

@t("cancelar faturado estorna estoque, cancela NF e financeiro")
def _():
    ped = novo_pedido(1, [item(3, 5, 210)]); run(A, "select confirmar_pedido(%s)", (str(ped),))
    run(A, "select faturar_pedido(%s, 1, 30)", (str(ped),)); meio = saldo(3)
    run(A, "select cancelar_pedido(%s, 'Cliente desistiu')", (str(ped),))
    assert saldo(3) == meio + 5
    assert run(A, "select status from notas_fiscais where pedido_id=%s", (str(ped),))[0][0] == "cancelada"
    assert all(r[0] == "cancelado" for r in run(A, "select status from financeiros where pedido_id=%s", (str(ped),)))
    falha(A, "select cancelar_pedido(%s, 'de novo')", "já está cancelado", (str(ped),))
    falha(A, "select cancelar_pedido(%s, ' ')", "motivo", (str(novo_pedido(1, [item(1, 1)])),))

@t("baixa parcial/total/excesso; cancelar com baixa é recusado")
def _():
    ped = run(A, "select id from pedidos where org_id=%s and numero=1001", (str(orgA),))[0][0]
    f = run(A, "select id, valor_centavos from financeiros where pedido_id=%s and parcela=1", (str(ped),))[0]
    falha(A, "select baixar_financeiro(%s, %s, 0)", "maior que o saldo", (str(f[0]), f[1] + 1))
    run(A, "select baixar_financeiro(%s, 100, 5)", (str(f[0]),))
    assert run(A, "select status from financeiros where id=%s", (str(f[0]),))[0][0] == "parcial"
    run(A, "select baixar_financeiro(%s, %s, 0)", (str(f[0]), f[1] - 100))
    assert run(A, "select status from financeiros where id=%s", (str(f[0]),))[0][0] == "baixado"
    falha(A, "select baixar_financeiro(%s, 1, 0)", "já baixado", (str(f[0]),))
    falha(A, "select cancelar_pedido(%s, 'x')", "estorne os recebimentos", (str(ped),))

@t("ajuste de estoque: negativo recusado, motivo obrigatório, ok quando válido")
def _():
    falha(A, "select ajustar_estoque(%s, %s, -999999, 'x')", "negativo", (str(orgA), str(pid(1))))
    falha(A, "select ajustar_estoque(%s, %s, 5, ' ')", "motivo", (str(orgA), str(pid(1))))
    s = saldo(1); run(A, "select ajustar_estoque(%s, %s, 5, 'contagem')", (str(orgA), str(pid(1)))); assert saldo(1) == s + 5
    falha(A, "update estoque_saldos set saldo=-1", "permission denied")
    # trava final no banco, mesmo para o dono do banco:
    with psycopg.connect(DSN) as c:
        try: c.execute("update estoque_saldos set saldo=-1"); raise AssertionError("check de saldo não barrou")
        except psycopg.errors.CheckViolation: pass

@t("validações: documento repetido, desconto maior que o item, item sem produto da empresa")
def _():
    falha(A, "select criar_cliente(%s, 'Outro', '11.111.111/0001-11', null)", "documento", (str(orgA),))
    falha(A, "select criar_cliente(%s, 'Outro', null, 'sem-arroba')", "e-mail", (str(orgA),))
    falha(A, "select criar_pedido(%s, %s, %s::jsonb, null)", "desconto", (str(orgA), str(cli(1)), json.dumps([{"produto_id": str(pid(1)), "quantidade": 1, "preco_centavos": 100, "desconto_centavos": 101}])))
    pB = run(B, "select (criar_produto(%s, 'Produto B', null, 'UN', 100, true)).id", (str(orgB),))[0][0]
    falha(A, "select criar_pedido(%s, %s, %s::jsonb, null)", "produto não encontrado", (str(orgA), str(cli(1)), json.dumps([{"produto_id": str(pB), "quantidade": 1, "preco_centavos": 100, "desconto_centavos": 0}])))

@t("concorrência: dois faturamentos simultâneos do MESMO pedido -> só um passa")
def _():
    ped = novo_pedido(1, [item(6, 1, 590)]); run(A, "select confirmar_pedido(%s)", (str(ped),))
    res = []
    def go():
        try: run(A, "select faturar_pedido(%s, 1, 30)", (str(ped),)); res.append("ok")
        except psycopg.Error as e: res.append(e.diag.message_primary)
    th = [threading.Thread(target=go) for _ in range(2)]; [x.start() for x in th]; [x.join() for x in th]
    assert sorted(res)[0] == "Só é possível faturar um pedido confirmado." and "ok" in res, res
    assert run(A, "select count(*) from notas_fiscais where pedido_id=%s and status='emitida'", (str(ped),))[0][0] == 1

@t("concorrência: último estoque disputado por 2 pedidos -> um é recusado, saldo nunca negativo")
def _():
    run(A, "select ajustar_estoque(%s, %s, %s::numeric, 'preparo do teste')", (str(orgA), str(pid(8)), 10 - saldo(8)))  # saldo = 10 (se saldo<10) ou ajusta
    s = saldo(8); assert s == 10, s
    p1 = novo_pedido(1, [item(8, 8, 980)]); p2 = novo_pedido(2, [item(8, 8, 980)])
    run(A, "select confirmar_pedido(%s)", (str(p1),)); run(A, "select confirmar_pedido(%s)", (str(p2),))
    res = []
    def go(p):
        try: run(A, "select faturar_pedido(%s, 1, 30)", (str(p),)); res.append("ok")
        except psycopg.Error as e: res.append(e.diag.message_primary)
    th = [threading.Thread(target=go, args=(p,)) for p in (p1, p2)]; [x.start() for x in th]; [x.join() for x in th]
    assert res.count("ok") == 1 and any("Saldo insuficiente" in r for r in res if r != "ok"), res
    assert saldo(8) == 2.0


def loc(nome): return run(A, "select id from locais_estoque where org_id=%s and nome=%s", (str(orgA), nome))[0][0]
def saldo_loc(cod, l): return float(run(A, "select coalesce(sum(saldo),0) from estoque_saldos where produto_id=%s and local_id=%s", (str(pid(cod)), str(l)))[0][0])

@t("locais de estoque: criar, ajustar por local, transferir, saldo do pedido vem do local")
def _():
    principal = loc("Depósito principal")
    filial = run(A, "select (criar_local(%s, 'Filial Norte')).id", (str(orgA),))[0][0]
    falha(A, "select criar_local(%s, 'filial norte')", "já existe", (str(orgA),))
    falha(C, "select criar_local(%s, 'X')", "permissão", (str(orgA),))
    falha(B, "select criar_local(%s, 'X')", "permissão", (str(orgA),))
    ini = saldo_loc(3, principal)
    run(A, "select ajustar_estoque(%s, %s, 50, 'carga', %s)", (str(orgA), str(pid(3)), str(filial)))
    assert saldo_loc(3, filial) == 50 and saldo_loc(3, principal) == ini
    falha(A, "select ajustar_estoque(%s, %s, -51, 'x', %s)", "negativo", (str(orgA), str(pid(3)), str(filial)))
    run(A, "select transferir_estoque(%s, %s, %s, %s, 20)", (str(orgA), str(pid(3)), str(principal), str(filial)))
    assert saldo_loc(3, filial) == 70 and saldo_loc(3, principal) == ini - 20 and saldo(3) == ini + 50
    falha(A, "select transferir_estoque(%s, %s, %s, %s, 5)", "diferentes", (str(orgA), str(pid(3)), str(filial), str(filial)))
    falha(A, "select transferir_estoque(%s, %s, %s, %s, 9999)", "saldo insuficiente", (str(orgA), str(pid(3)), str(filial), str(principal)))
    falha(A, "select transferir_estoque(%s, %s, %s, %s, 0)", "maior que zero", (str(orgA), str(pid(3)), str(filial), str(principal)))
    falha(C, "select transferir_estoque(%s, %s, %s, %s, 1)", "permissão", (str(orgA), str(pid(3)), str(filial), str(principal)))
    falha(B, "select transferir_estoque(%s, %s, %s, %s, 1)", "permissão", (str(orgA), str(pid(3)), str(filial), str(principal)))
    # pedido que sai da filial: o saldo checado é o da filial (guardanapo só tem no principal)
    ped = run(A, "select (criar_pedido(%s, %s, %s::jsonb, null, %s)).id", (str(orgA), str(cli(1)), json.dumps([item(6, 1)]), str(filial)))[0][0]
    falha(A, "select confirmar_pedido(%s)", "saldo insuficiente", (str(ped),))
    ped = run(A, "select (criar_pedido(%s, %s, %s::jsonb, null, %s)).id", (str(orgA), str(cli(1)), json.dumps([item(3, 60)]), str(filial)))[0][0]
    run(A, "select confirmar_pedido(%s)", (str(ped),)); run(A, "select faturar_pedido(%s, 1, 30)", (str(ped),))
    assert saldo_loc(3, filial) == 10 and saldo_loc(3, principal) == ini - 20
    falha(A, "select atualizar_local(%s, 'Filial Norte', false)", "ainda tem saldo", (str(filial),))
    falha(A, "select criar_pedido(%s, %s, %s::jsonb, null, %s)", "local de estoque válido", (str(orgA), str(cli(1)), json.dumps([item(3, 1)]), str(uuid.uuid4())))
    run(A, "select transferir_estoque(%s, %s, %s, %s, 10)", (str(orgA), str(pid(3)), str(filial), str(principal)))
    run(A, "select atualizar_local(%s, 'Filial Norte (inativa)', false)", (str(filial),))
    falha(A, "select ajustar_estoque(%s, %s, 1, 'x', %s)", "local de estoque válido", (str(orgA), str(pid(3)), str(filial)))
    lb = run(B, "select id from locais_estoque")[0][0]   # empresa B: único local, sem saldo
    falha(B, "select atualizar_local(%s, 'Depósito principal', false)", "pelo menos um local ativo", (str(lb),))
    falha(A, "select atualizar_local(%s, 'x', true)", "não encontrado", (str(lb),))

@t("tabelas de preço: só admin escreve; cliente usa a tabela; B não vê nem altera")
def _():
    tb = run(A, "select (criar_tabela_preco(%s, 'Atacado')).id", (str(orgA),))[0][0]
    falha(A, "select criar_tabela_preco(%s, 'atacado')", "já existe", (str(orgA),))
    falha(C, "select criar_tabela_preco(%s, 'X')", "permissão", (str(orgA),))
    run(A, "select definir_preco(%s, %s, 400)", (str(tb), str(pid(1))))
    run(A, "select definir_preco(%s, %s, 380)", (str(tb), str(pid(1))))   # atualiza, não duplica
    assert run(A, "select valor_centavos from precos where tabela_id=%s and produto_id=%s", (str(tb), str(pid(1)))) == [(380,)]
    falha(A, "select definir_preco(%s, %s, -1)", "negativo", (str(tb), str(pid(1))))
    falha(C, "select definir_preco(%s, %s, 1)", "permissão", (str(tb), str(pid(1))))
    falha(B, "select definir_preco(%s, %s, 1)", "não encontrada", (str(tb), str(pid(1))))
    falha(B, "select remover_preco(%s, %s)", "não encontrada", (str(tb), str(pid(1))))
    falha(B, "select excluir_tabela_preco(%s)", "não encontrada", (str(tb),))
    assert run(B, "select count(*) from tabelas_preco")[0][0] == 0 and run(B, "select count(*) from precos")[0][0] == 0
    falha(B, "insert into precos (tabela_id, produto_id, valor_centavos) values (%s, %s, 1)", "permission denied", (str(tb), str(pid(1))))
    c = run(C, "select (atualizar_cliente(%s, 'Mercado Exemplo Ltda', '11.111.111/0001-11', 'compras@mercadoexemplo.test', false, true, %s)).tabela_preco_id", (str(cli(1)), str(tb)))[0][0]
    assert str(c) == str(tb)
    falha(C, "select atualizar_cliente(%s, 'X', null, null, false, true, %s)", "não encontrada", (str(cli(1)), str(uuid.uuid4())))
    run(A, "select remover_preco(%s, %s)", (str(tb), str(pid(1))))
    run(A, "select excluir_tabela_preco(%s)", (str(tb),))
    assert run(A, "select tabela_preco_id from clientes where id=%s", (str(cli(1)),))[0][0] is None

@t("editar cadastros: cliente (admin/vendedor), produto (só admin), validações e isolamento")
def _():
    r = run(C, "select (atualizar_cliente(%s, 'Padaria Modelo ME 2', '22.222.222/0001-22', null, true, true, null)).bloqueado", (str(cli(2)),))[0][0]
    assert r is True
    falha(A, "select confirmar_pedido(%s)", "bloqueado", (novo_pedido(2, [item(1, 1)]),))
    run(A, "select atualizar_cliente(%s, 'Padaria Modelo ME', '22.222.222/0001-22', 'contato@padariamodelo.test', false, true, null)", (str(cli(2)),))
    falha(A, "select atualizar_cliente(%s, 'X', '11.111.111/0001-11', null, false, true, null)", "documento", (str(cli(2)),))
    falha(A, "select atualizar_cliente(%s, 'X', null, 'sem-arroba', false, true, null)", "e-mail", (str(cli(2)),))
    falha(A, "select atualizar_cliente(%s, '  ', null, null, false, true, null)", "nome", (str(cli(2)),))
    falha(B, "select atualizar_cliente(%s, 'hack', null, null, false, true, null)", "não encontrado", (str(cli(2)),))
    n = run(A, "select (atualizar_produto(%s, 'Caixa de papelão 30x20 cm', 'Embalagens', 'UN', 470, true)).preco_centavos", (str(pid(1)),))[0][0]
    assert n == 470
    falha(C, "select atualizar_produto(%s, 'x', null, 'UN', 1, true)", "permissão", (str(pid(1)),))
    falha(B, "select atualizar_produto(%s, 'x', null, 'UN', 1, true)", "não encontrado", (str(pid(1)),))
    falha(A, "select atualizar_produto(%s, 'x', null, 'UN', -1, true)", "negativo", (str(pid(1)),))
    run(A, "select atualizar_produto(%s, 'Caixa de papelão 30x20 cm', 'Embalagens', 'UN', 450, true)", (str(pid(1)),))
    # alterar pedido em rascunho
    ped = novo_pedido(1, [item(1, 1, 450)])
    p2 = run(C, "select (atualizar_pedido(%s, %s, %s::jsonb, 'nova obs', null)).total_centavos", (str(ped), str(cli(3)), json.dumps([item(1, 2, 450), item(3, 3, 210)])))[0][0]
    assert p2 == 900 + 630
    assert run(A, "select count(*) from pedido_itens where pedido_id=%s", (str(ped),))[0][0] == 2
    falha(A, "select atualizar_pedido(%s, %s, '[]'::jsonb, null, null)", "pelo menos um item", (str(ped), str(cli(1))))
    assert run(A, "select count(*) from pedido_itens where pedido_id=%s", (str(ped),))[0][0] == 2   # falha não apaga itens
    falha(B, "select atualizar_pedido(%s, %s, %s::jsonb, null, null)", "não encontrado", (str(ped), str(cli(1)), json.dumps([item(1, 1)])))
    run(A, "select confirmar_pedido(%s)", (str(ped),))
    falha(A, "select atualizar_pedido(%s, %s, %s::jsonb, null, null)", "rascunho", (str(ped), str(cli(1)), json.dumps([item(1, 1)])))

@t("financeiro: receita manual, estorno de baixa, cancelar exige estorno, painel ignora estornadas")
def _():
    antes = run(A, "select dashboard(%s)", (str(orgA),))[0][0]["receber_vencido_centavos"]
    run(A, "select lancar_receita(%s, %s, 'Venda avulsa', 5000, current_date - 10)", (str(orgA), str(cli(2))))
    falha(A, "select lancar_receita(%s, null, '', 5000, current_date)", "descrição", (str(orgA),))
    falha(A, "select lancar_receita(%s, null, 'x', 0, current_date)", "maior que zero", (str(orgA),))
    falha(C, "select lancar_receita(%s, null, 'x', 100, current_date)", "permissão", (str(orgA),))
    falha(B, "select lancar_receita(%s, null, 'x', 100, current_date)", "permissão", (str(orgA),))
    assert run(A, "select dashboard(%s)", (str(orgA),))[0][0]["receber_vencido_centavos"] == antes + 5000
    fid = run(A, "select id from financeiros where descricao='Venda avulsa'")[0][0]
    run(A, "select baixar_financeiro(%s, 5000, 0)", (str(fid),))
    assert run(A, "select status from financeiros where id=%s", (str(fid),))[0][0] == "baixado"
    bid = run(A, "select id from financeiro_baixas where financeiro_id=%s", (str(fid),))[0][0]
    falha(C, "select estornar_baixa(%s)", "permissão", (str(bid),))
    falha(B, "select estornar_baixa(%s)", "não encontrada", (str(bid),))
    run(A, "select estornar_baixa(%s)", (str(bid),))
    assert run(A, "select status from financeiros where id=%s", (str(fid),))[0][0] == "aberto"
    falha(A, "select estornar_baixa(%s)", "já foi estornada", (str(bid),))
    assert run(A, "select dashboard(%s)", (str(orgA),))[0][0]["receber_vencido_centavos"] == antes + 5000
    run(A, "select baixar_financeiro(%s, 2000, 0)", (str(fid),)); run(A, "select baixar_financeiro(%s, 3000, 0)", (str(fid),))
    assert run(A, "select status from financeiros where id=%s", (str(fid),))[0][0] == "baixado"
    b2 = run(A, "select id from financeiro_baixas where financeiro_id=%s and valor_centavos=3000 and estornada_em is null", (str(fid),))[0][0]
    run(A, "select estornar_baixa(%s)", (str(b2),))
    assert run(A, "select status from financeiros where id=%s", (str(fid),))[0][0] == "parcial"
    # cancelar pedido faturado com recebimento: recusa até estornar
    ped = novo_pedido(1, [item(4, 2, 320)]); run(A, "select confirmar_pedido(%s)", (str(ped),)); run(A, "select faturar_pedido(%s, 1, 30)", (str(ped),))
    f = run(A, "select id from financeiros where pedido_id=%s", (str(ped),))[0][0]
    run(A, "select baixar_financeiro(%s, 640, 0)", (str(f),))
    falha(A, "select cancelar_pedido(%s, 'desistiu')", "estorne os recebimentos", (str(ped),))
    run(A, "select estornar_baixa(%s)", (str(run(A, "select id from financeiro_baixas where financeiro_id=%s", (str(f),))[0][0]),))
    s0 = saldo(4)
    run(A, "select cancelar_pedido(%s, 'desistiu')", (str(ped),))
    assert saldo(4) == s0 + 2 and run(A, "select status from financeiros where id=%s", (str(f),))[0][0] == "cancelado"
    falha(A, "select estornar_baixa(%s)", "cancelado", (str(run(A, "select id from financeiro_baixas where financeiro_id=%s", (str(f),))[0][0]),))

@t("cadastros auxiliares: vendedor, natureza, centro, conta, tipo, empresa, classificação e isolamento")
def _():
    oa = str(orgA); ob = str(orgB)
    v = run(A, "select (salvar_vendedor(%s, null, 'Ana Teste', true)).id", (oa,))[0][0]
    falha(A, "select salvar_vendedor(%s, null, 'ana teste', true)", "Já existe", (oa,))
    falha(A, "select salvar_vendedor(%s, null, '   ', true)", "Informe o nome", (oa,))
    falha(C, "select salvar_vendedor(%s, null, 'Intruso', true)", "permissão", (oa,))
    falha(B, "select salvar_vendedor(%s, %s, 'Invadido', true)", "permissão", (oa, str(v)))
    run(B, "select salvar_vendedor(%s, null, 'Ana Teste', true)", (ob,))          # mesmo nome em outra empresa é permitido
    falha(B, "select salvar_vendedor(%s, %s, 'Invadido', true)", "não encontrado", (ob, str(v)))   # id de outra empresa
    run(A, "select salvar_vendedor(%s, %s, 'Ana Teste', false)", (oa, str(v)))
    # insert direto continua bloqueado
    falha(A, "insert into vendedores (org_id, nome) values (%s, 'direto')", "permission denied", (oa,))
    # vendedor no pedido: ativo sim, inativo não
    ped = novo_pedido(1, [item(4, 1, 320)])
    falha(A, "select definir_vendedor_pedido(%s, %s)", "vendedor ativo", (str(ped), str(v)))
    run(A, "select salvar_vendedor(%s, %s, 'Ana Teste', true)", (oa, str(v)))
    # comissão por vendedor (migração 6)
    run(A, "select salvar_vendedor(%s, %s, 'Ana Teste', true, 250)", (oa, str(v)))
    assert run(A, "select comissao_bps from vendedores where id=%s", (str(v),))[0][0] == 250
    run(A, "select salvar_vendedor(%s, %s, 'Ana Teste', true)", (oa, str(v)))        # sem o parâmetro mantém o valor
    assert run(A, "select comissao_bps from vendedores where id=%s", (str(v),))[0][0] == 250
    falha(A, "select salvar_vendedor(%s, %s, 'Ana Teste', true, 10001)", "Comissão deve ficar entre", (oa, str(v)))
    falha(A, "select salvar_vendedor(%s, %s, 'Ana Teste', true, -1)", "Comissão deve ficar entre", (oa, str(v)))
    falha(C, "select salvar_vendedor(%s, %s, 'Ana Teste', true, 900)", "permissão", (oa, str(v)))
    falha(B, "select salvar_vendedor(%s, %s, 'Outro Nome B', true, 900)", "não encontrado", (ob, str(v)))
    assert run(A, "select comissao_bps from vendedores where id=%s", (str(v),))[0][0] == 250
    run(A, "select definir_vendedor_pedido(%s, %s)", (str(ped), str(v)))
    assert run(A, "select vendedor_id from pedidos where id=%s", (str(ped),))[0][0] == v
    falha(B, "select definir_vendedor_pedido(%s, null)", "não encontrado", (str(ped),))
    run(A, "select definir_vendedor_pedido(%s, null)", (str(ped),))
    # natureza / centro / conta / tipo
    nr = run(A, "select (salvar_natureza(%s, null, 'Venda teste', 'receita')).id", (oa,))[0][0]
    nd = run(A, "select (salvar_natureza(%s, null, 'Aluguel teste', 'despesa')).id", (oa,))[0][0]
    falha(A, "select salvar_natureza(%s, null, 'X', 'outro')", "receita ou de despesa", (oa,))
    falha(A, "select salvar_natureza(%s, null, 'venda teste', 'receita')", "Já existe", (oa,))
    ce = run(A, "select (salvar_centro(%s, null, 'Comercial teste')).id", (oa,))[0][0]
    co = run(A, "select (salvar_conta(%s, null, 'Caixa teste', '  ')).id", (oa,))[0][0]
    assert run(A, "select banco from contas_bancarias where id=%s", (str(co),))[0][0] is None
    ti = run(A, "select (salvar_tipo_pagamento(%s, null, '30/60 teste', 2, 30)).id", (oa,))[0][0]
    falha(A, "select salvar_tipo_pagamento(%s, null, 'Ruim', 0, 30)", "1 a 48", (oa,))
    falha(A, "select salvar_tipo_pagamento(%s, null, 'Ruim', 2, -1)", "negativo", (oa,))
    falha(C, "select salvar_centro(%s, null, 'Intruso')", "permissão", (oa,))
    # classificação
    run(A, "select lancar_despesa(%s, 'Aluguel de teste', 10000, current_date)", (oa,))
    fd = run(A, "select id from financeiros where descricao='Aluguel de teste'")[0][0]
    falha(A, "select classificar_financeiro(%s, %s, null, null, null)", "é de receita", (str(fd), str(nr)))
    run(A, "select classificar_financeiro(%s, %s, %s, %s, %s)", (str(fd), str(nd), str(ce), str(co), str(ti)))
    assert run(A, "select natureza_id, centro_resultado_id, conta_bancaria_id, tipo_pagamento_id from financeiros where id=%s", (str(fd),))[0] == (nd, ce, co, ti)
    falha(B, "select classificar_financeiro(%s, null, null, null, null)", "não encontrado", (str(fd),))
    cb = run(B, "select (salvar_centro(%s, null, 'Centro da B')).id", (ob,))[0][0]
    falha(A, "select classificar_financeiro(%s, null, %s, null, null)", "Centro de resultado inválido", (str(fd), str(cb)))   # id de outra empresa
    # excluir: lançamento fica sem classificação; tabela fora da lista é recusada
    run(A, "select excluir_cadastro_aux(%s, 'naturezas', %s)", (oa, str(nd)))
    assert run(A, "select natureza_id from financeiros where id=%s", (str(fd),))[0][0] is None
    falha(A, "select excluir_cadastro_aux(%s, 'vendedores', %s)", "inative", (oa, str(v)))
    falha(A, "select excluir_cadastro_aux(%s, 'centros_resultado', %s)", "não encontrado", (oa, str(cb)))
    # empresa
    falha(A, "select atualizar_empresa(%s, 'Empresa X', '123')", "14 dígitos", (oa,))
    run(A, "select atualizar_empresa(%s, 'Empresa X', '11.222.333/0001-81')", (oa,))
    assert run(A, "select cnpj from orgs where id=%s", (oa,))[0][0] == "11222333000181"
    falha(C, "select atualizar_empresa(%s, 'Empresa Y', null)", "permissão", (oa,))
    # leitura isolada
    assert run(B, "select count(*) from vendedores where org_id=%s", (oa,))[0][0] == 0

@t("excluir conta: apaga empresa e dados (sem travar por FKs) e permite apagar o login")
def _():
    run(B, "select criar_cliente(%s, 'Cliente B', null, null)", (str(orgB),))
    run(B, "select excluir_meus_dados()")
    assert admin("select count(*) from orgs where id=%s", (str(orgB),))[0][0] == 0
    admin("delete from auth.users where id=%s", (str(B),))
    assert admin("select count(*) from clientes where org_id=%s", (str(orgB),))[0][0] == 0
    # A é o único admin e C ainda é membro: a exclusão é recusada (empresa não pode ficar sem admin)
    falha(A, "select excluir_meus_dados()", "único administrador")
    assert admin("select count(*) from orgs where id=%s", (str(orgA),))[0][0] == 1
    admin("delete from org_members where user_id=%s", (str(C),))
    # A (com muitos pedidos/notas/baixas) sozinho: o delete em cascata não pode falhar por FK
    run(A, "select excluir_meus_dados()")
    assert admin("select count(*) from orgs where id=%s", (str(orgA),))[0][0] == 0
    assert admin("select count(*) from pedidos")[0][0] == 0 and admin("select count(*) from financeiro_baixas")[0][0] == 0
    admin("delete from auth.users where id=%s", (str(A),))   # created_by é SET NULL, não bloqueia

print(f"\n{ok} grupos de teste passaram")
