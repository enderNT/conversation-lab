# Descripcion funcional y visual de la pantalla de chat

## 1. Idea general de la pantalla

1. La pantalla de chat es el nucleo real de la aplicacion.
1.1. Aqui es donde la app deja de verse como catalogo o tablero.
1.2. Aqui se convierte en una estacion de trabajo inmersiva.
1.3. No es solo una interfaz para conversar con un LLM.
1.4. Es una interfaz para conversar, corregir, seleccionar, clasificar y convertir partes del transcript en materia prima para dataset.

2. Mentalmente, esta pantalla mezcla dos productos en uno.
2.1. Un chat persistente con historial.
2.2. Un editor de seleccion y curacion de conversaciones.

3. La sensacion visual general es de chat de alta concentracion.
3.1. El transcript ocupa el centro de casi toda la experiencia.
3.2. Las herramientas adicionales viven en menus, drawers o modales.
3.3. Eso hace que el chat siga siendo protagonista aunque haya muchas funciones alrededor.

## 2. Rol de esta pantalla dentro del flujo de la app

1. El flujo completo se puede leer asi:
1.1. `Home -> Proyecto -> Sesion de chat -> Seleccion de slice -> Dataset example -> Revision -> Exportacion`

2. Dentro de esa secuencia, la pantalla de chat cumple la funcion mas delicada.
2.1. Produce el material base.
2.2. Organiza la conversacion.
2.3. Permite detectar fragmentos utiles.
2.4. Abre el salto hacia el mapping DSPy.

3. Si la home organiza proyectos y el detalle de proyecto organiza sesiones, la pantalla de chat organiza contenido conversacional util.

## 3. Estructura general de la pantalla

1. La pantalla se puede imaginar en tres bandas horizontales.
1.1. Header superior de control.
1.2. Cuerpo central con transcript.
1.3. Footer inferior con compositor y acciones sobre la seleccion.

2. Encima de esas tres bandas pueden aparecer capas adicionales.
2.1. Drawer de historial de chats.
2.2. Drawer de notas.
2.3. Drawer de etiquetas.
2.4. Drawer de dataset y seleccion.
2.5. Sheet centrado de configuracion LLM.
2.6. Confirmaciones para limpiar o eliminar.

3. Eso crea una experiencia de foco.
3.1. El transcript siempre es el escenario base.
3.2. Las herramientas aparecen sobre el escenario cuando hacen falta.

## 4. Header superior del chat

1. El header superior tiene tres zonas muy claras.
1.1. Izquierda: navegacion basica.
1.2. Centro: informacion resumida de la sesion.
1.3. Derecha: menu contextual de herramientas.

### 4.1. Zona izquierda del header

1. A la izquierda aparecen dos botones circulares.
1.1. Un boton para volver al proyecto.
1.2. Un boton para abrir el historial de chats del proyecto.

2. El boton de volver al proyecto:
2.1. Devuelve al detalle del proyecto actual.
2.2. Sirve como salida directa del modo inmersivo del chat.

3. El boton de historial:
3.1. No saca de la pantalla.
3.2. Solo abre un drawer lateral con las otras sesiones del mismo proyecto.

### 4.2. Zona central del header

1. En el centro se resume la identidad operativa de la sesion.
1.1. Nombre del proyecto.
1.2. Fecha de creacion de la sesion.
1.3. Numero de mensajes.
1.4. Numero de slices.

2. Si no hay ninguna seleccion activa, esta zona actua como resumen pasivo.

3. Si existe una seleccion activa, aparece un boton extra:
3.1. `Limpiar seleccion`
3.2. Esto permite volver al estado neutro del transcript.

### 4.3. Zona derecha del header

1. A la derecha aparece un boton de menu de tres puntos.
1.1. Este boton abre el panel de acciones contextuales del chat.

2. El menu muestra cinco accesos:
2.1. `Dataset y seleccion`
2.2. `Configuracion LLM`
2.3. `Notas del chat`
2.4. `Etiquetas del chat`
2.5. `Herramientas`

3. La seccion `Herramientas` despliega acciones mas delicadas.
3.1. `Limpiar chat`
3.2. `Dataset examples`
3.3. `Eliminar chat`

4. Este menu es importante porque agrupa todo lo que rodea al transcript sin ensuciar la pantalla principal.

## 5. Estado general del chat antes de conversar

1. Si la sesion no tiene mensajes, el cuerpo central no queda vacio sin contexto.
1.1. Se muestra una gran superficie centrada con texto explicativo.
1.2. El texto dice que la sesion aun no tiene conversacion.
1.3. Tambien sugiere configurar el modelo si hace falta y mandar el primer mensaje desde el compositor inferior.

2. Este estado vacio no se siente como error.
2.1. Se siente como una mesa preparada.
2.2. Todo esta listo, pero la conversacion aun no empieza.

## 6. Cuerpo central: el transcript

1. El transcript ocupa la mayor parte de la pantalla.
1.1. Es una columna desplazable.
1.2. Se autoajusta para mantener el foco abajo cuando aparecen mensajes nuevos.

2. Cada mensaje se representa como una gran tarjeta-burbuja.
2.1. Los mensajes del usuario se alinean a la derecha.
2.2. Los del asistente se alinean a la izquierda.
2.3. Ambos usan fondos suaves distintos, lo que permite distinguir roles de un vistazo.

3. Cada tarjeta muestra informacion contextual.
3.1. Rol: `Usuario` o `Asistente`
3.2. Numero de turno
3.3. Fecha
3.4. Si fue editado, una marca de `Editado`

4. El texto del mensaje se muestra en formato multilinea.
4.1. Conserva saltos de linea.
4.2. Eso ayuda a leer prompts largos o respuestas extensas.

## 7. El transcript no es pasivo: seleccion de mensajes

1. Cada tarjeta del transcript puede pulsarse.
1.1. Al pulsarla, participa en una seleccion por rango.

2. La logica de seleccion funciona con dos puntos.
2.1. Un ancla.
2.2. Un foco.

3. El resultado no es una seleccion arbitraria de mensajes dispersos.
3.1. La seleccion siempre forma un rango consecutivo.
3.2. Eso es clave porque la app trabaja con `slices` continuos de conversacion.

4. Cuando una seleccion esta activa:
4.1. Los mensajes dentro del rango quedan resaltados.
4.2. El header muestra el boton para limpiar seleccion.
4.3. El footer muestra un panel especial para ese slice activo.

5. La seleccion convierte el transcript en herramienta de curacion.
5.1. Ya no solo lees la conversacion.
5.2. Empiezas a recortarla como insumo de dataset.

## 8. Edicion de mensajes dentro del transcript

1. Cada mensaje puede editarse.
1.1. El boton `Editar` aparece flotando sobre la burbuja cuando se interactua con ella.

2. Al entrar en modo edicion:
2.1. La tarjeta deja de verse como mensaje final.
2.2. Se transforma en un bloque editable con textarea.
2.3. Mantiene rol, numero de turno y fecha.

3. El modo edicion permite:
3.1. Cambiar el contenido del mensaje.
3.2. Guardar.
3.3. Cancelar.

4. Atajos y comportamiento:
4.1. `Esc` cancela.
4.2. `Cmd/Ctrl + Enter` guarda.

5. Si el usuario intenta cambiar a editar otro mensaje cuando hay cambios sin guardar:
5.1. La app protege el flujo.
5.2. No deja perder el borrador silenciosamente.
5.3. Se trata como un conflicto de edicion.

6. Esta funcion sirve para limpieza curatorial.
6.1. Corregir transcript.
6.2. Quitar ruido.
6.3. Mejorar el texto fuente antes de convertirlo en dataset.

## 9. Reintento de la ultima respuesta del asistente

1. Si el ultimo mensaje real de la conversacion pertenece al asistente, aparece una accion `Reintentar`.

2. Esta accion no crea una rama alternativa.
2.1. La app elimina el ultimo mensaje del asistente.
2.2. Genera una nueva respuesta.
2.3. La inserta en el mismo lugar del transcript.

3. Visualmente, mientras ocurre:
3.1. El mensaje anterior desaparece de la vista activa.
3.2. Aparece el estado temporal de "asistente escribiendo".

4. Esta funcion es util cuando:
4.1. La respuesta final fue mala.
4.2. La respuesta fue incompleta.
4.3. Se quiere una nueva version sin rehacer toda la conversacion.

## 10. Estado "asistente escribiendo"

1. Cuando la app esta esperando respuesta del modelo, se muestra una tarjeta temporal del asistente.
1.1. Tiene el mismo lenguaje visual del transcript.
1.2. Pero en lugar de texto final, muestra una animacion de tres puntos.

2. Esto sucede en dos casos:
2.1. Mientras se envia un mensaje nuevo.
2.2. Mientras se reintenta la ultima respuesta del asistente.

3. Este pequeno detalle hace que el chat se sienta vivo y continuo.

## 11. Footer del chat: slice activo y compositor

1. El pie inferior de la pantalla tiene dos capas de funcionalidad.
1.1. La barra del slice activo.
1.2. El compositor de mensajes.

### 11.1. Franja de slice activo

1. Si existe una seleccion activa, por encima del compositor aparece una franja destacada.
1.1. Tiene color calido, tipo amarillo suave.
1.2. Resume el rango de turnos seleccionado.
1.3. Indica cuantos mensajes contiene el slice.

2. Desde esa franja se pueden disparar dos acciones.
2.1. `Ver preview`
2.2. `Mapear a DSPy`

3. `Ver preview` abre el panel de dataset y seleccion.
3.1. Sirve para revisar rapidamente el recorte actual.

4. `Mapear a DSPy` lleva a la pantalla de editor de dataset example.
4.1. Ese es el salto directo desde transcript a curacion estructurada.

### 11.2. Compositor de mensajes

1. Debajo de la franja del slice activo vive el compositor real del chat.
1.1. Tiene aspecto de caja redondeada flotante.
1.2. Se ve como una pieza separada del transcript, pero integrada visualmente.

2. En la parte superior del compositor aparece una banda de estado.
2.1. Muestra un punto de color.
2.2. Muestra una etiqueta de estado general.
2.3. Muestra si la conexion esta verificada o pendiente.

3. Los estados que puede transmitir son del tipo:
3.1. `Listo para enviar`
3.2. `Configuracion pendiente`
3.3. `Prueba pendiente`
3.4. `Cambios sin guardar`
3.5. `Edicion en curso`
3.6. `Revisar conexion`

4. Si el chat aun no esta habilitado, en esa misma franja aparece una accion corta:
4.1. `Abrir LLM`

5. Debajo esta el textarea principal.
5.1. El usuario escribe aqui sus mensajes.
5.2. `Enter` envia.
5.3. `Shift + Enter` agrega una nueva linea.

6. A la derecha vive el boton circular de enviar.
6.1. Se desactiva si el chat no esta listo.
6.2. Se activa solo cuando hay texto y el estado de la sesion lo permite.

## 12. Condiciones para que el chat quede habilitado

1. El chat no siempre esta listo para usarse.
1.1. La app controla de forma explicita si la sesion puede conversar con el modelo.

2. Para que el compositor quede verdaderamente habilitado deben cumplirse varias condiciones.
2.1. Debe existir un modelo configurado.
2.2. La conexion debe haber sido verificada.
2.3. No deben existir cambios de configuracion LLM sin guardar.
2.4. No debe haber una edicion de mensaje en curso bloqueando el envio.

3. Esto hace que la experiencia sea segura y clara.
3.1. La app no deja conversar con una configuracion ambigua.
3.2. Hace visibles las razones exactas por las que algo esta bloqueado.

## 13. Drawer de historial de chats

1. Al pulsar el boton de historial se abre un drawer lateral.
1.1. No cambia de pagina.
1.2. Se desliza como una bandeja sobre la interfaz.

2. El drawer resume:
2.1. Nombre del proyecto.
2.2. Cuantos chats hay disponibles en ese proyecto.

3. Luego lista las sesiones.
3.1. Cada item muestra titulo.
3.2. Fecha.
3.3. Numero de mensajes.
3.4. Numero de slices.
3.5. Etiquetas asignadas.

4. La sesion actual queda marcada como `Actual`.
4.1. Las demas son enlaces navegables.

5. Este drawer convierte el proyecto en una red de conversaciones hermanas.
5.1. Desde el chat actual puedes saltar a otro sin volver al detalle del proyecto.

## 14. Drawer de notas del chat

1. El panel de notas del chat es un drawer lateral.
1.1. Su funcion es guardar contexto libre asociado a esa sesion.

2. Visualmente contiene:
2.1. Una pequena caja explicativa.
2.2. Un textarea grande.
2.3. Un boton para guardar.

3. Estas notas no alteran el transcript.
3.1. No cambian mensajes.
3.2. No cambian la conversacion con el LLM.
3.3. Se guardan como contexto de curacion.

4. Luego esas notas reaparecen cuando se abre el editor de dataset example desde un slice de esta sesion.

## 15. Drawer de etiquetas del chat

1. El panel de etiquetas del chat tambien aparece como drawer.
1.1. Sirve para clasificar la sesion sin salir del chat.

2. Dentro se muestra:
2.1. Informacion basica del chat actual.
2.2. El componente de seleccion y asignacion de etiquetas.

3. Se puede:
3.1. Ver etiquetas actuales.
3.2. Quitar etiquetas.
3.3. Asignar etiquetas existentes.
3.4. Crear etiquetas nuevas.
3.5. Ir a la pantalla global de `Session Tags`.

4. La diferencia respecto al detalle del proyecto es solo de contexto.
4.1. En el proyecto etiquetas desde la tarjeta.
4.2. Aqui etiquetas desde dentro del chat inmersivo.

## 16. Drawer de dataset y seleccion

1. Este drawer es uno de los mas importantes de toda la pantalla.
1.1. Es la interfaz de transicion entre chat y dataset.

2. Tiene dos pestanas.
2.1. `Seleccion actual`
2.2. `Examples recientes`

### 16.1. Pestana "Seleccion actual"

1. Resume el slice consecutivo activo.
1.1. Muestra rango de turnos.
1.2. Muestra cantidad de mensajes seleccionados.
1.3. Si no hay seleccion, lo dice claramente.

2. Desde esta pestana se puede:
2.1. `Mapear a DSPy desde seleccion`
2.2. `Limpiar seleccion`

3. Debajo aparece una preview de los mensajes seleccionados.
3.1. Cada uno se muestra como mini tarjeta con rol, fecha y texto.
3.2. Si la seleccion es mas larga, la app aclara que solo esta mostrando una parte.

4. Esta pestana sirve como verificacion previa al salto al editor.

### 16.2. Pestana "Examples recientes"

1. La segunda pestana muestra dataset examples recientes derivados de esta misma sesion.
1.1. Cada item incluye titulo.
1.2. Estado.
1.3. Ultimo mensaje del usuario.
1.4. Fecha de actualizacion.

2. Desde aqui se puede:
2.1. Abrir la biblioteca completa de dataset examples del proyecto.
2.2. Abrir directamente un example reciente.

3. Esta pestana refuerza una idea importante.
3.1. Una sesion no produce un unico resultado.
3.2. Puede producir multiples examples curados a partir de distintos slices.

## 17. Sheet centrado de configuracion LLM

1. El panel de configuracion LLM no es lateral.
1.1. Aparece como una sheet o modal centrado.
1.2. Tiene mas peso visual porque afecta la operatividad entera del chat.

2. En la parte superior muestra tarjetas informativas.
2.1. Proveedor.
2.2. Modelo guardado.
2.3. URL efectiva.
2.4. Estado de API key.

3. Luego permite cargar una configuracion global guardada.
3.1. El usuario selecciona una del catalogo.
3.2. Pulsa `Cargar al borrador`.
3.3. La configuracion se copia a la sesion en forma editable.

4. Tambien permite guardar la configuracion actual como una nueva configuracion global.
4.1. Esto sirve para reutilizar combinaciones de modelo, URL, API key y prompt.

5. Despues aparecen los campos principales.
5.1. `Chat model`
5.2. `Chat URL`
5.3. `Chat API key`

6. Mas abajo aparece el bloque de verificacion.
6.1. Muestra si la sesion ya verifico conexion.
6.2. O si la ultima prueba fallo.
6.3. O si aun no se ha probado.

7. Las dos acciones fuertes del bloque son:
7.1. `Guardar configuracion`
7.2. `Probar conexion`

8. La logica importante es esta:
8.1. Guardar cambia la configuracion de sesion.
8.2. Pero despues hay que verificarla.
8.3. Hasta entonces, el chat queda pausado o pendiente.

9. Al final aparece el `Behavior prompt`.
9.1. Es opcional.
9.2. Se usa como instruccion de sistema para los siguientes turnos.
9.3. Tambien se puede borrar para volver al comportamiento sin prompt adicional.

## 18. Herramientas destructivas o delicadas

1. Dentro del menu contextual existen dos acciones sensibles.
1.1. `Limpiar chat`
1.2. `Eliminar chat`

### 18.1. Limpiar chat

1. Esta accion borra todos los mensajes de la sesion.
1.1. La sesion sigue existiendo.
1.2. Los dataset examples ya guardados se conservan.

2. Sirve para reiniciar la conversacion sin borrar el contenedor.

### 18.2. Eliminar chat

1. Esta accion elimina la sesion completa.
1.1. Es permanente.
1.2. Si habia slices o elementos asociados, desaparecen con ella.

2. Por eso aparece como accion mas agresiva dentro del menu.

## 19. Que sucede en los eventos principales del chat

1. Evento: abrir una sesion ya configurada y verificada.
1.1. El transcript se muestra listo.
1.2. El compositor queda habilitado.
1.3. El usuario puede conversar de inmediato.

2. Evento: abrir una sesion sin modelo.
2.1. El transcript puede existir o no.
2.2. Pero el compositor no queda habilitado.
2.3. La interfaz empuja a abrir configuracion LLM.

3. Evento: guardar nueva configuracion.
3.1. La app invalida la verificacion anterior.
3.2. Queda pendiente una nueva prueba de conexion.

4. Evento: probar conexion con exito.
4.1. La sesion queda marcada como verificada.
4.2. El compositor puede activarse.

5. Evento: probar conexion con error.
5.1. La sesion guarda el error.
5.2. El chat sigue bloqueado.
5.3. El problema queda visible en la UI.

6. Evento: enviar mensaje.
6.1. Se registra el turno del usuario.
6.2. Luego se genera y guarda la respuesta del asistente.
6.3. El transcript se actualiza.

7. Evento: editar mensaje.
7.1. El turno cambia su texto persistido.
7.2. Queda marcado como editado.

8. Evento: reintentar respuesta del asistente.
8.1. La ultima respuesta se sustituye por una nueva.
8.2. La conversacion sigue lineal.

9. Evento: seleccionar un slice.
9.1. El transcript pasa de ser lectura a ser materia editable para dataset.
9.2. Aparece la franja del slice activo.
9.3. Se habilita el salto a DSPy.

10. Evento: guardar notas.
10.1. Se preserva contexto curatorial extra.
10.2. Ese contexto luego reaparece como fuente auxiliar.

11. Evento: revisar examples recientes.
11.1. El usuario confirma si esa sesion ya produjo salidas utiles.
11.2. Puede reabrir examples sin abandonar el contexto del chat.

## 20. Imagen mental final de la pantalla de chat

1. Si tuvieras que imaginarla sin verla, seria asi:
1.1. Una pantalla casi completa dedicada a una conversacion.
1.2. Arriba, una franja de control con regreso, historial, resumen y menu.
1.3. En el centro, una columna larga de mensajes grandes, alineados izquierda-derecha segun rol.
1.4. Cada mensaje puede seleccionarse, editarse o, en el caso del ultimo del asistente, regenerarse.
1.5. Abajo, una zona que primero muestra el slice activo si existe y luego el compositor del chat.
1.6. Alrededor, drawers y modales que aparecen cuando necesitas historial, notas, etiquetas, dataset o configuracion.

2. En una sola frase:
2.1. La pantalla de chat se ve como una estacion inmersiva donde una conversacion viva puede corregirse, recortarse y proyectarse casi de inmediato hacia un dataset estructurado.
