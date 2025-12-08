import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Mail, ArrowLeft, Loader2, CheckCircle } from "lucide-react";
import { z } from "zod";

const forgotPasswordSchema = z.object({
  email: z.string().email("Введите корректный email"),
});

interface ForgotPasswordFormProps {
  onSwitchToLogin: () => void;
}

export const ForgotPasswordForm = ({ onSwitchToLogin }: ForgotPasswordFormProps) => {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [errors, setErrors] = useState<{ email?: string }>({});
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});

    const validation = forgotPasswordSchema.safeParse({ email });
    if (!validation.success) {
      const fieldErrors: { email?: string } = {};
      validation.error.errors.forEach((err) => {
        if (err.path[0]) {
          fieldErrors[err.path[0] as keyof typeof fieldErrors] = err.message;
        }
      });
      setErrors(fieldErrors);
      return;
    }

    setLoading(true);

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth`,
    });

    if (error) {
      toast({
        title: "Ошибка",
        description: "Не удалось отправить письмо. Попробуйте позже.",
        variant: "destructive",
      });
    } else {
      setSent(true);
    }

    setLoading(false);
  };

  if (sent) {
    return (
      <div className="animate-fade-in text-center">
        <div className="w-16 h-16 rounded-full bg-crm-success/10 flex items-center justify-center mx-auto mb-4">
          <CheckCircle className="w-8 h-8 text-crm-success" />
        </div>
        <h1 className="text-2xl font-bold text-foreground mb-2">Письмо отправлено</h1>
        <p className="text-muted-foreground mb-6">
          Мы отправили инструкции по восстановлению пароля на {email}
        </p>
        <Button onClick={onSwitchToLogin} variant="outline" className="btn-secondary">
          <ArrowLeft className="w-4 h-4 mr-2" />
          Вернуться к входу
        </Button>
      </div>
    );
  }

  return (
    <div className="animate-fade-in">
      <button
        onClick={onSwitchToLogin}
        className="flex items-center text-muted-foreground hover:text-foreground transition-colors mb-6"
      >
        <ArrowLeft className="w-4 h-4 mr-2" />
        Назад
      </button>

      <div className="text-center mb-6">
        <h1 className="text-2xl font-bold text-foreground mb-2">Восстановление пароля</h1>
        <p className="text-muted-foreground">
          Введите email, указанный при регистрации
        </p>
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

        <Button type="submit" className="btn-primary" disabled={loading}>
          {loading ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Отправка...
            </>
          ) : (
            "Отправить инструкции"
          )}
        </Button>
      </form>
    </div>
  );
};
