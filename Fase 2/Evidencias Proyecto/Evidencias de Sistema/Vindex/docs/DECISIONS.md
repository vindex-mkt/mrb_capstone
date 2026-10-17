# Architectural Decisions

## ADR-001 — Monorepo

Fecha: 2026-09-07

### Decisión

Utilizar Turborepo para administrar el proyecto.

### Motivo

El proyecto contiene:

- Web
- Mobile
- Backend

y necesita compartir:

- Tipos
- Validaciones
- Cliente API
- Componentes

### Alternativas consideradas

- Repositorios separados
- Monorepo manual
- Nx

### Decisión final

Turborepo.