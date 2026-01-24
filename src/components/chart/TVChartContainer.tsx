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

export const TVChartContainer = () => {
    const containerRef = useRef<HTMLDivElement>(null);
    const brokerRef = useRef<any>(null);
    const { lastOrder, setSymbol } = useTrading();


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
            if (!window.TradingView || !window.Datafeeds || !window.Brokers || !window.CustomDialogs) {
                console.error('TradingView libraries not loaded yet');
                return;
            }

            const datafeedUrl = "https://demo-feed-data.tradingview.com";
            const datafeed = new window.Datafeeds.UDFCompatibleDatafeed(datafeedUrl, undefined, {
                maxResponseLength: 1000,
                expectedOrder: 'latestFirst',
            });

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
                symbol: 'AAPL',
                interval: '1D',
                container: containerRef.current!,
                datafeed: datafeed,
                library_path: '/charting_library/',
                locale: 'en',
                fullscreen: false,
                autosize: true,
                theme: 'Dark',
                disabled_features: [
                    'use_localstorage_for_settings',
                    'order_panel',
                    'widgetbar',
                    'dom_widget',
                    'right_toolbar',
                ],
                enabled_features: ['study_templates'],
                charts_storage_url: 'https://saveload.tradingview.com',
                charts_storage_api_version: '1.1',
                client_id: 'trading_platform_demo',
                user_id: 'public_user',

                broker_factory: (host: any) => {
                    const broker = new window.Brokers.BrokerDemo(host, datafeed);
                    brokerRef.current = broker; // Expose broker instance

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
            window.tvWidget = tvWidget;

            tvWidget.onChartReady(() => {
                console.log('Chart is ready');

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
                script.onload = resolve;
                script.onerror = reject;
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
            .catch(err => console.error('Error loading scripts:', err));

        return () => {
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
