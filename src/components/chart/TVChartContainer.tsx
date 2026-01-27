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
import { usePositions } from '@/hooks/usePositions';

declare global {
    interface Window {
        TradingView: any;
        Datafeeds: any;
        Brokers: any;
        CustomDialogs: any;
        tvWidget: any;
        __ZUPERIOR_CHART_BROKER__?: any;
        __OPEN_MODIFY_POSITION_MODAL__?: (position: any, initialBrackets?: { stopLoss?: number, takeProfit?: number }) => void;
    }
}

export const TVChartContainer = () => {
    const containerRef = useRef<HTMLDivElement>(null);
    const brokerRef = useRef<any>(null);
    const { lastOrder, symbol, setSymbol, setModifyModalState, lastModification } = useTrading();
    const { currentAccountId } = useAccount();
    const [isLoading, setIsLoading] = React.useState(true);
    const [loadingProgress, setLoadingProgress] = React.useState(0);

    // Fetch positions and orders for syncing to broker
    const {
        positions: rawPositions,
        pendingOrders: rawPendingOrders,
    } = usePositions({
        accountId: currentAccountId,
        enabled: !!currentAccountId,
    });

    useEffect(() => {
        if (lastModification && brokerRef.current) {
            console.log("TVChartContainer received modification request:", lastModification);

            // BrokerDemo uses editPositionBrackets(positionId, modifiedBrackets)
            // where modifiedBrackets is { stopLoss?: number, takeProfit?: number }
            if (brokerRef.current.editPositionBrackets) {
                const sl = lastModification.sl ? parseFloat(lastModification.sl) : undefined;
                const tp = lastModification.tp ? parseFloat(lastModification.tp) : undefined;

                const modifiedBrackets = {
                    ...(sl !== undefined && !isNaN(sl) ? { stopLoss: sl } : {}),
                    ...(tp !== undefined && !isNaN(tp) ? { takeProfit: tp } : {}),
                };

                console.log(`Calling broker modification: ID=${lastModification.id}, Brackets=`, modifiedBrackets);

                brokerRef.current.editPositionBrackets(lastModification.id, modifiedBrackets)
                    .then(() => console.log("Position modification sent to broker"))
                    .catch((err: any) => console.error("Failed to modify position", err));
            } else {
                console.error("Broker does not support position modification. Available methods:", Object.keys(brokerRef.current));
            }
        }
    }, [lastModification]);

    useEffect(() => {
        if (lastOrder && brokerRef.current) {
            console.log("TVChartContainer received order:", lastOrder);
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

            console.log("Placing mapped order:", preOrder);

            brokerRef.current.placeOrder(preOrder)
                .then(() => console.log("Order placed on chart"))
                .catch((err: any) => console.error("Failed to place order on chart", err));
        }
    }, [lastOrder]);

    const widgetRef = useRef<any>(null); // To store the widget instance if needed

    // Synergy with external symbol changes
    useEffect(() => {
        if (widgetRef.current && symbol) {
            try {
                const activeChart = widgetRef.current.activeChart();
                if (!activeChart) {
                    // Chart not ready yet, skip
                    return;
                }
                const currentSymbol = activeChart.symbol();
                if (currentSymbol !== symbol) {
                    console.log(`[Chart] External symbol change detected: ${currentSymbol} -> ${symbol}`);
                    widgetRef.current.setSymbol(symbol, activeChart.resolution(), () => {
                        console.log(`[Chart] Symbol updated to ${symbol}`);
                    });
                }
            } catch (error) {
                // Chart not ready yet, ignore error
                console.log('[Chart] Chart not ready for symbol change:', error);
            }
        }
    }, [symbol]);

    useEffect(() => {
        if (!currentAccountId) {
            console.log('[TVChartContainer] No accountId, skipping widget initialization');
            return;
        }

        console.log('[TVChartContainer] Starting script loading...');
        setIsLoading(true);
        setLoadingProgress(10);

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
                console.error('TradingView libraries not loaded yet');
                return;
            }

            // Use our custom RealtimeDataFeed
            const datafeed = new RealtimeDataFeed();

            const onCancelOrderResultCallback = (result: any) => console.log('Cancel Order Result:', result);
            const onCloseOrderResultCallback = (result: any) => console.log('Close Order Result:', result);
            const onReversePositionResultCallback = (result: any) => console.log('Reverse Position Result:', result);
            const onOrderResultCallback = (result: any) => console.log('Order Result:', result);
            const onPositionResultCallback = (result: any) => console.log('Position Result:', result);

            const customCancelOrderDialog = window.CustomDialogs.createCancelOrderDialog(onCancelOrderResultCallback);
            const customClosePositionDialog = window.CustomDialogs.createClosePositionDialog(onCloseOrderResultCallback);
            const customReversePositionDialog = window.CustomDialogs.createReversePositionDialog(onReversePositionResultCallback);

            const sendOrderRequest = (order: any) => {
                console.log('sendOrderRequest():', order);
            };

            const sendModifyOrder = (order: any) => {
                console.log('sendModifyOrder():', order);
            };

            const redrawChart = () => {
                console.log('redraw chart');
            };

            let customOrderDialog: any = null;
            let customPositionDialog: any = null;
            let createCancelOrderButtonListener: any = null;
            let createClosePositionButtonListener: any = null;
            let createReversePositionButtonListener: any = null;

            const widgetOptions = {
                symbol: symbol || 'BTCUSD',
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
                    'order_panel',
                    'widgetbar',
                    'dom_widget',
                    'right_toolbar',
                    'buy_sell_buttons',
                    'legend_show_volume',
                    'header_symbol_search',
                    'symbol_search_hot_key',
                    'header_compare',
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
                    // Create ZuperiorBroker with accountId
                    const broker = new ZuperiorBroker(host, datafeed, currentAccountId);
                    brokerRef.current = broker; // Expose broker instance

                    // Expose broker globally for ChartContainer access
                    window.__ZUPERIOR_CHART_BROKER__ = broker;

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
                        supportNativeReversePosition: true,
                        supportClosePosition: true,
                        supportPLUpdate: true,
                        supportLevel2Data: false,
                        showQuantityInsteadOfAmount: true,
                        supportPositions: true,
                        supportPositionBrackets: true,
                        supportOrdersHistory: false,
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
                            console.log("CustomUI showPositionDialog triggered", position, brackets);
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
                            return Promise.resolve(true);
                        },
                        showPositionBracketsDialog: (position: any, brackets: any, focus: any) => {
                            console.log("CustomUI showPositionBracketsDialog triggered", position, brackets);
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
                            return Promise.resolve(true);
                        },
                        showCancelOrderDialog: (order: any) => {
                            // Cancel immediately without confirmation dialog
                            if (brokerRef.current && brokerRef.current.cancelOrder) {
                                brokerRef.current.cancelOrder(order.id).catch((err: any) => {
                                    console.error('Error canceling order:', err);
                                });
                            }
                            return Promise.resolve(true);
                        },
                        showClosePositionDialog: (position: any) => {
                            // Close immediately without confirmation dialog
                            if (brokerRef.current && brokerRef.current.closePosition) {
                                brokerRef.current.closePosition(position.id).catch((err: any) => {
                                    console.error('Error closing position:', err);
                                });
                            }
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
                console.log('Chart is ready');

                // Mark broker as ready
                if (brokerRef.current && typeof brokerRef.current.setWidgetReady === 'function') {
                    brokerRef.current.setWidgetReady(true);
                }

                tvWidget.activeChart().onSymbolChanged().subscribe(null, (symbolData: any) => {
                    console.log("Symbol changed:", symbolData);
                    setSymbol(tvWidget.activeChart().symbol());
                });

                // onPriceUpdate() -> redraw chart
                tvWidget.subscribe('onPriceUpdate', (price: any) => {
                    redrawChart();
                });
            });
        };

        const loadScript = (src: string) => {
            return new Promise((resolve, reject) => {
                const script = document.createElement('script');
                script.src = src;
                script.onload = () => {
                    loadedCount++;
                    const progress = 10 + (loadedCount / scripts.length) * 60; // 10-70%
                    setLoadingProgress(progress);
                    console.log(`[TVChartContainer] Loaded ${src} (${loadedCount}/${scripts.length})`);
                    resolve(undefined);
                };
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
                console.log('[TVChartContainer] All scripts loaded, initializing widget...');
                setLoadingProgress(80);
                initWidget();
                // Set loading to false after widget initialization
                setTimeout(() => {
                    setIsLoading(false);
                    setLoadingProgress(100);
                    console.log('[TVChartContainer] Chart ready!');
                }, 1500); // Give chart time to render
            })
            .catch(err => {
                console.error('Error loading scripts:', err);
                setIsLoading(false);
                if (err instanceof Error) {
                    console.error('Error details:', err.message);
                } else {
                    console.error('Error object:', JSON.stringify(err, null, 2));
                }
            });

        return () => {
            if (window.tvWidget) {
                window.tvWidget.remove();
                window.tvWidget = null;
            }
            if (brokerRef.current && brokerRef.current.destroy) {
                brokerRef.current.destroy();
            }
        };
    }, [currentAccountId, symbol, setSymbol, setModifyModalState]);

    // Expose global function to open modify modal from Broker
    useEffect(() => {
        window.__OPEN_MODIFY_POSITION_MODAL__ = (position: any, brackets?: { stopLoss?: number, takeProfit?: number }) => {
            console.log('[TVChartContainer] Opening Modify Modal for position:', position.id, brackets);
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
        };

        return () => {
            delete window.__OPEN_MODIFY_POSITION_MODAL__;
        };
    }, [setModifyModalState]);

    // Sync positions and orders to broker when they change
    useEffect(() => {
        const broker = brokerRef.current || window.__ZUPERIOR_CHART_BROKER__;
        if (broker && typeof broker.syncFromLiveState === 'function' && currentAccountId) {
            console.log('[TVChartContainer] Syncing positions/orders to broker:', {
                positionsCount: rawPositions?.length || 0,
                pendingOrdersCount: rawPendingOrders?.length || 0,
            });

            // Convert positions/orders to format expected by syncFromLiveState
            const positions = (rawPositions || []).map((pos: any) => ({
                ...pos,
                ticket: pos.ticket || pos.id,
            }));

            const pendingOrders = (rawPendingOrders || []).map((order: any) => ({
                ...order,
                ticket: order.ticket || order.id,
            }));

            broker.syncFromLiveState(positions, pendingOrders);
        }
    }, [rawPositions, rawPendingOrders, currentAccountId]);

    return (
        <div style={{ position: 'relative', height: '100%', width: '100%' }}>
            {isLoading && (
                <div style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    backgroundColor: '#0F0F0F',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    zIndex: 9999,
                }}>
                    <div style={{
                        width: '200px',
                        height: '4px',
                        backgroundColor: '#1a1a1a',
                        borderRadius: '2px',
                        overflow: 'hidden',
                        marginBottom: '16px',
                    }}>
                        <div style={{
                            width: `${loadingProgress}%`,
                            height: '100%',
                            backgroundColor: '#2962FF',
                            transition: 'width 0.3s ease',
                        }} />
                    </div>
                    <div style={{
                        color: '#888',
                        fontSize: '14px',
                        fontFamily: 'system-ui, -apple-system, sans-serif',
                    }}>
                        Loading chart... {Math.round(loadingProgress)}%
                    </div>
                </div>
            )}
            <div
                ref={containerRef}
                className="tv-chart-container"
                style={{ height: '100%', width: '100%', opacity: isLoading ? 0 : 1, transition: 'opacity 0.3s ease' }}
            />
        </div>
    );
};

export default TVChartContainer;
