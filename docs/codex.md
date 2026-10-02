# Codex: modelos y skills

Usamos perfiles según el alcance de la tarea. Las plantillas versionadas están en
`.codex/profiles/` y sus copias locales se instalan en `~/.codex/`.

| Perfil            | Modelo      | Esfuerzo | Uso                                                         |
| ----------------- | ----------- | -------- | ----------------------------------------------------------- |
| `taller-simple`   | GPT-6 Luna  | high     | Ajustes pequeños, documentación y tareas acotadas           |
| `taller-normal`   | GPT-6.1 Sol | medium   | Implementación y revisión habituales                        |
| `taller-profundo` | GPT-6.1 Sol | xhigh    | Auditorías, refactorizaciones amplias y problemas difíciles |

Instalación en otro equipo:

```bash
mkdir -p ~/.codex
cp .codex/profiles/taller-*.config.toml ~/.codex/
```

Seleccionar un perfil al iniciar una sesión:

```bash
codex --profile taller-simple
codex --profile taller-normal
codex --profile taller-profundo
```

En una sesión interactiva del CLI se puede cambiar el modelo con `/model`; en la
aplicación o extensión se usa su selector. Estos perfiles no hacen selección
automática ni cambian el modelo de una respuesta que ya está ejecutándose.
Tampoco alteran los permisos de la configuración base.

Los modelos deben estar disponibles para la cuenta. El formato de perfiles
corresponde a Codex 0.160.0, verificado en este equipo; desde la versión 0.134.0
se usan archivos separados y no tablas `[profiles.nombre]`.
Fuentes: [perfiles de Codex](https://learn.chatgpt.com/docs/config-file/config-advanced#profiles)
y [selección de modelos](https://learn.chatgpt.com/docs/models#recommended-models).

## Skills de frontend

- `frontend-design`: composición visual y coherencia del sitio.
- `playwright`: revisión real en navegador, escritorio y móvil.
- `vercel-react-best-practices`: rendimiento de componentes React, limpieza de
  listeners, imports directos y carga condicional. Aplicar las reglas pertinentes
  a React/Vite; las reglas específicas de Next.js no corresponden a este proyecto.

La nueva skill se instala globalmente, fuera de los archivos y dependencias de
la aplicación, desde el [repositorio oficial de Vercel](https://github.com/vercel-labs/agent-skills/tree/main/skills/react-best-practices).
Para instalarla en otro equipo, usar `skill-installer` con el repositorio
`vercel-labs/agent-skills`, la ruta `skills/react-best-practices` y el nombre
`vercel-react-best-practices`. Estará disponible en el catálogo de Codex a partir
del siguiente turno.
