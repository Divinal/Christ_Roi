// src/pages/student/StudentDashboard.tsx
import React, { useState, useEffect } from 'react';
import { Home, BookOpen, FileText, Calendar, MessageSquare, Download, Eye } from 'lucide-react';
import Navbar from '../components/Navbar';
import TabNavigation from '../components/TabNavigation';
import StatCard from '../components/StatCard';
import { User, Course, Grade, Message } from '../types';
import { supabase } from '../lib/supabaseClient';

interface StudentDashboardProps {
  user: User | null;
  onLogout: () => void;
}

const StudentDashboard: React.FC<StudentDashboardProps> = ({ user, onLogout }) => {
  const [activeTab, setActiveTab] = useState<string>('dashboard');
  const [courses, setCourses] = useState<Course[]>([]);
  const [grades, setGrades] = useState<Grade[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState<boolean>(false);

  useEffect(() => {
    if (user) {
      loadStudentData();
    }
  }, [user]);

  const loadStudentData = async () => {
    setLoading(true);
    try {
      // Charger les cours
      const { data: coursesData } = await supabase
        .from('courses')
        .select('*')
        .eq('is_published', true);
      
      if (coursesData) setCourses(coursesData);

      // Charger les notes
      const { data: studentData } = await supabase
        .from('students')
        .select('id')
        .eq('user_id', user?.id)
        .single();

      if (studentData) {
        const { data: gradesData } = await supabase
          .from('grades')
          .select('*')
          .eq('student_id', studentData.id);
        
        if (gradesData) setGrades(gradesData);
      }

      // Charger les messages
      const { data: messagesData } = await supabase
        .from('messages')
        .select('*')
        .eq('recipient_id', user?.id)
        .order('sent_at', { ascending: false });
      
      if (messagesData) setMessages(messagesData);
    } catch (error) {
      console.error('Error loading student data:', error);
    } finally {
      setLoading(false);
    }
  };

  const calculateAverage = (): number => {
    if (grades.length === 0) return 0;
    const total = grades.reduce((sum, grade) => sum + (grade.gradeValue * grade.coefficient), 0);
    const totalCoef = grades.reduce((sum, grade) => sum + grade.coefficient, 0);
    return totalCoef > 0 ? total / totalCoef : 0;
  };

  const renderDashboard = () => (
    <>
      <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <StatCard
          icon={MessageSquare}
          title="Messages"
          value={`${messages.filter(m => !m.isRead).length} nouveaux`}
          color="text-blue-600"
          onClick={() => setActiveTab('messages')}
        />
        <StatCard
          icon={FileText}
          title="Notes"
          value={`Moyenne: ${calculateAverage().toFixed(2)}/20`}
          color="text-green-600"
          onClick={() => setActiveTab('grades')}
        />
        <StatCard
          icon={BookOpen}
          title="Cours"
          value={`${courses.length} cours disponibles`}
          color="text-purple-600"
          onClick={() => setActiveTab('courses')}
        />
        <StatCard
          icon={Calendar}
          title="Emploi du temps"
          value="Voir mon planning"
          color="text-orange-600"
          onClick={() => setActiveTab('schedule')}
        />
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

  const renderCourses = () => (
    <div className="bg-white rounded-lg shadow p-6">
      <h2 className="text-2xl font-bold mb-6">Mes Cours</h2>
      {loading ? (
        <p className="text-center text-gray-500">Chargement...</p>
      ) : courses.length === 0 ? (
        <p className="text-center text-gray-500">Aucun cours disponible</p>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {courses.map((course) => (
            <div key={course.id} className="border rounded-lg p-4 hover:shadow-lg transition">
              <div className="flex items-start justify-between mb-3">
                <FileText className="w-8 h-8 text-indigo-600" />
                <span className="text-xs bg-indigo-100 text-indigo-700 px-2 py-1 rounded">PDF</span>
              </div>
              <h3 className="font-bold mb-2">{course.title}</h3>
              <p className="text-sm text-gray-600 mb-3">{course.description}</p>
              <div className="flex items-center justify-between text-xs text-gray-500">
                <span>{new Date(course.uploadedAt).toLocaleDateString()}</span>
                {course.fileUrl && (
                  <a 
                    href={course.fileUrl} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-indigo-600 hover:underline flex items-center gap-1"
                  >
                    <Download className="w-4 h-4" />
                    Télécharger
                  </a>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  const renderGrades = () => (
    <div className="bg-white rounded-lg shadow p-6">
      <h2 className="text-2xl font-bold mb-6">Mes Notes</h2>
      {loading ? (
        <p className="text-center text-gray-500">Chargement...</p>
      ) : grades.length === 0 ? (
        <p className="text-center text-gray-500">Aucune note disponible</p>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-100">
                <tr>
                  <th className="px-4 py-3 text-left">Type</th>
                  <th className="px-4 py-3 text-left">Note</th>
                  <th className="px-4 py-3 text-left">Coefficient</th>
                  <th className="px-4 py-3 text-left">Date</th>
                </tr>
              </thead>
              <tbody>
                {grades.map((grade) => (
                  <tr key={grade.id} className="border-b hover:bg-gray-50">
                    <td className="px-4 py-3">{grade.gradeType}</td>
                    <td className="px-4 py-3">
                      <span className={`font-bold ${
                        grade.gradeValue >= 15 ? 'text-green-600' : 
                        grade.gradeValue >= 10 ? 'text-blue-600' : 'text-red-600'
                      }`}>
                        {grade.gradeValue.toFixed(2)}/20
                      </span>
                    </td>
                    <td className="px-4 py-3">{grade.coefficient}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {grade.examDate ? new Date(grade.examDate).toLocaleDateString() : '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mt-6 p-4 bg-blue-50 rounded-lg">
            <p className="text-lg font-bold">
              Moyenne générale: <span className="text-blue-600">{calculateAverage().toFixed(2)}/20</span>
            </p>
          </div>
        </>
      )}
    </div>
  );

  const renderMessages = () => (
    <div className="bg-white rounded-lg shadow p-6">
      <h2 className="text-2xl font-bold mb-6">Messages</h2>
      {loading ? (
        <p className="text-center text-gray-500">Chargement...</p>
      ) : messages.length === 0 ? (
        <p className="text-center text-gray-500">Aucun message</p>
      ) : (
        <div className="space-y-4">
          {messages.map((msg) => (
            <div 
              key={msg.id} 
              className={`p-4 border rounded-lg hover:shadow-md transition cursor-pointer ${
                !msg.isRead ? 'bg-blue-50 border-blue-200' : 'bg-white'
              }`}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <p className="font-bold">{msg.subject}</p>
                    {!msg.isRead && (
                      <span className="text-xs bg-blue-600 text-white px-2 py-0.5 rounded">Nouveau</span>
                    )}
                  </div>
                  <p className="text-gray-800">{msg.content}</p>
                  <p className="text-sm text-gray-500 mt-1">
                    {new Date(msg.sentAt).toLocaleString()}
                  </p>
                </div>
                <Eye className="w-5 h-5 text-gray-400" />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  const renderSchedule = () => (
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
            {[
              { time: '08:00-10:00', mon: 'Mathématiques', tue: 'Physique', wed: '', thu: 'Informatique', fri: 'Mathématiques' },
              { time: '10:00-12:00', mon: 'Physique', tue: 'Informatique', wed: '', thu: 'Mathématiques', fri: 'TP Info' },
              { time: '14:00-16:00', mon: 'Algorithmique', tue: '', wed: 'Projet', thu: '', fri: 'Physique' },
            ].map((row, idx) => (
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

  const renderContent = () => {
    switch (activeTab) {
      case 'dashboard': return renderDashboard();
      case 'courses': return renderCourses();
      case 'grades': return renderGrades();
      case 'messages': return renderMessages();
      case 'schedule': return renderSchedule();
      default: return renderDashboard();
    }
  };

  const tabs = [
    { id: 'dashboard', label: 'Tableau de bord', icon: Home },
    { id: 'courses', label: 'Cours', icon: BookOpen },
    { id: 'grades', label: 'Notes', icon: FileText },
    { id: 'schedule', label: 'Emploi du temps', icon: Calendar },
    { id: 'messages', label: 'Messages', icon: MessageSquare },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar title="Espace Étudiant" user={user} onLogout={onLogout} bgColor="bg-blue-600" />
      
      <div className="container mx-auto px-4 py-8">
        <TabNavigation 
          tabs={tabs} 
          activeTab={activeTab} 
          onTabChange={setActiveTab}
          activeColor="bg-blue-600"
        />
        
        {renderContent()}
      </div>
    </div>
  );
};

export default StudentDashboard;