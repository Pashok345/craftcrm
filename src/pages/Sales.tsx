import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useLanguage } from '@/contexts/LanguageContext';
import { SalesFunnel } from '@/components/sales/SalesFunnel';
import { ClientsList } from '@/components/sales/ClientsList';
import { ProposalsList } from '@/components/sales/ProposalsList';
import { FunnelAnalytics } from '@/components/sales/FunnelAnalytics';
import { TrendingUp, Users, FileText, BarChart3 } from 'lucide-react';

// ... keep existing code (Sales component declaration and header)

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="funnel" className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4" />
            {t('salesFunnel')}
          </TabsTrigger>
          <TabsTrigger value="analytics" className="flex items-center gap-2">
            <BarChart3 className="h-4 w-4" />
            {t('funnelAnalytics')}
          </TabsTrigger>
          <TabsTrigger value="clients" className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            {t('clients')}
          </TabsTrigger>
          <TabsTrigger value="proposals" className="flex items-center gap-2">
            <FileText className="h-4 w-4" />
            {t('proposals')}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="funnel" className="mt-6">
          <SalesFunnel />
        </TabsContent>

        <TabsContent value="analytics" className="mt-6">
          <FunnelAnalytics />
        </TabsContent>

        <TabsContent value="clients" className="mt-6">
          <ClientsList />
        </TabsContent>

        <TabsContent value="proposals" className="mt-6">
          <ProposalsList />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default Sales;
