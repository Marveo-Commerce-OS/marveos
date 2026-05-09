'use client';

import { useState, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import {
  checkConnectorStatus,
  initializeAdmin,
  getErrorMessage,
} from '@/src/services/marveoConnector';

interface FormData {
  siteUrl: string;
  activationToken: string;
  username: string;
  email: string;
  password: string;
  confirmPassword: string;
}

interface FormError {
  field?: string;
  message: string;
}

type SetupStep = 'form' | 'checking' | 'success' | 'error';

export default function SetupActivatePage() {
  const router = useRouter();
  const [step, setStep] = useState<SetupStep>('form');
  const [formData, setFormData] = useState<FormData>({
    siteUrl: '',
    activationToken: '',
    username: '',
    email: '',
    password: '',
    confirmPassword: '',
  });
  const [errors, setErrors] = useState<FormError[]>([]);
  const [successData, setSuccessData] = useState<any>(null);
  const [errorData, setErrorData] = useState<any>(null);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
    // Clear errors for this field
    setErrors((prev) => prev.filter((err) => err.field !== name));
  };

  const validateForm = (): boolean => {
    const newErrors: FormError[] = [];

    if (!formData.siteUrl.trim()) {
      newErrors.push({ field: 'siteUrl', message: 'WordPress site URL is required' });
    }

    if (!formData.activationToken.trim()) {
      newErrors.push({ field: 'activationToken', message: 'Activation token is required' });
    }

    if (!formData.username.trim()) {
      newErrors.push({ field: 'username', message: 'Admin username is required' });
    } else if (formData.username.length < 3) {
      newErrors.push({ field: 'username', message: 'Username must be at least 3 characters' });
    }

    if (!formData.email.trim()) {
      newErrors.push({ field: 'email', message: 'Email is required' });
    } else if (!isValidEmail(formData.email)) {
      newErrors.push({ field: 'email', message: 'Please enter a valid email address' });
    }

    if (!formData.password) {
      newErrors.push({ field: 'password', message: 'Password is required' });
    } else if (formData.password.length < 8) {
      newErrors.push({ field: 'password', message: 'Password must be at least 8 characters' });
    }

    if (formData.password !== formData.confirmPassword) {
      newErrors.push({ field: 'confirmPassword', message: 'Passwords do not match' });
    }

    setErrors(newErrors);
    return newErrors.length === 0;
  };

  const isValidEmail = (email: string): boolean => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    setStep('checking');
    setErrors([]);

    try {
      // Step 1: Check connector status
      const statusResult = await checkConnectorStatus(formData.siteUrl);

      if ('code' in statusResult) {
        // Error checking status
        setErrorData(statusResult);
        setStep('error');
        return;
      }

      // Step 2: Verify connector is in correct state
      if (statusResult.first_admin_created) {
        setErrorData({
          code: 'admin_exists',
          message: 'The first admin user has already been created for this site.',
        });
        setStep('error');
        return;
      }

      // Step 3: Initialize admin
      const initResult = await initializeAdmin(formData.siteUrl, formData.activationToken, {
        username: formData.username,
        email: formData.email,
        password: formData.password,
      });

      if ('code' in initResult) {
        // Error initializing
        setErrorData(initResult);
        setStep('error');
        return;
      }

      // Success!
      setSuccessData({
        userId: initResult.user_id,
        siteUrl: formData.siteUrl,
        siteName: statusResult.site_id,
      });
      setStep('success');
    } catch (err) {
      setErrorData({
        code: 'unknown_error',
        message: 'An unexpected error occurred. Please try again.',
      });
      setStep('error');
    }
  };

  const handleRetry = () => {
    setStep('form');
    setErrors([]);
    setErrorData(null);
  };

  const handleContinue = () => {
    router.push('/dashboard');
  };

  if (step === 'success') {
    return <SuccessState data={successData} onContinue={handleContinue} />;
  }

  if (step === 'error') {
    return <ErrorState error={errorData} onRetry={handleRetry} />;
  }

  return (
    <FormState
      formData={formData}
      errors={errors}
      isLoading={step === 'checking'}
      onSubmit={handleSubmit}
      onChange={handleInputChange}
    />
  );
}

/**
 * Form state component
 */
function FormState({
  formData,
  errors,
  isLoading,
  onSubmit,
  onChange,
}: {
  formData: FormData;
  errors: FormError[];
  isLoading: boolean;
  onSubmit: (e: FormEvent<HTMLFormElement>) => Promise<void>;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
}) {
  const getFieldError = (field: string) => errors.find((err) => err.field === field);

  return (
    <div className="flex items-center justify-center min-h-screen px-4 py-12">
      <div className="w-full max-w-md bg-white rounded-lg shadow-lg p-8">
        {/* Header */}
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Connect Your Store</h1>
          <p className="text-gray-600">Link your WordPress store to Marvéo</p>
        </div>

        {/* General Error Alert */}
        {errors.length > 0 && !errors[0].field && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-sm text-red-700">{errors[0].message}</p>
          </div>
        )}

        {/* Form */}
        <form onSubmit={onSubmit} className="space-y-5">
          {/* WordPress Site URL */}
          <div>
            <label htmlFor="siteUrl" className="block text-sm font-medium text-gray-700 mb-1">
              WordPress Site URL
            </label>
            <input
              type="url"
              id="siteUrl"
              name="siteUrl"
              value={formData.siteUrl}
              onChange={onChange}
              placeholder="https://example.com"
              disabled={isLoading}
              className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition ${
                getFieldError('siteUrl')
                  ? 'border-red-500 bg-red-50'
                  : 'border-gray-300 bg-white'
              } ${isLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
            />
            {getFieldError('siteUrl') && (
              <p className="mt-1 text-sm text-red-600">{getFieldError('siteUrl')?.message}</p>
            )}
            <p className="mt-1 text-xs text-gray-500">
              The URL where your WordPress store is hosted
            </p>
          </div>

          {/* Activation Token */}
          <div>
            <label htmlFor="activationToken" className="block text-sm font-medium text-gray-700 mb-1">
              Activation Token
            </label>
            <input
              type="text"
              id="activationToken"
              name="activationToken"
              value={formData.activationToken}
              onChange={onChange}
              placeholder="Paste your 32-character token"
              disabled={isLoading}
              className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition font-mono text-sm ${
                getFieldError('activationToken')
                  ? 'border-red-500 bg-red-50'
                  : 'border-gray-300 bg-white'
              } ${isLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
            />
            {getFieldError('activationToken') && (
              <p className="mt-1 text-sm text-red-600">{getFieldError('activationToken')?.message}</p>
            )}
            <p className="mt-1 text-xs text-gray-500">
              Found in WordPress admin → Marvéo → Activation Token
            </p>
          </div>

          {/* Admin Username */}
          <div>
            <label htmlFor="username" className="block text-sm font-medium text-gray-700 mb-1">
              Admin Username
            </label>
            <input
              type="text"
              id="username"
              name="username"
              value={formData.username}
              onChange={onChange}
              placeholder="e.g., marveo_admin"
              disabled={isLoading}
              className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition ${
                getFieldError('username')
                  ? 'border-red-500 bg-red-50'
                  : 'border-gray-300 bg-white'
              } ${isLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
            />
            {getFieldError('username') && (
              <p className="mt-1 text-sm text-red-600">{getFieldError('username')?.message}</p>
            )}
          </div>

          {/* Admin Email */}
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
              Admin Email
            </label>
            <input
              type="email"
              id="email"
              name="email"
              value={formData.email}
              onChange={onChange}
              placeholder="admin@example.com"
              disabled={isLoading}
              className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition ${
                getFieldError('email')
                  ? 'border-red-500 bg-red-50'
                  : 'border-gray-300 bg-white'
              } ${isLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
            />
            {getFieldError('email') && (
              <p className="mt-1 text-sm text-red-600">{getFieldError('email')?.message}</p>
            )}
          </div>

          {/* Password */}
          <div>
            <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
              Password
            </label>
            <input
              type="password"
              id="password"
              name="password"
              value={formData.password}
              onChange={onChange}
              placeholder="••••••••"
              disabled={isLoading}
              className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition ${
                getFieldError('password')
                  ? 'border-red-500 bg-red-50'
                  : 'border-gray-300 bg-white'
              } ${isLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
            />
            {getFieldError('password') && (
              <p className="mt-1 text-sm text-red-600">{getFieldError('password')?.message}</p>
            )}
            <p className="mt-1 text-xs text-gray-500">Minimum 8 characters</p>
          </div>

          {/* Confirm Password */}
          <div>
            <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 mb-1">
              Confirm Password
            </label>
            <input
              type="password"
              id="confirmPassword"
              name="confirmPassword"
              value={formData.confirmPassword}
              onChange={onChange}
              placeholder="••••••••"
              disabled={isLoading}
              className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition ${
                getFieldError('confirmPassword')
                  ? 'border-red-500 bg-red-50'
                  : 'border-gray-300 bg-white'
              } ${isLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
            />
            {getFieldError('confirmPassword') && (
              <p className="mt-1 text-sm text-red-600">{getFieldError('confirmPassword')?.message}</p>
            )}
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={isLoading}
            className="w-full mt-8 px-4 py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
          >
            {isLoading ? (
              <>
                <svg className="animate-spin -ml-1 mr-3 h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Setting up connection...
              </>
            ) : (
              'Connect to Marvéo'
            )}
          </button>
        </form>

        {/* Help Text */}
        <div className="mt-8 p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <p className="text-sm text-blue-900">
            <strong>Need help?</strong> Make sure you have:{' '}
            <ul className="list-disc list-inside mt-2 text-xs">
              <li>Marvéo Connector plugin installed on WordPress</li>
              <li>Activation token from WordPress admin</li>
              <li>WordPress site accessible over HTTPS</li>
            </ul>
          </p>
        </div>
      </div>
    </div>
  );
}

/**
 * Success state component
 */
function SuccessState({
  data,
  onContinue,
}: {
  data: any;
  onContinue: () => void;
}) {
  return (
    <div className="flex items-center justify-center min-h-screen px-4 py-12">
      <div className="w-full max-w-md bg-white rounded-lg shadow-lg p-8 text-center">
        {/* Success Icon */}
        <div className="mb-6 flex justify-center">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center">
            <svg
              className="w-8 h-8 text-green-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M5 13l4 4L19 7"
              />
            </svg>
          </div>
        </div>

        <h1 className="text-2xl font-bold text-gray-900 mb-2">Connection Successful!</h1>
        <p className="text-gray-600 mb-6">
          Your WordPress store has been connected to Marvéo. Admin user created successfully.
        </p>

        {/* Connection Details */}
        <div className="mb-8 p-4 bg-gray-50 rounded-lg text-left">
          <div className="mb-3">
            <p className="text-xs text-gray-600 uppercase tracking-wide font-semibold">User ID</p>
            <p className="text-lg font-mono text-gray-900">{data.userId}</p>
          </div>
          <div>
            <p className="text-xs text-gray-600 uppercase tracking-wide font-semibold">Site ID</p>
            <p className="text-lg font-mono text-gray-900">{data.siteName}</p>
          </div>
        </div>

        {/* Continue Button */}
        <button
          onClick={onContinue}
          className="w-full px-4 py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition"
        >
          Go to Dashboard
        </button>

        {/* Next Steps */}
        <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg text-left">
          <p className="text-sm font-semibold text-blue-900 mb-2">Next Steps:</p>
          <ul className="text-xs text-blue-800 space-y-1">
            <li>✓ Enable data sync in settings</li>
            <li>✓ Configure WooCommerce integration</li>
            <li>✓ Set up user and order synchronization</li>
          </ul>
        </div>
      </div>
    </div>
  );
}

/**
 * Error state component
 */
function ErrorState({
  error,
  onRetry,
}: {
  error: any;
  onRetry: () => void;
}) {
  const friendlyMessage = getErrorMessage(error);

  return (
    <div className="flex items-center justify-center min-h-screen px-4 py-12">
      <div className="w-full max-w-md bg-white rounded-lg shadow-lg p-8 text-center">
        {/* Error Icon */}
        <div className="mb-6 flex justify-center">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center">
            <svg
              className="w-8 h-8 text-red-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </div>
        </div>

        <h1 className="text-2xl font-bold text-gray-900 mb-2">Connection Failed</h1>
        <p className="text-gray-600 mb-6">{friendlyMessage}</p>

        {/* Error Details */}
        {error.details && (
          <div className="mb-6 p-3 bg-red-50 border border-red-200 rounded-lg text-left">
            <p className="text-xs text-gray-600 font-semibold mb-1">Technical Details:</p>
            <p className="text-xs text-red-700 font-mono break-all">{error.details}</p>
          </div>
        )}

        {/* Error Code */}
        <div className="mb-6 p-3 bg-gray-50 rounded-lg">
          <p className="text-xs text-gray-600">Error Code: <span className="font-mono font-semibold">{error.code}</span></p>
        </div>

        {/* Retry Button */}
        <button
          onClick={onRetry}
          className="w-full px-4 py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition mb-3"
        >
          Try Again
        </button>

        {/* Troubleshooting */}
        <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg text-left">
          <p className="text-sm font-semibold text-amber-900 mb-2">Troubleshooting:</p>
          <ul className="text-xs text-amber-800 space-y-2">
            <li>
              <strong>Network error?</strong> Verify the WordPress URL is correct and accessible
            </li>
            <li>
              <strong>Plugin not found?</strong> Make sure Marvéo Connector is installed and activated
            </li>
            <li>
              <strong>Token expired?</strong> Regenerate in WordPress admin → Marvéo
            </li>
            <li>
              <strong>Still stuck?</strong> Check the setup documentation
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}
