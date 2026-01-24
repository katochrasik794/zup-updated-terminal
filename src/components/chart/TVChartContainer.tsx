"use client";

import React, { useEffect, useRef, useState } from 'react';
import Script from 'next/script';
import { useSidebar } from '../../context/SidebarContext';
import { useTrading } from '../../context/TradingContext';

declare global {
    interface Window {
        TradingView: any;
        Datafeeds: any;
        Brokers: any;
        CustomDialogs: any;
        tvWidget: any;
    }
}

export default function TVChartContainer() {
    const containerRef = useRef<HTMLDivElement>(null);
    const { isSidebarExpanded } = useSidebar();
    const {
        setBroker,
        setActiveSymbol,
        setShowOrderDialogFunc,
        setIsModifyModalOpen,
        setSelectedPosition,
        setSelectedBrackets,
        setResolveModify
    } = useTrading();

    // Script loading state
    const [scriptsLoaded, setScriptsLoaded] = useState({
        charting: false,
        datafeeds: false,
        broker: false,
        customDialogs: false
    });

    useEffect(() => {
        if (
            scriptsLoaded.charting &&
            scriptsLoaded.datafeeds &&
            scriptsLoaded.broker &&
            scriptsLoaded.customDialogs &&
            !window.tvWidget
        ) {
            initChart();
        }
    }, [scriptsLoaded]);

    // Clean up widget on unmount
    useEffect(() => {
        return () => {
            if (window.tvWidget) {
                try {
                    window.tvWidget.remove();
                } catch (e) { }
                window.tvWidget = null;
            }
        };
    }, []);

    const initChart = () => {
        if (!containerRef.current) return;

        const datafeedUrl = "https://demo-feed-data.tradingview.com";

        // Initialize Datafeed
        const datafeed = new window.Datafeeds.UDFCompatibleDatafeed(datafeedUrl, undefined, {
            maxResponseLength: 1000,
            expectedOrder: 'latestFirst',
        });

        // --- Custom UI Logic (Adapted from trading-custom-ui.html) ---
        const createDeferredPromise = () => {
            let resolveFn: any;
            let rejectFn: any;
            const promise = new Promise((resolve, reject) => {
                resolveFn = resolve;
                rejectFn = reject;
            });
            return { promise, resolve: resolveFn, reject: rejectFn };
        };

        const orderResult = createDeferredPromise();

        // These will be used by the library internal calls
        // For our custom UI, we'll intercept and use context
        let currentPositionResolver: any = null;

        let customOrderDialog: any = null;
        let customPositionDialog: any = null;
        let customCancelOrderDialog: any = null;
        let customClosePositionDialog: any = null;
        let customReversePositionDialog: any = null;

        let createCancelOrderButtonListener: any = null;
        let createClosePositionButtonListener: any = null;
        let createReversePositionButtonListener: any = null;

        const onOrderResultCallback = function (result: any) {
            orderResult.resolve(result);
            if (customOrderDialog !== null) {
                customOrderDialog.style.display = 'none';
                customOrderDialog.removeAttribute('data-symbol');
            }
        };

        const onPositionResultCallback = function (result: any) {
            if (currentPositionResolver) {
                currentPositionResolver(result);
                currentPositionResolver = null;
            }
            if (customPositionDialog !== null) {
                customPositionDialog.style.display = 'none';
                customPositionDialog.removeAttribute('data-symbol');
            }
        };

        const onCancelOrderResultCallback = function (result: any) {
            if (customCancelOrderDialog !== null) {
                customCancelOrderDialog.style.display = 'none';
            }
        };

        const onCloseOrderResultCallback = function (result: any) {
            if (customClosePositionDialog !== null) {
                customClosePositionDialog.style.display = 'none';
            }
        };

        const onReversePositionResultCallback = function (result: any) {
            if (customReversePositionDialog !== null) {
                customReversePositionDialog.style.display = 'none';
            }
        };

        // Create Dialogs if library is loaded
        if (window.CustomDialogs) {
            customCancelOrderDialog = window.CustomDialogs.createCancelOrderDialog(onCancelOrderResultCallback);
            customClosePositionDialog = window.CustomDialogs.createClosePositionDialog(onCloseOrderResultCallback);
            customReversePositionDialog = window.CustomDialogs.createReversePositionDialog(onReversePositionResultCallback);
        }

        // Register the external trigger for Order Dialog
        setShowOrderDialogFunc(() => (order: any) => {
            if (window.CustomDialogs && customOrderDialog) {
                window.CustomDialogs.showOrderDialog(customOrderDialog, order);
            }
        });
        // -------------------------------------------------------------

        // Initialize Widget
        const widget = new window.TradingView.widget({
            // debug: true, 
            fullscreen: false,
            symbol: 'AAPL',
            interval: '1D',
            container: containerRef.current,
            datafeed: datafeed,
            library_path: "/charting_library/",
            locale: "en",
            disabled_features: [
                "use_localstorage_for_settings",
                "header_symbol_search"
            ],
            enabled_features: ["study_templates", 'dom_widget', 'move_logo_to_main_pane', 'trading_account_manager'],
            charts_storage_url: 'https://saveload.tradingview.com',
            charts_storage_api_version: "1.1",
            client_id: 'trading_platform_demo',
            user_id: 'public_user',
            theme: 'Dark',
            autosize: true,

            widgetbar: {
                details: true,
                news: true,
                watchlist: true,
                datawindow: true,
                watchlist_settings: {
                    default_symbols: ["MSFT", "IBM", "AAPL"]
                }
            },

            rss_news_feed: {
                "default": [{
                    url: "https://demo-feed-data.tradingview.com/news?symbol={SYMBOL}",
                    name: "Yahoo Finance"
                }]
            },

            broker_factory: function (host: any) {
                const broker = new window.Brokers.BrokerDemo(host, datafeed);
                setBroker(broker); // Register broker with context

                // Initialize broker-dependent dialogs
                if (window.CustomDialogs) {
                    customOrderDialog = window.CustomDialogs.createOrderDialog(broker, onOrderResultCallback);
                    customPositionDialog = window.CustomDialogs.createPositionDialog(broker, onPositionResultCallback);
                    createCancelOrderButtonListener = window.CustomDialogs.createCancelOrderButtonListenerFactory(broker);
                    createClosePositionButtonListener = window.CustomDialogs.createClosePositionButtonListenerFactory(broker);
                    createReversePositionButtonListener = window.CustomDialogs.createReversePositionButtonListenerFactory(broker);
                }

                return broker;
            },

            // Broker integration for trading features
            broker_config: {
                configFlags: {
                    supportNativeReversePosition: true,
                    supportClosePosition: true,
                    supportPLUpdate: true,
                    supportLevel2Data: false,
                    showQuantityInsteadOfAmount: true,
                    supportPositions: true,
                    supportPositionBrackets: true,
                    supportOrdersHistory: true,
                    supportTradePage: true,
                    supportExecutions: true,
                    supportDOM: true,
                },
                durations: [{ name: 'DAY', value: 'DAY' }, { name: 'GTT', value: 'GTT' }],

                // Custom UI Handlers
                customUI: {
                    showOrderDialog: function (order: any, focus: any) {
                        if (window.CustomDialogs) window.CustomDialogs.showOrderDialog(customOrderDialog, order);
                        return orderResult.promise;
                    },
                    showPositionDialog: function (position: any, brackets: any, focus: any) {
                        // Create a deferred promise to return to the library
                        const deferred = createDeferredPromise();

                        // Pass information to our React Context
                        setSelectedPosition(position);
                        setSelectedBrackets(brackets);
                        setResolveModify(() => (res: any) => deferred.resolve(res));
                        setIsModifyModalOpen(true);

                        return deferred.promise;
                    },
                    showCancelOrderDialog: function (order: any) {
                        const deferred = createDeferredPromise();
                        if (createCancelOrderButtonListener === null) {
                            return deferred.promise;
                        }
                        const listener = createCancelOrderButtonListener(order, function () {
                            window.CustomDialogs.hideCancelOrderDialog(customCancelOrderDialog, listener);
                        });
                        window.CustomDialogs.showCancelOrderDialog(customCancelOrderDialog, listener, order);
                        return deferred.promise;
                    },
                    showClosePositionDialog: function (position: any) {
                        const deferred = createDeferredPromise();
                        if (createClosePositionButtonListener === null) {
                            return deferred.promise;
                        }
                        const listener = createClosePositionButtonListener(position, function () {
                            window.CustomDialogs.hideClosePositionDialog(customClosePositionDialog, listener);
                        });
                        window.CustomDialogs.showClosePositionDialog(customClosePositionDialog, listener, position);
                        return deferred.promise;
                    },
                    showReversePositionDialog: function (position: any) {
                        const deferred = createDeferredPromise();
                        if (createReversePositionButtonListener === null) {
                            return deferred.promise;
                        }
                        const listener = createReversePositionButtonListener(position, function () {
                            window.CustomDialogs.hideReversePositionDialog(customReversePositionDialog, listener);
                        });
                        window.CustomDialogs.showReversePositionDialog(customReversePositionDialog, listener, position);
                        return deferred.promise;
                    }
                }
            }
        });

        window.tvWidget = widget;

        widget.onChartReady(() => {
            console.log("Chart Ready");
            const chart = widget.activeChart();
            setActiveSymbol(chart.symbol());

            chart.onSymbolChanged().subscribe(null, () => {
                const newsymbol = chart.symbol();
                setActiveSymbol(newsymbol);
            });
        });
    };

    return (
        <div className="relative w-full h-full bg-[#02040d]">
            <div ref={containerRef} className="w-full h-full" />

            <link rel="stylesheet" type="text/css" href="/custom-dialogs/dist/bundle.css" />

            {/* Load Scripts */}
            <Script
                src="/charting_library/charting_library.standalone.js"
                onLoad={() => setScriptsLoaded(s => ({ ...s, charting: true }))}
            />
            <Script
                src="/datafeeds/udf/dist/bundle.js"
                onLoad={() => setScriptsLoaded(s => ({ ...s, datafeeds: true }))}
            />
            <Script
                src="/custom-dialogs/dist/bundle.js"
                onLoad={() => setScriptsLoaded(s => ({ ...s, customDialogs: true }))}
            />
            <Script
                src="/broker-sample/dist/bundle.js"
                onLoad={() => setScriptsLoaded(s => ({ ...s, broker: true }))}
            />
        </div>
    );
}
