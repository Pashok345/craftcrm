import { useState, useEffect } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { LoginForm } from "./LoginForm";
import { RegisterForm } from "./RegisterForm";
import { ForgotPasswordForm } from "./ForgotPasswordForm";

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
      <DialogContent className="sm:max-w-md p-6">
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
      </DialogContent>
    </Dialog>
  );
};