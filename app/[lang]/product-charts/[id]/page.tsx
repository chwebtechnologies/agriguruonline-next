import React from 'react';
import { PageHeader } from '@/components/ui/PageHeader';
import DedicatedChartClient from './DedicatedChartClient';

export default async function DedicatedChartPage(props: { params: Promise<{ lang: string, id: string }> }) {
  const params = await props.params;
  const lang = params.lang || 'en';
  
  return (
    <div className="bg-background text-foreground min-h-screen">
      <div className="w-full pad-for-badges">
        <div className="max-w-7xl mx-auto pt-3 pb-5">
          <PageHeader title="Chart Details" backText="Back" />
          <div className="mt-4 px-2 sm:px-0">
            <DedicatedChartClient productId={params.id} lang={lang} />
          </div>
        </div>
      </div>
    </div>
  );
}
