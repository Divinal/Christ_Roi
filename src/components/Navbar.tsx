import React from 'react';
import { LogOut } from 'lucide-react';
import { User } from '../types';

interface NavbarProps {
  title: string;
  user: User | null;
  onLogout: () => void;
  bgColor?: string;
}

const Navbar: React.FC<NavbarProps> = ({ title, user, onLogout, bgColor = 'bg-blue-600' }) => {
  return (
    <nav className={`${bgColor} text-white p-4 shadow-lg`}>
      <div className="container mx-auto flex justify-between items-center">
        <h1 className="text-2xl font-bold">{title}</h1>
        <div className="flex items-center gap-4">
          <span className="text-sm">
            Bienvenue, {user?.firstName} {user?.lastName}
          </span>
          <button
            onClick={onLogout}
            className={`${bgColor.replace('600', '700')} px-4 py-2 rounded hover:${bgColor.replace('600', '800')} flex items-center gap-2 transition`}
          >
            <LogOut className="w-4 h-4" />
            Déconnexion
          </button>
        </div>
      </div>
    </nav>
  );
};

export default Navbar;