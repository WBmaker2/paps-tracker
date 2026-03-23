import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/**/*.{js,ts,jsx,tsx,mdx}",
    "./tests/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        canvas: "#f5efe3",
        ink: "#14213d",
        accent: "#b35c2e",
        mist: "#dbe7e4",
      },
      boxShadow: {
        panel: "0 24px 70px rgba(20, 33, 61, 0.14)",
      },
      backgroundImage: {
        "paper-grid":
          "linear-gradient(rgba(20,33,61,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(20,33,61,0.04) 1px, transparent 1px)",
      },
      backgroundSize: {
        grid: "28px 28px",
      },
    },
  },
  plugins: [],
};

export default config;
