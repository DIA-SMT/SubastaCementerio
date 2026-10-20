-- Auditoría con datos mínimos (Ley 25.326).
--
-- El registro de auditoría no se puede modificar ni borrar, así que no conviene copiar ahí
-- datos personales: cuando se defina el plazo de conservación o alguien pida la supresión de
-- sus datos, esas copias no se podrían eliminar desde la plataforma.
--
--  - En un cambio (UPDATE) se guardan solo las columnas que cambiaron, sin las fechas de
--    actualización automática. Se agrega obra_id cuando la tabla lo tiene (ofertas, fotos),
--    para saber de qué obra se trata. Un cambio que no cambia nada no copia la fila.
--  - En oferentes no se guardan nombre, apellido, DNI, teléfono ni correo, ni en altas, ni en
--    bajas, ni en cambios. En los cambios, "detalle" lleva la lista de columnas que cambiaron
--    ({"campos": ["telefono"]}), así queda constancia de que el dato se modificó, sin el valor.
--
-- Los registros anteriores a esta migración quedan como estaban.

create or replace function public.registrar_cambio() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_antes jsonb := case when tg_op in ('UPDATE', 'DELETE') then to_jsonb(old) end;
  v_despues jsonb := case when tg_op in ('INSERT', 'UPDATE') then to_jsonb(new) end;
  -- El id del registro sale siempre de la fila completa.
  v_fila jsonb := coalesce(v_despues, v_antes);
  v_accion text := case
    when tg_table_name = 'ofertas' and tg_op = 'UPDATE' then 'anular'
    else lower(tg_op)
  end;
  v_personales text[] := case
    when tg_table_name = 'oferentes' then array['nombre', 'apellido', 'dni', 'telefono', 'email']
    else array[]::text[]
  end;
  v_campos text[];
  v_detalle jsonb;
begin
  if tg_op = 'UPDATE' then
    select coalesce(array_agg(d.key order by d.key), array[]::text[])
      into v_campos
    from jsonb_each(v_despues) d
    where d.key not in ('actualizado_at', 'actualizada_at')
      and d.value is distinct from v_antes -> d.key;

    select coalesce(jsonb_object_agg(a.key, a.value), '{}'::jsonb)
      into v_antes
    from jsonb_each(v_antes) a
    where (a.key = any (v_campos) or a.key = 'obra_id')
      and a.key <> all (v_personales);

    select coalesce(jsonb_object_agg(d.key, d.value), '{}'::jsonb)
      into v_despues
    from jsonb_each(v_despues) d
    where (d.key = any (v_campos) or d.key = 'obra_id')
      and d.key <> all (v_personales);

    if tg_table_name = 'oferentes' then
      v_detalle := jsonb_build_object('campos', to_jsonb(v_campos));
    end if;
  else
    v_antes := v_antes - v_personales;
    v_despues := v_despues - v_personales;
  end if;

  insert into public.auditoria (actor_id, actor_tipo, accion, tabla, registro_id, antes, despues, detalle)
  values (
    auth.uid(),
    public.tipo_actor(),
    v_accion,
    tg_table_name,
    coalesce(v_fila ->> 'id', v_fila ->> 'slug', v_fila ->> 'user_id'),
    v_antes,
    v_despues,
    v_detalle
  );
  return null;
end $$;
