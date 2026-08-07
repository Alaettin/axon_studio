-- Der Editor hat am 07.08.2026 die Adresse `axon-studio.sliplane.app` an den Hub
-- abgegeben und heisst jetzt **AXON Editor** unter `axon-editor.sliplane.app`.
--
-- Ohne diese Zeile zeigte seine Kachel auf den Hub selbst: ein Klick landete wieder auf
-- der Buehne, von der man gerade kam. Im Browsertest sofort aufgefallen, in keiner
-- Pruefung vorher, weil die Adresse bis eben richtig war.
--
-- Die Kennung `aas-editor` bleibt: an ihr haengen die Freischaltungen in
-- `user_tool_access`, und ein Umbenennen der Kennung waere ein Datenumzug ohne Gewinn.
-- Das Kuerzel bleibt ebenfalls `AAS`: es sagt, **was** das Werkzeug bearbeitet, und
-- genau das will man auf einer Kachel wissen. Den Markennamen traegt der Name.
update public.hub_apps
   set name = 'AXON Editor',
       url  = 'https://axon-editor.sliplane.app'
 where id = 'aas-editor';
