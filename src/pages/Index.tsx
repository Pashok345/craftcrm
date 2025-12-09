import { useEffect, useState } from "react";
import { useNavigate, Navigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { User, Session } from "@supabase/supabase-js";
import { Building2, FolderKanban, Users, BarChart3 } from "lucide-react";

const Index = () => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setUser(session?.user ?? null);
        setLoading(false);
      }
    );

    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

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
            <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center">
              <Building2 className="w-6 h-6 text-primary-foreground" />
            </div>
            <span className="text-xl font-bold text-foreground">CRM Pro</span>
          </div>
          <Button onClick={() => navigate("/auth")} className="btn-primary px-6">
            Войти
          </Button>
        </div>
      </header>

      <main className="container mx-auto px-4 py-16">
        <div className="max-w-3xl mx-auto text-center animate-slide-up">
          <h1 className="text-4xl md:text-5xl font-bold text-foreground mb-6">
            Управляйте проектами <span className="text-primary">эффективно</span>
          </h1>
          <p className="text-lg text-muted-foreground mb-8">
            CRM система для ведения проектов. Отслеживайте этапы, управляйте командой и достигайте результатов.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button onClick={() => navigate("/auth")} className="btn-primary px-8 py-3">
              Начать бесплатно
            </Button>
          </div>
        </div>

        <div className="grid md:grid-cols-3 gap-6 mt-20">
          {[
            { icon: FolderKanban, title: "Управление задачами", description: "Создавайте задачи и отслеживайте их на каждом этапе" },
            { icon: Users, title: "Командная работа", description: "Приглашайте коллег и распределяйте задачи" },
            { icon: BarChart3, title: "Аналитика", description: "Отслеживайте прогресс и анализируйте результаты" },
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
    </div>
  );
};

export default Index;
