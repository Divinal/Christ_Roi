-- Create app_role enum for user roles
CREATE TYPE public.app_role AS ENUM ('admin', 'teacher', 'student');

-- Create user_roles table for role management (security best practice)
CREATE TABLE public.user_roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    role app_role NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    UNIQUE (user_id, role)
);

-- Create profiles table
CREATE TABLE public.profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
    email TEXT NOT NULL,
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    photo_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create classes table
CREATE TABLE public.classes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    level TEXT NOT NULL,
    academic_year TEXT NOT NULL,
    max_students INTEGER DEFAULT 30,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create subjects table
CREATE TABLE public.subjects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    code TEXT NOT NULL UNIQUE,
    description TEXT,
    coefficient NUMERIC(3,1) DEFAULT 1.0,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create students table
CREATE TABLE public.students (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
    student_number TEXT NOT NULL UNIQUE,
    class_id UUID REFERENCES public.classes(id) ON DELETE SET NULL,
    date_of_birth DATE,
    address TEXT,
    parent_phone TEXT,
    enrollment_date DATE NOT NULL DEFAULT CURRENT_DATE,
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'suspended')),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create teachers table
CREATE TABLE public.teachers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
    teacher_number TEXT NOT NULL UNIQUE,
    specialization TEXT,
    department TEXT,
    hire_date DATE DEFAULT CURRENT_DATE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create teacher_subjects junction table (teachers can teach multiple subjects)
CREATE TABLE public.teacher_subjects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    teacher_id UUID REFERENCES public.teachers(id) ON DELETE CASCADE NOT NULL,
    subject_id UUID REFERENCES public.subjects(id) ON DELETE CASCADE NOT NULL,
    UNIQUE (teacher_id, subject_id)
);

-- Create teacher_classes junction table (teachers can teach in multiple classes)
CREATE TABLE public.teacher_classes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    teacher_id UUID REFERENCES public.teachers(id) ON DELETE CASCADE NOT NULL,
    class_id UUID REFERENCES public.classes(id) ON DELETE CASCADE NOT NULL,
    subject_id UUID REFERENCES public.subjects(id) ON DELETE CASCADE NOT NULL,
    UNIQUE (teacher_id, class_id, subject_id)
);

-- Create schedules table
CREATE TABLE public.schedules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    class_id UUID REFERENCES public.classes(id) ON DELETE CASCADE NOT NULL,
    subject_id UUID REFERENCES public.subjects(id) ON DELETE CASCADE NOT NULL,
    teacher_id UUID REFERENCES public.teachers(id) ON DELETE SET NULL,
    day_of_week INTEGER NOT NULL CHECK (day_of_week BETWEEN 1 AND 7),
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    room TEXT,
    academic_year TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create grades table
CREATE TABLE public.grades (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id UUID REFERENCES public.students(id) ON DELETE CASCADE NOT NULL,
    subject_id UUID REFERENCES public.subjects(id) ON DELETE CASCADE NOT NULL,
    teacher_id UUID REFERENCES public.teachers(id) ON DELETE SET NULL,
    class_id UUID REFERENCES public.classes(id) ON DELETE CASCADE NOT NULL,
    grade_value NUMERIC(4,2) NOT NULL CHECK (grade_value >= 0 AND grade_value <= 20),
    grade_type TEXT NOT NULL,
    coefficient NUMERIC(3,1) DEFAULT 1.0,
    exam_date DATE,
    comment TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create courses table (for PDF uploads)
CREATE TABLE public.courses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    description TEXT,
    subject_id UUID REFERENCES public.subjects(id) ON DELETE CASCADE NOT NULL,
    teacher_id UUID REFERENCES public.teachers(id) ON DELETE SET NULL,
    class_id UUID REFERENCES public.classes(id) ON DELETE CASCADE,
    level TEXT,
    file_url TEXT,
    file_name TEXT,
    file_size INTEGER,
    is_published BOOLEAN DEFAULT false,
    approved_by UUID REFERENCES auth.users(id),
    approved_at TIMESTAMP WITH TIME ZONE,
    uploaded_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create messages table
CREATE TABLE public.messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sender_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    recipient_type TEXT NOT NULL CHECK (recipient_type IN ('individual', 'class', 'all_students', 'all_teachers', 'all')),
    recipient_id UUID,
    subject TEXT NOT NULL,
    content TEXT NOT NULL,
    is_read BOOLEAN DEFAULT false,
    sent_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on all tables
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.classes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subjects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.students ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.teachers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.teacher_subjects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.teacher_classes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.grades ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.courses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

-- Create security definer function to check roles (prevents infinite recursion)
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- Create function to get user's role
CREATE OR REPLACE FUNCTION public.get_user_role(_user_id UUID)
RETURNS app_role
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role
  FROM public.user_roles
  WHERE user_id = _user_id
  LIMIT 1
$$;

-- RLS Policies for user_roles
CREATE POLICY "Users can view their own role" ON public.user_roles
FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Admins can manage all roles" ON public.user_roles
FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- RLS Policies for profiles
CREATE POLICY "Users can view all profiles" ON public.profiles
FOR SELECT TO authenticated USING (true);

CREATE POLICY "Users can update their own profile" ON public.profiles
FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own profile" ON public.profiles
FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can manage all profiles" ON public.profiles
FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- RLS Policies for classes
CREATE POLICY "Everyone can view classes" ON public.classes
FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins can manage classes" ON public.classes
FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- RLS Policies for subjects
CREATE POLICY "Everyone can view subjects" ON public.subjects
FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins can manage subjects" ON public.subjects
FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- RLS Policies for students
CREATE POLICY "Students can view their own data" ON public.students
FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Teachers can view students in their classes" ON public.students
FOR SELECT USING (
  public.has_role(auth.uid(), 'teacher') AND
  class_id IN (
    SELECT tc.class_id FROM public.teacher_classes tc
    JOIN public.teachers t ON t.id = tc.teacher_id
    WHERE t.user_id = auth.uid()
  )
);

CREATE POLICY "Admins can manage all students" ON public.students
FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- RLS Policies for teachers
CREATE POLICY "Teachers can view their own data" ON public.teachers
FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Everyone can view teachers" ON public.teachers
FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins can manage all teachers" ON public.teachers
FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- RLS Policies for teacher_subjects
CREATE POLICY "Everyone can view teacher subjects" ON public.teacher_subjects
FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins can manage teacher subjects" ON public.teacher_subjects
FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- RLS Policies for teacher_classes
CREATE POLICY "Everyone can view teacher classes" ON public.teacher_classes
FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins can manage teacher classes" ON public.teacher_classes
FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- RLS Policies for schedules
CREATE POLICY "Everyone can view schedules" ON public.schedules
FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins can manage schedules" ON public.schedules
FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- RLS Policies for grades
CREATE POLICY "Students can view their own grades" ON public.grades
FOR SELECT USING (
  student_id IN (
    SELECT id FROM public.students WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Teachers can manage grades for their classes" ON public.grades
FOR ALL USING (
  public.has_role(auth.uid(), 'teacher') AND
  teacher_id IN (
    SELECT id FROM public.teachers WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Admins can manage all grades" ON public.grades
FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- RLS Policies for courses
CREATE POLICY "Students can view published courses for their class" ON public.courses
FOR SELECT USING (
  is_published = true AND (
    class_id IN (SELECT class_id FROM public.students WHERE user_id = auth.uid()) OR
    level IN (SELECT c.level FROM public.classes c JOIN public.students s ON s.class_id = c.id WHERE s.user_id = auth.uid())
  )
);

CREATE POLICY "Teachers can manage their own courses" ON public.courses
FOR ALL USING (
  teacher_id IN (SELECT id FROM public.teachers WHERE user_id = auth.uid())
);

CREATE POLICY "Admins can manage all courses" ON public.courses
FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- RLS Policies for messages
CREATE POLICY "Users can view messages sent to them" ON public.messages
FOR SELECT USING (
  recipient_id = auth.uid() OR
  (recipient_type = 'all') OR
  (recipient_type = 'all_students' AND public.has_role(auth.uid(), 'student')) OR
  (recipient_type = 'all_teachers' AND public.has_role(auth.uid(), 'teacher')) OR
  sender_id = auth.uid()
);

CREATE POLICY "Authenticated users can send messages" ON public.messages
FOR INSERT TO authenticated WITH CHECK (sender_id = auth.uid());

CREATE POLICY "Users can update their received messages" ON public.messages
FOR UPDATE USING (recipient_id = auth.uid());

CREATE POLICY "Admins can manage all messages" ON public.messages
FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Create trigger for profiles
CREATE TRIGGER update_profiles_updated_at
BEFORE UPDATE ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create function to handle new user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (user_id, email, first_name, last_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'first_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'last_name', '')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create trigger for new user signup
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Politique 1 : Lecture publique des PDF
CREATE POLICY "Public can read PDFs"
ON storage.objects 
FOR SELECT
TO public
USING (bucket_id = 'courses');

-- Politique 2 : Upload pour enseignants
CREATE POLICY "Teachers can upload PDFs"
ON storage.objects 
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'courses'
  AND auth.uid() IN (SELECT user_id FROM teachers)
);

-- Politique 3 : Suppression pour enseignants
CREATE POLICY "Teachers can delete PDFs"
ON storage.objects 
FOR DELETE
TO authenticated
USING (
  bucket_id = 'courses'
  AND auth.uid() IN (SELECT user_id FROM teachers)
);
