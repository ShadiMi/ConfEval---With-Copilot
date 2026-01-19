'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { authApi } from '@/lib/api';
import { useAuthStore } from '@/lib/store';
import Input from '@/components/ui/Input';
import Button from '@/components/ui/Button';
import toast from 'react-hot-toast';
import { Mail, Lock, LogIn, Home } from 'lucide-react';

declare global {
  interface Window {
    google?: any;
  }
}

export default function LoginPage() {
  const router = useRouter();
  const { login } = useAuthStore();
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState({
    email: '',
    password: '',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

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
          document.getElementById('google-signin-button'),
          { theme: 'outline', size: 'large', width: '100%', text: 'signin_with' }
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
      const authResponse = await authApi.googleAuth(response.credential);
      const { access_token } = authResponse.data;

      localStorage.setItem('token', access_token);
      const userResponse = await authApi.getMe();
      
      login(userResponse.data, access_token);
      toast.success('Welcome!');
      router.push('/dashboard');
    } catch (error: any) {
      const detail = error.response?.data?.detail;
      toast.error(typeof detail === 'string' ? detail : 'Google login failed');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});
    setIsLoading(true);

    try {
      const response = await authApi.login(formData.email, formData.password);
      const { access_token } = response.data;

      // Get user info
      localStorage.setItem('token', access_token);
      const userResponse = await authApi.getMe();
      
      login(userResponse.data, access_token);
      toast.success('Welcome back!');
      router.push('/dashboard');
    } catch (error: any) {
      const detail = error.response?.data?.detail;
      let message = 'Login failed';
      
      if (typeof detail === 'string') {
        message = detail;
      } else if (Array.isArray(detail) && detail.length > 0) {
        message = detail[0]?.msg || 'Validation error';
      }
      
      toast.error(message);
      if (typeof message === 'string' && message.toLowerCase().includes('email')) {
        setErrors({ email: message });
      } else if (typeof message === 'string' && message.toLowerCase().includes('password')) {
        setErrors({ password: message });
      }
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
          <p className="mt-2 text-slate-600">Conference Review System</p>
        </div>

        <div className="card">
          <div className="card-body">
            <h2 className="text-xl font-semibold text-slate-900 mb-6">Sign in to your account</h2>

            <form onSubmit={handleSubmit} className="space-y-4">
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

              <div className="relative">
                <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-5 h-5 mt-3" />
                <Input
                  type="password"
                  label="Password"
                  placeholder="••••••••"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  error={errors.password}
                  required
                  className="pl-10"
                />
              </div>

              <Button type="submit" className="w-full" isLoading={isLoading}>
                <LogIn className="w-4 h-4 mr-2" />
                Sign In
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

            <div id="google-signin-button" className="flex justify-center"></div>

            <div className="mt-6 text-center">
              <p className="text-sm text-slate-600">
                Don't have an account?{' '}
                <Link href="/register" className="font-medium text-primary-600 hover:text-primary-700">
                  Create one
                </Link>
              </p>
            </div>
          </div>
        </div>

        <p className="mt-4 text-center text-xs text-slate-500">
          Default admin: admin@confeval.local / Admin123!
        </p>
      </div>
    </div>
  );
}
