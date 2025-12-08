import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { LoginForm } from "@/components/auth/LoginForm";
import { RegisterForm } from "@/components/auth/RegisterForm";
import { ForgotPasswordForm } from "@/components/auth/ForgotPasswordForm";
import { Building2 } from "lucide-react";

type AuthView = "login" | "register" | "forgot-password";

const Auth = () => {
  const [view, setView] = useState<AuthView>("login");
  const navigate = useNavigate();

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (session?.user) {
          navigate("/");
        }
      }
    );

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        navigate("/");
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  return (
    <div className="auth-container">
      <div className="auth-card animate-scale-in">
        {/* Logo */}
        <div className="flex items-center justify-center gap-3 mb-8">
          <div className="w-12 h-12 rounded-xl bg-primary flex items-center justify-center">
            <Building2 className="w-7 h-7 text-primary-foreground" />
          </div>
          <span className="text-2xl font-bold text-foreground">CRM Pro</span>
        </div>

        {/* Forms */}
        {view === "login" && (
          <LoginForm
            onSwitchToRegister={() => setView("register")}
            onSwitchToForgotPassword={() => setView("forgot-password")}
          />
        )}
        
        {view === "register" && (
          <RegisterForm onSwitchToLogin={() => setView("login")} />
        )}
        
        {view === "forgot-password" && (
          <ForgotPasswordForm onSwitchToLogin={() => setView("login")} />
        )}
      </div>
    </div>
  );
};

export default Auth;
