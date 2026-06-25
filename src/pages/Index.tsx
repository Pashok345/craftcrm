import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { User } from "@supabase/supabase-js";
import { 
  FolderKanban, Users, BarChart3, CheckCircle2, Clock, 
  MessageSquare, Shield, Zap, Star, ChevronRight, Calendar
} from "lucide-react";
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

  const features = [
    { icon: FolderKanban, title: "Керування завданнями", description: "Створюйте завдання, встановлюйте дедлайни та відстежуйте прогрес на кожному етапі. Канбан-дошка та список задач." },
    { icon: Users, title: "Командна робота", description: "Запрошуйте колег, призначайте виконавців та спостерігачів. Коментуйте та обговорюйте задачі в реальному часі." },
    { icon: BarChart3, title: "Аналітика та звіти", description: "Відстежуйте продуктивність команди, аналізуйте виконання задач та приймайте рішення на основі даних." },
    { icon: Calendar, title: "Зустрічі та події", description: "Плануйте зустрічі, запрошуйте учасників та отримуйте нагадування про важливі події." },
    { icon: MessageSquare, title: "Чат та повідомлення", description: "Спілкуйтеся з командою в вбудованому чаті, отримуйте сповіщення та не пропускайте важливі оновлення." },
    { icon: Shield, title: "Безпека даних", description: "Ваші дані захищені сучасними технологіями шифрування. Контроль доступу та права користувачів." },
  ];

  const advantages = [
    { icon: Zap, title: "Швидкий старт", description: "Розпочніть роботу за лічені хвилини без складного налаштування" },
    { icon: CheckCircle2, title: "Інтуїтивний інтерфейс", description: "Зрозумілий дизайн, який не потребує навчання" },
    { icon: Clock, title: "Економія часу", description: "Автоматизація рутинних процесів та email-нагадування" },
    { icon: Users, title: "Необмежена команда", description: "Додавайте скільки завгодно користувачів безкоштовно" },
  ];

  const testimonials = [
    { 
      name: "Олександр Петренко", 
      role: "CEO, TechStart", 
      text: "CraftCRM повністю змінила наш підхід до управління проектами. Тепер вся команда синхронізована і ми встигаємо виконувати задачі вчасно.",
      rating: 5
    },
    { 
      name: "Марія Коваленко", 
      role: "Менеджер проектів, DesignHub", 
      text: "Найкраща система для невеликих команд. Простота використання та потужний функціонал - саме те, що нам було потрібно.",
      rating: 5
    },
    { 
      name: "Дмитро Савченко", 
      role: "Директор, WebAgency", 
      text: "Перейшли з дорогих аналогів і не пошкодували. Все необхідне є, а інтерфейс набагато зручніший.",
      rating: 5
    },
  ];

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-50 border-b border-border bg-card/80 backdrop-blur-md">
        <div className="container mx-auto px-4 py-3 flex items-center justify-between">
          <img src={logo} alt="CraftCRM" width="160" height="40" fetchPriority="high" className="h-10 w-auto" />
          <Button 
            onClick={openLoginModal} 
            variant="outline"
            size="sm"
            className="text-primary border-primary hover:bg-primary hover:text-primary-foreground"
          >
            Увійти
          </Button>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative min-h-screen flex items-center justify-center overflow-hidden pt-16">
        {/* Background Effects */}
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-background to-primary/10" />
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary/20 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-primary/15 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }} />
        <div className="absolute top-1/2 right-1/3 w-64 h-64 bg-primary/10 rounded-full blur-2xl animate-pulse" style={{ animationDelay: '2s' }} />
        
        <div className="relative z-10 container mx-auto px-4 text-center">
          <div className="max-w-4xl mx-auto animate-fade-in">
            <h1 className="text-5xl md:text-7xl font-bold text-foreground mb-8 leading-tight">
              Керуйте проектами{" "}
              <span className="text-primary bg-gradient-to-r from-primary to-blue-400 bg-clip-text text-transparent">
                ефективно
              </span>
            </h1>
            <p className="text-xl md:text-2xl text-muted-foreground mb-12 max-w-2xl mx-auto leading-relaxed">
              Сучасна CRM система для ведення проектів. Відстежуйте етапи, керуйте командою та досягайте результатів разом.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button 
                onClick={openRegisterModal} 
                size="lg"
                className="btn-primary text-lg px-10 py-6 rounded-xl shadow-lg shadow-primary/25 hover:shadow-xl hover:shadow-primary/30 transition-all duration-300 hover:scale-105"
              >
                Почати безкоштовно
                <ChevronRight className="ml-2 h-5 w-5" />
              </Button>
            </div>
            <p className="mt-6 text-sm text-muted-foreground">
              Безкоштовно • Без кредитної картки • Почніть за 30 секунд
            </p>
          </div>
        </div>

        {/* Scroll indicator */}
        <div className="absolute bottom-8 left-1/2 transform -translate-x-1/2 animate-bounce">
          <div className="w-6 h-10 rounded-full border-2 border-muted-foreground/30 flex justify-center pt-2">
            <div className="w-1 h-2 bg-muted-foreground/50 rounded-full" />
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-24 bg-muted/30">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
              Все що потрібно для роботи
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Повний набір інструментів для ефективного управління проектами та командою
            </p>
          </div>
          
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((feature, index) => (
              <Card
                key={index}
                className="group hover:shadow-xl transition-all duration-300 hover:-translate-y-1 border-border/50 bg-card/50 backdrop-blur-sm animate-fade-in"
                style={{ animationDelay: `${index * 0.1}s` }}
              >
                <CardContent className="p-6">
                  <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mb-5 group-hover:bg-primary/20 transition-colors">
                    <feature.icon className="w-7 h-7 text-primary" />
                  </div>
                  <h3 className="text-xl font-semibold text-foreground mb-3">{feature.title}</h3>
                  <p className="text-muted-foreground leading-relaxed">{feature.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Advantages Section */}
      <section className="py-24">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
              Чому обирають нас
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Переваги, які роблять роботу з CraftCRM простою та приємною
            </p>
          </div>
          
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {advantages.map((advantage, index) => (
              <div
                key={index}
                className="text-center p-6 animate-fade-in"
                style={{ animationDelay: `${index * 0.1}s` }}
              >
                <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-5">
                  <advantage.icon className="w-8 h-8 text-primary" />
                </div>
                <h3 className="text-lg font-semibold text-foreground mb-2">{advantage.title}</h3>
                <p className="text-muted-foreground">{advantage.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Testimonials Section */}
      <section className="py-24 bg-muted/30">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
              Відгуки наших клієнтів
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Що говорять про нас ті, хто вже використовує CraftCRM
            </p>
          </div>
          
          <div className="grid md:grid-cols-3 gap-8">
            {testimonials.map((testimonial, index) => (
              <Card
                key={index}
                className="bg-card border-border/50 animate-fade-in"
                style={{ animationDelay: `${index * 0.15}s` }}
              >
                <CardContent className="p-6">
                  <div className="flex gap-1 mb-4">
                    {[...Array(testimonial.rating)].map((_, i) => (
                      <Star key={i} className="w-5 h-5 fill-yellow-400 text-yellow-400" />
                    ))}
                  </div>
                  <p className="text-foreground mb-6 leading-relaxed italic">
                    "{testimonial.text}"
                  </p>
                  <div>
                    <p className="font-semibold text-foreground">{testimonial.name}</p>
                    <p className="text-sm text-muted-foreground">{testimonial.role}</p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-24">
        <div className="container mx-auto px-4">
          <div className="max-w-3xl mx-auto text-center">
            <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-6">
              Готові почати?
            </h2>
            <p className="text-lg text-muted-foreground mb-8">
              Приєднуйтесь до тисяч компаній, які вже використовують CraftCRM для ефективного управління проектами
            </p>
            <Button 
              onClick={openRegisterModal} 
              size="lg"
              className="btn-primary text-lg px-10 py-6 rounded-xl shadow-lg shadow-primary/25 hover:shadow-xl hover:shadow-primary/30 transition-all duration-300 hover:scale-105"
            >
              Почати безкоштовно
              <ChevronRight className="ml-2 h-5 w-5" />
            </Button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 border-t border-border">
        <div className="container mx-auto px-4">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <img src={logo} alt="CraftCRM" className="h-8 w-auto" />
            <p className="text-sm text-muted-foreground">
              © 2024 CraftCRM. Всі права захищено.
            </p>
          </div>
        </div>
      </footer>

      <AuthModal 
        open={authModalOpen} 
        onOpenChange={setAuthModalOpen}
        defaultView={authView}
      />
    </div>
  );
};

export default Index;