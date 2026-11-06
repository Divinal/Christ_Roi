import React, { useEffect, useState } from 'react';
import { ArrowLeft, BookOpen, Calendar, DollarSign, KeyRound, MessageSquare, Plus, Send, Trash2, User as UserIcon } from 'lucide-react';
import { supabase } from '../../lib/supabaseClient';
import { callAdminUsers } from '../../lib/adminUsers';
import { confirmDialog, infoDialog, notify } from '../ui/feedback';
import { CURRENT_ACADEMIC_YEAR, Level, cycleLabel } from '../../lib/levels';
import LevelSelect from '../levels/LevelSelect';
import PayslipHistoryTable from '../finance/PayslipHistoryTable';

export interface TeacherRecord {
  id: string;
  user_id: string;
  teacher_number: string;
  specialization?: string | null;
  department?: string | null;
  hourly_rate?: number | null;
  phone?: string | null;
  profiles?: { first_name: string; last_name: string; email: string };
}

export type TeacherTab = 'profile' | 'assignments' | 'schedule' | 'messages' | 'payslips';

interface SubjectOption {
  id: string;
  name: string;
  code: string;
}

interface TeacherDetailProps {
  teacher: TeacherRecord;
  levels: Level[];
  subjects: SubjectOption[];
  currentUserId?: string;
  initialTab: TeacherTab;
  onBack: () => void;
  onUpdated: () => void;
  onAssignmentsChanged: () => void;
  onDelete: (teacher: TeacherRecord) => void;
}

const TABS: { id: TeacherTab; label: string; icon: React.ElementType }[] = [
  { id: 'profile', label: 'Profil', icon: UserIcon },
  { id: 'assignments', label: 'Matières & niveaux', icon: BookOpen },
  { id: 'schedule', label: 'Emploi du temps', icon: Calendar },
  { id: 'messages', label: 'Messages', icon: MessageSquare },
  { id: 'payslips', label: 'Paie', icon: DollarSign },
];

const DAY_NAMES = ['', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche'];

const TeacherDetail: React.FC<TeacherDetailProps> = ({
  teacher,
  levels,
  subjects,
  currentUserId,
  initialTab,
  onBack,
  onUpdated,
  onAssignmentsChanged,
  onDelete,
}) => {
  const [activeTab, setActiveTab] = useState<TeacherTab>(initialTab);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    firstName: teacher.profiles?.first_name || '',
    lastName: teacher.profiles?.last_name || '',
    email: teacher.profiles?.email || '',
    phone: teacher.phone || '',
    teacherNumber: teacher.teacher_number,
    specialization: teacher.specialization || '',
    department: teacher.department || '',
    hourlyRate: teacher.hourly_rate ?? ('' as number | ''),
  });

  const [assignments, setAssignments] = useState<any[]>([]);
  const [assignForm, setAssignForm] = useState({ subjectId: '', levelId: '' });
  const [schedule, setSchedule] = useState<any[]>([]);
  const [messages, setMessages] = useState<any[]>([]);
  const [messageForm, setMessageForm] = useState({ subject: '', content: '' });

  useEffect(() => {
    loadAssignments();
    loadSchedule();
    loadMessages();
  }, [teacher.id]);

  const loadAssignments = async () => {
    const { data, error } = await supabase
      .from('teacher_levels')
      .select('id, subjects(id, name, code), levels(id, name, cycle)')
      .eq('teacher_id', teacher.id);

    if (error) console.error('Erreur chargement affectations:', error);
    else setAssignments(data || []);
  };

  const loadSchedule = async () => {
    const { data, error } = await supabase
      .from('schedules')
      .select('id, day_of_week, start_time, end_time, room, subjects(name), levels(name)')
      .eq('teacher_id', teacher.id)
      .order('day_of_week', { ascending: true })
      .order('start_time', { ascending: true });

    if (error) console.error('Erreur chargement emploi du temps:', error);
    else setSchedule(data || []);
  };

  const loadMessages = async () => {
    const { data, error } = await supabase
      .from('messages')
      .select('id, subject, content, sent_at, is_read')
      .eq('recipient_type', 'individual')
      .eq('recipient_id', teacher.user_id)
      .order('sent_at', { ascending: false });

    if (error) console.error('Erreur chargement messages:', error);
    else setMessages(data || []);
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      // La table teachers d'abord : un matricule en double est refusé ici,
      // avant d'avoir changé l'email de connexion.
      const { data: updated, error: teacherError } = await supabase
        .from('teachers')
        .update({
          teacher_number: form.teacherNumber.trim(),
          specialization: form.specialization.trim() || null,
          department: form.department.trim() || null,
          phone: form.phone.trim() || null,
          hourly_rate: form.hourlyRate === '' ? null : form.hourlyRate,
        })
        .eq('id', teacher.id)
        .select('id');

      if (teacherError) {
        throw new Error(teacherError.code === '23505' ? 'Ce matricule est déjà utilisé.' : teacherError.message);
      }
      if (!updated?.length) throw new Error("Modification refusée : vous n'avez pas les droits nécessaires.");

      const email = form.email.trim().toLowerCase();
      if (email !== teacher.profiles?.email) {
        await callAdminUsers('update_teacher_email', { teacher_id: teacher.id, email });
      }

      const { error: profileError } = await supabase
        .from('profiles')
        .update({ first_name: form.firstName.trim(), last_name: form.lastName.trim(), email })
        .eq('user_id', teacher.user_id);
      if (profileError) throw profileError;

      notify('✅ Enseignant modifié avec succès !');
      onUpdated();
    } catch (error: any) {
      notify(`❌ Erreur: ${error.message}`);
    } finally {
      setSaving(false);
    }
  };

  const handleResetPassword = async () => {
    const confirmed = await confirmDialog(
      `Générer un nouveau mot de passe temporaire pour ${fullName || teacher.teacher_number} ?\n\nSon mot de passe actuel ne fonctionnera plus.`
    );
    if (!confirmed) return;

    try {
      const { temporary_password } = await callAdminUsers<{ temporary_password: string }>(
        'reset_teacher_password',
        { teacher_id: teacher.id },
      );
      infoDialog({
        title: `Nouveau mot de passe de ${fullName || teacher.teacher_number}`,
        message: 'Mot de passe temporaire à lui transmettre. Il ne sera plus affiché, et devra être changé à la première connexion :',
        secret: temporary_password,
      });
    } catch (error: any) {
      notify(`❌ ${error.message}`);
    }
  };
  const handleAddAssignment = async (e: React.FormEvent) => {
    e.preventDefault();
    const { error } = await supabase.from('teacher_levels').insert({
      teacher_id: teacher.id,
      subject_id: assignForm.subjectId,
      level_id: assignForm.levelId,
    });

    if (error) {
      notify(error.code === '23505' ? '⚠️ Cette affectation existe déjà.' : `❌ Erreur: ${error.message}`);
      return;
    }
    setAssignForm({ subjectId: '', levelId: '' });
    loadAssignments();
    onAssignmentsChanged();
  };

  const handleRemoveAssignment = async (assignmentId: string) => {
    if (!await confirmDialog('⚠️ Retirer cette affectation ?')) return;
    const { error } = await supabase.from('teacher_levels').delete().eq('id', assignmentId);
    if (error) {
      notify(`❌ Erreur: ${error.message}`);
      return;
    }
    loadAssignments();
    onAssignmentsChanged();
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    const { error } = await supabase.from('messages').insert({
      sender_id: currentUserId,
      recipient_type: 'individual',
      recipient_id: teacher.user_id,
      subject: messageForm.subject.trim(),
      content: messageForm.content.trim(),
    });
    setSaving(false);

    if (error) {
      notify(`❌ Erreur: ${error.message}`);
      return;
    }
    setMessageForm({ subject: '', content: '' });
    loadMessages();
  };

  const handleDeleteMessage = async (messageId: string) => {
    if (!await confirmDialog('⚠️ Supprimer ce message ? Il disparaîtra aussi de la messagerie de l’enseignant.')) return;
    const { error } = await supabase.from('messages').delete().eq('id', messageId);
    if (error) {
      notify(`❌ Erreur: ${error.message}`);
      return;
    }
    loadMessages();
  };

  const field = (key: keyof typeof form) => ({
    value: form[key],
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, [key]: e.target.value }),
    className: 'w-full border rounded px-3 py-2',
  });

  const fullName = `${teacher.profiles?.first_name || ''} ${teacher.profiles?.last_name || ''}`.trim();

  return (
    <div className="bg-white rounded-xl shadow p-4 md:p-6">
      <button onClick={onBack} className="flex items-center gap-2 text-sm text-gray-600 hover:text-gray-700 mb-4">
        <ArrowLeft className="w-4 h-4" /> Retour à la liste des enseignants
      </button>

      <div className="flex flex-col sm:flex-row justify-between items-start gap-3 mb-6">
        <div>
          <h2 className="text-xl md:text-2xl font-bold">{fullName || teacher.teacher_number}</h2>
          <p className="text-sm text-gray-600">
            Matricule {teacher.teacher_number}
            {teacher.profiles?.email && ` • ${teacher.profiles.email}`}
          </p>
        </div>
        <button
          onClick={() => onDelete(teacher)}
          className="flex items-center gap-2 border border-red-200 text-red-600 hover:bg-red-50 px-3 py-2 rounded-lg text-sm"
        >
          <Trash2 className="w-4 h-4" /> Supprimer l'enseignant
        </button>
      </div>

      <div className="flex gap-2 mb-6 overflow-x-auto border-b">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2 font-medium whitespace-nowrap border-b-2 transition ${
                activeTab === tab.id
                  ? 'border-indigo-600 text-indigo-700'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              <Icon className="w-4 h-4" /> {tab.label}
            </button>
          );
        })}
      </div>

      {activeTab === 'profile' && (
        <form onSubmit={handleSaveProfile} className="space-y-4 max-w-2xl">
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-2">Prénom *</label>
              <input type="text" required {...field('firstName')} />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Nom *</label>
              <input type="text" required {...field('lastName')} />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Email de connexion *</label>
              <input type="email" required {...field('email')} />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Téléphone</label>
              <input type="tel" {...field('phone')} />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Matricule *</label>
              <input type="text" required {...field('teacherNumber')} />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Taux horaire (FCFA)</label>
              <input
                type="number"
                min="0"
                step="1"
                value={form.hourlyRate}
                onChange={(e) => setForm({ ...form, hourlyRate: e.target.value === '' ? '' : Number(e.target.value) })}
                className="w-full border rounded px-3 py-2"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Spécialité</label>
              <input type="text" {...field('specialization')} />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Département</label>
              <input type="text" {...field('department')} />
            </div>
          </div>
          <div className="flex flex-wrap gap-3">
            <button
              type="submit"
              disabled={saving}
              className="px-6 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700 disabled:opacity-50"
            >
              {saving ? 'Enregistrement...' : 'Enregistrer les modifications'}
            </button>
            <button
              type="button"
              onClick={handleResetPassword}
              className="flex items-center gap-2 px-4 py-2 border rounded hover:bg-gray-100"
            >
              <KeyRound className="w-4 h-4" /> Réinitialiser le mot de passe
            </button>
          </div>
        </form>
      )}

      {activeTab === 'assignments' && (
        <div>
          <form onSubmit={handleAddAssignment} className="grid md:grid-cols-3 gap-3 mb-6 p-4 bg-gray-50 rounded-lg">
            <select
              value={assignForm.subjectId}
              onChange={(e) => setAssignForm({ ...assignForm, subjectId: e.target.value })}
              className="border rounded px-3 py-2"
              aria-label="Matière"
              required
            >
              <option value="">Sélectionner une matière...</option>
              {subjects.map((subject) => (
                <option key={subject.id} value={subject.id}>{subject.code} - {subject.name}</option>
              ))}
            </select>
            <LevelSelect
              levels={levels}
              value={assignForm.levelId}
              onChange={(levelId) => setAssignForm({ ...assignForm, levelId })}
              className="border rounded px-3 py-2"
              ariaLabel="Niveau"
              required
            />
            <button type="submit" className="bg-indigo-600 text-white py-2 rounded hover:bg-indigo-700 flex items-center justify-center gap-2">
              <Plus className="w-4 h-4" /> Affecter
            </button>
          </form>

          {assignments.length === 0 ? (
            <p className="text-center py-8 text-gray-500">Aucune affectation</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[480px] text-sm">
                <thead className="bg-gray-100">
                  <tr>
                    <th className="px-3 py-2 text-left">Matière</th>
                    <th className="px-3 py-2 text-left">Niveau</th>
                    <th className="px-3 py-2 text-left">Cycle</th>
                    <th className="px-3 py-2 text-left">Retirer</th>
                  </tr>
                </thead>
                <tbody>
                  {assignments.map((a) => (
                    <tr key={a.id} className="border-b hover:bg-gray-50">
                      <td className="px-3 py-2 font-semibold">{a.subjects?.name}</td>
                      <td className="px-3 py-2">{a.levels?.name}</td>
                      <td className="px-3 py-2">{a.levels?.cycle && cycleLabel(a.levels.cycle)}</td>
                      <td className="px-3 py-2">
                        <button
                          onClick={() => handleRemoveAssignment(a.id)}
                          className="text-red-600 hover:bg-red-50 p-2 rounded"
                          title="Retirer"
                          aria-label={`Retirer ${a.subjects?.name} en ${a.levels?.name}`}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {activeTab === 'schedule' && (
        schedule.length === 0 ? (
          <p className="text-center py-8 text-gray-500">Aucun créneau planifié</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[480px] text-sm">
              <thead className="bg-gray-100">
                <tr>
                  <th className="px-3 py-2 text-left">Jour</th>
                  <th className="px-3 py-2 text-left">Horaire</th>
                  <th className="px-3 py-2 text-left">Matière</th>
                  <th className="px-3 py-2 text-left">Niveau</th>
                  <th className="px-3 py-2 text-left">Salle</th>
                </tr>
              </thead>
              <tbody>
                {schedule.map((s) => (
                  <tr key={s.id} className="border-b hover:bg-gray-50">
                    <td className="px-3 py-2">{DAY_NAMES[s.day_of_week]}</td>
                    <td className="px-3 py-2">{s.start_time.slice(0, 5)} - {s.end_time.slice(0, 5)}</td>
                    <td className="px-3 py-2 font-semibold">{s.subjects?.name}</td>
                    <td className="px-3 py-2">{s.levels?.name || '-'}</td>
                    <td className="px-3 py-2">{s.room || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      )}

      {activeTab === 'messages' && (
        <div>
          <form onSubmit={handleSendMessage} className="space-y-3 mb-8 p-4 bg-gray-50 rounded-lg">
            <h3 className="font-bold">Envoyer un message à {fullName}</h3>
            <input
              type="text"
              value={messageForm.subject}
              onChange={(e) => setMessageForm({ ...messageForm, subject: e.target.value })}
              placeholder="Objet"
              aria-label="Objet du message"
              className="w-full border rounded px-3 py-2"
              required
            />
            <textarea
              value={messageForm.content}
              onChange={(e) => setMessageForm({ ...messageForm, content: e.target.value })}
              placeholder="Votre message..."
              aria-label="Contenu du message"
              className="w-full border rounded px-3 py-2"
              rows={4}
              required
            />
            <button
              type="submit"
              disabled={saving}
              className="px-6 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700 disabled:opacity-50 flex items-center gap-2"
            >
              <Send className="w-4 h-4" /> {saving ? 'Envoi...' : 'Envoyer'}
            </button>
          </form>

          <h3 className="font-bold mb-3">Messages envoyés ({messages.length})</h3>
          {messages.length === 0 ? (
            <p className="text-center py-6 text-gray-500">Aucun message envoyé à cet enseignant</p>
          ) : (
            <div className="space-y-3">
              {messages.map((message) => (
                <div key={message.id} className="border rounded-lg p-4">
                  <div className="flex justify-between items-start gap-3">
                    <div className="min-w-0">
                      <p className="font-semibold">{message.subject}</p>
                      <p className="text-xs text-gray-500 mb-2">
                        {new Date(message.sent_at).toLocaleString('fr-FR')} •{' '}
                        {message.is_read ? 'Lu' : 'Non lu'}
                      </p>
                      <p className="text-sm text-gray-700 whitespace-pre-wrap">{message.content}</p>
                    </div>
                    <button
                      onClick={() => handleDeleteMessage(message.id)}
                      className="text-red-600 hover:bg-red-50 p-2 rounded"
                      title="Supprimer"
                      aria-label={`Supprimer le message ${message.subject}`}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === 'payslips' && (
        <PayslipHistoryTable teacherId={teacher.id} academicYear={CURRENT_ACADEMIC_YEAR} showTeacherName={false} />
      )}
    </div>
  );
};

export default TeacherDetail;
