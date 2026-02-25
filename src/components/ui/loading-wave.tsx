import React from 'react';

export const LoadingWave = () => {
    return (
        <div className="flex items-center justify-center space-x-2">
            <div
                className="w-3 h-3 bg-primary rounded-full animate-bounce [animation-delay:-0.3s]"
                style={{ animationDuration: '0.6s' }}
            />
            <div
                className="w-3 h-3 bg-primary rounded-full animate-bounce [animation-delay:-0.15s]"
                style={{ animationDuration: '0.6s' }}
            />
            <div
                className="w-3 h-3 bg-primary rounded-full animate-bounce"
                style={{ animationDuration: '0.6s' }}
            />
        </div>
    );
};

export const LoadingScreen = () => {
    return (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-background">
            <div className="flex flex-col items-center gap-6">
                <LoadingWave />
                <div className="text-sm font-medium text-foreground/40 animate-pulse">
                    Loading Terminal...
                </div>
            </div>
        </div>
    );
};
