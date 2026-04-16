# Conversation Lab

Conversation Lab es un MVP para crear proyectos, conversar con un LLM dentro de sesiones persistidas, seleccionar uno o más turnos consecutivos y convertir ese slice en un caso estructurado solo después de una acción explícita del usuario.

## Stack

- Bun
- Next.js App Router + React + TypeScript
- Prisma
- SQLite
- Tailwind CSS v4
- Docker + Docker Compose

## Flujo cubierto

1. Crear un proyecto.
2. Crear una sesión dentro del proyecto.
3. Escribir un mensaje de usuario y enviarlo al LLM configurado.
4. Guardar el turno del usuario y la respuesta del asistente como mensajes individuales.
5. Seleccionar un rango consecutivo de turnos.
6. Abrir el editor de caso desde esa selección.
7. Completar etiquetas, artefactos, notas y estado.
8. Guardar el caso manualmente.
9. Revisar casos en la biblioteca.
10. Cambiar estado y exportar casos aprobados en JSON.

## Estructura

```text
prisma/
	schema.prisma
	seed.ts
src/
	app/
		api/cases/export/route.ts
		cases/
		projects/
		actions.ts
	components/
		app-shell.tsx
		case-editor-form.tsx
		session-selection.tsx
		status-badge.tsx
	lib/
		cases.ts
		prisma.ts
		types.ts
		utils.ts
Dockerfile
docker-compose.yml
prisma.config.ts
```

## Desarrollo local

1. Instala dependencias:

```bash
bun install
```

2. Configura el entorno copiando `.env.example` a `.env` y completa al menos:

```bash
OPENAI_API_KEY=...
DATABASE_URL="file:./dev.db"
```

Variables opcionales para proveedores OpenAI-compatible:

```bash
OPENAI_COMPATIBLE=false
OPENAI_BASE_URL=
```

- Si `OPENAI_COMPATIBLE=false` o no existe, la app usa OpenAI con su URL por defecto y requiere `OPENAI_API_KEY`.
- Si `OPENAI_COMPATIBLE=true`, la app usa `OPENAI_BASE_URL` como backend OpenAI-compatible. `OPENAI_API_KEY` queda opcional para los proveedores que no exigen autenticación.
- El modelo ya no se define en variables de entorno: cada sesión permite guardar su propio identificador de modelo desde la UI.
- Antes de habilitar el chat, la sesión debe ejecutar una prueba de conexión contra `/models`. Si la prueba falla, el input queda deshabilitado y el error aparece en toast y en la pantalla.

3. Genera cliente Prisma y crea la base SQLite:

```bash
bun run db:push
```

4. Carga datos de ejemplo opcionales:

```bash
bun run db:seed
```

5. Inicia la app:

```bash
bun run dev
```

La app queda disponible en `http://localhost:3000`.

## Chat configurable

- Cada sesión puede guardar un prompt de comportamiento opcional desde la propia pantalla de chat.
- Si el prompt está vacío, la conversación se envía sin instrucción de sistema adicional.
- Si el prompt tiene contenido, se aplica como prompt de sistema a los turnos siguientes de esa sesión.

## Docker

Levanta la app con SQLite persistente en volumen:

```bash
docker compose up --build
```

Eso ejecuta `prisma db push` y arranca la app dentro del contenedor. El seed ya no se ejecuta automáticamente en despliegue. Para que el chat funcione en Docker, exporta `OPENAI_API_KEY` si tu proveedor lo requiere, y si usas un backend OpenAI-compatible añade `OPENAI_COMPATIBLE=true` junto con `OPENAI_BASE_URL` antes de levantar Compose. El modelo se configura luego desde la UI de cada sesión.

El arranque del contenedor normaliza cualquier `DATABASE_URL` SQLite relativa como `file:./dev.db` o `file:"./dev.db"` hacia `file:/app/data/<archivo>.db` dentro del volumen persistente. Eso evita perder datos en Coolify por una ruta relativa que terminaría escribiendo en el filesystem efímero del contenedor.

Si quieres cargar datos demo manualmente en local o en un entorno efímero:

```bash
bun run db:seed
```

## Coolify

Esta app está preparada para desplegarse en Coolify sin publicar un puerto host fijo.

- El contenedor expone internamente el puerto `3000`.
- El comando de arranque ya no fuerza `--port 3000`, así que Next puede usar la variable `PORT` si Coolify la inyecta.
- Si despliegas con `docker-compose.yml` en Coolify, evita mapear `3000:3000`; Coolify debe enrutar al puerto interno del servicio.
- Si Coolify te pide el puerto interno, usa `3000`.

### Pasos exactos en Coolify con Compose

1. Crea el recurso como `Docker Compose`, no como `Raw Compose Deployment`.
2. Usa este `docker-compose.yml` del repo como fuente de verdad.
3. Cuando Coolify detecte el servicio `conversation-lab`, abre la configuración de dominio de ese servicio.
4. En el campo del dominio escribe tu dominio con el puerto interno del contenedor, por ejemplo: `https://lab.tudominio.com:3000`.
5. Ese `:3000` no significa que el usuario final vaya a navegar a `:3000`; solo le dice a Coolify a qué puerto interno del contenedor debe enviar el tráfico del proxy.
6. En variables de entorno de Coolify completa `OPENAI_API_KEY` solo si tu proveedor lo requiere. `DATABASE_URL` puede quedar con su valor por defecto `file:/app/data/dev.db`. Si usas un proveedor OpenAI-compatible, añade también `OPENAI_COMPATIBLE=true` y `OPENAI_BASE_URL`. El modelo se define desde la UI de cada sesión.
7. Despliega. Coolify publicará la app en el dominio normal (`https://lab.tudominio.com`) aunque internamente la app siga escuchando en `3000`.

### Persistencia de SQLite en Coolify

- El volumen persistente del servicio se monta en `/app/data`.
- Usa `DATABASE_URL=file:/app/data/dev.db` como valor recomendado en Coolify.
- Si por error de configuración llega una ruta relativa como `file:./dev.db`, el contenedor la corrige al arrancar para que siga escribiendo dentro del volumen persistente y no se pierdan datos en el redeploy.
- No montes la base SQLite dentro del directorio de la app (`/app/dev.db`) porque ese filesystem se reconstruye en cada despliegue.

### Cuándo usar `ports:`

Solo usa `ports:` si quieres publicar un puerto del servidor directamente, por ejemplo `IP_DEL_SERVIDOR:3000`. Para una app web normal detrás del proxy de Coolify, no hace falta y suele ser justamente la causa del conflicto de puertos.

## Export JSON

Export por defecto de casos aprobados:

```bash
curl http://localhost:3000/api/cases/export
```

Export filtrado por proyecto:

```bash
curl "http://localhost:3000/api/cases/export?projectId=<project_id>"
```
