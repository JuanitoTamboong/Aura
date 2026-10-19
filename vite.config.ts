import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import tailwindcss from '@tailwindcss/vite' // 1. Import the Tailwind plugin

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()], // 2. Add tailwindcss() to the plugins array
})