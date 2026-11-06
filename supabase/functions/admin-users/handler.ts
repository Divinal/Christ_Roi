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
  | 'reset_teacher_password';

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

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

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
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS });
  if (req.method !== 'POST') return json({ error: 'Méthode non autorisée.' }, 405);

  try {
    const token = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '');
    if (!token) throw new HttpError(401, 'Connexion requise.');

    const { data: authData, error: authError } = await admin.auth.getUser(token);
    const caller = authData?.user;
    if (authError || !caller) throw new HttpError(401, 'Session invalide ou expirée. Reconnectez-vous.');

    let body: any;
    try {
      body = await req.json();
    } catch {
      throw new HttpError(400, 'Requête invalide.');
    }

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
  account: { email: string; password: string; firstName: string; lastName: string; phone?: string | null; role: Role },
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
      must_change_password: true,
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

const createStudent = async (admin: any, body: any) => {
  const email = requiredEmail(body.email);
  const studentNumber = requiredText(body.student_number, 'matricule');
  const phone = optionalText(body.phone);
  const temporaryPassword = generateTemporaryPassword();

  const userId = await createAccount(
    admin,
    {
      email,
      password: temporaryPassword,
      firstName: requiredText(body.first_name, 'prénom'),
      lastName: requiredText(body.last_name, 'nom'),
      phone,
      role: 'student',
    },
    (id) =>
      insertOrFail(admin, 'students', {
        user_id: id,
        student_number: studentNumber,
        level_id: optionalText(body.level_id),
        date_of_birth: optionalText(body.date_of_birth),
        address: optionalText(body.address),
        parent_phone: phone,
        status: 'active',
      }, 'matricule'),
  );
  return { user_id: userId, temporary_password: temporaryPassword };
};

const createTeacher = async (admin: any, body: any) => {
  const email = requiredEmail(body.email);
  const teacherNumber = requiredText(body.teacher_number, 'matricule');
  const phone = optionalText(body.phone);
  const temporaryPassword = generateTemporaryPassword();

  const userId = await createAccount(
    admin,
    {
      email,
      password: temporaryPassword,
      firstName: requiredText(body.first_name, 'prénom'),
      lastName: requiredText(body.last_name, 'nom'),
      phone,
      role: 'teacher',
    },
    (id) =>
      insertOrFail(admin, 'teachers', {
        user_id: id,
        teacher_number: teacherNumber,
        phone,
        specialization: optionalText(body.specialization),
        department: optionalText(body.department),
      }, 'matricule'),
  );
  return { user_id: userId, temporary_password: temporaryPassword };
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
