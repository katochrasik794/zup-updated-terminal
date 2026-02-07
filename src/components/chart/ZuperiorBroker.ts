import {
	AccountId,
	AccountManagerInfo,
	AccountMetainfo,
	ActionMetaInfo,
	Brackets,
	CellAlignment,
	CommonAccountManagerColumnId,
	ConnectionStatus,
	DefaultContextMenuActionsParams,
	Execution,
	IBrokerConnectionAdapterHost,
	IDelegate,
	IndividualPosition,
	InstrumentInfo,
	IsTradableResult,
	ISubscription,
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
} from '../../../public/charting_library/broker-api';

import { IDatafeedQuotesApi, QuoteData } from '../../../public/charting_library/datafeed-api';
import { AbstractBrokerMinimal } from './abstract-broker-minimal';
import { apiClient } from '../../lib/api';

class SimpleSubscription<TFunc extends Function> implements ISubscription<TFunc> {
	private _listeners: TFunc[] = [];
	public subscribe(listener: TFunc): void {
		this._listeners.push(listener);
	}
	public unsubscribe(listener: TFunc): void {
		const index = this._listeners.indexOf(listener);
		if (index > -1) {
			this._listeners.splice(index, 1);
		}
	}
	public unsubscribeAll(obj: object | null): void {
		this._listeners = [];
	}
	public fire(...args: any[]): void {
		// @ts-ignore
		this._listeners.forEach(listener => listener(...args));
	}
}

import {
	loginDirect,
	getPositionsDirect,
	getPendingOrdersDirect,
	getAccountBalanceDirect,
	closePositionDirect,
	placeMarketOrderDirect,
	placePendingOrderDirect,
	cancelPendingOrderDirect,
	modifyPositionDirect,
	modifyPendingOrderDirect
} from '../../lib/metaapi';

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
		// Host call failed - silently handle
	}
	return undefined;
}

export class ZuperiorBroker extends AbstractBrokerMinimal {
	private _accountId: string | null;
	private _positions: Position[] = [];
	private _orders: Order[] = [];
	private _positionById: SimpleMap<Position> = {};
	private _orderById: SimpleMap<Order> = {};
	private _pollInterval: any = null;
	private _isPolling = false;
	private _isWidgetReady = false;
	private _getMetaApiToken: ((accountId: string) => Promise<string | null>) | null = null;
	private _accessToken: string | null = null;
	private _accountBalance: number = 0;
	private _lastActionTime: number = 0; // Timestamp of last user action to pause polling

	private _positionsSubscription = new SimpleSubscription<(data: {}) => void>();
	private _ordersSubscription = new SimpleSubscription<(data: {}) => void>();

	public constructor(
		host: IBrokerConnectionAdapterHost,
		quotesProvider: IDatafeedQuotesApi,
		accountId: string | null,
		getMetaApiToken?: (accountId: string) => Promise<string | null>
	) {
		super(host, quotesProvider);
		this._accountId = accountId;
		this._getMetaApiToken = getMetaApiToken || null;
		// Start fetching immediately so positions()/orders() have data when TradingView queries
		this._startPolling();
	}

	// Method to update token function after broker creation
	public setMetaApiTokenFunction(getMetaApiToken: (accountId: string) => Promise<string | null>) {
		this._getMetaApiToken = getMetaApiToken;
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

	public setAccountId(accountId: string | null) {
		if (this._accountId === accountId) return;

		this._accountId = accountId;

		// Clear existing data
		this._positions.length = 0;
		this._orders.length = 0;
		this._positionById = {};
		this._orderById = {};

		// Restart polling with new account
		if (this._isPolling) {
			this._fetchPositionsAndOrders();
		} else {
			this._startPolling();
		}
	}

	private _notifyAllPositionsAndOrders() {
		// Ensure arrays exist before filtering
		if (!Array.isArray(this._orders) || !Array.isArray(this._positions)) {
			return;
		}

		// 1. Update positions FIRST (Matches _fetchPositionsAndOrders flow)
		this._positions.forEach(p => {
			try {
				if (this._host) {
					const cleanPosition = this._createCleanPosition(p);
					// Update _positionById with clean position before calling positionUpdate
					this._positionById[cleanPosition.id] = cleanPosition;

					if (typeof this._host.positionUpdate === 'function') {
						console.log('[ZuperiorBroker] Notifying position update:', cleanPosition);
						this._host.positionUpdate(cleanPosition);
					}

					if ((cleanPosition as any).pl !== undefined && typeof (cleanPosition as any).pl === 'number' && typeof this._host.plUpdate === 'function') {
						this._host.plUpdate(cleanPosition.symbol, (cleanPosition as any).pl);
					}
				}
			} catch (error) {
				console.error('[ZuperiorBroker] Error notifying position:', error, p);
			}
		});

		// CRITICAL: Get bracket orders from _orderById (not _orders) for chart display
		// _orders should only contain real pending orders, bracket orders are in _orderById
		const allOrdersFromMap = Object.values(this._orderById || {});
		const bracketOrders = allOrdersFromMap.filter(o => this._isBracketOrder(o));

		console.log(`[ZuperiorBroker] Notify: Total Orders in Map: ${allOrdersFromMap.length}, Brackets: ${bracketOrders.length}`);
		if (bracketOrders.length === 0 && allOrdersFromMap.length > 0) {
			console.log('[ZuperiorBroker] WARNING: Orders exist but no brackets found. Sample order:', allOrdersFromMap[0]);
			console.log('[ZuperiorBroker] _isBracketOrder check result for sample:', this._isBracketOrder(allOrdersFromMap[0]));
		}

		// Regular orders are in _orders array (already filtered to exclude brackets)
		const regularOrders = this._orders.filter(o => o && !this._isBracketOrder(o));

		// 2. Send bracket orders via orderUpdate() with correct status and parentId/parentType set
		bracketOrders.forEach(bracket => {
			console.log(`[ZuperiorBroker] Processing bracket ${bracket.id} for update`);
			try {
				if (this._host && typeof this._host.orderUpdate === 'function') {
					if (bracket.parentType === undefined) {
						bracket.parentType = ParentType.Position;
					}

					// CRITICAL: Calculate projected P/L at bracket price for correct display
					if (bracket.parentId) {
						const parentPosition = this._positionById[bracket.parentId];
						if (parentPosition && parentPosition.avgPrice) {
							const bracketPrice = (bracket as any).limitPrice || (bracket as any).stopPrice;
							if (bracketPrice && parentPosition.avgPrice) {
								// Calculate using FULL volume (multiply qty by 10000)
								const fullVolume = parentPosition.qty * 10000;
								const priceDiff = bracketPrice - parentPosition.avgPrice;
								const plAtBracket = priceDiff * fullVolume * (parentPosition.side === Side.Sell ? -1 : 1);
								// Multiply by 100 to compensate for TradingView's recalculation
								(bracket as any).pl = plAtBracket * 100;
							} else if ((parentPosition as any).pl !== undefined && (parentPosition as any).pl !== null) {
								(bracket as any).pl = (parentPosition as any).pl * 100;
							}
						} else if (parentPosition && (parentPosition as any).pl !== undefined && (parentPosition as any).pl !== null) {
							(bracket as any).pl = (parentPosition as any).pl * 100;
						}
					}

					console.log('[ZuperiorBroker] Notifying bracket order update:', bracket);
					this._host.orderUpdate(bracket);
				}
			} catch (error) {
				// Error notifying bracket order - silently handle
			}
		});

		// 3. Update regular orders (for Account Manager)
		regularOrders.forEach(o => {
			try {
				if (this._host && typeof this._host.orderUpdate === 'function') {
					this._host.orderUpdate(o);
				}
			} catch (error) {
				// Error notifying order - silently handle
			}
		});
	}

	private async _ensureAuth() {
		if (!this._accessToken) {
			try {
				if (this._getMetaApiToken && this._accountId) {
					const token = await this._getMetaApiToken(this._accountId);
					if (token) {
						this._accessToken = token;
						// console.log('[ZuperiorBroker] Authenticated successfully with provided token');
						return !!this._accessToken;
					}
				}

				// Fallback to hardcoded dev credentials ONLY if token function fails or not present
				// (Or remove this entirely if strict auth is required)
				/*
				const loginRes = await loginDirect({
					AccountId: 19876892,
					Password: "Test@000",
					DeviceId: "test_device_curl",
					DeviceType: "web"
				});
				if (loginRes.Token) {
					this._accessToken = loginRes.Token;
					console.log('[ZuperiorBroker] Authenticated successfully with MetaAPI Direct (Fallback)');
				}
				*/
			} catch (e) {
				console.error('[ZuperiorBroker] Auth failed', e);
			}
		}
		return !!this._accessToken;
	}

	private async _startPolling() {
		if (this._isPolling || !this._accountId) return;
		this._isPolling = true;

		await this._ensureAuth();

		// Initial fetch
		await this._fetchPositionsAndOrders();

		// Poll every 2 seconds
		this._pollInterval = setInterval(async () => {
			await this._ensureAuth();
			this._fetchPositionsAndOrders();
		}, 2000);
	}

	private async _fetchPositionsAndOrders() {
		// Prevent polling from clobbering optimistic updates
		if (Date.now() - this._lastActionTime < 4000) {
			console.log('[ZuperiorBroker] Skipping poll due to recent user action');
			return;
		}

		if (!this._accountId) {
			return;
		}

		let positionsArray: any[] = [];
		let pendingArray: any[] = [];
		let usingWindowData = false;

		if (!usingWindowData && this._accessToken) {
			try {
				// Use separate calls since combined endpoint is missing in this version
				const [positions, orders] = await Promise.all([
					getPositionsDirect(this._accountId, this._accessToken),
					getPendingOrdersDirect(this._accountId, this._accessToken)
				]);

				positionsArray = positions;
				pendingArray = orders;

			} catch (error: any) {
				// Handle 401 Unauthorized gracefully
				if (error?.status === 401) {
					console.warn('[ZuperiorBroker] 401 Unauthorized - Token expired, will re-auth next poll.');
					this._accessToken = null; // Clear token to force re-auth
					return;
				}
				console.error('[ZuperiorBroker] Error fetching positions/orders:', error);
				return;
			}
		}

		// Process data only if we have arrays
		if (positionsArray.length > 0 || pendingArray.length > 0) {

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
				.filter((p: Position | null): p is Position => p !== null && !!p.id && !!p.symbol && p.qty > 0 && p.avgPrice > 0);

			// Map pending orders - filter out invalid ones AND bracket orders (TP/SL)
			const tvOrders = (Array.isArray(pendingArray) ? pendingArray : [])
				.map((order: any) => {
					try {
						if (!order || typeof order !== 'object') {
							return null;
						}
						const mappedOrder = this._mapApiOrderToTVOrder(order);
						return mappedOrder;
					} catch (error) {
						console.error('[ZuperiorBroker] Error mapping order:', error, order);
						return null;
					}
				})
				.filter((o: Order | null): o is Order => {
					if (!o || !o.id || !o.symbol) {
						return false;
					}
					// Filter out bracket orders (TP/SL) - they should only be shown as position brackets
					if (o.id && (o.id.includes('TP-') || o.id.includes('SL-'))) {
						return false;
					}
					if (o.status === OrderStatus.Inactive) {
						return false;
					}
					return true;
				});

			// Create bracket orders for positions with TP/SL using helper methods
			const bracketOrders: Order[] = [];
			if (Array.isArray(tvPositions)) {
				tvPositions.forEach(p => {
					// Create TP bracket order if takeProfit is set
					if (p.takeProfit && p.takeProfit > 0 && !isNaN(p.takeProfit) && isFinite(p.takeProfit)) {
						try {
							const tpBracket = this._createTakeProfitBracket(p);
							bracketOrders.push(tpBracket);
						} catch (error) {
							console.error('[ZuperiorBroker] Error creating TP bracket:', error);
						}
					}

					// Create SL bracket order if stopLoss is set
					if (p.stopLoss && p.stopLoss > 0 && !isNaN(p.stopLoss) && isFinite(p.stopLoss)) {
						try {
							const slBracket = this._createStopLossBracket(p);
							bracketOrders.push(slBracket);
						} catch (error) {
							console.error('[ZuperiorBroker] Error creating SL bracket:', error);
						}
					}
				});
			}

			// Combine pending orders with bracket orders
			const allOrders = [...(Array.isArray(tvOrders) ? tvOrders : []), ...bracketOrders];

			// Update internal state
			if (Array.isArray(this._positions) && Array.isArray(tvPositions)) {
				this._positions.length = 0;
				this._positions.push(...tvPositions);
			}

			if (Array.isArray(this._orders) && Array.isArray(tvOrders)) {
				this._orders.length = 0;
				this._orders.push(...tvOrders);
			}

			// Update orderById map with ALL orders (including brackets)
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
			if (this._isWidgetReady) {
				// Step 1: Create clean positions and update internal state BEFORE calling positionUpdate
				const cleanPositions: Position[] = [];
				const positionMap: SimpleMap<Position> = {};

				if (Array.isArray(tvPositions) && tvPositions.length > 0) {
					tvPositions.forEach(p => {
						try {
							const cleanPosition = this._createCleanPosition(p);
							cleanPositions.push(cleanPosition);
							positionMap[cleanPosition.id] = cleanPosition;
						} catch (error) {
							console.error('[ZuperiorBroker] Error creating clean position:', error, p);
						}
					});
				}

				this._positions.length = 0;
				this._positions.push(...cleanPositions);
				this._positionById = positionMap;

				// Notify TradingView with clean positions
				if (cleanPositions.length > 0) {
					cleanPositions.forEach(cleanPosition => {
						try {
							if (this._host && typeof this._host.positionUpdate === 'function') {
								this._host.positionUpdate(cleanPosition);
							}
							if ((cleanPosition as any).pl !== undefined && typeof (cleanPosition as any).pl === 'number' && this._host && typeof this._host.plUpdate === 'function') {
								this._host.plUpdate(cleanPosition.symbol, (cleanPosition as any).pl);
							}
						} catch (error) {
							console.error('[ZuperiorBroker] Error updating position:', error, cleanPosition);
						}
					});
				}

				// Step 2: Send bracket orders via orderUpdate()
				if (Array.isArray(bracketOrders) && bracketOrders.length > 0) {
					bracketOrders.forEach(bracket => {
						try {
							if (bracket && this._host && typeof this._host.orderUpdate === 'function') {
								if (bracket.parentType === undefined) {
									bracket.parentType = ParentType.Position;
								}

								// CRITICAL: Calculate projected P/L at bracket price
								if (bracket.parentId) {
									const parentPosition = this._positionById[bracket.parentId];

									if (parentPosition && parentPosition.avgPrice) {
										const bracketPrice = (bracket as any).limitPrice || (bracket as any).stopPrice;
										if (bracketPrice && parentPosition.avgPrice) {
											const fullVolume = parentPosition.qty * 10000;
											const priceDiff = bracketPrice - parentPosition.avgPrice;
											const plAtBracket = priceDiff * fullVolume * (parentPosition.side === Side.Sell ? -1 : 1);
											(bracket as any).pl = plAtBracket * 100;
										} else if ((parentPosition as any).pl !== undefined && (parentPosition as any).pl !== null) {
											(bracket as any).pl = (parentPosition as any).pl * 100;
										}
									}
								}

								this._host.orderUpdate(bracket);
							}
						} catch (error) {
							console.error('[ZuperiorBroker] Error updating bracket order:', error, bracket);
						}
					});
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
		}
	}

	private _mapApiPositionToTVPosition(apiPos: any): Position {
		const ticket = apiPos.ticket || apiPos.Ticket || apiPos.PositionId || apiPos.id;
		const id = String(ticket);

		// API uses Action field: 0 = Buy, 1 = Sell
		const action = apiPos.Action !== undefined ? apiPos.Action : (apiPos.action !== undefined ? apiPos.action : undefined);
		const typeStr = (apiPos.type || apiPos.Type || '').toString();

		let isBuy = false;

		// Priority 1: Check Action field (0 = Buy, 1 = Sell)
		if (action !== undefined) {
			isBuy = action === 0 || String(action) === '0';
		}
		// Priority 2: Check type string
		else if (typeStr === 'Buy') {
			isBuy = true;
		} else if (typeStr === 'Sell') {
			isBuy = false;
		} else {
			isBuy = typeStr.toLowerCase().includes('buy');
		}

		const side = isBuy ? Side.Buy : Side.Sell;

		const openPrice = Number(apiPos.openPrice || apiPos.OpenPrice || apiPos.PriceOpen || apiPos.priceOpen || apiPos.price || apiPos.Price || 0);
		const currentPrice = Number(apiPos.currentPrice || apiPos.CurrentPrice || apiPos.PriceCurrent || apiPos.priceCurrent || apiPos.price || apiPos.Price || openPrice);

		const rawVolume = apiPos.volume || apiPos.Volume || apiPos.units || 0;
		const volumeLots = apiPos.volumeLots || apiPos.VolumeLots;

		let volume: number;

		if (volumeLots !== undefined && volumeLots !== null) {
			volume = Number(volumeLots);
		} else {
			const numVolume = Math.abs(Number(rawVolume));
			volume = numVolume / 10000;
		}

		const profit = Number(apiPos.profit || apiPos.Profit || apiPos.pl || apiPos.PL || 0);

		const symbol = apiPos.symbol || apiPos.Symbol || '';

		return {
			id: id,
			symbol: symbol,
			qty: volume,
			side: side, // Numeric enum for chart rendering (Side.Buy = 1, Side.Sell = -1)
			sideText: isBuy ? 'Buy' : 'Sell', // String for Account Manager display
			avgPrice: openPrice,
			takeProfit: Number(apiPos.takeProfit || apiPos.TakeProfit || apiPos.PriceTP || apiPos.TP || apiPos.tp || 0) || undefined,
			stopLoss: Number(apiPos.stopLoss || apiPos.StopLoss || apiPos.PriceSL || apiPos.SL || apiPos.sl || 0) || undefined,
			profit: profit, // For Account Manager display
			pl: profit, // For chart trade line P/L display
		} as any;
	}

	private _mapApiOrderToTVOrder(apiOrder: any): Order | null {
		const ticket = apiOrder.ticket || apiOrder.Ticket || apiOrder.orderId || apiOrder.OrderId || apiOrder.id;
		const id = String(ticket);
		if (!id) return null;

		const symbol = apiOrder.symbol || apiOrder.Symbol;
		if (!symbol) return null;

		// Orders API returns numeric Type field:
		// 0 = Buy, 1 = Sell, 2 = Buy Limit, 3 = Sell Limit, 4 = Buy Stop, 5 = Sell Stop
		const orderType = apiOrder.Type ?? apiOrder.type ?? apiOrder.OrderType ?? apiOrder.orderType;

		let isBuy = false;
		let tvOrderType = OrderType.Limit;
		let typeText = '';

		if (typeof orderType === 'number') {
			switch (orderType) {
				case 0: // Buy Market
					isBuy = true;
					tvOrderType = OrderType.Market;
					typeText = 'Buy';
					break;
				case 1: // Sell Market
					isBuy = false;
					tvOrderType = OrderType.Market;
					typeText = 'Sell';
					break;
				case 2: // Buy Limit
					isBuy = true;
					tvOrderType = OrderType.Limit;
					typeText = 'Buy Limit';
					break;
				case 3: // Sell Limit
					isBuy = false;
					tvOrderType = OrderType.Limit;
					typeText = 'Sell Limit';
					break;
				case 4: // Buy Stop
					isBuy = true;
					tvOrderType = OrderType.Stop;
					typeText = 'Buy Stop';
					break;
				case 5: // Sell Stop
					isBuy = false;
					tvOrderType = OrderType.Stop;
					typeText = 'Sell Stop';
					break;
				default:
					// Fallback
					isBuy = true;
					tvOrderType = OrderType.Limit;
					typeText = 'Unknown';
			}
		} else {
			// Fallback to string parsing
			const typeStr = String(orderType || '').toLowerCase();
			isBuy = typeStr.includes('buy');
			if (typeStr.includes('limit')) {
				tvOrderType = OrderType.Limit;
			} else if (typeStr.includes('stop')) {
				tvOrderType = OrderType.Stop;
			}
			typeText = typeStr;
		}

		const side = isBuy ? Side.Buy : Side.Sell;

		// Map API status to TV status - pending orders are Working
		const status = OrderStatus.Working;

		// Orders API uses Volume field (in MT5 format: 1 = 0.01 lots, 100 = 1 lot)
		const rawVolume = apiOrder.Volume || apiOrder.volume || apiOrder.units || 0;
		const volumeLots = apiOrder.VolumeLots || apiOrder.volumeLots;

		let volume: number;
		if (volumeLots !== undefined && volumeLots !== null) {
			volume = Number(volumeLots);
		} else {
			// Convert MT5 volume to lots: divide by 100
			const numVolume = Math.abs(Number(rawVolume));
			volume = numVolume / 100;
		}

		// Orders API uses PriceOrder for the order price
		const openPrice = Number(
			apiOrder.PriceOrder || apiOrder.priceOrder ||
			apiOrder.OpenPrice || apiOrder.openPrice ||
			apiOrder.Price || apiOrder.price || 0
		);

		const mappedOrderType = tvOrderType;
		const mappedSide = side;

		return {
			id: id,
			symbol: symbol,
			qty: volume,
			side: side, // Numeric enum for chart
			sideText: isBuy ? 'Buy' : 'Sell', // String for Account Manager display
			type: tvOrderType, // Order type (Limit/Stop/Market)
			status: status,
			limitPrice: tvOrderType === OrderType.Limit ? openPrice : undefined,
			stopPrice: tvOrderType === OrderType.Stop ? openPrice : undefined,
			takeProfit: Number(apiOrder.PriceTP || apiOrder.priceTP || apiOrder.TakeProfit || apiOrder.takeProfit || 0) || undefined,
			stopLoss: Number(apiOrder.PriceSL || apiOrder.priceSL || apiOrder.StopLoss || apiOrder.stopLoss || 0) || undefined,
		} as unknown as Order;
	}

	private _createCleanPosition(p: Position): Position {
		// Clean position for TV display (similar to original)
		return {
			...p,
			takeProfit: p.takeProfit,
			stopLoss: p.stopLoss,
		};
	}

	private _createTakeProfitBracket(position: Position): Order {
		return {
			id: `${position.id}_TP`,
			symbol: position.symbol,
			qty: position.qty,
			side: changeSide(position.side),
			type: OrderType.Limit,
			status: OrderStatus.Working, // Working allows dragging
			limitPrice: position.takeProfit,
			parentId: position.id,
			parentType: ParentType.Position,
		} as unknown as Order;
	}

	private _createStopLossBracket(position: Position): Order {
		return {
			id: `${position.id}_SL`,
			symbol: position.symbol,
			qty: position.qty,
			side: changeSide(position.side),
			type: OrderType.Stop,
			status: OrderStatus.Working, // Working allows dragging
			stopPrice: position.stopLoss,
			parentId: position.id,
			parentType: ParentType.Position,
		} as unknown as Order;
	}

	private _isBracketOrder(order: Order): boolean {
		return !!(order.parentId || order.parentType !== undefined);
	}

	// Implementation of abstract methods
	public connectionStatus(): ConnectionStatus {
		return ConnectionStatus.Connected;
	}

	public chartContextMenuActions(context: any, options?: DefaultContextMenuActionsParams): Promise<ActionMetaInfo[]> {
		return Promise.resolve([]);
	}

	public isTradable(symbol: string): Promise<IsTradableResult> {
		return Promise.resolve({ tradable: true });
	}

	public async placeOrder(preOrder: PreOrder): Promise<PlaceOrderResult> {
		console.log('[ZuperiorBroker] placeOrder called:', preOrder);
		if (!this._accessToken || !this._accountId) {
			return Promise.reject('Not authenticated');
		}

		// Pause polling
		this._lastActionTime = Date.now();

		const side = preOrder.side === 1 ? 'buy' : 'sell';
		const volume = preOrder.qty; // already in lots? Standard TV sends what we configured (qty)

		try {
			if (preOrder.type === OrderType.Market) { // Market
				await placeMarketOrderDirect({
					accountId: this._accountId,
					accessToken: this._accessToken,
					symbol: preOrder.symbol,
					side: side,
					volume: volume,
					stopLoss: preOrder.stopLoss,
					takeProfit: preOrder.takeProfit
				});
			} else {
				// Pending
				const price = (preOrder as any).limitPrice || (preOrder as any).stopPrice || 0;
				const orderType = preOrder.type === OrderType.Limit ? 'limit' : 'stop'; // simplified

				await placePendingOrderDirect({
					accountId: this._accountId,
					accessToken: this._accessToken,
					symbol: preOrder.symbol,
					side: side,
					volume: volume,
					price: price,
					orderType: orderType,
					stopLoss: preOrder.stopLoss,
					takeProfit: preOrder.takeProfit
				});
			}
			// Refresh soon
			setTimeout(() => this._fetchPositionsAndOrders(), 4500);
			return {};
		} catch (e: any) {
			console.error('Place order failed', e);
			throw e;
		}
	}

	public async modifyOrder(order: Order): Promise<void> {
		console.log('[ZuperiorBroker] modifyOrder called:', {
			id: order.id,
			symbol: order.symbol,
			limitPrice: order.limitPrice,
			stopPrice: order.stopPrice,
			parentId: order.parentId,
			parentType: order.parentType,
			isBracket: this._isBracketOrder(order),
		});

		if (!this._accessToken || !this._accountId) {
			return Promise.reject('Not authenticated');
		}

		// Pause polling
		this._lastActionTime = Date.now();

		try {
			if (this._isBracketOrder(order) && order.parentId) {
				// Handle bracket modification by delegating to editPositionBrackets
				const isTP = order.id.endsWith('_TP');
				const isSL = order.id.endsWith('_SL');

				const modification: any = {};

				// Get current position to preserve other values if needed, 
				// though editPositionBrackets/modifyPositionDirect handles partials well.
				const currentPos = this._positionById[order.parentId];
				if (!currentPos) {
					console.error('[ZuperiorBroker] Modify bracket failed: Parent position not found');
					return Promise.resolve();
				}

				if (isTP) {
					// TP is a Limit order
					modification.takeProfit = order.limitPrice;
					// Keep existing SL
					modification.stopLoss = currentPos.stopLoss;
				} else if (isSL) {
					// SL is a Stop order
					modification.stopLoss = order.stopPrice;
					// Keep existing TP
					modification.takeProfit = currentPos.takeProfit;
				}

				console.log('[ZuperiorBroker] Delegating bracket modify to editPositionBrackets:', modification);
				return this.editPositionBrackets(order.parentId, modification);

			} else {
				// Regular pending order modification
				await modifyPendingOrderDirect({
					accountId: this._accountId,
					accessToken: this._accessToken,
					orderId: order.id,
					price: order.limitPrice || order.stopPrice,
					stopLoss: order.stopLoss,
					takeProfit: order.takeProfit
				});
				setTimeout(() => this._fetchPositionsAndOrders(), 4500);
			}
		} catch (e) {
			console.error('Modify order failed', e);
			throw e;
		}
	}

	public async cancelOrder(orderId: string): Promise<void> {
		if (!this._accessToken || !this._accountId) return Promise.reject("Auth failed");
		try {
			await cancelPendingOrderDirect({
				accountId: this._accountId,
				accessToken: this._accessToken,
				orderId: orderId
			});
			setTimeout(() => this._fetchPositionsAndOrders(), 500);
		} catch (e) {
			console.error('Cancel order failed', e);
			throw e;
		}
	}

	public async editPositionBrackets(positionId: string, modification: any): Promise<void> {
		if (!this._accessToken || !this._accountId) return Promise.reject("Auth failed");

		// Pause polling to protect optimistic update
		this._lastActionTime = Date.now();

		try {
			await modifyPositionDirect({
				accountId: this._accountId,
				accessToken: this._accessToken,
				positionId: positionId,
				stopLoss: modification.stopLoss,
				takeProfit: modification.takeProfit
			});

			// Optimistic update
			const position = this._positionById[positionId];
			if (position) {
				if (modification.stopLoss !== undefined) position.stopLoss = modification.stopLoss;
				if (modification.takeProfit !== undefined) position.takeProfit = modification.takeProfit;

				// Update _positions array reference
				const index = this._positions.findIndex(p => p.id === positionId);
				if (index !== -1) {
					this._positions[index] = { ...position };
				}

				// CRITICAL: Remove old brackets from _orderById so they can be replaced
				delete this._orderById[`${positionId}_TP`];
				delete this._orderById[`${positionId}_SL`];

				// Regenerate brackets with new values
				if (position.takeProfit && position.takeProfit > 0) {
					try {
						const tpBracket = this._createTakeProfitBracket(position);
						this._orderById[tpBracket.id] = tpBracket;
						console.log('[ZuperiorBroker] Regenerated TP Bracket:', tpBracket);
					} catch (e) {
						console.error('[ZuperiorBroker] Error recreating TP bracket', e);
					}
				}

				if (position.stopLoss && position.stopLoss > 0) {
					try {
						const slBracket = this._createStopLossBracket(position);
						this._orderById[slBracket.id] = slBracket;
						console.log('[ZuperiorBroker] Regenerated SL Bracket:', slBracket);
					} catch (e) {
						console.error('[ZuperiorBroker] Error recreating SL bracket', e);
					}
				}

				this._notifyAllPositionsAndOrders();
			}

			// Fetch after delay (give API time to update)
			setTimeout(() => this._fetchPositionsAndOrders(), 4500);
		} catch (e) {
			console.error('Modify position failed', e);
			throw e;
		}
	}

	public async closePosition(positionId: string): Promise<void> {
		if (!this._accessToken || !this._accountId) return Promise.reject("Auth failed");
		try {
			await closePositionDirect({
				accountId: this._accountId,
				accessToken: this._accessToken,
				positionId: positionId
			});
			setTimeout(() => this._fetchPositionsAndOrders(), 500);
		} catch (e) {
			console.error('Close position failed', e);
			throw e;
		}
	}

	public accountManagerInfo(): AccountManagerInfo {
		const orderColumns: any[] = [
			{
				id: 'symbol',
				label: 'Symbol',
				dataFields: ['symbol'],
				formatter: StandardFormatterName.Text,
			},
			{
				id: 'side',
				label: 'Side',
				dataFields: ['sideText'],
				formatter: StandardFormatterName.Text,
			},
			{
				id: 'qty',
				label: 'Qty',
				dataFields: ['qty'],
				formatter: StandardFormatterName.Fixed,
			},
			{
				id: 'status',
				label: 'Status',
				dataFields: ['status'],
				formatter: StandardFormatterName.Text,
			}
		];

		const positionColumns: any[] = [
			{
				id: 'symbol',
				label: 'Symbol',
				dataFields: ['symbol'],
				formatter: StandardFormatterName.Text,
			},
			{
				id: 'side',
				label: 'Side',
				dataFields: ['sideText'],
				formatter: StandardFormatterName.Text,
			},
			{
				id: 'qty',
				label: 'Qty',
				dataFields: ['qty'],
				formatter: StandardFormatterName.Fixed,
			},
			{
				id: 'avgPrice',
				label: 'Price',
				dataFields: ['avgPrice'],
				formatter: StandardFormatterName.FormatPrice,
			},
			{
				id: 'profit',
				label: 'Profit',
				dataFields: ['profit'],
				formatter: StandardFormatterName.Fixed,
			}
		];

		return {
			accountTitle: 'Zuperior Financial',
			summary: [
				{
					text: 'Balance',
					wValue: {
						subscribe: (onChange: any) => { },
						unsubscribe: (onChange: any) => { },
						value: () => this._accountBalance,
						when: (callback: any) => { } // Dummy implementation to satisfy interface
					},
					formatter: StandardFormatterName.Fixed // Using fixed format
				}
			],
			orderColumns: orderColumns,
			positionColumns: positionColumns,
			pages: [
				{
					id: 'positions',
					title: 'Positions',
					tables: [
						{
							id: 'positions',
							columns: positionColumns,
							getData: () => Promise.resolve(this._positions),
							changeDelegate: this._positionsSubscription
						}
					]
				},
				{
					id: 'orders',
					title: 'Orders',
					tables: [
						{
							id: 'orders',
							columns: orderColumns,
							getData: () => Promise.resolve(this._orders),
							changeDelegate: this._ordersSubscription
						}
					]
				}
			]
		};
	}

	public accountsMetainfo(): Promise<AccountMetainfo[]> {
		return Promise.resolve([
			{
				id: (this._accountId || '1') as AccountId,
				name: 'Zuperior Main',
				currency: 'USD'
			}
		]);
	}
	public async orders(): Promise<Order[]> {
		return Promise.resolve(this._orders);
	}

	public async positions(): Promise<Position[]> {
		return Promise.resolve(this._positions);
	}

	public async executions(symbol: string): Promise<Execution[]> {
		return [];
	}

	public currentAccount(): AccountId {
		return (this._accountId || '') as AccountId;
	}

	public async symbolInfo(symbol: string): Promise<InstrumentInfo> {
		return {
			qty: { min: 0.01, max: 100, step: 0.01 },
			pipSize: 0.01,
			pipValue: 1,
			minTick: 0.01,
			description: symbol,
			type: 'crypto',
			domVolumePrecision: 2,
			id: symbol,
			name: symbol,
			minMove2: 0,
			pricescale: 100,
			session: '24x7',
			timezone: 'Etc/UTC'
		} as unknown as InstrumentInfo;
	}

	public formatter(symbol: string, alignToMinMove?: boolean): Promise<any> {
		return Promise.resolve({
			format: (value: number) => {
				if (value === undefined || value === null) return '';
				return value.toFixed(2);
			}
		});
	}

	public async updatePositionBrackets(positionId: string, modified: any): Promise<void> {
		return this.editPositionBrackets(positionId, modified);
	}
}
