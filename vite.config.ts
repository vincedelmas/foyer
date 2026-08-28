import {nitro} from "nitro/vite";
import {defineConfig} from "vite";
import tailwindcss from "@tailwindcss/vite";
import viteReact from "@vitejs/plugin-react";
import {tanstackStart} from "@tanstack/react-start/plugin/vite";


const config = defineConfig({
    resolve: {
        tsconfigPaths: true,
    },
    plugins: [
        tailwindcss(),
        tanstackStart(),
        nitro({ preset: "bun" }),
        viteReact({ compiler: true }),
    ],
})


export default config;
