# Diseño — Subasta solidaria del Cementerio del Oeste

Documento de referencia aprobado el 19/10/2026. Resume el modelo de datos, las pantallas
y las decisiones tomadas. Lo que está marcado como **pendiente** no se resuelve en el código:
queda como texto provisorio o como dato configurable desde el panel.

## Stack

- **Next.js 16** (App Router, Cache Components) desplegado en **Vercel**.
- **Supabase**: Postgres (reglas de negocio en la base), Auth (código por correo para
  oferentes, contraseña para el equipo) y Storage (fotos).
- **Acceso a datos por SQL directo** desde el servidor (`postgres` en producción, PGlite en
  desarrollo). Cada consulta corre dentro de una transacción con el rol de Supabase que
  corresponde (`anon` o `authenticated` + `request.jwt.claims`), así que las políticas RLS se
  aplican igual que si se usara la API de Supabase. Ventaja: el mismo SQL se prueba en local
  sin Docker y corre igual en producción.
- **Modo local**: sin variables de Supabase, la app usa PGlite (Postgres embebido) con las
  mismas migraciones, un reemplazo mínimo del esquema `auth` y datos de ejemplo. Los códigos
  de ingreso se muestran en pantalla y los correos se escriben en la consola.
- Correo: Resend o SMTP institucional (pendiente). Exportación: exceljs y @react-pdf/renderer.

## Modelo de datos

| Tabla | Qué guarda |
|---|---|
| `configuracion` | Una fila: inicio y cierre de la etapa virtual, fecha y lugar de la presencial, incremento mínimo, precio de salida por defecto, modo ejemplo. |
| `artistas` | Nombre público, reseña, foto, enlace, marca de ejemplo. |
| `obras` | Número (1–25, va en el QR), título opcional ("Sin título"), artista, reseña, técnica, precio de salida propio (opcional), publicada, marca de ejemplo. |
| `obra_fotos` | Ruta en Storage, texto alternativo, orden (la primera es la portada). |
| `oferentes` | 1:1 con `auth.users`. Nombre, apellido, DNI (único), teléfono, correo, alias numérico ("Oferente 12"), versión de bases aceptada y fechas de aceptación, avisos por correo, bloqueo. |
| `ofertas` | Solo se agregan filas. Monto en pesos enteros, hora del servidor, estado `valida`/`anulada` con fecha, admin y motivo obligatorio. |
| `paginas` | Textos editables (portada, cómo participar, bases, destino, privacidad) con marca de provisorio y versión. |
| `admins` | Usuarios del equipo autorizados para el panel. |
| `avisos_correo` | Cola de avisos "te superaron" (pendiente, enviado, error, descartado), con reserva por plazo para que cada aviso salga una sola vez. |
| `intentos_ingreso` | Registro de pedidos y verificaciones de código y de ingresos al panel, para el límite propio de intentos. Solo la usa el servidor. |
| `auditoria` | Solo se agregan filas. Quién, cuándo, qué tabla y registro. En los cambios se guardan solo las columnas que cambiaron; en `oferentes` no se guardan nombre, apellido, DNI, teléfono ni correo (queda la lista de columnas modificadas). |

Vistas públicas (no exponen datos personales): `v_estado_subasta`, `v_obras_publicas`,
`v_fotos_publicas`, `v_historial_publico`. Vistas del oferente: `v_mis_ofertas` (incluye si la
obra sigue publicada). Vistas del panel: `v_ofertas_admin`, `v_listado_final` (ambas marcan
si quien ofertó está bloqueado).

### Reglas en la base

- `ofertar(obra, monto)` es la única forma de cargar una oferta. Bloquea la fila de la obra,
  compara con `now()` del servidor, exige correo verificado, oferente registrado y no
  bloqueado, monto ≥ actual + incremento (o ≥ precio de salida si no hay ofertas) y que el
  oferente no tenga ya la oferta más alta. Encola el aviso para quien quedó superado.
- `anular_oferta(id, motivo)` solo para el equipo. No borra: cambia el estado.
- Disparadores impiden borrar ofertas o cambiarlas fuera de una anulación, y borrar o cambiar
  la auditoría.
- Todo cambio en configuración, obras, artistas, fotos, textos, oferentes y ofertas queda en
  `auditoria`. Las exportaciones también se registran.
- Horas en `America/Argentina/Tucuman`. Montos en pesos enteros, con un tope de
  $ 1.000.000.000 por oferta.
- Avisos por correo: se reservan de forma atómica antes de enviarse, no salen si la persona
  desactivó los avisos o volvió a tener la oferta más alta, y después del cierre no invitan a
  volver a ofertar. Fuera del modo local, sin proveedor de correo quedan pendientes.
- Parámetros jsonb en SQL: se escriben `$n::text::jsonb` con `JSON.stringify(valor)`. Con
  `$n::jsonb`, postgres.js vuelve a serializar el valor (lo controla `tests/db/driver.test.ts`).

## Pantallas

Sitio público: `/`, `/obras`, `/obras/[numero]`, `/obras/[numero]/ofertar`, `/ingresar`,
`/registro`, `/mis-ofertas`, `/como-participar`, `/bases-y-condiciones`, `/destino`,
`/privacidad`.

Panel: `/admin/ingresar`, `/admin`, `/admin/obras`, `/admin/obras/[id]`,
`/admin/obras/[id]/ofertas`, `/admin/artistas`, `/admin/oferentes`, `/admin/configuracion`,
`/admin/textos`, `/admin/exportar`, `/admin/qr`, `/admin/auditoria`.

## Decisiones tomadas

1. Ingreso sin contraseña: correo → código de 6 dígitos. Ese paso verifica el correo. Si es
   la primera vez, después se completan los datos (nombre, apellido, DNI, teléfono) y se
   aceptan bases y política de privacidad.
2. Quien ya tiene la oferta más alta de una obra no puede volver a ofertar en ella.
3. Si el monto supera 3 veces la oferta actual, la confirmación muestra un aviso extra.
4. El alias "Oferente N" es el mismo en todas las obras. Con la sesión iniciada, las ofertas
   propias dicen "Vos".
5. Las ofertas anuladas no se muestran en el historial público.
6. Una cuenta por DNI y por correo.
7. La ficha se actualiza sola cada 20 segundos. La validación que vale es la del servidor.
8. "Monto acumulado" = suma de la oferta más alta vigente de cada obra.
9. Datos de ejemplo marcados (`es_ejemplo`, franja visible). Producción se crea en un proyecto
   de Supabase nuevo, sin los datos de ejemplo.
10. Contraste: botones en `#126ff5` o `#28469f`; `#2589ea` y `#3cb4f0` solo en fondos,
    degradés o texto grande; verde, ámbar y rojo como fondo de etiqueta con texto en tinta.
    El gris `#6b7885` solo sobre blanco. Los bordes de los campos van en gris (azul con foco,
    rojo con error). Sobre el degradé, el contorno de foco es blanco y los textos van en tamaño
    grande; el hover oscurece con `#0d3fb0`.
11. Un solo rol de administración. Cuentas del equipo creadas a mano.
12. Despublicar una obra la retira de la subasta: no aparece en el sitio ni en el listado del
    martillero (el panel pide confirmación si tiene ofertas y la exportación lo informa). En
    "Mis ofertas" la persona conserva su historial con un aviso neutro.
13. Bloquear a un oferente impide nuevas ofertas, pero no anula las existentes: el listado
    final marca las obras cuya mayor oferta es de una persona bloqueada.
14. Las descargas del listado final (con datos personales) se piden por POST desde el panel y
    se rechazan si no salen del propio sitio. Cada descarga queda en la auditoría.
15. Límite propio de intentos antes de Supabase Auth: pedidos de código por correo y por
    conexión, verificaciones fallidas por correo e ingresos fallidos al panel.
16. Sesión: cookies `httpOnly`, `secure` y `sameSite=lax`, con vida acotada.
17. Hay una página de error dentro de cada layout (sitio, panel y raíz) que conserva la
    identidad y vuelve a pedir los datos al reintentar.
18. La búsqueda de oferentes del panel va por POST: el DNI o el correo buscados no quedan en la
    URL ni en los registros de pedidos.
19. Con la etapa virtual cerrada, cambiar el cierre o desmarcar "fechas confirmadas" pide una
    confirmación extra que explica el efecto (el listado vuelve a PRELIMINAR, deja de verse
    "Pasa a subasta presencial…") y cuántas ofertas quedan después del nuevo cierre. Esas
    ofertas no se anulan.

## Respuestas pendientes (se usan valores por defecto hasta tenerlas)

- Incremento mínimo: monto fijo en pesos (por defecto).
- Precio de salida: uno general con posibilidad de fijarlo por obra (por defecto).
- Cierre único para todas las obras (por defecto).
- Casilla y dominio de correo, dominio del sitio, cuentas y planes de Vercel y Supabase.
- Ingreso con Cidituc (no incluido por ahora).
- Logos institucionales: se usan los de la skill institucional `pdf-institucional-smt`, sin
  modificar, en `public/marca/`. Si los adjuntos son otros, se reemplazan ahí.
- CAPTCHA en el ingreso (recomendado; requiere activarlo en Supabase y un cambio en el código).

## Pendientes que no resuelve la plataforma

Encuadre legal, quién cobra y cómo, si la oferta virtual es vinculante, destino de los
fondos, aval de la Intendenta a los textos, texto final de privacidad (Ley 25.326), quién es
el martillero y en qué condiciones recibe y conserva los datos del listado final, y plazo de
conservación de los datos personales.

La plataforma no permite borrar la auditoría. Si se define un plazo de conservación o alguien
pide la supresión de sus datos, se hace en la base como dueño (SQL Editor de Supabase), dentro
de una transacción: desactivar el disparador `auditoria_inmutable`, hacer el cambio acotado,
volver a activarlo y dejar constancia con un `insert into public.auditoria (actor_tipo,
accion, detalle) values ('sistema', 'supresion_datos', '{"motivo": "..."}')`
(`registrar_evento` exige una sesión del equipo y no funciona desde el SQL Editor). Los registros anteriores a la
migración `20261019140500_auditoria.sql` pueden tener copias completas de datos de oferentes.
