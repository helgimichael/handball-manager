'use client';
import { use } from 'react';
import ProductionMatchView from '@/components/ProductionMatchView';
import { fixtureIdFromParam } from '@/lib/career/fixtureRoutes';
export default function MatchDay({ params, searchParams }: { params: Promise<{ fixtureId: string }>; searchParams: Promise<{ finish?: string }> }) {
  const fixtureId = fixtureIdFromParam(use(params).fixtureId);
  const quickFinish = use(searchParams).finish === '1';
  return <ProductionMatchView key={`${fixtureId}:${quickFinish}`} fixtureId={fixtureId} quickFinish={quickFinish} />;
}
