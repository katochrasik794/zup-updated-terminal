'use client';

import React from 'react';
import TVChartContainer from '../chart/TVChartContainer';

const ChartSection = () => {
    return (
        <div className="flex-1 h-full overflow-hidden bg-background">
            <TVChartContainer />
        </div>
    );
};

export default ChartSection;
