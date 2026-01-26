// ELearningSystem.tsx
import React, { useState, useEffect } from 'react';
import { 
  User, BookOpen, GraduationCap, Settings, LogIn, Home, 
  FileText, Calendar, MessageSquare, Upload, Users, Bell, 
  LogOut, Plus, Edit, Trash2, Eye, Download, Search 
} from 'lucide-react';

// ==================== TYPES ====================
type UserRole = 'student' | 'teacher' | 'admin';

interface User {
  id: string;
  email: string;
  role: UserRole;
  firstName: string;
  lastName: string;
}

interface Student {
  id: string;
  studentNumber: string;
  name: string;
  email: string;
  class: string;
  status: string;
}

interface Teacher {
  id: string;
  teacherNumber: string;
  name: string;
  email: string;
  specialization: string;
}

interface Course {
  id: string;
  title: string;
  subject: string;
  class: string;
  date: string;
  teacherId?: string;
}

interface Grade {
  id: string;
  subject: string;
  type: string;
  grade: number;
  coefficient: number;
  date: string;
}

interface Message {
  id: string;
  from: string;
  subject: string;
  date: string;
  unread: boolean;
}

interface ScheduleEntry {
  time: string;
  mon?: string;
  tue?: string;
  wed?: string;
  thu?: string;
  fri?: string;
}

type Page = 'login' | 'student-dashboard' | 'teacher-dashboard' | 'admin-dashboard';
type ModalType = 'add-student' | 'add-teacher' | 'announcement' | 'message' | '';

// ==================== COMPOSANT PRINCIPAL ====================
const ELearningSystem: React.FC = () => {
  const [currentPage, setCurrentPage] = useState<Page>('login');
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [showModal, setShowModal] = useState<boolean>(false);
  const [modalType, setModalType] = useState<ModalType>('');

  // ==================== PAGE DE CONNEXION ====================
  const LoginPage: React.FC = () => {
    const [email, setEmail] = useState<string>('');
    const [password, setPassword] = useState<string>('');
    const [loginType, setLoginType] = useState<UserRole>('student');

    const handleLogin = async (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      setLoading(true);
      
      setTimeout(() => {
        const mockUser: User = {
          id: '123',
          email: email,
          role: loginType,
          firstName: 'Utilisateur',
          lastName: 'Test'
        };
        setUser(mockUser);
        
        const pageMap: Record<UserRole, Page> = {
          student: 'student-dashboard',
          teacher: 'teacher-dashboard',
          admin: 'admin-dashboard'
        };
        
        setCurrentPage(pageMap[loginType]);
        setLoading(false);
      }, 1000);
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

          <form onSubmit={handleLogin} className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Type de compte
              </label>
              <div className="grid grid-cols-3 gap-2">
                {(['student', 'teacher', 'admin'] as UserRole[]).map((type) => (
                  <button
                    key={type}
                    type="button"
                    onClick={() => setLoginType(type)}
                    className={`py-2 px-3 rounded-lg text-sm font-medium transition ${
                      loginType === type
                        ? type === 'student' ? 'bg-blue-600 text-white' 
                        : type === 'teacher' ? 'bg-green-600 text-white'
                        : 'bg-purple-600 text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    {type === 'student' ? 'Étudiant' : type === 'teacher' ? 'Enseignant' : 'Admin'}
                  </button>
                ))}
              </div>
            </div>

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
              className="w-full bg-indigo-600 text-white py-3 rounded-lg font-medium hover:bg-indigo-700 transition disabled:opacity-50"
            >
              {loading ? 'Connexion...' : 'Se connecter'}
            </button>
          </form>
        </div>
      </div>
    );
  };

  // ==================== DASHBOARD ÉTUDIANT ====================
  const StudentDashboard: React.FC = () => {
    const [activeTab, setActiveTab] = useState<string>('dashboard');

    const mockCourses: Course[] = [
      { id: '1', title: 'Mathématiques - Chapitre 5', subject: 'Mathématiques', class: 'L1-A', date: '20/01/2026' },
      { id: '2', title: 'Introduction à Python', subject: 'Informatique', class: 'L1-A', date: '22/01/2026' },
      { id: '3', title: 'Mécanique Quantique', subject: 'Physique', class: 'L1-A', date: '23/01/2026' },
    ];

    const mockGrades: Grade[] = [
      { id: '1', subject: 'Mathématiques', type: 'Examen', grade: 16, coefficient: 3, date: '15/01/2026' },
      { id: '2', subject: 'Physique', type: 'Devoir', grade: 14, coefficient: 2, date: '18/01/2026' },
      { id: '3', subject: 'Informatique', type: 'TP', grade: 17, coefficient: 1, date: '20/01/2026' },
    ];

    const mockMessages: Message[] = [
      { id: '1', from: 'Prof. Martin', subject: 'Rappel: Examen lundi prochain', date: '25/01/2026', unread: true },
      { id: '2', from: 'Administration', subject: 'Inscription aux TD', date: '24/01/2026', unread: true },
      { id: '3', from: 'Prof. Dubois', subject: 'Correction TP disponible', date: '23/01/2026', unread: false },
    ];

    const mockSchedule: ScheduleEntry[] = [
      { time: '08:00-10:00', mon: 'Mathématiques', tue: 'Physique', wed: '', thu: 'Informatique', fri: 'Mathématiques' },
      { time: '10:00-12:00', mon: 'Physique', tue: 'Informatique', wed: '', thu: 'Mathématiques', fri: 'TP Info' },
      { time: '14:00-16:00', mon: 'Algorithmique', tue: '', wed: 'Projet', thu: '', fri: 'Physique' },
      { time: '16:00-18:00', mon: '', tue: 'TP Physique', wed: 'Projet', thu: 'Anglais', fri: '' },
    ];

    const renderContent = () => {
      switch(activeTab) {
        case 'dashboard':
          return (
            <>
              <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                <div className="bg-white rounded-lg shadow p-6 cursor-pointer hover:shadow-lg transition" onClick={() => setActiveTab('messages')}>
                  <MessageSquare className="w-8 h-8 text-blue-600 mb-3" />
                  <h3 className="text-lg font-bold mb-2">Messages</h3>
                  <p className="text-gray-600 text-sm">3 nouveaux messages</p>
                </div>

                <div className="bg-white rounded-lg shadow p-6 cursor-pointer hover:shadow-lg transition" onClick={() => setActiveTab('grades')}>
                  <FileText className="w-8 h-8 text-green-600 mb-3" />
                  <h3 className="text-lg font-bold mb-2">Notes</h3>
                  <p className="text-gray-600 text-sm">Moyenne: 14.5/20</p>
                </div>

                <div className="bg-white rounded-lg shadow p-6 cursor-pointer hover:shadow-lg transition" onClick={() => setActiveTab('courses')}>
                  <BookOpen className="w-8 h-8 text-purple-600 mb-3" />
                  <h3 className="text-lg font-bold mb-2">Cours</h3>
                  <p className="text-gray-600 text-sm">12 cours disponibles</p>
                </div>

                <div className="bg-white rounded-lg shadow p-6 cursor-pointer hover:shadow-lg transition" onClick={() => setActiveTab('schedule')}>
                  <Calendar className="w-8 h-8 text-orange-600 mb-3" />
                  <h3 className="text-lg font-bold mb-2">Emploi du temps</h3>
                  <p className="text-gray-600 text-sm">Voir mon planning</p>
                </div>
              </div>

              <div className="bg-white rounded-lg shadow p-6">
                <h2 className="text-2xl font-bold mb-4">Dernières annonces</h2>
                <div className="space-y-4">
                  <div className="border-l-4 border-blue-600 pl-4 py-2">
                    <p className="font-semibold">Examen de mathématiques</p>
                    <p className="text-sm text-gray-600">Prévu le 15 février 2026</p>
                  </div>
                  <div className="border-l-4 border-green-600 pl-4 py-2">
                    <p className="font-semibold">Nouveau cours disponible</p>
                    <p className="text-sm text-gray-600">Introduction à la programmation Python</p>
                  </div>
                </div>
              </div>
            </>
          );
        
        case 'courses':
          return (
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-2xl font-bold mb-6">Mes Cours</h2>
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                {mockCourses.map((course) => (
                  <div key={course.id} className="border rounded-lg p-4 hover:shadow-lg transition">
                    <div className="flex items-start justify-between mb-3">
                      <FileText className="w-8 h-8 text-indigo-600" />
                      <span className="text-xs bg-indigo-100 text-indigo-700 px-2 py-1 rounded">PDF</span>
                    </div>
                    <h3 className="font-bold mb-2">{course.title}</h3>
                    <p className="text-sm text-gray-600 mb-3">{course.subject}</p>
                    <div className="flex items-center justify-between text-xs text-gray-500">
                      <span>{course.date}</span>
                      <button className="text-indigo-600 hover:underline flex items-center gap-1">
                        <Download className="w-4 h-4" />
                        Télécharger
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        
        case 'grades':
          return (
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-2xl font-bold mb-6">Mes Notes</h2>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-100">
                    <tr>
                      <th className="px-4 py-3 text-left">Matière</th>
                      <th className="px-4 py-3 text-left">Type</th>
                      <th className="px-4 py-3 text-left">Note</th>
                      <th className="px-4 py-3 text-left">Coefficient</th>
                      <th className="px-4 py-3 text-left">Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {mockGrades.map((grade) => (
                      <tr key={grade.id} className="border-b hover:bg-gray-50">
                        <td className="px-4 py-3 font-medium">{grade.subject}</td>
                        <td className="px-4 py-3">{grade.type}</td>
                        <td className="px-4 py-3">
                          <span className={`font-bold ${grade.grade >= 15 ? 'text-green-600' : grade.grade >= 10 ? 'text-blue-600' : 'text-red-600'}`}>
                            {grade.grade}/20
                          </span>
                        </td>
                        <td className="px-4 py-3">{grade.coefficient}</td>
                        <td className="px-4 py-3 text-sm text-gray-600">{grade.date}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="mt-6 p-4 bg-blue-50 rounded-lg">
                <p className="text-lg font-bold">Moyenne générale: <span className="text-blue-600">14.5/20</span></p>
              </div>
            </div>
          );
        
        case 'schedule':
          return (
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-2xl font-bold mb-6">Emploi du temps</h2>
              <div className="overflow-x-auto">
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="bg-gray-100">
                      <th className="border px-4 py-2">Heure</th>
                      <th className="border px-4 py-2">Lundi</th>
                      <th className="border px-4 py-2">Mardi</th>
                      <th className="border px-4 py-2">Mercredi</th>
                      <th className="border px-4 py-2">Jeudi</th>
                      <th className="border px-4 py-2">Vendredi</th>
                    </tr>
                  </thead>
                  <tbody>
                    {mockSchedule.map((row, idx) => (
                      <tr key={idx}>
                        <td className="border px-4 py-2 font-medium bg-gray-50">{row.time}</td>
                        <td className="border px-4 py-2">{row.mon && <div className="bg-blue-100 p-2 rounded text-sm">{row.mon}</div>}</td>
                        <td className="border px-4 py-2">{row.tue && <div className="bg-green-100 p-2 rounded text-sm">{row.tue}</div>}</td>
                        <td className="border px-4 py-2">{row.wed && <div className="bg-purple-100 p-2 rounded text-sm">{row.wed}</div>}</td>
                        <td className="border px-4 py-2">{row.thu && <div className="bg-orange-100 p-2 rounded text-sm">{row.thu}</div>}</td>
                        <td className="border px-4 py-2">{row.fri && <div className="bg-pink-100 p-2 rounded text-sm">{row.fri}</div>}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          );
        
        case 'messages':
          return (
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-2xl font-bold mb-6">Messages</h2>
              <div className="space-y-4">
                {mockMessages.map((msg) => (
                  <div key={msg.id} className={`p-4 border rounded-lg hover:shadow-md transition cursor-pointer ${msg.unread ? 'bg-blue-50 border-blue-200' : 'bg-white'}`}>
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <p className="font-bold">{msg.from}</p>
                          {msg.unread && <span className="text-xs bg-blue-600 text-white px-2 py-0.5 rounded">Nouveau</span>}
                        </div>
                        <p className="text-gray-800">{msg.subject}</p>
                        <p className="text-sm text-gray-500 mt-1">{msg.date}</p>
                      </div>
                      <Eye className="w-5 h-5 text-gray-400" />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        
        default:
          return null;
      }
    };

    return (
      <div className="min-h-screen bg-gray-50">
        <nav className="bg-blue-600 text-white p-4 shadow-lg">
          <div className="container mx-auto flex justify-between items-center">
            <h1 className="text-2xl font-bold">Espace Étudiant</h1>
            <div className="flex items-center gap-4">
              <span className="text-sm">Bienvenue, {user?.firstName}</span>
              <button
                onClick={() => { setUser(null); setCurrentPage('login'); }}
                className="bg-blue-700 px-4 py-2 rounded hover:bg-blue-800 flex items-center gap-2"
              >
                <LogOut className="w-4 h-4" />
                Déconnexion
              </button>
            </div>
          </div>
        </nav>

        <div className="container mx-auto px-4 py-8">
          <div className="mb-6 flex gap-2 overflow-x-auto pb-2">
            {[
              { id: 'dashboard', label: 'Tableau de bord', icon: Home },
              { id: 'courses', label: 'Cours', icon: BookOpen },
              { id: 'grades', label: 'Notes', icon: FileText },
              { id: 'schedule', label: 'Emploi du temps', icon: Calendar },
              { id: 'messages', label: 'Messages', icon: MessageSquare },
            ].map(tab => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition whitespace-nowrap ${
                    activeTab === tab.id
                      ? 'bg-blue-600 text-white'
                      : 'bg-white text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  <Icon className="w-5 h-5" />
                  {tab.label}
                </button>
              );
            })}
          </div>

          {renderContent()}
        </div>
      </div>
    );
  };

  // ==================== DASHBOARD ENSEIGNANT ====================
  const TeacherDashboard: React.FC = () => {
    const [activeTab, setActiveTab] = useState<string>('dashboard');
    const [selectedFile, setSelectedFile] = useState<File | null>(null);

    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file && file.type === 'application/pdf') {
        setSelectedFile(file);
        alert(`Fichier "${file.name}" prêt à être téléchargé`);
      }
    };

    return (
      <div className="min-h-screen bg-gray-50">
        <nav className="bg-green-600 text-white p-4 shadow-lg">
          <div className="container mx-auto flex justify-between items-center">
            <h1 className="text-2xl font-bold">Espace Enseignant</h1>
            <div className="flex items-center gap-4">
              <span className="text-sm">Prof. {user?.lastName}</span>
              <button
                onClick={() => { setUser(null); setCurrentPage('login'); }}
                className="bg-green-700 px-4 py-2 rounded hover:bg-green-800 flex items-center gap-2"
              >
                <LogOut className="w-4 h-4" />
                Déconnexion
              </button>
            </div>
          </div>
        </nav>

        <div className="container mx-auto px-4 py-8">
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-2xl font-bold mb-6">Upload de cours PDF</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">Titre du cours</label>
                <input
                  type="text"
                  className="w-full border rounded px-3 py-2"
                  placeholder="Ex: Chapitre 5 - Algèbre"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Fichier PDF</label>
                <input
                  type="file"
                  accept=".pdf"
                  onChange={handleFileUpload}
                  className="w-full border rounded px-3 py-2"
                />
                {selectedFile && (
                  <p className="text-sm text-green-600 mt-2">✓ {selectedFile.name}</p>
                )}
              </div>
              <button className="bg-green-600 text-white px-6 py-2 rounded hover:bg-green-700">
                Télécharger le cours
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  };

  // ==================== DASHBOARD ADMIN ====================
  const AdminDashboard: React.FC = () => {
    const [activeTab, setActiveTab] = useState<string>('dashboard');

    const mockStudents: Student[] = [
      { id: '1', studentNumber: 'E2024001', name: 'Amina Benali', email: 'amina.benali@ecole.ma', class: 'L1-A', status: 'Actif' },
      { id: '2', studentNumber: 'E2024002', name: 'Youssef Alami', email: 'youssef.alami@ecole.ma', class: 'L1-A', status: 'Actif' },
    ];

    return (
      <div className="min-h-screen bg-gray-50">
        <nav className="bg-purple-600 text-white p-4 shadow-lg">
          <div className="container mx-auto flex justify-between items-center">
            <h1 className="text-2xl font-bold">Espace Administrateur</h1>
            <button
              onClick={() => { setUser(null); setCurrentPage('login'); }}
              className="bg-purple-700 px-4 py-2 rounded hover:bg-purple-800 flex items-center gap-2"
            >
              <LogOut className="w-4 h-4" />
              Déconnexion
            </button>
          </div>
        </nav>

        <div className="container mx-auto px-4 py-8">
          <div className="grid md:grid-cols-4 gap-6 mb-8">
            <div className="bg-blue-50 p-6 rounded-lg">
              <p className="text-4xl font-bold text-blue-600">250</p>
              <p className="text-gray-600">Étudiants</p>
            </div>
            <div className="bg-green-50 p-6 rounded-lg">
              <p className="text-4xl font-bold text-green-600">45</p>
              <p className="text-gray-600">Enseignants</p>
            </div>
            <div className="bg-purple-50 p-6 rounded-lg">
              <p className="text-4xl font-bold text-purple-600">38</p>
              <p className="text-gray-600">Cours actifs</p>
            </div>
            <div className="bg-orange-50 p-6 rounded-lg">
              <p className="text-4xl font-bold text-orange-600">12</p>
              <p className="text-gray-600">Classes</p>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-2xl font-bold mb-6">Liste des étudiants</h2>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-100">
                  <tr>
                    <th className="px-4 py-2 text-left">Matricule</th>
                    <th className="px-4 py-2 text-left">Nom complet</th>
                    <th className="px-4 py-2 text-left">Email</th>
                    <th className="px-4 py-2 text-left">Classe</th>
                    <th className="px-4 py-2 text-left">Statut</th>
                  </tr>
                </thead>
                <tbody>
                  {mockStudents.map((student) => (
                    <tr key={student.id} className="border-b hover:bg-gray-50">
                      <td className="px-4 py-3 font-medium">{student.studentNumber}</td>
                      <td className="px-4 py-3">{student.name}</td>
                      <td className="px-4 py-3">{student.email}</td>
                      <td className="px-4 py-3">{student.class}</td>
                      <td className="px-4 py-3">
                        <span className="bg-green-100 text-green-700 px-2 py-1 rounded text-xs">
                          {student.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    );
  };

  // ==================== RENDU PRINCIPAL ====================
  return (
    <div>
      {currentPage === 'login' && <LoginPage />}
      {currentPage === 'student-dashboard' && <StudentDashboard />}
      {currentPage === 'teacher-dashboard' && <TeacherDashboard />}
      {currentPage === 'admin-dashboard' && <AdminDashboard />}
    </div>
  );
};

export default ELearningSystem;