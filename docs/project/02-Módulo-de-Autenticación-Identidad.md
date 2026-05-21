# 1- Módulo de Autenticación e Identidad (Auth Service)

Creada por: Santiago Perrotta
Hora de creación: 17 de mayo de 2026 12:14
Categoría: Requisitos
Última edición por: Santiago Perrotta
Fecha de última actualización: 17 de mayo de 2026 14:38
Fecha de creación: 17 de mayo de 2026 12:14
Última edición: 17 de mayo de 2026 14:38

# Descripción

Este módulo se encarga exclusivamente de la seguridad, la gestión de sesiones y el ciclo de vida de las credenciales de los usuarios.

# **Requisitos Funcionales:**

- Registro e inicio de sesión tradicional (correo/contraseña).
- Inicio de sesión y vinculación de cuentas mediante **Google Sign-In (OAuth2)**.
- Flujo seguro de recuperación de contraseña (generación y validación de tokens con expiración de 15 minutos).
- Emisión y renovación de tokens de sesión (**JWT** de corta duración y **Refresh Tokens** guardados de forma segura).

# **Requisitos Técnicos y de Infraestructura:**

- **Seguridad:** Hacheo de contraseñas locales con `Bcrypt` o `Argon2`.
- **Base de datos:** Acceso a las tablas `users`, `user_oauth` y `password_resets`.
- **Comunicación:** Síncrona vía HTTP/REST o gRPC para que otros módulos verifiquen si un token es válido.

---

# El Flujo Lógico en el Backend

Para que veas cómo interactúa esta tabla con tu código de Node.js o Python, el proceso se divide en dos pasos:

### Paso 1: Solicitud de Recuperación (`POST /api/v1/auth/forgot-password`)

1. El usuario introduce su correo en la app.
2. Tu backend verifica si el correo existe en la tabla `users`. *(Tip de seguridad: Si no existe, por fuera responde un mensaje genérico como "Si el correo está registrado, recibirás un enlace", así evitas que atacantes adivinen qué correos tienen cuenta en tu app).*
3. Generas un token aleatorio y seguro usando una librería criptográfica nativa (ej: `crypto.randomBytes(32).toString('hex')` en Node.js).
4. **Seguridad Crítica:** Nunca guardes el token en texto plano en la base de datos. Aplícale un hash (como SHA-255) y guarda ese resultado en `token_hash`.
5. Insertas la fila en `password_resets` calculando el `expires_at` (ej: `NOW() + INTERVAL '15 minutes'`).
6. Envías un correo al usuario con un enlace que contenga el token original sin aplicar el hash (ej: `[https://tuapp.com/reset-password?token=TOKEN_ORIGINAL](https://tuapp.com/reset-password?token=TOKEN_ORIGINAL)`).

### Paso 2: Cambio de Contraseña (`POST /api/v1/auth/reset-password`)

1. El usuario hace clic en el enlace, la app abre un formulario para la nueva contraseña y envía el `TOKEN_ORIGINAL` junto a la nueva clave al backend.
2. El backend toma el `TOKEN_ORIGINAL`, le aplica el hash SHA-255 y busca ese hash en la tabla `password_resets`.
3. **Verificaciones obligatorias:**
    - ¿El registro existe?
    - ¿`expires_at` es mayor a la hora actual (`NOW()`)?
    - ¿`used_at` está vacío (`NULL`)?
4. Si todo es correcto, el backend genera el nuevo `password_hash` con Bcrypt/Argon2 y actualiza la contraseña en la tabla `users`.
5. Finalmente, actualizas la fila en `password_resets` marcando `used_at = NOW()` para que ese token muera definitivamente y no pueda ser reutilizado.

---

## Registro e Inicio de Sesión Tradicional

### Registro de Usuario (`POST /api/v1/auth/register`)

1. **Validación de Entrada:** Verificar que el `email` sea válido, el `username` no contenga caracteres especiales (para evitar problemas en las URLs de React Native) y la `password` cumpla con políticas de fuerza (mínimo 8 caracteres, letras y números).
2. **Verificación de Duplicados:** Realizar una consulta para verificar si el `email` o el `username` ya existen en la tabla `users`.
    - *Lógica de Borde:* Si existen, retornar un error `409 Conflict` especificando claramente cuál de los dos campos está duplicado para que el frontend guíe al usuario.
3. **Hacheo Criptográfico:** Generar un *salt* y procesar la contraseña usando `bcrypt.hash()` o `argon2.hash()`.
4. **Persistencia:** Insertar el registro en la tabla `users`. El campo `display_name` se inicializa por defecto igual al `username`.
5. **Respuesta:** No retornar el `password_hash`. Responder con un `201 Created` y los datos públicos del usuario.

### Inicio de Sesión (`POST /api/v1/auth/login`)

1. **Búsqueda:** Buscar al usuario en la tabla `users` mediante el `email`.
2. **Validación de Tipo de Cuenta:**
    - *Lógica de Borde:* Si el usuario existe pero el campo `password_hash` es `NULL` (porque se registró exclusivamente con Google), retornar un error `400 Bad Request` indicando: *"Esta cuenta utiliza inicio de sesión con Google"*.
3. **Verificación de Credenciales:** Si tiene contraseña, comparar la clave recibida con el hash almacenado usando `bcrypt.compare()`.
    - *Tip de Seguridad:* Si el correo no existe o la contraseña es incorrecta, retornar **siempre** el mismo error genérico: `401 Unauthorized` ("Credenciales incorrectas"). Esto evita la enumeración de usuarios.
4. **Generación de Sesión:** Si la comparación es exitosa, disparar la lógica de emisión de tokens (JWT + Refresh Token).

---

## Emisión y Renovación de Sesión (JWT & Refresh Tokens)

Para mantener al usuario autenticado en React Native de forma segura, estructuraremos un sistema de doble token.

### Emisión Inicial (Al loguearse o registrarse)

1. **Access Token (JWT):** Se firma con una clave secreta (`ACCESS_TOKEN_SECRET`).
    - *Payload:* Incluye únicamente el `id` del usuario y su `username`.
    - *Expiración:* Corta (ej: 15 minutos). Se envía en el cuerpo de la respuesta JSON.
2. **Refresh Token:** Una cadena aleatoria de alta entropía (opcionalmente un JWT firmado con `REFRESH_TOKEN_SECRET`).
    - *Expiración:* Larga (ej: 30 días).
    - *Persistencia:* Se almacena en la base de datos (puedes añadir una columna `refresh_token` en `users` o una tabla dedicada para soportar múltiples dispositivos) o en un almacén rápido como Redis para poder revocar sesiones.

### Renovación de Sesión (`POST /api/v1/auth/refresh`)

Cuando el Access Token expira en la app móvil, React Native envía el Refresh Token de forma automática en segundo plano.

1. **Validación:** El backend recibe el Refresh Token y comprueba su firma y fecha de expiración.
2. **Verificación de Revocación:** Se busca en la base de datos o Redis si ese token sigue siendo válido y pertenece al usuario.
    - *Lógica de Borde (Detección de Reutilización):* Si un Refresh Token ya fue usado o invalidado (por ejemplo, por un cierre de sesión previo o sospecha de hackeo), se deniega el acceso (`403 Forbidden`) y se fuerza al usuario a loguearse de nuevo.
3. **Rotación de Tokens (Recomendado):** El backend emite un **nuevo** Access Token y un **nuevo** Refresh Token, invalidando el anterior. Esto protege la sesión si el dispositivo pierde conectividad intermitentemente.

---

## Inicio de Sesión y Vinculación con Google (OAuth2)

Este flujo debe resolver tanto el inicio de sesión rápido como la vinculación si el usuario ya tenía una cuenta tradicional.

### Flujo Unificado (`POST /api/v1/auth/google`)

1. **Recepción:** El frontend (React Native) interactúa con el SDK de Google, obtiene un `id_token` (JWT firmado por Google) y lo envía a este endpoint del backend.
2. **Verificación de Google:** El backend utiliza la librería oficial `google-auth-library` para verificar que el token sea legítimo, descifrarlo y extraer: `sub` (Google ID único), `email`, `name`, y `picture`.
3. **Estrategia de Búsqueda (Control de Flujo):**
    - **Caso A (Ya es usuario Google):** Se busca en la tabla `user_oauth` si existe un registro con `provider = 'google'` y `provider_user_id = sub`. Si existe, se extrae el `user_id` asociado y se emiten los tokens de sesión de tu app. El flujo termina aquí.
    - **Caso B (Usuario tradicional que usa Google por primera vez):** Si no está en `user_oauth`, se busca en la tabla `users` si existe un registro con el mismo `email` que devolvió Google.
        - Si existe, se asume verificación implícita (Google ya validó ese correo). Se inserta una nueva fila en `user_oauth` vinculando este `sub` a ese `user_id` existente. Se inicia sesión.
    - **Caso C (Usuario completamente nuevo):** Si no existe el registro en ninguna tabla, se crea un nuevo usuario en `users` con el `email`, se genera un `username` automático basado en su nombre, `password_hash = NULL`, y se guarda su foto en `avatar_url`. Acto seguido, se crea su fila en `user_oauth` y se emiten sus tokens de sesión.
    
    ---
    
    ## Refuerzo de Seguridad en la Recuperación de Contraseña
    
    Ya definiste el flujo base para `forgot-password` y `reset-password`, pero para llevarlo a producción con Express debemos agregar estas reglas de negocio críticas:
    
    ### Validaciones estrictas en `POST /api/v1/auth/reset-password`:
    
    1. **Sanitización del Token:** Antes de aplicar el hash SHA-256 al `TOKEN_ORIGINAL` recibido del frontend, verificar que venga estructurado y no esté vacío para evitar inyecciones o errores de base de datos.
    2. **Control de Intentos Fallidos (Rate Limiting):** Si un usuario intenta enviar tokens de recuperación erróneos de forma masiva en este endpoint, el API Gateway o un middleware de Express (`express-rate-limit`) debe bloquear la IP temporalmente por 15 minutos para evitar ataques de fuerza bruta sobre el hash del token.
    3. **Invalidación Total de Sesiones Previas:** Al cambiar la contraseña con éxito en la tabla `users`, el backend debe **borrar todos los Refresh Tokens activos** de ese usuario en Redis o en la base de datos. Esto asegura que si la cuenta fue vulnerada o el cambio de clave se debió a un descuido de seguridad, cualquier sesión abierta en otros teléfonos o navegadores sea expulsada inmediatamente de forma automática.