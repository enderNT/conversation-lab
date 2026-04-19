# Descripcion funcional y visual del detalle de proyecto

## 1. Idea general de la pantalla

1. La pantalla de detalle de proyecto es el tablero operativo de un proyecto especifico.
1.1. Ya no estas en la portada general de la app.
1.2. Tampoco estas todavia dentro de un chat.
1.3. Estas en el espacio intermedio donde se organiza el trabajo conversacional de ese proyecto.

2. Mentalmente, esta pantalla responde a una pregunta simple.
2.1. "Dentro de este proyecto, que sesiones existen y como creo la siguiente?"

3. La composicion visual transmite justo eso.
3.1. Arriba ves el resumen del proyecto.
3.2. A un lado tienes la accion para crear una sesion nueva.
3.3. Abajo ves la coleccion de sesiones existentes, listas para abrirse o clasificarse.

## 2. Rol de esta pantalla dentro del flujo completo

1. Esta pantalla conecta dos mundos.
1.1. Hacia atras, viene de la home y del listado de proyectos.
1.2. Hacia adelante, conduce a las sesiones de chat.

2. La secuencia mental es esta:
2.1. `Home -> Proyecto -> Sesion -> Slice -> Dataset Example`

3. Por eso, el detalle de proyecto funciona como antesala del trabajo real.
3.1. No es solo un resumen administrativo.
3.2. Es una pantalla de lanzamiento de sesiones.

## 3. Estructura general de la pantalla

1. La pantalla se divide en dos grandes bloques.
1.1. Bloque superior con resumen del proyecto y formulario para crear sesion.
1.2. Bloque inferior con el listado de sesiones del proyecto.

2. En desktop, el bloque superior se siente como dos columnas.
2.1. Izquierda: tarjeta principal del proyecto.
2.2. Derecha: tarjeta para crear nueva sesion.

3. En mobile, esas dos piezas se apilan.
3.1. Primero aparece el resumen del proyecto.
3.2. Luego aparece el formulario de nueva sesion.
3.3. Debajo baja el listado de sesiones.

## 4. Tarjeta principal del proyecto

1. La tarjeta principal ocupa la zona superior izquierda.
1.1. Tiene fondo claro, borde suave y esquinas muy redondeadas.
1.2. Se percibe como la ficha oficial del proyecto.

2. En la parte superior de esta tarjeta aparece un enlace de regreso.
2.1. Ese enlace lleva de vuelta al listado de proyectos.
2.2. Visualmente es discreto, en texto pequeno y subrayado.
2.3. Su funcion es recordarte que sigues dentro de una jerarquia mayor.

3. Debajo aparece el nombre del proyecto como titulo principal.
3.1. Es el elemento visual mas fuerte de esta tarjeta.
3.2. Justo debajo aparece la descripcion.
3.3. Si el proyecto no tiene descripcion, la pantalla muestra un texto de fallback.

4. Mas abajo aparecen tres mini tarjetas internas de metricas.
4.1. `Sessions`
4.2. `Slices`
4.3. `Created`

5. Estas metricas sirven para leer rapido el estado del proyecto.
5.1. `Sessions` indica cuantas conversaciones existen dentro de este proyecto.
5.2. `Slices` indica cuantos recortes o source slices ya se generaron.
5.3. `Created` ancla temporalmente el proyecto con su fecha de origen.

6. Al final de esta tarjeta aparece una accion secundaria.
6.1. `View dataset examples`
6.2. Esta accion lleva a la biblioteca de dataset examples filtrada por este proyecto.

7. Mentalmente, esta tarjeta resume identidad y estado.
7.1. Que proyecto es.
7.2. Cuanto trabajo acumula.
7.3. Si quieres seguir por sesiones o por examples ya curados.

## 5. Tarjeta para crear una nueva sesion

1. A la derecha del resumen del proyecto aparece la tarjeta para crear sesion.
1.1. Es mas compacta que la ficha del proyecto.
1.2. Pero es la accion principal de toda la pantalla.

2. Su contenido es directo.
2.1. Un titulo corto: crear sesion.
2.2. Una pequena explicacion de que el titulo puede ser breve o incluso dejarse vacio.
2.3. Un campo `Title`.
2.4. Un boton principal para crear.

3. Esta tarjeta cumple una funcion muy clara.
3.1. No hace falta entrar a un submenu para iniciar una conversacion nueva.
3.2. Desde el propio tablero del proyecto se crea la siguiente sesion.

4. Cuando el usuario envia este formulario:
4.1. La app crea la sesion dentro del proyecto actual.
4.2. Si todo sale bien, redirige directamente a la pantalla de esa nueva sesion.
4.3. Es decir, no vuelve al proyecto para pedir un segundo click.

5. Si el usuario deja vacio el titulo:
5.1. La sesion se crea igual.
5.2. Luego aparecera como una sesion sin titulo explicito o con un fallback visual.

## 6. Encabezado de la seccion de sesiones

1. Debajo del bloque superior aparece la seccion `Sessions`.
1.1. El encabezado tiene el titulo de la seccion a la izquierda.
1.2. A la derecha hay un texto corto que explica para que sirve abrir una sesion.

2. Ese texto resume el proposito practico.
2.1. Abrir una sesion para conversar con el modelo.
2.2. Seleccionar slices consecutivos.

3. Este pequeno encabezado prepara el cambio de contexto.
3.1. Arriba estabas mirando el proyecto como contenedor.
3.2. Aqui empiezas a mirarlo como coleccion de conversaciones.

## 7. Estado vacio del proyecto

1. Si el proyecto todavia no tiene sesiones, la pantalla lo dice de forma explicita.
1.1. Aparece una tarjeta vacia ancha dentro de la seccion de sesiones.
1.2. El texto informa que ese proyecto aun no tiene sesiones.

2. Este estado vacio tiene dos efectos.
2.1. No deja la pantalla "rota" o desierta.
2.2. Empuja de manera natural al usuario a la tarjeta de crear sesion.

3. En ese escenario, la pantalla se lee asi:
3.1. El proyecto existe.
3.2. Aun no hay conversaciones.
3.3. El siguiente paso obvio es crear la primera sesion.

## 8. Grilla de sesiones del proyecto

1. Si el proyecto ya tiene sesiones, aparece una grilla de tarjetas.
1.1. En pantallas grandes suele verse en dos columnas.
1.2. En mobile baja a una sola columna.

2. La grilla organiza las sesiones como piezas independientes de trabajo.
2.1. No se ven como filas austeras de tabla.
2.2. Se ven como tarjetas con suficiente contexto para decidir sin abrir cada una.

3. Las sesiones estan ordenadas por fecha de creacion descendente.
3.1. La mas reciente aparece primero.
3.2. Esto convierte la pantalla en una vista de continuidad del trabajo mas reciente.

## 9. Como se ve cada tarjeta de sesion

1. Cada sesion vive dentro de una tarjeta redondeada.
1.1. Mantiene el mismo lenguaje visual del resto de la app.
1.2. Fondo claro, bordes suaves, sombra ligera y bastante aire interno.

2. En la parte superior aparece una pequena etiqueta contextual.
2.1. `Session 1`
2.2. `Session 2`
2.3. Y asi sucesivamente segun la posicion en la lista.

3. Debajo aparece el titulo de la sesion.
3.1. Si la sesion tiene titulo, se muestra ese nombre.
3.2. Si no tiene, aparece un fallback tipo `Untitled session`.

4. Debajo del titulo aparece la fecha de creacion.
4.1. Esto ayuda a leer la historia del proyecto.
4.2. Tambien ayuda a distinguir sesiones con nombres parecidos.

## 10. Zona de etiquetas dentro de cada sesion

1. Una de las partes mas activas de la tarjeta es el bloque de etiquetas.
1.1. No hace falta abrir la sesion para clasificarla.
1.2. El etiquetado ocurre directamente desde la tarjeta del proyecto.

2. Si la sesion no tiene etiquetas:
2.1. Se muestra un texto corto indicando que no hay etiquetas.

3. Si ya tiene etiquetas:
3.1. Cada una aparece como una pastilla visual.
3.2. Cada pastilla incluye el nombre.
3.3. Tambien incluye una `x` para quitarla.

4. Debajo del listado de etiquetas hay dos acciones rapidas.
4.1. Asignar una etiqueta existente desde un selector.
4.2. Crear una etiqueta nueva y asignarla de inmediato.

5. Evento: asignar etiqueta existente.
5.1. El usuario abre el selector.
5.2. Solo aparecen etiquetas aun no asignadas a esa sesion.
5.3. Pulsa `Anadir`.
5.4. La sesion se actualiza y aparece feedback toast.

6. Evento: quitar etiqueta.
6.1. El usuario pulsa la `x` en una pastilla.
6.2. La etiqueta desaparece de la sesion.
6.3. La pantalla se refresca con feedback visual.

7. Evento: crear etiqueta rapida.
7.1. El usuario escribe un nombre en el campo inferior.
7.2. Pulsa `Crear`.
7.3. La app crea la etiqueta si no existia y la asigna a esa sesion.
7.4. El campo se limpia y aparece confirmacion.

8. Esta zona convierte la tarjeta de sesion en algo mas que un simple acceso.
8.1. Tambien la vuelve un objeto clasificable desde el tablero de proyecto.

## 11. Metricas dentro de cada tarjeta de sesion

1. Debajo del bloque de etiquetas aparecen dos mini tarjetas internas.
1.1. `Messages`
1.2. `Slices`

2. `Messages` indica cuanto transcript tiene esa sesion.
2.1. Si el numero es bajo, probablemente sea una conversacion corta o nueva.
2.2. Si es alto, probablemente sea una sesion ya madura.

3. `Slices` indica cuantos recortes utiles se han derivado de esa sesion.
3.1. Esto es importante porque mide productividad curatorial, no solo actividad conversacional.

4. Estas dos metricas juntas ayudan a leer el tipo de sesion.
4.1. Muchas mensajes y cero slices puede significar chat sin curacion todavia.
4.2. Pocos mensajes y varios slices puede indicar conversacion muy densa y util.

## 12. Boton principal de cada sesion

1. En la parte inferior de cada tarjeta aparece el CTA principal.
1.1. `Open Session`

2. Este boton es la salida natural hacia el flujo principal de la app.
2.1. Al pulsarlo, se abre la pantalla de chat de esa sesion.
2.2. Desde ahi ya se conversa, se seleccionan turnos y se generan examples.

3. Mentalmente, este boton convierte la tarjeta de sesion en portal.
3.1. La tarjeta resume.
3.2. El boton profundiza.

## 13. Eventos principales de la pantalla de detalle de proyecto

1. Entrar desde la home.
1.1. El usuario viene desde una tarjeta de proyecto con `Open Project`.
1.2. Aqui aterriza en el tablero concreto de ese proyecto.

2. Volver al listado de proyectos.
2.1. Usa el enlace `Back to projects`.
2.2. Regresa al nivel superior sin perder la estructura mental.

3. Crear sesion nueva.
3.1. Completa o no el titulo.
3.2. Envia.
3.3. La app crea la sesion.
3.4. Redirige inmediatamente al chat de esa sesion.

4. Abrir examples del proyecto.
4.1. Usa `View dataset examples`.
4.2. Llega a la biblioteca de dataset examples filtrada por este proyecto.

5. Abrir una sesion existente.
5.1. Pulsa `Open Session`.
5.2. Entra al chat de esa sesion concreta.

6. Clasificar sesiones sin abrirlas.
6.1. Anade o quita etiquetas desde las propias tarjetas.
6.2. Esto permite organizar el proyecto desde la vista intermedia.

## 14. Como cambia la pantalla segun el estado del proyecto

1. Proyecto nuevo, sin sesiones.
1.1. La zona superior domina visualmente.
1.2. El resumen del proyecto y la creacion de sesion son lo principal.
1.3. La parte inferior solo muestra estado vacio.

2. Proyecto con varias sesiones pero poca curacion.
2.1. Las tarjetas mostraran mensajes, pero tal vez pocos slices.
2.2. La pantalla se percibe como un historial de conversaciones.

3. Proyecto maduro, con varias sesiones y slices.
3.1. Las metricas altas de sesiones y slices cambian la lectura.
3.2. La pantalla ya no parece un tablero de inicio.
3.3. Parece una base de trabajo consolidada.

4. Proyecto muy etiquetado.
4.1. Las tarjetas se llenan de pastillas de clasificacion.
4.2. Eso hace que la pantalla se sienta mas editorial y curada.

## 15. Imagen mental de la pantalla

1. Si tuvieras que imaginarla sin verla, seria algo asi:
1.1. Arriba, una gran ficha del proyecto con su nombre, descripcion y tres metricas.
1.2. A su lado, una tarjeta mas compacta para crear la siguiente sesion.
1.3. Debajo, un titulo `Sessions` y una explicacion corta.
1.4. Luego una grilla de tarjetas, cada una representando una conversacion del proyecto.
1.5. Cada tarjeta muestra titulo, fecha, etiquetas editables, numero de mensajes, numero de slices y un boton para entrar.

2. En una sola frase:
2.1. El detalle de proyecto se ve como un tablero de coordinacion donde un proyecto se resume arriba y sus conversaciones operables se despliegan abajo.

## 16. Rol real de esta pantalla dentro de la aplicacion

1. Esta pantalla no es la portada general.
1.1. Tampoco es el nucleo del trabajo conversacional.

2. Su rol real es ordenar el acceso al trabajo por proyecto.
2.1. Resume el proyecto.
2.2. Permite crear la siguiente sesion.
2.3. Muestra el inventario de sesiones ya existentes.
2.4. Permite clasificar esas sesiones rapidamente.
2.5. Redirige tanto al chat como a la biblioteca de examples del proyecto.

3. Dicho simple:
3.1. Es la antesala estructurada del chat y del dataset dentro de un proyecto concreto.
