# Descripcion funcional y visual del editor de dataset example en modo edicion

## 1. Idea general de la pantalla

1. Esta pantalla es la version de trabajo sobre un dataset example ya existente.
1.1. A diferencia del modo creacion, aqui el example ya fue guardado al menos una vez.
1.2. Ya existe un `source slice`.
1.3. Ya existe un `dataset example`.
1.4. Ya existen mappings persistidos, payloads guardados y una validacion previa.

2. La sensacion general de esta pantalla no es "crear desde cero".
2.1. Es "reabrir, revisar, corregir y consolidar".
2.2. Se parece al editor en modo creacion.
2.3. Pero se siente mas como mesa de revision que como taller de primer armado.

3. Mentalmente, esta pantalla responde a otra pregunta.
3.1. "Este example ya existe; ahora, como lo corrijo, lo actualizo o lo dejo listo para revision y exportacion?"

## 2. Rol dentro del flujo general

1. El flujo alrededor de esta pantalla se puede leer asi:
1.1. `Chat -> Crear example -> Guardar -> Abrir example -> Editar -> Revisar estado -> Exportar`

2. Esta pantalla ya no depende de una seleccion viva en el chat.
2.1. Depende de un `exampleId`.
2.2. El material fuente ya fue congelado y persistido.

3. Por eso su funcion es diferente a la del editor en modo creacion.
3.1. No transforma por primera vez un slice en example.
3.2. Reabre un activo ya existente para mantenimiento, correccion o aprobacion.

## 3. Como se llega a esta pantalla

1. El usuario llega aqui desde varios caminos naturales.
1.1. Despues de guardar un example nuevo.
1.2. Desde la biblioteca de `Dataset Examples`.
1.3. Desde los `Examples recientes` dentro del drawer del chat.
1.4. Eventualmente desde enlaces internos asociados a una sesion o proyecto.

2. A diferencia del modo creacion:
2.1. No hace falta que exista una seleccion activa en el chat.
2.2. No hacen falta parametros `start` y `end`.
2.3. Todo se reconstruye a partir del example ya guardado.

3. Si el `exampleId` no existe:
3.1. La pantalla no se construye.
3.2. La ruta se considera invalida.

## 4. Sensacion visual general

1. La base visual es muy parecida al editor en modo creacion.
1.1. Sigue habiendo grandes tarjetas.
1.2. Sigue existiendo la secuencia `Fuente -> Mapeo -> Resultado`.

2. Pero aparece una diferencia importante en la composicion general.
2.1. El contenido principal vive a la izquierda.
2.2. A la derecha aparece una columna secundaria fija de revision y metadata.

3. Esa columna lateral cambia mucho la lectura mental.
3.1. El example ya no es solo un borrador editable.
3.2. Ya es un objeto del sistema con estado, version y trazabilidad.

## 5. Bloque superior de regreso

1. Arriba del todo aparece una tarjeta simple con un enlace de regreso.
1.1. El enlace dice `Volver a dataset examples`.

2. A diferencia del modo creacion:
2.1. Aqui el regreso natural no es al chat.
2.2. El regreso natural es a la biblioteca de examples.

3. Esto es coherente con el rol de la pantalla.
3.1. Ya no estas siguiendo el hilo de una sesion.
3.2. Estas operando dentro del inventario curado de examples.

## 6. Estructura general de la pantalla

1. La pantalla completa se organiza en dos columnas principales.
1.1. Columna izquierda amplia: editor del example.
1.2. Columna derecha mas estrecha: revision y metadata.

2. En mobile estas columnas se apilan.
2.1. Primero aparece el editor principal.
2.2. Luego baja la columna lateral.

3. Dentro de la columna izquierda, el editor conserva la estructura conocida.
3.1. `Fuente`
3.2. `Mapeo`
3.3. `Resultado`

4. La gran diferencia es que todo ya llega precargado.

## 7. Encabezado principal del editor

1. En el bloque `Fuente`, el encabezado ya no presenta un "nuevo editor".
1.1. Si el example tiene titulo, ese titulo se vuelve el h1 principal.
1.2. Si no tiene titulo, la pantalla usa un fallback como `Editar dataset example`.

2. Debajo se mantiene un texto descriptivo similar.
2.1. Se sigue explicando que el usuario esta revisando el slice fuente y ajustando la firma final.

3. En la esquina o lateral superior sigue apareciendo la tarjeta del spec actual.
3.1. Nombre
3.2. Slug
3.3. Version

4. La diferencia importante es que aqui esa tarjeta ya representa un contrato aplicado a un example real, no solo una eleccion preliminar.

## 8. Que llega precargado al abrir el example

1. Esta pantalla no arranca vacia.
1.1. Recibe el `source slice` ya persistido.
1.2. Recibe el `dataset spec` actual del example.
1.3. Recibe el titulo guardado.
1.4. Recibe el estado guardado.
1.5. Recibe `inputPayloadJson` y `outputPayloadJson`.
1.6. Recibe los `fieldMappings` persistidos.
1.7. Recibe el `validationState` guardado.

2. Eso cambia por completo la experiencia de inicio.
2.1. El usuario no "arma" desde un estado neutral.
2.2. El usuario entra a revisar una decision ya materializada.

## 9. Bloque "Fuente" en modo edicion

1. El bloque `Fuente` sigue ocupando la parte superior del editor principal.
1.1. Pero ahora se lee como ficha editable de un example ya existente.

2. Los campos principales aparecen rellenos.
2.1. `Titulo del example`
2.2. `Titulo del slice`
2.3. `Resumen curatorial`

3. El transcript seleccionado tambien reaparece completo.
3.1. Ya no depende de una seleccion viva del chat.
3.2. Depende del `source slice` guardado.

4. Esto es importante porque confirma algo estructural.
4.1. El example ya no esta amarrado al estado actual del chat.
4.2. Tiene su propia copia del recorte fuente.

## 10. Columna izquierda: identidad y transcript del source slice

1. Igual que en modo creacion, la parte izquierda del bloque `Fuente` contiene:
1.1. Titulo del example
1.2. Titulo del slice
1.3. Resumen curatorial
1.4. Transcript seleccionado

2. La diferencia es que aqui todo esto ya fue editado al menos una vez.
2.1. No son sugerencias iniciales.
2.2. Son valores persistidos y revisables.

3. El transcript fuente se muestra como mini tarjetas por turno.
3.1. Rol
3.2. Numero de turno
3.3. Texto

4. Mentalmente, esta zona funciona como el expediente base del example.
4.1. Recuerda de donde vino.
4.2. Permite revalidar si la interpretacion sigue siendo correcta.

## 11. Columna derecha dentro del bloque "Fuente"

1. La parte derecha del bloque `Fuente` sigue mostrando:
1.1. Selector de `Dataset spec`
1.2. Selector de `Estado`
1.3. `Contexto auxiliar`
1.4. `Ultima validacion guardada`

2. Pero en modo edicion, todos esos elementos adquieren mas peso.

### 11.1. Dataset spec en modo edicion

1. El selector de `Dataset spec` ya no representa solo una eleccion inicial.
1.1. Representa el contrato actual del example.

2. Si el usuario cambia el spec:
2.1. Esta modificando la base estructural del activo ya guardado.
2.2. El editor rehace mappings y recalcula payloads.
2.3. El example puede cambiar de forma sustancial.

3. Esta accion es mas delicada que en modo creacion.
3.1. Ya no estas probando una primera configuracion.
3.2. Estas migrando o reencuadrando un objeto existente.

### 11.2. Estado dentro del editor principal

1. El selector `Estado` sigue presente dentro del editor.
1.1. Permite cambiar el review status como parte de una actualizacion completa del example.

2. Eso significa que el estado puede editarse de dos maneras.
2.1. Desde el propio editor principal al guardar cambios completos.
2.2. Desde la columna lateral con un formulario dedicado de revision.

3. Esto no es redundancia sin sentido.
3.1. El editor principal sirve para cambios integrales.
3.2. El panel lateral sirve para cambios rapidos solo de estado.

### 11.3. Contexto auxiliar en modo edicion

1. El bloque `Contexto auxiliar` sigue mostrando el entorno cercano del source slice.
1.1. Es igual de util que en creacion.

2. Pero aqui cumple ademas una funcion de auditoria.
2.1. Ayuda a verificar si el mapping guardado sigue siendo coherente con el contexto real.

### 11.4. Ultima validacion guardada en modo edicion

1. En esta pantalla, el bloque `Ultima validacion guardada` cobra especial importancia.
1.1. Ya no suele estar vacio.
1.2. Muestra el resultado de la ultima validacion persistida.

2. Puede indicar:
2.1. Que la forma estructural coincide.
2.2. Que existen errores estructurales.
2.3. Que existen advertencias semanticas.

3. Este bloque actua como memoria del estado tecnico del example.
3.1. No solo dices "me parece bien".
3.2. Ves que tan sano quedo segun las reglas del sistema.

## 12. Bloque "Mapeo" en modo edicion

1. El bloque `Mapeo` mantiene la misma arquitectura visual.
1.1. Se divide en `Input` y `Output`.
1.2. Cada campo se representa en una tarjeta.

2. La diferencia central es que las tarjetas ya no parten de defaults.
2.1. Parten de mappings persistidos.
2.2. El editor los hidrata y los reconstruye sobre la UI.

3. Eso hace que el usuario vea el historial de decisiones ya tomadas.
3.1. Que fuente se eligio.
3.2. Que path se uso.
3.3. Que transformaciones se aplicaron.
3.4. Si hubo valor manual o constante.

## 13. Como se leen las tarjetas de campo en modo edicion

1. Cada tarjeta de campo conserva la misma estructura de tres zonas.
1.1. Descripcion del campo.
1.2. Controles de origen y transformacion.
1.3. Preview.

2. Pero ahora esa tarjeta tiene otra carga semantica.
2.1. No solo dice "que podrias hacer".
2.2. Dice "que se hizo y que podrias corregir".

3. El usuario puede modificar cualquiera de esas decisiones.
3.1. Cambiar la fuente.
3.2. Ajustar path.
3.3. Editar transforms.
3.4. Reemplazar por `manual` o `constant`.

4. La preview sigue siendo clave.
4.1. Permite ver inmediatamente como cambia el valor resuelto.
4.2. Eso facilita revisar si la configuracion guardada todavia tiene sentido.

## 14. Fuente, path y transformaciones en modo edicion

1. Las mismas fuentes del modo creacion siguen disponibles.
1.1. `source.last_user_message`
1.2. `source.conversation_slice`
1.3. `source.surrounding_context`
1.4. `source.source_summary`
1.5. `source.session_notes`
1.6. `manual`
1.7. `constant`

2. La diferencia es que aqui ya existe una primera decision historica.
2.1. El usuario no esta explorando desde cero.
2.2. Esta contrastando lo guardado contra lo que ahora considera correcto.

3. Esto convierte al editor en una interfaz de mantenimiento y precision.

## 15. Bloque "Resultado" en modo edicion

1. El bloque `Resultado` sigue siendo el tercer gran paso del editor.
1.1. Contiene `Input JSON` y `Output JSON`.
1.2. Tambien mantiene los botones de reset desde mapping.

2. La diferencia es que aqui ambos payloads ya llegan persistidos.
2.1. No son solo previews iniciales.
2.2. Son la ultima version guardada del example.

3. Si el usuario no los toca:
3.1. El editor puede seguir mostrando el resultado calculado segun los mappings actuales.

4. Si el usuario los modifica:
4.1. Entra en override manual sobre un example ya existente.
4.2. Esto puede cambiar la version operativa del activo sin alterar necesariamente toda la tabla de mapeo.

5. Los botones de reset cumplen una funcion importante.
5.1. Permiten abandonar un override manual.
5.2. Permiten volver al resultado nacido del mapping actualizado.

## 16. Actualizacion del example

1. En lugar de `Guardar dataset example`, el CTA principal cambia.
1.1. `Actualizar dataset example`

2. Esta accion ya no crea una entidad nueva.
2.1. Actualiza el example existente.
2.2. Actualiza tambien el `source slice` asociado.
2.3. Reemplaza los field mappings previos por los nuevos.

3. En una actualizacion completa, la app realiza varias operaciones.
3.1. Actualiza el titulo del slice y el resumen del source slice.
3.2. Actualiza el spec del example si cambio.
3.3. Actualiza input y output payload.
3.4. Recalcula y guarda la validacion.
3.5. Elimina los mappings anteriores.
3.6. Inserta la nueva coleccion de mappings.
3.7. Actualiza metadata de procedencia.

4. Si todo sale bien:
4.1. La app redirige o refresca sobre el mismo detalle del example.

5. Si algo falla:
5.1. El usuario permanece en la pantalla.
5.2. Aparece feedback de error.
5.3. Puede corregir y volver a intentar.

## 17. Columna lateral de revision

1. A la derecha del editor principal aparece una columna secundaria.
1.1. Esta columna no existe en el modo creacion.
1.2. Es una de las diferencias visuales mas claras.

2. La columna lateral tiene dos bloques.
2.1. Formulario de `Review status`
2.2. Tarjeta de `Metadata`

3. Esta columna convierte al example en un activo revisable y trazable.

## 18. Formulario lateral de review status

1. El primer bloque lateral es una tarjeta corta para cambiar el `Review status`.
1.1. Tiene un selector.
1.2. Tiene un boton para guardar estado.

2. Su funcion es muy practica.
2.1. Permite cambiar solo el estado sin tener que reenviar todo el editor.

3. Esto es especialmente util para flujos de revision rapida.
3.1. Abrir el example.
3.2. Revisar.
3.3. Marcarlo como `approved`, `rejected` u otro estado.

4. Mentalmente, este formulario separa dos tipos de trabajo.
4.1. Editar contenido.
4.2. Cambiar el estatus curatorial.

## 19. Tarjeta lateral de metadata

1. Debajo del review form aparece una tarjeta `Metadata`.
1.1. Es corta.
1.2. Es informativa.

2. Muestra cuatro datos principales.
2.1. `Spec`
2.2. `Version`
2.3. `Source slice`
2.4. `Field mappings`

3. Esta tarjeta le da entidad al example.
3.1. No parece un simple formulario.
3.2. Parece un objeto versionado con origen y estructura.

4. Algunas lecturas utiles de esa metadata:
4.1. `Spec` dice bajo que contrato vive el example.
4.2. `Version` dice con que version del contrato fue guardado.
4.3. `Source slice` permite recordar que existe una entidad fuente separada.
4.4. `Field mappings` deja ver cuanta complejidad de resolucion tiene el example.

## 20. Diferencias esenciales respecto al modo creacion

1. En modo creacion:
1.1. Todo nace desde una seleccion viva del chat.

2. En modo edicion:
2.1. Todo nace desde un example ya persistido.

3. En modo creacion:
3.1. El regreso natural es al chat.

4. En modo edicion:
4.1. El regreso natural es a la biblioteca de examples.

5. En modo creacion:
5.1. El usuario esta construyendo el primer estado del example.

6. En modo edicion:
6.1. El usuario esta corrigiendo, refinando o revalidando un estado existente.

7. En modo creacion:
7.1. La pantalla no necesita sidebar de revision.

8. En modo edicion:
8.1. La sidebar se vuelve natural porque el activo ya entro al ciclo de revision.

## 21. Casos-evento principales de esta pantalla

1. Caso: abrir un example recien creado.
1.1. El usuario revisa que el source slice haya quedado correcto.
1.2. Ajusta algun mapping fino.
1.3. Corrige payloads.
1.4. Actualiza.

2. Caso: cambiar solo el estado.
2.1. El usuario usa el formulario lateral.
2.2. No toca el contenido principal.

3. Caso: detectar que el spec era incorrecto.
3.1. Cambia el `Dataset spec`.
3.2. La estructura del editor se recompone.
3.3. Luego revisa mappings, resultado y actualiza.

4. Caso: detectar que el mapping guardado ya no convence.
4.1. Revisa cada tarjeta.
4.2. Ajusta fuente, path o transform.
4.3. Mira previews.
4.4. Guarda una nueva version operativa del example.

5. Caso: detectar que solo hay que retocar el JSON final.
5.1. Interviene `Input JSON` o `Output JSON`.
5.2. Actualiza sin rehacer toda la tabla.

6. Caso: detectar errores o warnings en la validacion guardada.
6.1. Usa ese bloque como pista tecnica.
6.2. Corrige mappings o payloads.
6.3. Guarda de nuevo para recalcular estado.

## 22. Imagen mental final de la pantalla

1. Si tuvieras que imaginarla sin verla, seria asi:
1.1. Arriba, una tarjeta discreta para volver a la biblioteca.
1.2. A la izquierda, un gran editor casi igual al de creacion, con `Fuente`, `Mapeo` y `Resultado`, pero todo ya cargado.
1.3. A la derecha, una columna corta con cambio de estado y metadata del activo.
1.4. El transcript fuente, los mappings y los JSON finales aparecen como la version actual del example, no como una primera construccion.

2. En una sola frase:
2.1. El editor de dataset example en modo edicion se ve como una mesa de revision estructurada donde un example ya persistido puede refinarse, revalidarse y quedar listo para su ciclo final de aprobacion y exportacion.
