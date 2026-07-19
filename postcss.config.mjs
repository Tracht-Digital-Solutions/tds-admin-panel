// Astro 6 ships Vite 7 with rolldown, incompatible with the @tailwindcss/vite
// plugin's resolver shape (withastro/astro#16542). Run Tailwind through PostCSS.
// The host's global.css carries the @source directive that scans the host +
// extension packages in node_modules.
export default {
  plugins: {
    "@tailwindcss/postcss": {},
  },
};
