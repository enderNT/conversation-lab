# Chuleta Minima: Artefactos y Tareas

Esta nota resume la idea operativa del proyecto de la forma mas simple posible.

## Flujo Mental

| Capa | Que es |
|---|---|
| Conversacion | Materia prima cruda |
| Artefactos | Piezas curadas intermedias |
| Tarea | Molde que transforma esas piezas |
| Input/Output JSON | Fila final del dataset o firma |

## Tareas Base

| Si quieres construir... | Artefactos minimos | Que pones en `value` | Forma recomendada | Que termina saliendo |
|---|---|---|---|---|
| `write_query` | `ideal_search_query` | La busqueda ideal corta que harias | String | `{ "search_query": "..." }` |
| `rag_reply` | `ideal_answer`, `relevant_context` | La respuesta ideal y el contexto recuperado util | `ideal_answer` como string, `relevant_context` como texto o JSON | Input con contexto y output como `{ "answer": "..." }` |
| `routing` | `expected_route` | La ruta correcta que deberia seguir el sistema | String, idealmente de una taxonomia fija | `{ "route": "retrieval" }` |
| `tool_selection` | `expected_tool` | La herramienta que deberia usarse | String | `{ "tool_name": "read_file" }` |
| `memory_write_decision` | `memory_write_decision` | Si se debe escribir memoria y cual seria | JSON | `{ "write_memory": true, "memory_payload": { ... } }` |

## Artefactos Auxiliares

| Artefacto auxiliar | Para que sirve | Que poner |
|---|---|---|
| `policy_flags` | Restricciones, riesgos, limites o condiciones | Texto o JSON |
| `state_assumptions` | Supuestos de estado del sistema o contexto operativo | JSON |
| `extracted_slots` | Campos o entidades extraidas de la conversacion | JSON |

## Como Decidir Que Llenar

| Pregunta | Si la respuesta es si | Entonces llena |
|---|---|---|
| Quiero ensenar como buscar informacion | Si | `ideal_search_query` |
| Quiero ensenar como responder con contexto | Si | `ideal_answer` y `relevant_context` |
| Quiero ensenar como enrutar una solicitud | Si | `expected_route` |
| Quiero ensenar cuando usar una herramienta | Si | `expected_tool` |
| Quiero ensenar cuando guardar memoria | Si | `memory_write_decision` |
| Hay restricciones o politicas importantes | Si | `policy_flags` |
| Hay supuestos internos que importan | Si | `state_assumptions` |
| Quiero extraer campos estructurados del caso | Si | `extracted_slots` |

## Regla Practica

| Campo del artefacto | Que significa |
|---|---|
| `value` | La pieza curada real |
| `notes` | Explicacion humana o matiz |
| `confidence` | Que tan seguro estas |
| `provenance` | De donde salio |

## Regla Final

Los artefactos no son el input/output final.

Los artefactos alimentan el input/output final.