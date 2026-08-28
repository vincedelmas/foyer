import {defineConfig} from "vite";
import tailwindcss from "@tailwindcss/vite";
import viteReact from "@vitejs/plugin-react";
import {tanstackStart} from "@tanstack/react-start/plugin/vite";


const config = defineConfig({
    resolve: {
        noExternal: true,
        tsconfigPaths: true,
    },
    plugins: [
        tailwindcss(),
        tanstackStart(),
        viteReact({ compiler: true }),
    ],
})


export default config;
