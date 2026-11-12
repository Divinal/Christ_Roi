// Contenu personnalisable par école : modifier ce fichier (et lui seul) suffit
// à adapter le nom, le logo, les textes et les coordonnées d'un site cloné.
export const siteConfig = {
  // URL publique du site (sans slash final) : utilisée pour le SEO
  // (balises canonical/Open Graph, robots.txt, sitemap.xml).
  siteUrl: 'https://rezo-edu.vercel.app',
  schoolName: 'Complexe Rezo Edu',
  tagline: 'Plateforme E-Learning Scolaire',
  logoUrl: '../Images/RezoCampus.png',
  logoFallbackInitials: 'UC',
  hero: {
    title: 'Votre parcours académique simplifié et connecté',
    description:
      "Une plateforme moderne pour faciliter l'accès aux notes, emplois du temps et informations essentielles pour tous les membres de la communauté universitaire & scolaire.",
  },
  stats: [
    { value: '500+', label: 'Étudiants' },
    { value: '50+', label: 'Enseignants' },
    { value: '100%', label: 'En ligne' },
  ],
  about: {
    title: 'Institut de Gestion Informatique & Commerciale',
    description: "La plateforme e-learning qui connecte étudiants, professeurs et administration.",
  },
  contact: {
    addressLines: ['Votre adresse ici avec quartier', 'Ville, Pays'],
    email: 'contact@universite-connect.fr',
    phone: '+242 06 000 00 00',
  },
  copyrightOwner: 'Université Connect',
  // En-tête officiel du bulletin de notes (imprimé tel quel, sans traduction).
  reportCard: {
    authorityLines: [
      "MINISTÈRE DE L'ENSEIGNEMENT PRÉSCOLAIRE, PRIMAIRE, SECONDAIRE ET DE L'ALPHABÉTISATION",
      "DIRECTION DÉPARTEMENTALE DE L'ENSEIGNEMENT PRÉSCOLAIRE, PRIMAIRE, SECONDAIRE ET DE L'ALPHABÉTISATION DE BRAZZAVILLE",
      "INSPECTION DES COLLÈGES D'ENSEIGNEMENT GÉNÉRAL DE BRAZZAVILLE II",
    ],
    country: 'RÉPUBLIQUE DU CONGO',
    countryMotto: 'Unité – Travail – Progrès',
    schoolMotto: 'Éducation – Travail – Progrès',
    address: 'Votre adresse ici avec quartier',
    city: 'Brazzaville',
    // Nom imprimé sous « Le chef d'établissement » (laisser vide pour signer à la main).
    headName: '',
  },
};

export type SiteConfig = typeof siteConfig;
