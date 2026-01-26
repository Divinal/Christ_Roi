import React from 'react';
import { LucideIcon } from 'lucide-react';

interface StatCardProps {
  icon: LucideIcon;
  title: string;
  value: string | number;
  color: string;
  onClick?: () => void;
}

const StatCard: React.FC<StatCardProps> = ({ icon: Icon, title, value, color, onClick }) => {
  return (
    <div 
      className={`bg-white rounded-lg shadow p-6 ${onClick ? 'cursor-pointer hover:shadow-lg' : ''} transition`}
      onClick={onClick}
    >
      <Icon className={`w-8 h-8 ${color} mb-3`} />
      <h3 className="text-lg font-bold mb-2">{title}</h3>
      <p className="text-gray-600 text-sm">{value}</p>
    </div>
  );
};

export default StatCard;