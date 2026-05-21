# 4. Módulo de Actividad y Diario (Activity & Diary Service)

Creada por: Santiago Perrotta
Hora de creación: 17 de mayo de 2026 12:23
Categoría: Requisitos
Última edición por: Santiago Perrotta
Fecha de última actualización: 17 de mayo de 2026 14:57
Fecha de creación: 17 de mayo de 2026 12:23
Última edición: 17 de mayo de 2026 14:57

# Descripción

Maneja las interacciones directas del usuario con el contenido: marcar qué vio, cuándo lo vio y qué opina al respecto. Es el módulo con mayor volumen de escritura de la aplicación.

# **Requisitos Funcionales:**

- Registrar capítulos como "vistos" (creación de logs en el Diario) y permitir marcarlos como "rewatch".
- Calcular en tiempo real las estadísticas del usuario: minutos totales de televisión vistos, capítulos por día y la racha actual (*streak*).
- Creación, edición y eliminación de reseñas (*reviews*) con sistema de calificación de 5 estrellas (con incrementos de 0.5) y marcado de spoilers.
- Gestión de la lista de seguimiento (*Watchlist*).

# **Requisitos Técnicos y de Infraestructura:**

- **Base de datos:** Gestiona las tablas `watch_logs`, `reviews` y `watchlist`.
- **Optimización de Queries:** Uso estricto de índices compuestos en `(user_id, watched_at)` para resolver de inmediato las consultas del calendario del perfil.

---

## Registrar Capítulos como "Vistos" (The Watch Log)

Este endpoint es el que más tráfico recibirá. Debe ser rápido y asegurar que las estadísticas del usuario se actualicen sin retrasos.

### Flujo Lógico (`POST /api/v1/activity/watch`)

1. **Validación de Entrada:** El frontend envía el `episode_id` y opcionalmente una fecha `watched_at` (si el usuario está registrando algo que vio en el pasado). Si no se envía fecha, el backend asigna la fecha actual en la zona horaria local del usuario.
2. **Verificación de Existencia:** Se comprueba en la tabla `episodes` que el capítulo exista (utilizando la caché del Catálogo para no tocar PostgreSQL).
3. **Detección de "Rewatch" Automático:** El backend realiza una consulta rápida:SQL
    
    `SELECT id FROM watch_logs WHERE user_id = $1 AND episode_id = $2 LIMIT 1;`
    
    Si ya existe al menos un registro previo de ese capítulo para ese usuario, el nuevo registro se marca automáticamente con `is_rewatch = true`.
    
4. **Inserción:** Se inserta la fila en la tabla `watch_logs`.
5. **Disparar Evento Asíncrono:** Para no ralentizar la respuesta al usuario, el servicio responde de inmediato un `201 Created` y, en segundo plano, publica un evento en el Message Broker o Redis (`episode.watched`). Este evento será escuchado por el módulo social para actualizar los feeds y por el sistema de estadísticas.

---

## 2. Algoritmo de Estadísticas y Rachas en Tiempo Real (Streaks)

Hacer un `COUNT` y un `SUM` de miles de filas en PostgreSQL cada vez que el usuario entra a su perfil destruiría el rendimiento. En su lugar, utilizaremos una estrategia de **Contadores Pre-calculados en Redis**.

Cuando el backend procesa el evento `episode.watched`, ejecuta la siguiente lógica en segundo plano:

### Minutos Totales y Capítulos por Día

1. Obtiene la duración del capítulo (`runtime`) desde la base de datos del catálogo.
2. Incrementa los contadores del usuario en Redis de forma atómica:
    - `INCRBY user:stats:ID_USUARIO:total_minutes RUNTIME`
    - `HINCRBY user:stats:ID_USUARIO:daily_counts FECHA_LOG 1`

### Algoritmo de la Racha Actual (*Current Streak*)

Para calcular cuántos días seguidos lleva el usuario viendo televisión sin romper la racha:

1. Se define una clave en Redis llamada `user:streak:ID_USUARIO`.
2. **Lógica de Verificación:**
    - Si el usuario ya había visto un capítulo **hoy**, la racha se mantiene igual.
    - Si es el primer capítulo que ve **hoy**, el backend verifica si existe actividad registrada ayer (`hoy - 1 día`) en el hash de conteos diarios.
    - *Caso A (Continuidad):* Si ayer hubo actividad, se incrementa la racha: `INCR user:streak:ID_USUARIO`.
    - *Caso B (Ruptura):* Si ayer **no** hubo actividad, la racha se rompió. El backend reinicia el contador: `SET user:streak:ID_USUARIO 1`.

Cuando el usuario pide su perfil (`GET /api/v1/users/me/profile`), el backend lee directamente estos valores de Redis en microsegundos.

---

## 3. Gestión de Reseñas (*Reviews*) con Control de Spoilers

Las reseñas en Letterboxd son el pilar de la comunidad. Su lógica debe permitir flexibilidad (reseñar series o temporadas) y proteger a los demás usuarios de textos reveladores.

### Flujo Lógico de Creación (`POST /api/v1/activity/reviews`)

1. **Estructura de la Petición:** El frontend envía `series_id`, `rating` (de 0.5 a 5.0), `content` (texto), `contains_spoilers` (booleano) y opcionalmente `season_id` o `watch_log_id`.
2. **Validación del Rating:** Se verifica que el número sea múltiplo de 0.5 (ej: 4.0, 4.5). Si envía un 4.3, el backend retorna un error `400 Bad Request`.
3. **Inserción y Sanitización:** El texto de la reseña se limpia de código malicioso (XSS) y se guarda en la tabla `reviews`.
4. **Impacto en el Frontend (Ocultar Spoilers):**
    - Si `contains_spoilers = true`, el backend guardará la reseña normalmente.
    - Cuando el *Social Service* pida las reseñas para el feed público, si el campo de spoiler es verdadero, el backend enviará una bandera para que React Native emborrone o高級 oculte el texto tras un botón de "Ver con Spoilers", evitando arruinarle la experiencia a otros miembros.

---

## 4. Gestión de la Lista de Seguimiento (*Watchlist*)

La lista de "Series por ver" es una tabla intermedia simple pero requiere un control estricto de duplicados.

### Flujo Lógico de Alternancia (*Toggle Watchlist*)

En lugar de tener endpoints separados para agregar y eliminar, se utiliza una lógica de **Toggle** (`POST /api/v1/activity/watchlist/toggle`):

1. El backend recibe el `series_id` y el `user_id` del token JWT.
2. Busca en la tabla `watchlist` si ya existe la combinación `(user_id, series_id)`.
3. **Flujo Condicional:**
    - *Si existe:* Significa que el usuario quiere quitar la serie de su lista. Ejecuta un `DELETE` y responde `{ "action": "removed" }`.
    - *Si no existe:* Significa que la quiere agregar. Ejecuta un `INSERT` y responde `{ "action": "added" }`.
4. Esto reduce la lógica en React Native a un solo botón que cambia su estado visual (icono de guardado relleno/vacío) según la respuesta de esta única API.

---

## 5. Explicación de la Optimización Crítica de Índices

Como se solicitó en los requisitos técnicos, la base de datos contará con el índice compuesto:

SQL

`CREATE INDEX idx_watch_logs_user_date ON watch_logs (user_id, watched_at);`

### ¿Por qué este índice salva el rendimiento del sistema?

Cuando un usuario entra a su sección de "Diario" en la app móvil, React Native solicita los capítulos ordenados por fecha. Sin el índice, PostgreSQL tendría que hacer un *Full Table Scan* (leer millones de registros de todos los usuarios del sistema, filtrarlos por tu ID y luego ordenarlos).

Con el índice compuesto `(user_id, watched_at)`, PostgreSQL busca directamente el bloque de memoria asignado a ese `user_id` y, como los datos ya están ordenados internamente por fecha dentro del índice, extrae el historial de visualizaciones de forma inmediata. Las consultas del calendario pasan de tomar segundos a resolverse en menos de 3 milisegundos.