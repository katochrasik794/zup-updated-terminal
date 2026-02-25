'use client';
type Theme = 'light' | 'dark';

import React, { useEffect, useRef, useState, useCallback } from 'react';

import { RealtimeDataFeed } from './RealtimeDataFeed';
import { ZuperiorBroker, PREVIEW_ORDER_ID, PREVIEW_POSITION_ID } from './ZuperiorBroker';
import { formatSymbolDisplay } from '@/lib/utils';
import { LocalStorageSaveLoadAdapter } from './LocalStorageSaveLoadAdapter';
import { useTheme } from '../../context/ThemeContext';
import { useTrading } from '../../context/TradingContext';
import { useAccount } from '../../context/AccountContext';
import { useAuth } from '@/context/AuthContext';
import { useWebSocket } from '@/context/WebSocketContext';
import { useInstruments } from '@/context/InstrumentContext';
import { checkIsMarketClosed } from '@/lib/utils';

declare global {
    interface Window {
        TradingView: any;
        Datafeeds: any;
        Brokers: any;
        CustomDialogs: any;
        tvWidget: any;
        __GET_METAAPI_TOKEN__: any;
        __OPEN_MODIFY_POSITION_MODAL__: any;
        __SET_ORDER_PREVIEW__: any;
        __CONFIRMED_INJECTIONS__: any;
        __LIVE_POSITIONS_DATA__: any;
    }
}

export const TVChartContainer = (props: any) => {
    const { theme } = useTheme();
    const containerRef = useRef<HTMLDivElement>(null);
    const brokerRef = useRef<any>(null);
    const widgetRef = useRef<any>(null);
    const { setModifyModalState, lastModification, modifyModalState, chartSettings, symbol: ctxSymbol, setSymbol: ctxSetSymbol } = useTrading();
    const { currentAccountId, getMetaApiToken, currentBalance } = useAccount();
    const { lastQuotes, normalizeSymbol } = useWebSocket();
    const { instruments } = useInstruments();
    const modifyModalPromiseResolve = useRef<((value: boolean) => void) | null>(null);
    const isChartReady = useRef(false);

    // Standalone state
    const [localSymbol, setLocalSymbol] = useState('XAUUSD'); // Default fallback
    const activeSymbol = formatSymbolDisplay(ctxSymbol || localSymbol);
    const setSymbol = ctxSetSymbol || setLocalSymbol;

    // Market closed helper (Sync with ZuperiorBroker)
    const isMarketClosed = useCallback((sym: string) => {
        if (!sym) return false;
        const norm = normalizeSymbol(sym);
        const inst = instruments.find(i => normalizeSymbol(i.symbol) === norm || i.symbol === sym);
        const quote = lastQuotes[norm] || lastQuotes[sym] || {};
        return checkIsMarketClosed(sym, inst?.category || inst?.group || '', quote.bid, quote.ask);
    }, [instruments, lastQuotes, normalizeSymbol]);

    // Function to apply theme-specific overrides and change the native TV theme
    const applyTheme = useCallback((targetTheme: Theme) => {
        if (!window.tvWidget) return;

        try {
            const tvTheme = targetTheme === 'dark' ? 'Dark' : 'Light';

            const changePromise = (window.tvWidget as any).changeTheme
                ? (window.tvWidget as any).changeTheme(tvTheme)
                : Promise.resolve();

            changePromise.then(() => {
                const isDark = targetTheme === 'dark';
                const bg = isDark ? '#01040d' : '#ffffff';
                const grid = isDark ? 'rgba(0, 0, 0, 0)' : '#F3F4F6';
                const text = isDark ? '#9CA3AF' : '#4B5563';
                const crosshair = isDark ? '#374151' : '#D1D5DB';

                (window.tvWidget as any).applyOverrides({
                    "paneProperties.background": bg,
                    "paneProperties.vertGridProperties.color": grid,
                    "paneProperties.horzGridProperties.color": grid,
                    "scalesProperties.textColor": text,
                    "crossHairProperties.color": crosshair,
                    "mainSeriesProperties.bidLineColor": "#EF4444",
                    "mainSeriesProperties.askLineColor": "#3B82F6",
                });
            }).catch((e: any) => {
                console.warn('[TVChartContainer] Error in changeTheme promise:', e);
            });
        } catch (e) {
            console.warn('[TVChartContainer] Failed to apply theme', e);
        }
    }, []);

    // Effect to update chart theme when context changes
    useEffect(() => {
        if (isChartReady.current) {
            applyTheme(theme);
        }
    }, [theme, applyTheme]);

    // Keep Broker instance sync with validation state
    useEffect(() => {
        if (brokerRef.current) {
            brokerRef.current.setValidationFunctions({
                getFreeMargin: () => currentBalance?.freeMargin ?? 0,
                isMarketClosed
            });
        }
    }, [currentBalance, isMarketClosed]);

    // Sync visibility settings to broker
    useEffect(() => {
        if (brokerRef.current) {
            brokerRef.current.setChartSettings(chartSettings);
        }
    }, [chartSettings]);

    // Helper to clear all preview lines
    const clearPreviewLines = useCallback(() => {
        if (brokerRef.current && typeof brokerRef.current.setOrderPreview === 'function') {
            brokerRef.current.setOrderPreview(null);
        }
    }, []);

    // Expose openModifyPositionModal to window for Broker to use
    const openModifyPositionModal = useCallback((position: any, brackets?: any) => {
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
    }, [setModifyModalState]);

    useEffect(() => {
        if (typeof window !== 'undefined') {
            (window as any).__OPEN_MODIFY_POSITION_MODAL__ = openModifyPositionModal;
            (window as any).__GET_METAAPI_TOKEN__ = getMetaApiToken;
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
    }, [openModifyPositionModal, clearPreviewLines]);

    // Resolve the promise when the modal closes
    useEffect(() => {
        if (!modifyModalState.isOpen && modifyModalPromiseResolve.current) {
            const wasSaved = !!lastModification;
            modifyModalPromiseResolve.current(wasSaved);
            modifyModalPromiseResolve.current = null;
        }
    }, [modifyModalState.isOpen, lastModification]);

    // Handle modifications from modal
    useEffect(() => {
        if (lastModification && brokerRef.current) {
            if (brokerRef.current.modifyEntity) {
                brokerRef.current.modifyEntity(lastModification.id, lastModification)
                    .catch((err: any) => console.error(err));
            }
        }
    }, [lastModification]);

    useEffect(() => {
        const scripts = [
            '/charting_library/charting_library.standalone.js?v=30.3.0',
            '/datafeeds/udf/dist/bundle.js',
            '/broker-sample/dist/bundle.js',
            '/custom-dialogs/dist/bundle.js'
        ];

        const styles = ['/custom-dialogs/dist/bundle.css'];

        const initWidget = () => {
            if (!window.TradingView || !window.Brokers || !window.CustomDialogs) return;

            const datafeed = new RealtimeDataFeed();

            const widgetOptions: any = {
                symbol: activeSymbol,
                interval: '5',
                container: containerRef.current!,
                datafeed: datafeed,
                library_path: '/charting_library/',
                locale: 'en',
                fullscreen: false,
                autosize: true,
                theme: theme === 'dark' ? 'Dark' : 'Light',
                custom_css_url: '/chart-custom.css',
                allow_symbol_change: true,
                disabled_features: [
                    'use_localstorage_for_settings', 'widgetbar', 'right_toolbar', 'legend_show_volume',
                    'header_symbol_search', 'symbol_search_hot_key', 'header_compare', 'buy_sell_buttons',
                    'objects_tree_widget', 'trading_notifications', 'trading_account_manager',
                    'create_volume_indicator_by_default',
                ],
                enabled_features: [
                    'study_templates', 'trading_bracket_orders', 'countdown',
                    'high_density_bars', 'seconds_resolution',
                    'bid_ask_labels', 'bid_ask_lines', 'horizontal_line_for_bid_ask', 'price_line',
                ],
                save_load_adapter: new LocalStorageSaveLoadAdapter(),
                auto_save_delay: 5,
                load_last_chart: true,
                custom_translate_function: (key: string) => {
                    if (key === 'Ask' || key === 'Bid' || key === 'ask' || key === 'bid' || key === 'Ask / Bid' || key === 'Bid / Ask') {
                        return '';
                    }
                    return null; // fallback to default translation
                },
                loading_screen: {
                    backgroundColor: theme === 'dark' ? "#01040d" : "#ffffff",
                    foregroundColor: "#8B5CF6"
                },
                overrides: {
                    "paneProperties.background": theme === 'dark' ? "#01040d" : "#ffffff",
                    "paneProperties.backgroundType": "solid",
                    "paneProperties.vertGridProperties.color": theme === 'dark' ? "rgba(0, 0, 0, 0)" : "#F3F4F6",
                    "paneProperties.horzGridProperties.color": theme === 'dark' ? "rgba(0, 0, 0, 0)" : "#F3F4F6",
                    "scalesProperties.textColor": theme === 'dark' ? "#9CA3AF" : "#4B5563",
                    "crossHairProperties.color": theme === 'dark' ? "#374151" : "#D1D5DB",
                    "mainSeriesProperties.candleStyle.upColor": "#16A34A",
                    "mainSeriesProperties.candleStyle.downColor": "#EF4444",
                    // Bid/Ask lines visible by default
                    "mainSeriesProperties.showBidPriceLine": true,
                    "mainSeriesProperties.showAskPriceLine": true,
                    "mainSeriesProperties.bidLineColor": "#EF4444",
                    "mainSeriesProperties.askLineColor": "#3B82F6",
                    "mainSeriesProperties.bidLineStyle": 1,
                    "mainSeriesProperties.askLineStyle": 1,
                    "mainSeriesProperties.bidLineWidth": 1,
                    "mainSeriesProperties.askLineWidth": 1,
                    "tradingProperties.showBidPriceLine": true,
                    "tradingProperties.showAskPriceLine": true,
                    "mainSeriesProperties.bidAsk.lines.visible": true,
                    "mainSeriesProperties.bidAsk.labels.visible": true,
                    "mainSeriesProperties.bidAsk.bidLineColor": "#EF4444",
                    "mainSeriesProperties.bidAsk.askLineColor": "#3B82F6",
                    "mainSeriesProperties.bidAsk.bidLineStyle": 1,
                    "mainSeriesProperties.bidAsk.askLineStyle": 1,
                },
                broker_factory: (host: any) => {
                    const broker = new ZuperiorBroker(host, datafeed, currentAccountId, getMetaApiToken);
                    brokerRef.current = broker;
                    return broker;
                },
                broker_config: {
                    configFlags: {
                        supportPositions: true, supportPositionBrackets: true, supportIndividualPositionBrackets: true,
                        supportModifyPosition: true, supportPLUpdate: true, supportClosePosition: true,
                        supportOrders: true, supportOrderBrackets: true, supportModifyOrder: true,
                        supportCancelOrder: true, supportCloseOrder: true, supportMarketBrackets: true,
                        supportModifyOrderPrice: true, supportModifyOrderBrackets: true,
                        supportMoveOrder: true, supportMovePosition: true, supportDragToModify: true,
                        supportStopLoss: true, supportStopOrders: true, supportTrailingStop: true, supportMultiposition: true,
                        showQuantityInsteadOfAmount: true, supportPlaceOrderPreview: true,
                        supportReversePosition: false, supportNativeReversePosition: false
                    },
                    customUI: {
                        showOrderDialog: (order: any) => {
                            if (order.id === PREVIEW_ORDER_ID || (order.id && order.id.toString().includes('GHOST'))) {
                                if (brokerRef.current) {
                                    brokerRef.current.editOrder(order.id, order).catch(() => { });
                                }
                                return Promise.resolve(true);
                            }
                            if (brokerRef.current) {
                                const currentOrder = (brokerRef.current as any)._orderById[order.id];
                                if (currentOrder) {
                                    const newPrice = order.limitPrice || order.stopPrice;
                                    const oldPrice = currentOrder.limitPrice || currentOrder.stopPrice;
                                    const priceChanged = Math.abs(newPrice - oldPrice) > 0.00001;

                                    const newTP = order.takeProfit || 0;
                                    const oldTP = currentOrder.takeProfit || 0;
                                    const tpChanged = Math.abs(newTP - oldTP) > 0.00001;

                                    const newSL = order.stopLoss || 0;
                                    const oldSL = currentOrder.stopLoss || 0;
                                    const slChanged = Math.abs(newSL - oldSL) > 0.00001;

                                    if (priceChanged || tpChanged || slChanged) {
                                        brokerRef.current.editOrder(order.id, order).catch(() => { });
                                        return Promise.resolve(true);
                                    }
                                }
                            }
                            return openModifyPositionModal(order);
                        },
                        showPositionDialog: (position: any, brackets: any) => {
                            if (position.id === PREVIEW_POSITION_ID || brackets) {
                                if (brokerRef.current) {
                                    brokerRef.current.editPositionBrackets(position.id, brackets).catch(() => { });
                                }
                                return Promise.resolve(true);
                            }
                            return openModifyPositionModal(position, brackets);
                        },
                        showCancelOrderDialog: (order: any) => {
                            if (brokerRef.current) brokerRef.current.cancelOrder(order.id).catch(() => { });
                            return Promise.resolve(true);
                        },
                        showClosePositionDialog: (position: any) => {
                            if (brokerRef.current) brokerRef.current.closePosition(position.id).catch(() => { });
                            return Promise.resolve(true);
                        }
                    }
                }
            };

            const tvWidget = new window.TradingView.widget(widgetOptions);
            widgetRef.current = tvWidget;
            window.tvWidget = tvWidget;

            tvWidget.onChartReady(() => {
                isChartReady.current = true;
                applyTheme(theme);
                const chart = tvWidget.activeChart();

                tvWidget.applyOverrides({
                    "paneProperties.vertGridProperties.color": theme === 'dark' ? "rgba(0, 0, 0, 0)" : "#F3F4F6",
                    "paneProperties.horzGridProperties.color": theme === 'dark' ? "rgba(0, 0, 0, 0)" : "#F3F4F6",
                    "scalesProperties.showSeriesLastValue": false,
                    "scalesProperties.showSymbolLabels": false,
                    "mainSeriesProperties.showCountdown": false,
                    "mainSeriesProperties.showBidPriceLine": true,
                    "mainSeriesProperties.showAskPriceLine": true,
                    "mainSeriesProperties.bidLineColor": "#EF4444",
                    "mainSeriesProperties.askLineColor": "#3B82F6",
                    "mainSeriesProperties.bidLineStyle": 1,
                    "mainSeriesProperties.askLineStyle": 1,
                    "mainSeriesProperties.bidLineWidth": 1,
                    "mainSeriesProperties.askLineWidth": 1,
                    "tradingProperties.showBidPriceLine": true,
                    "tradingProperties.showAskPriceLine": true,
                    "tradingProperties.bidLineColor": "#EF4444",
                    "tradingProperties.askLineColor": "#3B82F6",
                    "mainSeriesProperties.bidAsk.visible": true,
                    "scalesProperties.showBidAskLabels": true,
                    "mainSeriesProperties.bidAsk.lines.visible": true,
                    "mainSeriesProperties.bidAsk.labels.visible": true,
                    "mainSeriesProperties.bidAsk.bidLineColor": "#EF4444",
                    "mainSeriesProperties.bidAsk.askLineColor": "#3B82F6",
                    "mainSeriesProperties.bidAsk.bidLineStyle": 1,
                    "mainSeriesProperties.bidAsk.askLineStyle": 1,
                });

                chart.onSymbolChanged().subscribe(null, () => {
                    if (setSymbol) setSymbol(chart.symbol());
                });

                if (brokerRef.current && typeof brokerRef.current.setWidgetReady === 'function') {
                    brokerRef.current.setWidgetReady(true);
                }

                try {
                    if (typeof (chart as any).onOrderMove === 'function') {
                        (chart as any).onOrderMove().subscribe(null, (order: any) => {
                            if (!order || !brokerRef.current) return;
                            if (order.id.toString().includes('GHOST_PREVIEW_ID') || order.id.toString().includes('PREVIEW_ORDER_ID')) {
                                const movedPrice = order.price ?? order.limitPrice ?? order.stopPrice;
                                if (movedPrice !== undefined && !Number.isNaN(movedPrice)) {
                                    brokerRef.current.moveOrder(order.id, movedPrice);
                                }
                            }
                        });
                    }
                } catch (e) {
                    console.error('[TVChartContainer] Error subscribing to chart events:', e);
                }
            });
        };

        const loadScript = (src: string) => {
            return new Promise((resolve) => {
                const script = document.createElement('script');
                script.src = src;
                script.onload = resolve;
                document.head.appendChild(script);
            });
        };

        const loadStyle = (href: string) => {
            const link = document.createElement('link');
            link.rel = 'stylesheet';
            link.href = href;
            document.head.appendChild(link);
        };

        styles.forEach(loadStyle);
        Promise.all(scripts.map(loadScript)).then(initWidget);

        return () => {
            if (window.tvWidget && typeof (window.tvWidget as any).remove === 'function') {
                try {
                    (window.tvWidget as any).remove();
                    window.tvWidget = null;
                } catch (e) { }
            }
        };
    }, []);

    // Effect for account sync
    useEffect(() => {
        if (brokerRef.current && currentAccountId) {
            brokerRef.current.setAccountId(currentAccountId);
            if (getMetaApiToken) brokerRef.current.setMetaApiTokenFunction(getMetaApiToken);
        }
    }, [currentAccountId, getMetaApiToken]);

    // Effect for symbol sync
    useEffect(() => {
        if (activeSymbol && window.tvWidget) {
            try {
                const chart = window.tvWidget.activeChart();
                if (chart && chart.symbol() !== activeSymbol) {
                    chart.setSymbol(activeSymbol);
                }
            } catch (e) { }
        }
    }, [activeSymbol]);

    return (
        <div ref={containerRef} className="tv-chart-container" style={{ height: '100%', width: '100%' }} />
    );
};

export default TVChartContainer;
