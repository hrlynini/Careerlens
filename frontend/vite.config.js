import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// In dev, Vite serves React on :5173 and forwards /api calls to the FastAPI backend on :8000.
export default defineConfig({
  plugins: [react()],
  server: { proxy: { "/api": "http://localhost:8000" } },
});
