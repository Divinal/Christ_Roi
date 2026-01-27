import React, { useState } from 'react';
import { GraduationCap, AlertCircle, Info } from 'lucide-react';
import { supabase } from '../lib/supabaseClient';
import { User, UserRole } from '../types';

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

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center px-4">
      <div className="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-block p-4 bg-indigo-100 rounded-full mb-4">
            <GraduationCap className="w-12 h-12 text-indigo-600" />
          </div>
          <h1 className="text-3xl font-bold text-gray-800">Système E-Learning</h1>
          <p className="text-gray-600 mt-2">Connectez-vous à votre espace</p>
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

        <form onSubmit={handleLogin} className="space-y-6">
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

        <p className="text-center text-sm text-gray-600 mt-6">
          Mot de passe oublié ?{' '}
          <a href="#" className="text-indigo-600 hover:underline">
            Réinitialiser
          </a>
        </p>
      </div>
    </div>
  );
};

export default LoginPage;
