# Descripcion funcional y visual de la home

## 1. Idea general de la pantalla principal

1. La home funciona como puerta de entrada operativa a toda la aplicacion.
1.1. No es una landing publica.
1.2. No es un dashboard con graficas.
1.3. Es una mesa de arranque desde donde el usuario crea proyectos, revisa los existentes y administra configuraciones LLM globales.

2. La sensacion visual general es calmada y editorial.
2.1. El fondo es claro, calido, con tonos crema y arena.
2.2. Las superficies principales aparecen como tarjetas grandes, suaves y redondeadas.
2.3. Los botones principales usan un acento verde-petroleo.
2.4. La pagina transmite "laboratorio curado" mas que "panel tecnico".

## 2. Estructura general de la home

1. La pantalla principal se puede imaginar en cuatro franjas.
1.1. Barra superior fija.
1.2. Bloque hero descriptivo.
1.3. Formulario de creacion de proyecto.
1.4. Grilla de proyectos existentes.
1.5. Gestor de configuraciones LLM globales al final.

2. En desktop, la parte superior se siente como una composicion en dos columnas.
2.1. A la izquierda vive el mensaje principal de producto.
2.2. A la derecha vive la accion inmediata: crear un proyecto.

3. En mobile, esos bloques se apilan.
3.1. Primero se lee la propuesta de valor.
3.2. Luego aparece el formulario.
3.3. Despues baja el listado de proyectos y el gestor de configuraciones.

## 3. Barra superior fija

1. Arriba del todo hay una cabecera pegada al borde superior.
1.1. Siempre permanece visible.
1.2. Tiene un ligero efecto de transparencia y blur.
1.3. Eso hace que parezca una capa flotando sobre el contenido.

2. En la parte izquierda de esa barra aparece la identidad.
2.1. El nombre visible es `Conversation Lab`.
2.2. Debajo hay una frase corta que resume la herramienta.
2.3. Esa frase habla de sesiones de chat, source slices, mapping manual a DSPy y dataset examples exportables.

3. En la parte derecha de la barra hay dos grupos de controles.
3.1. El switch de tema.
3.2. La navegacion global.

4. La navegacion global actual incluye:
4.1. `Projects`
4.2. `Dataset Examples`
4.3. `Dataset Specs`
4.4. `Session Tags`
4.5. `Export Hub`

5. Aunque esta barra aparece en toda la app, en la home cumple una funcion especial.
5.1. Da contexto inmediato de que no estas en una sola pantalla de chat.
5.2. Desde el primer segundo deja claro que existen biblioteca, specs, tags y exportacion.

## 4. Bloque hero de la home

1. Debajo de la barra superior aparece el bloque de bienvenida principal.
1.1. No usa ilustraciones.
1.2. Su peso visual viene del texto, el espacio en blanco y la jerarquia tipografica.

2. En la parte alta de este bloque aparece una etiqueta pequena en mayusculas.
2.1. Esa etiqueta dice `Projects`.
2.2. Funciona como un rotulo de seccion.

3. Debajo aparece un titular grande.
3.1. Ese titular explica que la app permite conversar con un LLM, conservar slices utiles y mapearlos casi directo hacia firmas DSPy.
3.2. El tono no es marketing exagerado.
3.3. Suena mas a descripcion de flujo de trabajo real.

4. Debajo del titular hay un parrafo explicativo.
4.1. Ese texto aterriza la idea: las sesiones reales de chat son la materia prima del dataset.
4.2. Explica que la app guarda turnos, permite seleccionar rangos consecutivos y abrir un editor de mapping hacia JSONL DSPy.

5. Visualmente, esta zona le dice al usuario dos cosas.
5.1. Que la app no es solo para chatear.
5.2. Que el objetivo final es producir ejemplos de dataset reutilizables.

## 5. Tarjeta para crear proyecto

1. A la derecha del bloque hero aparece una tarjeta dedicada a crear un nuevo proyecto.
1.1. En desktop se siente como un panel de accion rapida.
1.2. En mobile se siente como el siguiente paso natural despues de leer el hero.

2. La tarjeta incluye:
2.1. Un titulo corto: crear proyecto.
2.2. Un campo `Name`.
2.3. Un textarea `Description`.
2.4. Un boton principal para confirmar.

3. La experiencia mental aqui es directa.
3.1. La home no obliga a navegar primero a otro lado.
3.2. Desde la misma portada el usuario puede iniciar el trabajo.

4. Cuando el usuario completa el formulario y envia:
4.1. La app crea el proyecto.
4.2. Muestra feedback visual de exito o error.
4.3. Si todo sale bien, redirige al detalle del nuevo proyecto.

5. Si el nombre falta o hay un problema de guardado:
5.1. El formulario no desaparece.
5.2. Se muestra feedback de error.
5.3. La home sigue funcionando como punto de reintento.

## 6. Zona de grilla de proyectos

1. Debajo del bloque superior aparece la biblioteca de proyectos existentes.
1.1. Esta area ya se siente menos como portada y mas como tablero operativo.

2. Si no existen proyectos, aparece un estado vacio.
2.1. Ese estado vacio ocupa una tarjeta ancha.
2.2. Explica que aun no hay proyectos y sugiere crear uno para empezar.

3. Si si existen proyectos, la pantalla muestra una grilla de tarjetas.
3.1. En pantallas medianas aparecen dos columnas.
3.2. En pantallas grandes pueden verse tres.
3.3. En mobile aparecen una debajo de otra.

## 7. Como se ve cada tarjeta de proyecto

1. Cada proyecto aparece como una tarjeta grande de bordes redondeados.
1.1. Tiene fondo claro semitransparente.
1.2. Tiene una sombra suave.
1.3. Tiene aire de objeto importante, no de fila de tabla.

2. La zona superior de la tarjeta muestra:
2.1. Nombre del proyecto.
2.2. Descripcion o texto de fallback si no existe descripcion.
2.3. Fecha de creacion en una pequena pastilla visual.

3. La zona media muestra dos mini tarjetas internas de metricas.
3.1. `Sessions`
3.2. `Slices`

4. Estas metricas permiten leer rapidamente el estado del proyecto.
4.1. Si tiene muchas sesiones, se entiende que hubo varias conversaciones.
4.2. Si tiene muchos slices, se entiende que ya hubo trabajo de curacion.

5. La zona inferior contiene el boton de accion.
5.1. El boton dice `Open Project`.
5.2. Es el CTA principal de la tarjeta.

## 8. Evento principal dentro de una tarjeta de proyecto

1. Cuando el usuario pulsa `Open Project`, ocurre el salto principal de la home.
1.1. La app navega al detalle de ese proyecto.
1.2. Desde ahi el usuario ya entra a sesiones, chat y ejemplos.

2. Mentalmente, este boton transforma la home.
2.1. Antes de pulsarlo, la home es un mapa de entrada.
2.2. Despues de pulsarlo, el usuario entra a un espacio de trabajo concreto.

## 9. Lectura rapida de la home como usuario nuevo

1. Si alguien entra por primera vez, la secuencia visual esperable es esta.
1.1. Primero ve el nombre de la app y sus modulos globales en la barra superior.
1.2. Luego entiende la propuesta de valor por el titular y el texto descriptivo.
1.3. Luego detecta de inmediato que puede crear un proyecto.
1.4. Si ya hay trabajo previo, ve abajo la coleccion de proyectos.
1.5. Finalmente descubre que tambien existen configuraciones LLM globales.

2. La home, por tanto, cumple una funcion de onboarding silencioso.
2.1. No usa tutorial.
2.2. No usa pasos guiados.
2.3. La propia composicion visual explica por donde empezar.

## 10. Gestor de configuraciones LLM globales

1. Debajo de la grilla de proyectos aparece otra seccion importante.
1.1. Es el gestor de configuraciones LLM globales.
1.2. Esta parte convierte a la home en algo mas que un listado de proyectos.

2. La primera tarjeta de esta seccion sirve para crear una nueva configuracion.
2.1. Pide nombre.
2.2. Pide chat model.
2.3. Permite indicar chat URL.
2.4. Permite indicar API key.
2.5. Permite guardar un behavior prompt reutilizable.

3. Debajo o al lado aparecen las configuraciones existentes.
3.1. Cada una vive dentro de su propia tarjeta editable.
3.2. La tarjeta muestra nombre y fecha de actualizacion.
3.3. Tambien muestra chips pequenos que indican si tiene API key y prompt.

4. Dentro de cada tarjeta se puede:
4.1. Editar nombre.
4.2. Editar modelo.
4.3. Editar URL.
4.4. Editar API key.
4.5. Editar prompt.
4.6. Actualizar.
4.7. Eliminar.

5. Esta zona cambia mucho la lectura de la home.
5.1. Ya no es solo "entrada a proyectos".
5.2. Tambien es un centro de preparacion tecnica para futuras sesiones de chat.

## 11. Que sucede en cada caso-evento de la home

1. Caso: no hay proyectos todavia.
1.1. El hero gana protagonismo.
1.2. El formulario de creacion se vuelve la accion obvia.
1.3. El estado vacio en la grilla refuerza que aun no existe trabajo previo.

2. Caso: ya hay proyectos.
2.1. La home se convierte en una mezcla de portada y catalogo.
2.2. El usuario puede continuar trabajo previo o abrir uno nuevo.

3. Caso: el usuario quiere empezar desde cero.
3.1. Crea un proyecto desde la tarjeta derecha superior.
3.2. La app lo lleva al detalle del proyecto recien creado.

4. Caso: el usuario quiere retomar trabajo.
4.1. Baja a la grilla.
4.2. Reconoce el proyecto por nombre, descripcion o metricas.
4.3. Entra con `Open Project`.

5. Caso: el usuario quiere preparar infraestructura LLM antes de crear sesiones.
5.1. Se queda en la home.
5.2. Crea o edita configuraciones globales.
5.3. Luego mas adelante las cargara dentro de una sesion de chat.

6. Caso: el usuario quiere orientarse en la app.
6.1. Mira la barra superior y descubre biblioteca, specs, tags y exportacion.
6.2. La home actua como mapa de todo el sistema.

## 12. Imagen mental de la pagina principal

1. Si tuvieras que imaginar la home sin verla, imaginaria esto:
1.1. Un fondo claro, sobrio y calido.
1.2. Arriba, una barra fija con el nombre de la app y los modulos.
1.3. Debajo, a la izquierda, un gran mensaje que explica para que sirve el producto.
1.4. A la derecha, una tarjeta lista para crear el primer proyecto.
1.5. Mas abajo, una grilla ordenada de proyectos como piezas de trabajo activas.
1.6. Al final, una zona mas tecnica donde se administran configuraciones de LLM reutilizables.

2. En una sola frase:
2.1. La home se ve como una portada operativa donde conviven explicacion del producto, creacion inmediata de proyectos, continuidad del trabajo existente y preparacion de configuraciones globales.

## 13. Rol real de la home dentro de la aplicacion

1. La home no es el corazon conversacional de la app.
1.1. Ese rol lo tiene la pantalla de sesion de chat.

2. Pero si es el punto de organizacion inicial.
2.1. Desde aqui nace todo proyecto.
2.2. Desde aqui se retoma trabajo previo.
2.3. Desde aqui se preparan configuraciones reutilizables.
2.4. Desde aqui se entiende, de un vistazo, cual es la arquitectura funcional de todo el producto.
