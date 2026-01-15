'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAdminAuth } from '@/lib/frontend/contexts/admin-auth-context';
import { IoLockClosedOutline, IoMailOutline, IoEyeOutline, IoEyeOffOutline } from 'react-icons/io5';
import Image from 'next/image';

export default function AdminLoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const { signIn, isAuthenticated, loading } = useAdminAuth();
  const router = useRouter();

  useEffect(() => {
    // Redirect if already authenticated
    if (!loading && isAuthenticated) {
      router.push('/admin');
    }
  }, [isAuthenticated, loading, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      const { error: signInError } = await signIn(email, password);
      
      if (signInError) {
        setError(signInError.message || 'Invalid email or password');
      } else {
        router.push('/admin');
      }
    } catch (err: any) {
      setError(err.message || 'An error occurred during sign in');
    } finally {
      setIsLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#010501] flex items-center justify-center">
        <div className="text-center">
          <p className="text-[#b5b5b5]">Loading...</p>
        </div>
      </div>
    );
  }

  if (isAuthenticated) {
    return null; // Will redirect
  }

  return (
    <div className="min-h-screen bg-[#010501] flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="flex justify-center mb-8">
          <div className="h-12 w-12 relative">
            <Image
              src="/assets/logos/tiwi-logo.svg"
              alt="TIWI Logo"
              width={48}
              height={48}
              className="object-contain w-full h-full"
            />
          </div>
        </div>

        {/* Login Card */}
        <div className="bg-[#121712] border border-[#1f261e] rounded-xl p-8">
          <h1 className="text-2xl font-semibold text-white mb-2 text-center">
            Admin Sign In
          </h1>
          <p className="text-[#b5b5b5] text-sm text-center mb-6">
            Enter your credentials to access the admin dashboard
          </p>

          {error && (
            <div className="mb-4 p-3 bg-[#2a1f1f] border border-[#ff5c5c] rounded-lg">
              <p className="text-[#ff5c5c] text-sm">{error}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Email Input */}
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-[#b5b5b5] mb-2">
                Email
              </label>
              <div className="relative">
                <IoMailOutline className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-[#7c7c7c]" />
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="w-full bg-[#0b0f0a] border border-[#1f261e] rounded-lg pl-10 pr-4 py-3 text-white placeholder-[#7c7c7c] focus:outline-none focus:border-[#b1f128] transition-colors"
                  placeholder="admin@tiwiprotocol.com"
                  disabled={isLoading}
                />
              </div>
            </div>

            {/* Password Input */}
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-[#b5b5b5] mb-2">
                Password
              </label>
              <div className="relative">
                <IoLockClosedOutline className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-[#7c7c7c]" />
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="w-full bg-[#0b0f0a] border border-[#1f261e] rounded-lg pl-10 pr-12 py-3 text-white placeholder-[#7c7c7c] focus:outline-none focus:border-[#b1f128] transition-colors"
                  placeholder="Enter your password"
                  disabled={isLoading}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[#7c7c7c] hover:text-[#b5b5b5] transition-colors focus:outline-none"
                  tabIndex={-1}
                  disabled={isLoading}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? (
                    <IoEyeOffOutline className="w-5 h-5" />
                  ) : (
                    <IoEyeOutline className="w-5 h-5" />
                  )}
                </button>
              </div>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isLoading}
              className="w-full bg-[#b1f128] text-[#010501] font-semibold py-3 rounded-lg hover:bg-[#9dd120] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? 'Signing in...' : 'Sign In'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

