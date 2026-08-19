import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Sparkles, Loader2 } from 'lucide-react';
import { WikiContent } from '@/lib/wikiMarkdown';
import { useLanguage } from '@/contexts/LanguageContext';
import { toast } from 'sonner';

interface Source {
  n: number;
  id: string;
  title: string;
}

export function WikiAiSearch() {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const [question, setQuestion] = useState('');
  const [loading, setLoading] = useState(false);
  const [answer, setAnswer] = useState<string | null>(null);
  const [sources, setSources] = useState<Source[]>([]);

  const ask = async () => {
    const q = question.trim();
    if (q.length < 3 || loading) return;
    setLoading(true);
    setAnswer(null);
    setSources([]);
    const { data, error } = await supabase.functions.invoke('wiki-ai', { body: { question: q } });
    setLoading(false);
    if (error) {
      toast.error(t('wikiAiError'));
      return;
    }
    if (data?.error) {
      toast.error(data.error);
      return;
    }
    if (data?.empty || !data?.answer) {
      setAnswer(t('wikiAiNoData'));
      return;
    }
    setAnswer(data.answer);
    setSources(data.sources || []);
  };

  return (
    <Card className="border-primary/30">
      <CardContent className="p-4 space-y-3">
        <div className="flex items-center gap-2 text-sm font-medium">
          <Sparkles className="h-4 w-4 text-primary" />
          {t('wikiAiTitle')}
        </div>
        <div className="flex gap-2">
          <Input
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                ask();
              }
            }}
            placeholder={t('wikiAiPlaceholder')}
          />
          <Button onClick={ask} disabled={loading || question.trim().length < 3}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : t('wikiAiAsk')}
          </Button>
        </div>
        {answer && (
          <div className="rounded-lg bg-muted/50 p-3 space-y-3">
            <WikiContent content={answer} />
            {sources.length > 0 && (
              <div className="flex flex-wrap items-center gap-2 pt-1">
                <span className="text-xs text-muted-foreground">{t('wikiAiSources')}:</span>
                {sources.map((s) => (
                  <Badge
                    key={s.id}
                    variant="outline"
                    className="cursor-pointer hover:bg-muted"
                    onClick={() => navigate(`/wiki/${s.id}`)}
                  >
                    [{s.n}] {s.title}
                  </Badge>
                ))}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
