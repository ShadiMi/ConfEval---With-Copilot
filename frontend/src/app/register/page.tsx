'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { authApi } from '@/lib/api';
import { useAuthStore } from '@/lib/store';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import Button from '@/components/ui/Button';
import toast from 'react-hot-toast';
import { UserPlus, Mail, Lock, User, Building, Info, Upload, FileText, Home, CreditCard, Phone } from 'lucide-react';

declare global {
  interface Window {
    google?: any;
  }
}

const roleOptions = [
  { value: 'student', label: 'Student' },
  { value: 'internal_reviewer', label: 'Internal Reviewer (Faculty)' },
  { value: 'external_reviewer', label: 'External Reviewer' },
];

export default function RegisterPage() {
  const router = useRouter();
  const { login } = useAuthStore();
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    confirmPassword: '',
    full_name: '',
    role: 'student',
    affiliation: '',
    id_number: '',
    phone_number: '',
  });
  const [cvFile, setCvFile] = useState<File | null>(null);
  const cvInputRef = useRef<HTMLInputElement>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const isReviewerRole = formData.role === 'internal_reviewer' || formData.role === 'external_reviewer';

  useEffect(() => {
    // Load Google Sign-In script
    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    document.body.appendChild(script);

    script.onload = () => {
      if (window.google) {
        window.google.accounts.id.initialize({
          client_id: process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID,
          callback: handleGoogleCallback,
        });
        window.google.accounts.id.renderButton(
          document.getElementById('google-signup-button'),
          { theme: 'outline', size: 'large', width: '100%', text: 'signup_with' }
        );
      }
    };

    return () => {
      document.body.removeChild(script);
    };
  }, []);

  const handleGoogleCallback = async (response: any) => {
    setIsLoading(true);
    try {
      // For new Google users, default to student role
      const authResponse = await authApi.googleAuth(response.credential, 'student');
      const { access_token } = authResponse.data;

      localStorage.setItem('token', access_token);
      const userResponse = await authApi.getMe();
      
      login(userResponse.data, access_token);
      toast.success('Account created successfully!');
      router.push('/dashboard');
    } catch (error: any) {
      const detail = error.response?.data?.detail;
      if (detail === 'User already exists') {
        toast.error('This Google account is already registered. Please sign in instead.');
      } else {
        toast.error(typeof detail === 'string' ? detail : 'Google signup failed');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const validate = () => {
    const newErrors: Record<string, string> = {};
    
    if (!formData.id_number || !/^\d{9}$/.test(formData.id_number)) {
      newErrors.id_number = 'ID number must be exactly 9 digits';
    }
    if (formData.password.length < 8) {
      newErrors.password = 'Password must be at least 8 characters';
    }
    if (!/[A-Z]/.test(formData.password)) {
      newErrors.password = 'Password must contain at least one uppercase letter';
    }
    if (!/[a-z]/.test(formData.password)) {
      newErrors.password = 'Password must contain at least one lowercase letter';
    }
    if (!/[0-9]/.test(formData.password)) {
      newErrors.password = 'Password must contain at least one digit';
    }
    if (formData.password !== formData.confirmPassword) {
      newErrors.confirmPassword = 'Passwords do not match';
    }
    if (formData.role === 'external_reviewer') {
      if (!formData.affiliation) {
        newErrors.affiliation = 'Affiliation is required for external reviewers';
      }
      if (!cvFile) {
        newErrors.cv = 'CV is required for external reviewers';
      }
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validate()) return;
    
    setIsLoading(true);

    try {
      // Create FormData to send multipart/form-data
      const formDataToSend = new FormData();
      formDataToSend.append('email', formData.email);
      formDataToSend.append('password', formData.password);
      formDataToSend.append('full_name', formData.full_name);
      formDataToSend.append('role', formData.role);
      formDataToSend.append('id_number', formData.id_number);
      if (formData.phone_number) {
        formDataToSend.append('phone_number', formData.phone_number);
      }
      if (formData.affiliation) {
        formDataToSend.append('affiliation', formData.affiliation);
      }
      if (cvFile) {
        formDataToSend.append('cv', cvFile);
      }

      await authApi.register(formDataToSend);

      // Reviewers need approval - don't auto-login
      if (formData.role === 'internal_reviewer' || formData.role === 'external_reviewer') {
        toast.success('Account created! Your reviewer account is pending admin approval.');
        router.push('/login');
        return;
      }

      // Auto login for students
      const loginResponse = await authApi.login(formData.email, formData.password);
      const { access_token } = loginResponse.data;
      
      localStorage.setItem('token', access_token);
      const userResponse = await authApi.getMe();
      
      login(userResponse.data, access_token);
      toast.success('Account created successfully!');
      router.push('/dashboard');
    } catch (error: any) {
      const detail = error.response?.data?.detail;
      let message = 'Registration failed';
      
      if (typeof detail === 'string') {
        message = detail;
      } else if (Array.isArray(detail) && detail.length > 0) {
        message = detail[0]?.msg || 'Validation error';
      }
      
      toast.error(message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex items-center text-sm text-slate-500 hover:text-primary-600 mb-4">
            <Home className="w-4 h-4 mr-1" />
            Back to Home
          </Link>
          <h1 className="text-3xl font-bold text-primary-600">ConfEval</h1>
          <p className="mt-2 text-slate-600">Create your account</p>
        </div>

        <div className="card">
          <div className="card-body">
            <h2 className="text-xl font-semibold text-slate-900 mb-6">Register</h2>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="relative">
                <User className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-5 h-5 mt-3" />
                <Input
                  type="text"
                  label="Full Name"
                  placeholder="John Doe"
                  value={formData.full_name}
                  onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                  error={errors.full_name}
                  required
                  className="pl-10"
                />
              </div>

              <div className="relative">
                <CreditCard className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-5 h-5 mt-3" />
                <Input
                  type="text"
                  label="ID Number"
                  placeholder="123456789"
                  value={formData.id_number}
                  onChange={(e) => {
                    const value = e.target.value.replace(/\D/g, '').slice(0, 9);
                    setFormData({ ...formData, id_number: value });
                  }}
                  error={errors.id_number}
                  helperText="Your 9-digit ID card number"
                  required
                  className="pl-10"
                />
              </div>

              <div className="relative">
                <Phone className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-5 h-5 mt-3" />
                <Input
                  type="tel"
                  label="Phone Number (Optional)"
                  placeholder="+1234567890"
                  value={formData.phone_number}
                  onChange={(e) => setFormData({ ...formData, phone_number: e.target.value })}
                  error={errors.phone_number}
                  className="pl-10"
                />
              </div>

              <div className="relative">
                <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-5 h-5 mt-3" />
                <Input
                  type="email"
                  label="Email address"
                  placeholder="you@example.com"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  error={errors.email}
                  required
                  className="pl-10"
                />
              </div>

              <Select
                label="Role"
                options={roleOptions}
                value={formData.role}
                onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                required
              />

              {formData.role === 'external_reviewer' && (
                <div className="relative">
                  <Building className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-5 h-5 mt-3" />
                  <Input
                    type="text"
                    label="Affiliation"
                    placeholder="University/Organization"
                    value={formData.affiliation}
                    onChange={(e) => setFormData({ ...formData, affiliation: e.target.value })}
                    error={errors.affiliation}
                    required
                    className="pl-10"
                  />
                </div>
              )}

              {/* Reviewer approval notice */}
              {isReviewerRole && (
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                  <div className="flex items-start">
                    <Info className="w-5 h-5 text-amber-500 mr-3 mt-0.5 flex-shrink-0" />
                    <div className="text-sm text-amber-700">
                      <p className="font-medium">Reviewer Approval Required</p>
                      <p className="mt-1">
                        Reviewer accounts require admin approval before you can access the system.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* CV Upload for External Reviewers */}
              {formData.role === 'external_reviewer' && (
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    CV / Resume <span className="text-red-500">*</span>
                  </label>
                  <div className="border-2 border-dashed border-slate-300 rounded-lg p-6 text-center">
                    <input
                      type="file"
                      ref={cvInputRef}
                      className="hidden"
                      accept=".pdf,.doc,.docx"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          setCvFile(file);
                          setErrors({ ...errors, cv: '' });
                        }
                      }}
                    />
                    {cvFile ? (
                      <div className="flex items-center justify-center gap-2">
                        <FileText className="w-5 h-5 text-green-600" />
                        <span className="text-sm text-slate-700">{cvFile.name}</span>
                        <button
                          type="button"
                          onClick={() => setCvFile(null)}
                          className="text-red-500 hover:text-red-700 text-sm ml-2"
                        >
                          Remove
                        </button>
                      </div>
                    ) : (
                      <div>
                        <Upload className="w-8 h-8 text-slate-400 mx-auto mb-2" />
                        <p className="text-sm text-slate-600 mb-2">Upload your CV</p>
                        <Button
                          type="button"
                          variant="secondary"
                          size="sm"
                          onClick={() => cvInputRef.current?.click()}
                        >
                          Choose File
                        </Button>
                        <p className="text-xs text-slate-500 mt-2">PDF, DOC, or DOCX (Max 10MB)</p>
                      </div>
                    )}
                  </div>
                  {errors.cv && (
                    <p className="text-sm text-red-500 mt-1">{errors.cv}</p>
                  )}
                </div>
              )}

              <div className="relative">
                <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-5 h-5 mt-3" />
                <Input
                  type="password"
                  label="Password"
                  placeholder="••••••••"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  error={errors.password}
                  helperText="Min 8 chars with uppercase, lowercase, and digit"
                  required
                  className="pl-10"
                />
              </div>

              <div className="relative">
                <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-5 h-5 mt-3" />
                <Input
                  type="password"
                  label="Confirm Password"
                  placeholder="••••••••"
                  value={formData.confirmPassword}
                  onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                  error={errors.confirmPassword}
                  required
                  className="pl-10"
                />
              </div>

              <Button type="submit" className="w-full" isLoading={isLoading}>
                <UserPlus className="w-4 h-4 mr-2" />
                Create Account
              </Button>
            </form>

            <div className="relative my-6">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-slate-200"></div>
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-2 bg-white text-slate-500">Or continue with</span>
              </div>
            </div>

            <div id="google-signup-button" className="flex justify-center"></div>
            <p className="text-xs text-slate-500 text-center mt-2">Google signup will create a student account</p>

            <div className="mt-6 text-center">
              <p className="text-sm text-slate-600">
                Already have an account?{' '}
                <Link href="/login" className="font-medium text-primary-600 hover:text-primary-700">
                  Sign in
                </Link>
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
