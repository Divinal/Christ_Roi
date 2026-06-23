import React, { useState } from 'react';
import { AlertCircle, X as CloseIcon } from 'lucide-react';
import { supabase } from '../lib/supabaseClient';
import { User } from '../types';
import { siteConfig } from '../config/site.config';

interface LoginModalProps {
  onClose: () => void;
  onLogin: (user: User) => void;
}

const LoginModal: React.FC<LoginModalProps> = ({ onClose, onLogin }) => {
  const [email, setEmail] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>('');

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
        const { data: profileData, error: profileError } = await supabase
          .from('profiles')
          .select('*')
          .eq('user_id', authData.user.id)
          .maybeSingle();

        if (profileError) throw profileError;
        if (!profileData) throw new Error('Profil non trouvé dans la base de données');

        const { data: roleData, error: roleError } = await supabase
          .from('user_roles')
          .select('role')
          .eq('user_id', authData.user.id)
          .maybeSingle();

        if (roleError) throw roleError;
        if (!roleData) throw new Error("Aucun rôle n'est attribué à ce compte. Contactez l'administrateur.");

        const user: User = {
          id: profileData.user_id,
          email: profileData.email,
          role: roleData.role,
          firstName: profileData.first_name,
          lastName: profileData.last_name,
          first_name: profileData.first_name,
          last_name: profileData.last_name,
        };
        onLogin(user);
      }
    } catch (error: any) {
      setError(error.message || 'Erreur de connexion');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 px-4">
      <div className="bg-white rounded-2xl shadow-2xl p-6 md:p-8 w-full max-w-md relative">
        <button onClick={onClose} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 transition">
          <CloseIcon className="w-6 h-6" />
        </button>

        <div className="text-center mb-6">
          <div className="inline-block mb-4">
            <img
              src={siteConfig.logoUrl}
              alt="Logo"
              className="w-20 h-20 md:w-24 md:h-24 mx-auto object-contain"
              onError={(e) => {
                e.currentTarget.src = `data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="96" height="96"%3E%3Crect fill="%233b82f6" width="96" height="96" rx="12"/%3E%3Ctext x="50%25" y="50%25" dominant-baseline="middle" text-anchor="middle" fill="white" font-size="40" font-weight="bold"%3E${siteConfig.logoFallbackInitials}%3C/text%3E%3C/svg%3E`;
              }}
            />
          </div>
          <h2 className="text-xl md:text-2xl font-bold text-gray-800">Connexion</h2>
          <p className="text-gray-600 mt-2 text-sm md:text-base">Accédez à votre espace personnel</p>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 text-red-700">
            <AlertCircle className="w-5 h-5 flex-shrink-0" />
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
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
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

        <p className="text-center text-sm text-gray-600 mt-4">
          Mot de passe oublié ?{' '}
          <a href="#" className="text-blue-600 hover:underline font-medium">
            Contactez l'administrateur
          </a>
        </p>
      </div>
    </div>
  );
};

export default LoginModal;
