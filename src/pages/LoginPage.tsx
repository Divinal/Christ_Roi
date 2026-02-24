import React, { useState } from 'react';
import { AlertCircle, Menu, X as CloseIcon } from 'lucide-react';
import { supabase } from '../lib/supabaseClient';
import { User } from '../types';

interface LoginPageProps {
  onLogin: (user: User) => void;
  setCurrentPage?: (page: string) => void;
}

const LoginPage: React.FC<LoginPageProps> = ({ onLogin, setCurrentPage }) => {
  const [email, setEmail] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>('');
  const [showLoginModal, setShowLoginModal] = useState<boolean>(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState<boolean>(false);

  const handleLogin = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (authError) throw authError;

      if (authData.user) {
        const { data: userData, error: userError } = await supabase
          .from('users')
          .select('*')
          .eq('id', authData.user.id)
          .maybeSingle();

        if (userError) throw userError;

        if (userData) {
          const user: User = {
            id: userData.id,
            email: userData.email,
            role: userData.role,
            firstName: userData.first_name,
            lastName: userData.last_name,
            first_name: userData.first_name,
            last_name: userData.last_name,
          };
          onLogin(user);
        } else {
          throw new Error('Utilisateur non trouvé dans la base de données');
        }
      }
    } catch (error: any) {
      setError(error.message || 'Erreur de connexion');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-gray-50 to-blue-50">
      {/* ============ HEADER ============ */}
      <header className="bg-white shadow-sm sticky top-0 z-40">
        <nav className="container mx-auto px-4 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            {/* Logo */}
            <div className="flex items-center gap-3">
              <img 
                src="../Images/RezoCampus.png" 
                alt="Logo" 
                className="h-10 w-10 object-contain"
                onError={(e) => {
                  e.currentTarget.src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="40" height="40"%3E%3Crect fill="%233b82f6" width="40" height="40" rx="8"/%3E%3Ctext x="50%25" y="50%25" dominant-baseline="middle" text-anchor="middle" fill="white" font-size="20" font-weight="bold"%3EUC%3C/text%3E%3C/svg%3E';
                }}
              />
              <h1 className="text-xl md:text-2xl font-bold text-blue-600">
                Rezo Campus Consulting
              </h1>
            </div>

            {/* Navigation Desktop */}
            <div className="hidden md:flex items-center gap-8">
              <a href="#accueil" className="text-gray-600 hover:text-blue-600 transition">
                Accueil
              </a>
              <a href="#apropos" className="text-gray-600 hover:text-blue-600 transition">
                À propos
              </a>
              <a href="#contact" className="text-gray-600 hover:text-blue-600 transition">
                Contact
              </a>
              <button
                onClick={() => setShowLoginModal(true)}
                className="bg-blue-600 text-white px-6 py-2 rounded-lg font-medium hover:bg-blue-700 transition shadow-md"
              >
                Connexion
              </button>
            </div>

            {/* Bouton Menu Mobile */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden p-2 text-gray-600 hover:text-blue-600"
            >
              {mobileMenuOpen ? <CloseIcon className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>

          {/* Menu Mobile */}
          {mobileMenuOpen && (
            <div className="md:hidden mt-4 pb-4 space-y-3 border-t pt-4">
              <a 
                href="#accueil" 
                className="block text-gray-600 hover:text-blue-600 transition py-2"
                onClick={() => setMobileMenuOpen(false)}
              >
                Accueil
              </a>
              <a 
                href="#apropos" 
                className="block text-gray-600 hover:text-blue-600 transition py-2"
                onClick={() => setMobileMenuOpen(false)}
              >
                À propos
              </a>
              <a 
                href="#contact" 
                className="block text-gray-600 hover:text-blue-600 transition py-2"
                onClick={() => setMobileMenuOpen(false)}
              >
                Contact
              </a>
              <button
                onClick={() => {
                  setShowLoginModal(true);
                  setMobileMenuOpen(false);
                }}
                className="w-full bg-blue-600 text-white px-6 py-2 rounded-lg font-medium hover:bg-blue-700 transition"
              >
                Connexion
              </button>
            </div>
          )}
        </nav>
      </header>

      {/* ============ HERO SECTION ============ */}
      <main className="flex-1">
        <section id="accueil" className="container mx-auto px-4 lg:px-8 py-16 md:py-24">
          <div className="max-w-4xl mx-auto text-center">
            {/* Badge */}
            <div className="inline-block mb-6">
              <span className="bg-blue-100 text-blue-600 px-4 py-2 rounded-full text-sm font-medium">
                Plateforme E-Learning Universitaire
              </span>
            </div>

            {/* Titre Principal */}
            <h2 className="text-3xl md:text-5xl lg:text-6xl font-bold text-gray-900 mb-6">
              Votre parcours académique{' '}
              <span className="text-blue-600">simplifié</span> et{' '}
              <span className="text-blue-600">connecté</span>
            </h2>

            {/* Description */}
            <p className="text-lg md:text-xl text-gray-600 mb-8 max-w-3xl mx-auto leading-relaxed">
              Une plateforme moderne pour faciliter l'accès aux cours, examens et 
              informations essentielles pour tous les membres de la communauté universitaire.
            </p>

            {/* Boutons CTA */}
            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
              <button
                onClick={() => setShowLoginModal(true)}
                className="bg-blue-600 text-white px-8 py-3 rounded-lg font-medium hover:bg-blue-700 transition shadow-lg text-lg w-full sm:w-auto"
              >
                Commencer maintenant
              </button>
              <button
                className="bg-white text-gray-700 px-8 py-3 rounded-lg font-medium hover:bg-gray-50 transition border border-gray-300 text-lg w-full sm:w-auto"
              >
                En savoir plus
              </button>
            </div>

            {/* Stats ou Features */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mt-16">
              <div className="bg-white p-6 rounded-xl shadow-md">
                <div className="text-3xl font-bold text-blue-600 mb-2">500+</div>
                <div className="text-gray-600">Étudiants</div>
              </div>
              <div className="bg-white p-6 rounded-xl shadow-md">
                <div className="text-3xl font-bold text-blue-600 mb-2">50+</div>
                <div className="text-gray-600">Enseignants</div>
              </div>
              <div className="bg-white p-6 rounded-xl shadow-md">
                <div className="text-3xl font-bold text-blue-600 mb-2">100%</div>
                <div className="text-gray-600">En ligne</div>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* ============ FOOTER ============ */}
      <footer className="bg-white border-t mt-auto">
        <div className="container mx-auto px-4 lg:px-8 py-12">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            {/* Colonne 1 : À propos */}
            <div>
              <h3 className="font-bold text-gray-900 mb-4 text-lg">Institut de Gestion Informatique & Commerciale</h3>
              <p className="text-gray-600 text-sm leading-relaxed">
                La plateforme e-learning qui connecte étudiants, professeurs et administration.
              </p>
            </div>

            {/* Colonne 2 : Liens rapides */}
            <div>
              <h3 className="font-bold text-gray-900 mb-4 text-lg">Liens rapides</h3>
              <ul className="space-y-2 text-sm">
                <li>
                  <a href="#accueil" className="text-gray-600 hover:text-blue-600 transition">
                    Accueil
                  </a>
                </li>
                <li>
                  <a href="#apropos" className="text-gray-600 hover:text-blue-600 transition">
                    À propos
                  </a>
                </li>
                <li>
                  <a href="#contact" className="text-gray-600 hover:text-blue-600 transition">
                    Contact
                  </a>
                </li>
                <li>
                  <button 
                    onClick={() => setShowLoginModal(true)}
                    className="text-gray-600 hover:text-blue-600 transition"
                  >
                    Connexion
                  </button>
                </li>
              </ul>
            </div>

            {/* Colonne 3 : Ressources */}
            <div>
              <h3 className="font-bold text-gray-900 mb-4 text-lg">Ressources</h3>
              <ul className="space-y-2 text-sm">
                <li>
                  <a href="#" className="text-gray-600 hover:text-blue-600 transition">
                    Aide
                  </a>
                </li>
                <li>
                  <a href="#" className="text-gray-600 hover:text-blue-600 transition">
                    Guide d'utilisation
                  </a>
                </li>
                <li>
                  <a href="#" className="text-gray-600 hover:text-blue-600 transition">
                    FAQ
                  </a>
                </li>
                <li>
                  <a href="#" className="text-gray-600 hover:text-blue-600 transition">
                    Support
                  </a>
                </li>
              </ul>
            </div>

            {/* Colonne 4 : Contact */}
            <div>
              <h3 className="font-bold text-gray-900 mb-4 text-lg">Contact</h3>
              <ul className="space-y-2 text-sm text-gray-600">
                <li>1°Ét., 28800, Imm Kihel, Bd Hassan II</li>
                <li>Mohammédia 28800, Maroc</li>
                <li>
                  <a href="mailto:contact@universite-connect.fr" className="hover:text-blue-600 transition">
                    contact@universite-connect.fr
                  </a>
                </li>
                <li>
                  <a href="tel:+212666976698" className="hover:text-blue-600 transition">
                    +212 6 66 97 66 98
                  </a>
                </li>
              </ul>
            </div>
          </div>

          {/* Copyright */}
          <div className="border-t mt-8 pt-8 text-center">
            <p className="text-sm text-gray-500">
              © 2026 Université Connect. Tous droits réservés by mister divin.
            </p>
          </div>
        </div>
      </footer>

      {/* ============ MODAL DE CONNEXION ============ */}
      {showLoginModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 px-4">
          <div className="bg-white rounded-2xl shadow-2xl p-6 md:p-8 w-full max-w-md relative">
            <button
              onClick={() => setShowLoginModal(false)}
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 transition"
            >
              <CloseIcon className="w-6 h-6" />
            </button>

            {/* Logo et Titre */}
            <div className="text-center mb-6">
              <div className="inline-block mb-4">
                <img 
                  src="../Images/RezoCampus.png" 
                  alt="Logo" 
                  className="w-20 h-20 md:w-24 md:h-24 mx-auto object-contain"
                  onError={(e) => {
                    e.currentTarget.src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="96" height="96"%3E%3Crect fill="%233b82f6" width="96" height="96" rx="12"/%3E%3Ctext x="50%25" y="50%25" dominant-baseline="middle" text-anchor="middle" fill="white" font-size="40" font-weight="bold"%3EUC%3C/text%3E%3C/svg%3E';
                  }}
                />
              </div>
              <h2 className="text-xl md:text-2xl font-bold text-gray-800">Connexion</h2>
              <p className="text-gray-600 mt-2 text-sm md:text-base">
                Accédez à votre espace personnel
              </p>
            </div>

            {/* Message d'erreur */}
            {error && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 text-red-700">
                <AlertCircle className="w-5 h-5 flex-shrink-0" />
                <span className="text-sm">{error}</span>
              </div>
            )}

            {/* Formulaire */}
            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Email
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
                  placeholder="votre@email.com"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Mot de passe
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
                  placeholder="••••••••"
                  required
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-blue-600 text-white py-3 rounded-lg font-medium hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed shadow-md"
              >
                {loading ? 'Connexion...' : 'Se connecter'}
              </button>
            </form>

            {/* Lien mot de passe oublié */}
            <p className="text-center text-sm text-gray-600 mt-4">
              Mot de passe oublié ?{' '}
              <a href="#" className="text-blue-600 hover:underline font-medium">
                Contactez l'administrateur
              </a>
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

export default LoginPage;