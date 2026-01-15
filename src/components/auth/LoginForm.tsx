import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Mail, Lock, Eye, EyeOff, Loader2 } from "lucide-react";
import { z } from "zod";

const loginSchema = z.object({
  email: z.string().email("Введите корректный email"),
  password: z.string().min(6, "Пароль должен содержать минимум 6 символов"),
});

interface LoginFormProps {
  onSwitchToRegister?: () => void;
  onSwitchToForgotPassword: () => void;
}

export const LoginForm = ({ onSwitchToRegister, onSwitchToForgotPassword }: LoginFormProps) => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});

    const validation = loginSchema.safeParse({ email, password });
    if (!validation.success) {
      const fieldErrors: { email?: string; password?: string } = {};
      validation.error.errors.forEach((err) => {
        if (err.path[0]) {
          fieldErrors[err.path[0] as keyof typeof fieldErrors] = err.message;
        }
      });
      setErrors(fieldErrors);
      return;
    }

    setLoading(true);

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      let message = "Произошла ошибка при входе";
      if (error.message.includes("Invalid login credentials")) {
        message = "Неверный email или пароль";
      } else if (error.message.includes("Email not confirmed")) {
        message = "Email не подтвержден. Проверьте почту.";
      }
      toast({
        title: "Ошибка входа",
        description: message,
        variant: "destructive",
      });
    }

    setLoading(false);
  };

  return (
    <div className="animate-fade-in">
      <div className="text-center mb-6">
        <h1 className="text-2xl font-bold text-foreground mb-2">Добро пожаловать</h1>
        <p className="text-muted-foreground">Войдите в свой аккаунт</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
            <Input
              id="email"
              type="email"
              placeholder="example@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="pl-10"
              disabled={loading}
            />
          </div>
          {errors.email && <p className="text-sm text-destructive">{errors.email}</p>}
        </div>

        <div className="space-y-2">
          <Label htmlFor="password">Пароль</Label>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
            <Input
              id="password"
              type={showPassword ? "text" : "password"}
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="pl-10 pr-10"
              disabled={loading}
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
            >
              {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
            </button>
          </div>
          {errors.password && <p className="text-sm text-destructive">{errors.password}</p>}
        </div>

        <div className="flex justify-end">
          <button
            type="button"
            onClick={onSwitchToForgotPassword}
            className="text-sm link-primary"
          >
            Восстановить пароль
          </button>
        </div>

        <Button type="submit" className="btn-primary" disabled={loading}>
          {loading ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Вход...
            </>
          ) : (
            "Войти"
          )}
        </Button>
      </form>

      {onSwitchToRegister && (
        <div className="mt-6 text-center">
          <p className="text-muted-foreground">
            Нет аккаунта?{" "}
            <button onClick={onSwitchToRegister} className="link-primary">
              Зарегистрироваться
            </button>
          </p>
        </div>
      )}
    </div>
  );
};
