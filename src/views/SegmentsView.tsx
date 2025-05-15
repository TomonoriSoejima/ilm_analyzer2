import React from 'react';
import { SegmentsAnalysis } from '../components/SegmentsAnalysis';

interface SegmentsViewProps {
  segmentsData: any;
}

export function SegmentsView({ segmentsData }: SegmentsViewProps) {
  return (
    <div>
      <SegmentsAnalysis data={segmentsData} />
    </div>
  );
}