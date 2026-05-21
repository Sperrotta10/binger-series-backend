# 5. Módulo Social y de Listas (Social & Curation Service)

Creada por: Santiago Perrotta
Hora de creación: 17 de mayo de 2026 12:25
Categoría: Requisitos
Última edición por: Santiago Perrotta
Fecha de última actualización: 17 de mayo de 2026 15:04
Fecha de creación: 17 de mayo de 2026 12:25
Última edición: 17 de mayo de 2026 15:04

# Descripción

Maneja la capa comunitaria que hace que la plataforma se sienta viva, similar a una red social de nicho.

# **Requisitos Funcionales:**

- Sistema de seguimiento entre usuarios (Follow / Unfollow).
- Interacción con el contenido de terceros: dar "Me gusta" (*Likes*) a las reseñas de otros usuarios.
- **Generador de Feed de Actividad:** Renderizar una línea de tiempo para el usuario actual que muestre qué han visto y qué han reseñado las personas a las que sigue.
- Creación y curación de Listas Personalizadas de series, permitiendo ordenar los elementos mediante una posición específica.

# **Requisitos Técnicos y de Infraestructura:**

- **Base de datos:** Gestiona las tablas `follows`, `likes`, `lists` y `list_items`.
- **Estrategia de Feed:** Para armar el feed de actividad de forma eficiente sin colapsar la base de datos relacional con `JOINs` masivos entre seguidores y logs, se puede utilizar una estrategia híbrida: consultas paginadas indexadas o pre-calcular el feed de usuarios muy activos en una estructura de datos tipo *List* en Redis.

---

# Red Social: Seguimiento (Follow/Unfollow) e Interacciones (Likes)

Manejar las relaciones de amistad y las interacciones sociales requiere endpoints limpios de tipo *toggle* para optimizar el código en React Native.

### Sistema de Seguimiento (`POST /api/v1/social/follow`)

1. **Parámetros:** El backend recibe el `following_id` (el usuario a quien se desea seguir) y extrae el `follower_id` del token JWT.
2. **Validación de Borde:** Verificar que `follower_id !== following_id`. No tiene sentido lógico que un usuario se siga a sí mismo.
3. **Lógica Operacional:** Busca en la tabla `follows` si ya existe el registro:
    - *Si existe:* El usuario quiere dejar de seguir (*Unfollow*). Se ejecuta un `DELETE`.
    - *Si no existe:* Quiere empezar a seguir (*Follow*). Se ejecuta un `INSERT`.
4. **Actualización de Contadores:** Para evitar contar filas cada vez que alguien entra a un perfil, se incrementan o decrementan dos llaves en Redis en microsegundos:
    - `user:social:ID_SEGUIDOR:following_count`
    - `user:social:ID_SEGUIDO:followers_count`

### Interacción con Reseñas (`POST /api/v1/social/reviews/:id/like`)

1. Funciona con la misma lógica de alternancia (*toggle*) en la tabla `likes` usando el `review_id` de la URL y el `user_id` de la sesión.
2. Al dar "Me gusta", se dispara un evento asíncrono que incrementa un contador global de popularidad de esa reseña en Redis (`review:ID_RESEÑA:likes`). Si la reseña supera cierto umbral (ej: más de 50 likes en el día), el ID de la reseña se añade a un set de **"Reseñas Populares de la Comunidad"** para destacarla en el Home de la app móvil.

---

# El Reto Técnico: Generador del Feed de Actividad

El feed es la pantalla principal de la app. Si intentas armarlo en PostgreSQL haciendo un `JOIN` entre la tabla `follows`, la tabla `watch_logs` y la tabla `reviews` para buscar lo que hicieron las 300 personas a las que sigue un usuario, tu base de datos colapsará cuando tengas unos pocos miles de usuarios activos.

Para resolverlo sin morir en el intento, implementaremos el modelo híbrido **Fan-out on Write / Fan-out on Read**.

### Estrategia de Carga del Feed:

Cuando un usuario (ej: Rodrigo) marca un capítulo como visto o publica una reseña en el *Módulo 4*:

1. El sistema social escucha el evento de actividad en segundo plano.
2. **Identificación de Audiencia:** El backend busca en la tabla `follows` los IDs de todos los usuarios que siguen a Rodrigo.
3. **Segmentación por Actividad:**
    - **Usuarios Pasivos (Fan-out on Read):** Para los seguidores que entran a la app una vez a la semana, no hacemos nada en caché. Cuando abran la app, un query indexado por fecha en PostgreSQL les armará su feed en tiempo real.
    - **Usuarios Muy Activos (Fan-out on Write):** Para los usuarios que entran constantemente a la aplicación, el sistema toma el ID de la nueva acción de Rodrigo y la inyecta directamente en una **Lista de Redis** personalizada para cada seguidor activo.Bash
        
        `LPUSH user:feed:ID_SEGUIDOR_ACTIVO "LOG_ID_DE_RODRIGO"
        LTRIM user:feed:ID_SEGUIDOR_ACTIVO 0 99  # Mantiene solo las últimas 100 acciones`
        
4. Cuando el usuario activo abre su app móvil (`GET /api/v1/social/feed`), el backend lee la lista de Redis con `LRANGE` de forma instantánea, extrae los 20 IDs de actividad más recientes y busca sus detalles. El feed carga en menos de 10ms.

---

# Creación y Curación de Listas Personalizadas

Las listas permiten a los usuarios agrupar series bajo un concepto (ej: *"Temporadas perfectas de inicio a fin"*). El desafío aquí es mantener el orden personalizado de las series que decide el creador.

### Creación de la Lista (`POST /api/v1/social/lists`)

1. El usuario envía el `name`, `description` e `is_private` (booleano).
2. Se registra en la tabla `lists` y devuelve el `list_id`.

### Agregar/Reordenar Series en la Lista (`PUT /api/v1/social/lists/:id/items`)

Para actualizar el contenido de una lista de forma masiva o cambiar la posición de las series (comportamiento *Drag and Drop* en React Native):

1. El frontend envía un array de objetos con el nuevo orden establecido por el usuario:
2. **Lógica de Actualización Atómica:** Para evitar inconsistencias o posiciones duplicadas, el backend ejecuta una transacción SQL:
**Paso A:** Elimina todos los registros previos de esa lista en la tabla intermedia `list_items` (`DELETE FROM list_items WHERE list_id = :id`).
- **Paso B:** Ejecuta un insert masivo (*Bulk Insert*) con las nuevas posiciones asignadas en el payload.
1. Al usar una transacción, si el cliente pierde conexión a mitad del reordenamiento, la lista conserva su estado anterior sin corromperse.