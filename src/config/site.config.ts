// Contenu personnalisable par école : modifier ce fichier (et lui seul) suffit
// à adapter le nom, le logo, les textes et les coordonnées d'un site cloné.
export const siteConfig = {
  schoolName: 'Rezo Campus Consulting',
  tagline: 'Plateforme E-Learning Universitaire',
  logoUrl: '../Images/RezoCampus.png',
  logoFallbackInitials: 'UC',
  hero: {
    title: 'Votre parcours académique simplifié et connecté',
    description:
      "Une plateforme moderne pour faciliter l'accès aux cours, examens et informations essentielles pour tous les membres de la communauté universitaire.",
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
    addressLines: ['1°Ét., 28800, Imm Kihel, Bd Hassan II', 'Mohammédia 28800, Maroc'],
    email: 'contact@universite-connect.fr',
    phone: '+212 6 66 97 66 98',
  },
  copyrightOwner: 'Université Connect',
};

export type SiteConfig = typeof siteConfig;
