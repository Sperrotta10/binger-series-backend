# Módulo de Listas (Curation)

Este módulo gestiona las listas de curación personalizadas que los usuarios pueden crear, editar, reordenar y eliminar para organizar series dentro de su perfil.

## Responsabilidades
1. **Creación y Edición (CRUD):** Los usuarios pueden definir metadatos de las listas (`name`, `description`, `is_private`).
2. **Reordenamiento Atómico (Drag-and-Drop):** Implementa un modelo de reordenamiento de los elementos de la lista en base al atributo `position`, soportado por una transacción atómica de base de datos (`deleteMany` seguido de `createMany`) usando Prisma.
3. **Caché con Patrón Cache-Aside:** La recuperación de la vista en detalle de la lista y sus series integradas implementa Redis como un intermediario de lectura. Esto optimiza enormemente el rendimiento y aminora los tiempos de respuesta.

## Redis Cache-Aside
El flujo operativo para el detalle de la lista (`GET /lists/:listId`) es el siguiente:
1. **Cache Hit:** Se verifica si existe el string `list:render:${listId}` en Redis. Si la llave existe y los permisos de privacidad están resueltos, devuelve el JSON parseado.
2. **Cache Miss:** Si no existe, se hace la consulta a la base de datos (PostgreSQL vía Prisma), estructurando los ítems ordenados de forma ascendente. Se guarda la información en Redis con un Time-To-Live (TTL) de 24 horas y retorna los datos.
3. **Invalidación de Caché (Write/Delete):** Ante cualquier actualización de metadatos (`PUT /lists/:listId`), reemplazo de ítems de la lista (`PUT /lists/:listId/items`), o eliminación total de la lista (`DELETE /lists/:listId`), se invoca de manera forzada una eliminación de llave (`redis.del("list:render:${listId}")`) para garantizar consistencia eventual.
