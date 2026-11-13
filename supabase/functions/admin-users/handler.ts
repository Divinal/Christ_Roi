// Opérations sur les comptes de connexion, qui exigent une clé secrète :
// elles s'exécutent ici, côté serveur, et jamais dans le navigateur.
// Ce fichier ne dépend pas de Deno : il est testé tel quel sous Node.

export type Role = 'student' | 'teacher' | 'admin' | 'academic_admin' | 'finance_admin' | 'admin_secretaire';

export type Action =
  | 'create_student'
  | 'create_teacher'
  | 'create_admin'
  | 'delete_student'
  | 'delete_teacher'
  | 'update_teacher_email'
  | 'reset_student_password'
  | 'reset_teacher_password'
  | 'registration_info'
  | 'register';

// Inscription par lien : sans session. L'accès repose sur le jeton du lien,
// créé par l'administration, et contrôlé à chaque appel.
const PUBLIC_ACTIONS = new Set<string>(['registration_info', 'register']);

const ADMIN_ROLES: Role[] = ['admin', 'academic_admin', 'finance_admin', 'admin_secretaire'];

// Mêmes droits que les policies RLS sur students et teachers.
const PERMISSIONS = new Map<string, Role[]>([
  ['create_student', ADMIN_ROLES],
  ['create_teacher', ADMIN_ROLES],
  ['create_admin', ['admin']],
  ['delete_student', ['admin', 'academic_admin']],
  ['delete_teacher', ['admin']],
  ['update_teacher_email', ['admin']],
  ['reset_student_password', ['admin', 'academic_admin', 'admin_secretaire']],
  ['reset_teacher_password', ['admin']],
]);

// supabase-js ajoute ses propres en-têtes (X-Supabase-Client-…) et la liste
// évolue avec ses versions : un en-tête non autorisé fait échouer l'appel dans
// le navigateur avant même qu'il parte. La liste sert de valeur par défaut.
// La pré-requête renvoie, elle, les en-têtes demandés. C'est sans risque :
// l'accès repose sur le jeton de session, pas sur des cookies.
const ALLOWED_HEADERS = [
  'authorization',
  'apikey',
  'content-type',
  'x-client-info',
  'x-region',
  'x-supabase-client-platform',
  'x-supabase-client-platform-version',
  'x-supabase-client-runtime',
  'x-supabase-client-runtime-version',
].join(', ');

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': ALLOWED_HEADERS,
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const preflightHeaders = (req: Request) => ({
  ...CORS_HEADERS,
  'Access-Control-Allow-Headers': req.headers.get('Access-Control-Request-Headers') || ALLOWED_HEADERS,
  'Access-Control-Max-Age': '86400',
});

class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  });

// Mot de passe temporaire lisible : pas de caractères ambigus (0/O, 1/l/I).
const PASSWORD_ALPHABET = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export const generateTemporaryPassword = (length = 12): string => {
  const limit = 256 - (256 % PASSWORD_ALPHABET.length); // évite le biais du modulo
  let password = '';
  while (password.length < length) {
    for (const byte of crypto.getRandomValues(new Uint8Array(length * 2))) {
      if (byte < limit && password.length < length) {
        password += PASSWORD_ALPHABET[byte % PASSWORD_ALPHABET.length];
      }
    }
  }
  return password;
};

const requiredText = (value: unknown, label: string): string => {
  const text = typeof value === 'string' ? value.trim() : '';
  if (!text) throw new HttpError(400, `Champ manquant : ${label}.`);
  return text;
};

const optionalText = (value: unknown): string | null => {
  const text = typeof value === 'string' ? value.trim() : '';
  return text || null;
};

const requiredEmail = (value: unknown): string => {
  const email = requiredText(value, 'email').toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new HttpError(400, 'Adresse email invalide.');
  return email;
};

const authErrorMessage = (error: { code?: string; message?: string }): string => {
  if (error.code === 'email_exists' || /already.*registered|already been registered/i.test(error.message || '')) {
    return 'Cet email est déjà utilisé par un autre compte.';
  }
  return error.message || 'Erreur du service de connexion.';
};

// `admin` est un client Supabase initialisé avec une clé secrète : il
// contourne le RLS. Le contrôle des droits repose donc entièrement sur ce code.
export const handleRequest = async (req: Request, admin: any): Promise<Response> => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: preflightHeaders(req) });
  if (req.method !== 'POST') return json({ error: 'Méthode non autorisée.' }, 405);

  try {
    let body: any = null;
    try {
      body = await req.json();
    } catch {
      // Corps illisible : traité après le contrôle de session.
    }

    if (PUBLIC_ACTIONS.has(body?.action)) {
      return json(body.action === 'register' ? await register(admin, body) : await registrationInfo(admin, body));
    }

    const token = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '');
    if (!token) throw new HttpError(401, 'Connexion requise.');

    const { data: authData, error: authError } = await admin.auth.getUser(token);
    const caller = authData?.user;
    if (authError || !caller) throw new HttpError(401, 'Session invalide ou expirée. Reconnectez-vous.');

    if (!body) throw new HttpError(400, 'Requête invalide.');

    const action = body?.action as Action;
    const allowed = PERMISSIONS.get(action);
    if (!allowed) throw new HttpError(400, 'Action inconnue.');

    const callerRoles = await rolesOf(admin, caller.id);
    if (!callerRoles.some((role) => allowed.includes(role))) {
      throw new HttpError(403, "Vous n'avez pas les droits pour cette action.");
    }

    switch (action) {
      case 'create_student':
        return json(await createStudent(admin, body));
      case 'create_teacher':
        return json(await createTeacher(admin, body));
      case 'create_admin':
        return json(await createAdmin(admin, body));
      case 'delete_student':
        return json(await deleteMember(admin, 'students', 'student', body.student_id, caller.id));
      case 'delete_teacher':
        return json(await deleteMember(admin, 'teachers', 'teacher', body.teacher_id, caller.id));
      case 'update_teacher_email':
        return json(await updateTeacherEmail(admin, body));
      case 'reset_student_password':
        return json(await resetPassword(admin, 'students', body.student_id, callerRoles));
      case 'reset_teacher_password':
        return json(await resetPassword(admin, 'teachers', body.teacher_id, callerRoles));
    }
    throw new HttpError(400, 'Action inconnue.');
  } catch (error) {
    if (error instanceof HttpError) return json({ error: error.message }, error.status);
    console.error('admin-users:', error);
    return json({ error: 'Erreur interne du serveur.' }, 500);
  }
};

const rolesOf = async (admin: any, userId: string): Promise<Role[]> => {
  const { data, error } = await admin.from('user_roles').select('role').eq('user_id', userId);
  if (error) throw error;
  return (data || []).map((row: { role: Role }) => row.role);
};

// Crée le compte de connexion, puis ce qui en dépend. Si une étape échoue, le
// compte est supprimé : on ne laisse pas un compte sans rôle ni fiche.
const createAccount = async (
  admin: any,
  account: {
    email: string;
    password: string;
    firstName: string;
    lastName: string;
    phone?: string | null;
    role: Role;
    // Faux quand la personne a choisi elle-même son mot de passe (inscription par lien).
    mustChangePassword?: boolean;
  },
  thenCreate: (userId: string) => Promise<void>,
) => {
  const { data, error } = await admin.auth.admin.createUser({
    email: account.email,
    password: account.password,
    email_confirm: true,
    user_metadata: {
      first_name: account.firstName,
      last_name: account.lastName,
      phone: account.phone ?? null,
      role: account.role,
      must_change_password: account.mustChangePassword ?? true,
    },
  });
  if (error) throw new HttpError(400, authErrorMessage(error));

  const userId: string = data.user.id;
  try {
    await thenCreate(userId);
    const { error: roleError } = await admin.from('user_roles').insert({ user_id: userId, role: account.role });
    if (roleError) throw roleError;
  } catch (cause) {
    await admin.auth.admin.deleteUser(userId);
    throw cause;
  }
  return userId;
};

const insertOrFail = async (admin: any, table: string, row: Record<string, unknown>, numberLabel: string) => {
  const { error } = await admin.from(table).insert(row);
  if (!error) return;
  if (error.code === '23505') throw new HttpError(409, `Ce ${numberLabel} est déjà utilisé.`);
  if (error.code === '23503') throw new HttpError(400, 'Le niveau choisi n’existe plus.');
  throw error;
};

// ---------- Matricules générés par le système ----------
// Étudiant : code du niveau, année de rentrée, numéro d'ordre (6E-26-0001).
// Enseignant : ENS-26-0001.

const SPECIAL_LEVEL_WORDS: Record<string, string> = { SECONDE: '2ND', PREMIERE: '1RE', TERMINALE: 'TLE' };

// « 6ème » → 6E, « 4e » → 4E ; null si le mot n'est pas un ordinal.
const ordinalCode = (word: string): string | null => {
  const match = word.match(/^(\d+)(E|EME|ER|ERE|RE|ND|NDE)$/);
  return match ? `${match[1]}E` : null;
};

const wordCode = (word: string, alone: boolean): string =>
  SPECIAL_LEVEL_WORDS[word] ||
  ordinalCode(word) ||
  (/\d/.test(word) && word.length <= 5 ? word : alone ? word.slice(0, 3) : word[0]);

// Code court qui identifie le niveau dans le matricule :
// CM2 → CM2, 6ème → 6E, Petite Section → PS, Terminale A → TLEA, Master 1 → M1.
export const levelCode = (name: string): string => {
  const words = name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toUpperCase()
    .split(/[^A-Z0-9]+/)
    .filter(Boolean);
  if (!words.length) return 'NIV';
  if (words.length === 1) return wordCode(words[0], true);
  const [first, ...rest] = words;
  const tail = rest.map((word) => (/^\d+$/.test(word) || word.length === 1 ? word : wordCode(word, false))).join('');
  return (wordCode(first, false) + tail).slice(0, 8);
};

// Année de la rentrée sur deux chiffres : l'année scolaire commence en août.
export const schoolYearCode = (now = new Date()): string =>
  String(now.getMonth() + 1 >= 8 ? now.getFullYear() : now.getFullYear() - 1).slice(-2);

const MATRICULE_ATTEMPTS = 5;

const nextNumber = async (admin: any, table: string, column: string, prefix: string): Promise<string> => {
  const { data, error } = await admin
    .from(table)
    .select(column)
    .like(column, `${prefix}-%`)
    .order(column, { ascending: false })
    .limit(1);
  if (error) throw error;
  const last: string | undefined = data?.[0]?.[column];
  const next = last ? (parseInt(last.slice(prefix.length + 1), 10) || 0) + 1 : 1;
  return `${prefix}-${String(next).padStart(4, '0')}`;
};

// Matricule saisi : utilisé tel quel. Sinon le suivant de la série ; deux
// inscriptions simultanées se départagent grâce à l'unicité du matricule.
const insertWithNumber = async (
  admin: any,
  table: 'students' | 'teachers',
  column: 'student_number' | 'teacher_number',
  row: Record<string, unknown>,
  givenNumber: string | null,
  prefix: string,
): Promise<string> => {
  if (givenNumber) {
    await insertOrFail(admin, table, { ...row, [column]: givenNumber }, 'matricule');
    return givenNumber;
  }
  for (let attempt = 0; attempt < MATRICULE_ATTEMPTS; attempt++) {
    const number = await nextNumber(admin, table, column, prefix);
    const { error } = await admin.from(table).insert({ ...row, [column]: number });
    if (!error) return number;
    if (error.code === '23503') throw new HttpError(400, 'Le niveau choisi n’existe plus.');
    if (error.code !== '23505') throw error;
  }
  throw new HttpError(409, 'Impossible d’attribuer un matricule pour le moment. Réessayez.');
};

const findLevel = async (admin: any, levelId: string) => {
  const { data, error } = await admin.from('levels').select('id, name, cycle').eq('id', levelId).maybeSingle();
  if (error) throw error;
  if (!data) throw new HttpError(400, 'Le niveau choisi n’existe plus.');
  return data as { id: string; name: string; cycle: string };
};

interface SelfService {
  // Mot de passe choisi par la personne qui s'inscrit.
  password: string;
}

const createStudent = async (admin: any, body: any, selfService?: SelfService) => {
  const email = requiredEmail(body.email);
  const givenNumber = selfService ? null : optionalText(body.student_number);
  const phone = optionalText(body.phone);
  const firstName = requiredText(body.first_name, 'prénom');
  const lastName = requiredText(body.last_name, 'nom');
  const levelId = selfService ? requiredText(body.level_id, 'niveau') : optionalText(body.level_id);
  const level = levelId ? await findLevel(admin, levelId) : null;
  const prefix = `${level ? levelCode(level.name) : 'ETU'}-${schoolYearCode()}`;
  const password = selfService?.password ?? generateTemporaryPassword();
  let studentNumber = '';

  const userId = await createAccount(
    admin,
    { email, password, firstName, lastName, phone, role: 'student', mustChangePassword: !selfService },
    async (id) => {
      studentNumber = await insertWithNumber(admin, 'students', 'student_number', {
        user_id: id,
        level_id: levelId,
        date_of_birth: optionalText(body.date_of_birth),
        address: optionalText(body.address),
        parent_phone: phone,
        status: 'active',
      }, givenNumber, prefix);
    },
  );
  return {
    user_id: userId,
    student_number: studentNumber,
    ...(selfService ? {} : { temporary_password: password }),
  };
};

const createTeacher = async (admin: any, body: any, selfService?: SelfService) => {
  const email = requiredEmail(body.email);
  const givenNumber = selfService ? null : optionalText(body.teacher_number);
  const phone = optionalText(body.phone);
  const firstName = requiredText(body.first_name, 'prénom');
  const lastName = requiredText(body.last_name, 'nom');
  const password = selfService?.password ?? generateTemporaryPassword();
  let teacherNumber = '';

  const userId = await createAccount(
    admin,
    { email, password, firstName, lastName, phone, role: 'teacher', mustChangePassword: !selfService },
    async (id) => {
      teacherNumber = await insertWithNumber(admin, 'teachers', 'teacher_number', {
        user_id: id,
        phone,
        specialization: optionalText(body.specialization),
        department: optionalText(body.department),
      }, givenNumber, `ENS-${schoolYearCode()}`);
    },
  );
  return {
    user_id: userId,
    teacher_number: teacherNumber,
    ...(selfService ? {} : { temporary_password: password }),
  };
};

// ---------- Inscription par lien ----------

interface RegistrationLink {
  id: string;
  role: 'student' | 'teacher';
  label: string | null;
  max_uses: number | null;
  use_count: number;
  expires_at: string | null;
  is_active: boolean;
}

const LINK_COLUMNS = 'id, role, label, max_uses, use_count, expires_at, is_active';
const MIN_PASSWORD_LENGTH = 8;

// Table absente : la migration des liens d'inscription n'est pas encore appliquée.
const isMissingTable = (error: { code?: string } | null) => error?.code === 'PGRST205' || error?.code === '42P01';

const loadLink = async (admin: any, token: unknown): Promise<RegistrationLink> => {
  const value = typeof token === 'string' ? token.trim() : '';
  if (!/^[A-Za-z0-9_-]{24,128}$/.test(value)) throw new HttpError(404, 'Lien d’inscription introuvable.');

  const { data, error } = await admin.from('registration_links').select(LINK_COLUMNS).eq('token', value).maybeSingle();
  if (isMissingTable(error)) throw new HttpError(503, 'Les inscriptions en ligne ne sont pas encore activées sur le serveur.');
  if (error) throw error;
  if (!data) throw new HttpError(404, 'Lien d’inscription introuvable.');

  const link = data as RegistrationLink;
  if (!link.is_active) throw new HttpError(410, 'Ce lien d’inscription a été désactivé par l’administration.');
  if (link.expires_at && new Date(link.expires_at).getTime() <= Date.now()) {
    throw new HttpError(410, 'Ce lien d’inscription a expiré.');
  }
  if (link.max_uses !== null && link.use_count >= link.max_uses) {
    throw new HttpError(410, 'Ce lien d’inscription a atteint son nombre maximal d’inscriptions.');
  }
  return link;
};

// Réserve une place sur le lien (compare-et-échange sur use_count) : deux
// inscriptions simultanées ne peuvent pas dépasser le nombre maximal.
const claimLink = async (admin: any, token: string, link: RegistrationLink) => {
  let current = link;
  for (let attempt = 0; attempt < MATRICULE_ATTEMPTS; attempt++) {
    const { data, error } = await admin
      .from('registration_links')
      .update({ use_count: current.use_count + 1 })
      .eq('id', current.id)
      .eq('use_count', current.use_count)
      .select('id');
    if (error) throw error;
    if (data?.length) return;
    current = await loadLink(admin, token);
  }
  throw new HttpError(409, 'Trop d’inscriptions en même temps. Réessayez.');
};

// Rend la place réservée si la création du compte a échoué.
const releaseLink = async (admin: any, linkId: string) => {
  for (let attempt = 0; attempt < MATRICULE_ATTEMPTS; attempt++) {
    const { data } = await admin.from('registration_links').select('use_count').eq('id', linkId).maybeSingle();
    if (!data || data.use_count <= 0) return;
    const { data: updated } = await admin
      .from('registration_links')
      .update({ use_count: data.use_count - 1 })
      .eq('id', linkId)
      .eq('use_count', data.use_count)
      .select('id');
    if (updated?.length) return;
  }
};

const registrationInfo = async (admin: any, body: any) => {
  const link = await loadLink(admin, body.token);
  const year = schoolYearCode();
  if (link.role === 'teacher') {
    return { role: link.role, label: link.label, expires_at: link.expires_at, number_prefix: `ENS-${year}` };
  }
  const { data, error } = await admin.from('levels').select('id, name, cycle, position').order('position', { ascending: true });
  if (error) throw error;
  return {
    role: link.role,
    label: link.label,
    expires_at: link.expires_at,
    levels: (data || []).map((level: { id: string; name: string; cycle: string; position: number }) => ({
      ...level,
      number_prefix: `${levelCode(level.name)}-${year}`,
    })),
  };
};

const register = async (admin: any, body: any) => {
  const token = typeof body.token === 'string' ? body.token.trim() : '';
  const link = await loadLink(admin, token);
  const password = typeof body.password === 'string' ? body.password : '';
  if (password.length < MIN_PASSWORD_LENGTH) {
    throw new HttpError(400, 'Le mot de passe doit contenir au moins 8 caractères.');
  }

  await claimLink(admin, token, link);
  let number: string;
  try {
    number = link.role === 'student'
      ? (await createStudent(admin, body, { password })).student_number
      : (await createTeacher(admin, body, { password })).teacher_number;
  } catch (error) {
    await releaseLink(admin, link.id);
    throw error;
  }

  // Prévient l'administration ; un échec ici n'annule pas l'inscription.
  try {
    await admin.rpc('notify_registration', {
      _role: link.role,
      _name: `${requiredText(body.first_name, 'prénom')} ${requiredText(body.last_name, 'nom')}`,
      _number: number,
    });
  } catch (error) {
    console.error('admin-users: notification d’inscription', error);
  }

  return { role: link.role, email: requiredEmail(body.email), number };
};

const createAdmin = async (admin: any, body: any) => {
  const role = body.role as Role;
  if (!ADMIN_ROLES.includes(role)) throw new HttpError(400, 'Rôle invalide.');

  const temporaryPassword = generateTemporaryPassword();
  const userId = await createAccount(
    admin,
    {
      email: requiredEmail(body.email),
      password: temporaryPassword,
      firstName: requiredText(body.first_name, 'prénom'),
      lastName: requiredText(body.last_name, 'nom'),
      role,
    },
    async () => {},
  );
  return { user_id: userId, temporary_password: temporaryPassword };
};

// La cible est retrouvée à partir de sa fiche : on ne fait jamais confiance à
// un user_id envoyé par le navigateur, sinon n'importe quel compte (admin
// compris) pourrait être visé.
const findMember = async (admin: any, table: 'students' | 'teachers', id: unknown) => {
  const memberId = requiredText(id, 'identifiant');
  const { data, error } = await admin.from(table).select('id, user_id').eq('id', memberId).maybeSingle();
  if (error) throw error;
  if (!data) throw new HttpError(404, 'Fiche introuvable.');
  return data as { id: string; user_id: string };
};

const deleteMember = async (
  admin: any,
  table: 'students' | 'teachers',
  role: 'student' | 'teacher',
  id: unknown,
  callerId: string,
) => {
  const member = await findMember(admin, table, id);
  if (member.user_id === callerId) throw new HttpError(400, 'Vous ne pouvez pas supprimer votre propre compte.');

  const { error: deleteError } = await admin.from(table).delete().eq('id', member.id);
  if (deleteError) throw deleteError;

  const { error: roleError } = await admin.from('user_roles').delete().eq('user_id', member.user_id).eq('role', role);
  if (roleError) throw roleError;

  // Une personne qui a aussi un autre rôle (ex. admin) garde son compte.
  const remainingRoles = await rolesOf(admin, member.user_id);
  if (remainingRoles.length > 0) return { login_deleted: false, reason: 'other_roles' };

  const { error: authError } = await admin.auth.admin.deleteUser(member.user_id);
  if (authError) {
    console.error('admin-users: suppression du compte impossible', authError);
    return { login_deleted: false, reason: 'auth_error' };
  }
  return { login_deleted: true };
};

const updateTeacherEmail = async (admin: any, body: any) => {
  const member = await findMember(admin, 'teachers', body.teacher_id);
  const email = requiredEmail(body.email);

  const { error } = await admin.auth.admin.updateUserById(member.user_id, { email, email_confirm: true });
  if (error) throw new HttpError(400, authErrorMessage(error));

  const { error: profileError } = await admin.from('profiles').update({ email }).eq('user_id', member.user_id);
  if (profileError) throw profileError;
  return { email };
};

const resetPassword = async (
  admin: any,
  table: 'students' | 'teachers',
  id: unknown,
  callerRoles: Role[],
) => {
  const member = await findMember(admin, table, id);

  // Sinon, réinitialiser la fiche d'un collègue donnerait accès à son compte admin.
  const targetRoles = await rolesOf(admin, member.user_id);
  if (targetRoles.some((role) => ADMIN_ROLES.includes(role)) && !callerRoles.includes('admin')) {
    throw new HttpError(403, 'Ce compte a un rôle d’administration : seul l’admin général peut le réinitialiser.');
  }

  const { data, error: readError } = await admin.auth.admin.getUserById(member.user_id);
  if (readError) throw new HttpError(400, authErrorMessage(readError));

  const temporaryPassword = generateTemporaryPassword();
  const { error } = await admin.auth.admin.updateUserById(member.user_id, {
    password: temporaryPassword,
    user_metadata: { ...(data?.user?.user_metadata || {}), must_change_password: true },
  });
  if (error) throw new HttpError(400, authErrorMessage(error));
  return { temporary_password: temporaryPassword };
};
