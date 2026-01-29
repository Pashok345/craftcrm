import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { LoginForm } from "@/components/auth/LoginForm";
import { RegisterForm } from "@/components/auth/RegisterForm";
import { ForgotPasswordForm } from "@/components/auth/ForgotPasswordForm";
import { ResetPasswordForm } from "@/components/auth/ResetPasswordForm";
import { Building2 } from "lucide-react";

type AuthView = "login" | "register" | "forgot-password" | "reset-password";

const Auth = () => {
  const [view, setView] = useState<AuthView>("login");
  const [isRecoverySession, setIsRecoverySession] = useState(false);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  useEffect(() => {
    // Check for recovery token in URL hash or search params
    const hashParams = new URLSearchParams(window.location.hash.substring(1));
    const type = hashParams.get('type') || searchParams.get('type');
    
    if (type === 'recovery') {
      setIsRecoverySession(true);
      setView("reset-password");
    }

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (event === 'PASSWORD_RECOVERY') {
          setIsRecoverySession(true);
          setView("reset-password");
        } else if (session?.user && !isRecoverySession) {
          // Check if user is verified
          const { data: profile } = await supabase
            .from('profiles')
            .select('is_verified')
            .eq('user_id', session.user.id)
            .maybeSingle();
          
          if (profile?.is_verified === false) {
            await supabase.auth.signOut();
            // Show a more user-friendly message
            return;
          }
          navigate("/");
        }
      }
    );

    supabase.auth.getSession().then(async ({ data: { session } }) => {
      // Don't redirect if we're in recovery mode
      if (session?.user && !isRecoverySession && view !== "reset-password") {
        // Check if user is verified
        const { data: profile } = await supabase
          .from('profiles')
          .select('is_verified')
          .eq('user_id', session.user.id)
          .maybeSingle();
        
        if (profile?.is_verified === false) {
          await supabase.auth.signOut();
          return;
        }
        navigate("/");
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate, isRecoverySession, view, searchParams]);

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

        {view === "reset-password" && (
          <ResetPasswordForm />
        )}
      </div>
    </div>
  );
};

export default Auth;
