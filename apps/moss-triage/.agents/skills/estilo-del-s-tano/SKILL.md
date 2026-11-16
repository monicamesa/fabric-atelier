---
name: estilo-del-s-tano
description: "Usar SIEMPRE que se cree o modifique cualquier pantalla, componente, texto o estilo de Moss Triage: diseño visual, colores, tipografías, pixel art, textos de la interfaz, tooltips, humor y distribución de la pantalla."
metadata:
  author: Mónica Mesa
  version: 1.0.0
---
# Estilo del sótano

Moss Triage es una app de soporte con estética de terminal retro y humor de departamento de IT de sótano.

- Colores: usa SOLO las variables CSS de los temas (Modo sótano / Modo oficina). Nunca colores sueltos.
- Tipografías: VT323 para títulos y números grandes, IBM Plex Mono para IDs y etiquetas, Inter para texto.
- Pixel art: usa los componentes existentes PingScene, PixelAvatar y PixelFlame tal cual; no los redibujes ni crees versiones nuevas.
- Personas: muestra a cada miembro del equipo con <PixelAvatar memberId=...> + nombre de pila. Nunca iniciales y nombre a la vez.
- Tono: frases cortas, frikis y amables. Los chistes van sobre la situación, nunca sobre un cliente concreto.
- Toda jerga friki (PING>, PEBKAC, capa 8, nivel de café…) debe tener tooltip y estar en el "Manual del sótano".
- La pantalla está pensada para 1440 px de ancho y debe aprovechar la altura de la ventana: nada de cajas cuadradas que obliguen a hacer scroll de la página.
- Lakehouse solo lectura; todo lo que escribe la app va a TicketAssignment y TicketEvent.