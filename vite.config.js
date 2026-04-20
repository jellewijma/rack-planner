import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
    base: '/rack-planner/',
    build: {
        rollupOptions: {
            input: {
                main: resolve(__dirname, 'index.html'),
                editor: resolve(__dirname, 'editor.html'),
                rackeditor: resolve(__dirname, 'rack-editor.html'),
            },
        },
    },
});
