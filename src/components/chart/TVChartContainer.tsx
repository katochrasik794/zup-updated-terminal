'use client';

import React, { useEffect, useRef, useState } from 'react';

import { RealtimeDataFeed } from './RealtimeDataFeed';
import { ZuperiorBroker } from './ZuperiorBroker';

declare global {
    interface Window {
        TradingView: any;
        Datafeeds: any;
        Brokers: any;
        CustomDialogs: any;
        tvWidget: any;
        __GET_METAAPI_TOKEN__: any;
        __OPEN_MODIFY_POSITION_MODAL__: any;
    }
}

import { useTrading } from '../../context/TradingContext';
import { useAccount } from '../../context/AccountContext';

export const TVChartContainer = () => {
    const containerRef = useRef<HTMLDivElement>(null);
    const brokerRef = useRef<any>(null);
    const widgetRef = useRef<any>(null);
    const { setModifyModalState, lastModification } = useTrading();
    const { currentAccountId, getMetaApiToken } = useAccount();
    const modifyModalPromiseResolve = useRef<((value: boolean) => void) | null>(null);

    // Standalone state (Keeping symbol state from standalone for now, or should we use TradingContext symbol?)
    // Let's use TradingContext symbol if available, otherwise fallback
    const { symbol: ctxSymbol, setSymbol: ctxSetSymbol } = useTrading();
    const [localSymbol, setLocalSymbol] = useState('XAUUSD'); // Default fallback

    const activeSymbol = ctxSymbol || localSymbol;
    const setSymbol = ctxSetSymbol || setLocalSymbol;

    // Expose openModifyPositionModal to window for Broker to use
    const openModifyPositionModal = (position: any, brackets?: any) => {
        const mappedPosition = {
            ...position,
            openPrice: position.avg_price || position.avgPrice || position.price,
            currentPrice: position.currentPrice || position.price,
            tp: brackets?.takeProfit || position.takeProfit || position.tp,
            sl: brackets?.stopLoss || position.stopLoss || position.sl,
            pl: position.profit || position.pl || '0.00',
            volume: position.qty || position.volume,
            flag: (position.symbol || '').toLowerCase().replace(/[^a-z0-9]/g, ''),
        };
        setModifyModalState({ isOpen: true, position: mappedPosition });
        return new Promise<boolean>((resolve) => {
            modifyModalPromiseResolve.current = resolve;
        });
    };

    useEffect(() => {
        if (typeof window !== 'undefined') {
            (window as any).__OPEN_MODIFY_POSITION_MODAL__ = openModifyPositionModal;
        }
    }, [setModifyModalState]);

    useEffect(() => {
        if (lastModification && brokerRef.current) {
            console.log('[TVChartContainer] lastModification received:', lastModification);
            // Fallback to editPositionBrackets if updatePositionBrackets missing
            if (brokerRef.current.editPositionBrackets) {
                const sl = lastModification.sl ? parseFloat(lastModification.sl) : undefined;
                const tp = lastModification.tp ? parseFloat(lastModification.tp) : undefined;

                const modifiedBrackets = {
                    ...(sl !== undefined && !isNaN(sl) ? { stopLoss: sl } : {}),
                    ...(tp !== undefined && !isNaN(tp) ? { takeProfit: tp } : {}),
                    _skipModal: true,
                };

                console.log('[TVChartContainer] Calling editPositionBrackets:', lastModification.id, modifiedBrackets);
                brokerRef.current.editPositionBrackets(lastModification.id, modifiedBrackets)
                    .catch((err: any) => console.error(err));
            }
        }
    }, [lastModification]);


    useEffect(() => {
        // Add version query parameter to force browser to reload standalone.js
        // This ensures the browser uses the correct version that matches the bundles
        const scripts = [
            '/charting_library/charting_library.standalone.js?v=30.3.0',
            '/datafeeds/udf/dist/bundle.js',
            '/broker-sample/dist/bundle.js',
            '/custom-dialogs/dist/bundle.js'
        ];

        const styles = [
            '/custom-dialogs/dist/bundle.css'
        ];

        const initWidget = () => {
            if (!window.TradingView || !window.Brokers || !window.CustomDialogs) {
                return;
            }

            // Use our custom RealtimeDataFeed
            const datafeed = new RealtimeDataFeed();

            // Stub callbacks for CustomDialogs or Broker Sample
            // The logic here is simplified to allow the chart to render
            const onCancelOrderResultCallback = () => { };
            const onCloseOrderResultCallback = () => { };
            const onReversePositionResultCallback = () => { };
            const onOrderResultCallback = () => { };
            const onPositionResultCallback = () => { };

            // We need to initialize these if we want usage of CustomDialogs from inside the bundle
            // Ideally we should minimize reliance on CustomDialogs if we don't have the whole setup
            // But if broker-sample bundle expects them, we initialize them.
            // If they are missing from public/, this will fail.
            // We copied `custom-dialogs` to public, so it should load.

            let customOrderDialog: any = null;
            let customPositionDialog: any = null;
            let customCancelOrderDialog: any = null;
            let customClosePositionDialog: any = null;
            let customReversePositionDialog: any = null;

            if (window.CustomDialogs) {
                customCancelOrderDialog = window.CustomDialogs.createCancelOrderDialog(onCancelOrderResultCallback);
                customClosePositionDialog = window.CustomDialogs.createClosePositionDialog(onCloseOrderResultCallback);
                customReversePositionDialog = window.CustomDialogs.createReversePositionDialog(onReversePositionResultCallback);
            }

            const sendOrderRequest = (order: any) => { };
            const sendModifyOrder = (order: any) => { };
            const redrawChart = () => { };

            let createCancelOrderButtonListener: any = null;
            let createClosePositionButtonListener: any = null;
            let createReversePositionButtonListener: any = null;

            const widgetOptions = {
                symbol: activeSymbol,
                interval: '5',
                container: containerRef.current!,
                datafeed: datafeed,
                library_path: '/charting_library/',
                locale: 'en',
                fullscreen: false,
                autosize: true,
                theme: 'Dark',
                custom_css_url: '/charting_library/custom.css',
                disabled_features: [
                    'use_localstorage_for_settings',
                    'widgetbar',
                    'dom_widget',
                    'right_toolbar',
                    'legend_show_volume',
                    'header_symbol_search',
                    'symbol_search_hot_key',
                    'header_compare',
                    'buy_sell_buttons',
                    'objects_tree_widget', // Hide Object Tree
                    // 'trading_account_manager',
                    // 'open_account_manager',
                ],
                enabled_features: ['study_templates', 'order_panel', 'trading_account_manager'], // Ensure standard trading features are on
                charts_storage_url: 'https://saveload.tradingview.com',
                charts_storage_api_version: '1.1',
                client_id: 'trading_platform_demo',
                user_id: 'public_user',
                loading_screen: {
                    backgroundColor: "#02040d",
                },
                overrides: {
                    "paneProperties.background": "#02040d",
                    "paneProperties.backgroundType": "solid",
                    "paneProperties.vertGridProperties.color": "#02040d",
                    "paneProperties.horzGridProperties.color": "#02040d",
                    "mainSeriesProperties.candleStyle.upColor": "#16A34A",
                    "mainSeriesProperties.candleStyle.downColor": "#EF4444",
                    "mainSeriesProperties.candleStyle.borderUpColor": "#16A34A",
                    "mainSeriesProperties.candleStyle.borderDownColor": "#EF4444",
                    "mainSeriesProperties.candleStyle.wickUpColor": "#16A34A",
                    "mainSeriesProperties.candleStyle.wickDownColor": "#EF4444",
                },
                toolbar_bg: '#02040d',

                broker_factory: (host: any) => {
                    // Pass getMetaApiToken to broker constructor to enable dynamic auth
                    const broker = new ZuperiorBroker(host, datafeed, currentAccountId, getMetaApiToken);
                    brokerRef.current = broker;

                    // Setup dialogs if available
                    if (window.CustomDialogs) {
                        customOrderDialog = window.CustomDialogs.createOrderDialog(broker, onOrderResultCallback);
                        customPositionDialog = window.CustomDialogs.createPositionDialog(broker, onPositionResultCallback);
                        createCancelOrderButtonListener = window.CustomDialogs.createCancelOrderButtonListenerFactory(broker);
                        createClosePositionButtonListener = window.CustomDialogs.createClosePositionButtonListenerFactory(broker);
                        createReversePositionButtonListener = window.CustomDialogs.createReversePositionButtonListenerFactory(broker);
                    }

                    return broker;
                },
                broker_config: {
                    configFlags: {
                        // Position management flags
                        supportPositions: true,
                        supportPositionBrackets: true, // Match reference integration
                        supportIndividualPositionBrackets: true, // Match reference integration
                        supportModifyPosition: true,
                        supportPLUpdate: true,
                        supportClosePosition: true,
                        supportReversePosition: true,
                        supportNativeReversePosition: true,
                        supportPositionNetting: false,
                        supportPreviewClosePosition: false,

                        // Order management flags
                        supportOrders: true,
                        supportOrderBrackets: true,
                        supportModifyOrder: true,
                        supportCancelOrder: true,
                        supportCloseOrder: true,
                        supportMarketBrackets: true,
                        supportModifyOrderPrice: true,
                        supportModifyOrderBrackets: true,
                        supportIndividualOrderBrackets: true,
                        supportAddBracketsToExistingOrder: true,
                        supportAddBracketsToExistingPosition: true,
                        supportCancelBrackets: true,

                        // Order type flags
                        supportStopLoss: true,
                        supportStopOrders: true,
                        supportStopLimitOrders: false,
                        supportTrailingStop: true,
                        supportMultiposition: true,

                        // UI and other flags
                        showQuantityInsteadOfAmount: true,
                        supportDOM: false,
                        supportSymbolSearch: false,
                        supportStrictCheckingLimitOrderPrice: false,
                        supportLevel2Data: false,
                        supportReducePosition: false,
                        supportWorkOrder: true,
                        supportModifyPositionBrackets: true,
                        supportModifyBrackets: true,
                        supportGuaranteedStop: false,
                        supportOrdersHistory: false,
                        supportPlaceOrderPreview: true,
                    },
                    durations: [{ name: 'DAY', value: 'DAY' }, { name: 'GTT', value: 'GTT' }],
                    customUI: {
                        showOrderDialog: (order: any) => {
                            if (window.CustomDialogs) return window.CustomDialogs.showOrderDialog(customOrderDialog, order);
                            return Promise.resolve(true);
                        },
                        showPositionDialog: (position: any, brackets: any) => {
                            return openModifyPositionModal(position, brackets);
                        },
                        showPositionBracketsDialog: (position: any, brackets: any) => {
                            return openModifyPositionModal(position, brackets);
                        },
                        showIndividualPositionBracketsDialog: (position: any, brackets: any) => {
                            return openModifyPositionModal(position, brackets);
                        },
                        showCancelOrderDialog: (order: any) => {
                            if (!createCancelOrderButtonListener) return Promise.resolve(false);
                            const listener = createCancelOrderButtonListener(order, () => {
                                window.CustomDialogs.hideCancelOrderDialog(customCancelOrderDialog, listener);
                            });
                            window.CustomDialogs.showCancelOrderDialog(customCancelOrderDialog, listener, order);
                            return Promise.resolve(true);
                        },
                        showClosePositionDialog: (position: any) => {
                            if (!createClosePositionButtonListener) return Promise.resolve(false);
                            const listener = createClosePositionButtonListener(position, () => {
                                window.CustomDialogs.hideClosePositionDialog(customClosePositionDialog, listener);
                            });
                            window.CustomDialogs.showClosePositionDialog(customClosePositionDialog, listener, position);
                            return Promise.resolve(true);
                        },
                        showReversePositionDialog: (position: any) => {
                            if (!createReversePositionButtonListener) return Promise.resolve(false);
                            const listener = createReversePositionButtonListener(position, () => {
                                window.CustomDialogs.hideReversePositionDialog(customReversePositionDialog, listener);
                            });
                            window.CustomDialogs.showReversePositionDialog(customReversePositionDialog, listener, position);
                            return Promise.resolve(true);
                        }
                    }
                }
            };

            const tvWidget = new window.TradingView.widget(widgetOptions);
            widgetRef.current = tvWidget;
            window.tvWidget = tvWidget;

            tvWidget.onChartReady(() => {
                tvWidget.activeChart().onSymbolChanged().subscribe(null, () => {
                    const newSymbol = tvWidget.activeChart().symbol();
                    if (setSymbol) setSymbol(newSymbol);
                });

                if (brokerRef.current && typeof brokerRef.current.setWidgetReady === 'function') {
                    brokerRef.current.setWidgetReady(true);
                }
            });
        };

        const loadScript = (src: string) => {
            return new Promise((resolve, reject) => {
                const script = document.createElement('script');
                script.src = src;
                script.onload = resolve;
                script.onerror = () => {
                    reject(new Error(`Failed to load script: ${src}`));
                };
                document.head.appendChild(script);
            });
        };

        const loadStyle = (href: string) => {
            const link = document.createElement('link');
            link.rel = 'stylesheet';
            link.type = 'text/css';
            link.href = href;
            document.head.appendChild(link);
        };

        styles.forEach(loadStyle);

        Promise.all(scripts.map(loadScript))
            .then(() => {
                initWidget();
            })
            .catch(err => {
                console.error("Failed to load TradingView scripts", err);
            });

        return () => {
            if (brokerRef.current && typeof (brokerRef.current as any).__cleanup__ === 'function') {
                (brokerRef.current as any).__cleanup__();
            }
            if (window.tvWidget) {
                try {
                    window.tvWidget.remove();
                } catch (e) { }
                window.tvWidget = null;
            }
        };
    }, []);

    // Effect to update broker account when it changes in context
    useEffect(() => {
        if (brokerRef.current && currentAccountId) {
            if (typeof brokerRef.current.setAccountId === 'function') {
                brokerRef.current.setAccountId(currentAccountId);
            }
            // Update token function if it changed
            if (brokerRef.current.setMetaApiTokenFunction && getMetaApiToken) {
                brokerRef.current.setMetaApiTokenFunction(getMetaApiToken);
            }
        }
    }, [currentAccountId, getMetaApiToken]);

    // Effect to update chart symbol when it changes in context (e.g. clicked in watchlist)
    useEffect(() => {
        if (activeSymbol && window.tvWidget) {
            try {
                const chart = window.tvWidget.activeChart();
                if (chart) {
                    const current = chart.symbol();
                    // Determine if we need to update (ignore casing differences if broker handles them, but usually strict)
                    if (current !== activeSymbol) {
                        console.log('[TVChartContainer] Context symbol changed to', activeSymbol, 'updating chart...');
                        chart.setSymbol(activeSymbol);
                    }
                }
            } catch (e) {
                console.warn('[TVChartContainer] Failed to set symbol', e);
            }
        }
    }, [activeSymbol]);

    return (
        <div
            ref={containerRef}
            className="tv-chart-container"
            style={{ height: '100%', width: '100%' }}
        />
    );
};

export default TVChartContainer;
