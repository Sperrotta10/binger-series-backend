# Modelado de Base de datos

Creada por: Santiago Perrotta
Hora de creación: 17 de mayo de 2026 11:57
Categoría: Planificación
Última edición por: Santiago Perrotta
Fecha de última actualización: 17 de mayo de 2026 12:07
Fecha de creación: 17 de mayo de 2026 11:57
Última edición: 17 de mayo de 2026 12:07

# Módulos de la aplicación

### 1. Módulo de Usuarios y Autenticación

### Tabla: `users`

Almacena la información de la cuenta y el perfil público del usuario.

- `id`: `UUID` (Primary Key, `DEFAULT gen_random_uuid()`).
- `username`: `VARCHAR(30)` (Unique, Index, requerido). Nombre de usuario único para la URL del perfil (ej: `/user/santiago`).
- `email`: `VARCHAR(255)` (Unique, Index, requerido).
- `password_hash`: `VARCHAR(255)` (Requerido). Hash de la contraseña (Bcrypt/Argon2).
- `display_name`: `VARCHAR(50)`. El nombre que se muestra en la app.
- `bio`: `VARCHAR(500)`. Biografía corta del usuario.
- `avatar_url`: `TEXT`. URL de la foto de perfil (almacenada en un servicio como Cloudinary o Supabase Storage).
- `is_private`: `BOOLEAN` (`DEFAULT false`). Por si el usuario prefiere que su diario no sea público.
- `created_at`: `TIMESTAMP WITH TIME ZONE` (`DEFAULT NOW()`).
- `updated_at`: `TIMESTAMP WITH TIME ZONE` (`DEFAULT NOW()`).

### Tabla: `user_oauth`

- `id`: `UUID` (Primary Key, `DEFAULT gen_random_uuid()`).
- `user_id`: `UUID` (Foreign Key -> `users.id` `ON DELETE CASCADE`, requerido).
- `provider`: `VARCHAR(50)` (Requerido. Ej: `'google'`, `'apple'`, `'github'`).
- `provider_user_id`: `VARCHAR(255)` (Requerido. El ID único que te da esa plataforma).
- `created_at`: `TIMESTAMP WITH TIME ZONE` (`DEFAULT NOW()`).
- *Restricciones:* Un índice único compuesto en `(provider, provider_user_id)`. Esto evita que la misma cuenta de Google se vincule a dos usuarios distintos en tu app.

### Tabla: `password_resets`

- `id`: `UUID` (Primary Key, `DEFAULT gen_random_uuid()`).
- `user_id`: `UUID` (Foreign Key -> `users.id` `ON DELETE CASCADE`, requerido).
- `token_hash`: `VARCHAR(255)` (Unique, Index, requerido). El hash del token seguro enviado por correo.
- `expires_at`: `TIMESTAMP WITH TIME ZONE` (Requerido). La fecha y hora límite para usar el token.
- `used_at`: `TIMESTAMP WITH TIME ZONE` (Opcional). Registra cuándo se usó el token (para invalidarlo).
- `created_at`: `TIMESTAMP WITH TIME ZONE` (`DEFAULT NOW()`).

### Tabla: `follows`

Maneja la red social de la aplicación (seguidores y seguidos).

- `follower_id`: `UUID` (Foreign Key -> `users.id` `ON DELETE CASCADE`). El usuario que sigue.
- `following_id`: `UUID` (Foreign Key -> `users.id` `ON DELETE CASCADE`). El usuario que es seguido.
- *Restricciones:* Primary Key compuesta por `(follower_id, following_id)`. Un Check constraint para asegurar que `follower_id != following_id` (no seguirse a sí mismo).

---

### 2. Módulo de Catálogo (Series, Temporadas y Capítulos)

### Tabla: `series`

- `id`: `UUID` (Primary Key).
- `api_source`: `VARCHAR(20)` (`DEFAULT 'tvmaze'`). Permite saber de qué proveedor externo se extrajo (útil si luego migras o combinas con TMDB).
- `api_id`: `VARCHAR(50)` (Unique, Index). El ID original en la API externa para evitar duplicados al sincronizar.
- `title`: `VARCHAR(255)` (Index, requerido).
- `original_language`: `VARCHAR(10)`.
- `overview`: `TEXT`. Sinopsis general de la serie.
- `poster_url`: `TEXT`. URL externa de la imagen del póster.
- `backdrop_url`: `TEXT`. Imagen de fondo para la cabecera de la serie en la app.
- `status`: `VARCHAR(50)`. Estado actual (ej: "Ended", "Running", "In Development").
- `first_air_date`: `DATE`. Fecha de estreno original.
- `created_at`: `TIMESTAMP WITH TIME ZONE` (`DEFAULT NOW()`).

### Tabla: `seasons`

- `id`: `UUID` (Primary Key).
- `series_id`: `UUID` (Foreign Key -> `series.id` `ON DELETE CASCADE`, requerido).
- `season_number`: `INTEGER` (Requerido).
- `title`: `VARCHAR(100)`. A veces las temporadas tienen nombres subtitulados.
- `overview`: `TEXT`.
- `poster_url`: `TEXT`. Póster específico de la temporada (si la API lo provee).
- `episode_count`: `INTEGER`.
- `air_date`: `DATE`.

### Tabla: `episodes`

- `id`: `UUID` (Primary Key).
- `season_id`: `UUID` (Foreign Key -> `seasons.id` `ON DELETE CASCADE`, requerido).
- `episode_number`: `INTEGER` (Requerido).
- `title`: `VARCHAR(255)` (Requerido).
- `overview`: `TEXT`. Sinopsis del capítulo.
- `air_date`: `DATE`.
- `runtime`: `INTEGER`. Duración estimada en minutos. Es crucial que no sea nulo (o por defecto `0`) para calcular las estadísticas de tiempo visto.

---

### 3. Módulo de Actividad e Interacción (Estilo Letterboxd)

### Tabla: `watch_logs` (El Diario / Diary)

Registra cada evento de visualización. Soporta múltiples vistas del mismo capítulo.

- `id`: `UUID` (Primary Key).
- `user_id`: `UUID` (Foreign Key -> `users.id` `ON DELETE CASCADE`, requerido).
- `episode_id`: `UUID` (Foreign Key -> `episodes.id` `ON DELETE CASCADE`, requerido).
- `watched_at`: `DATE` (`DEFAULT CURRENT_DATE`, requerido). Se usa `DATE` en lugar de `TIMESTAMP` para facilitar los queries de "capítulos por día" y el control de zonas horarias locales.
- `is_rewatch`: `BOOLEAN` (`DEFAULT false`, requerido).
- `created_at`: `TIMESTAMP WITH TIME ZONE` (`DEFAULT NOW()`).

### Tabla: `reviews`

Las reseñas en Letterboxd tienen la opción de asociarse o no a una fecha del diario. Este diseño es flexible: permite reseñar una serie entera o una temporada específica.

- `id`: `UUID` (Primary Key).
- `user_id`: `UUID` (Foreign Key -> `users.id` `ON DELETE CASCADE`, requerido).
- `series_id`: `UUID` (Foreign Key -> `series.id` `ON DELETE CASCADE`, requerido).
- `season_id`: `UUID` (Foreign Key -> `seasons.id` `ON DELETE CASCADE`, opcional). Si es `NULL`, la reseña es de la serie completa; si tiene ID, es de esa temporada.
- `watch_log_id`: `UUID` (Foreign Key -> `watch_logs.id` `ON DELETE SET NULL`, opcional). Vincula la reseña a un día específico en el diario.
- `rating`: `NUMERIC(2,1)` (Check: `rating >= 0.5 AND rating <= 5.0`). Calificación con incrementos de 0.5 (sistema de 5 estrellas). Puede ser opcional si el usuario solo quiere escribir texto sin nota.
- `content`: `TEXT`. El texto de la reseña.
- `contains_spoilers`: `BOOLEAN` (`DEFAULT false`).
- `created_at`: `TIMESTAMP WITH TIME ZONE` (`DEFAULT NOW()`).
- `updated_at`: `TIMESTAMP WITH TIME ZONE` (`DEFAULT NOW()`).

### Tabla: `watchlist`

La lista de "Series por ver" del usuario.

- `user_id`: `UUID` (Foreign Key -> `users.id` `ON DELETE CASCADE`).
- `series_id`: `UUID` (Foreign Key -> `series.id` `ON DELETE CASCADE`).
- `created_at`: `TIMESTAMP WITH TIME ZONE` (`DEFAULT NOW()`).
- *Restricciones:* Primary Key compuesta por `(user_id, series_id)`.

### Tabla: `likes`

Para la interacción social. Permite dar "me gusta" a las reseñas de otros usuarios.

- `id`: `UUID` (Primary Key).
- `user_id`: `UUID` (Foreign Key -> `users.id` `ON DELETE CASCADE`, requerido).
- `review_id`: `UUID` (Foreign Key -> `reviews.id` `ON DELETE CASCADE`, requerido).
- `created_at`: `TIMESTAMP WITH TIME ZONE` (`DEFAULT NOW()`).
- *Restricciones:* Unique index compuesto en `(user_id, review_id)` para evitar que un usuario dé like más de una vez a la misma reseña.

---

### 4. Módulo de Listas Personalizadas

### Tabla: `lists`

Permite a los usuarios crear colecciones públicas o privadas (ej: "Series infravaloradas de ciencia ficción").

- `id`: `UUID` (Primary Key).
- `user_id`: `UUID` (Foreign Key -> `users.id` `ON DELETE CASCADE`, requerido).
- `name`: `VARCHAR(100)` (Requerido).
- `description`: `VARCHAR(1000)`.
- `is_private`: `BOOLEAN` (`DEFAULT false`).
- `created_at`: `TIMESTAMP WITH TIME ZONE` (`DEFAULT NOW()`).
- `updated_at`: `TIMESTAMP WITH TIME ZONE` (`DEFAULT NOW()`).

### Tabla: `list_items`

La tabla intermedia que une las series con las listas creadas, manejando el orden personalizado.

- `list_id`: `UUID` (Foreign Key -> `lists.id` `ON DELETE CASCADE`).
- `series_id`: `UUID` (Foreign Key -> `series.id` `ON DELETE CASCADE`).
- `position`: `INTEGER` (Requerido). Define el orden en el que aparecen las series dentro de la lista.
- `created_at`: `TIMESTAMP WITH TIME ZONE` (`DEFAULT NOW()`).
- *Restricciones:* Primary Key compuesta por `(list_id, series_id)`.

---

### Índices Críticos para el Rendimiento (Performance Indexes)

Debido a que las consultas de agregación (*queries* que cuentan o suman datos) serán constantes en el feed, debes añadir estos índices en tu script de migración:

1. `CREATE INDEX idx_watch_logs_user_date ON watch_logs (user_id, watched_at);`
    - *Por qué:* Optimiza la carga del calendario del usuario y el cálculo de rachas (*streaks*).
2. `CREATE INDEX idx_reviews_series_season ON reviews (series_id, season_id);`
    - *Por qué:* Acelera la carga de la sección de reseñas cuando entras al perfil de una serie o a una temporada específica.
3. `CREATE INDEX idx_episodes_season_number ON episodes (season_id, episode_number);`
    - *Por qué:* Permite listar los capítulos de una temporada en orden de manera instantánea.

### ⚠️ CRITICAL REGULATION - ZONE TIME HANDLING:
- No usar los valores por defecto de Supabase (NOW()) para registrar interacciones del usuario en el Diario (watch_logs).
- El frontend (React Native) tiene la responsabilidad de capturar la fecha y hora local del dispositivo en formato ISO 8601 y enviarla en el payload.
- El backend persistirá explícitamente esa fecha para no alterar los calendarios locales ni romper el algoritmo de cálculo de rachas (streaks).