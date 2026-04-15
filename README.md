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
OPENAI_MODEL=gpt-4.1-mini
DATABASE_URL="file:./dev.db"
```

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

## Docker

Levanta la app con SQLite persistente en volumen:

```bash
docker compose up --build
```

Eso ejecuta `prisma db push`, aplica seed idempotente y arranca la app en `http://localhost:3000`. Para que el chat funcione en Docker, exporta `OPENAI_API_KEY` y opcionalmente `OPENAI_MODEL` antes de levantar Compose.

## Export JSON

Export por defecto de casos aprobados:

```bash
curl http://localhost:3000/api/cases/export
```

Export filtrado por proyecto:

```bash
curl "http://localhost:3000/api/cases/export?projectId=<project_id>"
```
