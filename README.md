# 🌌 AURA / AI

> **NEURAL COMMAND INTERFACE // SYS.V 2.0**

Aura is a voice-first, cyberpunk-styled AI desktop assistant built with React, TypeScript, and Vite. It features a dynamic particle orb, persistent local memory, a full voice command processor, and hands-free wake-word activation.

![Aura UI Preview](https://via.placeholder.com/1200x600/080714/8b5cf6?text=AURA+AI+COMMAND+CENTER) 
<!-- Replace the link above with an actual screenshot of your UI once uploaded to GitHub -->

## 🚀 Features

- **Hands-Free Wake Word:** Turn on the power button (⏻) and leave it on. Aura stays in standby, listening for *"Aura, wake up"* or *"Hey Aura"*. It persists across page refreshes using `localStorage`.
- **Voice & Memory:** Speak commands to open websites, search Google/YouTube, get the time, or ask complex questions. Aura remembers your name and personal facts across sessions.
- **Embedded Media:** Play YouTube videos directly inside the Aura interface.
- **Dynamic UI:** A fully animated, responsive 3-column dashboard featuring a canvas-based particle orb that reacts to voice activity.
- **Light/Dark Mode:** Toggle the cyberpunk deep-blue aesthetic to a bright, soft purple UI.
- **Picture-in-Picture (PiP):** Pop Aura out into a floating window that syncs with your mic state.
- **Session Logs & Archive:** Track your recent commands and view your saved AI memory profile in real-time.

## 🛠️ Tech Stack

- **Framework:** React 18 + TypeScript
- **Build Tool:** Vite
- **Styling:** Vanilla CSS (Custom Cyberpunk Design System)
- **Icons:** React Icons (FontAwesome 6)
- **Speech:** Web Speech API (`SpeechRecognition` & `SpeechSynthesis`)
- **AI Backend:** Connected via custom API endpoint (`aura-api`)

## 📦 Getting Started

### 1. Prerequisites
Make sure you have [Node.js](https://nodejs.org/) installed on your machine.

### 2. Installation
Clone the repository and install the dependencies:

```bash
npm install