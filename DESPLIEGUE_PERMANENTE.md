# 🚀 Guía de Despliegue Permanente en la Nube (Hosting Gratuito 24/7)

Para que tu aplicación **SportAgent Betano** tenga un **enlace web fijo permanente que nunca se apague**, la mejor opción gratuita y profesional es **Render.com** (o **Railway.app**).

Todo el repositorio ya cuenta con los archivos de configuración listos (`requirements.txt`, `Procfile`, `render.yaml` y `vercel.json`).

---

## Opción 1: Despliegue Gratuito en Render.com (Recomendado - 3 Minutos)

Render te otorga un enlace fijo permanente con certificado SSL (ejemplo: `https://sportagent-betano.onrender.com`).

### Pasos:

1. **Sube el código a GitHub:**
   - Si tienes cuenta en [GitHub.com](https://github.com), crea un nuevo repositorio llamado `sportagent-betano` (público o privado).
   - Sube la carpeta del proyecto a GitHub.

2. **Crea tu cuenta en Render:**
   - Entra a **[https://render.com](https://render.com)** y haz clic en **Sign Up** (puedes ingresar directamente con tu cuenta de GitHub).

3. **Crea el Servicio Web:**
   - En tu panel de Render, haz clic en **"New +"** y selecciona **"Web Service"**.
   - Conecta tu repositorio de GitHub `sportagent-betano`.
   - Llena los campos (la mayoría se detecta automáticamente):
     * **Name:** `sportagent-betano` *(o el nombre que prefieras)*
     * **Environment:** `Python 3`
     * **Build Command:** `pip install -r requirements.txt`
     * **Start Command:** `uvicorn backend.main:app --host 0.0.0.0 --port $PORT`
     * **Plan Type:** `Free` ($0/mes)
   - Haz clic en **"Create Web Service"**.

¡Listo! En 2 minutos Render compilará tu aplicación y te entregará tu **URL permanente fija** (ej. `https://sportagent-betano.onrender.com`) accesible 24/7 desde cualquier teléfono o computador del mundo.

---

## Opción 2: Despliegue en Railway.app (Alternativa Rápida)

1. Entra a **[https://railway.app](https://railway.app)** e inicia sesión con GitHub.
2. Haz clic en **"New Project"** -> **"Deploy from GitHub repo"**.
3. Selecciona el repositorio.
4. Railway detectará automáticamente el archivo `Procfile` y desplegará la app.
5. En la pestaña **Settings** -> **Networking**, haz clic en **"Generate Domain"** y obtendrás tu URL fija permanente (ej. `https://sportagent-betano.up.railway.app`).

---

## Opción 3: PythonAnywhere (100% Python Cloud)

1. Crea una cuenta gratuita en **[https://www.pythonanywhere.com](https://www.pythonanywhere.com)**.
2. Sube los archivos en la pestaña **Files**.
3. En la pestaña **Web**, crea una nueva web app con Python 3.11 y configura el archivo WSGI para apuntar a `backend.main:app`.
4. Tu enlace fijo permanente será `https://tu_usuario.pythonanywhere.com`.
