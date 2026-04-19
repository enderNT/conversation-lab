**1. Nuevo concepto: DSPy Dataset Spec**

Hoy el `TaskSpec` ya define `inputSchema` y `outputSchema` en [src/components/task-spec-form.tsx](/Users/gabrielgonzalez/Desktop/proyectos/laboratorio%20dspy/src/components/task-spec-form.tsx). La versión robusta sería especializar eso con un nuevo modo o tipo de spec orientado a dataset.

Cada spec tendría:
- `name`, `slug`, `description`
- `datasetFormat`: por ejemplo `dspy_jsonl`
- `inputFields`
- `outputFields`
- `mappingHints`
- `validationRules`
- `exportConfig`

Cada campo del schema tendría algo así:
```json
{
  "key": "question",
  "type": "string",
  "required": true,
  "description": "Pregunta final del usuario",
  "sourceHints": ["last_user_message", "conversation_slice.user_last"],
  "normalizers": ["trim"]
}
```

Eso permite que el catálogo no solo diga “qué campos existen”, sino también “de dónde suelen salir”.

**2. Tipos estándar**

Aquí sí conviene dejar de usar tipos demasiado locales y pasar a una base más estándar, cercana a JSON Schema:

- `string`
- `integer`
- `number`
- `boolean`
- `object`
- `array`
- `null`
- `enum`
- `datetime`

Y solo como tipos especiales del dominio:
- `conversation_turns`
- `artifact_ref`

Mi recomendación: internamente guardar tipos estándar y dejar los especiales como extensiones. Así el mapeo a DSPy, Prisma, SQLite o incluso validadores futuros queda mucho más limpio.

**3. Nuevo catálogo**

Haría una nueva pantalla hermana de `/tasks`, por ejemplo `/dataset-specs`, con una UX parecida al catálogo actual de tareas en [src/components/task-catalog-manager.tsx](/Users/gabrielgonzalez/Desktop/proyectos/laboratorio%20dspy/src/components/task-catalog-manager.tsx), pero enfocada en:
- schema de `input`
- schema de `output`
- plantilla de export
- reglas de validación
- sugerencias de mapeo

La clave aquí es que el usuario no cargue artefactos abstractos, sino contrato final de dataset.

**4. Nuevo editor: Dataset Example Editor**

Aquí estaría la pieza fuerte. No lo haría como un textarea gigante desde el principio, sino en 3 paneles:

1. `Fuente`
   Muestra lo útil del caso:
   - último mensaje de usuario
   - historial reciente
   - interpretación
   - artefactos
   - ejemplos derivados existentes

2. `Mapeo`
   Una tabla por campo:
   - `campo destino`
   - `tipo`
   - `fuente seleccionada`
   - `transformación`
   - `preview`

   Ejemplo:
   - `question` -> `last_user_message`
   - `context` -> `artifact.relevant_context`
   - `answer` -> `artifact.ideal_answer`

3. `Resultado`
   Dos textareas finales:
   - `input JSON`
   - `output JSON`

Con esto cubres tu idea original: carga estructurada tipo catálogo, mapeo desde el caso útil, y edición final directa del JSON que terminará en JSONL.

**5. Cómo funcionaría el mapeo**

El mapeo debería ser explícito, no mágico.

Fuentes posibles:
- `case.last_user_message`
- `case.source_summary`
- `case.interpretation.main_intent`
- `case.conversation_slice`
- `artifact.<tipo>`
- `derived_example.input.<campo>`
- `derived_example.output.<campo>`
- `constant`
- `manual`

Transformaciones posibles:
- `trim`
- `join_lines`
- `extract_last_user_message`
- `to_boolean`
- `to_string`
- `wrap_array`
- `pick_path`
- `template`

Eso te da trazabilidad y hace que luego sea fácil corregir por qué salió un valor.

**6. Persistencia robusta**

Yo no crearía otra entidad totalmente aparte si no hace falta. Extendería `DerivedExample` o crearía una hermana muy cercana, por ejemplo `DatasetExample`.

Si quieres máxima claridad:
- `DatasetSpec`
- `DatasetExample`
- `DatasetFieldMapping`

Así separas bien:
- specs para proyecciones internas
- specs para dataset exportable DSPy

Si quieres menos cambio:
- reutilizar `TaskSpec`
- reutilizar `DerivedExample`
- agregar `mappingConfigJson` y `datasetFormat`

Para robustez de producto, prefiero separar `DatasetSpec` y `DatasetExample`.

**7. Validación**

La validación tendría que correr en 4 capas:

- Validación de tipo
- Validación de campos requeridos
- Validación semántica
- Validación de export

Ejemplos:
- `answer` requerido y no vacío
- `context` debe ser `string` o `array<string>` según spec
- `question` no debe venir de un turno de assistant
- `input` y `output` deben serializar limpio a JSON object

Eso ya encaja bastante bien con la lógica existente de validación en [src/lib/cases.ts](/Users/gabrielgonzalez/Desktop/proyectos/laboratorio%20dspy/src/lib/cases.ts), pero habría que volverla más genérica.

**8. Export robusto a JSONL**

Cada `DatasetExample` exportaría una línea como:
```json
{"input":{"question":"..."}, "output":{"answer":"..."}, "metadata":{"spec":"qa_basic","version":1}}
```

Y opcionalmente permitir 2 formatos:
- `dspy_jsonl_compact`
- `conversation_lab_verbose`

Así no amarras toda la app a una sola forma de exportación.

**9. UX que sí sería funcional**

Para que de verdad funcione en práctica, agregaría:
- autocompletado de fuentes sugeridas por campo
- detección de incompatibilidad de tipos
- preview inmediato del valor mapeado
- indicador visual de campos faltantes
- plantillas de specs comunes
- duplicar spec
- duplicar example
- “aplicar mismo mapping a otros casos”

Eso último sería importantísimo si luego quieres escalar la curación.

**10. Mi recomendación real**

Si lo hacemos robusto, yo lo construiría en este orden:

1. `DatasetSpec` con tipos estándar
2. Editor de example con tabla de mapeo
3. Generación automática de `input/output` preview
4. Guardado del mapping junto al example
5. Export `jsonl`
6. Reutilización masiva de mappings

La versión robusta sí sería muy funcional y tendría bastante valor. La clave es que el “editor nuevo” no sea solo dos textareas, sino un editor de mapeo tipado que termina en dos textareas editables. Ahí está la diferencia entre algo útil de verdad y algo que se vuelve manual muy rápido.