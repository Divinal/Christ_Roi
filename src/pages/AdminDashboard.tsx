import React from 'react';
import { User } from '../types';
import { 
  Users, 
  BookOpen, 
  Settings, 
  BarChart3, 
  Shield,
  UserPlus,
  FileText,
  Bell
} from 'lucide-react';
import StatCard from '../components/StatCard';

interface AdminDashboardProps {
  user: User;
  onLogout: () => void;
}

const AdminDashboard: React.FC<AdminDashboardProps> = ({ user, onLogout }) => {
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-lg">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-2xl font-bold">Panel Administrateur</h1>
              <p className="text-purple-200">Bienvenue, {user.firstName} {user.lastName}</p>
            </div>
            <div className="flex items-center gap-4">
              <span className="bg-purple-500 px-3 py-1 rounded-full text-sm flex items-center gap-2">
                <Shield className="w-4 h-4" />
                Admin
              </span>
              <button
                onClick={onLogout}
                className="bg-white/20 hover:bg-white/30 px-4 py-2 rounded-lg transition"
              >
                Déconnexion
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 py-8">
        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <StatCard
            title="Utilisateurs totaux"
            value="156"
            icon={<Users className="w-6 h-6 text-purple-600" />}
            trend="+12 ce mois"
          />
          <StatCard
            title="Cours actifs"
            value="24"
            icon={<BookOpen className="w-6 h-6 text-blue-600" />}
            trend="+3 nouveaux"
          />
          <StatCard
            title="Enseignants"
            value="8"
            icon={<UserPlus className="w-6 h-6 text-green-600" />}
            trend="+1 ce mois"
          />
          <StatCard
            title="Étudiants"
            value="148"
            icon={<BarChart3 className="w-6 h-6 text-orange-600" />}
            trend="+11 ce mois"
          />
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          <div className="bg-white rounded-xl shadow-md p-6">
            <h2 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
              <Settings className="w-5 h-5 text-gray-600" />
              Actions rapides
            </h2>
            <div className="space-y-3">
              <button className="w-full text-left px-4 py-3 bg-purple-50 hover:bg-purple-100 rounded-lg transition flex items-center gap-3">
                <UserPlus className="w-5 h-5 text-purple-600" />
                <span>Ajouter un utilisateur</span>
              </button>
              <button className="w-full text-left px-4 py-3 bg-blue-50 hover:bg-blue-100 rounded-lg transition flex items-center gap-3">
                <BookOpen className="w-5 h-5 text-blue-600" />
                <span>Créer un cours</span>
              </button>
              <button className="w-full text-left px-4 py-3 bg-green-50 hover:bg-green-100 rounded-lg transition flex items-center gap-3">
                <FileText className="w-5 h-5 text-green-600" />
                <span>Générer un rapport</span>
              </button>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-md p-6">
            <h2 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
              <Bell className="w-5 h-5 text-gray-600" />
              Notifications récentes
            </h2>
            <div className="space-y-3">
              <div className="p-3 bg-yellow-50 rounded-lg border-l-4 border-yellow-400">
                <p className="text-sm text-gray-700">3 nouvelles inscriptions en attente</p>
                <p className="text-xs text-gray-500 mt-1">Il y a 2 heures</p>
              </div>
              <div className="p-3 bg-blue-50 rounded-lg border-l-4 border-blue-400">
                <p className="text-sm text-gray-700">Nouveau cours ajouté par Prof. Martin</p>
                <p className="text-xs text-gray-500 mt-1">Il y a 5 heures</p>
              </div>
              <div className="p-3 bg-green-50 rounded-lg border-l-4 border-green-400">
                <p className="text-sm text-gray-700">Sauvegarde système effectuée</p>
                <p className="text-xs text-gray-500 mt-1">Hier à 23:00</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-md p-6">
            <h2 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
              <Users className="w-5 h-5 text-gray-600" />
              Derniers utilisateurs
            </h2>
            <div className="space-y-3">
              {[
                { name: 'Marie Dupont', role: 'Étudiant', date: 'Aujourd\'hui' },
                { name: 'Jean Martin', role: 'Étudiant', date: 'Hier' },
                { name: 'Sophie Bernard', role: 'Enseignant', date: 'Il y a 2 jours' },
              ].map((user, index) => (
                <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div>
                    <p className="font-medium text-gray-800">{user.name}</p>
                    <p className="text-xs text-gray-500">{user.role}</p>
                  </div>
                  <span className="text-xs text-gray-400">{user.date}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Users Table */}
        <div className="bg-white rounded-xl shadow-md p-6">
          <h2 className="text-lg font-semibold text-gray-800 mb-4">Gestion des utilisateurs</h2>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-600">Nom</th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-600">Email</th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-600">Rôle</th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-600">Statut</th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-600">Actions</th>
                </tr>
              </thead>
              <tbody>
                {[
                  { name: 'Admin Demo', email: 'admin@demo.com', role: 'Admin', status: 'Actif' },
                  { name: 'Prof. Martin', email: 'enseignant@demo.com', role: 'Enseignant', status: 'Actif' },
                  { name: 'Étudiant Test', email: 'etudiant@demo.com', role: 'Étudiant', status: 'Actif' },
                ].map((user, index) => (
                  <tr key={index} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="py-3 px-4 text-gray-800">{user.name}</td>
                    <td className="py-3 px-4 text-gray-600">{user.email}</td>
                    <td className="py-3 px-4">
                      <span className={`px-2 py-1 rounded-full text-xs ${
                        user.role === 'Admin' ? 'bg-purple-100 text-purple-700' :
                        user.role === 'Enseignant' ? 'bg-blue-100 text-blue-700' :
                        'bg-green-100 text-green-700'
                      }`}>
                        {user.role}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <span className="px-2 py-1 bg-green-100 text-green-700 rounded-full text-xs">
                        {user.status}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <button className="text-indigo-600 hover:text-indigo-800 text-sm mr-3">Modifier</button>
                      <button className="text-red-600 hover:text-red-800 text-sm">Supprimer</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </div>
  );
};

export default AdminDashboard;
