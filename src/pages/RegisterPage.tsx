import React, { useEffect, useState } from 'react';
import { CheckCircle2, Eye, EyeOff, LogIn, UserPlus, XCircle } from 'lucide-react';
import PublicLayout from '../components/PublicLayout';
import { PublicPage } from '../components/PublicHeader';
import LevelSelect from '../components/levels/LevelSelect';
import { siteConfig } from '../config/site.config';
import { RegistrationInfo, fetchRegistrationInfo, submitRegistration } from '../lib/registration';
import { formatDate } from '../lib/grades';
import { t } from '../i18n';

interface RegisterPageProps {
  token: string;
  onNavigate: (page: PublicPage) => void;
  onLoginClick: () => void;
}

const MIN_PASSWORD_LENGTH = 8;

const EMPTY_FORM = {
  first_name: '',
  last_name: '',
  email: '',
  phone: '',
  level_id: '',
  date_of_birth: '',
  address: '',
  specialization: '',
  department: '',
  password: '',
  confirm: '',
};

const inputClass = 'mt-1 w-full rounded-lg border px-3 py-2 font-normal';

const RegisterPage: React.FC<RegisterPageProps> = ({ token, onNavigate, onLoginClick }) => {
  const [info, setInfo] = useState<RegistrationInfo | null>(null);
  const [loadError, setLoadError] = useState('');
  const [form, setForm] = useState(EMPTY_FORM);
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState('');
  const [done, setDone] = useState<{ email: string; number: string } | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (!token) {
      setLoadError(t("Lien d’inscription introuvable."));
      return;
    }
    fetchRegistrationInfo(token)
      .then((result) => {
        if (!cancelled) setInfo(result);
      })
      .catch((error: Error) => {
        if (!cancelled) setLoadError(error.message);
      });
    return () => {
      cancelled = true;
    };
  }, [token]);

  const set = (field: keyof typeof EMPTY_FORM) => (
    event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
  ) => setForm({ ...form, [field]: event.target.value });

  const isStudent = info?.role === 'student';
  const chosenLevel = info?.levels?.find((level) => level.id === form.level_id);
  const numberPrefix = isStudent ? chosenLevel?.number_prefix : info?.number_prefix;

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setFormError('');
    if (form.password.length < MIN_PASSWORD_LENGTH) {
      setFormError(t("Le mot de passe doit contenir au moins 8 caractères."));
      return;
    }
    if (form.password !== form.confirm) {
      setFormError(t("Les deux mots de passe ne sont pas identiques."));
      return;
    }
    setSubmitting(true);
    try {
      const { confirm, ...fields } = form;
      const result = await submitRegistration(token, fields);
      setDone({ email: result.email, number: result.number });
      window.scrollTo({ top: 0 });
    } catch (error: any) {
      setFormError(error.message);
    } finally {
      setSubmitting(false);
    }
  };

  const title = isStudent ? t("Inscription des étudiants") : t("Inscription des enseignants");

  return (
    <PublicLayout currentPage="register" onNavigate={onNavigate} onLoginClick={onLoginClick}>
      <section className="container mx-auto px-4 py-10 md:py-16 lg:px-8">
        <div className="mx-auto max-w-2xl rounded-2xl bg-white p-5 shadow-lg md:p-8" data-testid="register-page">
          {loadError ? (
            <div className="py-6 text-center">
              <XCircle className="mx-auto h-12 w-12 text-red-500" />
              <h1 className="mt-4 text-xl font-bold text-gray-900">{t("Ce lien ne permet pas de s'inscrire")}</h1>
              <p className="mt-2 text-gray-600" data-testid="register-error">{loadError}</p>
              <p className="mt-2 text-sm text-gray-500">{t("Demandez un nouveau lien à l'administration de l'établissement.")}</p>
              <button
                onClick={() => onNavigate('home')}
                className="mt-6 rounded-lg border px-4 py-2 text-sm hover:bg-gray-100"
              >
                {t("Retour à l'accueil")}
              </button>
            </div>
          ) : !info ? (
            <p className="py-10 text-center text-gray-500">{t("Chargement...")}</p>
          ) : done ? (
            <div className="py-4 text-center" data-testid="register-success">
              <CheckCircle2 className="mx-auto h-14 w-14 text-green-500" />
              <h1 className="mt-4 text-2xl font-bold text-gray-900">{t("Votre compte est créé")}</h1>
              <p className="mt-2 text-gray-600">{t("Notez bien votre matricule : il vous identifie dans l'établissement.")}</p>
              <p className="mt-6 text-sm text-gray-500">{t("Votre matricule")}</p>
              <p className="mt-1 font-mono text-3xl font-bold tracking-wider text-indigo-600" dir="ltr" data-testid="register-number">
                {done.number}
              </p>
              <p className="mt-6 text-sm text-gray-600">
                {t("Connectez-vous avec votre email {0} et le mot de passe que vous avez choisi.", [done.email])}
              </p>
              <button
                onClick={onLoginClick}
                className="mt-6 inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-6 py-3 font-medium text-white hover:bg-indigo-700"
              >
                <LogIn className="h-5 w-5" /> {t("Se connecter")}
              </button>
            </div>
          ) : (
            <form onSubmit={submit} className="space-y-4">
              <div className="text-center">
                <UserPlus className="mx-auto h-10 w-10 text-indigo-600" />
                <h1 className="mt-2 text-2xl font-bold text-gray-900">{title}</h1>
                <p className="mt-1 text-gray-600">{t(siteConfig.schoolName)}</p>
                {info.label && <p className="mt-1 text-sm font-medium text-indigo-700">{info.label}</p>}
                {info.expires_at && (
                  <p className="mt-1 text-xs text-gray-500">{t("Lien valable jusqu'au {0}", [formatDate(info.expires_at)])}</p>
                )}
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <label className="block text-sm font-medium">
                  {t("Prénom *")}
                  <input required value={form.first_name} onChange={set('first_name')} autoComplete="given-name" className={inputClass} />
                </label>
                <label className="block text-sm font-medium">
                  {t("Nom *")}
                  <input required value={form.last_name} onChange={set('last_name')} autoComplete="family-name" className={inputClass} />
                </label>
                <label className="block text-sm font-medium">
                  {t("Email *")}
                  <input required type="email" value={form.email} onChange={set('email')} autoComplete="email" className={inputClass} />
                </label>
                <label className="block text-sm font-medium">
                  {t("Téléphone")}
                  <input type="tel" value={form.phone} onChange={set('phone')} autoComplete="tel" className={inputClass} />
                </label>
              </div>

              {isStudent ? (
                <>
                  <div>
                    <label htmlFor="register-level" className="block text-sm font-medium">{t("Niveau d'inscription *")}</label>
                    <LevelSelect
                      id="register-level"
                      levels={info.levels || []}
                      value={form.level_id}
                      onChange={(levelId) => setForm({ ...form, level_id: levelId })}
                      required
                      className={inputClass}
                    />
                  </div>
                  <div className="grid gap-4 md:grid-cols-2">
                    <label className="block text-sm font-medium">
                      {t("Date de naissance")}
                      <input type="date" value={form.date_of_birth} onChange={set('date_of_birth')} className={inputClass} />
                    </label>
                    <label className="block text-sm font-medium">
                      {t("Adresse")}
                      <input value={form.address} onChange={set('address')} autoComplete="street-address" className={inputClass} />
                    </label>
                  </div>
                </>
              ) : (
                <div className="grid gap-4 md:grid-cols-2">
                  <label className="block text-sm font-medium">
                    {t("Spécialité")}
                    <input value={form.specialization} onChange={set('specialization')} className={inputClass} />
                  </label>
                  <label className="block text-sm font-medium">
                    {t("Département")}
                    <input value={form.department} onChange={set('department')} className={inputClass} />
                  </label>
                </div>
              )}

              <div className="rounded-lg bg-indigo-50 p-3 text-sm text-indigo-900" data-testid="register-number-preview">
                {numberPrefix
                  ? t("Votre matricule sera attribué automatiquement : {0}-…", [numberPrefix])
                  : t("Choisissez votre niveau : votre matricule sera attribué automatiquement selon ce niveau.")}
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <label className="block text-sm font-medium">
                  {t("Mot de passe *")}
                  <div className="relative">
                    <input
                      required
                      type={showPassword ? 'text' : 'password'}
                      value={form.password}
                      onChange={set('password')}
                      autoComplete="new-password"
                      minLength={MIN_PASSWORD_LENGTH}
                      className={`${inputClass} pe-10`}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      aria-label={showPassword ? t("Masquer le mot de passe") : t("Afficher le mot de passe")}
                      className="absolute end-2 top-1/2 mt-0.5 -translate-y-1/2 p-1 text-gray-500"
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </label>
                <label className="block text-sm font-medium">
                  {t("Confirmer le mot de passe *")}
                  <input
                    required
                    type={showPassword ? 'text' : 'password'}
                    value={form.confirm}
                    onChange={set('confirm')}
                    autoComplete="new-password"
                    className={inputClass}
                  />
                </label>
              </div>
              <p className="text-xs text-gray-500">{t("Au moins 8 caractères.")}</p>

              {formError && (
                <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700" data-testid="register-form-error">
                  {formError}
                </p>
              )}

              <button
                type="submit"
                disabled={submitting}
                className="flex w-full items-center justify-center gap-2 rounded-lg bg-indigo-600 py-3 font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
              >
                <UserPlus className="h-5 w-5" /> {submitting ? t("Création du compte...") : t("Créer mon compte")}
              </button>
            </form>
          )}
        </div>
      </section>
    </PublicLayout>
  );
};

export default RegisterPage;
