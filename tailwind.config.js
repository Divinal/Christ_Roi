import colors from 'tailwindcss/colors';
import plugin from 'tailwindcss/plugin';

// ------------------------------------------------------------------
// Thème sombre centralisé : les pages utilisent des classes de couleur
// claires (bg-white, text-gray-600, bg-blue-50...). Plutôt que d'ajouter
// un "dark:" sur chacune, ce plugin les réinterprète quand <html> porte
// la classe "dark". Réservé à l'écran : l'impression (reçus, bulletins)
// reste en clair.
// Si une nouvelle teinte est utilisée, l'ajouter à TINTS.
// ------------------------------------------------------------------
const TINTS = ['blue', 'green', 'red', 'purple', 'orange', 'indigo', 'pink', 'yellow', 'teal'];

const SURFACES = {
  white: 'hsl(var(--card))',
  'gray-50': 'hsl(var(--surface-sunken))',
  'gray-100': 'hsl(var(--surface-raised))',
  'gray-200': 'hsl(var(--surface-strong))',
};
const SURFACE_HOVERS = { 'gray-50': 0.04, 'gray-100': 0.07, 'gray-200': 0.1, 'gray-300': 0.14 };
const GRAY_TEXT = {
  900: 'hsl(var(--foreground))',
  800: '#e2e8f0',
  700: '#cbd5e1',
  600: '#a8b3c4',
  500: '#94a3b8',
  400: '#7f8ea3',
};
const TINT_ALPHA = { 50: 0.12, 100: 0.2, 200: 0.3 };
const TINT_TEXT = { 500: 400, 600: 400, 700: 300, 800: 200 };

const withAlpha = (hex, alpha) => {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
  return `rgb(${r} ${g} ${b} / ${alpha})`;
};

const darkTheme = plugin(({ addBase }) => {
  const base = {};
  const hovers = {};

  // bg-white reste translucide quand il sert de voile sur un dégradé.
  base['.dark .bg-white:not([class*="bg-opacity"])'] = { backgroundColor: SURFACES.white };
  ['gray-50', 'gray-100', 'gray-200'].forEach((name) => {
    base[`.dark .bg-${name}`] = { backgroundColor: SURFACES[name] };
  });
  Object.entries(SURFACE_HOVERS).forEach(([name, alpha]) => {
    hovers[`.dark .hover\\:bg-${name}:hover`] = { backgroundColor: `rgb(255 255 255 / ${alpha})` };
  });

  Object.entries(GRAY_TEXT).forEach(([shade, color]) => {
    base[`.dark .text-gray-${shade}`] = { color };
    hovers[`.dark .hover\\:text-gray-${shade}:hover`] = { color };
  });
  ['200', '300'].forEach((shade) => {
    base[`.dark .border-gray-${shade}`] = { borderColor: 'hsl(var(--border))' };
  });

  TINTS.forEach((tint) => {
    Object.entries(TINT_ALPHA).forEach(([shade, alpha]) => {
      const value = withAlpha(colors[tint][500], alpha);
      base[`.dark .bg-${tint}-${shade}`] = { backgroundColor: value };
      hovers[`.dark .hover\\:bg-${tint}-${shade}:hover`] = { backgroundColor: value };
      base[`.dark .border-${tint}-${shade}`] = { borderColor: value };
    });
    Object.entries(TINT_TEXT).forEach(([shade, lighter]) => {
      base[`.dark .text-${tint}-${shade}`] = { color: colors[tint][lighter] };
      hovers[`.dark .hover\\:text-${tint}-${shade}:hover`] = { color: colors[tint][lighter] };
    });
  });

  // Dégradés pâles : fond de page et en-têtes d'emploi du temps.
  base['.dark .from-gray-50'] = { backgroundImage: 'none' };
  ['blue', 'green'].forEach((tint) => {
    base[`.dark .from-${tint}-100`] = { backgroundImage: 'none', backgroundColor: SURFACES['gray-100'] };
  });

  // Une ombre ne se voit pas sur fond sombre : on la double d'un filet.
  ['shadow', 'shadow-sm', 'shadow-md', 'shadow-lg'].forEach((name) => {
    const value = '0 0 0 1px hsl(var(--border)), 0 12px 28px -14px rgb(0 0 0 / 0.7)';
    base[`.dark .${name}`] = { '--tw-shadow': value, '--tw-shadow-colored': value };
  });

  // Les survols viennent après : à spécificité égale, ils doivent l'emporter.
  addBase({ '@media screen': { ...base, ...hovers } });
});

/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ["class"],
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
    },
  },
  plugins: [darkTheme],
}