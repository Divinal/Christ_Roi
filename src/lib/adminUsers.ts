import { FunctionsFetchError, FunctionsHttpError, FunctionsRelayError } from '@supabase/supabase-js';
import { supabase } from './supabaseClient';
import { t } from '../i18n';

// Appelle la fonction serveur qui gère les comptes de connexion. Les droits y
// sont vérifiés d'après la session de la personne connectée.
export const callAdminUsers = async <T = Record<string, any>>(
  action: string,
  payload: Record<string, unknown> = {},
): Promise<T> => {
  const { data, error } = await supabase.functions.invoke('admin-users', {
    body: { action, ...payload },
  });
  if (!error) return data as T;

  if (error instanceof FunctionsHttpError) {
    if (error.context.status === 404) {
      throw new Error(t("Le service de gestion des comptes n'est pas encore déployé sur le serveur."));
    }
    const body = await error.context.json().catch(() => null);
    throw new Error(body?.error ? t(body.error) : t("Le serveur a refusé cette action."));
  }
  if (error instanceof FunctionsFetchError || error instanceof FunctionsRelayError) {
    throw new Error(t("Service de gestion des comptes injoignable. Vérifiez votre connexion et réessayez."));
  }
  throw error;
};
