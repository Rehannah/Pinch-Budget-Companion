import { defineConfig } from "vite";
import { resolve } from "path";

export default defineConfig({
	base: "/", // Firebase Hosting at root
	root: "src",
	build: {
		outDir: "../dist",
		emptyOutDir: true,
		rollupOptions: {
			input: {
				main: resolve(__dirname, "src/index.html"),
				dashboard: resolve(__dirname, "src/dashboard.html"),
				login: resolve(__dirname, "src/login.html"),
				settings: resolve(__dirname, "src/settings.html"),
				transactions: resolve(__dirname, "src/transactions.html"),
				404: resolve(__dirname, "src/404.html"),
			},
		},
	},
});
