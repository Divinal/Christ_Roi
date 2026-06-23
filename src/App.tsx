import React, { useState, useEffect } from 'react';
import { supabase } from './lib/supabaseClient';
import HomePage from './pages/HomePage';
import ContactPage from './pages/ContactPage';
import PrivacyPage from './pages/PrivacyPage';
import StudentDashboard from './pages/StudentDashboard';
import TeacherDashboard from './pages/TeacherDashboard';
import AdminDashboard from './pages/AdminDashboard';
import LoginModal from './components/LoginModal';
import { PublicPage } from './components/PublicHeader';
import { User } from './types';

type Page = PublicPage | 'student-dashboard' | 'teacher-dashboard' | 'admin-dashboard';

const App: React.FC = () => {
  const [currentPage, setCurrentPage] = useState<Page>('home');
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [showLoginModal, setShowLoginModal] = useState<boolean>(false);

  useEffect(() => {
    // Vérifier la session au chargement
    checkUser();
    
    // Écouter les changements d'authentification
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        fetchUserData(session.user.id);
      } else {
        // Ne pas déconnecter si c'est un utilisateur démo
        if (!user?.id?.startsWith('demo-')) {
          setUser(null);
          setCurrentPage('home');
        }
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const checkUser = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        await fetchUserData(session.user.id);
      }
    } catch (error) {
      console.error('Error checking user:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchUserData = async (userId: string) => {
    try {
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle();

      if (profileError) throw profileError;
      if (!profileData) return;

      const { data: roleData, error: roleError } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', userId)
        .maybeSingle();

      if (roleError) throw roleError;
      if (!roleData) return;

      const userData: User = {
        id: profileData.user_id,
        email: profileData.email,
        role: roleData.role,
        firstName: profileData.first_name,
        lastName: profileData.last_name,
      };
      setUser(userData);

      // Rediriger vers le dashboard approprié
      const pageMap: Record<string, Page> = {
        student: 'student-dashboard',
        teacher: 'teacher-dashboard',
        admin: 'admin-dashboard',
        academic_admin: 'admin-dashboard',
        finance_admin: 'admin-dashboard',
        admin_secretaire: 'admin-dashboard',
      };
      setCurrentPage(pageMap[roleData.role] || 'home');
    } catch (error) {
      console.error('Error fetching user data:', error);
    }
  };

  const handleLogin = (loggedInUser: User) => {
    setUser(loggedInUser);
    setShowLoginModal(false);
    const pageMap: Record<string, Page> = {
      student: 'student-dashboard',
      teacher: 'teacher-dashboard',
      admin: 'admin-dashboard',
      academic_admin: 'admin-dashboard',
      finance_admin: 'admin-dashboard',
      admin_secretaire: 'admin-dashboard',
    };
    setCurrentPage(pageMap[loggedInUser.role] || 'home');
  };

  const handleLogout = async () => {
    // Pour les utilisateurs démo, juste réinitialiser l'état
    if (user?.id?.startsWith('demo-')) {
      setUser(null);
      setCurrentPage('home');
      return;
    }
    await supabase.auth.signOut();
    setUser(null);
    setCurrentPage('home');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Chargement...</p>
        </div>
      </div>
    );
  }

  const handleNavigate = (page: PublicPage) => setCurrentPage(page);
  const handleLoginClick = () => setShowLoginModal(true);

  return (
    <div>
      {currentPage === 'home' && (
        <HomePage onNavigate={handleNavigate} onLoginClick={handleLoginClick} />
      )}
      {currentPage === 'contact' && (
        <ContactPage onNavigate={handleNavigate} onLoginClick={handleLoginClick} />
      )}
      {currentPage === 'privacy' && (
        <PrivacyPage onNavigate={handleNavigate} onLoginClick={handleLoginClick} />
      )}
      {currentPage === 'student-dashboard' && user && (
        <StudentDashboard user={user} onLogout={handleLogout} />
      )}
      {currentPage === 'teacher-dashboard' && user && (
        <TeacherDashboard user={user} onLogout={handleLogout} />
      )}
      {currentPage === 'admin-dashboard' && user && (
        <AdminDashboard user={user} onLogout={handleLogout} />
      )}
      {showLoginModal && (
        <LoginModal onClose={() => setShowLoginModal(false)} onLogin={handleLogin} />
      )}
    </div>
  );
};

export default App;
