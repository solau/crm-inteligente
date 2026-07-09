'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { BrainCircuit, Loader2 } from 'lucide-react';

export default function LoginPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Erro ao fazer login');
        setLoading(false);
        return;
      }

      if (data.user.role === 'ADMIN') {
        window.location.href = '/';
      } else {
        window.location.href = '/vendedor/kanban';
      }

    } catch (err) {
      setError('Erro de conexão');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-black/95 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white/10 backdrop-blur-xl border border-white/20 rounded-2xl p-8 shadow-2xl">
        <div className="flex flex-col items-center justify-center mb-8">
          <div className="w-16 h-16 bg-emerald-500/20 text-emerald-400 rounded-2xl flex items-center justify-center mb-4 border border-emerald-500/30">
            <BrainCircuit size={32} />
          </div>
          <h1 className="text-2xl font-bold text-white text-center">CRM Inteligente</h1>
          <p className="text-white/50 text-sm mt-1">Faça login para continuar</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-white/70 text-sm font-medium mb-1">Usuário</label>
            <input 
              type="text" 
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-emerald-500 transition-colors"
              placeholder="Digite seu usuário"
              required
            />
          </div>
          <div>
            <label className="block text-white/70 text-sm font-medium mb-1">Senha</label>
            <input 
              type="password" 
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-emerald-500 transition-colors"
              placeholder="Digite sua senha"
              required
            />
          </div>

          {error && (
            <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-lg text-rose-400 text-sm text-center">
              {error}
            </div>
          )}

          <button 
            type="submit" 
            disabled={loading}
            className="w-full bg-emerald-500 hover:bg-emerald-600 text-white font-semibold py-3 rounded-xl transition-all flex items-center justify-center gap-2 mt-2"
          >
            {loading ? <Loader2 className="animate-spin" size={20} /> : 'Entrar no Sistema'}
          </button>
        </form>
      </div>
    </div>
  );
}
