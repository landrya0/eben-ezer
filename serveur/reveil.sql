-- Ében-Ézer — le réveil (13.ey)
-- Une ligne par appareil, et trois colonnes. C'est tout ce que le serveur
-- sait du réveil : une adresse opaque, à qui elle appartient, et l'heure à
-- laquelle il faut taper sur l'épaule. Pas l'activité, pas le seuil, pas la
-- durée — il n'y a donc rien à chiffrer, parce qu'il n'y a rien (13.bh).
-- Ce bloc est aussi dans l'application, écran Synchronisation, étape 1 :
-- qui règle son propre projet l'exécute avec le reste.

create table if not exists reveils (
  abo   text primary key,
  uid   uuid not null references auth.users on delete cascade,
  quand timestamptz
);
alter table reveils enable row level security;
create policy "le mien" on reveils for all
  using (auth.uid() = uid) with check (auth.uid() = uid);

-- Et l'horloge. Toutes les cinq minutes : c'est la précision du réveil, et
-- elle suffit — on prévient d'une dérive de plusieurs heures, pas d'un
-- rendez-vous. Remplace <PROJET> et <CLÉ SERVICE_ROLE> par les tiens ; cette
-- clé reste dans ta base et ne sort pas d'ici.
-- create extension if not exists pg_cron;
-- create extension if not exists pg_net;
-- select cron.schedule('reveil', '*/5 * * * *', $$
--   select net.http_post(
--     url     := 'https://<PROJET>.supabase.co/functions/v1/reveil',
--     headers := '{"Authorization": "Bearer <CLÉ SERVICE_ROLE>", "Content-Type": "application/json"}'::jsonb
--   )
-- $$);
