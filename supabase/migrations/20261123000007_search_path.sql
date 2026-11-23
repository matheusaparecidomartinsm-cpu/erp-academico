-- Fixa o search_path das três funções que o verificador de segurança do Supabase apontou como mutável.
alter function aplica_movimento() set search_path = public;
alter function _hoje() set search_path = public;
alter function _nome_ok(text) set search_path = public;
