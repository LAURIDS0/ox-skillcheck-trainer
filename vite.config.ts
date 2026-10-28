import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// relative base so the build works under any GitHub Pages repo path
export default defineConfig({ plugins: [react()], base: './' });
