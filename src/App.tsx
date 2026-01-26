import React, { useState, useEffect } from 'react';
import { supabase } from './lib/supabaseClient';
import LoginPage from './pages/LoginPage';
import StudentDashboard from './pages/StudentDashboard';
import TeacherDashboard from './pages/TeacherDashboard';
import { User } from './types';

type Page = 'login' | 'student-dashboard' | 'teacher-dashboard' | 'admin-dashboard';

const App: React.FC = () => {
  const [currentPage, setCurrentPage] = useState<Page>('login');
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    // Vérifier la session au chargement
    checkUser();
    
    // Écouter les changements d'authentification
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        fetchUserData(session.user.id);
      } else {
        setUser(null);
        setCurrentPage('login');
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
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', userId)
        .single();

      if (error) throw error;

      if (data) {
        const userData: User = {
          id: data.id,
          email: data.email,
          role: data.role,
          firstName: data.first_name,
          lastName: data.last_name,
        };
        setUser(userData);
        
        // Rediriger vers le dashboard approprié
        const pageMap: Record<string, Page> = {
          student: 'student-dashboard',
          teacher: 'teacher-dashboard',
          admin: 'admin-dashboard',
        };
        setCurrentPage(pageMap[data.role] || 'login');
      }
    } catch (error) {
      console.error('Error fetching user data:', error);
    }
  };

  const handleLogin = (loggedInUser: User) => {
    setUser(loggedInUser);
    const pageMap: Record<string, Page> = {
      student: 'student-dashboard',
      teacher: 'teacher-dashboard',
      admin: 'admin-dashboard',
    };
    setCurrentPage(pageMap[loggedInUser.role] || 'login');
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setCurrentPage('login');
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

  return (
    <div>
      {currentPage === 'login' && (
        <LoginPage onLogin={handleLogin} setCurrentPage={setCurrentPage} />
      )}
      {currentPage === 'student-dashboard' && (
        <StudentDashboard user={user} onLogout={handleLogout} />
      )}
      {currentPage === 'teacher-dashboard' && (
        <TeacherDashboard user={user} onLogout={handleLogout} />
      )}
    </div>
  );
};

export default App;
