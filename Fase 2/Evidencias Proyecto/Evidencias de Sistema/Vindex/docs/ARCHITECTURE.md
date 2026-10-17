# Arquitectura

## Tipo de arquitectura

El proyecto utiliza una arquitectura de Monorepo con aplicaciones
independientes y paquetes compartidos.

## Aplicaciones

Web
→ Next.js

Mobile
→ React Native + Expo

Backend
→ NestJS

## Comunicación

Web / Mobile
↓
REST API
↓
NestJS

Web / Mobile
↓
WebSocket
↓
NestJS