-- Comissão por vendedor, em pontos-base (250 = 2,5%). Só admin grava, como o resto dos cadastros auxiliares.
alter table vendedores add column comissao_bps integer not null default 0 check (comissao_bps between 0 and 10000);

-- A assinatura muda (novo parâmetro), então a função antiga sai e a nova entra com as mesmas permissões.
drop function if exists salvar_vendedor(uuid, uuid, text, boolean);
create or replace function salvar_vendedor(p_org uuid, p_id uuid, p_nome text, p_ativo boolean, p_comissao_bps integer default null) returns vendedores
language plpgsql security definer set search_path = public as $$
declare v vendedores; n text := _nome_ok(p_nome);
begin
  perform _exige_papel(p_org, array['admin']);
  if p_comissao_bps is not null and (p_comissao_bps < 0 or p_comissao_bps > 10000) then raise exception 'Comissão deve ficar entre 0%% e 100%%.'; end if;
  if exists (select 1 from vendedores where org_id = p_org and lower(nome) = lower(n) and id is distinct from p_id) then raise exception 'Já existe um vendedor com este nome.'; end if;
  if p_id is null then insert into vendedores (org_id, nome, ativo, comissao_bps) values (p_org, n, coalesce(p_ativo, true), coalesce(p_comissao_bps, 0)) returning * into v;
  else update vendedores set nome = n, ativo = coalesce(p_ativo, ativo), comissao_bps = coalesce(p_comissao_bps, comissao_bps), updated_at = now() where id = p_id and org_id = p_org returning * into v;
    if not found then raise exception 'Vendedor não encontrado.'; end if;
  end if;
  return v;
end $$;

revoke execute on function salvar_vendedor(uuid, uuid, text, boolean, integer) from public, anon;
grant execute on function salvar_vendedor(uuid, uuid, text, boolean, integer) to authenticated;
