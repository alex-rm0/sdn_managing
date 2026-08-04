import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useLogin } from '@workspace/api-client-react';
import { useLocation } from 'wouter';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { ArrowRight, Loader2 } from 'lucide-react';

const loginSchema = z.object({
  username: z.string().min(1, 'Utilizador obrigatório'),
  password: z.string().min(1, 'A palavra-passe é obrigatória'),
});

type LoginValues = z.infer<typeof loginSchema>;

export default function Login() {
  const [, setLocation] = useLocation();
  const { refetchUser } = useAuth();
  const { toast } = useToast();
  const [keepSession, setKeepSession] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { username: '', password: '' },
  });

  const { mutate: login, isPending } = useLogin({
    mutation: {
      onSuccess: async () => {
        await refetchUser();
        setLocation('/');
      },
      onError: () => {
        toast({
          title: 'Erro de autenticação',
          description: 'Utilizador ou palavra-passe incorretos.',
          variant: 'destructive',
        });
      },
    },
  });

  const onSubmit = (data: LoginValues) => {
    login({ data });
  };

  return (
    <div className="h-screen flex flex-col overflow-hidden" style={{ background: '#F4F6F8' }}>
      {/* ── Hero ──────────────────────────────────────────────────────────── */}
      <div className="relative w-full flex-1 min-h-0 overflow-hidden">
        {/* Background photo — show city top + boat bottom */}
        <img
          src="/hero-coimbra.jpg"
          alt="Coimbra"
          className="absolute inset-0 w-full h-full object-cover"
          style={{ objectPosition: 'center 55%' }}
        />
        {/* Dark blue tint */}
        <div
          className="absolute inset-0"
          style={{ background: 'rgba(11,30,61,0.50)' }}
        />

        {/* Logo + identity — sits above the fade zone */}
        <div className="absolute bottom-20 right-10 flex items-center gap-5">
          <img
            src="/logo-sdn.png"
            alt="SDN"
            className="w-16 h-16 rounded-xl object-contain bg-white p-1.5 shadow-lg flex-shrink-0"
          />
          <div className="text-right">
            <p className="text-white/70 text-xs font-semibold tracking-widest uppercase">SDN · AAC</p>
            <p
              className="text-xs font-medium tracking-widest uppercase mt-0.5"
              style={{ color: '#06B6D4' }}
            >
              Plataforma de Gestão
            </p>
            <h1 className="text-white text-2xl font-bold leading-tight mt-1 whitespace-nowrap">
              Secção de Desportos Náuticos · AAC
            </h1>
          </div>
        </div>
      </div>

      {/* ── Form area ─────────────────────────────────────────────────────── */}
      <div className="flex-shrink-0 flex flex-col items-center justify-center px-6 py-4" style={{ background: '#F4F6F8' }}>
        <form
          onSubmit={handleSubmit(onSubmit)}
          className="w-full max-w-3xl"
          noValidate
        >
          {/* Fields row */}
          <div className="flex flex-col sm:flex-row gap-4 items-start">
            {/* Utilizador */}
            <div className="flex-1 flex flex-col gap-1.5">
              <label
                className="text-xs font-semibold tracking-widest uppercase"
                style={{ color: '#6B7280' }}
              >
                Utilizador
              </label>
              <input
                {...register('username')}
                autoComplete="username"
                placeholder="nome de utilizador"
                className="w-full h-11 rounded-lg border border-gray-200 bg-white px-4 text-sm shadow-sm outline-none transition focus:border-cyan-400 focus:ring-2 focus:ring-cyan-400/20"
                style={{ color: '#111827' }}
              />
              {errors.username && (
                <p className="text-xs text-red-500">{errors.username.message}</p>
              )}
            </div>

            {/* Password */}
            <div className="flex-1 flex flex-col gap-1.5">
              <label
                className="text-xs font-semibold tracking-widest uppercase"
                style={{ color: '#6B7280' }}
              >
                Palavra-passe
              </label>
              <input
                {...register('password')}
                type="password"
                autoComplete="current-password"
                placeholder="••••••••"
                className="w-full h-11 rounded-lg border border-gray-200 bg-white px-4 text-sm shadow-sm outline-none transition focus:border-cyan-400 focus:ring-2 focus:ring-cyan-400/20"
                style={{ color: '#111827' }}
              />
              {errors.password && (
                <p className="text-xs text-red-500">{errors.password.message}</p>
              )}
            </div>

            {/* Submit */}
            <div className="flex flex-col gap-1.5 sm:pt-0">
              <label className="text-xs invisible select-none">Entrar</label>
              <button
                type="submit"
                disabled={isPending}
                className="h-11 px-7 rounded-lg font-semibold text-sm text-white flex items-center gap-2 transition hover:brightness-110 disabled:opacity-60 shadow-md"
                style={{ background: '#0B1E3D' }}
              >
                {isPending ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    Entrar
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Secondary row */}
          <div className="mt-5 flex items-center justify-center gap-6">
            <label className="flex items-center gap-2 cursor-pointer select-none group">
              <input
                type="checkbox"
                checked={keepSession}
                onChange={e => setKeepSession(e.target.checked)}
                className="w-4 h-4 rounded border-gray-300 accent-cyan-500 cursor-pointer"
              />
              <span className="text-sm font-medium" style={{ color: '#06B6D4' }}>
                Manter sessão
              </span>
            </label>
            <button
              type="button"
              className="text-sm font-medium transition hover:underline"
              style={{ color: '#06B6D4' }}
              onClick={() =>
                toast({ title: 'Recuperação de acesso', description: 'Contacte o administrador da secção.' })
              }
            >
              Esqueci-me
            </button>
          </div>
        </form>

        {/* Footer note */}
        <p
          className="mt-4 text-xs font-semibold tracking-widest uppercase"
          style={{ color: '#9CA3AF' }}
        >
          Acesso restrito a membros da secção
        </p>
      </div>
    </div>
  );
}
