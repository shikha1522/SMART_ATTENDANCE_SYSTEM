import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import basicSsl from '@vitejs/plugin-basic-ssl';

// `npm run dev`       -> http://localhost:5173  (camera works on this computer)
// `npm run dev:https` -> https://<your-ip>:5173 (camera also works on your phone)
const useHttps = process.env.HTTPS === '1';

export default defineConfig({
  plugins: [react(), ...(useHttps ? [basicSsl()] : [])],
  server: { host: true, port: 5173, proxy: { '/api': 'http://localhost:5000' } },
});
