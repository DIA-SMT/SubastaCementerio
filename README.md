# Subasta solidaria — Cementerio del Oeste

Plataforma de la etapa virtual de la subasta solidaria de las 24 cabezas escultóricas de la muestra "Memorias del futuro".
Municipalidad de San Miguel de Tucumán · Dirección de Cementerios. Desarrollado por la
Dirección de Inteligencia Artificial.

- **Sitio público**: portada, catálogo, ficha de cada obra (con su URL y su QR), ingreso con
  Ciudadano Digital (Cidituc), registro de oferentes, ofertas con confirmación y "Mis ofertas".
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
- Los avisos por correo se escriben en la consola.
- Los oferentes ingresan con Cidituc también en local: hace falta el login de Ciudad Digital
  corriendo en la computadora (ver 3.3, "Probarlo en local"). Sin las variables `CIDITUC_*`, `/ingresar` avisa
  que el ingreso no está habilitado.
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
| Vercel | Pro (recomendado) | El plan Hobby es solo para uso personal y admite crons diarios: con Hobby, el reintento de avisos corre una vez por día (ver el paso 5 del despliegue). |

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

### 3.3 Ingreso de oferentes con Cidituc (Ciudadano Digital)

Los oferentes ingresan con su cuenta de **Ciudadano Digital (Cidituc)**: la app nunca ve su
contraseña. Se usa el login de Ciudad Digital (repo `cidituc`), no el derivador
(`cidituc.smt.gob.ar`), que el equipo de Cidituc da de baja:

1. "Ingresar con Ciudadano Digital" lleva a `/auth/cidituc/inicio`, que guarda un nonce en una
   cookie de 10 minutos y redirige al login
   (`https://ciudaddigital.smt.gob.ar/#/login?next=subasta-cementerio&state=…`).
2. La persona se autentica en Cidituc (o crea su cuenta ahí). Si ya había entrado antes en ese
   navegador, el login la devuelve sin pedirle la contraseña: guarda el token y no lo borra.
3. El login vuelve a `/auth/cidituc/callback?auth=<token>&state=…`. Sin la cookie del paso 1 el
   ingreso se rechaza (nadie puede empujar un token ajeno con un enlace). La app valida el token
   con `GET /usuarios/authStatus` contra el backend municipal (token crudo, sin `Bearer`,
   aportando el certificado intermedio de Sectigo que ese servidor no manda: sin él, en Vercel el
   ingreso falla con `UNABLE_TO_VERIFY_LEAF_SIGNATURE` aunque desde Windows ande).
4. Guarda a la persona en `public.personas` (id de Cidituc, CUIL, DNI, nombre, apellido y
   correo) y abre **su propia sesión**: una cookie firmada con `SESSION_SECRET`, de 7 días. El
   token de Cidituc no se guarda.
5. La primera vez, `/registro` muestra nombre y DNI (vienen de Cidituc, no se editan) y pide
   teléfono, correo de contacto y aceptar bases y privacidad.

Como el login guarda el token, "Cerrar sesión" en "Mis ofertas" cierra también la sesión de
Ciudad Digital (`?logout=1`) y vuelve al inicio de la subasta (`salir=1`, que el login atiende
para la clave `subasta-cementerio`): si no, en una computadora compartida la próxima persona
entraría como la anterior. Por lo mismo, si Cidituc rechaza un token vencido, el botón para
reintentar lo borra antes.

El código está en `src/lib/auth/cidituc/` y `src/app/auth/cidituc/`. El panel no cambia: el
equipo sigue entrando con correo y contraseña (Supabase Auth, 3.4).

**Variables** (en Vercel y, para probar, en `.env.local`):

| Variable | Valor |
|---|---|
| `CIDITUC_HABILITADO` | `1` para mostrar el botón. Prenderla recién cuando el login desplegado tenga la clave de la subasta. |
| `CIDITUC_LOGIN_URL` | `https://ciudaddigital.smt.gob.ar` (el origen solo: el `#/login` lo agrega la app). |
| `CIDITUC_API_URL` | `https://estadisticas.smt.gob.ar:5000` |
| `CIDITUC_CALLBACK_URL` | `https://<sitio>/auth/cidituc/callback`, la misma anotada en el login. |
| `SESSION_SECRET` | Cadena aleatoria de 32 caracteres o más. Sin ella, en producción no se abren sesiones de oferentes. |
| `CIDITUC_CLAVE_APP` | Opcional. Por defecto `subasta-cementerio`. |
| `CIDITUC_CA_PEM` | Opcional. Reemplaza el certificado intermedio embebido sin redesplegar. |

**Alta en el login.** El login solo devuelve a las aplicaciones que tiene anotadas en
`src/routes/PrivateRoute.jsx` del repo `cidituc` (una rama `else if` por clave). La subasta está
anotada como `subasta-cementerio` → `https://subasta-cementerio.vercel.app/auth/cidituc/callback`.
El cambio va por PR a `master` y lo despliega el equipo de Cidituc. Anotarla ahí no la muestra en
ningún listado del portal. Si el sitio cambia de dominio, esa entrada se cambia **en el mismo
despliegue**: con el dominio viejo, el primer intento de ingresar falla ("la solicitud venció") y
el segundo entra en el sitio equivocado. Antes de prender `CIDITUC_HABILITADO`, comprobá el
bundle desplegado (no el repo):

```bash
curl -s https://ciudaddigital.smt.gob.ar/ | grep -oE '/assets/index-[^"]+\.js'
```

y buscá `subasta-cementerio` adentro de ese `.js`.

**Probarlo en local.** El login desplegado no vuelve a `localhost`: hay que correr el repo
`cidituc` en la computadora (en otro puerto, por ejemplo `npm run dev -- --port 5175`) con
`VITE_APP_RUTA_BACK=https://estadisticas.smt.gob.ar:5000` y
`VITE_APP_SUBASTA_CEMENTERIO_CALLBACK_URL=http://localhost:3000/auth/cidituc/callback`, y en el
`.env.local` de la subasta `CIDITUC_LOGIN_URL=http://localhost:5175`.
El ingreso valida contra el backend real, así que hace falta una cuenta de Cidituc.

**Límites propios de la app.** En el panel, 5 intentos de contraseña en 15 minutos por correo o
por conexión. En el registro, desde el tercer intento con un DNI que ya está registrado, esa
cuenta no puede seguir intentando. Los rechazos por DNI quedan en la auditoría con el DNI
enmascarado ("Intento con un DNI ya registrado"): sirven para atender a quien avisa que su DNI
ya figura.

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
   | `CRON_SECRET` | Para los avisos | Protege `/api/avisos`, que reintenta los avisos que fallaron (una vez por día con el plan Hobby). |
   | `SUPABASE_CA_CERT` | Recomendada | Verifica el certificado de la base. |
   | `SESSION_SECRET` | Sí | Firma las sesiones de los oferentes (32 caracteres o más). |
   | `CIDITUC_HABILITADO`, `CIDITUC_LOGIN_URL`, `CIDITUC_API_URL`, `CIDITUC_CALLBACK_URL` | Sí | Ingreso de oferentes con Cidituc (ver 3.3). |

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
5. **Cron y plan de Vercel.** `vercel.json` trae el reintento una vez por día (`"0 11 * * *"`,
   las 8 de Tucumán), lo único que admite el plan Hobby: un cron más frecuente hace fallar el
   despliegue. Cada oferta aceptada ya dispara el envío de la cola; el cron solo reintenta los
   que fallaron. Con el plan Pro se puede volver a `"*/10 * * * *"`, o programar el llamado
   desde Supabase con `pg_cron` + `pg_net` a `https://<sitio>/api/avisos` con el encabezado
   `Authorization: Bearer <CRON_SECRET>` (guardado en Vault).

---

## 4. Carga de las obras reales

Todo se hace desde el panel (`/admin`), con una cuenta del equipo.

Para no cargar a mano la base de las 24 obras, `npm run db:catalogo` deja en Supabase los 24
artistas y sus obras con el número del catálogo (01 a 24, por apellido), **sin publicar**. Con
`npm run db:catalogo -- --ver` muestra qué haría sin tocar nada. No pisa obras que ya existan.
Después, en el panel, se completa cada obra y se publica.

1. **Configuración**: cargá las fechas de inicio y cierre de la etapa virtual (hora de
   Tucumán), la fecha de la subasta presencial, el incremento mínimo y el precio de salida.
   Dejá **"Las fechas están confirmadas"** sin marcar hasta que todo esté listo: mientras tanto,
   el sitio muestra "Fechas a confirmar" y no acepta ofertas. Desmarcá **modo ejemplo**.
2. **Artistas**: cargá cada artista con su nombre (o nombre artístico) y su **Instagram**
   (sirve el @usuario o la dirección del perfil: se guarda solo el usuario). La reseña, la foto
   y otro enlace son opcionales.
3. **Obras**: por cada obra, el número (es el que va en el cartel y en la URL `/obras/N`), el
   título (si no tiene, queda "Sin título"), el artista, la **técnica y materiales**, las
   **medidas** en centímetros (si llegan en metros, multiplicá por 100) y la **memoria
   conceptual** (de 60 a 100 palabras; el panel cuenta las palabras). Al crearla,
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
| `src/lib/auth/` | Ingreso de oferentes con Cidituc (`cidituc/`, sesión propia en `ciudadano.ts`) y del equipo con contraseña (Supabase Auth o modo local), con límites de intentos. |
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
