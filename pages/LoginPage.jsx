import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Zap, Mail, Lock, User, Briefcase, Eye, EyeOff } from 'lucide-react';
import { login, register } from '../api/api';
import { useAuth } from '../hooks/useAuth';
import { useToast } from '../components/Toast';

export default function LoginPage() {
  const [isRegister, setIsRegister] = useState(false);
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({ name: '', email: '', password: '', company: '', role: 'operator' });
  const { loginUser } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();

  const set = (k) => (e) => setForm(prev => ({ ...prev, [k]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      let res;
      if (isRegister) {
        res = await register(form);
        toast.success('Account created!', 'Welcome to Lume');
      } else {
        res = await login(form.email, form.password);
      }
      loginUser(res.data.token, res.data.user);
      navigate('/');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Authentication failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-ink-900 flex items-center justify-center p-4">
      {/* Background decoration */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-teal-500/5 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-sky-500/5 rounded-full blur-3xl" />
      </div>

      <div className="w-full max-w-md relative animate-fade-up">
        {/* Logo */}
        <div className="flex items-center gap-3 mb-8 justify-center">
          <div className="w-10 h-10 bg-teal-500 rounded-xl flex items-center justify-center shadow-lg shadow-teal-500/30">
            <Zap size={20} className="text-ink-900" strokeWidth={2.5} />
          </div>
          <div>
            <span className="font-display text-2xl font-bold tracking-[0.25em] text-ink-100 uppercase">LUME</span>
            <div className="text-[9px] text-ink-500 tracking-widest uppercase">Warehouse Platform</div>
          </div>
        </div>

        <div className="card-elevated p-8">
          <div className="mb-6">
            <h2 className="text-xl font-semibold text-ink-100">
              {isRegister ? 'Create account' : 'Welcome back'}
            </h2>
            <p className="text-sm text-ink-500 mt-1">
              {isRegister ? 'Set up your Lume workspace.' : 'Sign in to manage your warehouse.'}
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {isRegister && (
              <div>
                <label className="label mb-1.5 block">Full Name</label>
                <div className="relative">
                  <User size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-500" />
                  <input className="input pl-9" placeholder="Niranjan NN" value={form.name} onChange={set('name')} required />
                </div>
              </div>
            )}

            <div>
              <label className="label mb-1.5 block">Email</label>
              <div className="relative">
                <Mail size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-500" />
                <input className="input pl-9" type="email" placeholder="you@company.com" value={form.email} onChange={set('email')} required />
              </div>
            </div>

            <div>
              <label className="label mb-1.5 block">Password</label>
              <div className="relative">
                <Lock size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-500" />
                <input
                  className="input pl-9 pr-9"
                  type={showPw ? 'text' : 'password'}
                  placeholder="••••••••"
                  value={form.password}
                  onChange={set('password')}
                  required
                />
                <button type="button" onClick={() => setShowPw(p => !p)} className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-500 hover:text-ink-300">
                  {showPw ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
            </div>

            {isRegister && (
              <>
                <div>
                  <label className="label mb-1.5 block">Company</label>
                  <div className="relative">
                    <Briefcase size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-500" />
                    <input className="input pl-9" placeholder="CliDeal Logistics" value={form.company} onChange={set('company')} />
                  </div>
                </div>
                <div>
                  <label className="label mb-1.5 block">Role</label>
                  <select className="input" value={form.role} onChange={set('role')}>
                    <option value="operator">Operator</option>
                    <option value="manager">Manager</option>
                    <option value="viewer">Viewer</option>
                  </select>
                </div>
              </>
            )}

            <button type="submit" className="btn-primary w-full py-2.5 mt-2" disabled={loading}>
              {loading ? 'Please wait…' : (isRegister ? 'Create Account' : 'Sign In')}
            </button>
          </form>

          <div className="mt-5 text-center text-xs text-ink-500">
            {isRegister ? 'Already have an account?' : "Don't have an account?"}{' '}
            <button className="text-teal-400 hover:text-teal-300 font-medium" onClick={() => setIsRegister(p => !p)}>
              {isRegister ? 'Sign in' : 'Register'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
