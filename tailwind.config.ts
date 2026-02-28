import type { Config } from "tailwindcss";

const config: Config = {
    content: [
        "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
        "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
        "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
    ],
    theme: {
        container: {
            center: true,
            padding: "1rem",
            screens: {
                "2xl": "1400px",
            },
        },
        extend: {
            colors: {
                cyan: {
                    DEFAULT: "var(--cyan)",
                    dark: "var(--cyan-dark)",
                    light: "var(--cyan-light)",
                },
                navy: "var(--navy)",
                "bg-main": "var(--bg-main)",
                surface: "var(--surface)",
                text: {
                    DEFAULT: "var(--text)",
                    muted: "var(--text-muted)",
                },
                border: {
                    DEFAULT: "var(--border)",
                    hover: "var(--border-hover)",
                },
                success: "var(--success)",
                error: {
                    DEFAULT: "var(--error)",
                    bg: "var(--error-bg)",
                },
            },
            fontFamily: {
                sans: ["var(--font-outfit)", "sans-serif"],
            },
            boxShadow: {
                sm: "0 4px 12px rgba(26, 94, 168, 0.04)",
                lg: "0 24px 48px -12px rgba(26, 94, 168, 0.12)",
                btn: "0 8px 20px rgba(26, 94, 168, 0.25)",
                "btn-hover": "0 12px 28px rgba(26, 94, 168, 0.35)",
            },
            borderRadius: {
                lg: "24px",
                md: "16px",
                sm: "12px",
            },
        },
    },
    plugins: [],
};
export default config;


