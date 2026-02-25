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

import { ChartSettings } from '../../context/TradingContext';

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
		this._listeners.forEach(listener => {
			if (typeof listener === 'function') {
				// @ts-ignore
				listener(...args);
			}
		});
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

export const PREVIEW_ORDER_ID = 'GHOST_PREVIEW_ID';
export const PREVIEW_POSITION_ID = 'GHOST_PREVIEW_POS_ID';

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
	private _isBrokerModalOpen: boolean = false;
	private _isPlacingOrder: boolean = false;
	private _chartSettings: ChartSettings = { openPositions: true, tpsl: true };

	private _positionsSubscription = new SimpleSubscription<(data: {}) => void>();
	private _ordersSubscription = new SimpleSubscription<(data: {}) => void>();

	// Validation Callbacks

	private _getFreeMargin: () => number = () => 0;
	private _isMarketClosedFunc: (symbol: string) => boolean = () => false;

	public constructor(
		host: IBrokerConnectionAdapterHost,
		quotesProvider: IDatafeedQuotesApi,
		accountId: string | null,
		getMetaApiToken?: (accountId: string) => Promise<string | null>
	) {
		super(host, quotesProvider);
		this._accountId = accountId;
		this._getMetaApiToken = getMetaApiToken || null;

		// Instant refresh when TradingTerminal updates optimistic data
		if (typeof window !== 'undefined') {
			this._handleLiveUpdate = () => {
				// Force immediate fetch from __LIVE_POSITIONS_DATA__
				this._fetchPositionsAndOrders(true);
			};
			window.addEventListener('zuperior-positions-updated', this._handleLiveUpdate);
		}

		// Start fetching immediately so positions()/orders() have data when TradingView queries
		this._startPolling();
	}

	// Setters for validation functions
	public setValidationFunctions(funcs: {
		getFreeMargin: () => number;
		isMarketClosed: (symbol: string) => boolean;
	}) {
		this._getFreeMargin = funcs.getFreeMargin;
		this._isMarketClosedFunc = funcs.isMarketClosed;
	}

	private _checkPreConditions(action: 'buy' | 'sell' | 'modify' | 'close', symbol: string, volume: number = 0): boolean {


		// 2. Market Closed Check
		if (this._isMarketClosedFunc(symbol)) {
			this._showOrderToast({
				side: action === 'sell' ? 'sell' : 'buy',
				symbol: symbol,
				volume: volume,
				price: null,
				orderType: 'market',
				profit: null,
				error: `Market closed for ${symbol}. Action not possible.`,
			});
			return false;
		}

		// 3. Free Margin Check (only for open)
		if (action !== 'close' && action !== 'modify') {
			const freeMargin = this._getFreeMargin();
			if (freeMargin <= 1) {
				this._showOrderToast({
					side: action === 'sell' ? 'sell' : 'buy',
					symbol: symbol,
					volume: volume,
					price: null,
					orderType: 'market',
					profit: null,
					error: `Insufficient Funds ${action.charAt(0).toUpperCase() + action.slice(1)} not allowed`,
				});
				return false;
			}
		}

		return true;
	}

	private _validateSLTP(side: 'buy' | 'sell', currentPrice: number, sl?: number, tp?: number): string | null {
		const isBuy = side === 'buy';
		if (sl && sl > 0) {
			if (isBuy && sl >= currentPrice) return "Buy Stop Loss must be below the current price.";
			if (!isBuy && sl <= currentPrice) return "Sell Stop Loss must be above the current price.";
		}
		if (tp && tp > 0) {
			if (isBuy && tp <= currentPrice) return "Buy Take Profit must be above the current price.";
			if (!isBuy && tp >= currentPrice) return "Sell Take Profit must be below the current price.";
		}
		return null;
	}

	private _getTradeSide(entity: Order | Position): 'buy' | 'sell' {
		// Priority 1: Check explicit sideText or type strings
		const idStr = entity.id.toString();
		const typeStr = ((entity as any).sideText || (entity as any).type || '').toString().toLowerCase();

		if (typeStr.includes('buy')) return 'buy';
		if (typeStr.includes('sell')) return 'sell';

		// Priority 2: Infer from ID if it's a bracket and parent lookup fails
		// If this is a TP/SL bracket, its side is always the OPPOSITE of the trade side.
		if (idStr.includes('_TP') || idStr.includes('_SL')) {
			const bracketSide = entity.side === Side.Buy ? 'buy' : 'sell';
			return bracketSide === 'buy' ? 'sell' : 'buy';
		}

		// Priority 3: Check parent trade
		const parentId = (entity as any).parentId;
		if (parentId !== undefined && parentId !== null) {
			const pidStr = String(parentId);
			const parent = this._positionById[pidStr] ||
				this._orderById[pidStr] ||
				this._positionById[pidStr.replace('GHOST_', '')] ||
				this._orderById[pidStr.replace('GHOST_', '')] ||
				// Try numeric lookup if it looks like a ticket
				(isNaN(Number(pidStr)) ? null : (this._positionById[Number(pidStr)] || this._orderById[Number(pidStr)]));

			if (parent) return this._getTradeSide(parent);
		}

		// Fallback to the numeric side value
		return entity.side === Side.Buy ? 'buy' : 'sell';
	}

	private _getCurrentPrice(symbol: string, side: Side): number {
		const liveData = (typeof window !== 'undefined' ? (window as any).__LIVE_POSITIONS_DATA__ : null);
		// Try to find a position with this symbol to get real-time price
		const livePos = liveData?.openPositions?.find((p: any) => p.symbol === symbol);
		if (livePos) {
			return side === Side.Buy ? livePos.currentPrice : livePos.currentPrice; // Simplification: livePos.currentPrice is generally the relevant one
		}
		return 0;
	}

	private _triggerSnapBack(entity: Order | Position, originalTP?: Order, originalSL?: Order) {
		// Small delay to ensure TradingView has finished its internal drag state before we force an update
		setTimeout(() => {
			if (!this._host) return;
			try {
				const idStr = String(entity.id);
				// We MUST use the latest known valid state from our own maps, not necessarily the 'entity' passed (which might have been mutated)
				const originalEntity = (entity as any).avgPrice !== undefined
					? this._positionById[idStr]
					: this._orderById[idStr];

				if (!originalEntity) {
					console.warn("[ZuperiorBroker] _triggerSnapBack: Original entity not found in map for snap-back:", idStr);
					return;
				}

				// Side check: ensure we use the actual Side enum values (1 for Buy, -1 for Sell)
				const entityClone = { ...originalEntity };

				if ((entityClone as any).avgPrice !== undefined) {
					if (typeof this._host.positionUpdate === 'function') {
						this._host.positionUpdate(entityClone as Position);
					}
				} else {
					if (typeof this._host.orderUpdate === 'function') {
						this._host.orderUpdate(entityClone as Order);
					}
				}

				// Also notify associated brackets if it's a position/order
				const tpId = `${idStr}_TP`;
				const slId = `${idStr}_SL`;

				// Use explicitly provided original brackets if available, otherwise fallback to map (which might be optimistically mutated)
				const tpToRestore = originalTP || this._orderById[tpId];
				const slToRestore = originalSL || this._orderById[slId];

				if (tpToRestore && typeof this._host.orderUpdate === 'function') {
					this._host.orderUpdate({ ...tpToRestore });
				}
				if (slToRestore && typeof this._host.orderUpdate === 'function') {
					this._host.orderUpdate({ ...slToRestore });
				}
			} catch (e) {
				console.error("[ZuperiorBroker] _triggerSnapBack failed:", e);
			}
		}, 120); // Slightly longer delay to be safe
	}

	private _showOrderToast(detail: any) {
		if (typeof window !== 'undefined') {
			const targetWin = window.top || window;
			targetWin.dispatchEvent(new CustomEvent('zuperior-show-toast', { detail }));
		}
	}

	private _handleLiveUpdate: () => void = () => { };

	// Called when chart widget is removed
	public __cleanup__() {
		if (typeof window !== 'undefined' && this._handleLiveUpdate) {
			window.removeEventListener('zuperior-positions-updated', this._handleLiveUpdate);
		}
		if (this._pollInterval) {
			clearInterval(this._pollInterval);
		}
	}

	// Method to update token function after broker creation
	public setMetaApiTokenFunction(getMetaApiToken: (accountId: string) => Promise<string | null>) {
		this._getMetaApiToken = getMetaApiToken;
	}

	public setChartSettings(settings: ChartSettings) {
		this._chartSettings = settings;
		// Trigger immediate UI refresh and force a poll to be sure
		this._notifyAllPositionsAndOrders();
		this._fetchPositionsAndOrders(true);
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
					// Respect openPositions toggle
					if (!this._chartSettings.openPositions) {
						if (typeof this._host.positionUpdate === 'function') {
							this._host.positionUpdate({ ...this._createCleanPosition(p), qty: 0 });
						}
						return;
					}

					const cleanPosition = this._createCleanPosition(p);
					// Update _positionById with clean position before calling positionUpdate
					this._positionById[cleanPosition.id] = cleanPosition;

					if (typeof this._host.positionUpdate === 'function') {
						this._host.positionUpdate({ ...cleanPosition });
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



		// Regular orders are in _orders array (already filtered to exclude brackets)
		const regularOrders = this._orders.filter(o => o && !this._isBracketOrder(o));

		// 2. Send bracket orders via orderUpdate() with correct status and parentId/parentType set
		bracketOrders.forEach(bracket => {
			// Respect tpsl toggle for bracket orders
			if (!this._chartSettings.tpsl) {
				if (this._host && typeof this._host.orderUpdate === 'function') {
					this._host.orderUpdate({ ...bracket, status: OrderStatus.Canceled });
				}
				return;
			}

			try {
				if (this._host && typeof this._host.orderUpdate === 'function') {
					if (bracket.parentType === undefined) {
						bracket.parentType = ParentType.Position;
					}

					// CRITICAL: Calculate projected P/L at bracket price for correct display
					// CRITICAL: Calculate projected P/L at bracket price for correct display
					if (bracket.parentId) {
						const parentPosition = this._positionById[bracket.parentId];
						const parentOrder = this._orderById[bracket.parentId];

						if (parentPosition) {
							// Ensure parentType is Position
							bracket.parentType = ParentType.Position;

							if (parentPosition.avgPrice) {
								const bracketPrice = (bracket as any).limitPrice || (bracket as any).stopPrice;
								if (bracketPrice) {
									// Calculate using FULL volume (multiply qty by 10000)
									const fullVolume = parentPosition.qty * 100;
									const priceDiff = bracketPrice - parentPosition.avgPrice;
									const plAtBracket = priceDiff * fullVolume * (parentPosition.side === Side.Sell ? -1 : 1);
									// Multiply by 100 to compensate for TradingView's recalculation
									(bracket as any).pl = plAtBracket * 100;
								} else if ((parentPosition as any).pl !== undefined && (parentPosition as any).pl !== null) {
									(bracket as any).pl = (parentPosition as any).pl * 100;
								}
							}
						} else if (parentOrder) {
							// For order brackets, no P/L calc needed; ensure parentType is Order
							bracket.parentType = ParentType.Order;
						}
					}

					// console.log('[ZuperiorBroker] Notifying bracket order update:', bracket);
					this._host.orderUpdate({ ...bracket });
				}
			} catch (error) {
				// Error notifying bracket order - silently handle
			}
		});

		// 3. Update regular orders (for Account Manager)
		regularOrders.forEach(o => {
			// Respect tpsl toggle for regular (pending) orders
			if (!this._chartSettings.tpsl && !o.id.startsWith(PREVIEW_ORDER_ID)) {
				if (this._host && typeof this._host.orderUpdate === 'function') {
					this._host.orderUpdate({ ...o, status: OrderStatus.Canceled });
				}
				return;
			}

			try {
				if (this._host && typeof this._host.orderUpdate === 'function') {
					this._host.orderUpdate({ ...o });
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

	public connectionStatus(): number {
		return 1; // Connected
	}

	private async _startPolling() {
		if (this._isPolling || !this._accountId) return;
		this._isPolling = true;

		await this._ensureAuth();

		// Initial fetch
		await this._fetchPositionsAndOrders();


		// Poll every 800ms to reduce backend pressure while keeping chart reasonably fresh
		this._pollInterval = setInterval(async () => {
			await this._ensureAuth();
			await this._fetchPositionsAndOrders();
		}, 800);
	}

	private async _fetchPositionsAndOrders(force: boolean = false) {
		// Prevent polling from clobbering optimistic updates unless explicitly forced
		// Reduced window to 1200ms to keep UI fresh while avoiding flicker
		if (!force && Date.now() - this._lastActionTime < 1200) {
			// console.log('[ZuperiorBroker] Skipping poll due to recent user action');
			return;
		}

		if (!this._accountId) {
			return;
		}

		const prevPositions = Array.isArray(this._positions) ? [...this._positions] : [];
		const prevPositionMap: SimpleMap<Position> = { ...this._positionById };
		const prevOrderMap: SimpleMap<Order> = { ...this._orderById };

		let positionsArray: any[] = [];
		let pendingArray: any[] = [];

		// Prefer live data already on the page (same source as Position table) to keep UI in lockstep
		const liveData = (typeof window !== 'undefined' ? (window as any).__LIVE_POSITIONS_DATA__ : null);
		if (liveData) {
			positionsArray = Array.isArray(liveData.openPositions) ? liveData.openPositions : [];
			pendingArray = Array.isArray(liveData.pendingOrders) ? liveData.pendingOrders : [];
		} else if (this._accessToken) {
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

		// --- RESTORED: Handle truly zero-latency optimistic injections ---
		const confirmedInjections = (typeof window !== 'undefined' ? (window as any).__CONFIRMED_INJECTIONS__ : null) || [];
		if (Array.isArray(confirmedInjections) && confirmedInjections.length > 0) {
			confirmedInjections.forEach((inj: any) => {
				const injIdStr = String(inj.id);
				// If this injection is already in tvOrders/tvPositions (matching by Ticket ID), skip it
				const alreadyExists = tvOrders.some(o => String(o.id) === injIdStr || String((o as any).ticket) === injIdStr) ||
					tvPositions.some(p => String(p.id) === injIdStr || String((p as any).ticket) === injIdStr);

				if (!alreadyExists) {
					// Map to TV Order or Position based on status
					const side = (inj.side === 1 || inj.side === 'buy') ? Side.Buy : Side.Sell;

					if (inj.status === 'Filled' || inj.status === 1 || inj.isPosition) {
						tvPositions.push({
							id: inj.ghostId || injIdStr, // Use ghostId if available for bracket linkage
							symbol: inj.symbol,
							qty: (inj.volume || inj.qty || 0) / 100,
							side: side,
							sideText: (side === Side.Buy) ? 'Buy' : 'Sell',
							avgPrice: inj.price || inj.openPrice || inj.currentPrice,
							currentPrice: inj.price || inj.currentPrice || inj.openPrice,
							takeProfit: inj.takeProfit,
							stopLoss: inj.stopLoss,
							profit: 0,
							isOptimistic: true,
							ticket: inj.ticket || 0
						});
					} else {
						tvOrders.push({
							id: injIdStr,
							symbol: inj.symbol,
							qty: (inj.volume || inj.qty || 0) / 100,
							side: side,
							sideText: (side === Side.Buy) ? 'Buy' : 'Sell',
							type: inj.type?.includes('Limit') ? OrderType.Limit : OrderType.Stop,
							status: OrderStatus.Working,
							limitPrice: inj.type?.includes('Limit') ? (inj.price || inj.openPrice) : undefined,
							stopPrice: inj.type?.includes('Stop') ? (inj.price || inj.openPrice) : undefined,
							takeProfit: inj.takeProfit,
							stopLoss: inj.stopLoss
						});
					}
				}
			});
		}

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

		// Create bracket orders for pending orders with TP/SL
		const orderBracketOrders: Order[] = [];
		if (Array.isArray(tvOrders)) {
			tvOrders.forEach(o => {
				if (o.takeProfit && o.takeProfit > 0) {
					try {
						orderBracketOrders.push(this._createOrderTakeProfitBracket(o));
					} catch (e) {
						console.error('[ZuperiorBroker] Error creating order TP bracket:', e);
					}
				}
				if (o.stopLoss && o.stopLoss > 0) {
					try {
						orderBracketOrders.push(this._createOrderStopLossBracket(o));
					} catch (e) {
						console.error('[ZuperiorBroker] Error creating order SL bracket:', e);
					}
				}
			});
		}

		// Combine pending orders with bracket orders
		const allOrders = [
			...(Array.isArray(tvOrders) ? tvOrders : []),
			...bracketOrders,
			...orderBracketOrders
		];


		// Keep preview order/position and their brackets if they exist in internal state
		Object.keys(this._orderById).forEach(id => {
			if (id.toString().startsWith(PREVIEW_ORDER_ID) || id.toString().startsWith(PREVIEW_POSITION_ID)) {
				const pOrder = this._orderById[id];
				if (!allOrders.find(o => o.id === pOrder.id)) {
					allOrders.push(pOrder);
				}
			}
		});

		// Building clean positions map

		// Build clean positions map
		const cleanPositions: Position[] = [];
		const positionMap: SimpleMap<Position> = {};
		if (Array.isArray(tvPositions)) {
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

		// Inject ghost position if it exists
		if (this._positionById[PREVIEW_POSITION_ID]) {
			const gPos = this._positionById[PREVIEW_POSITION_ID];
			if (!cleanPositions.find(p => p.id === gPos.id)) {
				cleanPositions.push(gPos);
				positionMap[gPos.id] = gPos;
			}
		}
		this._positions = Array.isArray(tvPositions) ? [...tvPositions] : [];
		// Keep all orders (pending + brackets) so TradingView can track edits/drags
		this._orders = Array.isArray(allOrders) ? [...allOrders] : [];
		this._positionById = positionMap;

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

		// Notify Account Manager tables (if subscribed)
		this._positionsSubscription.fire({});
		this._ordersSubscription.fire({});

		// Notify TradingView if widget is ready
		if (this._isWidgetReady) {
			// Step 1: Detect and handle CLOSED positions (Diff against previous state)
			const previousPositionIds = new Set(prevPositions.map(p => p.id));
			const newPositionIds = new Set(cleanPositions.map(p => p.id));

			previousPositionIds.forEach(prevId => {
				if (!newPositionIds.has(prevId)) {
					console.log('[ZuperiorBroker] Detected external close for position:', prevId);
					const closedPosition = prevPositionMap[prevId];
					if (closedPosition && this._host && typeof this._host.positionUpdate === 'function') {
						this._host.positionUpdate({ ...closedPosition, qty: 0, avgPrice: 0 });
					}
				}
			});

			// Notify TradingView with clean positions
			if (cleanPositions.length > 0) {
				cleanPositions.forEach(cleanPosition => {
					try {
						// For positions, we usually notify more frequently for P/L updates
						if (this._host && typeof this._host.positionUpdate === 'function') {
							// Respect openPositions toggle
							if (!this._chartSettings.openPositions) {
								this._host.positionUpdate({ ...cleanPosition, qty: 0 });
							} else {
								this._host.positionUpdate(cleanPosition);
							}
						}
						if ((cleanPosition as any).pl !== undefined && typeof (cleanPosition as any).pl === 'number' && this._host && typeof this._host.plUpdate === 'function') {
							this._host.plUpdate(cleanPosition.symbol, (cleanPosition as any).pl);
						}
					} catch (error) {
						console.error('[ZuperiorBroker] Error updating position:', error, cleanPosition);
					}
				});
			}

			// Step 2: Send bracket orders via orderUpdate() ONLY IF CHANGED
			const allBracketOrders = [...bracketOrders, ...orderBracketOrders];
			if (Array.isArray(allBracketOrders) && allBracketOrders.length > 0) {
				allBracketOrders.forEach(bracket => {
					try {
						if (bracket && this._host && typeof this._host.orderUpdate === 'function') {
							// Determine if we should notify
							const prevBracket = prevOrderMap[bracket.id];
							let shouldNotify = !prevBracket;

							if (prevBracket) {
								const newPrice = (bracket as any).limitPrice || (bracket as any).stopPrice;
								const oldPrice = (prevBracket as any).limitPrice || (prevBracket as any).stopPrice;
								if (newPrice !== oldPrice || bracket.qty !== prevBracket.qty || bracket.status !== prevBracket.status) {
									shouldNotify = true;
								}
							}

							if (shouldNotify) {
								if (bracket.parentType === undefined) {
									bracket.parentType = ParentType.Position;
								}

								// Respect tpsl toggle for bracket orders
								if (!this._chartSettings.tpsl) {
									this._host.orderUpdate({ ...bracket, status: OrderStatus.Canceled });
								} else {
									// CRITICAL: Calculate projected P/L at bracket price
									if (bracket.parentId) {
										const parentPosition = this._positionById[bracket.parentId];
										const parentOrder = this._orderById[bracket.parentId];

										// Use position if parent is a position, otherwise order price as reference
										if (parentPosition && parentPosition.avgPrice) {
											const bracketPrice = (bracket as any).limitPrice || (bracket as any).stopPrice;
											if (bracketPrice && parentPosition.avgPrice) {
												const fullVolume = parentPosition.qty * 100;
												const priceDiff = bracketPrice - parentPosition.avgPrice;
												const plAtBracket = priceDiff * fullVolume * (parentPosition.side === Side.Sell ? -1 : 1);
												(bracket as any).pl = plAtBracket * 100;
											} else if ((parentPosition as any).pl !== undefined && (parentPosition as any).pl !== null) {
												(bracket as any).pl = (parentPosition as any).pl * 100;
											}
										} else if (parentOrder) {
											// For order brackets, no P/L calc needed; ensure parentType is Order
											bracket.parentType = ParentType.Order;
										}
									}

									this._host.orderUpdate(bracket);
								}
							}
						}
					} catch (error) {
						console.error('[ZuperiorBroker] Error updating bracket order:', error, bracket);
					}
				});
			}

			// Step 3: Update pending orders ONLY IF CHANGED
			if (Array.isArray(tvOrders)) {
				tvOrders.forEach(o => {
					try {
						if (o && this._host && typeof this._host.orderUpdate === 'function') {
							const prevOrder = prevOrderMap[o.id];
							let shouldNotify = !prevOrder;

							if (prevOrder) {
								if (o.limitPrice !== prevOrder.limitPrice || o.stopPrice !== prevOrder.stopPrice || o.qty !== prevOrder.qty || o.status !== prevOrder.status) {
									shouldNotify = true;
								}
							}

							if (shouldNotify) {
								// Respect tpsl toggle for regular (pending) orders
								if (!this._chartSettings.tpsl && !o.id.startsWith(PREVIEW_ORDER_ID)) {
									this._host.orderUpdate({ ...o, status: OrderStatus.Canceled });
								} else {
									this._host.orderUpdate(o);
								}
							}
						}
					} catch (error) {
						console.error('[ZuperiorBroker] Error updating order:', error, o);
					}
				});
			}

			// Step 4: Cancel removed orders (including brackets)
			const newOrderIds = new Set(Object.keys(orderMap));
			Object.keys(prevOrderMap).forEach(prevId => {
				if (!newOrderIds.has(prevId)) {
					const removedOrder = prevOrderMap[prevId];
					if (removedOrder && this._host && typeof this._host.orderUpdate === 'function') {
						this._host.orderUpdate({ ...removedOrder, status: OrderStatus.Canceled });
					}
				}
			});
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

		const openPrice = Number(apiPos.openPrice || apiPos.OpenPrice || apiPos.PriceOpen || apiPos.priceOpen || apiPos.price || apiPos.Price || apiPos.currentPrice || apiPos.CurrentPrice || apiPos.PriceCurrent || apiPos.priceCurrent || 0);

		const rawVolume = apiPos.volume || apiPos.Volume || apiPos.units || 0;
		const volumeLots = apiPos.volumeLots || apiPos.VolumeLots;

		let volume: number;

		if (volumeLots !== undefined && volumeLots !== null) {
			volume = Number(volumeLots);
		} else {
			const numVolume = Math.abs(Number(rawVolume));
			volume = numVolume / 100;
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
			text: " ",
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
			side: side,
			sideText: isBuy ? 'Buy' : 'Sell',
			type: tvOrderType,
			status: status,
			limitPrice: tvOrderType === OrderType.Limit ? openPrice : undefined,
			stopPrice: tvOrderType === OrderType.Stop ? openPrice : undefined,
			takeProfit: Number(apiOrder.PriceTP || apiOrder.priceTP || apiOrder.TakeProfit || apiOrder.takeProfit || 0) || undefined,
			stopLoss: Number(apiOrder.PriceSL || apiOrder.priceSL || apiOrder.StopLoss || apiOrder.stopLoss || 0) || undefined,
			text: " ",
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
			status: OrderStatus.Working,
			limitPrice: position.takeProfit,
			parentId: position.id,
			parentType: ParentType.Position,
			text: "TP",
			sideText: " ",
			typeText: " ",
			qtyText: " ",
		} as unknown as Order;
	}

	private _createStopLossBracket(position: Position): Order {
		return {
			id: `${position.id}_SL`,
			symbol: position.symbol,
			qty: position.qty,
			side: changeSide(position.side),
			type: OrderType.Stop,
			status: OrderStatus.Working,
			stopPrice: position.stopLoss,
			parentId: position.id,
			parentType: ParentType.Position,
			text: "SL",
			sideText: " ",
			typeText: " ",
			qtyText: " ",
		} as unknown as Order;
	}

	private _isBracketOrder(order: Order): boolean {
		if (!order) return false;
		if (order.parentId || order.parentType !== undefined) return true;
		const id = (order.id || '').toString();
		return id.includes('_TP') || id.includes('_SL') || id.includes('TP-') || id.includes('SL-');
	}

	// Brackets for pending orders (use parentType=Order)
	private _createOrderTakeProfitBracket(order: Order): Order {
		const isPreview = (order.id === PREVIEW_ORDER_ID) || (order.id === PREVIEW_POSITION_ID);
		return {
			id: `${order.id}_TP`,
			symbol: order.symbol,
			qty: order.qty,
			side: changeSide(order.side),
			type: OrderType.Limit,
			status: OrderStatus.Working,
			limitPrice: order.takeProfit,
			parentId: order.id,
			parentType: ParentType.Order,
			text: "TP",
			sideText: isPreview ? "\u200B" : " ",
			typeText: isPreview ? "\u200B" : " ",
			qtyText: " ",
		} as unknown as Order;
	}

	private _createOrderStopLossBracket(order: Order): Order {
		const isPreview = (order.id === PREVIEW_ORDER_ID) || (order.id === PREVIEW_POSITION_ID);
		return {
			id: `${order.id}_SL`,
			symbol: order.symbol,
			qty: order.qty,
			side: changeSide(order.side),
			type: OrderType.Stop,
			status: OrderStatus.Working,
			stopPrice: order.stopLoss,
			parentId: order.id,
			parentType: ParentType.Order,
			text: "SL",
			sideText: isPreview ? "\u200B" : " ",
			typeText: isPreview ? "\u200B" : " ",
			qtyText: " ",
		} as unknown as Order;
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

		// Normalize symbol: convert trailing M/R to m/r
		const symbol = preOrder.symbol.replace(/M$/, 'm').replace(/R$/, 'r');
		const side = preOrder.side === 1 ? 'buy' : 'sell';
		const volume = preOrder.qty;

		// Convert TV OrderType to Terminal OrderType
		let orderType: "market" | "pending" | "limit" = "market";
		let pendingOrderType: "limit" | "stop" | undefined = undefined;

		if (preOrder.type === OrderType.Market) {
			orderType = "market";
		} else if (preOrder.type === OrderType.Limit) {
			orderType = "pending";
			pendingOrderType = "limit";
		} else if (preOrder.type === OrderType.Stop) {
			orderType = "pending";
			pendingOrderType = "stop";
		}

		const orderData = {
			orderType,
			pendingOrderType,
			volume,
			openPrice: (preOrder as any).limitPrice || (preOrder as any).stopPrice || (preOrder as any).price,
			stopLoss: preOrder.stopLoss,
			takeProfit: preOrder.takeProfit,
		};

		if (this._isPlacingOrder) {
			console.warn('[ZuperiorBroker] placeOrder blocked: Already placing an order');
			return {};
		}

		this._isPlacingOrder = true;

		// Dispatch to TradingTerminal for central central execution & API call
		if (typeof window !== 'undefined') {
			console.log('[ZuperiorBroker] Dispatching zuperior-trigger-trade for chart-placed order');
			window.dispatchEvent(new CustomEvent('zuperior-trigger-trade', {
				detail: { orderData, side }
			}));
		}

		// Reset flag after a short delay to allow subsequent orders while preventing immediate double-clicks
		setTimeout(() => {
			this._isPlacingOrder = false;
		}, 2000);

		return {}; // Resolve immediately for instant chart feel
	}


	// TradingView calls this when a pending/order line is dragged
	public async modifyOrder(order: Order, confirmId?: string): Promise<void> {
		console.log('[ZuperiorBroker] modifyOrder called:', order.id, order);

		if (!this._accessToken || !this._accountId) {
			console.error('[ZuperiorBroker] modifyOrder failed: Not authenticated');
			return Promise.reject('Not authenticated');
		}

		this._lastActionTime = Date.now();

		const originalOrder = this._orderById[order.id];
		if (!originalOrder) {
			console.error('[ZuperiorBroker] modifyOrder failed: Order not found', order.id);
			return Promise.reject('Order not found');
		}

		// Handle bracket order modification (dragging TP/SL lines)
		if (order.parentId !== undefined) {
			const isTP = order.id.toString().includes('_TP');
			const isSL = order.id.toString().includes('_SL');

			// TradingView can send the dragged price in different fields; normalize
			const newPriceRaw = order.limitPrice ?? order.stopPrice ?? order.price;
			const newPrice = typeof newPriceRaw === 'string' ? parseFloat(newPriceRaw) : newPriceRaw;

			const mod: any = {};
			if (isTP && newPrice !== undefined) mod.takeProfit = newPrice;
			if (isSL && newPrice !== undefined) mod.stopLoss = newPrice;

			console.log('[ZuperiorBroker] modifyOrder: Bracket drag detected');
			console.log('[ZuperiorBroker] modifyOrder: Parent ID:', order.parentId);
			console.log('[ZuperiorBroker] modifyOrder: Parent Type:', order.parentType);
			console.log('[ZuperiorBroker] modifyOrder: Modification:', mod);

			if (order.parentType === ParentType.Position) {
				console.log('[ZuperiorBroker] modifyOrder: Calling editPositionBrackets for position bracket modification');
				return this.editPositionBrackets(order.parentId, mod);
			} else {
				// This will call editOrder which emits __ON_ORDER_PREVIEW_CHANGE__ for preview orders
				console.log('[ZuperiorBroker] modifyOrder: Calling editOrder for pending order bracket modification');
				return this.editOrder(order.parentId, mod);
			}
		}

		const pendingPriceRaw = order.limitPrice ?? order.stopPrice ?? order.price;
		const pendingPrice = typeof pendingPriceRaw === 'string' ? parseFloat(pendingPriceRaw) : pendingPriceRaw;

		const finalPrice = pendingPrice !== undefined
			? pendingPrice
			: (originalOrder.type === OrderType.Limit ? originalOrder.limitPrice : originalOrder.stopPrice);

		const finalTP = order.takeProfit !== undefined ? order.takeProfit : originalOrder.takeProfit;
		const finalSL = order.stopLoss !== undefined ? order.stopLoss : originalOrder.stopLoss;

		// SL/TP Validation
		const liveData = (typeof window !== 'undefined' ? (window as any).__LIVE_POSITIONS_DATA__ : null);
		const parentIdStr = String(order.parentId || order.id);
		const livePos = liveData?.openPositions?.find((p: any) => String(p.ticket || p.id) === parentIdStr);
		const tradeSide = this._getTradeSide(originalOrder);
		const currentPrice = livePos?.currentPrice || (originalOrder as any).currentPrice || (originalOrder as any).avgPrice || finalPrice;

		// Validation vs Current Price for Positions, or vs Open Price for Orders
		let validationError: string | null = null;
		if (originalOrder.parentId) {
			// Bracket of a position or order
			validationError = this._validateSLTP(tradeSide, currentPrice, finalSL, finalTP);
		} else if (originalOrder.status === OrderStatus.Working) {
			// Main pending order - validate vs open price
			validationError = this._validateSLTP(tradeSide, finalPrice, finalSL, finalTP);
		}

		if (validationError) {
			this._showOrderToast({
				side: tradeSide,
				symbol: originalOrder.symbol,
				volume: String(originalOrder.qty),
				price: null,
				orderType: originalOrder.type === OrderType.Limit ? 'limit' : 'stop',
				profit: null,
				error: validationError,
			});

			this._triggerSnapBack(originalOrder);
			this._fetchPositionsAndOrders(true);
			return Promise.reject(validationError);
		}

		// Persist to API
		try {
			console.log('[ZuperiorBroker] modifyOrder (Wait for Conf) triggered for:', order.id);

			// SKIP API FOR PREVIEW
			if (order.id === PREVIEW_ORDER_ID || order.id.toString().startsWith(PREVIEW_ORDER_ID)) {
				console.log('[ZuperiorBroker] modifyOrder: Handling preview modification');

				// Update local preview state to keep drag lines in sync until placed
				originalOrder.limitPrice = order.limitPrice !== undefined ? order.limitPrice : originalOrder.limitPrice;
				originalOrder.stopPrice = order.stopPrice !== undefined ? order.stopPrice : originalOrder.stopPrice;
				if (pendingPrice !== undefined) {
					if (originalOrder.type === OrderType.Stop) originalOrder.stopPrice = pendingPrice;
					else originalOrder.limitPrice = pendingPrice;
				}
				originalOrder.takeProfit = finalTP;
				originalOrder.stopLoss = finalSL;
				originalOrder.qty = order.qty !== undefined ? order.qty : originalOrder.qty;

				this._orderById[order.id] = { ...originalOrder };
				this._notifyAllPositionsAndOrders();

				// Emit event for OrderPanel sync
				if (typeof window !== 'undefined') {
					const targetWin = window.top || window;
					targetWin.dispatchEvent(new CustomEvent('__ON_ORDER_PREVIEW_CHANGE__', {
						detail: {
							id: order.id,
							price: finalPrice,
							takeProfit: finalTP,
							stopLoss: finalSL,
							qty: originalOrder.qty,
							source: 'chart'
						}
					}));
				}
				return Promise.resolve();
			}

			// OPTIMISTIC UI: Show success toast immediately
			this._showOrderToast({
				side: originalOrder.side === Side.Buy ? 'buy' : 'sell',
				symbol: originalOrder.symbol,
				volume: String(originalOrder.qty),
				price: null,
				orderType: originalOrder.type === OrderType.Limit ? 'limit' : (originalOrder.type === OrderType.Stop ? 'stop' : 'market'),
				profit: null,
				isModified: true
			});

			await modifyPendingOrderDirect({
				accountId: this._accountId,
				accessToken: this._accessToken,
				orderId: order.id,
				price: finalPrice,
				stopLoss: finalSL,
				takeProfit: finalTP
			});

			setTimeout(() => this._fetchPositionsAndOrders(true), 400);
		} catch (e) {
			console.error('[ZuperiorBroker] modifyOrder API call failed:', e);
			// FORCE SNAP-BACK ON API FAILURE
			this._triggerSnapBack(originalOrder);
			this._fetchPositionsAndOrders(true);
			throw e;
		}
	}

	public async cancelOrder(orderId: string): Promise<void> {
		if (!this._accessToken || !this._accountId) return Promise.reject("Auth failed");

		console.log('[ZuperiorBroker] cancelOrder called for:', orderId);

		// 1. CHECK IF THIS IS A BRACKET CANCELLATION
		const isTP = orderId.endsWith('_TP');
		const isSL = orderId.endsWith('_SL');

		if (isTP || isSL) {
			const parentId = orderId.replace('_TP', '').replace('_SL', '');
			console.log('[ZuperiorBroker] Bracket cancellation detected. Modifying parent:', parentId);

			// Check if parent is a position
			if (this._positionById[parentId]) {
				const modification = isTP ? { takeProfit: 0 } : { stopLoss: 0 };
				return this.editPositionBrackets(parentId, modification);
			}

			// Check if parent is an order (Handles GHOST_PREVIEW_ID too)
			if (this._orderById[parentId]) {
				const modification = isTP ? { takeProfit: 0 } : { stopLoss: 0 };
				return this.editOrder(parentId, modification);
			}

			console.warn('[ZuperiorBroker] Parent entity not found for bracket cancel:', parentId);
			return Promise.resolve(); // Fallback
		}

		// 2. MAIN PREVIEW / GHOST ORDER CANCELLATION (Not a bracket)
		const orderIdStr = String(orderId);
		if (orderIdStr === PREVIEW_ORDER_ID || (orderIdStr.startsWith(PREVIEW_ORDER_ID) && !isTP && !isSL)) {
			console.log('[ZuperiorBroker] Cancelling preview order (ghost):', orderIdStr);
			const order = this._orderById[orderIdStr];

			// Cancel main order
			if (order) {
				this._host.orderUpdate({ ...order, status: OrderStatus.Canceled });
				delete this._orderById[orderId];
				this._orders = this._orders.filter(o => o.id !== orderId);
			}

			// Cancel associated brackets
			[
				`${orderId}_TP`,
				`${orderId}_SL`,
				`${PREVIEW_ORDER_ID}_TP`, // Fallback common IDs
				`${PREVIEW_ORDER_ID}_SL`
			].forEach(bracketId => {
				const bracket = this._orderById[bracketId];
				if (bracket) {
					console.log('[ZuperiorBroker] Cancelling preview bracket:', bracketId);
					if (this._host && typeof this._host.orderUpdate === 'function') {
						this._host.orderUpdate({ ...bracket, status: OrderStatus.Canceled });
					}
					delete this._orderById[bracketId];
				}
			});

			this._orders = this._orders.filter(o =>
				!o.id.toString().startsWith(PREVIEW_ORDER_ID) &&
				!o.id.toString().startsWith(PREVIEW_POSITION_ID)
			);

			// Notify OrderPanel to reset form
			if (typeof window !== 'undefined') {
				const targetWin = window.top || window;
				targetWin.dispatchEvent(new CustomEvent('__ON_ORDER_PREVIEW_CHANGE__', {
					detail: {
						id: orderId,
						price: 0,
						takeProfit: 0,
						stopLoss: 0,
						qty: 0,
						source: 'chart_cancel' // Special source to indicate cancellation
					}
				}));
			}

			this._notifyAllPositionsAndOrders();
			return Promise.resolve();
		}

		// Optimistic update for regular orders
		const order = this._orderById[orderIdStr];
		if (order) {
			// Remove from maps
			delete this._orderById[orderIdStr];
			// Remove from array
			this._orders = this._orders.filter(o => String(o.id) !== orderIdStr);
			// Notify chart
			this._notifyAllPositionsAndOrders();
		}

		// No-op for preview - handled by primitives now

		try {
			await cancelPendingOrderDirect({
				accountId: this._accountId,
				accessToken: this._accessToken,
				orderId: orderId
			});
			setTimeout(() => this._fetchPositionsAndOrders(true), 400);
		} catch (e) {
			console.error('Cancel order failed', e);
			// Rollback if failed (fetch will restore it)
			this._fetchPositionsAndOrders();
			throw e;
		}
	}

	private _notifyBracketCancelled(bracketId: string, bracketObj?: Order) {
		const bracket = bracketObj || this._orderById[bracketId];
		if (this._host && typeof this._host.orderUpdate === 'function') {
			try {
				this._host.orderUpdate({ ...(bracket || { id: bracketId }), status: OrderStatus.Canceled });
			} catch (e) {
				console.error("[ZuperiorBroker] _notifyBracketCancelled failed:", e);
			}
		}
	}


	public async editPositionBrackets(positionId: string, modification: any): Promise<void> {
		if (positionId === PREVIEW_POSITION_ID) {
			console.log('[ZuperiorBroker] editPositionBrackets: Handling preview position');
			const pos = this._positionById[positionId];
			if (pos) {
				const tp = modification.takeProfit ?? modification.tp;
				const sl = modification.stopLoss ?? modification.sl;
				if (tp !== undefined) pos.takeProfit = tp;
				if (sl !== undefined) pos.stopLoss = sl;

				this._handlePreviewBrackets(pos, positionId);
				this._notifyAllPositionsAndOrders();

				// Emit event for OrderPanel sync
				if (typeof window !== 'undefined') {
					const targetWin = window.top || window;
					targetWin.dispatchEvent(new CustomEvent('__ON_ORDER_PREVIEW_CHANGE__', {
						detail: {
							id: positionId,
							price: pos.avgPrice,
							takeProfit: pos.takeProfit,
							stopLoss: pos.stopLoss,
							qty: pos.qty,
							source: 'chart'
						}
					}));
				}
			}
			return Promise.resolve();
		}

		if (!this._accessToken || !this._accountId) return Promise.reject("Auth failed");

		// Get current state to calculate final values
		const originalPosition = this._positionById[positionId];
		if (!originalPosition) {
			console.error('[ZuperiorBroker] Position not found for edit:', positionId);
			return;
		}

		// Capture initial bracket states BEFORE any optimistic modifications or validations
		const tpId = `${originalPosition.id}_TP`;
		const slId = `${originalPosition.id}_SL`;
		const originalTP = this._orderById[tpId] ? { ...this._orderById[tpId] } : undefined;
		const originalSL = this._orderById[slId] ? { ...this._orderById[slId] } : undefined;

		// Pre-conditions Check (Kill Switch, Market Closed, Free Margin)
		if (!this._checkPreConditions('modify', originalPosition.symbol, originalPosition.qty)) {
			return Promise.reject("Pre-conditions failed");
		}

		const newTPRaw = modification.takeProfit ?? modification.tp;
		const newSLRaw = modification.stopLoss ?? modification.sl;

		const newTP =
			newTPRaw === null
				? 0
				: newTPRaw === undefined || isNaN(Number(newTPRaw))
					? originalPosition.takeProfit ?? 0
					: Number(newTPRaw);

		const newSL =
			newSLRaw === null
				? 0
				: newSLRaw === undefined || isNaN(Number(newSLRaw))
					? originalPosition.stopLoss ?? 0
					: Number(newSLRaw);

		// SL/TP Validation
		const liveData = (typeof window !== 'undefined' ? (window as any).__LIVE_POSITIONS_DATA__ : null);
		const posIdStr = String(positionId);
		const livePos = liveData?.openPositions?.find((p: any) => String(p.ticket || p.id) === posIdStr);
		const currentPrice = livePos?.currentPrice || originalPosition.currentPrice || originalPosition.avgPrice;

		const tradeSide = this._getTradeSide(originalPosition);
		const validationError = this._validateSLTP(tradeSide, currentPrice, newSL, newTP);
		if (validationError) {
			this._showOrderToast({
				side: tradeSide,
				symbol: originalPosition.symbol,
				volume: String(originalPosition.qty),
				price: null,
				orderType: 'market',
				profit: null,
				error: validationError,
			});

			this._triggerSnapBack(originalPosition, originalTP, originalSL);

			// Force refresh to snap lines back
			this._fetchPositionsAndOrders(true);
			return Promise.reject(validationError);
		}

		console.log('[ZuperiorBroker] Modifying Brackets (Wait for Conf):', positionId, { newSL, newTP });

		try {
			// API Call
			const response = await modifyPositionDirect({
				accountId: this._accountId,
				accessToken: this._accessToken,
				positionId: positionId,
				stopLoss: newSL,
				takeProfit: newTP
			});

			if (!response.success) {
				throw new Error(response.message || 'Failed to modify position');
			}

			// Fetch updates immediately to show new brackets
			await this._fetchPositionsAndOrders(true);

		} catch (e) {
			console.warn('[ZuperiorBroker] Modify position failed', e);
			// FORCE SNAP-BACK ON API FAILURE
			this._triggerSnapBack(originalPosition, originalTP, originalSL);

			const errorMessage = e instanceof Error ? e.message : (typeof e === 'string' ? e : 'Unknown error');
			this._showOrderToast({
				side: tradeSide,
				symbol: originalPosition.symbol,
				volume: String(originalPosition.qty),
				price: null,
				orderType: 'market',
				profit: null,
				error: errorMessage,
			});

			// Refresh to ensure we are in sync with reality
			this._fetchPositionsAndOrders(true);
			throw e;
		}
	}

	public async closePosition(positionId: string): Promise<void> {
		if (!this._accessToken || !this._accountId) return Promise.reject("Auth failed");

		const posIdStr = String(positionId);
		const position = this._positionById[posIdStr];

		// Pre-conditions Check (Kill Switch, Market Closed) - Margin not strictly checked for Close
		if (position && !this._checkPreConditions('close', position.symbol, position.qty)) {
			return Promise.reject("Pre-conditions failed");
		}

		console.log('[ZuperiorBroker] closePosition called for:', positionId);

		// Ghost Position Cleanup (Market Preview Cancellation)
		if (posIdStr === PREVIEW_POSITION_ID) {
			console.log('[ZuperiorBroker] Closing preview position (ghost):', posIdStr);
			if (position) {
				// 1. Notify Chart of Closure
				if (this._host && typeof this._host.positionUpdate === 'function') {
					const closedPosition = { ...position, qty: 0, avgPrice: 0 };
					this._host.positionUpdate(closedPosition);
				}
				// 2. Remove Internal State
				delete this._positionById[positionId];

				// EXPLICITLY CANCEL BRACKETS (like in cancelOrder)
				[`${positionId}_TP`, `${positionId}_SL`].forEach(bracketId => {
					const bracket = this._orderById[bracketId];
					if (bracket) {
						console.log('[ZuperiorBroker] Cancelling preview bracket (from closePosition):', bracketId);
						if (this._host && typeof this._host.orderUpdate === 'function') {
							this._host.orderUpdate({ ...bracket, status: OrderStatus.Canceled });
						}
						delete this._orderById[bracketId];
					}
				});

				// Robust cleanup of any other ghost lines by sending null preview
				if (typeof (window as any).__SET_ORDER_PREVIEW__ === 'function') {
					(window as any).__SET_ORDER_PREVIEW__({ side: null });
				}

				this._positions = this._positions.filter(p => p.id !== positionId);

				// 3. Notify UI to Reset
				this._syncToPanel(position, 'chart_cancel');

				// 4. Update Chart
				this._notifyAllPositionsAndOrders();
			}
			return Promise.resolve();
		}

		// OPTIMISTIC UI: Show toast immediately
		if (position) {
			this._showOrderToast({
				type: 'position-closed',
				position: position
			});
		}

		try {
			await closePositionDirect({
				accountId: this._accountId,
				accessToken: this._accessToken,
				positionId: positionId,
				volume: position ? position.qty : 0 // Pass known volume (lots) to help API
			});

			// Confident Deletion: Remove immediately from local state for instant chart updates
			if (position) {
				console.log('[ZuperiorBroker] Confident Deletion for Position:', positionId);
				this._positions = this._positions.filter(p => p.id !== positionId);
				delete this._positionById[positionId];
				this._notifyAllPositionsAndOrders();
			}

			// Fetch confirmation immediately to ensure sync
			await this._fetchPositionsAndOrders(true);
		} catch (e) {
			console.error('Close position failed', e);
			// Re-fetch to satisfy state
			this._fetchPositionsAndOrders(true);
			throw e;
		}
	}

	public config(): any {
		return {
			supportPlaceOrderPreview: true,
			supportModifyOrderPreview: false,
			supportBrackets: true,
			supportClosePosition: true,
			supportPLUpdate: true,
			supportEditAmount: false,
			supportModifyOrderPrice: true,
			supportModifyBrackets: true,
			supportOrderBrackets: true,
			supportPositionBrackets: true,
			calculatePLUsingLast: true,
			supportOrdersHistory: false,
		};
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
		// console.log('[ZuperiorBroker] orders() called, returning count:', this._orders.length, { ids: this._orders.map(o => o.id) });
		if (!this._chartSettings.tpsl) {
			// Only return preview/ghost orders if TP/SL toggle is off
			return Promise.resolve(this._orders.filter(o => o.id.toString().startsWith(PREVIEW_ORDER_ID)));
		}
		return Promise.resolve(this._orders);
	}

	public async positions(): Promise<Position[]> {
		if (this._positionById[PREVIEW_POSITION_ID]) {
			// Ensure it's present in the list returned to chart
			if (!this._positions.find(p => p.id === PREVIEW_POSITION_ID)) {
				this._positions.push(this._positionById[PREVIEW_POSITION_ID]);
			}
		}

		if (!this._chartSettings.openPositions) {
			// Only return preview/ghost position if Open Positions toggle is off
			return this._positions.filter(p => p.id === PREVIEW_POSITION_ID);
		}

		return this._positions;
	}

	public async executions(symbol: string): Promise<Execution[]> {
		return [];
	}

	public currentAccount(): AccountId {
		return (this._accountId || '') as AccountId;
	}

	public async symbolInfo(symbol: string): Promise<InstrumentInfo> {
		const symbolUpper = symbol.toUpperCase();
		let pricescale = 100000; // Default Forex
		let minTick = 0.00001;
		let pipValue = 1; // Default

		if (symbolUpper.includes('XAG')) {
			pricescale = 100000;
			minTick = 0.00001;
			pipValue = 0.05;
		} else if (symbolUpper.includes('JPY') || symbolUpper.includes('XAU')) {
			pricescale = 100;
			minTick = 0.01;
			pipValue = 1; // For Gold (100oz), 0.01 move = $1. So pipValue = 1? 
			// If 1 lot = 100 oz. 0.01 move * 100 = $1. Correct.
		} else if (symbolUpper.includes('BTC') || symbolUpper.includes('SOL')) {
			pricescale = 100;
			minTick = 0.01;
			// For Crypto with Contract Size 1:
			// 1 lot = 1 unit.
			// 1 pip (0.01) move * 1 unit = $0.01.
			// So pipValue (value of 1 pip for 1 lot) must be 0.01.
			pipValue = 0.01;
		} else if (symbolUpper.includes('ETH')) {
			minTick = 0.01;
			// Matches 1.0 config for ETH to show exact 100x projection
			pipValue = 0.10;
		} else if (
			symbolUpper.includes('US30') ||
			symbolUpper.includes('US500') ||
			symbolUpper.includes('USTEC') ||
			symbolUpper.includes('DE30') ||
			symbolUpper.includes('FR40') ||
			symbolUpper.includes('UK100') ||
			symbolUpper.includes('AUS200') ||
			symbolUpper.includes('HK50') ||
			symbolUpper.includes('JP225')
		) {
			pricescale = 100;
			minTick = 0.01;
			pipValue = 0.10;
		}

		return {
			qty: { min: 0.01, max: 100, step: 0.01 },
			pipSize: minTick,
			pipValue: pipValue,
			minTick: minTick,
			description: symbol,
			type: 'crypto',
			domVolumePrecision: 2,
			id: symbol,
			name: symbol,
			minMove2: 0,
			pricescale: pricescale,
			minmov: 1,
			fractional: false,
			session: '24x7',
			timezone: 'Etc/UTC',
			has_intraday: true,
			has_no_volume: false,
			data_status: 'streaming'
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

	public spreadFormatter(symbol: string): Promise<any> {
		return Promise.resolve({
			format: (value: number) => {
				if (value === undefined || value === null) return '';
				return value.toFixed(1) + ' pips';
			}
		});
	}

	public quantityFormatter(symbol: string): Promise<any> {
		return Promise.resolve({
			format: (value: number) => {
				if (value === undefined || value === null) return '';
				return value.toString();
			}
		});
	}

	public pipValueFormatter(symbol: string): Promise<any> {
		return Promise.resolve({
			format: (value: number) => {
				if (value === undefined || value === null) return '';
				return value.toFixed(2);
			}
		});
	}
	public async editOrder(orderId: string, modification: any): Promise<void> {
		let originalOrder = this._orderById[orderId];
		if (!originalOrder) {
			console.error(`[ZuperiorBroker] Order not found: ${orderId}`);
			return Promise.reject('Order not found');
		}

		// Capture initial bracket states BEFORE any optimistic modifications or validations
		const tpIdSnapshot = `${originalOrder.id}_TP`;
		const slIdSnapshot = `${originalOrder.id}_SL`;
		const originalTP = this._orderById[tpIdSnapshot] ? { ...this._orderById[tpIdSnapshot] } : undefined;
		const originalSL = this._orderById[slIdSnapshot] ? { ...this._orderById[slIdSnapshot] } : undefined;

		const idStr = orderId.toString();
		const isTP = idStr.includes('_TP');
		const isSL = idStr.includes('_SL');

		// Handle bracket redirection to parent for both ghost and real orders
		// This ensures dragging a TP/SL bracket modifies the parent's TP/SL instead of the bracket's price
		if (originalOrder.parentId && (isTP || isSL)) {
			const parent = this._orderById[originalOrder.parentId];
			if (parent) {
				console.log('[ZuperiorBroker] editOrder: Redirecting bracket modification to parent:', parent.id);
				const targetId = originalOrder.parentId.toString();

				// Map bracket price modification back to parent TP/SL
				const targetModification: any = {};
				if (isTP) targetModification.takeProfit = modification.limitPrice !== undefined ? modification.limitPrice : modification.takeProfit;
				if (isSL) targetModification.stopLoss = modification.stopPrice !== undefined ? modification.stopPrice : modification.stopLoss;

				// Critical: update our pointers to the parent order and target modification
				originalOrder = parent;
				orderId = targetId;
				modification = targetModification;
			}
		}

		// Pre-conditions Check (Kill Switch, Market Closed, Free Margin)
		if (!this._checkPreConditions('modify', originalOrder.symbol, originalOrder.qty)) {
			return Promise.reject("Pre-conditions failed");
		}

		// SKIP API FOR PREVIEW
		const isGhost = orderId.startsWith(PREVIEW_ORDER_ID);
		if (isGhost) {
			// Updating the main order or parent
			if (modification.hasOwnProperty('limitPrice')) originalOrder.limitPrice = modification.limitPrice;
			if (modification.hasOwnProperty('stopPrice')) originalOrder.stopPrice = modification.stopPrice;
			if (modification.hasOwnProperty('qty')) originalOrder.qty = modification.qty;
			if (modification.hasOwnProperty('takeProfit')) originalOrder.takeProfit = modification.takeProfit;
			if (modification.hasOwnProperty('stopLoss')) originalOrder.stopLoss = modification.stopLoss;
			if (modification.hasOwnProperty('type')) originalOrder.type = modification.type;

			// Regenerate brackets for the parent/target order
			this._handlePreviewBrackets(originalOrder, orderId);

			this._notifyAllPositionsAndOrders();

			// Sync to panel
			this._syncToPanel(originalOrder, 'chart');

			return Promise.resolve();
		}

		this._lastActionTime = Date.now();

		const finalPrice = modification.hasOwnProperty('limitPrice') ? modification.limitPrice :
			(modification.hasOwnProperty('stopPrice') ? modification.stopPrice :
				(originalOrder.type === OrderType.Limit ? originalOrder.limitPrice : originalOrder.stopPrice));
		const finalTP = modification.hasOwnProperty('takeProfit') ? modification.takeProfit : originalOrder.takeProfit;
		const finalSL = modification.hasOwnProperty('stopLoss') ? modification.stopLoss : originalOrder.stopLoss;

		// SL/TP Validation (Pending Orders validate vs their hypothetical open price)
		const tradeSide = this._getTradeSide(originalOrder);
		const validationError = this._validateSLTP(tradeSide, finalPrice, finalSL, finalTP);
		if (validationError) {
			this._showOrderToast({
				side: tradeSide,
				symbol: originalOrder.symbol,
				volume: String(originalOrder.qty),
				price: null,
				orderType: originalOrder.type === OrderType.Limit ? 'limit' : 'stop',
				profit: null,
				error: validationError,
			});

			this._triggerSnapBack(originalOrder, originalTP, originalSL);

			this._fetchPositionsAndOrders(true);
			return Promise.reject(validationError);
		}

		const tpId = `${orderId}_TP`;
		const slId = `${orderId}_SL`;

		// capture prior bracket state
		const existingTP = this._orderById[tpId];
		const existingSL = this._orderById[slId];

		// Update local order object with new values
		if (modification.hasOwnProperty('limitPrice')) originalOrder.limitPrice = modification.limitPrice;
		if (modification.hasOwnProperty('stopPrice')) originalOrder.stopPrice = modification.stopPrice;
		if (modification.hasOwnProperty('takeProfit')) originalOrder.takeProfit = modification.takeProfit;
		if (modification.hasOwnProperty('stopLoss')) originalOrder.stopLoss = modification.stopLoss;
		if (modification.hasOwnProperty('type')) originalOrder.type = modification.type;
		if (modification.hasOwnProperty('qty')) originalOrder.qty = modification.qty;

		// --- Handle TP Bracket ---
		if (originalOrder.takeProfit && originalOrder.takeProfit > 0) {
			if (existingTP) {
				// Update existing (Immutable update for React/TV change detection)
				const updatedTP = {
					...existingTP,
					limitPrice: originalOrder.takeProfit,
					qty: originalOrder.qty,
					status: OrderStatus.Working // Force status
				};
				this._orderById[tpId] = updatedTP;
				// Update array reference
				const tpIndex = this._orders.findIndex(o => o.id === tpId);
				if (tpIndex !== -1) {
					this._orders[tpIndex] = updatedTP;
				}
				// console.log('[ZuperiorBroker] Updated existing TP bracket (immutable):', updatedTP.id, updatedTP.limitPrice);
			} else {
				// Create new
				const tpBracket = this._createOrderTakeProfitBracket(originalOrder);
				this._orderById[tpBracket.id] = tpBracket;
				this._orders.push(tpBracket);
			}
		} else {
			// TP removed or was never there
			if (existingTP) {
				// Notify cancellation BEFORE deleting
				this._notifyBracketCancelled(tpId, existingTP);
				// Remove from maps and array
				delete this._orderById[tpId];
				this._orders = this._orders.filter(o => o.id !== tpId);
			}
		}

		// --- Handle SL Bracket ---
		if (originalOrder.stopLoss && originalOrder.stopLoss > 0) {
			if (existingSL) {
				// Update existing (Immutable update)
				const updatedSL = {
					...existingSL,
					stopPrice: originalOrder.stopLoss,
					qty: originalOrder.qty,
					status: OrderStatus.Working // Force status
				};
				this._orderById[slId] = updatedSL;
				// Update array reference
				const slIndex = this._orders.findIndex(o => o.id === slId);
				if (slIndex !== -1) {
					this._orders[slIndex] = updatedSL;
				}
				// console.log('[ZuperiorBroker] Updated existing SL bracket (immutable):', updatedSL.id, updatedSL.stopPrice);
			} else {
				// Create new
				const slBracket = this._createOrderStopLossBracket(originalOrder);
				this._orderById[slBracket.id] = slBracket;
				this._orders.push(slBracket);
			}
		} else {
			// SL removed or was never there
			if (existingSL) {
				// Notify cancellation BEFORE deleting
				this._notifyBracketCancelled(slId, existingSL);
				// Remove from maps and array
				delete this._orderById[slId];
				this._orders = this._orders.filter(o => o.id !== slId);
			}
		}

		// Update array reference for the parent order (trigger React/TV updates)
		const index = this._orders.findIndex(o => o.id === orderId);
		if (index !== -1) {
			this._orders[index] = { ...originalOrder };
			this._orderById[orderId] = this._orders[index];
		}

		// Notify all updates
		this._notifyAllPositionsAndOrders();

		try {
			// OPTIMISTIC UI: Show success toast immediately
			this._showOrderToast({
				side: originalOrder.side === Side.Buy ? 'buy' : 'sell',
				symbol: originalOrder.symbol,
				volume: String(originalOrder.qty),
				price: null,
				orderType: originalOrder.type === OrderType.Limit ? 'limit' : (originalOrder.type === OrderType.Stop ? 'stop' : 'market'),
				profit: null,
				isModified: true
			});

			// Use values from originalOrder which now contains the merged state
			const response = await modifyPendingOrderDirect({
				accountId: this._accountId!,
				accessToken: this._accessToken!,
				orderId: orderId,
				price: originalOrder.limitPrice || originalOrder.stopPrice,
				stopLoss: originalOrder.stopLoss,
				takeProfit: originalOrder.takeProfit
			});

			if (!response.success) {
				throw new Error(response.message || 'Failed to modify order');
			}

			// Re-fetch to validate
			setTimeout(() => this._fetchPositionsAndOrders(true), 400);

			// Synchronize final state back to panel
			this._syncToPanel(originalOrder, 'chart');
		} catch (e) {
			console.warn('[ZuperiorBroker] Edit order failed', e);
			// FORCE SNAP-BACK ON API FAILURE
			this._triggerSnapBack(originalOrder, originalTP, originalSL);

			const errorMessage = e instanceof Error ? e.message : (typeof e === 'string' ? e : 'Unknown error');
			this._showOrderToast({
				side: originalOrder.side === Side.Buy ? 'buy' : 'sell',
				symbol: originalOrder.symbol,
				volume: String(originalOrder.qty),
				price: null,
				orderType: originalOrder.type === OrderType.Limit ? 'limit' : (originalOrder.type === OrderType.Stop ? 'stop' : 'market'),
				profit: null,
				error: errorMessage
			});

			// Rollback (Simplified: just re-fetch to restore state)
			this._fetchPositionsAndOrders(true);
			throw e;
		}
	}

	public async modifyEntity(id: string, modification: any): Promise<void> {
		if (id === PREVIEW_POSITION_ID) {
			console.log('[ZuperiorBroker] modifyEntity: Skipping API for preview position');
			const pos = this._positionById[id];
			if (pos) {
				if (modification.tp !== undefined) pos.takeProfit = modification.tp;
				if (modification.sl !== undefined) pos.stopLoss = modification.sl;
				this._handlePreviewBrackets(pos, id);
				this._notifyAllPositionsAndOrders();

				// Emit event for OrderPanel sync
				if (typeof window !== 'undefined') {
					const targetWin = window.top || window;
					targetWin.dispatchEvent(new CustomEvent('__ON_ORDER_PREVIEW_CHANGE__', {
						detail: {
							id: id,
							price: pos.avgPrice,
							takeProfit: pos.takeProfit,
							stopLoss: pos.stopLoss,
							qty: pos.qty,
							source: 'chart'
						}
					}));
				}
			}
			return Promise.resolve();
		}

		// Check if it's a position
		if (this._positionById[id]) {
			return this.editPositionBrackets(id, modification);
		}
		// Check if it's an order
		if (this._orderById[id]) {
			// Adapter for order modification fields
			const orderMod: any = {};
			if (modification.tp !== undefined) orderMod.takeProfit = modification.tp;
			if (modification.sl !== undefined) orderMod.stopLoss = modification.sl;

			// Map price if provided (from "Price" field in modal for Pending Orders)
			if (modification.price !== undefined) {
				const order = this._orderById[id];
				if (order.type === OrderType.Limit) {
					orderMod.limitPrice = modification.price;
				} else if (order.type === OrderType.Stop) {
					orderMod.stopPrice = modification.price;
				}
			}

			// Pass other fields if present custom ones
			if (modification.limitPrice) orderMod.limitPrice = modification.limitPrice;
			if (modification.stopPrice) orderMod.stopPrice = modification.stopPrice;
			if (modification.takeProfit) orderMod.takeProfit = modification.takeProfit;
			if (modification.stopLoss) orderMod.stopLoss = modification.stopLoss;

			// Update parent order properties to match bracket changes
			const entity = this._orderById[id];
			// If this entity is a bracket (has parentId), update the parent.
			if (entity && entity.parentId) {
				const actualParent = this._orderById[entity.parentId];
				if (actualParent) {
					if (modification.limitPrice !== undefined) actualParent.takeProfit = modification.limitPrice;
					if (modification.stopPrice !== undefined) actualParent.stopLoss = modification.stopPrice;
					if (modification.takeProfit !== undefined) actualParent.takeProfit = modification.takeProfit;
					if (modification.stopLoss !== undefined) actualParent.stopLoss = modification.stopLoss;

					// Notify parent update immediately
					if (this._host && typeof this._host.orderUpdate === 'function') {
						this._host.orderUpdate(actualParent);
					}
				}
			} else if (entity) {
				// It is the parent order itself.
				if (modification.limitPrice !== undefined) entity.takeProfit = modification.limitPrice;
				if (modification.stopPrice !== undefined) entity.stopLoss = modification.stopPrice;
				if (modification.takeProfit !== undefined) entity.takeProfit = modification.takeProfit;
				if (modification.stopLoss !== undefined) entity.stopLoss = modification.stopLoss;
			}

			return this.editOrder(id, orderMod);
		}

		console.error('[ZuperiorBroker] Entity not found for modification:', id);
		return Promise.reject('Entity not found');
	}

	// TradingView calls this when a pending/order line is dragged
	public async moveOrder(orderId: string, price: number): Promise<void> {
		console.log('[ZuperiorBroker] moveOrder invoked:', orderId, price);
		const order = this._orderById[orderId];
		if (!order) {
			console.error('[ZuperiorBroker] moveOrder failed: Order not found', orderId);
			return Promise.reject('Order not found');
		}

		// TradingView sometimes sends undefined/strings for preview bracket drags, normalize it here
		const effectivePrice = (price !== undefined && !Number.isNaN(price))
			? Number(price)
			: (order.limitPrice ?? order.stopPrice);
		if (effectivePrice === undefined || Number.isNaN(effectivePrice)) {
			console.warn('[ZuperiorBroker] moveOrder aborted: invalid price payload', { orderId, price, order });
			return Promise.resolve();
		}

		const orderIdStr = String(orderId);
		const isTP = orderIdStr.includes('_TP') || orderIdStr.includes('TP-');
		const isSL = orderIdStr.includes('_SL') || orderIdStr.includes('SL-');

		console.log('[ZuperiorBroker] Moving order details:', { isTP, isSL, parentId: order.parentId, parentType: order.parentType });

		// If this is a bracket of a pending order
		if (order.parentId && order.parentType === ParentType.Order && (isTP || isSL)) {
			const mod: any = {};
			if (isTP) mod.takeProfit = effectivePrice;
			if (isSL) mod.stopLoss = effectivePrice;
			console.log('[ZuperiorBroker] Moving pending order bracket -> editOrder', order.parentId, mod);

			// For preview orders, emit sync event immediately for real-time update
			if (order.parentId === PREVIEW_ORDER_ID) {
				const parentOrder = this._orderById[order.parentId];
				if (parentOrder) {
					// Create the event payload manually to ensure it uses the dragged price
					const payload = {
						id: order.parentId,
						price: parentOrder.type === OrderType.Limit ? parentOrder.limitPrice : parentOrder.stopPrice,
						takeProfit: isTP ? effectivePrice : parentOrder.takeProfit,
						stopLoss: isSL ? effectivePrice : parentOrder.stopLoss,
						qty: parentOrder.qty,
						source: 'chart'
					};
					console.log("[ZuperiorBroker] moveOrder: Emitting real-time sync event for preview bracket drag to window.top", payload);
					if (typeof window !== 'undefined') {
						const targetWin = window.top || window;
						targetWin.dispatchEvent(new CustomEvent('__ON_ORDER_PREVIEW_CHANGE__', {
							detail: payload
						}));
					}

					// Update local state directly to prevent snap-back during drag
					if (isTP) parentOrder.takeProfit = effectivePrice;
					if (isSL) parentOrder.stopLoss = effectivePrice;
				}
			}
			return this.editOrder(order.parentId, mod);
		}

		// If this is a bracket of a position
		if (order.parentId && order.parentType === ParentType.Position && (isTP || isSL)) {
			const mod: any = {};
			if (isTP) mod.takeProfit = effectivePrice;
			if (isSL) mod.stopLoss = effectivePrice;
			console.log('[ZuperiorBroker] Moving position bracket -> editPositionBrackets', order.parentId, mod);
			return this.editPositionBrackets(order.parentId, mod);
		}

		// Base pending order line drag
		const mod: any = {};

		let effectiveType = order.type;
		const symbol = order.symbol;
		const lastPrice = (this._quotesProvider as any).getLastPrice ? (this._quotesProvider as any).getLastPrice(symbol) : undefined;

		if (lastPrice !== undefined && lastPrice > 0) {
			const sideValue = order.side;
			// TradingView Side enum: Buy = 1, Sell = -1 or 2. MetaAPI uses "buy"/"sell".
			// Check for both number and string variants to be 100% sure
			const isBuy = sideValue === Side.Buy ||
				(sideValue as any) === 1 ||
				(sideValue as any) === 'buy' ||
				(sideValue as any) === 'Buy';

			if (isBuy) {
				effectiveType = effectivePrice < lastPrice ? OrderType.Limit : OrderType.Stop;
			} else {
				effectiveType = effectivePrice > lastPrice ? OrderType.Limit : OrderType.Stop;
			}
			console.log(`[ZuperiorBroker] moveOrder Auto-Switch: sym=${symbol} price=${effectivePrice} market=${lastPrice} side=${sideValue} (isBuy=${isBuy}) -> ${effectiveType === OrderType.Limit ? 'LIMIT' : 'STOP'}`);
		} else {
			console.warn(`[ZuperiorBroker] moveOrder: Market price MISSING for ${symbol}. Auto-switch skipped.`);
		}

		order.type = effectiveType;
		if (effectiveType === OrderType.Stop) {
			order.stopPrice = effectivePrice;
			order.limitPrice = undefined; // CLEAR limitPrice
			mod.stopPrice = effectivePrice;
			mod.limitPrice = undefined;
			mod.type = OrderType.Stop;
		} else {
			order.limitPrice = effectivePrice;
			order.stopPrice = undefined; // CLEAR stopPrice
			mod.limitPrice = effectivePrice;
			mod.stopPrice = undefined;
			mod.type = OrderType.Limit;
		}

		console.log('[ZuperiorBroker] moveOrder calling editOrder:', orderId, mod);
		return this.editOrder(orderId, mod);
	}

	// TradingView calls this when TP/SL of a position is dragged
	public async movePositionBrackets(positionId: string, brackets: any): Promise<void> {
		// No-op for preview - handled by primitives now
		return this.editPositionBrackets(positionId, brackets);
	}

	// Fallback alias used by some builds
	public async movePosition(positionId: string, brackets: any): Promise<void> {
		console.log('[ZuperiorBroker] movePosition invoked:', positionId, brackets); // Often same as movePositionBrackets regarding arg signature? No, movePosition might imply modifying execution price which isn't possible, but TV uses it for brackets sometimes.
		// Actually movePosition signature in API is (id, price) usually?
		// But here we mapped it to brackets in previous logic. Let's check signature.
		// If brackets is a price number, it would die.
		// Usually movePosition is for moving the *entry* price (not possible for market positions)
		// But in this library version, it might map to brackets.
		return this.editPositionBrackets(positionId, brackets);
	}

	public async setOrderPreview(previewData: any): Promise<void> {
		if (this._isBrokerModalOpen) return;

		if (!this._host || typeof this._host.orderUpdate !== 'function') return;

		const clearAllPreviews = () => {
			// Cancel order preview
			const existingOrder = this._orderById[PREVIEW_ORDER_ID];
			if (existingOrder) {
				const canceledOrder = { ...existingOrder, status: OrderStatus.Canceled };
				this._host.orderUpdate(canceledOrder);
				delete this._orderById[PREVIEW_ORDER_ID];
				this._orders = this._orders.filter(o => !o.id.toString().startsWith(PREVIEW_ORDER_ID));
			}

			// Cancel position preview
			const existingPos = this._positionById[PREVIEW_POSITION_ID];
			if (existingPos) {
				const closedPos = { ...existingPos, qty: 0 };
				if (typeof this._host.positionUpdate === 'function') {
					this._host.positionUpdate(closedPos);
				}
				delete this._positionById[PREVIEW_POSITION_ID];
				this._positions = this._positions.filter(p => !p.id.toString().startsWith(PREVIEW_POSITION_ID));
			}

			// Clean up all related brackets/ghosts by verifying if they exist and sending Cancel event
			[
				`${PREVIEW_ORDER_ID}_TP`,
				`${PREVIEW_ORDER_ID}_SL`,
				`${PREVIEW_POSITION_ID}_TP`,
				`${PREVIEW_POSITION_ID}_SL`
			].forEach(bracketId => {
				const bracket = this._orderById[bracketId];
				if (bracket) {
					console.log('[ZuperiorBroker] Clearing preview bracket:', bracketId);
					this._host.orderUpdate({ ...bracket, status: OrderStatus.Canceled });
					delete this._orderById[bracketId];
				}
			});

			this._orders = this._orders.filter(o =>
				!o.id.toString().startsWith(PREVIEW_ORDER_ID) &&
				!o.id.toString().startsWith(PREVIEW_POSITION_ID)
			);
		};

		if (!previewData || !previewData.side) {
			console.log('[ZuperiorBroker] Canceling all order/position previews');
			clearAllPreviews();
			this._notifyAllPositionsAndOrders();
			return;
		}

		const side = previewData.side === 'buy' ? Side.Buy : Side.Sell;
		const qty = previewData.qty || 1;
		const price = previewData.price || 0;
		const symbol = previewData.symbol || 'XAUUSD';
		const isMarket = previewData.type === 'market';

		// 1. CLEVER SYNC: Determine if we need to switch modes
		const existingMarket = !!this._positionById[PREVIEW_POSITION_ID];
		const existingPending = !!this._orderById[PREVIEW_ORDER_ID];

		if (isMarket && existingPending) clearAllPreviews();
		if (!isMarket && existingMarket) clearAllPreviews();

		if (isMarket) {
			let previewPos = this._positionById[PREVIEW_POSITION_ID];
			if (!previewPos) {
				previewPos = {
					id: PREVIEW_POSITION_ID,
					symbol: symbol,
					side: side,
					qty: qty,
					avgPrice: price,
					price: price,
					pl: 0,
					text: previewData.text || qty.toString(),
					takeProfit: previewData.takeProfit || 0,
					stopLoss: previewData.stopLoss || 0,
					sideText: "\u200B",
					typeText: "\u200B",
				} as any;
				this._positionById[PREVIEW_POSITION_ID] = previewPos;
				this._positions.push(previewPos);
			} else {
				// Update in place for smoothness
				previewPos.avgPrice = price;
				previewPos.price = price;
				previewPos.side = side;
				previewPos.qty = qty;
				previewPos.takeProfit = previewData.takeProfit || 0;
				previewPos.stopLoss = previewData.stopLoss || 0;
			}

			if (this._host && typeof this._host.positionUpdate === 'function') {
				this._host.positionUpdate(previewPos);
			}
			this._handlePreviewBrackets(previewPos, PREVIEW_POSITION_ID);
		} else {
			let previewOrder = this._orderById[PREVIEW_ORDER_ID];
			if (!previewOrder) {
				previewOrder = {
					id: PREVIEW_ORDER_ID,
					symbol: symbol,
					side: side,
					qty: qty,
					status: OrderStatus.Working,
					type: previewData.type === 'stop' ? OrderType.Stop : OrderType.Limit,
					limitPrice: price,
					stopPrice: previewData.type === 'stop' ? price : undefined,
					takeProfit: previewData.takeProfit,
					stopLoss: previewData.stopLoss,
					text: previewData.text || qty.toString(),
					sideText: "",
					typeText: "",
					qtyText: "",
					interactive: true,
				} as any;
				this._orderById[PREVIEW_ORDER_ID] = previewOrder;
				this._orders.push(previewOrder);
			} else {
				// Update in place
				previewOrder.limitPrice = price;
				previewOrder.stopPrice = previewData.type === 'stop' ? price : undefined;
				previewOrder.side = side;
				previewOrder.qty = qty;
				previewOrder.takeProfit = previewData.takeProfit;
				previewOrder.stopLoss = previewData.stopLoss;
				previewOrder.type = previewData.type === 'stop' ? OrderType.Stop : OrderType.Limit;
			}

			if (this._host && typeof this._host.orderUpdate === 'function') {
				this._host.orderUpdate(previewOrder);
			}
			this._handlePreviewBrackets(previewOrder, PREVIEW_ORDER_ID);
		}

		// Avoid heavy global notification if only preview changed
		// this._notifyAllPositionsAndOrders();
	}

	private _handlePreviewBrackets(parent: any, parentId: string): void {
		const tpId = `${parentId}_TP`;
		const slId = `${parentId}_SL`;

		if (parent.takeProfit && parent.takeProfit > 0) {
			const tpB = this._createOrderTakeProfitBracket(parent);
			tpB.id = tpId;
			tpB.parentId = parentId;
			tpB.parentType = parentId === PREVIEW_POSITION_ID ? ParentType.Position : ParentType.Order;

			const existingIndex = this._orders.findIndex(o => o.id === tpId);
			if (existingIndex >= 0) {
				this._orders[existingIndex] = tpB;
			} else {
				this._orders.push(tpB);
			}
			this._orderById[tpId] = tpB;
			this._host.orderUpdate(tpB);
		} else {
			// Ensure TP bracket is removed if value is cleared (e.g. dragged to 0?)
			const existingIndex = this._orders.findIndex(o => o.id === tpId);
			if (existingIndex >= 0) {
				const cancelled = { ...this._orders[existingIndex], status: OrderStatus.Canceled };
				this._host.orderUpdate(cancelled);
				this._orders.splice(existingIndex, 1);
				delete this._orderById[tpId];
			}
		}

		if (parent.stopLoss && parent.stopLoss > 0) {
			const slB = this._createOrderStopLossBracket(parent);
			slB.id = slId;
			slB.parentId = parentId;
			slB.parentType = parentId === PREVIEW_POSITION_ID ? ParentType.Position : ParentType.Order;

			const existingIndex = this._orders.findIndex(o => o.id === slId);
			if (existingIndex >= 0) {
				this._orders[existingIndex] = slB;
			} else {
				this._orders.push(slB);
			}
			this._orderById[slId] = slB;
			this._host.orderUpdate(slB);
		} else {
			// Ensure SL bracket is removed if value is cleared
			const existingIndex = this._orders.findIndex(o => o.id === slId);
			if (existingIndex >= 0) {
				const cancelled = { ...this._orders[existingIndex], status: OrderStatus.Canceled };
				this._host.orderUpdate(cancelled);
				this._orders.splice(existingIndex, 1);
				delete this._orderById[slId];
			}
		}
	}

	private _syncToPanel(order: Order | Position, source: string = 'chart') {
		if (typeof window === 'undefined') return;

		const isPosition = 'avgPrice' in order;

		// Determine type and price based on whether it's an Order or Position
		let typeStr = 'market';
		let price = 0;

		if (isPosition) {
			typeStr = 'market';
			price = (order as Position).avgPrice;
		} else {
			typeStr = (order as Order).type === OrderType.Limit ? 'limit' : 'stop';
			price = (order as Order).type === OrderType.Limit ? (order as Order).limitPrice! : (order as Order).stopPrice!;
		}

		const targetWin = window.top || window;
		targetWin.dispatchEvent(new CustomEvent('__ON_ORDER_PREVIEW_CHANGE__', {
			detail: {
				id: order.id,
				price: price,
				takeProfit: order.takeProfit,
				stopLoss: order.stopLoss,
				qty: order.qty,
				type: typeStr,
				// NOTE: 'side' is intentionally NOT included here for real order modifications.
				// Including 'side' triggers setPendingOrderSide() in OrderPanel which opens
				// the confirmation dialog — we only want that for new order previews.
				source: source
			}
		}));
	}
}
