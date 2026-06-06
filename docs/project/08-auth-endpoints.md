# API Contracts: Módulo 1 - Autenticación e Identidad

Este documento define el contrato estricto de los endpoints para el módulo de Autenticación de **Binger**. Todas las peticiones y respuestas manejan formato JSON.

---

## 1. POST `/api/v1/auth/register`
**Descripción:** Registro tradicional de usuarios mediante correo y contraseña.

* **Headers:** `Content-Type: application/json`
* **Body (Payload):**
```json
{
  "email": "santiago@example.com",
  "password": "Password123!",
  "name": "Santiago Perrotta"
}

```

* **Respuestas:**
* **`201 Created`:** Usuario registrado y sesión iniciada con éxito.
```json
{
  "status": "success",
  "message": "User registered successfully",
  "data": {
    "user": {
      "id": "uuid-v4-generated-string",
      "email": "santiago@example.com",
      "username": "santiago_perrotta",
      "name": "Santiago Perrotta",
      "avatar_url": null
    },
    "tokens": {
      "accessToken": "eyJhbGciOi...",
      "refreshToken": "def456..."
    }
  }
}

```

* **`400 Bad Request`:** Contraseña débil o formato de email inválido.
* **`409 Conflict`:** El correo electrónico ya se encuentra registrado.

---

## 2. POST `/api/v1/auth/login`

**Descripción:** Autenticación tradicional por credenciales.

* **Headers:** `Content-Type: application/json`
* **Body (Payload):**

```json
{
  "email": "santiago@example.com",
  "password": "Password123!"
}

```

* **Respuestas:**
* **`200 OK`:** Credenciales válidas. Devuelve datos de usuario y par de tokens (el Refresh Token también se guarda en Redis).
```json
{
  "status": "success",
  "data": {
    "user": {
      "id": "uuid-v4-string",
      "email": "santiago@example.com",
      "username": "santiago_perrotta",
      "name": "Santiago Perrotta",
      "avatar_url": "[https://api.binger.com/assets/avatars/default.webp](https://api.binger.com/assets/avatars/default.webp)"
    },
    "tokens": {
      "accessToken": "eyJhbGciOi...",
      "refreshToken": "def456..."
    }
  }
}

```

* **`401 Unauthorized`:** Correo o contraseña incorrectos.

---

## 3. POST `/api/v1/auth/oauth/google`

**Descripción:** Autenticación federada con Google Sign-In. El frontend envía el token proveído por el SDK nativo de Google en React Native.

* **Headers:** `Content-Type: application/json`
* **Body (Payload):**

```json
{
  "idToken": "google-oauth2-token-string"
}

```

* **Respuestas:**
* **`200 OK` / `201 Created`:** El backend valida el token con Google. Si el usuario no existía, lo crea automáticamente (*idempotencia*) y genera el nombre de usuario base. Devuelve la misma estructura de tokens que el login convencional.
* **`400 Bad Request`:** `idToken` ausente o corrupto.
* **`422 Unprocessable Entity`:** Fallo de verificación con los servidores de Google.

---

## 4. POST `/api/v1/auth/refresh`

**Descripción:** Rotación y renovación del Access Token cuando este expira.

* **Headers:** `Content-Type: application/json`
* **Body (Payload):**

```json
{
  "refreshToken": "def456..."
}

```

* **Respuestas:**
* **`200 OK`:** Token de refresco verificado contra Redis. Devuelve un nuevo set para mitigar ataques de reutilización (Refresh Token Rotation).
```json
{
  "status": "success",
  "data": {
    "tokens": {
      "accessToken": "new-eyJhbGciOi...",
      "refreshToken": "new-def456..."
    }
  }
}

```

* **`401 Unauthorized`:** Refresh token expirado, inválido o revocado.

---

## 5. POST `/api/v1/auth/forgot-password`

**Descripción:** Solicita un enlace de recuperación de contraseña. Envía un correo electrónico con un token seguro firmado.

* **Headers:** `Content-Type: application/json`
* **Body (Payload):**

```json
{
  "email": "santiago@example.com"
}

```

* **Respuestas:**
* **`200 OK`:** Proceso aceptado. Por seguridad (para evitar enumeración de usuarios), siempre devuelve éxito incluso si el correo no existe.
```json
{
  "status": "success",
  "message": "If the email exists, a password reset link has been sent."
}

```

---

## 6. POST `/api/v1/auth/reset-password`

**Descripción:** Consume el token de recuperación y actualiza la credencial del usuario.

* **Headers:** `Content-Type: application/json`
* **Body (Payload):**

```json
{
  "token": "sha256-hashed-recovery-token",
  "newPassword": "NewSecurePassword123!"
}

```

* **Respuestas:**
* **`200 OK`:** Contraseña actualizada. Invalida inmediatamente todas las sesiones previas del usuario en la base de datos y Redis.
```json
{
  "status": "success",
  "message": "Password updated successfully. All concurrent sessions have been revoked."
}

```

* **`400 Bad Request`:** Token corrupto o contraseña no cumple criterios de seguridad.
* **`410 Gone`:** El token de recuperación expiró (límite estricto de 15 minutos).

---

## 7. POST `/api/v1/auth/logout`

**Descripción:** Cierre de sesión y revocación del contexto de seguridad.

* **Headers:** `Authorization: Bearer <accessToken>`
* **Body:** Vacío.
* **Respuestas:**
* **`200 OK`:** Extrae el ID del usuario del JWT, elimina su Refresh Token activo de Redis y mete el Access Token actual en una lista negra temporal (*Blacklist*) hasta que expire para evitar su reutilización dañina.
```json
{
  "status": "success",
  "message": "Session revoked successfully."
}
```

Tienes toda la razón, Santiago. Para una plataforma social como **Binger**, el perfil del usuario (su `username`, biografía, avatar, etc.) es su carta de presentación ante la comunidad. Al no tener estos endpoints, el frontend de React Native no tendría cómo permitirle al usuario personalizar su cuenta después del registro.

Lo ideal para mantener limpia la API es manejar esto bajo un recurso `/profile` o `/me` dentro del mismo módulo de autenticación e identidad. Necesitamos dos endpoints clave: uno para **obtener** los datos actuales del perfil (esencial para rellenar los inputs del formulario en la app móvil) y otro para **actualizarlos** (manejando validaciones críticas como que el `username` no esté duplicado).

Aquí tienes la extensión técnica con los endpoints **8** y **9** para que los agregues directamente al final de tu archivo `docs/project/endpoints/01_auth_endpoints.md`:

---

## 8. GET `/api/v1/auth/profile/me`
**Descripción:** Obtiene la información completa del perfil del usuario autenticado. Se utiliza al cargar la pantalla de "Editar Perfil" en React Native para precargar los campos de texto.

* **Headers:** `Authorization: Bearer <accessToken>`
* **Body:** Vacío.
* **Respuestas:**
  * **`200 OK`:** Retorna los detalles públicos y privados del perfil del usuario.
    ```json
    {
      "status": "success",
      "data": {
        "user": {
          "id": "uuid-v4-string",
          "email": "santiago@example.com",
          "username": "santiago_perrotta",
          "name": "Santiago Perrotta",
          "biography": "Computer Engineer | Serial binge-watcher. Loving slow-burn dramas.",
          "avatar_url": "[https://api.binger.com/assets/avatars/santiago.webp](https://api.binger.com/assets/avatars/santiago.webp)",
          "created_at": "2026-05-15T12:00:00Z"
        }
      }
    }
    ```
  * **`401 Unauthorized`:** Token de acceso inválido o expirado.

---

## 9. PATCH `/api/v1/auth/profile/update`
**Descripción:** Modifica los datos del perfil del usuario (nombre, nombre de usuario, biografía y avatar). Todos los campos en el body son opcionales para permitir actualizaciones parciales.

* **Headers:** `Authorization: Bearer <accessToken>`
* **Body (Payload):**
```json
{
  "username": "santiago_dev",
  "name": "Santiago Perrotta",
  "biography": "Backend Developer & Movie Critic. Currently tracking Succession.",
  "avatar_url": "[https://api.binger.com/assets/avatars/new_avatar.webp](https://api.binger.com/assets/avatars/new_avatar.webp)"
}

```

* **Reglas de Validación en Backend:**
1. **Formato del `username`:** Debe ser estrictamente alfanumérico, permitir guiones bajos (`_`), minúsculas y no contener espacios (ej: regex `/^[a-z0-9_]+$/`). Máximo 15 caracteres.
2. **Límite de la `biography`:** Texto plano truncado a un máximo de 160 caracteres (estilo Twitter/Letterboxd) para optimizar el almacenamiento y el renderizado en tarjetas del móvil.


* **Respuestas:**
* **`200 OK`:** Perfil actualizado con éxito. Devuelve el objeto de usuario modificado para actualizar el estado global (Zustand/Context) en el frontend de inmediato.
```json
{
  "status": "success",
  "message": "Profile updated successfully",
  "data": {
    "user": {
      "id": "uuid-v4-string",
      "email": "santiago@example.com",
      "username": "santiago_dev",
      "name": "Santiago Perrotta",
      "biography": "Backend Developer & Movie Critic. Currently tracking Succession.",
      "avatar_url": "[https://api.binger.com/assets/avatars/new_avatar.webp](https://api.binger.com/assets/avatars/new_avatar.webp)"
    }
  }
}

```

* **`400 Bad Request`:** El `username` contiene caracteres inválidos, espacios o la biografía excede el límite de caracteres.
* **`401 Unauthorized`:** No autorizado.
* **`409 Conflict`:** El `username` solicitado ya está siendo utilizado por otro usuario en la base de datos (los usernames deben ser llaves únicas).