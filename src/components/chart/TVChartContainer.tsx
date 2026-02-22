'use client';

import React, { useEffect, useRef, useState } from 'react';

import { RealtimeDataFeed } from './RealtimeDataFeed';
import { ZuperiorBroker, PREVIEW_ORDER_ID, PREVIEW_POSITION_ID } from './ZuperiorBroker';
import { formatSymbolDisplay } from '@/lib/utils';


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
import { useAuth } from '@/context/AuthContext';
import { useWebSocket } from '@/context/WebSocketContext';
import { useInstruments } from '@/context/InstrumentContext';
import { checkIsMarketClosed } from '@/lib/utils';
import { useCallback } from 'react';

export const TVChartContainer = () => {
    const containerRef = useRef<HTMLDivElement>(null);
    const brokerRef = useRef<any>(null);
    const widgetRef = useRef<any>(null);
    const { setModifyModalState, lastModification, modifyModalState } = useTrading();
    const { currentAccountId, getMetaApiToken, currentBalance } = useAccount();
    const { lastQuotes, normalizeSymbol } = useWebSocket();
    const { instruments } = useInstruments();
    const modifyModalPromiseResolve = useRef<((value: boolean) => void) | null>(null);

    // Market closed helper (Sync with ZuperiorBroker)
    const isMarketClosed = useCallback((sym: string) => {
        if (!sym) return false;
        const norm = normalizeSymbol(sym);
        const inst = instruments.find(i => normalizeSymbol(i.symbol) === norm || i.symbol === sym);
        const quote = lastQuotes[norm] || lastQuotes[sym] || {};
        return checkIsMarketClosed(sym, inst?.category || inst?.group || '', quote.bid, quote.ask);
    }, [instruments, lastQuotes, normalizeSymbol]);

    // Keep Broker instance sync with validation state
    useEffect(() => {
        if (brokerRef.current) {
            brokerRef.current.setValidationFunctions({
                getFreeMargin: () => currentBalance?.freeMargin ?? 0,
                isMarketClosed
            });
        }
    }, [currentBalance, isMarketClosed]);

    const { chartSettings } = useTrading();

    // Sync visibility settings to broker
    useEffect(() => {
        if (brokerRef.current) {
            brokerRef.current.setChartSettings(chartSettings);
        }
    }, [chartSettings]);

    // Standalone state (Keeping symbol state from standalone for now, or should we use TradingContext symbol?)
    // Let's use TradingContext symbol if available, otherwise fallback
    const { symbol: ctxSymbol, setSymbol: ctxSetSymbol } = useTrading();
    const [localSymbol, setLocalSymbol] = useState('XAUUSD'); // Default fallback

    const activeSymbol = formatSymbolDisplay(ctxSymbol || localSymbol);
    const setSymbol = ctxSetSymbol || setLocalSymbol;

    // Expose openModifyPositionModal to window for Broker to use
    const openModifyPositionModal = (position: any, brackets?: any) => {
        const mappedPosition = {
            ...position,
            openPrice: position.avg_price || position.avgPrice || position.price || position.limitPrice || position.stopPrice || position.openPrice,
            currentPrice: position.currentPrice || position.price || position.limitPrice || position.stopPrice,
            tp: brackets?.takeProfit || position.takeProfit || position.tp,
            sl: brackets?.stopLoss || position.stopLoss || position.sl,
            pl: position.profit || position.pl || '0.00',
            volume: position.qty || position.volume,
            flag: (position.symbol || '').toLowerCase().replace(/[^a-z0-9]/g, ''),
            ticket: position.id, // Ensure ticket is set for orders
            type: position.typeText || position.type,
            isOrder: !!(position.limitPrice !== undefined || position.stopPrice !== undefined || position.parentId)
        };
        setModifyModalState({ isOpen: true, position: mappedPosition });
        return new Promise<boolean>((resolve) => {
            modifyModalPromiseResolve.current = resolve;
        });
    };

    // Helper to clear all preview lines
    const clearPreviewLines = () => {
        if (brokerRef.current && typeof brokerRef.current.setOrderPreview === 'function') {
            brokerRef.current.setOrderPreview(null);
        }
    };

    useEffect(() => {
        if (typeof window !== 'undefined') {
            (window as any).__OPEN_MODIFY_POSITION_MODAL__ = openModifyPositionModal;
            (window as any).__SET_ORDER_PREVIEW__ = async (previewData: any) => {
                if (!widgetRef.current) return;
                const chart = widgetRef.current.activeChart();
                if (!chart) return;

                if (!previewData || !previewData.symbol) {
                    clearPreviewLines();
                    return;
                }

                // Use the broker-based simulation method
                if (brokerRef.current && typeof brokerRef.current.setOrderPreview === 'function') {
                    brokerRef.current.setOrderPreview(previewData);
                }
            };
        }
    }, [setModifyModalState]);

    // Resolve the promise when the modal closes
    useEffect(() => {
        if (!modifyModalState.isOpen && modifyModalPromiseResolve.current) {
            // If we have a pending promise and the modal closes
            // Check if a modification was made (lastModification set) to determine success
            // But usually just resolving 'false' or 'true' makes the chart proceed.
            // If we resolve 'false', it cancels drag. If 'true', it generally accepts.
            // If the user Saved, 'lastModification' is set, so we can assume success?
            // Actually, if update is handled via broker.modifyEntity, the chart gets the update event.
            // So for the *dialog result*, we can just say 'false' (cancel internal handling) or 'true'.
            // If we return 'true', the chart might try to apply changes itself if we returned an object.
            // But we return boolean.
            // Let's resolve 'false' to ensure the chart doesn't do anything weird, 
            // relying on our explicit 'modifyEntity' call to update the order.
            // Or if we return 'true', it might imply "user confirmed".

            // NOTE: If we dragged, and then closed modal without saving, we want it to snap back.
            // If we saved, our 'modifyEntity' will update the order, and chart will see the update.
            // So resolving 'false' might be safer to prevent double-modification or stuck state?
            // Let's try resolving true if lastModification is present, false otherwise.
            const wasSaved = !!lastModification;
            console.log('[TVChartContainer] Modal closed. Resolving hook promise:', wasSaved);
            modifyModalPromiseResolve.current(wasSaved);
            modifyModalPromiseResolve.current = null;
        }
    }, [modifyModalState.isOpen, lastModification]);

    useEffect(() => {
        if (lastModification && brokerRef.current) {
            console.log('[TVChartContainer] lastModification received:', lastModification);

            if (brokerRef.current.modifyEntity) {
                brokerRef.current.modifyEntity(lastModification.id, lastModification)
                    .catch((err: any) => console.error(err));
            } else if (brokerRef.current.editPositionBrackets) {
                // Fallback (legacy)
                const sl = lastModification.sl ? parseFloat(lastModification.sl) : undefined;
                const tp = lastModification.tp ? parseFloat(lastModification.tp) : undefined;
                const modifiedBrackets = {
                    ...(sl !== undefined && !isNaN(sl) ? { stopLoss: sl } : {}),
                    ...(tp !== undefined && !isNaN(tp) ? { takeProfit: tp } : {}),
                    _skipModal: true,
                };
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
                    'right_toolbar',
                    'legend_show_volume',
                    'header_symbol_search',
                    'symbol_search_hot_key',
                    'header_compare',
                    'buy_sell_buttons',
                    'objects_tree_widget',
                    'trading_notifications',
                    'trading_account_manager',
                    'create_volume_indicator_by_default', // Removed default volume study/legend
                ],
                enabled_features: [
                    'study_templates',
                    'trading_bracket_orders',
                    'countdown',
                    'high_density_bars',
                    'seconds_resolution',
                ],
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
                    "tradingProperties.showOrderPrice": true,
                    "tradingProperties.showOrderType": false,
                    "mainSeriesProperties.showCountdown": true,
                    "scalesProperties.showSeriesLastValue": true,
                    "scalesProperties.showSymbolLabels": false,
                },
                toolbar_bg: '#02040d',

                // Customize available timeframes
                favorites: {
                    intervals: ['1', '3', '5', '15', '30', '60', '240', '1D', '1W', '1M'],
                    chartTypes: ["1"]
                },
                time_frames: [
                    { text: "1m", resolution: "1", description: "1 Minute" },
                    { text: "3m", resolution: "3", description: "3 Minutes" },
                    { text: "5m", resolution: "5", description: "5 Minutes" },
                    { text: "15m", resolution: "15", description: "15 Minutes" },
                    { text: "30m", resolution: "30", description: "30 Minutes" },
                    { text: "1h", resolution: "60", description: "1 Hour" },
                    { text: "4h", resolution: "240", description: "4 Hours" },
                    { text: "1d", resolution: "1D", description: "1 Day" },
                    { text: "1w", resolution: "1W", description: "1 Week" },
                    { text: "1M", resolution: "1M", description: "1 Month" },
                ],

                broker_factory: (host: any) => {
                    // Pass getMetaApiToken to broker constructor to enable dynamic auth
                    const broker = new ZuperiorBroker(host, datafeed, currentAccountId, getMetaApiToken);
                    brokerRef.current = broker;

                    // Setup dialogs if available
                    if (window.CustomDialogs) {
                        customOrderDialog = window.CustomDialogs.createOrderDialog(broker, onOrderResultCallback);
                        customPositionDialog = window.CustomDialogs.createPositionDialog(broker, onPositionResultCallback);
                        // createCancelOrderButtonListener = window.CustomDialogs.createCancelOrderButtonListenerFactory(broker);

                        // Custom Close Position Listener: Bypass modal, call broker directly
                        createClosePositionButtonListener = () => (positionId: string) => {
                            console.log('[TVChartContainer] Custom close listener triggered for:', positionId);
                            broker.closePosition(positionId)
                                .then(() => console.log('Position closed successfully'))
                                .catch((e: any) => console.error('Failed to close position', e));
                        };

                        // createReversePositionButtonListener = window.CustomDialogs.createReversePositionButtonListenerFactory(broker);
                    }

                    return broker;
                },
                broker_config: {
                    configFlags: {
                        // Position management flags
                        supportPositions: true,
                        supportPositionBrackets: true,
                        supportIndividualPositionBrackets: true,
                        supportModifyPosition: true,
                        supportPLUpdate: true,
                        supportClosePosition: true,
                        supportReversePosition: false,
                        supportNativeReversePosition: false,
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
                        supportMoveOrder: true,
                        supportMoveOrderBrackets: true,
                        supportMovePosition: true,
                        supportMovePositionBrackets: true,
                        supportEditAmount: true,
                        supportDragToModify: true,

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
                            // console.log('[TVChartContainer] showOrderDialog called:', order.id, order.type);

                            // 1. ALWAYS bypass modal for preview order (GHOST line)
                            // There is no need for a modification dialog for a preview line,
                            // and this avoids the "race condition" where dragging triggers the modal.
                            if (order.id === PREVIEW_ORDER_ID || (order.id && order.id.toString().includes('GHOST'))) {
                                // console.log('[TVChartContainer] Suppressing dialog for preview order move/click.');
                                if (brokerRef.current) {
                                    brokerRef.current.editOrder(order.id, order)
                                        .catch((e: any) => console.error('Instant preview edit failed:', e));
                                }
                                return Promise.resolve(true); // true = handled, suppresses TV dialog
                            }

                            // 2. For real orders, we still want the dialog on click, 
                            // but we want to avoid showing it *if the user was clearly dragging*.
                            if (brokerRef.current) {
                                const currentOrder = (brokerRef.current as any)._orderById[order.id];
                                if (currentOrder) {
                                    const newPrice = order.limitPrice || order.stopPrice;
                                    const oldPrice = currentOrder.limitPrice || currentOrder.stopPrice;

                                    const priceChanged = Math.abs(newPrice - oldPrice) > 0.00001;
                                    const tpChanged = Math.abs((order.takeProfit || 0) - (currentOrder.takeProfit || 0)) > 0.00001;
                                    const slChanged = Math.abs((order.stopLoss || 0) - (currentOrder.stopLoss || 0)) > 0.00001;
                                    const qtyChanged = (order.qty !== undefined && order.qty !== currentOrder.qty);

                                    // If something major changed, it was likely a drag that moveOrder already handled.
                                    // We return true (handled) to prevent the dialog from popping up on mouse-up.
                                    if (priceChanged || tpChanged || slChanged || qtyChanged) {
                                        // console.log('[TVChartContainer] Detected drag finish for real order, suppressing dialog.');
                                        brokerRef.current.editOrder(order.id, order)
                                            .catch((e: any) => console.error('Instant real order edit failed:', e));
                                        return Promise.resolve(true);
                                    }
                                }
                            }

                            // 3. Fallback: Show the dialog (for manual clicks or if no changes detected)
                            return openModifyPositionModal(order);
                        },
                        showOrderBracketsDialog: (order: any, brackets: any) => {
                            // console.log('[TVChartContainer] Instant order bracket update:', order.id, brackets);
                            if (brokerRef.current) {
                                brokerRef.current.editOrder(order.id, { ...order, ...brackets })
                                    .catch((e: any) => console.error('Order bracket update failed:', e));
                            }
                            return Promise.resolve(true);
                        },
                        showPositionDialog: (position: any, brackets: any) => {
                            // console.log('[TVChartContainer] showPositionDialog called for:', position.id, 'with brackets:', brackets);
                            // Bypass modal for preview position or if ANY brackets are provided (usually indicates a drag)
                            if (position.id === PREVIEW_POSITION_ID || brackets) {
                                // console.log('[TVChartContainer] Instant position modification (likely drag):', position.id);
                                if (brokerRef.current) {
                                    brokerRef.current.editPositionBrackets(position.id, brackets)
                                        .catch((e: any) => console.error('Position dialog bracket update failed:', e));
                                }
                                return Promise.resolve(true);
                            }
                            return openModifyPositionModal(position, brackets);
                        },
                        showPositionBracketsDialog: (position: any, brackets: any) => {
                            // console.log('[TVChartContainer] Instant bracket update for position:', position.id, brackets);
                            if (brokerRef.current) {
                                brokerRef.current.editPositionBrackets(position.id, brackets)
                                    .catch((e: any) => console.error('Instant bracket update failed:', e));
                            }
                            return Promise.resolve(true);
                        },
                        showIndividualPositionBracketsDialog: (position: any, brackets: any) => {
                            console.log('[TVChartContainer] Instant individual bracket update for position:', position.id, brackets);
                            if (brokerRef.current) {
                                brokerRef.current.editPositionBrackets(position.id, brackets)
                                    .catch((e: any) => console.error('Instant individual bracket update failed:', e));
                            }
                            return Promise.resolve(true);
                        },
                        showCancelOrderDialog: (order: any) => {
                            // SKIP MODAL: Call broker directly for instant cancel
                            console.log('[TVChartContainer] Direct cancel triggered for order:', order.id);
                            if (brokerRef.current) {
                                brokerRef.current.cancelOrder(order.id)
                                    .catch((e: any) => console.error('Direct cancel failed', e));
                            }
                            return Promise.resolve(true);
                        },
                        showClosePositionDialog: (position: any) => {
                            // SKIP MODAL: Call broker directly for instant close
                            console.log('[TVChartContainer] Direct close triggered for:', position.id);
                            if (brokerRef.current) {
                                brokerRef.current.closePosition(position.id)
                                    .catch((e: any) => console.error('Direct close failed', e));
                            }
                            return Promise.resolve(true);
                        },
                        // Disable reverse dialog entirely
                        showReversePositionDialog: () => Promise.resolve(false),
                    }
                },
                trading_customization: {
                    brokerOrder: {
                        "buy.normal.borderBackgroundColor": "rgb(139,0,0)",
                        "buy.disabled.text.buttonTextColor": "rgb(139,0,0)",
                    },
                    brokerPosition: {
                        "buy.disabled.qty.textColor": "rgb(255,192,203)",
                        "buy.normal.borderColor": "rgb(255,192,203)",
                    },
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

                // Subscribe to real-time dragging for preview sync
                const chart = tvWidget.activeChart();

                // onOrderMove fires when the user release or modifies the line
                // We use a try-catch for robustness across different library builds
                try {
                    if (typeof (chart as any).onOrderMove === 'function') {
                        (chart as any).onOrderMove().subscribe(null, (order: any) => {
                            if (!order) return;
                            if (brokerRef.current && (order.id.toString().includes('GHOST_PREVIEW_ID') || order.id.toString().includes('PREVIEW_ORDER_ID'))) {
                                // TradingView can put the dragged price on different fields depending on line type
                                const movedPriceRaw = order.price ?? order.limitPrice ?? order.stopPrice;
                                const movedPrice = typeof movedPriceRaw === 'string' ? parseFloat(movedPriceRaw) : movedPriceRaw;
                                if (movedPrice === undefined || Number.isNaN(movedPrice)) return;
                                brokerRef.current.moveOrder(order.id, movedPrice);
                            }
                        });
                    }

                    if (typeof (chart as any).onPositionDrag === 'function') {
                        (chart as any).onPositionDrag().subscribe(null, (pos: any) => {
                            // Logic for position drag if needed
                        });
                    }
                } catch (e) {
                    console.error('[TVChartContainer] Error subscribing to chart events:', e);
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
