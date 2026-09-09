export default {
    content: ["./index.html", "./src/**/*.{ts,tsx}"],
    theme: {
        extend: {
            colors: {
                canvas: "#141312",
                void: "#0f0e0d",
                shell: "#1a1917",
                mist: "#252320",
                ink: "#f4f1ec",
                pine: "#62d994",
                ember: "#b9b2a8",
                gold: "#c8a96b",
                storm: "#9b948a",
                rosewood: "#d98282",
            },
            fontFamily: {
                display: ["\"Archivo\"", "sans-serif"],
                body: ["\"IBM Plex Sans\"", "sans-serif"],
            },
            boxShadow: {
                haze: "0 32px 90px rgba(0, 0, 0, 0.42)",
            },
            backgroundImage: {
                glow: "linear-gradient(180deg, #141312 0%, #141312 100%)",
            },
        },
    },
    plugins: [],
};
