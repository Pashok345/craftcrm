import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { User } from "@supabase/supabase-js";
import { FolderKanban, Users, BarChart3 } from "lucide-react";
import { AuthModal } from "@/components/auth/AuthModal";
import logo from "@/assets/logo.png";

type AuthView = "login" | "register";

const Index = () => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [authView, setAuthView] = useState<AuthView>("login");

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setUser(session?.user ?? null);
        setLoading(false);
        // Close modal on successful auth
        if (session?.user) {
          setAuthModalOpen(false);
        }
      }
    );

    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const openLoginModal = () => {
    setAuthView("login");
    setAuthModalOpen(true);
  };

  const openRegisterModal = () => {
    setAuthView("register");
    setAuthModalOpen(true);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (user) {
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src={logo} alt="CRM Pro" className="h-10 w-auto" />
            <span className="text-xl font-bold text-foreground">CRM Pro</span>
          </div>
          <Button 
            onClick={openLoginModal} 
            variant="outline"
            size="sm"
            className="text-primary border-primary hover:bg-primary hover:text-primary-foreground w-auto"
          >
            Увійти
          </Button>
        </div>
      </header>

      <main className="container mx-auto px-4 py-16">
        <div className="max-w-3xl mx-auto text-center animate-slide-up">
          <h1 className="text-4xl md:text-5xl font-bold text-foreground mb-6">
            Керуйте проектами <span className="text-primary">ефективно</span>
          </h1>
          <p className="text-lg text-muted-foreground mb-8">
            CRM система для ведення проектів. Відстежуйте етапи, керуйте командою та досягайте результатів.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button onClick={openRegisterModal} className="btn-primary px-8 py-3">
              Почати безкоштовно
            </Button>
          </div>
        </div>

        <div className="grid md:grid-cols-3 gap-6 mt-20">
          {[
            { icon: FolderKanban, title: "Керування завданнями", description: "Створюйте завдання та відстежуйте їх на кожному етапі" },
            { icon: Users, title: "Командна робота", description: "Запрошуйте колег та розподіляйте завдання" },
            { icon: BarChart3, title: "Аналітика", description: "Відстежуйте прогрес та аналізуйте результати" },
          ].map((feature, index) => (
            <div
              key={index}
              className="p-6 rounded-2xl bg-card border border-border hover:shadow-lg transition-all duration-300 animate-fade-in"
              style={{ animationDelay: `${index * 0.1}s` }}
            >
              <div className="w-12 h-12 rounded-xl bg-crm-blue-light flex items-center justify-center mb-4">
                <feature.icon className="w-6 h-6 text-primary" />
              </div>
              <h3 className="text-lg font-semibold text-foreground mb-2">{feature.title}</h3>
              <p className="text-muted-foreground">{feature.description}</p>
            </div>
          ))}
        </div>
      </main>

      <AuthModal 
        open={authModalOpen} 
        onOpenChange={setAuthModalOpen}
        defaultView={authView}
      />
    </div>
  );
};

export default Index;
