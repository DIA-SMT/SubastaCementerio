-- Valores iniciales. Todo se edita desde el panel.

-- Fechas provisorias: el sitio no acepta ofertas hasta que el equipo las confirme.
insert into public.configuracion (
  id, inicio_virtual, cierre_virtual, fechas_confirmadas,
  incremento_minimo, precio_salida, modo_ejemplo
) values (
  1, '2026-11-01 20:00:00-03', '2026-11-15 20:00:00-03', false,
  5000, 10000, false
);

-- Textos PROVISORIOS. No definen condiciones legales ni el destino de los fondos:
-- esos contenidos los redacta y aprueba la Dirección de Cementerios.
insert into public.paginas (slug, titulo, contenido, provisorio) values
(
  'portada',
  'Subasta solidaria del Cementerio del Oeste',
  $txt$La Dirección de Cementerios, junto con la Facultad de Artes, entregó 25 cabezas escultóricas a 25 artistas locales, que las intervinieron sin cobrar. Las obras se exhiben sobre el camino principal del Cementerio del Oeste desde la Noche de los Museos.

Mientras dura la exhibición podés ofertar por cada obra desde este sitio. La oferta más alta de cada obra será el precio base de la subasta presencial, con martillero.

Lo recaudado tendrá un destino solidario.$txt$,
  true
),
(
  'como-participar',
  'Cómo participar',
  $txt$## 1. Elegí una obra
Recorré el catálogo o escaneá el código QR que está junto a cada obra.

## 2. Ingresá con tu correo
Te mandamos un código de 6 números para confirmar que el correo es tuyo. La primera vez también te pedimos nombre, apellido, DNI y teléfono, y que aceptes las bases y condiciones.

## 3. Ofertá
Tu oferta tiene que superar la oferta actual por lo menos en el incremento mínimo que indica cada obra. Antes de registrarla te pedimos que la confirmes. Una vez registrada, no se puede modificar ni retirar.

## 4. Seguí la subasta
Si alguien supera tu oferta, te avisamos por correo. En "Mis ofertas" ves en qué obras tenés la oferta más alta.

## Al cierre de la etapa virtual
La oferta más alta de cada obra pasa a ser el precio base de la subasta presencial, con martillero.

## Pagos
La plataforma no cobra ni procesa pagos. **Pendiente:** cómo y cuándo se paga, a definir por la Dirección de Cementerios.$txt$,
  true
),
(
  'bases-y-condiciones',
  'Bases y condiciones',
  $txt$> **Texto pendiente.** Las bases y condiciones las redactan y aprueban la Dirección de Cementerios y el área legal de la Municipalidad. Este sitio no define condiciones legales.

## Puntos a definir
- Encuadre legal de la subasta.
- Si la oferta virtual es vinculante.
- Quién cobra, cómo y en qué plazo.
- Requisitos para participar en la subasta presencial.
- Destino de lo recaudado.

## Cómo funciona la plataforma
- Registra ofertas entre la fecha de inicio y la de cierre publicadas en el sitio. La hora de cierre la controla el servidor.
- Cada oferta tiene que superar la anterior por lo menos en el incremento mínimo.
- Las ofertas no se pueden editar ni borrar. La Dirección puede anular una oferta indicando el motivo, y la anulación queda registrada.
- La plataforma no cobra ni procesa pagos.$txt$,
  true
),
(
  'destino',
  'Destino de lo recaudado',
  $txt$Lo recaudado tendrá un destino solidario.

**El destino todavía no está definido.** Cuando la Dirección de Cementerios lo confirme, lo vas a encontrar en esta página.$txt$,
  true
),
(
  'privacidad',
  'Política de privacidad',
  $txt$> **Texto provisorio**, pendiente de revisión por el área legal.

Los datos personales que cargás (nombre, apellido, DNI, teléfono y correo electrónico) se tratan conforme a la Ley 25.326 de Protección de Datos Personales.

## Para qué se usan
- Identificar a quien hace cada oferta.
- Avisarte por correo si alguien supera tu oferta.
- Entregar al martillero el listado final de cada obra, con los datos de quien hizo la oferta más alta.

## Quién los ve
Solo el equipo autorizado de la Dirección de Cementerios. En el sitio público tus ofertas aparecen como "Oferente" seguido de un número. Tu DNI y tus datos de contacto nunca se muestran.

## Pendiente de definir
- Responsable de la base de datos y domicilio.
- Plazo de conservación de los datos.
- Cómo ejercer los derechos de acceso, rectificación y supresión.$txt$,
  true
);

-- Fotos de las obras: bucket público de lectura; solo el equipo sube y borra.
insert into storage.buckets (id, name, public)
values ('obras', 'obras', true)
on conflict (id) do nothing;

create policy obras_fotos_admin_alta on storage.objects
  for insert to authenticated
  with check (bucket_id = 'obras' and public.es_admin());
create policy obras_fotos_admin_cambio on storage.objects
  for update to authenticated
  using (bucket_id = 'obras' and public.es_admin());
create policy obras_fotos_admin_baja on storage.objects
  for delete to authenticated
  using (bucket_id = 'obras' and public.es_admin());
