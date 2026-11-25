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

## 3. Puesta en producción (servidor propio)

La subasta corre en el servidor de la Dirección (VPS en San Pablo, Ubuntu 24.04, nginx 1.24,
Node 22, pm2 y PostgreSQL 16 local), en **https://subastas.smt.gob.ar**. No depende de Vercel
ni de Supabase: la base, el ingreso del panel y las fotos están en el mismo servidor. Todo lo de
la subasta vive en `/srv/subasta`, con su usuario `subasta`, su base `subasta`, su sitio de
nginx y su puerto (3008): **no se toca nada de los otros proyectos del servidor**.

Los scripts están en [`scripts/servidor/`](scripts/servidor/) y se corren como root por SSH.

### 3.1 Cómo está armado

| | Dónde |
|---|---|
| Versiones | `/srv/subasta/versiones/<fecha>-<commit>`; `actual` apunta a la que está viva. Quedan las 3 últimas. |
| Variables | `/srv/subasta/compartido/.env` (permisos 600; se enlaza en cada versión). |
| Fotos | `/srv/subasta/compartido/subidas` (`CARPETA_SUBIDAS`), servidas en `/subidas/`. |
| Base | PostgreSQL local, base `subasta`. El usuario `subasta` solo puede entrar a su base (`pg_hba.conf`). |
| Proceso | pm2 (`/srv/subasta/ecosystem.config.cjs`) bajo systemd (`pm2-subasta`): vuelve solo si se reinicia el servidor. |
| nginx | `/etc/nginx/sites-available/subasta-dominio` (con certificado de Let's Encrypt, se renueva solo). Plantilla en `scripts/servidor/nginx-subasta.conf`. |
| Avisos por correo | `/etc/cron.d/subasta` corre `scripts/servidor/avisos.sh` cada 10 minutos (reintenta los avisos y limpia el registro viejo de Migue). |
| Registros | `/srv/subasta/registros/` (salida de pm2 y de cada despliegue). |

La app elige sola cómo correr (`src/lib/entorno.ts`): con `DATABASE_URL` y sin
`NEXT_PUBLIC_SUPABASE_URL` usa la base, la sesión del panel y las fotos propias. El código
conserva el modo Supabase, pero ya no se usa.

### 3.2 Desplegar una versión nueva

Con los cambios mergeados en `main`:

```bash
bash /srv/subasta/actual/scripts/servidor/desplegar.sh
```

Compila en una carpeta nueva mientras la versión actual sigue atendiendo, aplica las
migraciones nuevas (`scripts/servidor/preparar-base.mjs`, solo las que faltan) y recién al final
mueve `actual` y recarga pm2. Tarda unos dos minutos. **Orden**: si una migración nueva hace
falta para el código nuevo, el script ya las aplica antes de cambiar de versión.

Volver a la versión anterior:

```bash
cd /srv/subasta && ls -t versiones | head -3
```

```bash
ln -sfn /srv/subasta/versiones/<la-que-andaba> /srv/subasta/actual && sudo -u subasta pm2 reload subasta
```

**No** cargues `supabase/seed.sql` ni `supabase/local/seed-local.sql` en la base del servidor:
son datos de ejemplo para el modo local.

### 3.3 Variables

En `/srv/subasta/compartido/.env` (explicadas en [.env.example](.env.example)). Después de
cambiar alguna, volvé a desplegar: las que empiezan con `NEXT_PUBLIC_` quedan fijas al compilar.

| Variable | Obligatoria | Para qué |
|---|---|---|
| `DATABASE_URL` | Sí | La base local: `postgresql://subasta:<clave>@127.0.0.1:5432/subasta`. |
| `PUERTO` | Sí | 3008. Lo usa `avisos.sh`; pm2 y nginx tienen el mismo. |
| `CARPETA_SUBIDAS` | Sí | `/srv/subasta/compartido/subidas`. |
| `NEXT_PUBLIC_URL_SITIO` | Sí | `https://subastas.smt.gob.ar`: correos, QR y las redirecciones. |
| `SESION_PANEL_SECRETO` | Sí | Firma las sesiones del panel (32 caracteres o más). |
| `SESSION_SECRET` | Sí | Firma las sesiones de los oferentes y el tope de Migue (32 caracteres o más). |
| `CRON_SECRET` | Sí | Protege `/api/avisos` (lo usa `avisos.sh`). |
| `RESEND_API_KEY` y `CORREO_REMITENTE` | Para los avisos | Avisos "te superaron". Sin ellas quedan pendientes y salen cuando se cargan. |
| `CIDITUC_HABILITADO`, `CIDITUC_LOGIN_URL`, `CIDITUC_API_URL`, `CIDITUC_CALLBACK_URL` | Sí | Ingreso de oferentes con Cidituc (ver 3.4). |
| `OPENROUTER_API_KEY` | No | Migue con IA. Sin ella contesta con los atajos y el buscador. |

Los secretos se generan en el servidor (`openssl rand -base64 48`), nunca se copian de otro
lado. Para el remitente de los correos, el área que administra el DNS tiene que cargar los
registros SPF y DKIM que indique Resend; sin ellos, los correos caen en spam.

### 3.4 Ingreso de oferentes con Cidituc (Ciudadano Digital)


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
   aportando el certificado intermedio de Sectigo que ese servidor no manda: sin él, en Linux el
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
equipo sigue entrando con correo y contraseña (3.5).

**Variables** (en el `.env` del servidor y, para probar, en `.env.local`):

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
anotada como `subasta-cementerio` → `https://subastas.smt.gob.ar/auth/cidituc/callback`.
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

### 3.5 Cuentas del equipo (panel)

Las cuentas están en `auth.users` de la base local (contraseñas bcrypt) y se habilitan en
`public.admins`. Como root en el servidor, con el correo y el nombre de la persona (la clave la
escribe quien da el alta, no se pasa por chat ni por correo):

```bash
read -s -p "Clave nueva: " C && echo && CLAVE="$C" sudo --preserve-env=CLAVE -u postgres psql -d subasta -v correo="nombre@smt.gob.ar" -v nombre="Nombre y apellido" -f /srv/subasta/actual/scripts/servidor/alta-admin.sql; unset C
```

Para quitar el acceso: `update public.admins set activo = false where user_id = (select id from auth.users where email = '<correo>');`

### 3.6 Instalación desde cero y respaldos

Los pasos para montar la subasta en un servidor nuevo (usuario y carpetas, base y roles,
`.env`, primer despliegue, nginx y certificado, cron) siguen la guía «Migrar proyectos a la
VPS» de la Dirección, con los scripts de `scripts/servidor/`: `preparar-base.mjs` (esquema y
migraciones), `copiar-datos.sh` y `copiar-fotos.mjs` (traer datos y fotos de otra base),
`ecosystem.config.cjs`, `nginx-subasta.conf`, `avisos.sh` y `desplegar.sh`.

Respaldo de la base y de las fotos (conviene programarlo y guardar una copia fuera del servidor,
sobre todo durante la subasta):

```bash
sudo -u postgres pg_dump -Fc subasta > /root/respaldos/subasta-$(date +%Y%m%d-%H%M).dump
```

```bash
tar czf /root/respaldos/subasta-fotos-$(date +%Y%m%d).tgz -C /srv/subasta/compartido subidas
```

---

## 4. Carga de las obras reales

Todo se hace desde el panel (`/admin`), con una cuenta del equipo.

Para no cargar a mano la base de las 24 obras, `npm run db:catalogo` deja en la base los 24
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
