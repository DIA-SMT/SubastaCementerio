# Subasta solidaria — Cementerio del Oeste

Plataforma de la etapa virtual de la subasta solidaria de las 25 cabezas escultóricas.
Municipalidad de San Miguel de Tucumán · Dirección de Cementerios. Desarrollado por la
Dirección de Inteligencia Artificial.

- **Sitio público**: portada, catálogo, ficha de cada obra (con su URL y su QR), ingreso con
  código por correo, registro de oferentes, ofertas con confirmación y "Mis ofertas".
- **Panel del equipo** (`/admin`): obras, artistas y fotos, configuración de fechas e
  incremento, textos, ofertas con datos de contacto y anulación con motivo, oferentes,
  listado final para el martillero (Excel y PDF), carteles QR, indicadores y auditoría.
- **La plataforma no cobra ni procesa pagos.**

El diseño aprobado (modelo de datos, pantallas y decisiones) está en [docs/diseno.md](docs/diseno.md).

---

## 1. Probarlo en la computadora (modo local)

Requisitos: Node.js 22 o posterior. No hace falta Docker ni una cuenta de Supabase.

```bash
npm install
npm run dev
```

Abrí <http://localhost:3000>. Sin variables de entorno, la app arranca en **modo local**:

- Crea una base Postgres embebida (PGlite) en `.local/pgdata` con las mismas migraciones de
  `supabase/migrations/` y carga los **datos de ejemplo** (`supabase/seed.sql`).
- El código de ingreso se muestra en pantalla; los avisos por correo se escriben en la consola.
- Las fotos que se suben desde el panel se guardan en `.local/subidas/`.
- El usuario de prueba del panel (`/admin`) está en `supabase/local/seed-local.sql`.

Las migraciones nuevas se aplican al iniciar el servidor: después de actualizar el código,
reiniciá `npm run dev`. Para volver a empezar con los datos de ejemplo:

```bash
npm run db:local:reiniciar
```

## 2. Pruebas

```bash
npm test
```

Prueban, sobre PGlite con las migraciones reales: el cierre controlado por el servidor, el
incremento mínimo, que las ofertas no se editan ni se borran, la anulación con motivo, la
auditoría, los permisos (RLS), que el sitio público no expone datos personales, los avisos por
correo, los límites de intentos de ingreso, la exportación (Excel y PDF) y el comportamiento del
driver de producción (postgres.js) con parámetros JSON.

Antes de desplegar conviene correr también:

```bash
npm run typecheck
```

```bash
npm run lint
```

```bash
npm run build
```

---

## 3. Puesta en producción (Supabase + Vercel)

### 3.1 Cuentas y planes

| Servicio | Plan recomendado | Por qué |
|---|---|---|
| Supabase | Pro | El plan gratuito pausa el proyecto si no se usa y no hace copias de seguridad automáticas. |
| Vercel | Pro | El plan Hobby es solo para uso personal y no permite el cron cada 10 minutos de los avisos (el despliegue falla con un cron más frecuente que diario). |

Conviene crear ambos proyectos cerca del público: Supabase en **South America (São Paulo)** y,
en Vercel (Pro), la región de las funciones en **São Paulo (gru1)**
(Project Settings > Functions > Function Region).

### 3.2 Base de datos

1. Creá el proyecto en Supabase.
2. Aplicá **todas** las migraciones de `supabase/migrations/`, **en orden de nombre**, desde el
   SQL Editor (pegando cada archivo) o con la CLI de Supabase:

   ```bash
   npx supabase link --project-ref <ref>
   ```

   ```bash
   npx supabase db push
   ```

   Sin la CLI, con `DATABASE_URL` en `.env.local`, este comando aplica las que falten y las
   registra en la misma tabla que usa la CLI (`--ver` solo las lista):

   ```bash
   npm run db:migrar
   ```

3. **No** cargues `supabase/seed.sql` ni `supabase/local/*`: son datos de ejemplo y el
   reemplazo de Supabase para el modo local.
4. **Orden en cada actualización**: primero las migraciones nuevas, después el código. Sin las
   funciones nuevas (por ejemplo, las de límites de ingreso), el ingreso falla.
5. Verificá en Storage que exista el bucket público `obras` (lo crea la migración de contenidos).
6. Cifrado: la app siempre conecta con TLS. Bajá el certificado raíz (Project Settings >
   Database > SSL Configuration > Download certificate) y cargalo en `SUPABASE_CA_CERT` para que
   además verifique el servidor. Probá que el sitio conecta con esa variable antes de seguir: si
   falla, quitala (la conexión queda cifrada, sin verificar el certificado). Una vez desplegada
   la app y comprobada la conexión, activá **Enforce SSL on incoming connections** en esa misma
   pantalla.

### 3.3 Configurar Supabase Auth (códigos de ingreso)

Los códigos de 6 números que reciben las personas los envía **Supabase Auth**, no la app.
Sin estos pasos, el ingreso del público no funciona.

1. **Authentication > Providers > Email**: activo, con **Confirm email** activado (sin eso,
   cualquier correo contaría como verificado y la regla "una oferta solo cuenta si el oferente
   verificó su correo" se rompe). **Email OTP Length: 6**. **Email OTP Expiration**: 600
   segundos (10 minutos); nunca más de una hora, porque la app deja de aceptar códigos pedidos
   hace más de una hora. Supabase espera unos 60 segundos entre dos correos a la misma persona:
   un reenvío más rápido muestra "Se mandaron muchos códigos…".
2. **Authentication > Email Templates**: en **Confirm signup** (primer ingreso) y en
   **Magic Link** (ingresos siguientes) el correo tiene que mostrar el código `{{ .Token }}` y
   **no** un enlace (la app no procesa enlaces). Por ejemplo:

   - Asunto: `Tu código para la subasta solidaria`
   - Cuerpo:

     ```html
     <p>Hola:</p>
     <p>Tu código para ingresar a la subasta solidaria del Cementerio del Oeste es:</p>
     <p style="font-size:28px;font-weight:bold;letter-spacing:6px">{{ .Token }}</p>
     <p>Escribilo en la pantalla donde lo pediste. Vence en 10 minutos.</p>
     <p>Si no lo pediste, ignorá este correo.</p>
     <p>Municipalidad de San Miguel de Tucumán · Dirección de Cementerios</p>
     ```

3. **Authentication > SMTP Settings**: configurá un SMTP propio, con remitente institucional:
   la casilla institucional o Resend (host `smtp.resend.com`, usuario `resend`, la clave de API
   como contraseña). El servicio de correo que trae Supabase solo entrega a las direcciones del
   equipo del proyecto (`email_address_not_authorized`) y con un límite muy bajo: con él, los
   códigos no le llegan al público.
4. **Authentication > Rate Limits**: subí los cupos según el público esperado en la Noche de
   los Museos: envío de correos (con SMTP propio, 30 por hora para todo el proyecto por
   defecto), "Sign-ups and sign-ins", "Token verifications" y "Token refreshes". Los tres
   últimos se cuentan por IP, y todas las personas llegan desde la IP de salida de Vercel: con
   los valores por defecto, en un pico aparecen errores de "demasiados intentos".
   Opcional, más fino: activar **Sb-Forwarded-For** para que Supabase limite por persona. Hoy la
   app no manda ese encabezado; requiere una clave secreta de Supabase y un cambio en
   `src/lib/auth/supabase.ts` y `src/proxy.ts`.
5. **Authentication > URL Configuration**: Site URL con la dirección pública del sitio (la
   misma de `NEXT_PUBLIC_URL_SITIO`).
6. Recomendado: **CAPTCHA** (Authentication > Attack Protection, Cloudflare Turnstile).
   **No lo actives todavía**: la app no manda el token del CAPTCHA y activarlo corta todos los
   ingresos. Requiere un cambio en el código (`src/lib/auth/supabase.ts` y los formularios).
7. Opcional (plan Pro): "Time-box user sessions" o "Inactivity timeout", como complemento de
   las cookies de sesión, que duran 7 días.
8. Antes de abrir, probá el ingreso con correos personales de fuera del equipo (Gmail, Outlook).

**Límites propios de la app** (además de los de Supabase): 3 códigos por correo cada
15 minutos; 20 pedidos de código por conexión por hora; 5 pruebas por cada código pedido; en
el panel, 5 intentos en 15 minutos por correo o por conexión. En el registro, desde el tercer
intento con un DNI que ya está registrado, esa cuenta no puede seguir intentando. Los rechazos
por DNI quedan en la auditoría con el DNI enmascarado ("Intento con un DNI ya registrado"):
sirven para atender a quien avisa que su DNI ya figura.

### 3.4 Cuentas del equipo (panel)

1. Supabase > Authentication > Users > **Add user** > con correo y contraseña, marcando
   **Auto Confirm User**.
2. Copiá el UUID del usuario y, en el SQL Editor:

   ```sql
   insert into public.admins (user_id, nombre) values ('<uuid>', 'Nombre y apellido');
   ```

   Para quitar el acceso: `update public.admins set activo = false where user_id = '<uuid>';`

### 3.5 Vercel

1. Importá el repositorio en Vercel (framework: Next.js; no hace falta cambiar los comandos).
2. Cargá las variables de entorno (Settings > Environment Variables, Production). Están
   explicadas en [.env.example](.env.example):

   | Variable | Obligatoria | Para qué |
   |---|---|---|
   | `DATABASE_URL` | Sí | Conexión al pooler de Supabase en modo transacción (puerto 6543). |
   | `NEXT_PUBLIC_SUPABASE_URL` | Sí | URL del proyecto de Supabase. |
   | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Sí | Clave pública (anon) del proyecto. |
   | `NEXT_PUBLIC_URL_SITIO` | Sí | Dirección pública del sitio (correos y QR). |
   | `RESEND_API_KEY` y `CORREO_REMITENTE` | Para los avisos | Avisos "te superaron". Sin ellas quedan pendientes. |
   | `CRON_SECRET` | Para los avisos | Protege `/api/avisos`, que reintenta los avisos cada 10 minutos. |
   | `SUPABASE_CA_CERT` | Recomendada | Verifica el certificado de la base. |

   Las variables que empiezan con `NEXT_PUBLIC_` quedan fijas al compilar: cargalas antes del
   primer despliegue y, si cambian, volvé a desplegar. `CRON_SECRET` se carga sin espacios ni
   saltos de línea (se compara el valor exacto).
3. Dominio: configurá el dominio del sitio en Vercel. Para el remitente de los correos, el área
   que administra el DNS tiene que cargar los registros SPF y DKIM que indique el proveedor
   (Resend o el SMTP institucional); sin ellos, los correos caen en spam. En Resend, el dominio
   remitente tiene que figurar como verificado.
4. Desplegá. Si falta configuración del correo, del cron o de la URL del sitio, la app lo
   advierte en los registros y en el tablero del panel. Los avisos que hayan quedado pendientes
   salen solos cuando se completa la configuración (con la próxima oferta o la próxima corrida
   del cron).
5. **Con el plan Hobby de Vercel** (solo admite crons diarios), hay dos opciones: cambiar en
   `vercel.json` la frecuencia a una diaria (`"0 3 * * *"`), o programar el llamado desde
   Supabase con `pg_cron` + `pg_net` a `https://<sitio>/api/avisos` con el encabezado
   `Authorization: Bearer <CRON_SECRET>` (guardado en Vault). Cada oferta aceptada ya dispara el
   envío de la cola; el cron solo reintenta los que fallaron.

---

## 4. Carga de las obras reales

Todo se hace desde el panel (`/admin`), con una cuenta del equipo.

1. **Configuración**: cargá las fechas de inicio y cierre de la etapa virtual (hora de
   Tucumán), la fecha de la subasta presencial, el incremento mínimo y el precio de salida.
   Dejá **"Las fechas están confirmadas"** sin marcar hasta que todo esté listo: mientras tanto,
   el sitio muestra "Fechas a confirmar" y no acepta ofertas. Desmarcá **modo ejemplo**.
2. **Artistas**: cargá cada artista con su nombre, una reseña breve y, si querés, una foto y un
   enlace.
3. **Obras**: por cada obra, el número (es el que va en el cartel y en la URL `/obras/N`), el
   título (si no tiene, queda "Sin título"), el artista, la reseña y la técnica. Al crearla,
   cargá las **fotos**: la primera es la portada. El navegador las achica antes de subirlas y el
   servidor les quita los datos de ubicación. Escribí un **texto alternativo** para cada una
   (lo leen las personas que usan lector de pantalla). Marcá **Publicada** cuando esté completa.
4. **Textos**: revisá los textos de la portada, "Cómo participar", "Bases y condiciones",
   "Destino de lo recaudado" y "Privacidad". Hoy son **provisorios** y lo dicen en el sitio:
   las bases, el destino y la política de privacidad tienen que redactarlos y aprobarlos la
   Dirección de Cementerios y el área legal. Cuando un texto esté aprobado, desmarcá "Texto
   provisorio".
5. **Carteles QR**: con `NEXT_PUBLIC_URL_SITIO` ya configurada, descargá el PDF con un cartel
   por obra y probá escanear uno impreso con el celular.
6. Cuando todo esté listo, volvé a **Configuración** y marcá **"Las fechas están confirmadas"**.

## 5. Durante y después de la etapa virtual

- **Tablero**: ofertas, oferentes, monto acumulado y estado de los avisos por correo.
- **Anular una oferta** (por ejemplo, una carga por error): desde las ofertas de la obra, con
  motivo obligatorio. La oferta no se borra: queda registrada como anulada y, si era la más
  alta, pasa a valer la siguiente.
- **Bloquear un oferente** impide que haga nuevas ofertas, pero no anula las que ya hizo: si
  tenía la oferta más alta, el listado final lo marca para que el equipo la revise. Los motivos
  de bloqueo y de anulación quedan en la auditoría, que no se puede borrar: no escribas datos
  personales en ellos.
- **Cierre**: lo controla el servidor; pasada la hora, no se aceptan ofertas. Cada obra muestra
  "Pasa a subasta presencial con base de $ X".
- **Listado final**: desde "Listado final", descargá la planilla o el PDF. Antes del cierre salen
  marcados como **PRELIMINAR**. Contienen DNI y datos de contacto: compartilos solo con el
  martillero (Ley 25.326). Cada descarga queda registrada en la auditoría.

## 6. Estructura

| Carpeta | Qué hay |
|---|---|
| `supabase/migrations/` | Esquema, reglas de negocio, permisos (RLS), textos provisorios y ajustes. |
| `supabase/seed.sql` | Datos de ejemplo. **No cargar en producción.** |
| `supabase/local/` | Reemplazo mínimo de Supabase para el modo local y las pruebas. |
| `src/lib/db/` | Acceso a datos: cada consulta corre con el rol de Supabase que corresponde. |
| `src/lib/auth/` | Ingreso con código por correo (Supabase Auth o modo local) y límites de intentos. |
| `src/lib/datos/` | Consultas del sitio público, del oferente y del panel. |
| `src/lib/exportacion/` | Planilla Excel, PDF del listado y carteles QR. |
| `src/app/(publico)/` | Pantallas del sitio público. |
| `src/app/admin/` | Panel del equipo. |
| `public/marca/` | Logos institucionales, sin modificar. |
| `tests/` | Pruebas automáticas. |

## 7. Pendientes que no resuelve la plataforma

Encuadre legal de la subasta, quién cobra y cómo, si la oferta virtual es vinculante, destino
de los fondos, aval de la Intendenta a los textos, texto final de privacidad (Ley 25.326),
quién es el martillero y en qué condiciones recibe y conserva los datos del listado final, y
plazo de conservación de los datos personales. Están como textos provisorios editables desde el
panel.
