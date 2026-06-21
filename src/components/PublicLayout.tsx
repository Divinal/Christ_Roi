import React from 'react';
import PublicHeader, { PublicPage } from './PublicHeader';
import PublicFooter from './PublicFooter';

interface PublicLayoutProps {
  currentPage: PublicPage;
  onNavigate: (page: PublicPage) => void;
  onLoginClick: () => void;
  children: React.ReactNode;
}

const PublicLayout: React.FC<PublicLayoutProps> = ({ currentPage, onNavigate, onLoginClick, children }) => {
  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-gray-50 to-blue-50">
      <PublicHeader currentPage={currentPage} onNavigate={onNavigate} onLoginClick={onLoginClick} />
      <main className="flex-1">{children}</main>
      <PublicFooter onNavigate={onNavigate} onLoginClick={onLoginClick} />
    </div>
  );
};

export default PublicLayout;
