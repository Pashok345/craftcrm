import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useLanguage } from '@/contexts/LanguageContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { TrendingUp, DollarSign, Clock, BarChart3, ArrowRight } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import type { Deal, DealStage } from '@/types/sales';

export const FunnelAnalytics = () => {
  const { t } = useLanguage();

  const { data: stages = [] } = useQuery({
    queryKey: ['deal-stages'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('deal_stages')
        .select('*')
        .order('sort_order');
      if (error) throw error;
      return data as DealStage[];
    },
  });

  const { data: deals = [] } = useQuery({
    queryKey: ['deals'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('deals')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as Deal[];
    },
  });

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat('ru-RU', { style: 'currency', currency: 'USD', minimumFractionDigits: 0 }).format(amount);

  // Conversion data between stages
  const conversionData = stages.map((stage, index) => {
    const dealsInStage = deals.filter(d => d.stage_id === stage.id).length;
    const prevDeals = index > 0 ? deals.filter(d => d.stage_id === stages[index - 1].id).length : dealsInStage;
    const conversion = prevDeals > 0 ? Math.round((dealsInStage / prevDeals) * 100) : 0;
    return {
      name: stage.name,
      deals: dealsInStage,
      amount: deals.filter(d => d.stage_id === stage.id).reduce((s, d) => s + (d.amount || 0), 0),
      conversion: index === 0 ? 100 : conversion,
      color: stage.color,
    };
  });

  // Average deal cycle (days from created to last stage)
  const avgCycleDays = (() => {
    const closedDeals = deals.filter(d => {
      const lastStage = stages[stages.length - 1];
      return lastStage && d.stage_id === lastStage.id;
    });
    if (closedDeals.length === 0) return 0;
    const totalDays = closedDeals.reduce((sum, deal) => {
      const created = new Date(deal.created_at);
      const updated = new Date(deal.updated_at);
      return sum + Math.ceil((updated.getTime() - created.getTime()) / (1000 * 60 * 60 * 24));
    }, 0);
    return Math.round(totalDays / closedDeals.length);
  })();

  // Revenue forecast based on probability
  const forecastAmount = deals.reduce((sum, deal) => {
    const prob = (deal.probability || 50) / 100;
    return sum + (deal.amount || 0) * prob;
  }, 0);

  const totalPipeline = deals.reduce((sum, d) => sum + (d.amount || 0), 0);

  // Stage distribution for pie chart
  const pieData = conversionData.filter(d => d.deals > 0);

  const COLORS = stages.map(s => s.color);

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <BarChart3 className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">{t('totalDeals')}</p>
                <p className="text-2xl font-bold">{deals.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-crm-success/10">
                <DollarSign className="h-5 w-5 text-crm-success" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">{t('totalAmount')}</p>
                <p className="text-2xl font-bold">{formatCurrency(totalPipeline)}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-crm-warning/10">
                <TrendingUp className="h-5 w-5 text-crm-warning" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">{t('revenueForecast')}</p>
                <p className="text-2xl font-bold">{formatCurrency(forecastAmount)}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-muted">
                <Clock className="h-5 w-5 text-muted-foreground" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">{t('avgDealCycle')}</p>
                <p className="text-2xl font-bold">{avgCycleDays} {t('days')}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Conversion funnel */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t('stageConversion')}</CardTitle>
        </CardHeader>
        <CardContent>
          {conversionData.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">{t('noData')}</p>
          ) : (
            <div className="space-y-3">
              {conversionData.map((stage, i) => (
                <div key={stage.name} className="flex items-center gap-3">
                  <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: stage.color }} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-medium truncate">{stage.name}</span>
                      <div className="flex items-center gap-2">
                        <Badge variant="secondary" className="text-xs">{stage.deals} {t('totalDeals').toLowerCase().split(' ').pop()}</Badge>
                        <span className="text-xs text-muted-foreground">{formatCurrency(stage.amount)}</span>
                      </div>
                    </div>
                    <div className="h-2 bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{
                          width: `${stage.conversion}%`,
                          backgroundColor: stage.color,
                        }}
                      />
                    </div>
                    {i > 0 && (
                      <div className="flex items-center gap-1 mt-0.5">
                        <ArrowRight className="h-3 w-3 text-muted-foreground" />
                        <span className="text-xs text-muted-foreground">
                          {t('conversion')}: {stage.conversion}%
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Bar chart - amount by stage */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t('amountByStage')}</CardTitle>
          </CardHeader>
          <CardContent>
            {conversionData.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">{t('noData')}</p>
            ) : (
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={conversionData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="name" className="text-xs" tick={{ fontSize: 11 }} />
                  <YAxis className="text-xs" tick={{ fontSize: 11 }} />
                  <Tooltip
                    formatter={(value: number) => formatCurrency(value)}
                    contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))' }}
                  />
                  <Bar dataKey="amount" radius={[4, 4, 0, 0]}>
                    {conversionData.map((entry, index) => (
                      <Cell key={index} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Pie chart - deal distribution */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t('dealDistribution')}</CardTitle>
          </CardHeader>
          <CardContent>
            {pieData.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">{t('noData')}</p>
            ) : (
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    outerRadius={90}
                    dataKey="deals"
                    nameKey="name"
                    label={({ name, deals }) => `${name}: ${deals}`}
                  >
                    {pieData.map((entry, index) => (
                      <Cell key={index} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
