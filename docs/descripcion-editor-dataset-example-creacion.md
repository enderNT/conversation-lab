# Descripcion funcional y visual del editor de dataset example en modo creacion

## 1. Idea general de la pantalla

1. Esta pantalla es la continuacion mas directa del chat.
1.1. Nace cuando el usuario selecciona un slice consecutivo de mensajes y pulsa `Mapear a DSPy`.
1.2. Aqui la conversacion deja de ser solo transcript.
1.3. Se convierte en materia prima estructurable.

2. La pantalla ya no se siente como chat.
2.1. Se siente como un taller de transformacion.
2.2. El usuario entra con un recorte de conversacion.
2.3. Sale con un dataset example listo para guardar.

3. Mentalmente, esta pantalla responde a una pregunta muy concreta.
3.1. "De este fragmento del chat, como construyo un ejemplo estructurado, validable y exportable?"

## 2. Rol de esta pantalla dentro del flujo general

1. El flujo completo alrededor de esta pantalla se puede leer asi:
1.1. `Chat -> Seleccion de turnos -> Editor de dataset example -> Guardado -> Biblioteca de examples`

2. Su rol no es revisar ejemplos ya guardados.
2.1. Su rol es crear uno nuevo desde cero.
2.2. O, mas precisamente, crear uno nuevo a partir de una seleccion ya hecha.

3. Por eso esta pantalla vive entre dos mundos.
3.1. Hacia atras, todavia depende del transcript y del slice elegido.
3.2. Hacia adelante, ya apunta a biblioteca, revision y exportacion.

## 3. Como se llega a esta pantalla

1. El usuario no llega aqui por navegacion libre como primer paso.
1.1. Llega desde el chat.
1.2. Debe existir una seleccion valida de mensajes consecutivos.

2. Esa seleccion queda representada por dos indices.
2.1. `start`
2.2. `end`

3. Si la seleccion no existe o esta mal formada:
3.1. La ruta no se considera valida.
3.2. La pantalla no se construye.

4. Eso significa que esta pagina siempre presupone una intencion curatorial.
4.1. No se abre "en blanco".
4.2. Siempre arranca con un source slice real.

## 4. Sensacion visual general

1. Aunque mantiene el mismo lenguaje visual de la app, la composicion cambia respecto al chat.
1.1. Hay menos inmersion conversacional.
1.2. Hay mas estructura de formulario editorial.

2. La pantalla se organiza en grandes bloques apilados.
2.1. Un pequeno bloque superior de regreso.
2.2. Un gran bloque `Fuente`.
2.3. Un gran bloque `Mapeo`.
2.4. Un gran bloque `Resultado`.

3. La sensacion es de embudo.
3.1. Primero miras la fuente.
3.2. Luego defines de donde sale cada campo.
3.3. Finalmente inspeccionas y corriges el JSON final.

## 5. Bloque superior de regreso

1. La parte mas alta de la pantalla contiene una tarjeta muy sencilla.
1.1. Dentro de ella hay un enlace `Volver al chat`.

2. Ese enlace hace dos cosas mentalmente.
2.1. Recuerda que este editor nace desde una sesion concreta.
2.2. Mantiene visible la continuidad entre transcript y example.

3. Es una salida limpia.
3.1. Si el usuario siente que eligio mal el slice, puede regresar.
3.2. Si necesita volver a leer mas contexto en el chat, puede hacerlo.

## 6. Estructura global del editor

1. El editor principal esta dividido en tres grandes areas funcionales.
1.1. `Fuente`
1.2. `Mapeo`
1.3. `Resultado`

2. Cada area tiene una responsabilidad distinta.
2.1. `Fuente`: describe y muestra el material de origen.
2.2. `Mapeo`: define como cada campo del spec se llena.
2.3. `Resultado`: muestra y permite editar el JSON final.

3. Esta separacion es muy importante para entender la UX.
3.1. No es un formulario plano.
3.2. Es una cadena de transformacion visible.

## 7. Bloque "Fuente"

1. Este es el primer gran bloque del editor.
1.1. Ocupa la parte superior del contenido real.
1.2. Visualmente se percibe como la zona de contexto y origen.

2. El encabezado del bloque explica el modo actual.
2.1. Una etiqueta pequena dice `Fuente`.
2.2. El titulo principal dice algo como `Nuevo editor DSPy`.
2.3. Debajo hay un texto corto explicando que se esta revisando el slice seleccionado y definiendo la firma final.

3. En la esquina o lateral superior aparece una pequena tarjeta del spec actual.
3.1. Muestra nombre del spec.
3.2. Muestra `slug`.
3.3. Muestra `version`.

4. Esta tarjeta contextual le dice al usuario cual contrato esta intentando satisfacer el example.

## 8. Distribucion interna del bloque "Fuente"

1. Dentro del bloque `Fuente`, la composicion se divide en dos columnas en pantallas grandes.
1.1. Columna izquierda: informacion editable del example y transcript seleccionado.
1.2. Columna derecha: configuracion contextual, validacion y auxiliares.

2. En mobile, estas columnas se apilan.
2.1. Primero ves el lado de contenido principal.
2.2. Luego la columna contextual.

## 9. Zona izquierda: identidad del example y transcript

1. La zona izquierda empieza con dos campos cortos.
1.1. `Titulo del example`
1.2. `Titulo del slice`

2. `Titulo del example` sirve para nombrar el activo final que se guardara.
2.1. Es un titulo editorial o curatorial.
2.2. Ayuda luego a reconocer el example en la biblioteca.

3. `Titulo del slice` sirve para nombrar el recorte fuente.
3.1. Este titulo suele venir sugerido desde la sesion y el rango de turnos.
3.2. Pero el usuario puede afinarlo.

4. Debajo aparece el campo `Resumen curatorial`.
4.1. Este texto resume por que ese slice es util.
4.2. No es transcript.
4.3. Es interpretacion breve del valor del recorte.

5. Luego aparece una gran seccion llamada `Transcript seleccionado`.
5.1. Aqui se ven los mensajes concretos elegidos desde el chat.
5.2. Cada turno aparece como mini tarjeta.
5.3. Cada mini tarjeta conserva:
5.4. Rol
5.5. Numero de turno
5.6. Texto del mensaje

6. Esta zona cumple una funcion clave.
6.1. El usuario no mapea a ciegas.
6.2. Siempre puede volver a leer el material original mientras decide.

## 10. Zona derecha: contexto y configuracion auxiliar

1. La columna derecha agrupa cuatro piezas.
1.1. Selector de `Dataset spec`
1.2. Selector de `Estado`
1.3. Bloque de `Contexto auxiliar`
1.4. Bloque de `Ultima validacion guardada`

### 10.1. Selector de dataset spec

1. El primer campo importante es `Dataset spec`.
1.1. Permite elegir el contrato que guiara el example.

2. El spec controla:
2.1. Que campos de input existen.
2.2. Que campos de output existen.
2.3. Que tipos esperan.
2.4. Como se validan.

3. Cuando el usuario cambia de spec:
3.1. El editor recalcula o reinicia mappings.
3.2. Se reconstruye la tabla de mapeo segun los campos del nuevo contrato.
3.3. Los overrides manuales de resultado vuelven a estado no forzado.

4. En modo creacion, el spec inicial suele ser:
4.1. El ultimo dataset spec usado recientemente, si existe.
4.2. O el primero disponible del catalogo.

### 10.2. Selector de estado

1. El segundo campo es `Estado`.
1.1. Aqui se define el review status inicial del example.

2. Normalmente arranca en `draft`.
2.1. Eso indica que el example se esta creando, pero aun no fue aprobado.

3. Este estado acompana al example desde el nacimiento.
3.1. Ya no es solo un borrador mental.
3.2. Queda etiquetado como activo dentro del sistema de revision.

### 10.3. Contexto auxiliar

1. El bloque `Contexto auxiliar` muestra mensajes cercanos al slice.
1.1. No forman parte del recorte principal.
1.2. Pero ayudan a entender mejor el entorno conversacional.

2. Visualmente se muestran como un `pre` o bloque JSON legible.
2.1. Si no hay contexto adicional, la pantalla lo dice explicitamente.

3. Este bloque sirve para decisiones finas de mapeo.
3.1. Si un campo depende de algo dicho justo antes o despues, aqui puede detectarse.

### 10.4. Ultima validacion guardada

1. En modo creacion, este bloque suele indicar que aun no hay validacion previa real.
1.1. Puede mostrar que todavia no se ha validado nada.

2. Si hubiera algun estado inicial, aparecerian aqui:
2.1. `Shape valido` o equivalente
2.2. Errores estructurales
2.3. Advertencias semanticas

3. Mentalmente, este cuadro anticipa que el example no es solo visualmente bonito.
3.1. Tambien debe cumplir reglas de forma y consistencia.

## 11. Bloque "Mapeo"

1. Este es el corazon tecnico del editor.
1.1. La etiqueta del bloque dice `Mapeo`.
1.2. El titulo explica que aqui se selecciona la fuente y la transformacion por campo.

2. El bloque se divide en dos subzonas grandes.
2.1. `Input`
2.2. `Output`

3. Cada una contiene una serie de tarjetas de campo.
3.1. Una tarjeta por cada campo definido por el dataset spec.

4. Este bloque es importante porque vuelve explicito algo que en otras apps queda oculto.
4.1. De donde sale cada dato.
4.2. Como se transforma.
4.3. Que valor concreto producira.

## 12. Como se ve cada tarjeta de campo

1. Cada campo vive dentro de una tarjeta propia.
1.1. La tarjeta suele organizarse en tres columnas amplias en desktop.
1.2. En mobile baja verticalmente.

2. La zona izquierda de la tarjeta describe el campo.
2.1. Nombre del campo
2.2. Badge visual de si es requerido o no
2.3. Tipo de dato
2.4. Descripcion textual

3. La zona central permite intervenir sobre el origen del dato.
3.1. Fuente
3.2. Path
3.3. Transformaciones
3.4. Valor manual o constante

4. La zona derecha muestra el `Preview`.
4.1. Es decir, el valor resuelto actualmente para ese campo.

## 13. Opciones de fuente por campo

1. Cada campo puede resolverse desde una fuente explicita.
1.1. `source.last_user_message`
1.2. `source.conversation_slice`
1.3. `source.surrounding_context`
1.4. `source.source_summary`
1.5. `source.session_notes`
1.6. `manual`
1.7. `constant`

2. Esto significa que el editor no inventa datos en secreto.
2.1. Todo queda trazable.
2.2. Cada valor tiene un origen visible.

3. Algunas lecturas mentales de esas fuentes:
3.1. `last_user_message` sirve para preguntas finales o prompts concretos.
3.2. `conversation_slice` sirve para campos que necesitan historia o turns.
3.3. `surrounding_context` sirve para contexto cercano fuera del slice.
3.4. `source_summary` sirve para reinterpretaciones curadas.
3.5. `session_notes` sirve para rescatar notas humanas de la sesion.
3.6. `manual` y `constant` sirven cuando el valor debe imponerse a mano.

## 14. Path, transformaciones y override

1. Cada mapping puede afinarse con un `Path`.
1.1. Esto sirve para entrar dentro de estructuras mas complejas.
1.2. Por ejemplo, extraer una parte concreta de una conversacion o de un valor ya estructurado.

2. Tambien puede aplicarse una cadena de transformaciones.
2.1. El usuario las escribe como una secuencia.
2.2. Algunas pueden ser `trim`, `join_lines`, `pick_path`, `pick_turns`, `wrap_array`, `to_string`, `to_boolean` o `template`.

3. Ademas, la tarjeta ofrece un area de texto para imponer un valor.
3.1. Si la fuente es `constant`, el texto se interpreta como valor fijo.
3.2. Si la fuente es `manual`, el texto se vuelve override humano directo.

4. Esta combinacion hace al editor muy flexible.
4.1. Puede usar datos literales del transcript.
4.2. Puede refinarlos.
4.3. Y puede romper deliberadamente la automatizacion cuando hace falta.

## 15. Preview de cada campo

1. A la derecha de cada tarjeta aparece un bloque `Preview`.
1.1. Aqui se muestra el valor resuelto en ese momento.

2. Esta preview es una de las piezas mas importantes de toda la UX.
2.1. Evita que el mapping sea abstracto.
2.2. Permite verificar inmediatamente si la fuente y las transformaciones elegidas tienen sentido.

3. Si el valor aun no puede resolverse:
3.1. La pantalla lo expresa con un estado tipo "sin resolver todavia".

4. Gracias a esto, el usuario puede iterar rapido.
4.1. Cambia la fuente.
4.2. Ajusta path o transform.
4.3. Ve el resultado al instante.

## 16. Comportamiento del bloque "Mapeo" cuando cambia el spec

1. Si el usuario cambia el `Dataset spec`, el bloque de mapeo se reconstruye.
1.1. Los campos de input y output cambian segun el contrato elegido.

2. En modo creacion, eso implica:
2.1. Nuevos defaults inferidos por nombre de campo y tipo.
2.2. Recalculo del payload estimado.
2.3. Reseteo de overrides manuales del resultado final.

3. Esto refuerza la idea de que el spec es la estructura maestra de la pantalla.

## 17. Bloque "Resultado"

1. El tercer gran bloque se llama `Resultado`.
1.1. El titulo dice que aqui vive el JSON final editable con override explicito.

2. Esta area representa el ultimo paso antes del guardado.
2.1. El mapping ya intento construir los payloads.
2.2. Ahora el usuario los inspecciona como JSON real.

3. Visualmente, el bloque muestra dos textareas grandes en paralelo.
3.1. `Input JSON`
3.2. `Output JSON`

4. Encima o junto al titulo hay dos botones secundarios.
4.1. `Reset input desde mapping`
4.2. `Reset output desde mapping`

## 18. Logica del resultado final

1. Mientras el usuario no toque manualmente esos JSON:
1.1. El editor muestra la version calculada a partir del mapping.

2. En cuanto el usuario edita uno de los dos:
2.1. Ese lado entra en modo manual override.
2.2. El payload deja de depender solo del mapping.

3. Si luego el usuario pulsa `Reset`:
3.1. Se abandona el override manual.
3.2. Vuelve a mostrarse el payload calculado automaticamente.

4. Esta parte vuelve al sistema semiautomatico.
4.1. No obliga al usuario a aceptar el mapping.
4.2. Pero tampoco le quita la comodidad de generarlo primero.

## 19. Guardado del example

1. Al final del bloque `Resultado` aparece el CTA principal.
1.1. `Guardar dataset example`

2. Junto a ese boton suele aparecer una aclaracion breve.
2.1. El guardado valida la estructura.
2.2. Tambien persiste mappings y payloads finales.

3. Cuando el usuario guarda, la app realiza varias operaciones.
3.1. Reconstituye el source slice a partir de la seleccion original.
3.2. Persiste ese source slice como entidad propia.
3.3. Guarda el dataset example.
3.4. Guarda los field mappings uno por uno.
3.5. Genera y guarda el estado de validacion.
3.6. Guarda metadatos de procedencia.

4. Si todo sale bien:
4.1. La app redirige al detalle del dataset example ya creado.

5. Si algo falla:
5.1. El usuario permanece en el editor.
5.2. Aparece feedback de error.
5.3. Puede corregir JSON o mappings y volver a intentar.

## 20. Que sucede en los casos-evento mas importantes

1. Caso: el usuario entra desde un slice bien elegido.
1.1. Ve el transcript correcto.
1.2. Ajusta titulo y resumen.
1.3. Mapea campos.
1.4. Guarda.

2. Caso: el transcript seleccionado es correcto pero el spec no.
2.1. Cambia el `Dataset spec`.
2.2. El editor rehace la estructura del mapping.

3. Caso: un campo no se resuelve bien.
3.1. Cambia fuente.
3.2. Ajusta path.
3.3. Aplica transformaciones.
3.4. Mira el preview hasta que quede correcto.

4. Caso: el mapping no basta.
4.1. Usa `manual` o `constant` a nivel campo.
4.2. O interviene directamente el `Input JSON` y `Output JSON`.

5. Caso: quiere corregir solo el resultado final.
5.1. No necesita rehacer toda la tabla.
5.2. Puede editar los JSON finales a mano.

6. Caso: quiere volver a la version calculada.
6.1. Usa los botones de reset.
6.2. Recupera el resultado nacido del mapping.

7. Caso: quiere revisar si el slice realmente tenia sentido.
7.1. Relee el transcript seleccionado.
7.2. Revisa contexto auxiliar.
7.3. Si hace falta, regresa al chat con el enlace superior.

## 21. Imagen mental final de la pantalla

1. Si tuvieras que imaginarla sin verla, seria asi:
1.1. Arriba, una pequena tarjeta para volver al chat.
1.2. Debajo, una gran seccion `Fuente` con titulo, resumen y el transcript recortado.
1.3. A la derecha de esa fuente, el selector de spec, el estado y el contexto auxiliar.
1.4. Mas abajo, una gran seccion `Mapeo` dividida en `Input` y `Output`, llena de tarjetas de campo con origen, transformaciones y preview.
1.5. Al final, una seccion `Resultado` con dos grandes textareas JSON y el boton para guardar.

2. En una sola frase:
2.1. El editor de dataset example en modo creacion se ve como un taller estructurado donde un recorte del chat se convierte, campo por campo, en un ejemplo DSPy listo para persistirse.
