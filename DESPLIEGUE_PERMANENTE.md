# 🚀 Guía de Despliegue Permanente en la Nube (Hosting Gratuito 24/7)

Para que tu aplicación **SPORT-AGENT PRO · Betano Edition** y su **PWA instalable en el celular** funcionen de forma fija **24 horas al día, 7 días a la semana con el computador apagado**, la mejor opción gratuita y automática es **Render.com** o **Railway.app**.

El repositorio local ya está **100% inicializado con Git y su commit listo** para vincular con tu cuenta de GitHub.

---

## Paso 1: Subir tu Repositorio a GitHub (1 Minuto)

1. Ve a **[https://github.com/new](https://github.com/new)** y crea un repositorio (ej. nombre: `sportagent-betano`, público o privado). **No marques** la opción de agregar README ni .gitignore porque ya los tenemos creados y configurados.
2. Abre la consola de PowerShell en la carpeta del proyecto y ejecuta estos comandos (reemplazando `TU_USUARIO` por tu usuario de GitHub):

```powershell
# Si usas el git del sistema:
git remote add origin https://github.com/TU_USUARIO/sportagent-betano.git
git push -u origin main
```

*(Si no tienes git en el path de Windows, puedes usar la herramienta incluida en el proyecto: `.\.tools\mingit\cmd\git.exe push -u origin main`)*.

---

## Paso 2: Despliegue en Render.com (Gratis y Automático)

Render te entregará un dominio HTTPS permanente (ejemplo: `https://sportagent-betano.onrender.com`) con soporte completo de Service Worker y PWA móvil.

1. Entra a **[https://render.com](https://render.com)** y haz clic en **Sign Up** o **Log In** usando tu cuenta de GitHub.
2. En el panel principal, haz clic en **"New +"** (arriba a la derecha) y selecciona **"Web Service"**.
3. Selecciona tu repositorio de GitHub `sportagent-betano`.
4. Render detectará automáticamente el archivo `render.yaml` y la configuración:
   * **Name:** `sportagent-betano`
   * **Environment:** `Python 3`
   * **Build Command:** `pip install -r requirements.txt`
   * **Start Command:** `uvicorn main:app --host 0.0.0.0 --port $PORT`
   * **Instance Type / Plan:** `Free` ($0/mes)
5. Haz clic en **"Deploy Web Service"**.
6. En 2 minutos estará listo y verás tu URL permanente (ej. `https://sportagent-betano.onrender.com`).

---

## Paso 3: Alternativa en Railway.app

1. Entra a **[https://railway.app](https://railway.app)** e inicia sesión con tu GitHub.
2. Presiona **"New Project"** -> **"Deploy from GitHub repo"**.
3. Selecciona `sportagent-betano`.
4. Railway leerá automáticamente el archivo `Procfile` y levantará el servidor FastAPI.
5. En la sección **Settings** -> **Networking**, haz clic en **"Generate Domain"** para obtener tu enlace permanente `https://sportagent-betano.up.railway.app`.

---

## Paso 4: Instalar la PWA en tu Celular desde la URL Permanente

1. Abre tu nueva URL permanente en **Chrome** (Android) o **Safari** (iPhone).
2. Verás que la app carga al instante desde la nube mundial.
3. Presiona el botón verde **«📲 Instalar App»** o en el menú del navegador selecciona **«Agregar a la pantalla principal»**.
4. ¡Listo! Ya tienes la aplicación en tu celular funcionando las 24 horas del día sin necesidad de tener tu PC encendido.
