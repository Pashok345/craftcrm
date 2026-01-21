import { useState, useEffect } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { LoginForm } from "./LoginForm";
import { RegisterForm } from "./RegisterForm";
import { ForgotPasswordForm } from "./ForgotPasswordForm";
import logo from "@/assets/logo.png";

type AuthView = "login" | "register" | "forgot-password";

interface AuthModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultView?: AuthView;
}

export const AuthModal = ({ open, onOpenChange, defaultView = "login" }: AuthModalProps) => {
  const [view, setView] = useState<AuthView>(defaultView);

  useEffect(() => {
    if (open) {
      setView(defaultView);
    }
  }, [open, defaultView]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md p-0 overflow-hidden">
        <div className="p-6">
          {/* Logo */}
          <div className="flex justify-center mb-6">
            <img src={logo} alt="CRM Pro" className="h-16 w-auto" />
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
      </DialogContent>
    </Dialog>
  );
};
