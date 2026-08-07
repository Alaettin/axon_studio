-- Der AXON Editor hat bereits zwei OAuth-Clients, angelegt am 07.08.2026 ueber die Edge
-- Function. Sie wandern in `hub_app_clients`, damit die Zustimmungsseite sie nach der
-- Umstellung noch findet.
insert into public.hub_app_clients (app_id, umgebung, oauth_client_id, redirect_uri) values
  ('aas-editor', 'produktion', '352122ca-57bc-46f7-97c5-0dc216cef6e9',
   'https://axon-editor.sliplane.app/api/auth/callback'),
  ('aas-editor', 'lokal', '67cc0556-76a5-497a-959e-59786205c84f',
   'http://localhost:5273/api/auth/callback')
on conflict (app_id, umgebung) do update set
  oauth_client_id = excluded.oauth_client_id,
  redirect_uri = excluded.redirect_uri;

update public.hub_apps
   set basis_adresse = 'https://axon-editor.sliplane.app',
       gesundheitspfad = '/api/health',
       scopes = array['openid', 'email', 'profile'],
       status = 'aktiv'
 where id = 'aas-editor';
