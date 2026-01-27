import {
	AccountId,
	AccountManagerInfo,
	AccountManagerSummaryField,
	AccountMetainfo,
	ActionMetaInfo,
	Brackets,
	ConnectionStatus,
	DefaultContextMenuActionsParams,
	Execution,
	IBrokerConnectionAdapterHost,
	IDelegate,
	InstrumentInfo,
	IsTradableResult,
	IWatchedValue,
	MenuSeparator,
	Order,
	OrderStatus,
	OrderType,
	ParentType,
	PlaceOrderResult,
	Position,
	PreOrder,
	Side,
	StandardFormatterName,
	TradeContext,
} from '../../trading_platform-master/charting_library/broker-api';

import { IDatafeedQuotesApi, QuoteData } from '../../trading_platform-master/charting_library/datafeed-api';
import { AbstractBrokerMinimal } from '../../trading_platform-master/broker-sample/src/abstract-broker-minimal';
import { apiClient, positionsApi } from '@/lib/api';

interface SimpleMap<TValue> {
	[key: string]: TValue;
}

interface ApiPosition {
	id: string;
	ticket: number;
	symbol: string;
	type: 'Buy' | 'Sell' | 'Buy Limit' | 'Sell Limit' | 'Buy Stop' | 'Sell Stop';
	volume: number;
	openPrice: number;
	currentPrice: number;
	takeProfit?: number;
	stopLoss?: number;
	profit: number;
	orderType?: number;
}

// Helper function to change side (Buy <-> Sell)
function changeSide(side: Side): Side {
	return side === Side.Buy ? Side.Sell : Side.Buy;
}

// Safe host call wrapper
function safeHostCall(host: any, method: string, ...args: any[]): any {
	try {
		if (host && typeof host[method] === 'function') {
			return host[method](...args);
		}
	} catch (e) {
		console.warn('[ZuperiorBroker] Host call failed', method, e);
	}
	return undefined;
}

export class ZuperiorBroker extends AbstractBrokerMinimal {
	private readonly _accountId: string | null;
	private readonly _positions: Position[] = [];
	private readonly _orders: Order[] = [];
	private _positionById: SimpleMap<Position> = {};
	private _orderById: SimpleMap<Order> = {};
	private _pollInterval: NodeJS.Timeout | null = null;
	private _isPolling = false;
	private _isWidgetReady = false;

	public constructor(host: IBrokerConnectionAdapterHost, quotesProvider: IDatafeedQuotesApi, accountId: string | null) {
		super(host, quotesProvider);
		this._accountId = accountId;
		// Start fetching immediately so positions()/orders() have data when TradingView queries
		this._startPolling();
	}

	public setWidgetReady(ready: boolean) {
		this._isWidgetReady = ready;
		if (ready) {
			// When widget becomes ready, trigger updates for all existing positions/orders
			this._notifyAllPositionsAndOrders();
			if (!this._isPolling) {
				this._startPolling();
			}
		}
	}

	private _notifyAllPositionsAndOrders() {
		// Ensure arrays exist before filtering
		if (!Array.isArray(this._orders) || !Array.isArray(this._positions)) {
			console.warn('[ZuperiorBroker] Arrays not initialized, skipping notification');
			return;
		}

		// Separate bracket orders from regular orders
		const bracketOrders = this._orders.filter(o => o && o.parentId && o.parentType === ParentType.Position);
		const regularOrders = this._orders.filter(o => o && (!o.parentId || o.parentType !== ParentType.Position));

		// CRITICAL: Update bracket orders FIRST, then positions
		// This is the correct order for TradingView to display TP/SL lines

		// 1. Update bracket orders first
		bracketOrders.forEach(bracket => {
			try {
				if (this._host && typeof this._host.orderUpdate === 'function') {
					this._host.orderUpdate(bracket);
				}
			} catch (error) {
				console.error('[ZuperiorBroker] Error notifying bracket order:', error, bracket);
			}
		});

		// 2. Update regular orders
		regularOrders.forEach(o => {
			try {
				if (this._host && typeof this._host.orderUpdate === 'function') {
					this._host.orderUpdate(o);
				}
			} catch (error) {
				console.error('[ZuperiorBroker] Error notifying order:', error, o);
			}
		});

		// 3. Finally, update positions AFTER brackets exist
		this._positions.forEach(p => {
			try {
				if (this._host && typeof this._host.positionUpdate === 'function') {
					const cleanPosition = this._createCleanPosition(p);
					this._host.positionUpdate(cleanPosition);
					if ((cleanPosition as any).pl !== undefined) {
						this._host.plUpdate(cleanPosition.symbol, (cleanPosition as any).pl);
					}
				}
			} catch (error) {
				console.error('[ZuperiorBroker] Error notifying position:', error, p);
			}
		});

		console.log(`[ZuperiorBroker] Notified TradingView: ${this._positions.length} positions, ${regularOrders.length} orders, ${bracketOrders.length} brackets`);
	}

	private async _startPolling() {
		if (this._isPolling || !this._accountId) return;
		this._isPolling = true;

		// Initial fetch
		await this._fetchPositionsAndOrders();

		// Poll every 2 seconds
		this._pollInterval = setInterval(() => {
			this._fetchPositionsAndOrders();
		}, 2000);
	}

	private async _fetchPositionsAndOrders() {
		if (!this._accountId) {
			console.log('[ZuperiorBroker] No accountId, skipping fetch');
			return;
		}

		try {
			console.log(`[ZuperiorBroker] Fetching positions/orders for accountId: ${this._accountId}`);
			const response = await apiClient.get<{
				success: boolean;
				positions?: any[];
				pendingOrders?: any[];
				data?: {
					positions?: any[];
					pendingOrders?: any[];
				};
			}>(`/api/positions/${this._accountId}`);

			// Check if response exists
			if (!response) {
				console.warn('[ZuperiorBroker] No response from API');
				return;
			}

			console.log('[ZuperiorBroker] API response:', {
				success: response?.success,
				positionsCount: response?.positions?.length || response?.data?.positions?.length || 0,
				pendingOrdersCount: response?.pendingOrders?.length || response?.data?.pendingOrders?.length || 0,
			});

			if (response && response.success) {
				// Ensure we have arrays, handle null/undefined cases
				const positionsArray = Array.isArray(response.positions)
					? response.positions
					: Array.isArray(response.data?.positions)
						? response.data.positions
						: [];
				const pendingArray = Array.isArray(response.pendingOrders)
					? response.pendingOrders
					: Array.isArray(response.data?.pendingOrders)
						? response.data.pendingOrders
						: [];

				console.log(`[ZuperiorBroker] Raw data - positions: ${positionsArray.length}, orders: ${pendingArray.length}`);

				// Map positions - filter out invalid ones
				const tvPositions = (Array.isArray(positionsArray) ? positionsArray : [])
					.map((pos: any) => {
						try {
							return this._mapApiPositionToTVPosition(pos);
						} catch (error) {
							console.error('[ZuperiorBroker] Error mapping position:', error, pos);
							return null;
						}
					})
					.filter((p: Position | null): p is Position => !!p && !!p.id && !!p.symbol && p.qty > 0 && p.avgPrice > 0);

				// Map pending orders - filter out invalid ones
				const tvOrders = (Array.isArray(pendingArray) ? pendingArray : [])
					.map((order: any) => {
						try {
							if (!order || typeof order !== 'object') {
								console.warn('[ZuperiorBroker] Invalid order object:', order);
								return null;
							}
							return this._mapApiOrderToTVOrder(order);
						} catch (error) {
							console.error('[ZuperiorBroker] Error mapping order:', error, order);
							return null;
						}
					})
					.filter((o: Order | null): o is Order => !!o && !!o.id && !!o.symbol && o.qty > 0);

				// Create bracket orders for positions with TP/SL using helper methods
				const bracketOrders: Order[] = [];
				// Ensure tvPositions is an array before forEach
				if (Array.isArray(tvPositions)) {
					tvPositions.forEach(p => {
						// Ensure bracket fields are always present (even if undefined)
						if (!('stopLoss' in p)) {
							(p as any).stopLoss = undefined;
						}
						if (!('takeProfit' in p)) {
							(p as any).takeProfit = undefined;
						}

						// Validate bracket values are numbers
						if (p.stopLoss !== undefined && typeof p.stopLoss !== 'number') {
							const slNum = Number(p.stopLoss);
							(p as any).stopLoss = Number.isFinite(slNum) && slNum > 0 ? slNum : undefined;
						}
						if (p.takeProfit !== undefined && typeof p.takeProfit !== 'number') {
							const tpNum = Number(p.takeProfit);
							(p as any).takeProfit = Number.isFinite(tpNum) && tpNum > 0 ? tpNum : undefined;
						}

						// Create TP bracket order if takeProfit is set
						if (p.takeProfit && p.takeProfit > 0 && !isNaN(p.takeProfit) && isFinite(p.takeProfit)) {
							try {
								const tpBracket = this._createTakeProfitBracket(p);
								bracketOrders.push(tpBracket);
								console.log(`[ZuperiorBroker] Created TP bracket order: ${tpBracket.id} for position ${p.id}, limitPrice: ${tpBracket.limitPrice}`);
							} catch (error) {
								console.error('[ZuperiorBroker] Error creating TP bracket:', error);
							}
						}

						// Create SL bracket order if stopLoss is set
						if (p.stopLoss && p.stopLoss > 0 && !isNaN(p.stopLoss) && isFinite(p.stopLoss)) {
							try {
								const slBracket = this._createStopLossBracket(p);
								bracketOrders.push(slBracket);
								console.log(`[ZuperiorBroker] Created SL bracket order: ${slBracket.id} for position ${p.id}, stopPrice: ${slBracket.stopPrice}`);
							} catch (error) {
								console.error('[ZuperiorBroker] Error creating SL bracket:', error);
							}
						}
					});
				}

				// Combine pending orders with bracket orders
				// Ensure tvOrders is an array
				const allOrders = [...(Array.isArray(tvOrders) ? tvOrders : []), ...bracketOrders];

				// Update internal state - ensure arrays exist
				if (Array.isArray(this._positions) && Array.isArray(tvPositions)) {
					this._positions.length = 0;
					this._positions.push(...tvPositions);
				} else {
					console.warn('[ZuperiorBroker] Cannot update positions - arrays not valid');
				}

				if (Array.isArray(this._orders) && Array.isArray(allOrders)) {
					this._orders.length = 0;
					this._orders.push(...allOrders);
				} else {
					console.warn('[ZuperiorBroker] Cannot update orders - arrays not valid');
				}

				// Update positionById map
				const positionMap: SimpleMap<Position> = {};
				if (Array.isArray(tvPositions)) {
					tvPositions.forEach(p => {
						if (p && p.id) {
							positionMap[p.id] = p;
						}
					});
				}
				this._positionById = positionMap;

				// Update orderById map
				const orderMap: SimpleMap<Order> = {};
				if (Array.isArray(allOrders)) {
					allOrders.forEach(o => {
						if (o && o.id) {
							orderMap[o.id] = o;
						}
					});
				}
				this._orderById = orderMap;

				// Notify TradingView if widget is ready
				// CRITICAL: Update positions FIRST with brackets, THEN create bracket orders
				// This order is required for TradingView to show TP/SL buttons on trade lines
				if (this._isWidgetReady) {
					console.log(`[ZuperiorBroker] Widget ready, notifying TradingView: ${bracketOrders.length} brackets, ${tvOrders.length} orders, ${tvPositions.length} positions`);

					// Step 1: Update positions FIRST with brackets so TradingView can show TP/SL buttons
					if (Array.isArray(tvPositions) && tvPositions.length > 0) {
						tvPositions.forEach(p => {
							try {
								// Validate position object before sending to TradingView
								if (!p || typeof p !== 'object') {
									console.warn('[ZuperiorBroker] Invalid position object:', p);
									return;
								}

								// Ensure all required fields are present and valid
								if (!p.id || typeof p.id !== 'string') {
									console.warn('[ZuperiorBroker] Position missing valid id:', p);
									return;
								}
								if (!p.symbol || typeof p.symbol !== 'string') {
									console.warn('[ZuperiorBroker] Position missing valid symbol:', p);
									return;
								}
								if (typeof p.qty !== 'number' || p.qty <= 0 || !isFinite(p.qty)) {
									console.warn('[ZuperiorBroker] Position missing valid qty:', p);
									return;
								}
								if (typeof p.side !== 'number' || (p.side !== Side.Buy && p.side !== Side.Sell)) {
									console.warn('[ZuperiorBroker] Position missing valid side:', p);
									return;
								}
								if (typeof p.avgPrice !== 'number' || p.avgPrice <= 0 || !isFinite(p.avgPrice)) {
									console.warn('[ZuperiorBroker] Position missing valid avgPrice:', p);
									return;
								}

								// Create a clean position object - brackets must be present (even if undefined)
								const cleanPosition = this._createCleanPosition(p);

								console.log(`[ZuperiorBroker] Step 1: Sending position with brackets:`, {
									id: cleanPosition.id,
									symbol: cleanPosition.symbol,
									takeProfit: cleanPosition.takeProfit,
									stopLoss: cleanPosition.stopLoss,
								});

								if (this._host && typeof this._host.positionUpdate === 'function') {
									this._host.positionUpdate(cleanPosition);
								}
								if ((cleanPosition as any).pl !== undefined && typeof (cleanPosition as any).pl === 'number' && this._host && typeof this._host.plUpdate === 'function') {
									this._host.plUpdate(cleanPosition.symbol, (cleanPosition as any).pl);
								}
							} catch (error) {
								console.error('[ZuperiorBroker] Error updating position:', error, p);
							}
						});
					} else {
						console.log(`[ZuperiorBroker] No positions to send (count: ${tvPositions.length})`);
					}

					// Step 2: Create bracket orders AFTER positions are updated
					// TradingView will match these to the position's brackets
					if (Array.isArray(bracketOrders) && bracketOrders.length > 0) {
						bracketOrders.forEach(bracket => {
							try {
								if (bracket && this._host && typeof this._host.orderUpdate === 'function') {
									console.log(`[ZuperiorBroker] Step 2: Sending bracket order:`, {
										id: bracket.id,
										symbol: bracket.symbol,
										type: bracket.type,
										parentId: bracket.parentId,
										limitPrice: (bracket as any).limitPrice,
										stopPrice: (bracket as any).stopPrice,
									});
									this._host.orderUpdate(bracket);
								}
							} catch (error) {
								console.error('[ZuperiorBroker] Error updating bracket order:', error, bracket);
							}
						});
					} else {
						console.log(`[ZuperiorBroker] No bracket orders to send (count: ${bracketOrders.length})`);
					}

					// Step 3: Update pending orders
					if (Array.isArray(tvOrders)) {
						tvOrders.forEach(o => {
							try {
								if (o && this._host && typeof this._host.orderUpdate === 'function') {
									this._host.orderUpdate(o);
								}
							} catch (error) {
								console.error('[ZuperiorBroker] Error updating order:', error, o);
							}
						});
					}
				}

				console.log(`[ZuperiorBroker] Updated ${tvPositions.length} positions, ${tvOrders.length} pending orders, ${bracketOrders.length} bracket orders`);
			}
		} catch (error) {
			console.error('[ZuperiorBroker] Error fetching positions/orders:', error);
		}
	}

	private _mapApiPositionToTVPosition(apiPos: any): Position {
		const ticket = apiPos.ticket || apiPos.Ticket || apiPos.PositionId || apiPos.id;
		const id = String(ticket);

		// Map side: Buy = 1, Sell = -1
		// Check multiple possible fields for side/type
		const typeStr = (apiPos.type || apiPos.Type || '').toString().toLowerCase();
		const action = apiPos.Action || apiPos.action;
		const isBuy = typeStr.includes('buy') ||
			action === 0 ||
			String(action) === '0' ||
			(apiPos.type && (apiPos.type === 'Buy' || apiPos.type === 0));
		const side = isBuy ? Side.Buy : Side.Sell;

		const openPrice = Number(apiPos.openPrice || apiPos.OpenPrice || apiPos.priceOpen || apiPos.PriceOpen || apiPos.price || apiPos.Price || 0);
		const currentPrice = Number(apiPos.currentPrice || apiPos.CurrentPrice || apiPos.priceCurrent || apiPos.PriceCurrent || apiPos.price || apiPos.Price || openPrice);
		const rawVolume = Math.abs(Number(apiPos.volume || apiPos.Volume || 0));
		// Divide volume by 10000 to match the display in the positions table
		const volume = rawVolume / 10000;
		const profit = Number(apiPos.profit || apiPos.Profit || apiPos.pl || apiPos.PL || 0);

		// Ensure all required fields are valid
		const symbol = (apiPos.symbol || apiPos.Symbol || '').toUpperCase();
		if (!symbol || !id || volume <= 0 || openPrice <= 0) {
			console.warn('[ZuperiorBroker] Invalid position data:', { id, symbol, rawVolume, volume, openPrice });
		}

		// Ensure all required fields are valid before creating position
		if (!id || !symbol || volume <= 0 || openPrice <= 0) {
			console.warn('[ZuperiorBroker] Cannot create position - missing required fields:', { id, symbol, volume, openPrice });
			// Return a minimal valid position to avoid crashes, but it will be filtered out
			return {
				id: id || 'invalid',
				symbol: symbol || 'UNKNOWN',
				qty: Math.max(volume, 0.01),
				side,
				avgPrice: Math.max(openPrice, 0.01),
			} as Position;
		}

		const position: Position = {
			id: String(id),
			symbol: String(symbol).toUpperCase(),
			qty: Number(volume),
			side: Number(side),
			avgPrice: Number(openPrice),
		} as Position;

		// Add optional fields only if they have valid values
		if (currentPrice > 0 && !isNaN(currentPrice)) {
			(position as any).last = Number(currentPrice);
		}
		if (profit !== 0 && !isNaN(profit) && isFinite(profit)) {
			(position as any).pl = Number(profit);
		}
		// Extract TP/SL from multiple field name variations
		const takeProfitRaw = apiPos.takeProfit || apiPos.TakeProfit || apiPos.TP || apiPos.tp;
		const takeProfitNum = typeof takeProfitRaw === 'string' ? parseFloat(takeProfitRaw) : Number(takeProfitRaw);
		const takeProfit = Number.isFinite(takeProfitNum) && takeProfitNum > 0 ? takeProfitNum : undefined;

		const stopLossRaw = apiPos.stopLoss || apiPos.StopLoss || apiPos.SL || apiPos.sl;
		const stopLossNum = typeof stopLossRaw === 'string' ? parseFloat(stopLossRaw) : Number(stopLossRaw);
		const stopLoss = Number.isFinite(stopLossNum) && stopLossNum > 0 ? stopLossNum : undefined;

		// Set TP/SL fields - ensure they are numbers (not strings) or undefined
		position.takeProfit = takeProfit !== undefined ? Number(takeProfit) : undefined;
		position.stopLoss = stopLoss !== undefined ? Number(stopLoss) : undefined;

		// Ensure bracket fields are always present (even if undefined)
		if (!('stopLoss' in position)) {
			position.stopLoss = undefined;
		}
		if (!('takeProfit' in position)) {
			position.takeProfit = undefined;
		}

		return position;
	}

	private _mapApiOrderToTVOrder(apiOrder: any): Order {
		const ticket = apiOrder.ticket || apiOrder.Ticket || apiOrder.OrderId || apiOrder.id;
		const id = String(ticket);

		// Map order type
		const orderType = apiOrder.orderType || apiOrder.Type || apiOrder.type;
		let type: OrderType;
		if (typeof orderType === 'number') {
			if (orderType === 2 || orderType === 3) type = OrderType.Limit; // Buy Limit, Sell Limit
			else if (orderType === 4 || orderType === 5) type = OrderType.Stop; // Buy Stop, Sell Stop
			else type = OrderType.Market;
		} else {
			type = OrderType.Market;
		}

		// Map side
		const isBuy = apiOrder.type === 'Buy' || apiOrder.type === 'Buy Limit' || apiOrder.type === 'Buy Stop' ||
			apiOrder.Action === 0 || apiOrder.action === 0;
		const side = isBuy ? Side.Buy : Side.Sell;

		// Determine price fields
		const openPrice = Number(apiOrder.openPrice || apiOrder.OpenPrice || apiOrder.priceOrder || apiOrder.PriceOrder || 0);
		const limitPrice = (type === OrderType.Limit) ? openPrice : undefined;
		const stopPrice = (type === OrderType.Stop) ? openPrice : undefined;

		// Divide volume by 10000 to match the display in the positions table
		const rawVolume = Number(apiOrder.volume || apiOrder.Volume || 0);
		const volume = rawVolume / 10000;

		return {
			id,
			symbol: apiOrder.symbol || apiOrder.Symbol || '',
			type,
			side,
			qty: volume,
			status: OrderStatus.Working,
			limitPrice,
			stopPrice,
			takeProfit: apiOrder.takeProfit || apiOrder.TakeProfit || apiOrder.TP || apiOrder.tp || undefined,
			stopLoss: apiOrder.stopLoss || apiOrder.StopLoss || apiOrder.SL || apiOrder.sl || undefined,
		} as Order;
	}

	public connectionStatus(): ConnectionStatus {
		return ConnectionStatus.Connected;
	}

	public currentAccount(): AccountId {
		return (this._accountId || '1') as AccountId;
	}

	public async isTradable(_symbol: string): Promise<boolean | IsTradableResult> {
		return Promise.resolve(true);
	}

	public async symbolInfo(symbol: string): Promise<InstrumentInfo> {
		// Get min tick from host if available
		const mintick = await this._host.getSymbolMinTick(symbol).catch(() => 0.01);
		const pipSize = mintick;
		const accountCurrencyRate = 1;
		const pointValue = 1;

		return {
			qty: {
				min: 0.01,
				max: 1e12,
				step: 0.01,
			},
			pipValue: pipSize * pointValue * accountCurrencyRate || 1,
			pipSize: pipSize,
			minTick: mintick,
			description: '',
		};
	}

	public async orders(): Promise<Order[]> {
		// Ensure _orders is always an array before calling slice()
		if (!Array.isArray(this._orders)) {
			console.warn('[ZuperiorBroker] _orders is not an array, returning empty array');
			return Promise.resolve([]);
		}
		const orders = this._orders.slice();
		console.log(`[ZuperiorBroker] orders() called, returning ${orders.length} orders`);
		return Promise.resolve(orders);
	}

	public async positions(): Promise<Position[]> {
		// Ensure _positions is always an array before calling slice()
		if (!Array.isArray(this._positions)) {
			console.warn('[ZuperiorBroker] _positions is not an array, returning empty array');
			return Promise.resolve([]);
		}
		const positions = this._positions.slice();
		console.log(`[ZuperiorBroker] positions() called, returning ${positions.length} positions`);
		if (positions.length > 0) {
			console.log('[ZuperiorBroker] Sample position:', {
				id: positions[0].id,
				symbol: positions[0].symbol,
				qty: positions[0].qty,
				side: positions[0].side,
				avgPrice: positions[0].avgPrice,
				takeProfit: (positions[0] as any).takeProfit,
				stopLoss: (positions[0] as any).stopLoss,
			});
		}
		return Promise.resolve(positions);
	}

	public async executions(_symbol: string): Promise<Execution[]> {
		return Promise.resolve([]);
	}

	public async placeOrder(preOrder: PreOrder): Promise<PlaceOrderResult> {
		// This is handled by the TradingContext, so we just return success
		console.log('[ZuperiorBroker] placeOrder called:', preOrder);
		return Promise.resolve({});
	}

	public async modifyOrder(order: Order, _confirmId?: string): Promise<void> {
		console.log('[ZuperiorBroker] modifyOrder called:', order);
		// Update local state
		if (this._orderById[order.id]) {
			Object.assign(this._orderById[order.id], order);
			if (this._host && typeof this._host.orderUpdate === 'function') {
				this._host.orderUpdate(order);
			}
		}
	}

	public async cancelOrder(orderId: string): Promise<void> {
		if (!this._accountId) {
			throw new Error('No account ID');
		}

		try {
			// Call API to cancel order - use fetch directly since we need DELETE with body
			const token = apiClient.getToken();
			// Get base URL from environment or default to localhost:5000
			const baseURL = process.env.NEXT_PUBLIC_BACKEND_API_URL ||
				(process.env.NEXT_PUBLIC_API_BASE_URL && process.env.NEXT_PUBLIC_API_BASE_URL.includes('localhost')
					? process.env.NEXT_PUBLIC_API_BASE_URL
					: 'http://localhost:5000');

			const response = await fetch(`${baseURL}/api/trading/pending/order/${orderId}`, {
				method: 'DELETE',
				headers: {
					'Content-Type': 'application/json',
					...(token ? { 'Authorization': `Bearer ${token}` } : {}),
				},
				body: JSON.stringify({
					accountId: this._accountId,
					comment: 'Cancel via chart',
				}),
			});

			if (!response.ok) {
				throw new Error(`Failed to cancel order: ${response.statusText}`);
			}

			// Remove from local state
			const orderIndex = this._orders.findIndex(o => o.id === orderId);
			if (orderIndex >= 0) {
				this._orders.splice(orderIndex, 1);
				delete this._orderById[orderId];
			}

			// Refresh positions/orders
			await this._fetchPositionsAndOrders();
		} catch (error) {
			console.error('[ZuperiorBroker] Error canceling order:', error);
			throw error;
		}
	}

	public async closePosition(positionId: string): Promise<void> {
		if (!this._accountId) {
			throw new Error('No account ID');
		}

		try {
			// Call API to close position - use fetch directly for DELETE with body
			const position = this._positionById[positionId];
			if (!position) {
				throw new Error('Position not found');
			}

			const token = apiClient.getToken();
			const baseURL = process.env.NEXT_PUBLIC_BACKEND_API_URL ||
				(process.env.NEXT_PUBLIC_API_BASE_URL && process.env.NEXT_PUBLIC_API_BASE_URL.includes('localhost')
					? process.env.NEXT_PUBLIC_API_BASE_URL
					: 'http://localhost:5000');

			const response = await fetch(`${baseURL}/api/trading/close`, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					...(token ? { 'Authorization': `Bearer ${token}` } : {}),
				},
				body: JSON.stringify({
					accountId: this._accountId,
					positionId: positionId,
					symbol: position.symbol,
				}),
			});

			if (!response.ok) {
				const errorData = await response.json().catch(() => ({ message: response.statusText }));
				throw new Error(errorData.message || `Failed to close position: ${response.statusText}`);
			}

			// Remove from local state
			const posIndex = this._positions.findIndex(p => p.id === positionId);
			if (posIndex >= 0) {
				this._positions.splice(posIndex, 1);
				delete this._positionById[positionId];
			}

			// Refresh positions/orders
			await this._fetchPositionsAndOrders();
		} catch (error) {
			console.error('[ZuperiorBroker] Error closing position:', error);
			throw error;
		}
	}

	public async editPositionBrackets(positionId: string, modifiedBrackets: Brackets): Promise<void> {
		console.log('[ZuperiorBroker] editPositionBrackets called:', {
			positionId,
			brackets: {
				stopLoss: modifiedBrackets.stopLoss !== undefined ? modifiedBrackets.stopLoss : 'undefined',
				takeProfit: modifiedBrackets.takeProfit !== undefined ? modifiedBrackets.takeProfit : 'undefined',
			},
		});

		if (!this._accountId) {
			throw new Error('No account ID');
		}

		if (!positionId) {
			throw new Error('Position ID is required');
		}

		try {
			// Extract bracket values - handle null/undefined/0 (which means remove bracket)
			const stopLossValue = modifiedBrackets.stopLoss !== undefined && modifiedBrackets.stopLoss !== null && Number(modifiedBrackets.stopLoss) > 0
				? Number(modifiedBrackets.stopLoss)
				: undefined;
			const takeProfitValue = modifiedBrackets.takeProfit !== undefined && modifiedBrackets.takeProfit !== null && Number(modifiedBrackets.takeProfit) > 0
				? Number(modifiedBrackets.takeProfit)
				: undefined;

			// Get current position
			let position = this._positionById[positionId];
			if (!position) {
				// Try to get from positions array
				const positions = await this.positions();
				const found = positions.find(p => p.id === positionId);
				if (found) {
					position = found;
				}
			}

			if (!position) {
				throw new Error('Position not found');
			}

			// CRITICAL: Preserve unchanged brackets when only one is modified
			let finalStopLoss = stopLossValue;
			let finalTakeProfit = takeProfitValue;

			// If only one bracket is being modified, preserve the other from current position
			if (stopLossValue === undefined && takeProfitValue !== undefined) {
				// Only TP is being modified - preserve current SL
				if (position.stopLoss !== undefined && position.stopLoss !== null) {
					finalStopLoss = Number(position.stopLoss);
					console.log('[ZuperiorBroker] Preserving existing SL:', finalStopLoss);
				}
			} else if (takeProfitValue === undefined && stopLossValue !== undefined) {
				// Only SL is being modified - preserve current TP
				if (position.takeProfit !== undefined && position.takeProfit !== null) {
					finalTakeProfit = Number(position.takeProfit);
					console.log('[ZuperiorBroker] Preserving existing TP:', finalTakeProfit);
				}
			}

			// Call API to modify position
			await positionsApi.modifyPosition({
				accountId: this._accountId,
				positionId: positionId,
				stopLoss: finalStopLoss,
				takeProfit: finalTakeProfit,
			});

			// Update position brackets
			position.stopLoss = finalStopLoss !== undefined ? Number(finalStopLoss) : undefined;
			position.takeProfit = finalTakeProfit !== undefined ? Number(finalTakeProfit) : undefined;

			// Get existing brackets
			const existingTPBracket = this._getTakeProfitBracket(position);
			const existingSLBracket = this._getStopLossBracket(position);

			// Update or create TP bracket
			if (finalTakeProfit !== undefined) {
				this._updatePositionsBracket({
					parent: position,
					bracket: existingTPBracket,
					bracketType: 1, // TakeProfit
					newPrice: finalTakeProfit,
				});
			} else if (existingTPBracket) {
				// Cancel existing TP bracket if position no longer has TP
				this._updatePositionsBracket({
					parent: position,
					bracket: existingTPBracket,
					bracketType: 1,
					newPrice: undefined,
				});
			}

			// Update or create SL bracket
			if (finalStopLoss !== undefined) {
				this._updatePositionsBracket({
					parent: position,
					bracket: existingSLBracket,
					bracketType: 0, // StopLoss
					newPrice: finalStopLoss,
				});
			} else if (existingSLBracket) {
				// Cancel existing SL bracket if position no longer has SL
				this._updatePositionsBracket({
					parent: position,
					bracket: existingSLBracket,
					bracketType: 0,
					newPrice: undefined,
				});
			}

			// Update position after brackets
			if (this._host && typeof this._host.positionUpdate === 'function') {
				const cleanPosition = this._createCleanPosition(position);
				this._host.positionUpdate(cleanPosition);
			}

			// Optionally trigger modify modal if available
			if (typeof window !== 'undefined' && (window as any).__OPEN_MODIFY_POSITION_MODAL__) {
				(window as any).__OPEN_MODIFY_POSITION_MODAL__(position, {
					stopLoss: finalStopLoss,
					takeProfit: finalTakeProfit,
				});
			}

			// Refresh positions/orders to sync with backend
			await this._fetchPositionsAndOrders();
		} catch (error) {
			console.error('[ZuperiorBroker] Error editing position brackets:', error);
			throw error;
		}
	}

	public async reversePosition(positionId: string): Promise<void> {
		// Reverse position by closing and opening opposite side
		const position = this._positionById[positionId];
		if (!position) {
			throw new Error('Position not found');
		}

		// Close current position first, then the placeOrder will handle reversal
		await this.closePosition(positionId);
		// Note: Actual reversal logic would place an order in opposite direction with 2x quantity
		// For now, we'll just close and let user place new order if needed
	}

	public accountManagerInfo(): AccountManagerInfo {
		return {
			accountTitle: 'Trading Account',
			summary: [],
			orderColumns: [],
			positionColumns: [],
			pages: [],
		};
	}

	public async accountsMetainfo(): Promise<AccountMetainfo[]> {
		return [
			{
				id: (this._accountId || '1') as AccountId,
				name: `Account ${this._accountId || '1'}`,
			},
		];
	}

	public async chartContextMenuActions(
		_context: TradeContext,
		_options?: DefaultContextMenuActionsParams | undefined
	): Promise<ActionMetaInfo[]> {
		return this._host.defaultContextMenuActions(_context);
	}

	public destroy() {
		if (this._pollInterval) {
			clearInterval(this._pollInterval);
			this._pollInterval = null;
		}
		this._isPolling = false;
	}

	// ============================================================================
	// Helper method to create clean position object for TradingView
	// ============================================================================
	private _createCleanPosition(position: Position): Position {
		// Create a clean position object with only required/valid fields
		// This prevents TradingView from trying to access undefined properties
		const clean: Position = {
			id: String(position.id),
			symbol: String(position.symbol).toUpperCase(),
			qty: Number(position.qty),
			side: Number(position.side),
			avgPrice: Number(position.avgPrice),
		} as Position;

		// CRITICAL: Always include takeProfit and stopLoss fields (even if undefined)
		// TradingView needs these fields present to show TP/SL buttons on trade lines
		clean.takeProfit = (position.takeProfit !== undefined && position.takeProfit !== null && typeof position.takeProfit === 'number' && isFinite(position.takeProfit) && position.takeProfit > 0)
			? Number(position.takeProfit)
			: undefined;
		clean.stopLoss = (position.stopLoss !== undefined && position.stopLoss !== null && typeof position.stopLoss === 'number' && isFinite(position.stopLoss) && position.stopLoss > 0)
			? Number(position.stopLoss)
			: undefined;

		// Add optional fields only if they are valid numbers
		// NEVER multiply profit here - keep original profit for trade lines
		// TP/SL lines will get profit from bracket orders separately
		if ((position as any).pl !== undefined && (position as any).pl !== null && typeof (position as any).pl === 'number' && isFinite((position as any).pl)) {
			(clean as any).pl = Number((position as any).pl);
		}
		if ((position as any).last !== undefined && (position as any).last !== null && typeof (position as any).last === 'number' && isFinite((position as any).last)) {
			(clean as any).last = Number((position as any).last);
		}

		return clean;
	}

	// ============================================================================
	// syncFromLiveState - Main method to sync positions/orders from parent component
	// ============================================================================
	public syncFromLiveState(openPositions: any[], pendingOrders: any[]): void {
		console.log('[ZuperiorBroker] syncFromLiveState called:', {
			positionsCount: (openPositions || []).length,
			ordersCount: (pendingOrders || []).length,
		});

		try {
			// 1) Process positions and create bracket orders
			for (const p of openPositions || []) {
				const id = String(p.ticket ?? p.id ?? '');
				if (!id) continue;
				const symbol = String(p.symbol ?? '');

				const typeStr = String(p.type || '').toLowerCase();
				const side: Side = typeStr === 'sell' ? Side.Sell : Side.Buy;

				const rawVolume = Math.abs(Number(p.volume ?? p.qty ?? 0));
				const volume = rawVolume / 10000; // Divide by 10000 to match table display
				const avgPrice = Number(p.openPrice ?? p.price ?? 0);

				if (volume <= 0 || avgPrice <= 0) continue;

				// Extract TP/SL from multiple field name variations
				const stopLossRaw = p.stopLoss ?? p.StopLoss ?? p.SL ?? p.sl;
				const stopLossNum = typeof stopLossRaw === 'string' ? parseFloat(stopLossRaw) : Number(stopLossRaw);
				const stopLoss = Number.isFinite(stopLossNum) && stopLossNum > 0 ? stopLossNum : undefined;

				const takeProfitRaw = p.takeProfit ?? p.TakeProfit ?? p.TP ?? p.tp;
				const takeProfitNum = typeof takeProfitRaw === 'string' ? parseFloat(takeProfitRaw) : Number(takeProfitRaw);
				const takeProfit = Number.isFinite(takeProfitNum) && takeProfitNum > 0 ? takeProfitNum : undefined;

				const position: Position = {
					id,
					symbol,
					qty: volume,
					side,
					avgPrice,
					price: avgPrice,
					updateTime: Date.now(),
				} as Position;

				// Handle P/L - check multiple field name variations
				const currentPriceValue = p.currentPrice && Number(p.currentPrice) > 0 ? Number(p.currentPrice) : undefined;
				if (currentPriceValue) {
					position.currentPrice = currentPriceValue;
					(position as any).last = currentPriceValue;

					// Check multiple field names for profit (pnl, profit, Profit, PL, pl)
					const profitRaw = p.pnl ?? p.PNL ?? p.profit ?? p.Profit ?? p.pl ?? p.PL;
					if (profitRaw !== undefined && profitRaw !== null) {
						const profitValue = typeof profitRaw === 'string' ? parseFloat(profitRaw) : Number(profitRaw);
						if (Number.isFinite(profitValue)) {
							// Don't multiply profit for trade lines - keep original value
							(position as any).pl = profitValue;
							(position as any).pnl = profitValue;
						}
					} else {
						// Calculate profit from price difference if not provided
						const priceDiff = (position as any).last - position.price;
						const plValue = priceDiff * position.qty * (side === Side.Sell ? -1 : 1);
						// Don't multiply profit for trade lines - keep calculated value
						(position as any).pl = plValue;
						(position as any).pnl = plValue;
					}
				} else {
					// Even without currentPrice, try to get profit from API
					const profitRaw = p.pnl ?? p.PNL ?? p.profit ?? p.Profit ?? p.pl ?? p.PL;
					if (profitRaw !== undefined && profitRaw !== null) {
						const profitValue = typeof profitRaw === 'string' ? parseFloat(profitRaw) : Number(profitRaw);
						if (Number.isFinite(profitValue)) {
							// Don't multiply profit for trade lines - keep original value
							(position as any).pl = profitValue;
							(position as any).pnl = profitValue;
						}
					}
				}

				// Set TP/SL fields - ensure they are numbers (not strings) or undefined
				position.stopLoss = stopLoss !== undefined ? Number(stopLoss) : undefined;
				position.takeProfit = takeProfit !== undefined ? Number(takeProfit) : undefined;

				// Ensure bracket fields are always present (even if undefined)
				if (!('stopLoss' in position)) {
					position.stopLoss = undefined;
				}
				if (!('takeProfit' in position)) {
					position.takeProfit = undefined;
				}

				// Validate bracket values are numbers
				if (position.stopLoss !== undefined && typeof position.stopLoss !== 'number') {
					console.warn('[ZuperiorBroker] stopLoss is not a number, converting:', position.stopLoss);
					position.stopLoss = Number(position.stopLoss);
					if (!Number.isFinite(position.stopLoss) || position.stopLoss <= 0) {
						position.stopLoss = undefined;
					}
				}
				if (position.takeProfit !== undefined && typeof position.takeProfit !== 'number') {
					console.warn('[ZuperiorBroker] takeProfit is not a number, converting:', position.takeProfit);
					position.takeProfit = Number(position.takeProfit);
					if (!Number.isFinite(position.takeProfit) || position.takeProfit <= 0) {
						position.takeProfit = undefined;
					}
				}

				// Update position cache - ensure profit is set before storing
				this._positionById[id] = position;

				// Debug: Log profit value before creating clean position
				console.log('[ZuperiorBroker] Position profit before clean:', {
					id: position.id,
					rawProfit: (position as any).pl,
					profitType: typeof (position as any).pl,
				});

				// CRITICAL: Update position FIRST with brackets so TradingView can show TP/SL buttons
				// The position must have takeProfit/stopLoss fields set (even if undefined) for buttons to appear
				if (this._isWidgetReady) {
					const cleanPosition = this._createCleanPosition(position);

					// Debug: Log profit value after creating clean position
					console.log('[ZuperiorBroker] Position profit after clean:', {
						id: cleanPosition.id,
						cleanProfit: (cleanPosition as any).pl,
						profitType: typeof (cleanPosition as any).pl,
					});

					// Step 1: Update position with brackets FIRST
					safeHostCall(this._host, 'positionUpdate', cleanPosition);
					if ((cleanPosition as any).pl !== undefined && (cleanPosition as any).pl !== null) {
						const plValue = Number((cleanPosition as any).pl);
						console.log('[ZuperiorBroker] Calling plUpdate with profit:', plValue);
						safeHostCall(this._host, 'plUpdate', cleanPosition.symbol, plValue);
					}
					console.log('[ZuperiorBroker] Position updated with brackets:', {
						id: cleanPosition.id,
						symbol: cleanPosition.symbol,
						takeProfit: cleanPosition.takeProfit,
						stopLoss: cleanPosition.stopLoss,
						pl: (cleanPosition as any).pl,
						qty: cleanPosition.qty,
					});

					// Step 2: Create bracket orders AFTER position is updated
					// TradingView will match these to the position's brackets
					if (cleanPosition.takeProfit !== undefined && cleanPosition.takeProfit > 0) {
						try {
							const tpBracket = this._createTakeProfitBracket(cleanPosition);
							this._orderById[tpBracket.id] = tpBracket;
							safeHostCall(this._host, 'orderUpdate', tpBracket);
							console.log('[ZuperiorBroker] Created TP bracket order:', tpBracket.id, 'limitPrice:', tpBracket.limitPrice);
						} catch (error) {
							console.error('[ZuperiorBroker] Error creating TP bracket:', error);
						}
					}

					if (cleanPosition.stopLoss !== undefined && cleanPosition.stopLoss > 0) {
						try {
							const slBracket = this._createStopLossBracket(cleanPosition);
							this._orderById[slBracket.id] = slBracket;
							safeHostCall(this._host, 'orderUpdate', slBracket);
							console.log('[ZuperiorBroker] Created SL bracket order:', slBracket.id, 'stopPrice:', slBracket.stopPrice);
						} catch (error) {
							console.error('[ZuperiorBroker] Error creating SL bracket:', error);
						}
					}
				}
			}

			// 2) Process pending orders
			for (const o of pendingOrders || []) {
				const id = String(o.ticket ?? o.id ?? '');
				if (!id) continue;

				const symbol = String(o.symbol ?? '');
				const typeStr = String(o.type || '').toLowerCase();
				const side: Side = typeStr === 'sell' ? Side.Sell : Side.Buy;

				const rawVolume = Math.abs(Number(o.volume ?? 0));
				const volume = rawVolume / 10000; // Divide by 10000 to match table display

				const orderType = o.orderType || o.Type || o.type;
				let type: OrderType;
				if (typeof orderType === 'number') {
					if (orderType === 2 || orderType === 3) type = OrderType.Limit;
					else if (orderType === 4 || orderType === 5) type = OrderType.Stop;
					else type = OrderType.Market;
				} else {
					type = OrderType.Market;
				}

				const openPrice = Number(o.openPrice ?? o.price ?? 0);
				const limitPrice = (type === OrderType.Limit) ? openPrice : undefined;
				const stopPrice = (type === OrderType.Stop) ? openPrice : undefined;

				const order: Order = {
					id,
					symbol,
					qty: volume,
					side,
					type,
					status: OrderStatus.Working,
					limitPrice,
					stopPrice,
					takeProfit: o.takeProfit ?? o.TakeProfit ?? o.TP ?? o.tp ?? undefined,
					stopLoss: o.stopLoss ?? o.StopLoss ?? o.SL ?? o.sl ?? undefined,
				} as Order;

				this._orderById[id] = order;
				if (this._isWidgetReady) {
					safeHostCall(this._host, 'orderUpdate', order);
				}
			}

			// Update internal arrays
			this._positions.length = 0;
			this._positions.push(...Object.values(this._positionById));
			this._orders.length = 0;
			this._orders.push(...Object.values(this._orderById));

			console.log(`[ZuperiorBroker] syncFromLiveState completed: ${this._positions.length} positions, ${this._orders.length} orders`);
		} catch (error) {
			console.error('[ZuperiorBroker] Error in syncFromLiveState:', error);
		}
	}

	// ============================================================================
	// Bracket Creation Helper Methods
	// ============================================================================

	private _createTakeProfitBracket(entity: Position | Order): Order {
		const isPosition = 'avgPrice' in entity;

		if (!entity.symbol || typeof entity.symbol !== 'string' || entity.symbol.trim() === '') {
			throw new Error(`Invalid symbol for TP bracket: ${entity.symbol} (entity id: ${entity.id})`);
		}

		const normalizedSymbol = entity.symbol.trim();
		if (normalizedSymbol === '') {
			throw new Error(`Invalid symbol for TP bracket: empty string after trim (entity id: ${entity.id})`);
		}

		const bracket: Order = {
			symbol: normalizedSymbol,
			qty: entity.qty,
			id: `tp_${entity.id}`,
			parentId: entity.id,
			parentType: isPosition ? ParentType.Position : ParentType.Order,
			limitPrice: entity.takeProfit,
			side: changeSide(entity.side),
			status: (isPosition ? OrderStatus.Working : OrderStatus.Inactive) as any,
			type: OrderType.Limit,
		} as Order;

		// Add profit to TP bracket order - multiply by 100 for TP line display
		// TradingView may use this profit value for displaying on TP lines
		if (isPosition && (entity as Position as any).pl !== undefined && (entity as Position as any).pl !== null) {
			const profitValue = Number((entity as Position as any).pl);
			if (Number.isFinite(profitValue)) {
				(bracket as any).pl = profitValue * 100;
			}
		}

		return bracket;
	}

	private _createStopLossBracket(entity: Position | Order): Order {
		const isPosition = 'avgPrice' in entity;

		if (!entity.symbol || typeof entity.symbol !== 'string' || entity.symbol.trim() === '') {
			throw new Error(`Invalid symbol for SL bracket: ${entity.symbol} (entity id: ${entity.id})`);
		}

		const normalizedSymbol = entity.symbol.trim();
		if (normalizedSymbol === '') {
			throw new Error(`Invalid symbol for SL bracket: empty string after trim (entity id: ${entity.id})`);
		}

		const stopLossValue = entity.stopLoss;
		if (stopLossValue === undefined || stopLossValue === null || !Number.isFinite(stopLossValue) || stopLossValue <= 0) {
			throw new Error(`Invalid stopLoss value for SL bracket: ${stopLossValue}`);
		}

		const bracket: Order = {
			symbol: normalizedSymbol,
			qty: entity.qty,
			id: `sl_${entity.id}`,
			parentId: entity.id,
			parentType: isPosition ? ParentType.Position : ParentType.Order,
			stopPrice: stopLossValue,
			price: stopLossValue,
			side: changeSide(entity.side),
			status: (isPosition ? OrderStatus.Working : OrderStatus.Inactive) as any,
			type: OrderType.Stop,
		} as Order;

		// Add profit to SL bracket order - multiply by 100 for SL line display
		// TradingView may use this profit value for displaying on SL lines
		if (isPosition && (entity as Position as any).pl !== undefined && (entity as Position as any).pl !== null) {
			const profitValue = Number((entity as Position as any).pl);
			if (Number.isFinite(profitValue)) {
				(bracket as any).pl = profitValue * 100;
			}
		}

		return bracket;
	}

	private _getBrackets(parentId: string): Order[] {
		return Object.values(this._orderById).filter(
			(order: Order) => order.parentId === parentId &&
				(order.status === OrderStatus.Working || order.status === OrderStatus.Inactive)
		);
	}

	private _getTakeProfitBracket(entity: Position | Order): Order | undefined {
		return this._getBrackets(entity.id).find((bracket: Order) => bracket.limitPrice !== undefined);
	}

	private _getStopLossBracket(entity: Position | Order): Order | undefined {
		return this._getBrackets(entity.id).find((bracket: Order) => bracket.stopPrice !== undefined);
	}

	private _updateOrder(order: Order): void {
		const hasOrderAlready = Boolean(this._orderById[order.id]);

		if (hasOrderAlready) {
			Object.assign(this._orderById[order.id], order);
		} else {
			this._orderById[order.id] = order;
		}

		// Update orders array
		const orderIndex = this._orders.findIndex(o => o.id === order.id);
		if (orderIndex >= 0) {
			this._orders[orderIndex] = order;
		} else {
			this._orders.push(order);
		}

		// Notify TradingView
		if (this._host && typeof this._host.orderUpdate === 'function') {
			this._host.orderUpdate(order);
		}

		// Update parent entity's brackets if applicable
		if (order.parentId !== undefined) {
			const entity = order.parentType === ParentType.Position
				? this._positionById[order.parentId]
				: this._orderById[order.parentId];

			if (entity === undefined) {
				return;
			}

			// Update take-profit
			if (order.limitPrice !== undefined) {
				(entity as any).takeProfit = order.status !== OrderStatus.Canceled
					? order.limitPrice
					: undefined;
			}

			// Update stop-loss
			if (order.stopPrice !== undefined) {
				(entity as any).stopLoss = order.status !== OrderStatus.Canceled
					? order.stopPrice
					: undefined;
			}

			// If parent is a position, update it
			if (order.parentType === ParentType.Position && entity) {
				if (this._host && typeof this._host.positionUpdate === 'function') {
					const cleanPosition = this._createCleanPosition(entity as Position);
					this._host.positionUpdate(cleanPosition);
				}
			}
		}
	}

	private _setCanceledStatusAndUpdate(order: Order): void {
		order.status = OrderStatus.Canceled;
		this._updateOrder(order);
	}

	private _updatePositionsBracket(params: {
		parent: Position;
		bracket: Order | undefined;
		bracketType: 0 | 1; // 0 = StopLoss, 1 = TakeProfit
		newPrice: number | undefined;
	}): void {
		const { parent, bracket, bracketType, newPrice } = params;

		// Check if bracket should be canceled
		const shouldCancelBracket = bracket !== undefined && newPrice === undefined;
		if (shouldCancelBracket) {
			this._setCanceledStatusAndUpdate(bracket);
			return;
		}

		if (newPrice === undefined) {
			return;
		}

		const shouldCreateNewBracket = bracket === undefined;

		// Handle Take Profit
		if (bracketType === 1) {
			if (shouldCreateNewBracket) {
				// Set parent.takeProfit BEFORE creating bracket
				parent.takeProfit = newPrice;
				const takeProfitBracket = this._createTakeProfitBracket(parent);
				takeProfitBracket.status = OrderStatus.Working;
				takeProfitBracket.parentType = ParentType.Position;

				if (!takeProfitBracket.symbol || takeProfitBracket.symbol.trim() === '') {
					console.error('[ZuperiorBroker] Cannot create TP bracket - invalid symbol');
					return;
				}

				try {
					this._updateOrder(takeProfitBracket);
					// Update parent position after bracket is created
					if (this._host && typeof this._host.positionUpdate === 'function') {
						const cleanPosition = this._createCleanPosition(parent);
						this._host.positionUpdate(cleanPosition);
					}
				} catch (error) {
					console.error('[ZuperiorBroker] Error creating TP bracket:', error);
				}
				return;
			}

			// Update existing bracket
			bracket.limitPrice = newPrice;
			// Also update parent position's takeProfit to match
			parent.takeProfit = newPrice;
			if (!bracket.symbol || bracket.symbol.trim() === '') {
				console.error('[ZuperiorBroker] Cannot update TP bracket - invalid symbol');
				return;
			}

			try {
				this._updateOrder(bracket);
				// Update parent position after bracket is updated
				if (this._host && typeof this._host.positionUpdate === 'function') {
					const cleanPosition = this._createCleanPosition(parent);
					this._host.positionUpdate(cleanPosition);
				}
			} catch (error) {
				console.error('[ZuperiorBroker] Error updating TP bracket:', error);
			}
			return;
		}

		// Handle Stop Loss
		if (bracketType === 0) {
			if (shouldCreateNewBracket) {
				// Set parent.stopLoss BEFORE creating bracket
				parent.stopLoss = newPrice;
				const stopLossBracket = this._createStopLossBracket(parent);
				stopLossBracket.status = OrderStatus.Working;
				stopLossBracket.parentType = ParentType.Position;

				if (!stopLossBracket.symbol || stopLossBracket.symbol.trim() === '') {
					console.error('[ZuperiorBroker] Cannot create SL bracket - invalid symbol');
					return;
				}

				try {
					this._updateOrder(stopLossBracket);
				} catch (error) {
					console.error('[ZuperiorBroker] Error creating SL bracket:', error);
				}
				return;
			}

			// Update existing bracket
			bracket.stopPrice = newPrice;
			// Also update parent position's stopLoss to match
			parent.stopLoss = newPrice;
			if (!bracket.symbol || bracket.symbol.trim() === '') {
				console.error('[ZuperiorBroker] Cannot update SL bracket - invalid symbol');
				return;
			}

			try {
				this._updateOrder(bracket);
				// Update parent position after bracket is updated
				if (this._host && typeof this._host.positionUpdate === 'function') {
					const cleanPosition = this._createCleanPosition(parent);
					this._host.positionUpdate(cleanPosition);
				}
			} catch (error) {
				console.error('[ZuperiorBroker] Error updating SL bracket:', error);
			}
			return;
		}
	}
}
