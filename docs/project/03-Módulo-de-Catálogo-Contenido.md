# 2. Módulo de Catálogo y Contenido (Catalog Service)

Creada por: Santiago Perrotta
Hora de creación: 17 de mayo de 2026 12:18
Categoría: Requisitos
Última edición por: Santiago Perrotta
Fecha de última actualización: 17 de mayo de 2026 14:53
Fecha de creación: 17 de mayo de 2026 12:18
Última edición: 17 de mayo de 2026 14:53

# Descripción

El corazón de la información de las series. Este módulo sirve los datos de series, temporadas y capítulos al frontend.

# Requisitos Funcionales:

- Listar detalles de series, temporadas y capítulos.
- Buscador interno de series (por título, género o año).
- Servir las URLs de los posters y backdrops optimizados para el cliente.

# **Requisitos Técnicos y de Infraestructura:**

- **Base de datos:** Gestiona de forma exclusiva las tablas `series`, `seasons` y `episodes`.
- **Caché (Crítico):** Implementación de **Redis** para almacenar las series más populares y los resultados de búsquedas frecuentes, reduciendo los accesos a la base de datos relacional a milisegundos.

---

## Listar Detalles de Series, Temporadas y Capítulos

Cuando el usuario hace clic en una serie en React Native, la app requiere una carga instantánea. Para evitar hacer múltiples consultas en cascada a la base de datos, implementaremos una estrategia de **Caché Read-Through con Redis**.

### Flujo Lógico de Consulta (`GET /api/v1/catalog/series/:id`)

1. **Consulta en Caché (Capa 1):** El backend verifica si existe la clave `series:detail:ID_SERIE` en Redis.
    - *Si existe (Cache Hit):* Retorna el JSON de inmediato. La latencia es de ~2ms.
2. **Consulta en Base de Datos (Capa 2):** Si no existe en Redis (Cache Miss), realiza un query en PostgreSQL combinando las tablas `series`, `seasons` y `episodes` en una sola consulta estructurada (usando los índices compuestos que definimos previamente).
    - *Lógica de Borde (Serie no registrada):* Si el ID no existe en PostgreSQL, el servicio no responde un 404 de inmediato. Llama internamente al **Módulo 3 (Ingestion Worker)** para verificar si la serie existe en la API externa (TVmaze). Si el Worker la descarga exitosamente, se inserta en PostgreSQL y continúa al paso 3. Si tampoco existe afuera, se retorna `404 Not Found`.
3. **Población de Caché:** El backend toma el resultado de la base de datos, lo guarda en Redis bajo la clave `series:detail:ID_SERIE` con un tiempo de expiración (**TTL**) de 24 horas (`86400` segundos) y lo retorna al frontend.

---

## Buscador Interno de Series (Por Título, Género o Año)

El buscador de una app estilo Letterboxd debe ser rápido y tolerante a pequeñas fallas de escritura.

### Flujo Lógico de Búsqueda (`GET /api/v1/catalog/search?q=query&genre=genero&year=year`)

1. **Sanitización y Normalización:** El backend limpia el texto recibido (`q`). Convierte el string a minúsculas y elimina caracteres extraños para evitar inyecciones SQL.
2. **Estrategia de Caché de Consultas:** Para evitar procesar la misma búsqueda cientos de veces, se genera una clave única en Redis basada en los parámetros de la URL, por ejemplo: `search:q:succession:g:drama:y:2023`.
    - Si la clave existe en Redis, sirve el array de resultados directamente.
3. **Búsqueda Indexada (PostgreSQL ILIKE o Full-Text Search):** Si es un *Cache Miss*, ejecuta el query sobre la tabla `series`.
    - *Query Base:* `SELECT id, title, poster_url, status FROM series WHERE title ILIKE '%query%' AND ('%genero%' = ANY(genres) OR genero IS NULL) AND EXTRACT(YEAR FROM first_air_date) = year;`
    - *Nota de diseño:* Para que esto vuele en milisegundos, el campo `title` debe tener un índice especial de tipo **trigram (pg_trgm)** en PostgreSQL, lo que permite búsquedas parciales ultra rápidas.
4. **Almacenamiento Temporal:** Los resultados de la búsqueda se guardan en Redis con un TTL corto (ej: 30 minutos), ya que las tendencias de búsqueda de los usuarios cambian rápido.

---

## Servir URLs de Posters y Backdrops Optimizados

Las imágenes son el recurso que más pesado hace el renderizado en React Native. Si la app móvil descarga posters de 5MB directamente de la API externa, la interfaz se colgará y consumirá los datos móviles de los usuarios.

### Lógica de Optimización en el Servidor (Helper de URLs)

Aunque uses las URLs originales de TVmaze o TMDB para ahorrar almacenamiento en disco, el backend debe actuar como un **formateador inteligente** antes de escupir el JSON al frontend:

1. **Detección de Tamaño según Endpoint:**
    - Si el frontend pide una lista de series (búsqueda o feed de actividad), el backend debe mapear la URL del póster para solicitar la versión **miniatura/medium** de la API externa.
    - Si el frontend pide el detalle completo de la serie, el backend sirve la URL en **alta resolución (original/large)** junto con el `backdrop_url` (imagen de fondo estirada).
2. **Manejo de Imágenes Caídas (Fallback):**
    - *Lógica de Borde:* Si al registrar la serie la API externa no proveía una imagen (`poster_url = null`), el backend nunca debe enviar un valor nulo al frontend. Debe sustituirlo automáticamente por la URL de un recurso local de tu servidor que sea una imagen genérica de marcador de posición (*Placeholder*) optimizada en formato **WebP** (ej: `[https://api.tuapp.com/assets/images/poster-placeholder.webp](https://api.tuapp.com/assets/images/poster-placeholder.webp)`). Esto evita que React Native rompa el diseño visual de las tarjetas al intentar renderizar un recurso roto.

---

## Gestión de Series Populares (El Home de la App)

En la pantalla de inicio de la aplicación querrás mostrar secciones como: *"Series Populares de la Semana"* o *"Tendencias"*. Hacer un `COUNT` o un `JOIN` masivo en la tabla de actividad (`watch_logs`) cada vez que alguien abre la app destruirá el rendimiento de la base de datos.

### Lógica de Hits de Popularidad en Redis:

1. Cada vez que un usuario marca un capítulo como visto en el *Módulo 4 (Activity Service)*, este publica un evento de forma asíncrona.
2. El *Catalog Service* escucha ese evento e incrementa un contador en una **Estructura Ordenada de Redis (Sorted Set)** bajo la clave `series:popular:week`.
    - Comando Redis: `ZINCRBY series:popular:week 1 ID_SERIE`
3. Cuando el endpoint del Home (`GET /api/v1/catalog/trending`) es solicitado, el backend solo le pide a Redis los 20 IDs con mayor puntuación:
    - Comando Redis: `ZREVRANGE series:popular:week 0 19`
4. Luego, el backend busca en la base de datos local (o en la caché) los detalles de esos 20 IDs específicos. Esto reduce una consulta masiva de analítica a una simple lectura de clave-valor que toma menos de 5 milisegundos. Un script automatizado (*Cron Job*) se encarga de resetear o aplicar un factor de decaimiento a este ranking cada domingo a la medianoche.