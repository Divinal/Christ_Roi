import React, { Suspense, lazy, useState, useEffect } from 'react';
import { supabase } from './lib/supabaseClient';
import { siteConfig } from './config/site.config';
import { PUBLIC_PATHS, pathToPublicPage } from './lib/publicRoutes';
import HomePage from './pages/HomePage';
import ContactPage from './pages/ContactPage';
import PrivacyPage from './pages/PrivacyPage';
import ChangePasswordModal from './components/ChangePasswordModal';
import LoginModal from './components/LoginModal';
import { PublicPage } from './components/PublicHeader';
import { FeedbackHost } from './components/ui/feedback';
import { User } from './types';

// Chargés à la demande : un visiteur du site public ne télécharge pas les espaces connectés.
const StudentDashboard = lazy(() => import('./pages/StudentDashboard'));
const TeacherDashboard = lazy(() => import('./pages/TeacherDashboard'));
const AdminDashboard = lazy(() => import('./pages/AdminDashboard'));

type DashboardPage = 'student-dashboard' | 'teacher-dashboard' | 'admin-dashboard';
type Page = PublicPage | DashboardPage;

const PAGE_SEO: Record<PublicPage, { title: string; description: string }> = {
  home: {
    title: `${siteConfig.schoolName} — ${siteConfig.tagline}`,
    description: siteConfig.hero.description,
  },
  contact: {
    title: `Contact — ${siteConfig.schoolName}`,
    description: `Contactez ${siteConfig.schoolName} : adresse, téléphone et email.`,
  },
  privacy: {
    title: `Politique de confidentialité — ${siteConfig.schoolName}`,
    description: `Politique de confidentialité de ${siteConfig.schoolName}.`,
  },
};

const DASHBOARD_OF_ROLE: Record<string, DashboardPage> = {
  student: 'student-dashboard',
  teacher: 'teacher-dashboard',
  admin: 'admin-dashboard',
  academic_admin: 'admin-dashboard',
  finance_admin: 'admin-dashboard',
  admin_secretaire: 'admin-dashboard',
};

const setMetaDescription = (content: string) => {
  let tag = document.querySelector('meta[name="description"]');
  if (!tag) {
    tag = document.createElement('meta');
    tag.setAttribute('name', 'description');
    document.head.appendChild(tag);
  }
  tag.setAttribute('content', content);
};

const Spinner: React.FC = () => (
  <div className="min-h-screen bg-gray-50 flex items-center justify-center">
    <div className="text-center">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto"></div>
      <p className="mt-4 text-gray-600">Chargement...</p>
    </div>
  </div>
);

const App: React.FC = () => {
  const [currentPage, setCurrentPage] = useState<Page>(() => pathToPublicPage(window.location.pathname));
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [showLoginModal, setShowLoginModal] = useState<boolean>(false);
  const [changingPassword, setChangingPassword] = useState<boolean>(false);

  useEffect(() => {
    // Vérifier la session au chargement
    checkUser();

    // Écouter les changements d'authentification
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        fetchUserData(session.user.id, session.user.user_metadata);
      } else {
        // Ne pas déconnecter si c'est un utilisateur démo
        if (!user?.id?.startsWith('demo-')) {
          setUser(null);
          // Supabase signale aussi l'absence de session à chaque chargement : un
          // visiteur arrivé sur /contact doit y rester. Seul un espace connecté est quitté.
          setCurrentPage((page) => (page.endsWith('-dashboard') ? 'home' : page));
        }
      }
    });

    // Garder l'URL et l'affichage synchronisés avec les boutons précédent/suivant.
    // Dans un espace connecté, l'historique ne concerne que l'onglet (#/notes) :
    // il ne doit pas renvoyer vers le site public.
    const onPopState = () =>
      setCurrentPage((page) =>
        page.endsWith('-dashboard') ? page : pathToPublicPage(window.location.pathname),
      );
    window.addEventListener('popstate', onPopState);

    return () => {
      subscription.unsubscribe();
      window.removeEventListener('popstate', onPopState);
    };
  }, []);

  useEffect(() => {
    const seo = PAGE_SEO[currentPage as PublicPage];
    if (seo) {
      document.title = seo.title;
      setMetaDescription(seo.description);
    } else {
      document.title = `Mon espace — ${siteConfig.schoolName}`;
    }
  }, [currentPage]);

  const checkUser = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        await fetchUserData(session.user.id, session.user.user_metadata);
      }
    } catch (error) {
      console.error('Error checking user:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchUserData = async (userId: string, metadata?: Record<string, any>) => {
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

      const next: User = {
        id: profileData.user_id,
        email: profileData.email,
        role: roleData.role,
        firstName: profileData.first_name,
        lastName: profileData.last_name,
        first_name: profileData.first_name,
        last_name: profileData.last_name,
        mustChangePassword: metadata?.must_change_password === true,
      };
      // Le rafraîchissement de session passe aussi par ici : garder le même objet
      // évite de recharger tout le tableau de bord à chaque fois.
      setUser((previous) =>
        previous && JSON.stringify(previous) === JSON.stringify(next) ? previous : next,
      );
      setCurrentPage(DASHBOARD_OF_ROLE[roleData.role] || 'home');
    } catch (error) {
      console.error('Error fetching user data:', error);
    }
  };

  const handleLogin = (loggedInUser: User) => {
    setUser(loggedInUser);
    setShowLoginModal(false);
    setCurrentPage(DASHBOARD_OF_ROLE[loggedInUser.role] || 'home');
  };

  const handleLogout = async () => {
    setChangingPassword(false);
    // L'onglet de cette session ne doit pas s'appliquer à la prochaine personne connectée.
    window.history.replaceState(null, '', window.location.pathname + window.location.search);

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

  if (loading) return <Spinner />;

  const handleNavigate = (page: PublicPage) => {
    const path = PUBLIC_PATHS[page];
    if (window.location.pathname !== path) {
      window.history.pushState({}, '', path);
    }
    setCurrentPage(page);
  };
  const handleLoginClick = () => setShowLoginModal(true);

  const dashboardProps = user && {
    user,
    onLogout: handleLogout,
    onChangePassword: () => setChangingPassword(true),
  };
  const mustChangePassword = Boolean(user?.mustChangePassword);

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
      {dashboardProps && (
        <Suspense fallback={<Spinner />}>
          {currentPage === 'student-dashboard' && <StudentDashboard {...dashboardProps} />}
          {currentPage === 'teacher-dashboard' && <TeacherDashboard {...dashboardProps} />}
          {currentPage === 'admin-dashboard' && <AdminDashboard {...dashboardProps} />}
        </Suspense>
      )}
      {showLoginModal && (
        <LoginModal onClose={() => setShowLoginModal(false)} onLogin={handleLogin} />
      )}
      {user && (mustChangePassword || changingPassword) && (
        <ChangePasswordModal
          forced={mustChangePassword}
          onDone={() => {
            setChangingPassword(false);
            setUser((previous) => (previous ? { ...previous, mustChangePassword: false } : previous));
          }}
          onCancel={() => setChangingPassword(false)}
          onLogout={handleLogout}
        />
      )}
      <FeedbackHost />
    </div>
  );
};

export default App;
