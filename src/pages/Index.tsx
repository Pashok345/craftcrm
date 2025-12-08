import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { User, Session } from "@supabase/supabase-js";
import { 
  Building2, 
  LogOut, 
  LayoutDashboard, 
  FolderKanban, 
  Users, 
  BarChart3,
  Settings,
  Plus
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const Index = () => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        setLoading(false);
      }
    );

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    toast({
      title: "Выход выполнен",
      description: "Вы успешно вышли из системы",
    });
    navigate("/auth");
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-background">
        {/* Hero Section */}
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
              Управляйте проектами{" "}
              <span className="text-primary">эффективно</span>
            </h1>
            <p className="text-lg text-muted-foreground mb-8">
              CRM система для ведения проектов. Отслеживайте этапы, управляйте командой и достигайте результатов.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button onClick={() => navigate("/auth")} className="btn-primary px-8 py-3">
                Начать бесплатно
              </Button>
              <Button variant="outline" className="btn-secondary px-8 py-3">
                Узнать больше
              </Button>
            </div>
          </div>

          {/* Features */}
          <div className="grid md:grid-cols-3 gap-6 mt-20">
            {[
              {
                icon: FolderKanban,
                title: "Управление проектами",
                description: "Создавайте проекты и отслеживайте их на каждом этапе",
              },
              {
                icon: Users,
                title: "Командная работа",
                description: "Приглашайте коллег и распределяйте задачи",
              },
              {
                icon: BarChart3,
                title: "Аналитика",
                description: "Отслеживайте прогресс и анализируйте результаты",
              },
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
  }

  // Dashboard for logged in users
  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center">
              <Building2 className="w-6 h-6 text-primary-foreground" />
            </div>
            <span className="text-xl font-bold text-foreground">CRM Pro</span>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-sm text-muted-foreground hidden sm:block">
              {user.email}
            </span>
            <Button onClick={handleLogout} variant="outline" size="sm">
              <LogOut className="w-4 h-4 mr-2" />
              Выйти
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        {/* Welcome Section */}
        <div className="mb-8 animate-fade-in">
          <h1 className="text-2xl font-bold text-foreground mb-2">
            Добро пожаловать, {user.user_metadata?.name || "Пользователь"}!
          </h1>
          <p className="text-muted-foreground">
            Управляйте своими проектами и задачами
          </p>
        </div>

        {/* Quick Actions */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {[
            { icon: LayoutDashboard, label: "Дашборд", color: "bg-primary" },
            { icon: FolderKanban, label: "Проекты", color: "bg-crm-success" },
            { icon: Users, label: "Команда", color: "bg-crm-warning" },
            { icon: Settings, label: "Настройки", color: "bg-crm-gray" },
          ].map((item, index) => (
            <button
              key={index}
              className="p-4 rounded-xl bg-card border border-border hover:shadow-md hover:border-primary/30 transition-all duration-200 flex items-center gap-3 animate-slide-up"
              style={{ animationDelay: `${index * 0.05}s` }}
            >
              <div className={`w-10 h-10 rounded-lg ${item.color} flex items-center justify-center`}>
                <item.icon className="w-5 h-5 text-primary-foreground" />
              </div>
              <span className="font-medium text-foreground">{item.label}</span>
            </button>
          ))}
        </div>

        {/* Projects Section */}
        <div className="bg-card rounded-2xl border border-border p-6 animate-fade-in">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-semibold text-foreground">Мои проекты</h2>
            <Button className="btn-primary" size="sm">
              <Plus className="w-4 h-4 mr-2" />
              Новый проект
            </Button>
          </div>
          
          <div className="text-center py-12 text-muted-foreground">
            <FolderKanban className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p>У вас пока нет проектов</p>
            <p className="text-sm">Создайте первый проект, чтобы начать работу</p>
          </div>
        </div>
      </main>
    </div>
  );
};

export default Index;
