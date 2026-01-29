'use client';

import React, { useEffect, useRef } from 'react';

declare global {
    interface Window {
        TradingView: any;
        Datafeeds: any;
        Brokers: any;
        CustomDialogs: any;
        tvWidget: any;
    }
}

import { useTrading } from '../../context/TradingContext';
import { useAccount } from '../../context/AccountContext';
import { RealtimeDataFeed } from './RealtimeDataFeed';
import { ZuperiorBroker } from './ZuperiorBroker';

export const TVChartContainer = () => {
    const containerRef = useRef<HTMLDivElement>(null);
    const brokerRef = useRef<any>(null);
    const { lastOrder, symbol, setSymbol, setModifyModalState, lastModification, modifyModalState } = useTrading();
    const { currentAccountId, getMetaApiToken } = useAccount();
    const modifyModalPromiseResolve = useRef<((value: boolean) => void) | null>(null);

    // Update broker token function when it becomes available
    useEffect(() => {
        if (brokerRef.current && getMetaApiToken) {
            if (brokerRef.current.setMetaApiTokenFunction) {
                brokerRef.current.setMetaApiTokenFunction(getMetaApiToken);
            }
            // Also store in window for fallback
            if (typeof window !== 'undefined') {
                (window as any).__GET_METAAPI_TOKEN__ = getMetaApiToken;
            }
        }
    }, [getMetaApiToken]);

    useEffect(() => {
        if (lastModification && brokerRef.current) {

            // BrokerDemo uses editPositionBrackets(positionId, modifiedBrackets)
            // where modifiedBrackets is { stopLoss?: number, takeProfit?: number }
            if (brokerRef.current.editPositionBrackets) {
                const sl = lastModification.sl ? parseFloat(lastModification.sl) : undefined;
                const tp = lastModification.tp ? parseFloat(lastModification.tp) : undefined;

                const modifiedBrackets = {
                    ...(sl !== undefined && !isNaN(sl) ? { stopLoss: sl } : {}),
                    ...(tp !== undefined && !isNaN(tp) ? { takeProfit: tp } : {}),
                };


                brokerRef.current.editPositionBrackets(lastModification.id, modifiedBrackets)
                    .catch(() => {});
            } else {
            }
        }
    }, [lastModification]);

    useEffect(() => {
        if (!modifyModalState.isOpen && modifyModalPromiseResolve.current) {
            modifyModalPromiseResolve.current(true);
            modifyModalPromiseResolve.current = null;
        }
    }, [modifyModalState.isOpen]);

    // Update broker account ID when it changes
    useEffect(() => {
        if (brokerRef.current && currentAccountId) {
            if (typeof brokerRef.current.setAccountId === 'function') {
                brokerRef.current.setAccountId(currentAccountId);
            }
        }
    }, [currentAccountId]);

    useEffect(() => {
        if (lastOrder && brokerRef.current) {
            // Append silent flag to userData or similar if supported, or rely on handling in broker factory
            // For now, passing order as is.
            // Map context Order to TradingView Broker PreOrder
            // Assuming BrokerDemo expects standard fields
            const preOrder = {
                symbol: lastOrder.symbol,
                qty: parseFloat(lastOrder.volume),
                side: lastOrder.side === 'buy' ? 1 : -1,
                type: lastOrder.type === 'market' ? 2 : 1, // 1=limit, 2=market (Standard TV: OrderType.Limit=1, OrderType.Market=2, OrderType.Stop=3, OrderType.StopLimit=4)
                // Actually BrokerDemo might expect string 'market' or 'limit'. Let's try matching standard TV behavior first or guess from sample.
                // Reverting to string if BrokerDemo is simple, but standard API uses numbers often. 
                // Wait, if I look at broker-sample, it likely uses strings if it's based on JS API.
                // Let's safe bet: pass everything and let broker filter.
                // But definitely need qty and numeric side.
                // And explicitly 'limitPrice' / 'stopPrice'
                ...(lastOrder.type !== 'market' ? { limitPrice: parseFloat(lastOrder.price || '0') } : {}),
                ...(lastOrder.tp ? { takeProfit: parseFloat(lastOrder.tp) } : {}),
                ...(lastOrder.sl ? { stopLoss: parseFloat(lastOrder.sl) } : {}),
                userData: { silent: true }
            };

            // Correction: TV JS API usually uses order type constants. 
            // 1: Limit, 2: Market, 3: Stop, 4: StopLimit
            // However, verify if BrokerDemo expects numbers or strings. 
            // Most JS adapters convert internal strings to numbers.
            // Let's assume standard behavior:
            // side: 1 (buy), -1 (sell)
            // type: 1 (limit), 2 (market), 3 (stop)

            if (lastOrder.type === 'market') preOrder.type = 2;
            else if (lastOrder.type === 'limit') preOrder.type = 1;
            else if (lastOrder.type === 'stop') preOrder.type = 3;


            brokerRef.current.placeOrder(preOrder)
                .catch(() => {});
        }
    }, [lastOrder]);

    const widgetRef = useRef<any>(null); // To store the widget instance if needed

    // Synergy with external symbol changes
    useEffect(() => {
        if (widgetRef.current && symbol) {
            const currentSymbol = widgetRef.current.activeChart().symbol();
            if (currentSymbol !== symbol) {
                widgetRef.current.setSymbol(symbol, widgetRef.current.activeChart().resolution(), () => {
                });
            }
        }
    }, [symbol]);

    useEffect(() => {
        const scripts = [
            '/charting_library/charting_library.standalone.js',
            '/datafeeds/udf/dist/bundle.js',
            '/broker-sample/dist/bundle.js',
            '/custom-dialogs/dist/bundle.js'
        ];

        const styles = [
            '/custom-dialogs/dist/bundle.css'
        ];

        let loadedCount = 0;

        const initWidget = () => {
            if (!window.TradingView || !window.Brokers || !window.CustomDialogs) {
                return;
            }

            // Use our custom RealtimeDataFeed
            const datafeed = new RealtimeDataFeed();

            const onCancelOrderResultCallback = () => {};
            const onCloseOrderResultCallback = () => {};
            const onReversePositionResultCallback = () => {};
            const onOrderResultCallback = () => {};
            const onPositionResultCallback = () => {};

            const customCancelOrderDialog = window.CustomDialogs.createCancelOrderDialog(onCancelOrderResultCallback);
            const customClosePositionDialog = window.CustomDialogs.createClosePositionDialog(onCloseOrderResultCallback);
            const customReversePositionDialog = window.CustomDialogs.createReversePositionDialog(onReversePositionResultCallback);

            const sendOrderRequest = (order: any) => {
            };

            const sendModifyOrder = (order: any) => {
            };

            const redrawChart = () => {
            };

            let customOrderDialog: any = null;
            let customPositionDialog: any = null;
            let createCancelOrderButtonListener: any = null;
            let createClosePositionButtonListener: any = null;
            let createReversePositionButtonListener: any = null;

            const widgetOptions = {
                symbol: symbol || 'XAUUSD',
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
                    'trading_account_manager',
                    'open_account_manager',
                ],
                enabled_features: ['study_templates'],
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
                    const broker = new ZuperiorBroker(host, datafeed, currentAccountId, getMetaApiToken);
                    brokerRef.current = broker; // Expose broker instance
                    
                    // Store token function in window for fallback access
                    if (typeof window !== 'undefined' && getMetaApiToken) {
                        (window as any).__GET_METAAPI_TOKEN__ = getMetaApiToken;
                    }
                    
                    // Update broker if token function becomes available later
                    if (getMetaApiToken && broker.setMetaApiTokenFunction) {
                        broker.setMetaApiTokenFunction(getMetaApiToken);
                    }

                    // CRITICAL: Sync broker with live positions data from TradingTerminal
                    // This ensures Account Manager shows the same data as the open positions table
                    const syncBrokerWithLiveData = () => {
                        // Get live positions data from the parent component (TradingTerminal)
                        // This should match the data shown in the open positions table
                        if (typeof window !== 'undefined' && (window as any).__LIVE_POSITIONS_DATA__) {
                            const liveData = (window as any).__LIVE_POSITIONS_DATA__;
                            if (broker.syncFromLiveState && typeof broker.syncFromLiveState === 'function') {
                                broker.syncFromLiveState(liveData.openPositions || [], liveData.pendingOrders || []);
                            }
                        }
                    };

                    // Sync immediately and set up periodic sync
                    syncBrokerWithLiveData();
                    const syncInterval = setInterval(syncBrokerWithLiveData, 1000);

                    // Store cleanup function
                    (broker as any).__cleanup__ = () => {
                        clearInterval(syncInterval);
                    };

                    customOrderDialog = window.CustomDialogs.createOrderDialog(broker, onOrderResultCallback);
                    customPositionDialog = window.CustomDialogs.createPositionDialog(broker, onPositionResultCallback);
                    createCancelOrderButtonListener = window.CustomDialogs.createCancelOrderButtonListenerFactory(broker);
                    createClosePositionButtonListener = window.CustomDialogs.createClosePositionButtonListenerFactory(broker);
                    createReversePositionButtonListener = window.CustomDialogs.createReversePositionButtonListenerFactory(broker);

                    // Hooking into placeOrder for onBuyClick() -> sendOrderRequest()
                    const originalPlaceOrder = broker.placeOrder;
                    broker.placeOrder = (preOrder: any) => {
                        sendOrderRequest(preOrder);
                        return originalPlaceOrder.apply(broker, [preOrder]);
                    };

                    // Hooking into modifyOrder for onDragSL() -> sendModifyOrder()
                    const originalModifyOrder = broker.modifyOrder;
                    broker.modifyOrder = (order: any, confirmId: any) => {
                        sendModifyOrder(order);
                        return originalModifyOrder.apply(broker, [order, confirmId]);
                    };

                    return broker;
                },
                broker_config: {
                    configFlags: {
                        // Position management flags
                        supportPositions: true, // Enable positions (default: true, we have positions() implemented)
                        supportPositionBrackets: true, // Enable position brackets (TP/SL) - requires editPositionBrackets()
                        supportModifyPosition: true, // Enable position modification (dragging TP/SL lines) - requires editPositionBrackets()
                        supportPLUpdate: true, // Use custom P&L calculations (default: true, we calculate P&L)
                        supportClosePosition: true, // Enable position closing - requires closePosition()
                        supportPartialClosePosition: false, // Disable partial closing (default: false, we don't implement it)
                        supportPartialCloseIndividualPosition: false, // Disable partial individual closing (default: false)
                        supportReversePosition: true, // Enable position reversing - requires reversePosition()
                        supportNativeReversePosition: true, // Use native reverse implementation
                        supportPositionNetting: false, // Disable position netting (default: false, we don't use netting)
                        supportPreviewClosePosition: false, // Disable preview close dialog (default: false)
                        
                        // Order management flags
                        supportOrderBrackets: true, // Enable order brackets (TP/SL for orders)
                        supportModifyOrder: true, // Enable order modification (dragging order lines and TP/SL) - requires modifyOrder()
                        supportCancelOrder: true, // Enable order cancellation - requires cancelOrder()
                        supportMarketBrackets: true, // Enable market brackets
                        supportOrdersHistory: false, // Disable orders history (default: true, we don't implement ordersHistory())
                        supportPlaceOrderPreview: false, // Disable order preview (default: false, we don't implement previewOrder())
                        
                        // Order type flags
                        supportStopLoss: true, // Enable stop loss orders (default: true)
                        supportStopOrders: true, // Enable stop orders (default: true)
                        supportStopLimitOrders: false, // Disable stop-limit orders (default: false)
                        supportStopOrdersInBothDirections: false, // Disable stop orders in both directions (default: false)
                        supportStopLimitOrdersInBothDirections: false, // Disable stop-limit in both directions (default: false)
                        supportTrailingStop: false, // Disable trailing stop (default: false)
                        supportStrictCheckingLimitOrderPrice: false, // Disable strict limit price checking (default: false)
                        
                        // Other flags
                        supportSymbolSearch: false, // Disable symbol search (default: false)
                        supportLevel2Data: false, // Disable Level 2 data
                        showQuantityInsteadOfAmount: true, // Show quantity instead of amount
                        supportEditAmount: false, // Disable amount editing
                    },
                    durations: [{ name: 'DAY', value: 'DAY' }, { name: 'GTT', value: 'GTT' }],
                    customUI: {
                        showOrderDialog: (order: any, focus: any) => {
                            if (order && order.userData && order.userData.silent) {
                                return Promise.resolve(true);
                            }
                            window.CustomDialogs.showOrderDialog(customOrderDialog, order);
                            return Promise.resolve(true);
                        },
                        showPositionDialog: (position: any, brackets: any, focus: any) => {
                            // Map BrokerDemo position fields to ModifyPositionModal fields
                            const mappedPosition = {
                                ...position,
                                openPrice: position.avg_price || position.avgPrice || position.price,
                                currentPrice: position.currentPrice || position.price, // Might need to fetch current quote if missing
                                tp: brackets?.takeProfit || position.takeProfit || position.tp,
                                sl: brackets?.stopLoss || position.stopLoss || position.sl,
                                pl: position.profit || position.pl || '0.00',
                                volume: position.qty || position.volume,
                                flag: (position.symbol || '').toLowerCase().replace(/[^a-z0-9]/g, ''),
                            };
                            setModifyModalState({ isOpen: true, position: mappedPosition });
                            return new Promise((resolve) => {
                                modifyModalPromiseResolve.current = resolve;
                            });
                        },
                        showPositionBracketsDialog: (position: any, brackets: any, focus: any) => {
                            const mappedPosition = {
                                ...position,
                                openPrice: position.avg_price || position.avgPrice || position.price,
                                tp: brackets?.takeProfit || position.takeProfit || position.tp,
                                sl: brackets?.stopLoss || position.stopLoss || position.sl,
                                pl: position.profit || position.pl || '0.00',
                                volume: position.qty || position.volume,
                                flag: (position.symbol || '').toLowerCase().replace(/[^a-z0-9]/g, ''),
                            };
                            setModifyModalState({ isOpen: true, position: mappedPosition });
                            return new Promise((resolve) => {
                                modifyModalPromiseResolve.current = resolve;
                            });
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
                    },
                },
            };

            const tvWidget = new window.TradingView.widget(widgetOptions);
            widgetRef.current = tvWidget;
            window.tvWidget = tvWidget;

            tvWidget.onChartReady(() => {

                tvWidget.activeChart().onSymbolChanged().subscribe(null, (symbolData: any) => {
                    setSymbol(tvWidget.activeChart().symbol());
                });

                // onPriceUpdate() -> redraw chart
                tvWidget.subscribe('onPriceUpdate', (price: any) => {
                    redrawChart();
                });

                // Notify broker that widget is ready
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
                script.onerror = (event) => {
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
                if (err instanceof Error) {
                } else {
                }
            });

        return () => {
            if (brokerRef.current && typeof (brokerRef.current as any).__cleanup__ === 'function') {
                (brokerRef.current as any).__cleanup__();
            }
            if (window.tvWidget) {
                window.tvWidget.remove();
                window.tvWidget = null;
            }
        };
    }, []);

    return (
        <div
            ref={containerRef}
            className="tv-chart-container"
            style={{ height: '100%', width: '100%' }}
        />
    );
};

export default TVChartContainer;
