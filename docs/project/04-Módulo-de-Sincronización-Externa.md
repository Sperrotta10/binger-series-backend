# 3. Módulo de Sincronización Externa (Ingestion / Worker Service)

Creada por: Santiago Perrotta
Hora de creación: 17 de mayo de 2026 12:20
Categoría: Requisitos
Última edición por: Santiago Perrotta
Fecha de última actualización: 17 de mayo de 2026 14:55
Fecha de creación: 17 de mayo de 2026 12:20
Última edición: 17 de mayo de 2026 14:55

# Descripción

Este microservicio funciona en segundo plano (Background Worker) y es el encargado de interactuar con la API externa (TVmaze/TMDB). Aísla por completo al resto del sistema de los límites de peticiones de terceros.

# **Requisitos Funcionales:**

- **Población Progresiva:** Cuando el *Catalog Service* no encuentra una serie en la base de datos local, este módulo se activa para consultar la API externa, mapear el JSON e insertar los datos en la base de datos de forma asíncrona.
- **Actualizaciones Diarias (Cron):** Revisar qué series activas (*Status: "Running"*) emitieron capítulos nuevos el día anterior para actualizar el catálogo local automáticamente.

# **Requisitos Técnicos y de Infraestructura:**

- **Resiliencia:** Implementación de políticas de reintento con retroceso exponencial (*Exponential Backoff*) por si la API externa se cae o limita el tráfico.
- **Gestor de Colas:** Uso de un *Message Broker* como **RabbitMQ** o **BullMQ (Redis)** para procesar las tareas de importación en segundo plano sin ralentizar la navegación del usuario.

---

## Población Progresiva (On-Demand Ingestion)

Este flujo se activa cuando el *Catalog Service* (Módulo 2) experimenta un *Cache Miss* absoluto y la serie no existe en PostgreSQL. Para no hacer esperar al usuario de forma síncrona, el sistema procesa la importación en segundo plano.

### Flujo Lógico de la Cola de Importación

1. **Gatillo (Trigger):** El *Catalog Service* detecta que la serie solicitada por el usuario (buscada por su `api_id` o nombre exacto) no existe localmente. Añade un trabajo a la cola de BullMQ.JavaScript
    
    `// Código conceptual en el Catalog Service
    await ingestionQueue.add('import-series', { apiId: '12345', title: 'Succession' });`
    
2. **Consumo del Job (Worker):** El *Ingestion Worker* toma el trabajo de la cola de Redis e interactúa con la API externa (TVmaze).
3. **Llamada y Mapeo:** Solicita el endpoint completo de la serie incluyendo los embeds de temporadas y capítulos (`/shows/12345?embed[]=episodes&embed[]=seasons`).
4. **Transformación de Datos (Sanitización):** Transforma el JSON nativo de TVmaze al formato exacto de tu esquema de base de datos relacional:
    - Mapea los campos de texto, limpia strings vacíos y asigna imágenes por defecto si los posters vienen nulos.
    - Filtra campos innecesarios para ahorrar espacio en disco.
5. **Persistencia Atómica (Transacción SQL):** Inserta los datos en PostgreSQL en una sola transacción en cascada (`series` $\rightarrow$ `seasons` $\rightarrow$ `episodes`). Si la inserción de un capítulo falla, se aplica un *rollback* completo para evitar dejar datos corruptos o series a medias.
6. **Notificación de Éxito:** Una vez guardado en la base de datos, el Worker publica un evento o invalida la caché de búsqueda del *Catalog Service* para que la serie aparezca disponible inmediatamente en la app móvil.

---

## 2. Actualizaciones Diarias (Cron Jobs / Tareas Programadas)

Las series en emisión añaden capítulos semanalmente. Tu base de datos local debe actualizarse automáticamente todas las noches sin que ningún usuario tenga que solicitarlo.

### Flujo Lógico del Cron Job de Sincronización

1. **Programación:** Se configura un trabajo recurrente en BullMQ que se ejecuta de forma automática, por ejemplo, todos los días a las 3:00 AM (hora local del servidor).
2. **Consulta de Series Activas:** El Worker ejecuta un query en PostgreSQL para obtener todas las series cuyo estado sea de emisión activa:SQL
    
    `SELECT api_id FROM series WHERE status = 'Running';`
    
3. **Segmentación por Lotes (*Batching*):** Si tienes 5,000 series activas, no puedes pedir las 5,000 actualizaciones al mismo tiempo porque la API externa bloqueará tu IP por exceso de tráfico. El Worker divide la lista en lotes pequeños (ej: grupos de 50 series).
4. **Consulta de Cambios:** TVmaze ofrece un endpoint de *updates* (`/updates/shows`). El Worker compara la fecha de última actualización de su base de datos local con la marca de tiempo de la API externa.
5. **Inyección de Nuevos Capítulos:** Para cada serie que presente cambios, el Worker descarga la lista actualizada de episodios, identifica cuáles son nuevos (aquellos cuyo `episode_number` o `season_number` no existan en tu PostgreSQL) y los inserta en la tabla `episodes`.

---

## 3. Mecanismos de Resiliencia (Blindaje contra Fallos)

Las APIs de terceros fallan constantemente: caídas de servidores, microcortes de red o bloqueos por superar el límite de peticiones (*Rate Limiting*). Tu sistema distribuido debe estar preparado para fallar con elegancia.

### Estrategia 1: Retroceso Exponencial (*Exponential Backoff*)

Si TVmaze responde con un error de red o un código `503 Service Unavailable`, BullMQ no debe dar el trabajo por perdido ni reintentarlo inmediatamente de forma infinita (lo que empeoraría la situación del servidor externo).

- **Configuración del Reintento:** El trabajo se configura para reintentarse un máximo de 5 veces.
- **Cálculo del Tiempo:** Se aplica un factor multiplicador al tiempo de espera.
    - *Primer intento fallido:* Espera 5 segundos antes de volver a intentar.
    - *Segundo intento fallido:* Espera 25 segundos.
    - *Tercer intento fallido:* Espera 125 segundos (un poco más de 2 minutos).
    - *Cuarto intento fallido:* Espera ~10 minutos.
- Si tras los 5 intentos el servidor externo sigue caído, el trabajo se mueve a la cola de **Trabajos Fallidos (*Failed Queue*)** para revisión manual o alerta interna en tu panel de control, sin trabar los flujos de los usuarios.

### Estrategia 2: Manejo del Error 429 (Too Many Requests)

Si superas el límite de peticiones permitido por la API por segundo, responderán con un código HTTP `429`.

- **Lógica de Borde:** El Worker debe interceptar específicamente el estado `429`. Las APIs profesionales suelen incluir una cabecera HTTP llamada `Retry-After` que indica en segundos cuánto debes esperar antes de volver a hablar con ellos.
- **Pausa Dinámica de la Cola:** Al detectar el error 429, el Worker lee el valor de `Retry-After` y ejecuta una instrucción para **pausar por completo la cola de BullMQ** durante ese tiempo exacto. Todos los procesos de importación en segundo plano se congelan de inmediato y se reanudan automáticamente cuando el bloqueo expira, evitando que tu IP sea baneada de forma permanente.