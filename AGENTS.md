# Instrucciones del usuario

- Ejecutar las tareas solicitadas de principio a fin sin pedir confirmaciones ni volver a solicitar autorizaciones ya concedidas.
- Resolver decisiones rutinarias con criterio propio y continuar con implementación, verificaciones y correcciones necesarias dentro del alcance solicitado.
- No terminar con preguntas como «¿procedo?» o «¿quieres que lo haga?» cuando la solicitud ya autoriza el trabajo.
- Preguntar únicamente por información indispensable que no pueda deducirse del contexto.
- Si una restricción obligatoria del entorno impide una acción, explicar el bloqueo concreto sin afirmar que una regla de este archivo puede eliminarlo.

# Modelos y skills

- Elegir el modelo según la tarea: `taller-simple` (GPT-6 Luna, high) para cambios pequeños y bien definidos; `taller-normal` (GPT-6.1 Sol, medium) para implementación habitual; `taller-profundo` (GPT-6.1 Sol, xhigh) para auditorías, cambios amplios y problemas difíciles.
- Los perfiles se seleccionan al iniciar Codex con `--profile`. En una conversación abierta, el cambio depende del selector de modelos del cliente. No afirmar que el modelo cambió solamente por editar instrucciones o archivos.
- Consultar `docs/codex.md` y las plantillas de `.codex/profiles/` para instalar y usar los perfiles. No reducir el esfuerzo de una tarea compleja solo para ahorrar recursos.
- Para cambios en React y rendimiento, aplicar `vercel-react-best-practices` cuando esté instalada; usar las reglas compatibles con React/Vite. Verificar la interfaz con `playwright` cuando corresponda.
- No instalar skills redundantes ni agregar dependencias de ejecución para tareas que pueden resolverse con React y CSS existentes.
