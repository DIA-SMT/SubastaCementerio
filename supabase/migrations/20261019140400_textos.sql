-- Textos provisorios: correcciones de coherencia.
-- Cada texto se cambia solo si sigue igual al original de 20261019120300_contenidos.sql:
-- si el equipo ya lo editó desde el panel, se respeta su versión. Los saltos de línea se
-- comparan y se guardan sin \r, de los dos lados: si alguna de las migraciones se aplica
-- desde una copia con finales CRLF (Windows), la comparación igual coincide. Los
-- disparadores suben la versión y registran el cambio en la auditoría (actor 'sistema').
-- Las páginas siguen marcadas como provisorias.

-- Privacidad: "Quién los ve" nombra también al martillero, que recibe el listado final
-- (antes decía "Solo el equipo", en contradicción con "Para qué se usan").
update public.paginas
set contenido = replace($txt$> **Texto provisorio**, pendiente de revisión por el área legal.

Los datos personales que cargás (nombre, apellido, DNI, teléfono y correo electrónico) se tratan conforme a la Ley 25.326 de Protección de Datos Personales.

## Para qué se usan
- Identificar a quien hace cada oferta.
- Avisarte por correo si alguien supera tu oferta.
- Entregar al martillero el listado final de cada obra, con los datos de quien hizo la oferta más alta.

## Quién los ve
El equipo autorizado de la Dirección de Cementerios. Al cierre de la etapa virtual, el martillero de la subasta presencial recibe el listado final, con los datos de quien hizo la oferta más alta de cada obra. En el sitio público tus ofertas aparecen como "Oferente" seguido de un número. Tu DNI y tus datos de contacto nunca se muestran.

## Pendiente de definir
- Responsable de la base de datos y domicilio.
- Quién es el martillero y en qué condiciones recibe y conserva los datos.
- Plazo de conservación de los datos.
- Cómo ejercer los derechos de acceso, rectificación y supresión.$txt$, E'\r', '')
where slug = 'privacidad'
  and replace(contenido, E'\r', '') = replace($txt$> **Texto provisorio**, pendiente de revisión por el área legal.

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
- Cómo ejercer los derechos de acceso, rectificación y supresión.$txt$, E'\r', '');

-- Cómo participar: describe solo lo que hace la plataforma. "No se puede modificar ni
-- retirar" presuponía que la oferta compromete a quien la hace (si es vinculante está
-- pendiente); ahora dice lo mismo que las bases: no se edita ni se borra desde el sitio.
update public.paginas
set contenido = replace($txt$## 1. Elegí una obra
Recorré el catálogo o escaneá el código QR que está junto a cada obra.

## 2. Ingresá con tu correo
Te mandamos un código de 6 números para confirmar que el correo es tuyo. La primera vez también te pedimos nombre, apellido, DNI y teléfono, y que aceptes las bases y condiciones.

## 3. Ofertá
Tu oferta tiene que superar la oferta actual por lo menos en el incremento mínimo que indica cada obra. Antes de registrarla te pedimos que la confirmes. Una vez confirmada, la oferta queda registrada y no se puede editar ni borrar desde el sitio. Las condiciones de la subasta están en las [bases y condiciones](/bases-y-condiciones).

## 4. Seguí la subasta
Si alguien supera tu oferta, te avisamos por correo. En "Mis ofertas" ves en qué obras tenés la oferta más alta.

## Al cierre de la etapa virtual
La oferta más alta de cada obra pasa a ser el precio base de la subasta presencial, con martillero.

## Pagos
La plataforma no cobra ni procesa pagos. **Pendiente:** cómo y cuándo se paga, a definir por la Dirección de Cementerios.$txt$, E'\r', '')
where slug = 'como-participar'
  and replace(contenido, E'\r', '') = replace($txt$## 1. Elegí una obra
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
La plataforma no cobra ni procesa pagos. **Pendiente:** cómo y cuándo se paga, a definir por la Dirección de Cementerios.$txt$, E'\r', '');
