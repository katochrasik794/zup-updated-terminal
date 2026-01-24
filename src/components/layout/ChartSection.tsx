'use client';

import React from 'react';
import TVChartContainer from '../chart/TVChartContainer';

const ChartSection = () => {
    return (
        <div className="flex-1 h-full overflow-hidden bg-[#0F0F0F]">
            <TVChartContainer />
        </div>
    );
};

export default ChartSection;
