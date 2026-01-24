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

export const TVChartContainer = () => {
    const containerRef = useRef<HTMLDivElement>(null);

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
                ],
                enabled_features: ['study_templates', 'dom_widget'],
                charts_storage_url: 'https://saveload.tradingview.com',
                charts_storage_api_version: '1.1',
                client_id: 'trading_platform_demo',
                user_id: 'public_user',

                widgetbar: {
                    details: true,
                    news: true,
                    watchlist: true,
                    datawindow: true,
                    watchlist_settings: {
                        default_symbols: ["MSFT", "IBM", "AAPL"]
                    }
                },

                broker_factory: (host: any) => {
                    const broker = new window.Brokers.BrokerDemo(host, datafeed);
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
                            window.CustomDialogs.showOrderDialog(customOrderDialog, order);
                            return Promise.resolve(true); // Placeholder promise handling
                        },
                        showPositionDialog: (position: any, brackets: any, focus: any) => {
                            window.CustomDialogs.showPositionDialog(customPositionDialog, position, brackets);
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
