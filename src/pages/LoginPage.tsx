import React, { useState } from 'react';
import { GraduationCap, AlertCircle, Info, Network, Code, Briefcase, Award, BookOpen, Users, X } from 'lucide-react';
import { supabase } from '../lib/supabaseClient';
import { User } from '../types';

interface LoginPageProps {
  onLogin: (user: User) => void;
  setCurrentPage?: (page: string) => void;
}

// Utilisateurs de démo (mode hors ligne)
const DEMO_USERS: Record<string, { password: string; user: User }> = {
  'admin@demo.com': {
    password: 'admin123',
    user: {
      id: 'demo-admin',
      email: 'admin@demo.com',
      role: 'admin',
      firstName: 'Admin',
      lastName: 'Demo',
    },
  },
  'enseignant@demo.com': {
    password: 'demo123',
    user: {
      id: 'demo-teacher',
      email: 'enseignant@demo.com',
      role: 'teacher',
      firstName: 'Prof.',
      lastName: 'Martin',
    },
  },
  'etudiant@demo.com': {
    password: 'demo123',
    user: {
      id: 'demo-student',
      email: 'etudiant@demo.com',
      role: 'student',
      firstName: 'Étudiant',
      lastName: 'Test',
    },
  },
};

const LoginPage: React.FC<LoginPageProps> = ({ onLogin, setCurrentPage }) => {
  const [email, setEmail] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>('');
  const [showLoginModal, setShowLoginModal] = useState<boolean>(false);

  const handleLogin = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    // Vérifier d'abord les utilisateurs de démo
    const demoUser = DEMO_USERS[email.toLowerCase()];
    if (demoUser && demoUser.password === password) {
      onLogin(demoUser.user);
      setLoading(false);
      return;
    }

    try {
      // Connexion avec Supabase
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (authError) throw authError;

      if (authData.user) {
        // Récupérer les informations utilisateur
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

  const fillDemoCredentials = (email: string, password: string) => {
    setEmail(email);
    setPassword(password);
  };

  const formations = [
    {
      icon: Network,
      title: 'Systèmes & Réseaux',
      description: 'Administration système, sécurité réseau, infrastructure IT',
      color: 'blue',
      niveau: 'Cycle Initial',
      duree: '2 ans',
    },
    {
      icon: Code,
      title: 'Développement Informatique',
      description: 'Programmation web, mobile, bases de données, frameworks modernes',
      color: 'purple',
      niveau: 'Cycle Initial',
      duree: '2 ans',
    },
    {
      icon: Briefcase,
      title: 'Gestion d\'Entreprise',
      description: 'Management, comptabilité, marketing, ressources humaines',
      color: 'green',
      niveau: 'Cycle Initial',
      duree: '2 ans',
    },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-purple-50 to-indigo-100">
      {/* NAVBAR */}
      <nav className="bg-white/80 backdrop-blur-md shadow-md fixed top-0 left-0 right-0 z-40">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-600 rounded-lg">
              <GraduationCap className="w-8 h-8 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-800">E-Learning Platform</h1>
              <p className="text-xs text-gray-600">Excellence & Innovation</p>
            </div>
          </div>
          <button
            onClick={() => setShowLoginModal(true)}
            className="bg-indigo-600 text-white px-6 py-2.5 rounded-lg font-medium hover:bg-indigo-700 transition shadow-lg"
          >
            Connexion
          </button>
        </div>
      </nav>

      {/* HERO SECTION */}
      <div className="pt-32 pb-16 px-4">
        <div className="container mx-auto text-center">
          <h2 className="text-5xl font-bold text-gray-800 mb-4">
            Bienvenue dans votre avenir
          </h2>
          <p className="text-xl text-gray-600 mb-8 max-w-2xl mx-auto">
            Formez-vous aux métiers d'avenir avec nos programmes certifiés et reconnus
          </p>
          <div className="flex justify-center gap-4 mb-12">
            <div className="bg-white p-4 rounded-lg shadow-md">
              <Award className="w-8 h-8 text-indigo-600 mx-auto mb-2" />
              <p className="text-sm font-semibold">Diplômes Reconnus</p>
            </div>
            <div className="bg-white p-4 rounded-lg shadow-md">
              <Users className="w-8 h-8 text-purple-600 mx-auto mb-2" />
              <p className="text-sm font-semibold">Formateurs Experts</p>
            </div>
            <div className="bg-white p-4 rounded-lg shadow-md">
              <BookOpen className="w-8 h-8 text-green-600 mx-auto mb-2" />
              <p className="text-sm font-semibold">Cours Pratiques</p>
            </div>
          </div>
        </div>
      </div>

      {/* FORMATIONS CYCLE INITIAL */}
      <div className="container mx-auto px-4 pb-16">
        <div className="text-center mb-12">
          <h3 className="text-3xl font-bold text-gray-800 mb-2">Nos Formations - Cycle Initial</h3>
          <p className="text-gray-600">Formations diplômantes sur 2 ans</p>
        </div>

        <div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto">
          {formations.map((formation, index) => {
            const Icon = formation.icon;
            return (
              <div
                key={index}
                className="bg-white rounded-2xl shadow-xl p-6 hover:shadow-2xl hover:-translate-y-2 transition-all duration-300"
              >
                <div className={`inline-block p-4 bg-${formation.color}-100 rounded-full mb-4`}>
                  <Icon className={`w-12 h-12 text-${formation.color}-600`} />
                </div>
                <h4 className="text-xl font-bold text-gray-800 mb-2">{formation.title}</h4>
                <p className="text-gray-600 mb-4 text-sm">{formation.description}</p>
                <div className="flex justify-between items-center pt-4 border-t">
                  <span className="text-sm font-semibold text-indigo-600">{formation.niveau}</span>
                  <span className="text-sm text-gray-500">{formation.duree}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* CYCLE SUPÉRIEUR FEDE */}
      <div className="bg-gradient-to-r from-indigo-600 to-purple-600 py-16 px-4">
        <div className="container mx-auto text-center text-white">
          <h3 className="text-3xl font-bold mb-4">Cycle Supérieur - FEDE</h3>
          <p className="text-xl mb-6 opacity-90">
            Poursuivez vos études avec nos formations de niveau Licence et Master
          </p>
          <p className="max-w-3xl mx-auto text-lg opacity-80 mb-8">
            La Fédération Européenne Des Écoles (FEDE) délivre des diplômes européens reconnus, 
            permettant une poursuite d'études en France et à l'international.
          </p>
          <div className="grid md:grid-cols-3 gap-6 max-w-4xl mx-auto">
            <div className="bg-white/10 backdrop-blur-sm p-6 rounded-lg">
              <h4 className="font-bold text-xl mb-2">Bachelor FEDE</h4>
              <p className="text-sm opacity-90">Niveau Licence (Bac+3)</p>
            </div>
            <div className="bg-white/10 backdrop-blur-sm p-6 rounded-lg">
              <h4 className="font-bold text-xl mb-2">Master FEDE</h4>
              <p className="text-sm opacity-90">Niveau Master (Bac+5)</p>
            </div>
            <div className="bg-white/10 backdrop-blur-sm p-6 rounded-lg">
              <h4 className="font-bold text-xl mb-2">Reconnaissance</h4>
              <p className="text-sm opacity-90">Diplômes Européens</p>
            </div>
          </div>
        </div>
      </div>

      {/* FOOTER */}
      <footer className="bg-gray-800 text-white py-8 px-4">
        <div className="container mx-auto text-center">
          <p className="text-sm opacity-75">© 2025 E-Learning Platform. Tous droits réservés.</p>
          <p className="text-xs opacity-50 mt-2">Formation professionnelle et certifiante</p>
        </div>
      </footer>

      {/* MODAL DE CONNEXION */}
      {showLoginModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 px-4">
          <div className="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-md relative">
            <button
              onClick={() => setShowLoginModal(false)}
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"
            >
              <X className="w-6 h-6" />
            </button>

            <div className="text-center mb-6">
              <div className="inline-block p-4 bg-indigo-100 rounded-full mb-4">
                <GraduationCap className="w-12 h-12 text-indigo-600" />
              </div>
              <h2 className="text-2xl font-bold text-gray-800">Connexion</h2>
              <p className="text-gray-600 mt-2">Accédez à votre espace personnel</p>
            </div>

            {/* Identifiants de démo */}
            <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <div className="flex items-center gap-2 text-blue-700 mb-3">
                <Info className="w-5 h-5" />
                <span className="font-medium">Identifiants de démo</span>
              </div>
              <div className="space-y-2 text-sm">
                <button
                  type="button"
                  onClick={() => fillDemoCredentials('admin@demo.com', 'admin123')}
                  className="w-full text-left p-2 bg-purple-100 hover:bg-purple-200 rounded transition"
                >
                  <span className="font-medium text-purple-700">Admin:</span>{' '}
                  <span className="text-gray-600">admin@demo.com / admin123</span>
                </button>
                <button
                  type="button"
                  onClick={() => fillDemoCredentials('enseignant@demo.com', 'demo123')}
                  className="w-full text-left p-2 bg-blue-100 hover:bg-blue-200 rounded transition"
                >
                  <span className="font-medium text-blue-700">Enseignant:</span>{' '}
                  <span className="text-gray-600">enseignant@demo.com / demo123</span>
                </button>
                <button
                  type="button"
                  onClick={() => fillDemoCredentials('etudiant@demo.com', 'demo123')}
                  className="w-full text-left p-2 bg-green-100 hover:bg-green-200 rounded transition"
                >
                  <span className="font-medium text-green-700">Étudiant:</span>{' '}
                  <span className="text-gray-600">etudiant@demo.com / demo123</span>
                </button>
              </div>
            </div>

            {error && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 text-red-700">
                <AlertCircle className="w-5 h-5" />
                <span className="text-sm">{error}</span>
              </div>
            )}

            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  placeholder="votre@email.com"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Mot de passe</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  placeholder="••••••••"
                  required
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-indigo-600 text-white py-3 rounded-lg font-medium hover:bg-indigo-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? 'Connexion...' : 'Se connecter'}
              </button>
            </form>

            <p className="text-center text-sm text-gray-600 mt-4">
              Mot de passe oublié ?{' '}
              <a href="#" className="text-indigo-600 hover:underline">
                Réinitialiser
              </a>
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

export default LoginPage;