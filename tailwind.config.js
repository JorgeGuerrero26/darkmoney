export default {
    content: ["./index.html", "./src/**/*.{ts,tsx}"],
    theme: {
        extend: {
            colors: {
                canvas: "#05070b",
                void: "#090d12",
                shell: "#0f141b",
                mist: "#141b24",
                ink: "#f5f7fb",
                pine: "#6be4c5",
                ember: "#8ea5ff",
                gold: "#d7be7b",
                storm: "#96a2b5",
                rosewood: "#ff8f9e",
            },
            fontFamily: {
                display: ["\"Outfit\"", "sans-serif"],
                body: ["\"Manrope\"", "sans-serif"],
            },
            boxShadow: {
                haze: "0 32px 90px rgba(0, 0, 0, 0.42)",
            },
            backgroundImage: {
                glow: "radial-gradient(circle at top left, rgba(107,228,197,0.16), transparent 34%), radial-gradient(circle at 85% 10%, rgba(142,165,255,0.15), transparent 28%), radial-gradient(circle at 50% 100%, rgba(215,190,123,0.08), transparent 32%), linear-gradient(180deg, #070a10 0%, #05070b 100%)",
            },
        },
    },
    plugins: [],
};
