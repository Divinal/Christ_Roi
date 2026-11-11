import React, { useState } from 'react';
import { KeyRound } from 'lucide-react';
import { supabase } from '../lib/supabaseClient';
import { notify } from './ui/feedback';
import { t } from '../i18n';

interface ChangePasswordModalProps {
  // Obligatoire : après un mot de passe temporaire, on ne peut pas fermer.
  forced: boolean;
  onDone: () => void;
  onCancel: () => void;
  onLogout: () => void;
}

const MIN_LENGTH = 8;

const ChangePasswordModal: React.FC<ChangePasswordModalProps> = ({ forced, onDone, onCancel, onLogout }) => {
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (password.length < MIN_LENGTH) {
      setError(t("Le mot de passe doit contenir au moins {0} caractères.", [MIN_LENGTH]));
      return;
    }
    if (password !== confirmation) {
      setError(t("Les deux mots de passe ne sont pas identiques."));
      return;
    }

    setSaving(true);
    setError('');
    const { error: updateError } = await supabase.auth.updateUser({
      password,
      data: { must_change_password: false },
    });
    setSaving(false);

    if (updateError) {
      setError(
        updateError.code === 'same_password'
          ? t("Choisissez un mot de passe différent de l'actuel.")
          : updateError.message,
      );
      return;
    }
    notify(t("✅ Mot de passe modifié"));
    onDone();
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black bg-opacity-70 p-4">
      <form
        onSubmit={submit}
        role="dialog"
        aria-modal="true"
        aria-labelledby="password-title"
        className="w-full max-w-md rounded-xl bg-white p-6 shadow-lg"
      >
        <div className="mb-4 flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-100">
            <KeyRound className="h-5 w-5 text-indigo-600" />
          </span>
          <h2 id="password-title" className="text-lg font-semibold text-gray-900">
            {forced ? t("Choisissez votre mot de passe") : t("Changer mon mot de passe")}
          </h2>
        </div>
        {forced && (
          <p className="mb-4 text-sm text-gray-600">
            {t("Vous utilisez un mot de passe temporaire. Choisissez-en un personnel pour continuer.")}
          </p>
        )}
        {error && <p role="alert" className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
        <label className="block text-sm font-medium text-gray-700">
          {t("Nouveau mot de passe")}
          <input
            autoFocus
            type="password"
            required
            minLength={MIN_LENGTH}
            autoComplete="new-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className="mt-2 w-full rounded-lg border px-3 py-2 font-normal"
          />
        </label>
        <label className="mt-4 block text-sm font-medium text-gray-700">
          {t("Confirmer le mot de passe")}
          <input
            type="password"
            required
            autoComplete="new-password"
            value={confirmation}
            onChange={(event) => setConfirmation(event.target.value)}
            className="mt-2 w-full rounded-lg border px-3 py-2 font-normal"
          />
        </label>
        <div className="mt-6 flex justify-end gap-3">
          <button
            type="button"
            onClick={forced ? onLogout : onCancel}
            className="rounded-lg border px-4 py-2 text-sm hover:bg-gray-100"
          >
            {forced ? t("Se déconnecter") : t("Annuler")}
          </button>
          <button
            type="submit"
            disabled={saving}
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
          >
            {saving ? t("Enregistrement...") : t("Enregistrer")}
          </button>
        </div>
      </form>
    </div>
  );
};

export default ChangePasswordModal;
