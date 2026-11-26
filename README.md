# IEP Backend

API REST para la gestión de la iglesia: personas y miembros, departamentos, cultos y asistencia,
reuniones, rol de limpieza, inventario y finanzas. Incluye usuarios con roles, bitácora de
auditoría y documentación interactiva con Swagger.

**Stack:** Node.js 20+ · Express 5 · MongoDB (Mongoose 8) · Joi · JWT

---

## Puesta en marcha

```bash
npm install
cp .env.example .env      # y completa los valores (ver abajo)
npm run dev               # desarrollo, con recarga automática
npm start                 # producción
```

La documentación queda en **http://localhost:9000/api/docs**: inicia sesión con `POST /login`,
copia el `token` y pégalo en **Authorize**.

### Variables de entorno

| Variable | Obligatoria | Descripción |
|---|---|---|
| `MONGO_URI` | Sí | Cadena de conexión de MongoDB (Atlas). También se acepta `MONGO_URL`. |
| `TOKEN_JWT` | Sí | Secreto para firmar los tokens. Genera uno con `node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"` |
| `ADMIN_CORREO` / `ADMIN_CONTRASENA` | Primera vez | Crean el administrador inicial al arrancar si no existe ninguno activo. |
| `PORT` | No | Puerto (9000 por defecto). |
| `CORS_ORIGINS` | No | Orígenes permitidos del frontend, separados por coma. |
| `SWAGGER_ENABLED` | No | `true`/`false`. Por defecto activo salvo en producción. |
| `TRUST_PROXY` | No | `1` si la API está detrás de un proxy (Render, Nginx, Heroku). |

El resto está documentado en [.env.example](.env.example).

---

## Scripts

| Comando | Qué hace |
|---|---|
| `npm run dev` | Servidor de desarrollo con nodemon. |
| `npm test` | Pruebas automáticas contra una MongoDB **en memoria** (nunca toca la BD real). |
| `npm run cargar:ubigeo` | Simula la carga de departamentos, provincias y distritos (INEI). Agrega `-- --aplicar` para escribir. |
| `npm run migrar` | Simula la migración del modelo de datos del 2026-11-24. Agrega `-- --aplicar` para escribir. Ya aplicada en producción. |
| `npm run cargar:datos` | Catálogos (cargos, tipos de reunión, dones, categorías de inventario y finanzas), servicios dominicales y fondos. Solo crea lo que falta. Ya aplicado en producción. |
| `npm run migrar:historial` | Crea el evento inicial del historial para los miembros que no tienen. Ya aplicada en producción. |

Los scripts de datos son **idempotentes**: ejecutarlos dos veces no duplica nada.

> La primera vez que corras `npm test` se descarga un binario de MongoDB (~100 MB) que queda en caché.

---

## Roles

Definidos en [src/config/permisos.js](src/config/permisos.js), única fuente de verdad para las rutas,
los permisos y la documentación de Swagger.

| Rol | Puede |
|---|---|
| `administrador` | Todo, incluida la gestión de usuarios. |
| `pastor` | Todo lo pastoral y eclesiástico; ve la bitácora. |
| `secretario` | Registra miembros, asistencias, reuniones, departamentos e inventario. |
| `tesorero` | Gestiona las finanzas (fondos, ingresos, egresos, cierres); consulta el resto. |
| `lider` | Consulta todo; modifica solo lo de **su** departamento (integrantes, reuniones, sesiones, asistencias, inventario) y ve el fondo de su departamento, sin nombres de diezmantes. Necesita un miembro vinculado: sus departamentos son aquellos donde ese miembro es integrante. |
| `lector` | Solo consulta (sin finanzas). |

- **Acceso por oficio:** si el miembro vinculado al usuario es **anciano**, **diácono**, **evangelista**,
  **misionero** o **maestro activo** en `/oficial`, recibe acceso a los módulos pastorales que le corresponden,
  sea cual sea su rol. Al cesar su periodo lo pierde de inmediato.
- Un cambio de rol o la desactivación de una cuenta (`activo: false`) aplican **de inmediato**.
- No se puede quitar, degradar ni desactivar al **último administrador activo**.
- `GET /login/perfil` devuelve los permisos del usuario por módulo, para que el frontend muestre u oculte opciones.

## Finanzas

| Concepto | Regla |
|---|---|
| **Fondos** | Caja, banco, misiones o fondo de un departamento. El saldo no se guarda: se calcula de `saldo_inicial` + movimientos no anulados. |
| **Ingresos** | `diezmo` (con miembro u anónimo), `ofrenda` (siempre anónima) u `otro` (con categoría de ingreso). |
| **Egresos** | Con categoría de egreso, beneficiario y comprobante. No pueden dejar el fondo en negativo. |
| **Transferencias** | Entre fondos (p. ej. depositar la caja en el banco). |
| **Correcciones** | Nada se edita ni se borra: se **anula** con motivo y deja de contar. |
| **Cierre mensual** | Bloquea el mes y guarda los saldos. Se cierra en orden; solo un administrador reabre (el último). |
| **Mes de un movimiento** | Se calcula en hora de Perú (`ZONA_HORARIA`): el 31/03 a las 22:00 es marzo. |

Reportes: `GET /finanzas/reportes/mensual?periodo=2024-03` (informe al consistorio),
`/anual?anio=2024` (mes a mes) y `/diezmos?anio=2024[&miembro=id]` (constancias; solo
administrador, pastor y tesorero).

## Registro eclesiástico

| Módulo | Ruta | Reglas |
|---|---|---|
| **Familias** | `/familia` | Núcleos familiares con parentesco (cabeza, cónyuge, hijo, otro). Una persona en una sola familia; una cabeza por familia. |
| **Historial de membresía** | `/miembro/:id/historial` | Traslado recibido/enviado, reafirmación de fe, baja por inasistencia, fallecimiento. Cada evento cambia el estado del miembro (el estado ya **no** se edita a mano). En orden; solo el último evento manual se puede deshacer. |
| **Actas de bautismo** | `/actas/bautismo` | Solo adultos. Si la persona no es miembro, la admite como ACTIVO. |
| **Actas de matrimonio** | `/actas/matrimonio` | Enlaza a los contrayentes como cónyuges en una familia. |
| **Actas de disciplina** | `/actas/disciplina` | 🔒 Solo pastor y administrador. Amonestación (sin cambio de estado), suspensión de la Santa Cena (DISCIPLINADO) o exclusión (EXCLUIDO); `/restaurar` devuelve el estado previo. La bitácora no guarda el motivo. |
| **Oficiales** | `/oficial` | Pastores, ancianos (ordenados o a prueba) y diáconos, por periodos. `integra_consistorio` indica quién compone el consistorio. `/oficial/consistorio` da la composición actual. |

- Las actas llevan **número correlativo por tipo** y **no se borran**: se anulan con motivo.
- Los estados que falten (TRASLADADO, FALLECIDO, EXCLUIDO) se crean solos en el catálogo.
- Resumen anual: `GET /membresia/resumen?anio=2025` (recibidos, trasladados, bajas y miembros por estado).

## Calendario y programa de cultos

| Qué | Ruta | Reglas |
|---|---|---|
| **Generar cultos** | `POST /sesion-servicio/generar` | `{ desde, hasta, servicios? }`: crea una sesión por cada día que corresponde a cada servicio (según su día y hora de inicio), sin duplicar. Máx. 3 meses. Los servicios sin hora de inicio se informan para completarla. |
| **Programa del culto** | `PUT /sesion-servicio/:id/programa` | Tres funciones en todos los servicios: **director**, **predicador** (`tema`, `texto_biblico`) y **lectura_biblica** (`pasaje`). Cada una es `{ miembro }` o `{ invitado, iglesia }`; `null` la quita. `?programa_incompleto=true` lista los cultos con funciones sin asignar. |
| **Eventos** | `/calendario/eventos` | Vigilias, campañas evangelísticas, retiros, aniversarios, conferencias… con inicio, fin, lugar, departamento organizador, responsable y estado. |
| **Calendario** | `GET /calendario?desde=&hasta=` | Cultos (con su programa y funciones pendientes) y eventos, ordenados. Filtro por departamento. |
| **Mis asignaciones** | `GET /calendario/mis-asignaciones` | Cuándo le toca al usuario dirigir, predicar o leer. |

Pastor, secretario y administrador programan todo; el **líder** programa los cultos y eventos de **su**
departamento. Todos pueden consultar el calendario.

> **Fechas en los filtros:** `desde=2024-12-01&hasta=2024-12-31` se interpreta en hora de Perú y abarca los
> días completos (del 1 a las 00:00 al 31 a las 23:59).

## Pastoral

| Módulo | Ruta | Quién | Reglas |
|---|---|---|---|
| **Visitas pastorales** | `/pastoral/visitas` | Pastor, administrador, ancianos | A una persona y/o familia; motivo, notas, acuerdos y próxima visita (`?proximas=true` = agenda). Las marcadas `solo_pastor` no las ven ni los ancianos. |
| **Necesitados y enfermos** | `/pastoral/casos` | + diáconos | Tipo, prioridad y responsable. Ayudas (víveres, medicinas, económica…) en `/:id/ayudas`; una ayuda económica se enlaza al egreso que registró el tesorero. Cerrar exige motivo. |
| **Peticiones de oración** | `/pastoral/oracion` | Todos | Las `confidencial` solo las ven pastor, administrador, ancianos y su autor. Al marcarla `respondida` se guarda el testimonio. |
| **Seguimiento de nuevos** | `/pastoral/seguimiento` | Pastor, administrador, secretario, ancianos, evangelistas, misioneros, maestros | Etapas contacto → visitante → en_discipulado → preparacion_bautismo → integrado. Sesiones y cambios en `/:id/avances`. Al registrar su acta de bautismo pasa solo a **integrado**. |
| **Alertas de inasistencia** | `GET /pastoral/alertas` | Pastor, administrador, ancianos | Miembros activos que faltaron a los últimos 4 domingos con culto (`?domingos=`), con última asistencia, última visita y si tienen un caso abierto. |
| **Tablero** | `GET /pastoral/resumen` | Pastor, administrador, ancianos | Visitas del mes, próximas visitas, casos por prioridad, peticiones activas, nuevos por etapa y alertas. |

## Cartilla de visita presbiteral

Correspondencia entre los registros exigidos por la cartilla administrativa y la API:

| Registro de la cartilla | Endpoint |
|---|---|
| Acta de Bautismos · Bendición Matrimonial · Dedicación de Niños · Disciplinas y Restauraciones | `/actas/bautismo` · `/actas/matrimonio` · `/actas/dedicacion` · `/actas/disciplina` |
| Padrón de Miembros | `GET /membresia/padron` |
| Miembros hábiles para Asambleas | `GET /asamblea/habiles` · `GET /asamblea/:id/habiles` (congelable) |
| Asistencia a Asambleas (con quórum) | `/asamblea/:id/asistentes` |
| Asistencia a reuniones del Consistorio | `/reunion` (departamento CONSISTORIO) + `/reunion/:id/asistentes` |
| Libro de Caja / Cuaderno de movimiento económico | `/finanzas` (un fondo por departamento) |
| Ministros y Ancianos (ordenados o en prueba) · Misioneros, Predicadores, Evangelistas, Maestros | `/oficial` · `GET /oficial/consistorio` |
| Líderes · Maestros de niños, adolescentes y jóvenes · Relación de Damas | `/departamento/:id/integrantes` (con cargo) |
| Registro de Niños, Adolescentes, Relación de jóvenes | `/departamento/:id/inscritos` (miembros o no, con apoderado) |
| Monitoreo de Crecimiento – Decrecimiento | `GET /membresia/crecimiento` |
| Asistencia a Cultos Generales · Cena del Señor | `/asistencia` · `/asistencia-santa-cena` |
| Registro de Familias | `/familia` |
| Inventario de Bienes anual | `GET /inventario/reporte-anual?anio=` |
| Dones, Capacidades y Profesiones | Campos de `/persona` · `GET /persona/dones` · `/catalogo/don` |
| Necesitados y Enfermos | `/pastoral/casos` (+ ayudas, enlazables a egresos de finanzas) |
| Registro de Atención o Visitas pastorales | `/pastoral/visitas` |
| Registro de Nuevos en proceso de Evangelismo y Discipulado | `/pastoral/seguimiento` |

**Miembro hábil** (por defecto; configurable por asamblea o con `HABILES_*` en `.env`): estado ACTIVO, sin
disciplina vigente, 18 años o más (sin fecha de nacimiento = no hábil, "por verificar"), asistencia ≥ 50% de
los domingos con culto y participación ≥ 50% de las Santas Cenas de los últimos 6 meses. Quórum: mitad más uno
de los hábiles.

## Bitácora

Cada creación, edición y eliminación queda registrada con el usuario, la IP, la fecha y **solo los
campos que cambiaron** (antes → después). También los movimientos de inventario y los inicios de
sesión, incluidos los fallidos. Las contraseñas nunca se guardan. Consulta: `GET /api/v1/bitacora`
(administrador y pastor).

---

## Arquitectura

```
src/
├── config/        Variables de entorno (validadas al arrancar) y matriz de permisos
├── libs/          Conexión a MongoDB, logger, contexto de la petición, Swagger, migraciones
├── middlewares/   Autenticación/autorización, validación Joi, límite de login, errores
├── models/        Esquemas Mongoose (un archivo por entidad; nombres en models/nombres.js)
├── schemas/       Validación de entrada con Joi (también genera la documentación)
├── services/      Reglas de negocio; BaseService da CRUD, integridad y bitácora
├── controllers/   Traducen HTTP ↔ servicios
├── routes/v1/     Endpoints; crudRouter.js genera las 5 rutas estándar con permisos
├── app.js         Configuración de Express
└── server.js      Arranque: conecta la BD y escucha
tests/             Pruebas de punta a punta (node:test + MongoDB en memoria)
```

Una petición recorre: `routes → autorizar (JWT + rol) → validatorHandler (Joi) → controller → service → model`.
Los errores llegan a `errorHandler` y siempre responden con el mismo formato:
`{ statusCode, error, message, data }`.

### Convenciones

- **Integridad:** `BaseService` verifica que las referencias existan (400) e impide borrar registros
  en uso (409). Declara `referencias` y `dependencias` en cada servicio.
- **Listados grandes** paginados: `?pagina=1&limite=20` → `{ data, meta: { total, pagina, limite, paginas } }`.
  Los catálogos, departamentos, servicios y ubigeo devuelven el arreglo completo.
- **Búsquedas** (`?buscar=`) insensibles a mayúsculas y tildes.
- **Colecciones existentes** conservan sus nombres originales (`per_people`, `dep_services`…) para
  no perder datos; las nuevas usan nombres en español (`inv_bienes`, `seg_bitacora`).

### Agregar un módulo nuevo

1. Modelo en `src/models/` (y su nombre en `models/nombres.js`).
2. Esquemas Joi en `src/schemas/`.
3. Servicio que extienda `BaseService` en `src/services/`.
4. Controlador con `crearCrudController(servicio)`.
5. Permisos del módulo en `src/config/permisos.js`.
6. Ruta con `crearCrudRouter({ modulo, controller, schemas })` y registrarla en `routes/v1/index.js`.
7. Agregarlo a `recursos` en `src/libs/swagger.js`.
8. Pruebas en `tests/`.
