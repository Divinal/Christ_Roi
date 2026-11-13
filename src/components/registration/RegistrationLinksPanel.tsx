import React, { useEffect, useState } from 'react';
import { Copy, Link2, Mail, MessageCircle, Power, X } from 'lucide-react';
import { siteConfig } from '../../config/site.config';
import {
  LinkStatus,
  RegistrationLink,
  RegistrationNotActivatedError,
  RegistrationRole,
  createRegistrationLink,
  fetchRegistrationLinks,
  linkStatus,
  registrationUrl,
  setRegistrationLinkActive,
} from '../../lib/registration';
import { formatDate } from '../../lib/grades';
import { CYCLES, SchoolCycle, cycleLabel } from '../../lib/levels';
import { notify } from '../ui/feedback';
import { t } from '../../i18n';

interface RegistrationLinksPanelProps {
  role: RegistrationRole;
  onClose: () => void;
}

const STATUS_STYLES: Record<LinkStatus, { label: string; className: string }> = {
  active: { label: t("Actif"), className: 'bg-green-100 text-green-700' },
  expired: { label: t("Expiré"), className: 'bg-gray-100 text-gray-600' },
  full: { label: t("Complet"), className: 'bg-orange-100 text-orange-700' },
  disabled: { label: t("Désactivé"), className: 'bg-red-100 text-red-700' },
};

const VALIDITY_OPTIONS: { days: number | null; label: string }[] = [
  { days: 7, label: t("7 jours") },
  { days: 30, label: t("30 jours") },
  { days: 90, label: t("90 jours") },
  { days: null, label: t("Sans date limite") },
];

const shareMessage = (url: string) =>
  t("Bonjour, voici votre lien pour créer votre compte {0} : {1}", [t(siteConfig.schoolName), url]);

// Copie : presse-papiers si le navigateur l'autorise, sinon sélection du champ.
const copyLink = async (url: string, inputId: string) => {
  try {
    await navigator.clipboard.writeText(url);
  } catch {
    const input = document.getElementById(inputId) as HTMLInputElement | null;
    input?.select();
    if (!document.execCommand('copy')) {
      notify(t("Sélectionnez le lien et copiez-le avec Ctrl+C."));
      return;
    }
  }
  notify(t("✅ Lien copié"));
};

const RegistrationLinksPanel: React.FC<RegistrationLinksPanelProps> = ({ role, onClose }) => {
  const [links, setLinks] = useState<RegistrationLink[]>([]);
  const [loading, setLoading] = useState(true);
  const [notActivated, setNotActivated] = useState(false);
  const [saving, setSaving] = useState(false);
  const [label, setLabel] = useState('');
  // Lien étudiant : réservé au cycle choisi (obligatoire).
  const [cycle, setCycle] = useState<SchoolCycle | ''>('');
  const [validity, setValidity] = useState('30');
  const [maxUses, setMaxUses] = useState('');
  const [createdId, setCreatedId] = useState('');

  const load = async () => {
    try {
      setLinks(await fetchRegistrationLinks(role));
    } catch (error: any) {
      if (error instanceof RegistrationNotActivatedError) setNotActivated(true);
      else notify(`❌ Erreur: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [role]);

  const create = async (event: React.FormEvent) => {
    event.preventDefault();
    if (role === 'student' && !cycle) {
      notify(t("⚠️ Choisissez le cycle concerné par ce lien."));
      return;
    }
    const limit = maxUses.trim() ? parseInt(maxUses, 10) : null;
    if (limit !== null && (Number.isNaN(limit) || limit < 1)) {
      notify(t("⚠️ Le nombre maximal d'inscriptions doit être au moins 1."));
      return;
    }
    setSaving(true);
    try {
      const link = await createRegistrationLink({
        role,
        label: label.trim() || null,
        cycle: role === 'student' ? (cycle as SchoolCycle) : null,
        maxUses: limit,
        validityDays: validity ? Number(validity) : null,
      });
      setLinks((previous) => [link, ...previous]);
      setCreatedId(link.id);
      setLabel('');
      setMaxUses('');
      notify(t("✅ Lien créé : copiez-le ou envoyez-le."));
    } catch (error: any) {
      if (error instanceof RegistrationNotActivatedError) setNotActivated(true);
      else notify(`❌ Erreur: ${error.message}`);
    } finally {
      setSaving(false);
    }
  };

  const toggle = async (link: RegistrationLink) => {
    try {
      await setRegistrationLinkActive(link.id, !link.is_active);
      setLinks((previous) => previous.map((item) => (item.id === link.id ? { ...item, is_active: !link.is_active } : item)));
      notify(link.is_active ? t("✅ Lien désactivé : il ne permet plus de s'inscrire.") : t("✅ Lien réactivé"));
    } catch (error: any) {
      notify(`❌ Erreur: ${error.message}`);
    }
  };

  const title = role === 'student' ? t("Liens d'inscription des étudiants") : t("Liens d'inscription des enseignants");

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-60 p-2 md:p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="flex max-h-[92vh] w-full max-w-3xl flex-col rounded-xl bg-white shadow-lg"
      >
        <div className="flex items-start justify-between gap-3 border-b p-4 md:p-5">
          <div>
            <h2 className="flex items-center gap-2 text-lg font-semibold md:text-xl">
              <Link2 className="h-5 w-5 text-indigo-600" /> {title}
            </h2>
            <p className="mt-1 text-sm text-gray-600">
              {role === 'student'
                ? t("Envoyez ce lien aux étudiants de votre choix : chacun remplit sa fiche, choisit son niveau et reçoit un matricule attribué par le système.")
                : t("Envoyez ce lien aux enseignants de votre choix : chacun remplit sa fiche et reçoit un matricule attribué par le système.")}
            </p>
          </div>
          <button onClick={onClose} aria-label={t("Fermer")} className="rounded-lg p-2 text-gray-500 hover:bg-gray-100">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="min-h-0 flex-1 space-y-5 overflow-y-auto p-4 md:p-5">
          {notActivated ? (
            <p className="rounded-lg bg-orange-50 p-4 text-sm text-orange-800">
              {t("Les inscriptions en ligne ne sont pas encore activées : la mise à jour de la base de données doit d'abord être appliquée.")}
            </p>
          ) : (
            <>
              <form onSubmit={create} className="grid gap-3 rounded-lg border p-4 md:grid-cols-4">
                {role === 'student' && (
                  <label className="block text-sm font-medium md:col-span-2">
                    {t("Cycle concerné *")}
                    <select
                      required
                      value={cycle}
                      onChange={(event) => setCycle(event.target.value as SchoolCycle | '')}
                      className="mt-1 w-full rounded-lg border px-3 py-2 font-normal"
                      data-testid="registration-cycle"
                    >
                      <option value="">{t("Choisir un cycle...")}</option>
                      {CYCLES.map((item) => (
                        <option key={item.id} value={item.id}>{item.label}</option>
                      ))}
                    </select>
                  </label>
                )}
                <label className="block text-sm font-medium md:col-span-2">
                  {t("Libellé (facultatif)")}
                  <input
                    type="text"
                    value={label}
                    onChange={(event) => setLabel(event.target.value)}
                    placeholder={role === 'student' ? t("Ex. Rentrée 2026 — 6ème") : t("Ex. Recrutement 2026")}
                    className="mt-1 w-full rounded-lg border px-3 py-2 font-normal"
                  />
                </label>
                <label className="block text-sm font-medium">
                  {t("Validité")}
                  <select
                    value={validity}
                    onChange={(event) => setValidity(event.target.value)}
                    className="mt-1 w-full rounded-lg border px-3 py-2 font-normal"
                  >
                    {VALIDITY_OPTIONS.map((option) => (
                      <option key={option.label} value={option.days ?? ''}>{option.label}</option>
                    ))}
                  </select>
                </label>
                <label className="block text-sm font-medium">
                  {t("Inscriptions max.")}
                  <input
                    type="number"
                    min="1"
                    value={maxUses}
                    onChange={(event) => setMaxUses(event.target.value)}
                    placeholder={t("Illimité")}
                    className="mt-1 w-full rounded-lg border px-3 py-2 font-normal"
                  />
                </label>
                <div className={`flex items-end justify-end ${role === 'student' ? 'md:col-span-2' : 'md:col-span-4'}`}>
                  <button
                    type="submit"
                    disabled={saving}
                    className="flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
                  >
                    <Link2 className="h-4 w-4" /> {saving ? t("Création...") : t("Créer un lien")}
                  </button>
                </div>
              </form>

              {loading ? (
                <p className="py-6 text-center text-gray-500">{t("Chargement...")}</p>
              ) : links.length === 0 ? (
                <p className="py-6 text-center text-gray-500">{t("Aucun lien pour le moment.")}</p>
              ) : (
                <ul className="space-y-3">
                  {links.map((link) => {
                    const status = linkStatus(link);
                    const url = registrationUrl(link.token);
                    const inputId = `registration-link-${link.id}`;
                    return (
                      <li
                        key={link.id}
                        data-testid="registration-link"
                        className={`rounded-lg border p-4 ${link.id === createdId ? 'border-indigo-400 ring-2 ring-indigo-200' : ''}`}
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <p className="font-semibold">{link.label || t("Lien sans titre")}</p>
                          <div className="flex flex-wrap items-center gap-2">
                            {link.role === 'student' && (
                              <span className="rounded-full bg-indigo-100 px-2 py-0.5 text-xs font-medium text-indigo-700" data-testid="registration-link-cycle">
                                {link.cycle ? cycleLabel(link.cycle) : t("Tous les cycles")}
                              </span>
                            )}
                            <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLES[status].className}`}>
                              {STATUS_STYLES[status].label}
                            </span>
                          </div>
                        </div>
                        <p className="mt-1 text-xs text-gray-600">
                          {link.max_uses !== null
                            ? t("{0} / {1} inscription(s)", [link.use_count, link.max_uses])
                            : t("{0} inscription(s)", [link.use_count])}
                          {' • '}
                          {link.expires_at
                            ? (status === 'expired' ? t("Expiré le {0}", [formatDate(link.expires_at)]) : t("Expire le {0}", [formatDate(link.expires_at)]))
                            : t("Sans date limite")}
                          {' • '}
                          {t("Créé le {0}", [formatDate(link.created_at)])}
                        </p>
                        <input
                          id={inputId}
                          readOnly
                          dir="ltr"
                          value={url}
                          onFocus={(event) => event.currentTarget.select()}
                          aria-label={t("Adresse du lien")}
                          className="mt-3 w-full rounded-lg border bg-gray-50 px-3 py-2 font-mono text-xs"
                        />
                        <div className="mt-3 flex flex-wrap gap-2">
                          <button
                            onClick={() => copyLink(url, inputId)}
                            disabled={status !== 'active'}
                            className="flex items-center gap-1 rounded-lg border px-3 py-1.5 text-sm hover:bg-gray-100 disabled:opacity-40"
                          >
                            <Copy className="h-4 w-4" /> {t("Copier")}
                          </button>
                          {status === 'active' && (
                            <>
                              <a
                                href={`https://wa.me/?text=${encodeURIComponent(shareMessage(url))}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center gap-1 rounded-lg border px-3 py-1.5 text-sm hover:bg-gray-100"
                              >
                                <MessageCircle className="h-4 w-4" /> {t("WhatsApp")}
                              </a>
                              <a
                                href={`mailto:?subject=${encodeURIComponent(t("Inscription — {0}", [t(siteConfig.schoolName)]))}&body=${encodeURIComponent(shareMessage(url))}`}
                                className="flex items-center gap-1 rounded-lg border px-3 py-1.5 text-sm hover:bg-gray-100"
                              >
                                <Mail className="h-4 w-4" /> {t("Email")}
                              </a>
                            </>
                          )}
                          <button
                            onClick={() => toggle(link)}
                            className={`ms-auto flex items-center gap-1 rounded-lg border px-3 py-1.5 text-sm ${link.is_active ? 'text-red-600 hover:bg-red-50' : 'text-green-700 hover:bg-green-50'}`}
                          >
                            <Power className="h-4 w-4" /> {link.is_active ? t("Désactiver") : t("Réactiver")}
                          </button>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default RegistrationLinksPanel;
