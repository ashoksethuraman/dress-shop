import React, { useState } from 'react';
import { FiUser, FiMail, FiLock, FiPhone, FiCalendar, FiMapPin, FiEye, FiEyeOff } from 'react-icons/fi';
import { useNavigate, Link } from 'react-router-dom';
import { useAppDispatch } from '../store/hooks';
import { setUser } from '../store/userSlice';
import { authApi } from '../services/apiClient';
import { authService } from '../services/authService';
import Alert, { AlertType } from '../components/Alert';

interface AlertState { type: AlertType; message: string; }

interface FormState {
  username: string;
  email: string;
  password: string;
  confirmPassword: string;
  age: string;
  gender: '' | 'male' | 'female';
  mobileNumber: string;
  address: string;
}

interface FormErrors {
  username?: string;
  email?: string;
  password?: string;
  confirmPassword?: string;
  age?: string;
  gender?: string;
  mobileNumber?: string;
}

const STRONG_PASSWORD_RE =
  /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()\-_=+[\]{};':"\\|,.<>/?]).{8,}$/;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_RE = /^\+?[0-9]{10,15}$/;

function validate(form: FormState): FormErrors {
  const errors: FormErrors = {};

  if (!form.username.trim()) {
    errors.username = 'Username is required.';
  } else if (form.username.trim().length < 2 || form.username.trim().length > 50) {
    errors.username = 'Username must be 2–50 characters.';
  }

  if (!form.email.trim()) {
    errors.email = 'Email is required.';
  } else if (!EMAIL_RE.test(form.email)) {
    errors.email = 'Please enter a valid email address.';
  }

  if (!form.password) {
    errors.password = 'Password is required.';
  } else if (!STRONG_PASSWORD_RE.test(form.password)) {
    errors.password =
      'Min 8 chars with uppercase, lowercase, digit, and special character.';
  }

  if (!form.confirmPassword) {
    errors.confirmPassword = 'Please confirm your password.';
  } else if (form.password !== form.confirmPassword) {
    errors.confirmPassword = 'Passwords do not match.';
  }

  const ageNum = parseInt(form.age, 10);
  if (!form.age.trim()) {
    errors.age = 'Age is required.';
  } else if (isNaN(ageNum) || ageNum < 13 || ageNum > 120) {
    errors.age = 'Age must be between 13 and 120.';
  }

  if (!form.gender) {
    errors.gender = 'Please select your gender.';
  }

  if (!form.mobileNumber.trim()) {
    errors.mobileNumber = 'Mobile number is required.';
  } else if (!PHONE_RE.test(form.mobileNumber.trim())) {
    errors.mobileNumber = 'Enter a valid number (10–15 digits, optional + prefix).';
  }

  return errors;
}

export default function SignupPage() {
  const navigate = useNavigate();
  const dispatch = useAppDispatch();

  const [form, setForm] = useState<FormState>({
    username: '', email: '', password: '', confirmPassword: '',
    age: '', gender: '', mobileNumber: '', address: '',
  });
  const [errors, setErrors] = useState<FormErrors>({});
  const [touched, setTouched] = useState<Partial<Record<keyof FormState, boolean>>>({});
  const [showPwd, setShowPwd] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [alert, setAlert] = useState<AlertState | null>(null);

  const handleChange = (field: keyof FormState, value: string) => {
    setForm((f) => ({ ...f, [field]: value }));
    if (touched[field]) {
      const errs = validate({ ...form, [field]: value });
      setErrors((e) => ({ ...e, [field]: errs[field as keyof FormErrors] }));
    }
  };

  const handleBlur = (field: keyof FormState) => {
    setTouched((t) => ({ ...t, [field]: true }));
    const errs = validate(form);
    setErrors((e) => ({ ...e, [field]: errs[field as keyof FormErrors] }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setTouched({
      username: true, email: true, password: true, confirmPassword: true,
      age: true, gender: true, mobileNumber: true,
    });
    const errs = validate(form);
    setErrors(errs);
    if (Object.keys(errs).length > 0) return;

    setAlert(null);
    setLoading(true);
    try {
      const response = await authApi.signup({
        username:     form.username.trim(),
        email:        form.email.trim(),
        password:     form.password,
        age:          parseInt(form.age, 10),
        gender:       form.gender as 'male' | 'female',
        mobileNumber: form.mobileNumber.trim(),
        ...(form.address.trim() ? { address: form.address.trim() } : {}),
      });

      // Store the custom JWT — no Firebase Auth dependency
      authService.setCustomJwt(response.token);

      dispatch(setUser({
        id:      response.user.uid,
        name:    response.user.username || form.email,
        isGuest: false,
        isAdmin: response.user.role === 'admin',
      }));

      navigate('/', { replace: true });
    } catch (err: any) {
      const message =
        err?.body?.error ?? err?.message ?? 'Signup failed. Please try again.';
      setAlert({ type: 'error', message });
    } finally {
      setLoading(false);
    }
  };

  const field = (
    id: keyof FormState,
    label: string,
    type: string,
    placeholder: string,
    icon: React.ReactNode,
    extra?: React.ReactNode,
  ) => (
    <div>
      <label className="block text-xs font-semibold text-gray-600 mb-1 uppercase tracking-wide">
        {label}
      </label>
      <div className={`flex items-center border rounded-xl bg-gray-50 focus-within:ring-2 transition-all ${
        errors[id as keyof FormErrors]
          ? 'border-red-400 focus-within:border-red-400 focus-within:ring-red-100'
          : 'border-gray-200 focus-within:border-indigo-400 focus-within:ring-indigo-100'
      }`}>
        <span className="pl-3 text-gray-400 shrink-0">{icon}</span>
        <input
          id={id}
          type={type}
          placeholder={placeholder}
          value={form[id]}
          onChange={(e) => handleChange(id, e.target.value)}
          onBlur={() => handleBlur(id)}
          disabled={loading}
          className="flex-1 bg-transparent px-3 py-2.5 text-sm outline-none text-gray-800 placeholder-gray-400"
        />
        {extra}
      </div>
      {errors[id as keyof FormErrors] && (
        <p className="text-xs text-red-500 mt-1 ml-1">{errors[id as keyof FormErrors]}</p>
      )}
    </div>
  );

  return (
    <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center bg-gradient-to-br from-indigo-50 to-slate-100 px-4 py-10">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-lg p-8">
        <h1 className="text-2xl font-extrabold text-primary text-center mb-1 tracking-tight">
          Create Account
        </h1>
        <p className="text-center text-sm text-gray-500 mb-6">
          Already have an account?{' '}
          <Link to="/auth" className="text-indigo-500 font-semibold hover:underline">
            Login
          </Link>
        </p>

        {alert && (
          <Alert type={alert.type} message={alert.message} onClose={() => setAlert(null)} />
        )}

        <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
          {/* Username */}
          {field('username', 'Username *', 'text', 'John Doe', <FiUser size={16} />)}

          {/* Email */}
          {field('email', 'Email *', 'email', 'you@example.com', <FiMail size={16} />)}

          {/* Password */}
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1 uppercase tracking-wide">
              Password *
            </label>
            <div className={`flex items-center border rounded-xl bg-gray-50 focus-within:ring-2 transition-all ${
              errors.password
                ? 'border-red-400 focus-within:ring-red-100'
                : 'border-gray-200 focus-within:border-indigo-400 focus-within:ring-indigo-100'
            }`}>
              <span className="pl-3 text-gray-400 shrink-0"><FiLock size={16} /></span>
              <input
                type={showPwd ? 'text' : 'password'}
                placeholder="Min 8 chars, uppercase, digit, symbol"
                value={form.password}
                onChange={(e) => handleChange('password', e.target.value)}
                onBlur={() => handleBlur('password')}
                disabled={loading}
                className="flex-1 bg-transparent px-3 py-2.5 text-sm outline-none text-gray-800 placeholder-gray-400"
              />
              <button
                type="button"
                tabIndex={-1}
                onClick={() => setShowPwd((v) => !v)}
                className="pr-3 text-gray-400 hover:text-gray-600 border-none bg-transparent cursor-pointer"
              >
                {showPwd ? <FiEyeOff size={16} /> : <FiEye size={16} />}
              </button>
            </div>
            {errors.password && (
              <p className="text-xs text-red-500 mt-1 ml-1">{errors.password}</p>
            )}
          </div>

          {/* Confirm Password */}
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1 uppercase tracking-wide">
              Confirm Password *
            </label>
            <div className={`flex items-center border rounded-xl bg-gray-50 focus-within:ring-2 transition-all ${
              errors.confirmPassword
                ? 'border-red-400 focus-within:ring-red-100'
                : 'border-gray-200 focus-within:border-indigo-400 focus-within:ring-indigo-100'
            }`}>
              <span className="pl-3 text-gray-400 shrink-0"><FiLock size={16} /></span>
              <input
                type={showConfirm ? 'text' : 'password'}
                placeholder="Re-enter password"
                value={form.confirmPassword}
                onChange={(e) => handleChange('confirmPassword', e.target.value)}
                onBlur={() => handleBlur('confirmPassword')}
                disabled={loading}
                className="flex-1 bg-transparent px-3 py-2.5 text-sm outline-none text-gray-800 placeholder-gray-400"
              />
              <button
                type="button"
                tabIndex={-1}
                onClick={() => setShowConfirm((v) => !v)}
                className="pr-3 text-gray-400 hover:text-gray-600 border-none bg-transparent cursor-pointer"
              >
                {showConfirm ? <FiEyeOff size={16} /> : <FiEye size={16} />}
              </button>
            </div>
            {errors.confirmPassword && (
              <p className="text-xs text-red-500 mt-1 ml-1">{errors.confirmPassword}</p>
            )}
          </div>

          {/* Age + Gender (side by side) */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1 uppercase tracking-wide">
                Age *
              </label>
              <div className={`flex items-center border rounded-xl bg-gray-50 focus-within:ring-2 transition-all ${
                errors.age
                  ? 'border-red-400 focus-within:ring-red-100'
                  : 'border-gray-200 focus-within:border-indigo-400 focus-within:ring-indigo-100'
              }`}>
                <span className="pl-3 text-gray-400 shrink-0"><FiCalendar size={16} /></span>
                <input
                  type="number"
                  placeholder="25"
                  min={13}
                  max={120}
                  value={form.age}
                  onChange={(e) => handleChange('age', e.target.value)}
                  onBlur={() => handleBlur('age')}
                  disabled={loading}
                  className="flex-1 bg-transparent px-3 py-2.5 text-sm outline-none text-gray-800 placeholder-gray-400 w-0"
                />
              </div>
              {errors.age && (
                <p className="text-xs text-red-500 mt-1 ml-1">{errors.age}</p>
              )}
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1 uppercase tracking-wide">
                Gender *
              </label>
              <select
                value={form.gender}
                onChange={(e) => handleChange('gender', e.target.value)}
                onBlur={() => handleBlur('gender')}
                disabled={loading}
                className={`w-full border rounded-xl bg-gray-50 px-3 py-2.5 text-sm outline-none text-gray-800 focus:ring-2 transition-all ${
                  errors.gender
                    ? 'border-red-400 focus:ring-red-100'
                    : 'border-gray-200 focus:border-indigo-400 focus:ring-indigo-100'
                }`}
              >
                <option value="">Select</option>
                <option value="male">Male</option>
                <option value="female">Female</option>
              </select>
              {errors.gender && (
                <p className="text-xs text-red-500 mt-1 ml-1">{errors.gender}</p>
              )}
            </div>
          </div>

          {/* Mobile Number */}
          {field('mobileNumber', 'Mobile Number *', 'tel', '+91 9876543210', <FiPhone size={16} />)}

          {/* Address (optional) */}
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1 uppercase tracking-wide">
              Address <span className="font-normal text-gray-400">(optional)</span>
            </label>
            <div className="flex items-start border border-gray-200 rounded-xl bg-gray-50 focus-within:border-indigo-400 focus-within:ring-2 focus-within:ring-indigo-100 transition-all">
              <span className="pl-3 pt-3 text-gray-400 shrink-0"><FiMapPin size={16} /></span>
              <textarea
                placeholder="123 Main Street, City, Country"
                value={form.address}
                onChange={(e) => handleChange('address', e.target.value)}
                disabled={loading}
                rows={2}
                className="flex-1 bg-transparent px-3 py-2.5 text-sm outline-none text-gray-800 placeholder-gray-400 resize-none"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 rounded-xl bg-indigo-500 hover:bg-indigo-600 text-white font-bold text-sm tracking-widest disabled:opacity-50 disabled:cursor-not-allowed transition-colors mt-1"
          >
            {loading ? 'CREATING ACCOUNT...' : 'CREATE ACCOUNT'}
          </button>
        </form>
      </div>
    </div>
  );
}
