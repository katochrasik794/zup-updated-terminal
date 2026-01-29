import {
	AccountId,
	AccountManagerInfo,
	AccountManagerSummaryField,
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
import { apiClient } from '@/lib/api';
import { placeMarketOrderDirect, placePendingOrderDirect, closePositionDirect, cancelPendingOrderDirect } from '@/lib/metaapi';

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
	private _pollInterval: NodeJS.Timeout | null = null;
	private _isPolling = false;
	private _isWidgetReady = false;
	private _getMetaApiToken: ((accountId: string) => Promise<string | null>) | null = null;

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

		// CRITICAL: Get bracket orders from _orderById (not _orders) for chart display
		// _orders should only contain real pending orders, bracket orders are in _orderById
		const allOrdersFromMap = Object.values(this._orderById);
		const bracketOrders = allOrdersFromMap.filter(o => this._isBracketOrder(o));
		
		// Regular orders are in _orders array (already filtered to exclude brackets)
		const regularOrders = this._orders.filter(o => o && !this._isBracketOrder(o));

		// CRITICAL: Update bracket orders FIRST, then positions
		// This is the correct order for TradingView to display TP/SL lines

		// 1. Send bracket orders via orderUpdate() with correct status and parentId/parentType set
		// According to TradingView docs, bracket orders MUST be sent via orderUpdate() for chart display
		// Position brackets should have status: Working (for draggability)
		// Order brackets should have status: Inactive
		// TradingView should automatically filter them from Account Manager Orders tab
		bracketOrders.forEach(bracket => {
			try {
				if (this._host && typeof this._host.orderUpdate === 'function') {
					// CRITICAL: Preserve the status set by _createTakeProfitBracket/_createStopLossBracket
					// Position brackets use Working status (for dragging), order brackets use Inactive
					// Only ensure parentType is set correctly if not already set
					if (bracket.parentType === undefined) {
						bracket.parentType = ParentType.Position;
					}
					
					// CRITICAL: Calculate projected P/L at bracket price for correct display
					// TradingView may recalculate P/L based on bracket qty (which is divided by 10000)
					// So we need to calculate using FULL volume and multiply by 100 to compensate
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
								// Fallback: Use position's P/L and multiply by 100
								(bracket as any).pl = (parentPosition as any).pl * 100;
							}
						} else if (parentPosition && (parentPosition as any).pl !== undefined && (parentPosition as any).pl !== null) {
							// Fallback: Use position's P/L and multiply by 100
							(bracket as any).pl = (parentPosition as any).pl * 100;
						}
					}
					
					this._host.orderUpdate(bracket);
				}
			} catch (error) {
				// Error notifying bracket order - silently handle
			}
		});

		// 2. Update regular orders (for Account Manager)
		regularOrders.forEach(o => {
			try {
				if (this._host && typeof this._host.orderUpdate === 'function') {
					this._host.orderUpdate(o);
				}
			} catch (error) {
				// Error notifying order - silently handle
			}
		});

		// 3. Finally, update positions AFTER brackets exist
		this._positions.forEach(p => {
			try {
				if (this._host && typeof this._host.positionUpdate === 'function') {
					const cleanPosition = this._createCleanPosition(p);
					// Update _positionById with clean position before calling positionUpdate
					this._positionById[cleanPosition.id] = cleanPosition;
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
			return;
		}

			// CRITICAL: Clean Slate Approach
			// We strictly use window.__LIVE_POSITIONS_DATA__ because it contains the exact data shown in the Pending Orders table.
			// This ensures 100% consistency between Account Manager and the bottom panel.

			let positionsArray: any[] = [];
			let pendingArray: any[] = [];
			let usingWindowData = false;

			// 1. Try to get data from shared window object (Primary Source)
			if (typeof window !== 'undefined' && (window as any).__LIVE_POSITIONS_DATA__) {
				const liveData = (window as any).__LIVE_POSITIONS_DATA__;
				if (liveData.pendingOrders) {
					console.log('[ZuperiorBroker] Using shared window data (Clean Slate)');
					positionsArray = liveData.openPositions || [];
					pendingArray = liveData.pendingOrders || [];
					usingWindowData = true;
				}
			}

			// 2. Fallback to API fetch if window data is not available
			if (!usingWindowData) {
				console.log('[ZuperiorBroker] Window data not available, falling back to API');

			try {
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

				if (response && response.success) {
					// Handle various API response structures
					let positionsSource = response.positions;
					if (!positionsSource && Array.isArray(response.data)) {
						positionsSource = response.data;
					} else if (!positionsSource && response.data?.positions) {
						positionsSource = response.data.positions;
					}
					positionsArray = Array.isArray(positionsSource) ? positionsSource : [];

					let pendingSource = response.pendingOrders;
					if (!pendingSource && response.data?.pendingOrders) {
						pendingSource = response.data.pendingOrders;
					}
					pendingArray = Array.isArray(pendingSource) ? pendingSource : [];
				}
			} catch (error: any) {
				// Handle 401 Unauthorized gracefully
				if (error?.status === 401) {
					console.warn('[ZuperiorBroker] 401 Unauthorized - This is expected if not logged in or token expired.');
					return; // Silently return, don't process empty data
				}
				// For other errors, log but continue with empty arrays
				console.error('[ZuperiorBroker] Error fetching positions/orders:', error);
				return;
			}
		}

		// Process data only if we have arrays (from either window or API)
		if (positionsArray.length > 0 || pendingArray.length > 0 || usingWindowData) {
			console.log(`[ZuperiorBroker] Processing ${positionsArray.length} positions and ${pendingArray.length} pending orders`);

			console.log(`[ZuperiorBroker] Raw data - positions: ${positionsArray.length}, orders: ${pendingArray.length}`);

			// Debug: Log raw position data to see what fields are available
			if (positionsArray.length > 0) {
				console.log(`[ZuperiorBroker] Raw position data (first position):`, positionsArray[0]);
				console.log(`[ZuperiorBroker] All keys in first position:`, Object.keys(positionsArray[0] || {}));
				// Check for TP/SL in various formats
				const firstPos = positionsArray[0];
				if (firstPos) {
					console.log(`[ZuperiorBroker] TP/SL check:`, {
						takeProfit: firstPos.takeProfit,
						TakeProfit: firstPos.TakeProfit,
						TP: firstPos.TP,
						tp: firstPos.tp,
						stopLoss: firstPos.stopLoss,
						StopLoss: firstPos.StopLoss,
						SL: firstPos.SL,
						sl: firstPos.sl,
					});
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

			// CRITICAL LOGGING: Log ALL raw pending orders to understand data structure
			console.log('[ZuperiorBroker] ===== RAW PENDING ORDERS FROM BACKEND =====');
			console.log('[ZuperiorBroker] Total pending orders:', pendingArray.length);
			if (pendingArray.length > 0) {
				pendingArray.forEach((order: any, index: number) => {
					console.log(`[ZuperiorBroker] Raw Order ${index + 1}:`, {
						symbol: order.Symbol || order.symbol,
						type: order.Type || order.type,
						orderType: order.OrderType || order.orderType,
						action: order.Action || order.action,
						ticket: order.Ticket || order.ticket,
						positionId: order.PositionId || order.positionId,
						parentId: order.ParentId || order.parentId,
						parentType: order.ParentType || order.parentType,
						comment: order.Comment || order.comment,
						state: order.State || order.state,
						status: order.Status || order.status,
						allKeys: Object.keys(order),
					});
				});
			}
			console.log('[ZuperiorBroker] ==========================================');

			// Map pending orders - filter out invalid ones AND bracket orders (TP/SL)
			const tvOrders = (Array.isArray(pendingArray) ? pendingArray : [])
				.map((order: any) => {
					try {
						if (!order || typeof order !== 'object') {
							console.warn('[ZuperiorBroker] Invalid order object:', order);
							return null;
						}
						const mappedOrder = this._mapApiOrderToTVOrder(order);
						// Log mapped order to see TradingView format
						if (mappedOrder) {
							console.log('[ZuperiorBroker] Mapped Order:', {
								id: mappedOrder.id,
								symbol: mappedOrder.symbol,
								type: mappedOrder.type,
								side: mappedOrder.side,
								status: mappedOrder.status,
								parentId: mappedOrder.parentId,
								parentType: mappedOrder.parentType,
							});
						}
						return mappedOrder;
					} catch (error) {
						console.error('[ZuperiorBroker] Error mapping order:', error, order);
						return null;
					}
				})
				.filter((o: Order | null): o is Order => {
					if (!o || !o.id || !o.symbol || o.qty <= 0) {
						return false;
					}
					// CRITICAL: Filter out bracket orders (TP/SL) from Account Manager
					// Bracket orders should NOT appear in the Orders tab
					// They are identified by:
					// 1. Having a parentId or parentType set, OR
					// 2. Having status = Inactive (bracket orders are typically Inactive until triggered)
					if (o.parentId || o.parentType !== undefined) {
						console.log('[ZuperiorBroker] Filtering out bracket order (has parent) from Account Manager:', {
							id: o.id,
							symbol: o.symbol,
							parentId: o.parentId,
							parentType: o.parentType,
						});
						return false;
					}
					// Filter out Inactive orders (these are TP/SL bracket orders)
					// Only keep Working orders (real pending orders placed by user)
					if (o.status === OrderStatus.Inactive) {
						console.log('[ZuperiorBroker] Filtering out Inactive order (TP/SL bracket) from Account Manager:', {
							id: o.id,
							symbol: o.symbol,
							type: o.type,
							status: o.status,
						});
						return false;
					}
					// TEMPORARILY DISABLED: Type-based filtering was too aggressive
					// It was catching legitimate pending orders
					// TODO: Find the correct field to identify bracket orders
					// const orderTypeStr = String(o.type || '').toLowerCase();
					// if (orderTypeStr.includes('stop loss') || orderTypeStr.includes('take profit')) {
					// 	console.log('[ZuperiorBroker] Filtering out bracket order (by type) from Account Manager:', {
					// 		id: o.id,
					// 		symbol: o.symbol,
					// 		type: o.type,
					// 		status: o.status,
					// 	});
					// 	return false;
					// }
					console.log('[ZuperiorBroker] Keeping order (passed all filters):', {
						id: o.id,
						symbol: o.symbol,
						type: o.type,
						status: o.status,
						parentId: o.parentId,
						parentType: o.parentType,
					});
					return true;
				});

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
			// CRITICAL: Store positions with TP/SL fields preserved
			if (Array.isArray(this._positions) && Array.isArray(tvPositions)) {
				this._positions.length = 0;
				// Ensure all positions have TP/SL fields before storing
				tvPositions.forEach(p => {
					// Verify TP/SL fields are present
					if (!('takeProfit' in p)) {
						(p as any).takeProfit = undefined;
					}
					if (!('stopLoss' in p)) {
						(p as any).stopLoss = undefined;
					}
				});
				this._positions.push(...tvPositions);

				// Debug: Log stored positions to verify TP/SL are preserved
				if (tvPositions.length > 0) {
					console.log(`[ZuperiorBroker] Stored positions with TP/SL:`, tvPositions.map(p => ({
						id: p.id,
						symbol: p.symbol,
						takeProfit: p.takeProfit,
						stopLoss: p.stopLoss,
					})));
				}
			} else {
				console.warn('[ZuperiorBroker] Cannot update positions - arrays not valid');
			}

			if (Array.isArray(this._orders) && Array.isArray(tvOrders)) {
				// CRITICAL: Filter out any bracket orders that might have slipped through
				// Only store orders with "Generated-" prefix (real pending orders from backend)
				const validPendingOrders = tvOrders.filter((o: Order) => {
					const orderId = String(o.id);
					if (!orderId.startsWith('Generated-')) {
						console.warn('[ZuperiorBroker] Filtering out non-Generated order from _orders:', {
							id: o.id,
							symbol: o.symbol,
						});
						return false;
					}
					if (this._isBracketOrder(o)) {
						console.warn('[ZuperiorBroker] Filtering out bracket order from _orders:', {
							id: o.id,
							symbol: o.symbol,
						});
						return false;
					}
					return true;
				});
				
				this._orders.length = 0;
				this._orders.push(...validPendingOrders);
				console.log(`[ZuperiorBroker] Stored ${validPendingOrders.length} real pending orders (excluding ${bracketOrders.length} brackets)`);
			} else {
				console.warn('[ZuperiorBroker] Cannot update orders - arrays not valid');
			}

			// Update orderById map with ALL orders (including brackets) for internal tracking
			// This map is used for getBrackets() and modifyOrder() methods
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

				// Step 1: Create clean positions and update internal state BEFORE calling positionUpdate
				// CRITICAL: Store clean positions in _positionById and _positions BEFORE calling positionUpdate
				// This ensures positions() method returns valid data when TradingView queries it internally
				const cleanPositions: Position[] = [];
				const positionMap: SimpleMap<Position> = {};

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

							// Store clean position in arrays/maps
							cleanPositions.push(cleanPosition);
							positionMap[cleanPosition.id] = cleanPosition;
						} catch (error) {
							console.error('[ZuperiorBroker] Error creating clean position:', error, p);
						}
					});
				}

				// Update internal state with clean positions BEFORE calling positionUpdate
				// This ensures positions() returns correct data when TradingView queries it
				this._positions.length = 0;
				this._positions.push(...cleanPositions);
				this._positionById = positionMap;

				// Now notify TradingView with clean positions
				if (cleanPositions.length > 0) {
					cleanPositions.forEach(cleanPosition => {
						try {
							// Verify bracket fields are present before sending
							const hasTakeProfit = 'takeProfit' in cleanPosition;
							const hasStopLoss = 'stopLoss' in cleanPosition;
							console.log(`[ZuperiorBroker] Step 1: Sending position with brackets:`, {
								id: cleanPosition.id,
								symbol: cleanPosition.symbol,
								takeProfit: cleanPosition.takeProfit,
								stopLoss: cleanPosition.stopLoss,
								hasTakeProfitField: hasTakeProfit,
								hasStopLossField: hasStopLoss,
								positionKeys: Object.keys(cleanPosition),
							});

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
				} else {
					console.log(`[ZuperiorBroker] No positions to send (count: ${tvPositions.length})`);
				}

				// Step 2: Send bracket orders via orderUpdate() with correct structure
				// According to TradingView docs, bracket orders MUST be sent via orderUpdate() for chart display
				// Position brackets should have status: Working (for draggability)
				// Order brackets should have status: Inactive
				// TradingView should automatically filter them from Account Manager Orders tab
				if (Array.isArray(bracketOrders) && bracketOrders.length > 0) {
					bracketOrders.forEach(bracket => {
						try {
							if (bracket && this._host && typeof this._host.orderUpdate === 'function') {
								// CRITICAL: Preserve the status set by _createTakeProfitBracket/_createStopLossBracket
								// Position brackets use Working status (for dragging), order brackets use Inactive
								// Only ensure parentType is set if not already set
								if (bracket.parentType === undefined) {
									bracket.parentType = ParentType.Position;
								}
								
								// CRITICAL: Calculate projected P/L at bracket price for correct display
								// TradingView may recalculate P/L based on bracket qty (which is divided by 10000)
								// So we need to calculate using FULL volume and multiply by 100 to compensate
								if (bracket.parentId) {
									const parentPosition = this._positionById[bracket.parentId];
									const position = tvPositions.find(p => p.id === bracket.parentId);
									
									if (position && position.avgPrice) {
										const bracketPrice = (bracket as any).limitPrice || (bracket as any).stopPrice;
										if (bracketPrice && position.avgPrice) {
											// Calculate using FULL volume (multiply qty by 10000)
											const fullVolume = position.qty * 10000;
											const priceDiff = bracketPrice - position.avgPrice;
											const plAtBracket = priceDiff * fullVolume * (position.side === Side.Sell ? -1 : 1);
											// Multiply by 100 to compensate for TradingView's recalculation
											(bracket as any).pl = plAtBracket * 100;
										} else if (parentPosition && (parentPosition as any).pl !== undefined && (parentPosition as any).pl !== null) {
											// Fallback: Use position's P/L and multiply by 100
											(bracket as any).pl = (parentPosition as any).pl * 100;
										}
									} else if (parentPosition && (parentPosition as any).pl !== undefined && (parentPosition as any).pl !== null) {
										// Fallback: Use position's P/L and multiply by 100
										(bracket as any).pl = (parentPosition as any).pl * 100;
									}
								}
								
								console.log(`[ZuperiorBroker] Step 2: Sending bracket order:`, {
									id: bracket.id,
									symbol: bracket.symbol,
									type: bracket.type,
									parentId: bracket.parentId,
									parentType: bracket.parentType,
									status: bracket.status,
									limitPrice: (bracket as any).limitPrice,
									stopPrice: (bracket as any).stopPrice,
									pl: (bracket as any).pl,
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
		} else {
			// No data available, skip processing
			console.log('[ZuperiorBroker] No positions/orders data available to process');
		}
	}

	private _mapApiPositionToTVPosition(apiPos: any): Position {
		const ticket = apiPos.ticket || apiPos.Ticket || apiPos.PositionId || apiPos.id;
		const id = String(ticket);

		// Map side: Buy = 1, Sell = -1
		// FIXED: Correct side mapping logic to match open positions table
		const typeStr = (apiPos.type || apiPos.Type || '').toString();
		const action = apiPos.Action || apiPos.action;

		// Primary check: use type field directly if it's a string
		let isBuy = false;
		if (typeStr === 'Buy') {
			isBuy = true;
		} else if (typeStr === 'Sell') {
			isBuy = false;
		} else if (action !== undefined) {
			// Fallback: use action field (0 = Buy, 1 = Sell)
			isBuy = action === 0 || String(action) === '0';
		} else {
			// Last resort: check if type contains 'buy'
			isBuy = typeStr.toLowerCase().includes('buy');
		}

		const side = isBuy ? Side.Buy : Side.Sell;

		const openPrice = Number(apiPos.openPrice || apiPos.OpenPrice || apiPos.priceOpen || apiPos.PriceOpen || apiPos.price || apiPos.Price || 0);
		const currentPrice = Number(apiPos.currentPrice || apiPos.CurrentPrice || apiPos.priceCurrent || apiPos.PriceCurrent || apiPos.price || apiPos.Price || openPrice);

		// Fix volume logic: Divide by 10000 to match open positions table
		// This matches the TradingTerminal volume formatting: (pos.volume / 10000).toFixed(2)
		let volume = 0;
		const volumeLots = apiPos.VolumeLots || apiPos.volumeLots;
		const rawVolume = apiPos.Volume || apiPos.volume || 0;

		if (volumeLots !== undefined && volumeLots !== null) {
			volume = Number(volumeLots);
		} else {
			const numVolume = Math.abs(Number(rawVolume));
			// Always divide by 10000 to match open positions table
			volume = numVolume / 10000;
		}

		const profit = Number(apiPos.profit || apiPos.Profit || apiPos.pl || apiPos.PL || 0);

		// Ensure all required fields are valid
		// Use raw symbol from API without normalization to match chart symbol (e.g. EURJPYm)
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
		// FIXED: Extract TP/SL from multiple field name variations with better validation
		// Check all possible field name variations (case-insensitive, snake_case, camelCase, etc.)
		const takeProfitRaw = apiPos.takeProfit ?? apiPos.TakeProfit ?? apiPos.TP ?? apiPos.tp ??
			apiPos.take_profit ?? apiPos.Take_Profit ?? apiPos.TAKE_PROFIT ??
			apiPos.takeProfitPrice ?? apiPos.TakeProfitPrice ?? apiPos.tpPrice ?? apiPos.TPPrice ??
			apiPos.PriceTP ?? apiPos.priceTP;

		const takeProfitNum = (takeProfitRaw !== undefined && takeProfitRaw !== null && takeProfitRaw !== '' && takeProfitRaw !== 0)
			? (typeof takeProfitRaw === 'string' ? parseFloat(takeProfitRaw) : Number(takeProfitRaw))
			: NaN;
		// Only include valid positive numbers for TP/SL
		const takeProfit = Number.isFinite(takeProfitNum) && takeProfitNum > 0 ? takeProfitNum : undefined;

		const stopLossRaw = apiPos.stopLoss ?? apiPos.StopLoss ?? apiPos.SL ?? apiPos.sl ??
			apiPos.stop_loss ?? apiPos.Stop_Loss ?? apiPos.STOP_LOSS ??
			apiPos.stopLossPrice ?? apiPos.StopLossPrice ?? apiPos.slPrice ?? apiPos.SLPrice ??
			apiPos.PriceSL ?? apiPos.priceSL;

		const stopLossNum = (stopLossRaw !== undefined && stopLossRaw !== null && stopLossRaw !== '' && stopLossRaw !== 0)
			? (typeof stopLossRaw === 'string' ? parseFloat(stopLossRaw) : Number(stopLossRaw))
			: NaN;
		// Only include valid positive numbers for TP/SL
		const stopLoss = Number.isFinite(stopLossNum) && stopLossNum > 0 ? stopLossNum : undefined;

		// Debug logging to see what we're getting from API - log for ALL positions to help debug
		console.log(`[ZuperiorBroker] TP/SL extraction for position ${id}:`, {
			takeProfitRaw,
			takeProfit,
			takeProfitNum,
			stopLossRaw,
			stopLoss,
			stopLossNum,
			allApiKeys: Object.keys(apiPos),
			// Log all potential TP/SL fields
			apiTakeProfit: apiPos.takeProfit,
			apiTP: apiPos.TP,
			apiStopLoss: apiPos.stopLoss,
			apiSL: apiPos.SL,
		});

		// Set TP/SL fields - ensure they are numbers (not strings) or null for TradingView brackets
		// CRITICAL: Always set these fields, even if null, so Account Manager can display columns
		position.takeProfit = takeProfit !== undefined ? Number(takeProfit) : null;
		position.stopLoss = stopLoss !== undefined ? Number(stopLoss) : null;

		// Add all additional fields required by app's position table
		// These fields are extracted from API response to match usePositions hook format

		// ticket field - required by app
		(position as any).ticket = Number(ticket) || 0;

		// type field as string (Buy/Sell) - required by app
		(position as any).type = isBuy ? 'Buy' : 'Sell';

		// volume field (alias for qty) - app uses 'volume'
		(position as any).volume = Number(volume);

		// openPrice field (alias for avgPrice) - app uses 'openPrice'
		(position as any).openPrice = Number(openPrice);

		// currentPrice field - required for P&L calculation
		(position as any).currentPrice = Number(currentPrice);

		// swap field - required by app
		(position as any).swap = Number(apiPos.swap || apiPos.Swap || 0);

		// commission field - required by app
		(position as any).commission = Number(apiPos.commission || apiPos.Commission || 0);

		// comment field - required by app
		(position as any).comment = apiPos.comment || apiPos.Comment || undefined;

		// openTime field - required by app
		const openTime = apiPos.openTime || apiPos.OpenTime || apiPos.TimeCreate || apiPos.timeCreate ||
			apiPos.TimeSetup || apiPos.timeSetup || new Date().toISOString();
		(position as any).openTime = String(openTime);

		// openTimeInMs field - required by TradingView for proper chart display
		// Convert ISO string to milliseconds timestamp
		let openTimeMs = Date.now();
		try {
			openTimeMs = new Date(openTime).getTime();
		} catch (e) {
			console.warn('[ZuperiorBroker] Failed to parse openTime:', openTime);
		}
		(position as any).openTimeInMs = openTimeMs;

		// positionId field - app uses this
		(position as any).positionId = Number(apiPos.PositionId || apiPos.positionId || ticket) || undefined;

		// Ensure bracket fields are always present (even if undefined)
		// This is required for TradingView Account Manager to show TP/SL columns
		if (!('stopLoss' in position)) {
			position.stopLoss = undefined;
		}
		if (!('takeProfit' in position)) {
			position.takeProfit = undefined;
		}

		// Final verification - log if values are missing but should be there
		if (takeProfitRaw !== undefined && takeProfitRaw !== null && takeProfit === undefined) {
			console.warn(`[ZuperiorBroker] TP value lost during extraction for position ${id}:`, {
				raw: takeProfitRaw,
				parsed: takeProfitNum,
				isFinite: Number.isFinite(takeProfitNum),
				isPositive: takeProfitNum > 0,
			});
		}
		if (stopLossRaw !== undefined && stopLossRaw !== null && stopLoss === undefined) {
			console.warn(`[ZuperiorBroker] SL value lost during extraction for position ${id}:`, {
				raw: stopLossRaw,
				parsed: stopLossNum,
				isFinite: Number.isFinite(stopLossNum),
				isPositive: stopLossNum > 0,
			});
		}

		return position;
	}

	private _mapApiOrderToTVOrder(apiOrder: any): Order {
		const ticket = apiOrder.ticket || apiOrder.Ticket || apiOrder.OrderId || apiOrder.id;
		const id = String(ticket);

		// Map order type - handle both numeric MT5 types and string values
		// MT5 Order Types: 0=Buy, 1=Sell, 2=Buy Limit, 3=Sell Limit, 4=Buy Stop, 5=Sell Stop
		const typeField = apiOrder.Type ?? apiOrder.type;
		const typeStr = String(typeField || '');
		let type: OrderType;
		let isBuy = false;

		// DEBUG: Log raw API order data to understand the format
		console.log('[ZuperiorBroker] _mapApiOrderToTVOrder - Raw API order:', {
			id: apiOrder.ticket || apiOrder.Ticket || apiOrder.OrderId || apiOrder.id,
			symbol: apiOrder.symbol || apiOrder.Symbol,
			typeField: typeField,
			typeStr: typeStr,
			action: apiOrder.Action || apiOrder.action,
			allKeys: Object.keys(apiOrder),
		});

		// First, try to parse as numeric MT5 order type
		const typeNum = Number(typeField);
		if (!isNaN(typeNum)) {
			// Numeric MT5 order types
			switch (typeNum) {
				case 0: // Buy (Market)
					isBuy = true;
					type = OrderType.Market;
					break;
				case 1: // Sell (Market)
					isBuy = false;
					type = OrderType.Market;
					break;
				case 2: // Buy Limit
					isBuy = true;
					type = OrderType.Limit;
					break;
				case 3: // Sell Limit
					isBuy = false;
					type = OrderType.Limit;
					break;
				case 4: // Buy Stop
					isBuy = true;
					type = OrderType.Stop;
					break;
				case 5: // Sell Stop
					isBuy = false;
					type = OrderType.Stop;
					break;
				case 6: // Buy Stop Limit
					isBuy = true;
					type = OrderType.StopLimit;
					break;
				case 7: // Sell Stop Limit
					isBuy = false;
					type = OrderType.StopLimit;
					break;
				default:
					// Unknown numeric type, use fallback
					const action = apiOrder.Action || apiOrder.action;
					isBuy = action === 0 || String(action) === '0';
					type = OrderType.Limit;
					console.warn('[ZuperiorBroker] Unknown numeric order type:', typeNum);
			}
		} else {
			// Try string-based parsing (fallback for string type values)
			if (typeStr.includes('Buy Limit') || typeStr === 'Buy Limit') {
				isBuy = true;
				type = OrderType.Limit;
			} else if (typeStr.includes('Sell Limit') || typeStr === 'Sell Limit') {
				isBuy = false;
				type = OrderType.Limit;
			} else if (typeStr.includes('Buy Stop') || typeStr === 'Buy Stop') {
				isBuy = true;
				type = OrderType.Stop;
			} else if (typeStr.includes('Sell Stop') || typeStr === 'Sell Stop') {
				isBuy = false;
				type = OrderType.Stop;
			} else {
				// Fallback: check action field or default to buy
				const action = apiOrder.Action || apiOrder.action;
				isBuy = action === 0 || String(action) === '0';
				type = OrderType.Limit; // Default to limit
				console.warn('[ZuperiorBroker] Could not determine order type from string, using fallback:', {
					typeStr,
					action,
					isBuy,
				});
			}
		}

		const side = isBuy ? Side.Buy : Side.Sell;

		// Use openPrice or priceOrder for the order price
		const orderPrice = Number(apiOrder.openPrice || apiOrder.OpenPrice || apiOrder.priceOrder || apiOrder.PriceOrder || apiOrder.price || apiOrder.Price || 0);
		const limitPrice = (type === OrderType.Limit) ? orderPrice : undefined;
		const stopPrice = (type === OrderType.Stop) ? orderPrice : undefined;

		// Use volume divided by 100 to match pending orders table
		const volume = Number(apiOrder.volume || apiOrder.Volume || 0) / 100;

		// Get symbol
		const symbol = (apiOrder.symbol || apiOrder.Symbol || '').toUpperCase();

		// DEBUG: Log final mapped values
		console.log('[ZuperiorBroker] _mapApiOrderToTVOrder - Mapped to TradingView order:', {
			id,
			symbol,
			side: side === Side.Buy ? 'Buy' : 'Sell',
			sideValue: side,
			type: type === OrderType.Limit ? 'Limit' : type === OrderType.Stop ? 'Stop' : 'Market',
			typeValue: type,
			qty: volume,
			limitPrice,
			stopPrice,
		});

		// Check for TP/SL in type string to identify bracket orders
		// These should be marked as Inactive so they can be filtered out
		let status = OrderStatus.Working;
		if (typeStr.includes('Take Profit') || typeStr.includes('Stop Loss') ||
			typeStr.includes('TP') || typeStr.includes('SL')) {
			status = OrderStatus.Inactive;
			console.log('[ZuperiorBroker] Identified bracket order from type string:', { id, typeStr });
		}

		// Also check API status field if available
		const apiStatus = apiOrder.status || apiOrder.Status;
		if (apiStatus !== undefined) {
			if (String(apiStatus) === '1' || String(apiStatus).toLowerCase() === 'inactive') {
				status = OrderStatus.Inactive;
			} else if (String(apiStatus) === '0' || String(apiStatus).toLowerCase() === 'working') {
				status = OrderStatus.Working;
			}
		}

		const order: Order = {
			id,
			symbol,
			type,
			side,
			qty: volume,
			status,
			limitPrice,
			stopPrice,
			takeProfit: apiOrder.takeProfit || apiOrder.TakeProfit || apiOrder.TP || apiOrder.tp || undefined,
			stopLoss: apiOrder.stopLoss || apiOrder.StopLoss || apiOrder.SL || apiOrder.sl || undefined,
			// CRITICAL: Preserve parentId and parentType for bracket order identification
			// Per TradingView spec, bracket orders ALWAYS have these fields set
			// Real pending orders placed by user will NOT have these fields
			parentId: apiOrder.parentId || apiOrder.ParentId || undefined,
			parentType: apiOrder.parentType !== undefined ? Number(apiOrder.parentType) :
				apiOrder.ParentType !== undefined ? Number(apiOrder.ParentType) : undefined,
		} as Order;

		// CRITICAL: Add supportModify and supportCancel flags for draggable orders
		// These flags enable dragging order lines and TP/SL lines in the chart
		// Only add for real pending orders (not bracket orders)
		if (!order.parentId && !order.parentType) {
			(order as any).supportModify = true; // Allow dragging order lines and TP/SL
			(order as any).supportCancel = true; // Allow canceling orders
		}

		return order;
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

	// Helper method to check if an order is a bracket order (TP/SL)
	private _isBracketOrder(order: Order): boolean {
		if (!order || !order.id) {
			return false;
		}
		
		const orderId = String(order.id).toLowerCase();
		
		// Check if ID starts with "tp_" or "sl_" (bracket orders)
		if (orderId.startsWith('tp_') || orderId.startsWith('sl_')) {
			return true;
		}
		
		// Check if order has parentId (bracket orders belong to a position/order)
		if (order.parentId !== undefined && order.parentId !== null) {
			return true;
		}
		
		// Check if order has parentType set to Position (bracket orders attached to positions)
		if (order.parentType !== undefined && order.parentType === ParentType.Position) {
			return true;
		}
		
		// Check if order status is Inactive (typically bracket orders)
		if (order.status === OrderStatus.Inactive) {
			return true;
		}
		
		return false;
	}

	public async orders(): Promise<Order[]> {
		// Ensure _orders is always an array before calling slice()
		if (!Array.isArray(this._orders)) {
			console.warn('[ZuperiorBroker] _orders is not an array, returning empty array');
			return Promise.resolve([]);
		}

		// PRIMARY FILTER: Only return orders with ID starting with "Generated-" (real pending orders from backend)
		// This ensures bracket orders (tp_*, sl_*) are completely excluded from Account Manager
		const filteredOrders = this._orders.filter((o: Order) => {
			// PRIMARY CHECK: Only allow orders with "Generated-" prefix
			const orderId = String(o.id);
			if (!orderId.startsWith('Generated-')) {
				console.log('[ZuperiorBroker] Filtering out order from orders() (not Generated- prefix):', {
				id: o.id,
				symbol: o.symbol,
				type: o.type,
				});
				return false;
			}
			
			// Additional safety checks using helper method
			if (this._isBracketOrder(o)) {
				console.log('[ZuperiorBroker] Filtering out bracket order from orders() (detected by helper):', {
					id: o.id,
					symbol: o.symbol,
				parentId: o.parentId,
				parentType: o.parentType,
					status: o.status,
				});
				return false;
			}
			
			return true;
		});

		console.log(`[ZuperiorBroker] orders() called - returning ${filteredOrders.length} orders (filtered from ${this._orders.length}):`,
			filteredOrders.map(o => ({
				id: o.id,
				symbol: o.symbol,
				type: o.type,
				side: o.side,
			}))
		);
		return Promise.resolve(filteredOrders);
	}


	// CRITICAL: Add this method for bracket functionality
	public getBrackets(parentId: string): Order[] {
		return this._orders.filter(
			(order: Order) => order.parentId === parentId &&
				(order.status === OrderStatus.Working || order.status === OrderStatus.Inactive)
		);
	}

	// CRITICAL: Add modifyOrder method for draggable TP/SL
	public async modifyOrder(order: Order, _confirmId?: string): Promise<void> {
		console.log('[ZuperiorBroker] modifyOrder called:', {
			id: order.id,
			symbol: order.symbol,
			limitPrice: order.limitPrice,
			stopPrice: order.stopPrice,
			parentId: order.parentId,
			parentType: order.parentType,
			isBracket: this._isBracketOrder(order),
		});

		// CRITICAL: Handle bracket orders (TP/SL lines) - they might have synthetic IDs during drag
		// Check if this is a bracket order by ID pattern (tp_* or sl_*) or by parentId
		const isBracketOrder = this._isBracketOrder(order) || order.parentId !== undefined;
		
		// For bracket orders, try to find by parentId if direct lookup fails
		let originalOrder = this._orderById[order.id];
		if (!originalOrder && isBracketOrder && order.parentId) {
			// Try to find bracket order by parentId and type
			const bracketId = order.limitPrice !== undefined ? `tp_${order.parentId}` : `sl_${order.parentId}`;
			originalOrder = this._orderById[bracketId];
			
			if (originalOrder) {
				// Update the order ID to match the found bracket
				order.id = bracketId;
				console.log('[ZuperiorBroker] Found bracket order by parentId:', bracketId);
			}
		}

		// If still not found and it's a bracket order, create/update it
		if (!originalOrder && isBracketOrder && order.parentId) {
			console.log('[ZuperiorBroker] Creating/updating bracket order during drag:', order.id);
			// Store the bracket order
			this._orderById[order.id] = order;
			originalOrder = order;
		}

		if (!originalOrder) {
			console.warn('[ZuperiorBroker] Order not found in _orderById:', order.id);
			// Still try to process if it has parentId (might be a new bracket)
			if (!order.parentId) {
			return;
			}
		}

		// Update local state
		Object.assign(this._orderById[order.id], order);

		// Update orders array - but only if it's NOT a bracket order
		// Bracket orders should NOT be in _orders array (only in _orderById for internal tracking)
		if (!this._isBracketOrder(order)) {
		const orderIndex = this._orders.findIndex(o => o.id === order.id);
		if (orderIndex >= 0) {
			this._orders[orderIndex] = order;
			}
		} else {
			// If it's a bracket order, remove it from _orders if it exists there
			const orderIndex = this._orders.findIndex(o => o.id === order.id);
			if (orderIndex >= 0) {
				this._orders.splice(orderIndex, 1);
				console.log('[ZuperiorBroker] Removed bracket order from _orders in modifyOrder:', {
					id: order.id,
					symbol: order.symbol,
				});
			}
		}

		// Notify TradingView
		if (this._host && typeof this._host.orderUpdate === 'function') {
			this._host.orderUpdate(order);
		}

		// Handle bracket updates and persist to MetaAPI
		if (order.parentId !== undefined) {
			const entity = order.parentType === ParentType.Position
				? this._positionById[order.parentId]
				: this._orderById[order.parentId];

			if (entity) {
				// Update TP/SL on parent
				const updatedStopLoss = order.stopPrice !== undefined ? order.stopPrice : (entity as any).stopLoss;
				const updatedTakeProfit = order.limitPrice !== undefined ? order.limitPrice : (entity as any).takeProfit;

				if (order.limitPrice !== undefined) {
					(entity as any).takeProfit = order.limitPrice;
				}
				if (order.stopPrice !== undefined) {
					(entity as any).stopLoss = order.stopPrice;
				}

				// Persist changes to MetaAPI if accountId and token function are available
				if (order.parentType === ParentType.Position && this._accountId && this._getMetaApiToken) {
					try {
						const accessToken = await this._getMetaApiToken(this._accountId);
						if (accessToken) {
							const METAAPI_BASE_URL = 'https://metaapi.zuperior.com';
							const API_BASE = METAAPI_BASE_URL.endsWith('/api') ? METAAPI_BASE_URL : `${METAAPI_BASE_URL}/api`;
							const modifyUrl = `${API_BASE}/client/position/modify`;

							const payload: any = {
								positionId: parseInt(order.parentId, 10),
								comment: 'Modified TP/SL from Chart',
							};

							if (updatedStopLoss !== undefined && updatedStopLoss !== null && Number(updatedStopLoss) > 0) {
								payload.stopLoss = Number(updatedStopLoss);
							}
							if (updatedTakeProfit !== undefined && updatedTakeProfit !== null && Number(updatedTakeProfit) > 0) {
								payload.takeProfit = Number(updatedTakeProfit);
							}

							const response = await fetch(modifyUrl, {
								method: 'POST',
								headers: {
									'Content-Type': 'application/json',
									'Authorization': `Bearer ${accessToken}`,
								},
								body: JSON.stringify(payload),
							});

							if (!response.ok) {
								const errorText = await response.text().catch(() => '');
								console.error('[ZuperiorBroker] Failed to persist bracket changes:', errorText);
								// Don't throw - UI update already happened
							} else {
								console.log('[ZuperiorBroker] Bracket changes persisted to MetaAPI');
							}
						}
					} catch (error) {
						console.error('[ZuperiorBroker] Error persisting bracket changes:', error);
						// Don't throw - UI update already happened
					}
				} else if (order.parentType === ParentType.Order && this._accountId && this._getMetaApiToken) {
					// Handle pending order modification
					try {
						const accessToken = await this._getMetaApiToken(this._accountId);
						if (accessToken) {
							const METAAPI_BASE_URL = 'https://metaapi.zuperior.com';
							const API_BASE = METAAPI_BASE_URL.endsWith('/api') ? METAAPI_BASE_URL : `${METAAPI_BASE_URL}/api`;
							const modifyUrl = `${API_BASE}/client/Orders/ModifyPendingOrder`;

							const payload: any = {
								OrderId: parseInt(order.parentId.replace('Generated-', ''), 10),
							};

							if (order.limitPrice !== undefined) {
								payload.PriceTP = order.limitPrice > 0 ? order.limitPrice : 0;
							}
							if (order.stopPrice !== undefined) {
								payload.PriceSL = order.stopPrice > 0 ? order.stopPrice : 0;
							}

							const response = await fetch(modifyUrl, {
								method: 'POST',
								headers: {
									'Content-Type': 'application/json',
									'Authorization': `Bearer ${accessToken}`,
								},
								body: JSON.stringify(payload),
							});

							if (!response.ok) {
								const errorText = await response.text().catch(() => '');
								console.error('[ZuperiorBroker] Failed to persist pending order bracket changes:', errorText);
							} else {
								console.log('[ZuperiorBroker] Pending order bracket changes persisted to MetaAPI');
							}
						}
					} catch (error) {
						console.error('[ZuperiorBroker] Error persisting pending order bracket changes:', error);
					}
				}

				// Update parent position and notify TradingView
				if (order.parentType === ParentType.Position) {
					const parentPosition = entity as Position;
					
					// Update TP/SL fields on parent position
					if (order.limitPrice !== undefined) {
						(parentPosition as any).takeProfit = order.limitPrice;
					}
					if (order.stopPrice !== undefined) {
						(parentPosition as any).stopLoss = order.stopPrice;
					}
					
					const cleanPosition = this._createCleanPosition(parentPosition);
					this._positionById[cleanPosition.id] = cleanPosition;
					
					// Update position in _positions array
					const posIndex = this._positions.findIndex(p => p.id === cleanPosition.id);
					if (posIndex >= 0) {
						this._positions[posIndex] = cleanPosition;
					}
					
					// Notify TradingView of position update
					if (this._host && typeof this._host.positionUpdate === 'function') {
						this._host.positionUpdate(cleanPosition);
					}
					
					console.log('[ZuperiorBroker] Updated parent position after bracket drag:', {
						positionId: cleanPosition.id,
						takeProfit: cleanPosition.takeProfit,
						stopLoss: cleanPosition.stopLoss,
					});
				}
			} else {
				// Handle case where bracket order doesn't have parentId set but is a bracket by ID pattern
				// This can happen when TradingView creates synthetic bracket orders during drag
				if (isBracketOrder && (order.id.startsWith('tp_') || order.id.startsWith('sl_'))) {
					const parentId = order.id.replace('tp_', '').replace('sl_', '');
					const parentPosition = this._positionById[parentId];
					
					if (parentPosition) {
						console.log('[ZuperiorBroker] Found parent position for bracket order by ID pattern:', parentId);
						
						// Update TP/SL on parent position
						if (order.id.startsWith('tp_') && order.limitPrice !== undefined) {
							(parentPosition as any).takeProfit = order.limitPrice;
						}
						if (order.id.startsWith('sl_') && order.stopPrice !== undefined) {
							(parentPosition as any).stopLoss = order.stopPrice;
						}
						
						// Update bracket order with parentId
						order.parentId = parentId;
						order.parentType = ParentType.Position;
						
						// Store bracket order
						this._orderById[order.id] = order;
						
						// Update and notify parent position
						const cleanPosition = this._createCleanPosition(parentPosition);
						this._positionById[cleanPosition.id] = cleanPosition;
						
						if (this._host && typeof this._host.positionUpdate === 'function') {
							this._host.positionUpdate(cleanPosition);
						}
						
						// Persist to MetaAPI
						if (this._accountId && this._getMetaApiToken) {
							try {
								const accessToken = await this._getMetaApiToken(this._accountId);
								if (accessToken) {
									const METAAPI_BASE_URL = 'https://metaapi.zuperior.com';
									const API_BASE = METAAPI_BASE_URL.endsWith('/api') ? METAAPI_BASE_URL : `${METAAPI_BASE_URL}/api`;
									const modifyUrl = `${API_BASE}/client/position/modify`;

									const payload: any = {
										positionId: parseInt(parentId, 10),
										comment: 'Modified TP/SL from Chart Drag',
									};

									if (cleanPosition.stopLoss !== undefined && cleanPosition.stopLoss !== null && Number(cleanPosition.stopLoss) > 0) {
										payload.stopLoss = Number(cleanPosition.stopLoss);
									}
									if (cleanPosition.takeProfit !== undefined && cleanPosition.takeProfit !== null && Number(cleanPosition.takeProfit) > 0) {
										payload.takeProfit = Number(cleanPosition.takeProfit);
									}

									const response = await fetch(modifyUrl, {
										method: 'POST',
										headers: {
											'Content-Type': 'application/json',
											'Authorization': `Bearer ${accessToken}`,
										},
										body: JSON.stringify(payload),
									});

									if (!response.ok) {
										const errorText = await response.text().catch(() => '');
										console.error('[ZuperiorBroker] Failed to persist bracket changes:', errorText);
									} else {
										console.log('[ZuperiorBroker] Bracket changes persisted to MetaAPI');
									}
								}
							} catch (error) {
								console.error('[ZuperiorBroker] Error persisting bracket changes:', error);
							}
						}
					}
				}
			}
		}
	}

	public async positions(): Promise<Position[]> {
		// Ensure _positions is always an array before calling slice()
		if (!Array.isArray(this._positions)) {
			console.warn('[ZuperiorBroker] _positions is not an array, returning empty array');
			return Promise.resolve([]);
		}

		// CRITICAL: Ensure all positions have TP/SL fields (even if undefined) for Account Manager
		// TradingView Account Manager needs these fields to display Stop Loss and Take Profit columns
		const positions = this._positions.map(p => {
			// Create clean position to ensure all fields are present
			const clean = this._createCleanPosition(p);
			return clean;
		});

		console.log(`[ZuperiorBroker] positions() called, returning ${positions.length} positions`);
		if (positions.length > 0) {
			console.log('[ZuperiorBroker] Sample position for Account Manager:', {
				id: positions[0].id,
				symbol: positions[0].symbol,
				qty: positions[0].qty,
				side: positions[0].side,
				avgPrice: positions[0].avgPrice,
				takeProfit: positions[0].takeProfit,
				stopLoss: positions[0].stopLoss,
				hasTakeProfit: 'takeProfit' in positions[0],
				hasStopLoss: 'stopLoss' in positions[0],
			});
		}
		return Promise.resolve(positions);
	}

	public async individualPositions(): Promise<Position[]> {
		// Return individual positions (same as positions() since we don't use netting)
		const positions = await this.positions();
		console.log(`[ZuperiorBroker] individualPositions() called, returning ${positions.length} individual positions`);
		return positions;
	}

	public async executions(_symbol: string): Promise<Execution[]> {
		return Promise.resolve([]);
	}

	public async placeOrder(preOrder: PreOrder): Promise<PlaceOrderResult> {
		console.log('[ZuperiorBroker] placeOrder called:', preOrder);

		if (!this._accountId) {
			throw new Error('No account ID');
		}

		if (!this._getMetaApiToken) {
			throw new Error('MetaAPI token function not available');
		}

		try {
			// Get MetaAPI access token from backend (backend authenticates with password from MT5Account)
			const accessToken = await this._getMetaApiToken(this._accountId);
			if (!accessToken) {
				throw new Error('Failed to get MetaAPI access token');
			}

			// Map TV PreOrder to MetaAPI payload
			// TV PreOrder: { symbol, qty, side (1/-1), type (1=Limit, 2=Market, 3=Stop), limitPrice, stopPrice, takeProfit, stopLoss }
			const side = preOrder.side === 1 ? 'buy' : 'sell';
			const isMarket = preOrder.type === 2; // Market

			let response: { success: boolean; message?: string; data?: any };

			if (isMarket) {
				// Place market order directly via MetaAPI using token from backend
				console.log('[ZuperiorBroker] Placing market order via direct MetaAPI:', {
					accountId: this._accountId,
					symbol: preOrder.symbol,
					side: side,
					volume: preOrder.qty,
					stopLoss: preOrder.stopLoss || 0,
					takeProfit: preOrder.takeProfit || 0,
				});
				response = await placeMarketOrderDirect({
					accountId: this._accountId,
					accessToken: accessToken,
					symbol: preOrder.symbol,
					side: side,
					volume: preOrder.qty,
					stopLoss: preOrder.stopLoss || 0,
					takeProfit: preOrder.takeProfit || 0,
					comment: `${side === 'buy' ? 'Buy' : 'Sell'} from Chart`
				});
			} else {
				// Pending Order (Limit or Stop)
				let orderType: 'limit' | 'stop' = 'limit';
				let price = 0;

				if (preOrder.type === 1) { // Limit
					orderType = 'limit';
					price = preOrder.limitPrice || 0;
				} else if (preOrder.type === 3) { // Stop
					orderType = 'stop';
					price = preOrder.stopPrice || 0;
				} else if (preOrder.type === 4) { // StopLimit
					orderType = 'stop'; // Treat stop-limit as stop
					price = preOrder.limitPrice || 0;
				}

				if (!price || price <= 0) {
					throw new Error('Price is required for pending orders');
				}

				// Place pending order directly via MetaAPI using token from backend
				console.log('[ZuperiorBroker] Placing pending order via direct MetaAPI:', {
					accountId: this._accountId,
					symbol: preOrder.symbol,
					side: side,
					volume: preOrder.qty,
					price: price,
					orderType: orderType,
					stopLoss: preOrder.stopLoss || 0,
					takeProfit: preOrder.takeProfit || 0,
				});
				response = await placePendingOrderDirect({
					accountId: this._accountId,
					accessToken: accessToken,
					symbol: preOrder.symbol,
					side: side,
					volume: preOrder.qty,
					price: price,
					orderType: orderType,
					stopLoss: preOrder.stopLoss || 0,
					takeProfit: preOrder.takeProfit || 0,
					comment: `${side === 'buy' ? 'Buy' : 'Sell'} ${orderType === 'limit' ? 'Limit' : 'Stop'} from Chart`
				});
			}

			if (!response.success) {
				throw new Error(response.message || 'Failed to place order');
			}

			console.log('[ZuperiorBroker] Order placed successfully:', response.data);

			// Get order ID from response
			const orderId = response.data?.OrderId || response.data?.orderId || response.data?.id || response.data?.PositionId || response.data?.positionId || 'unknown';
			const orderIdStr = String(orderId);

			// Create PlacedOrder object as per TradingView documentation
			// This ensures the order appears immediately in the UI via orderUpdate()
			const newOrder: Order = {
				id: orderIdStr,
				symbol: preOrder.symbol,
				qty: preOrder.qty,
				side: preOrder.side || Side.Buy,
				type: preOrder.type || OrderType.Market,
				status: OrderStatus.Working,
				limitPrice: preOrder.limitPrice,
				stopPrice: preOrder.stopPrice,
				takeProfit: preOrder.takeProfit,
				stopLoss: preOrder.stopLoss,
			} as Order;

			// CRITICAL: Add supportModify and supportCancel flags for draggable orders
			// These flags enable dragging order lines and TP/SL lines in the chart
			(newOrder as any).supportModify = true; // Allow dragging order lines and TP/SL
			(newOrder as any).supportCancel = true; // Allow canceling orders

			// Store the order in local storage (as per documentation)
			this._orderById[orderIdStr] = newOrder;
			
			// Add to _orders array if it's not a bracket order
			if (!this._isBracketOrder(newOrder)) {
				this._orders.push(newOrder);
			}

			// Notify the library about the new order so it appears in the UI immediately
			// This is required by TradingView - library waits up to 10 seconds for updates
			if (this._host && typeof this._host.orderUpdate === 'function') {
				this._host.orderUpdate(newOrder);
				console.log('[ZuperiorBroker] Called orderUpdate() for new order:', orderIdStr);
			}

			// Polling will also pick up the order later to sync with backend state
			return { orderId: orderIdStr };
		} catch (error: any) {
			console.error('[ZuperiorBroker] Error placing order:', error);
			throw error;
		}
	}



	public async cancelOrder(orderId: string): Promise<void> {
		if (!this._accountId) {
			throw new Error('No account ID');
		}

		if (!this._getMetaApiToken) {
			throw new Error('MetaAPI token function not available');
		}

		try {
			// Get MetaAPI access token from backend
			const accessToken = await this._getMetaApiToken(this._accountId);
			if (!accessToken) {
				throw new Error('Failed to get MetaAPI access token');
			}

			// Use the same cancelPendingOrderDirect function as the tables for consistency
			// This ensures both chart and table cancellation work the same way
			const response = await cancelPendingOrderDirect({
				orderId: orderId,
					accountId: this._accountId,
				accessToken: accessToken,
				comment: "Cancelled from Chart"
			});

			if (!response.success) {
				throw new Error(response.message || 'Failed to cancel order');
			}

			// Look up the original order using its ID (as per documentation)
			const originalOrder = this._orderById[orderId];
			if (!originalOrder) {
				console.warn('[ZuperiorBroker] Order not found in _orderById:', orderId);
				return;
			}

			// Change order status to canceled (as per documentation)
			originalOrder.status = OrderStatus.Canceled;

			// Remove from _orders array
			const orderIndex = this._orders.findIndex(o => o.id === orderId);
			if (orderIndex >= 0) {
				this._orders.splice(orderIndex, 1);
			}

			// Notify the library about the order update so it appears in the UI immediately
			// This is required by TradingView - library waits up to 10 seconds for updates
			if (this._host && typeof this._host.orderUpdate === 'function') {
				this._host.orderUpdate(originalOrder);
				console.log('[ZuperiorBroker] Called orderUpdate() for canceled order:', orderId);
			}

			// Keep in _orderById with canceled status for reference
			// Polling will eventually remove it when it's no longer in backend
			console.log('[ZuperiorBroker] Order canceled successfully:', orderId);
		} catch (error) {
			console.error('[ZuperiorBroker] Error canceling order:', error);
			throw error;
		}
	}

	public async closePosition(positionId: string): Promise<void> {
		console.log('[ZuperiorBroker] ⚡ closePosition CALLED - Close Button/Context Menu Event:', {
			timestamp: new Date().toISOString(),
			positionId,
			accountId: this._accountId,
		});

		if (!this._accountId) {
			throw new Error('No account ID');
		}

		if (!this._getMetaApiToken) {
			throw new Error('MetaAPI token function not available');
		}

		if (!positionId) {
			throw new Error('Position ID is required');
		}

		try {
			// Get position from cache or positions list
			let position: Position | undefined = this._positionById[positionId];
			if (!position) {
				const positions = await this.positions();
				position = positions.find(p => p.id === positionId);
			}

			if (!position) {
				throw new Error(`Position not found: ${positionId}`);
			}

			// ═══════════════════════════════════════════════════════════════════════════════
			// OPTIMISTIC UPDATE START - Notify TradingView BEFORE API call
			// ═══════════════════════════════════════════════════════════════════════════════

			{
				// CRITICAL: Remove bracket orders (TP/SL lines) before removing position
				// This ensures TP/SL lines disappear immediately when position is closed
				const tpBracketId = `tp_${positionId}`;
				const slBracketId = `sl_${positionId}`;

				// Cancel and remove TP bracket order
				if (this._orderById[tpBracketId]) {
					try {
						const tpBracket = { ...this._orderById[tpBracketId], qty: 0, status: OrderStatus.Canceled };
						if (this._host && typeof this._host.orderUpdate === 'function') {
							this._host.orderUpdate(tpBracket);
						}
						delete this._orderById[tpBracketId];
						console.log('[ZuperiorBroker] 🗑️ closePosition: Removed TP bracket order:', tpBracketId);
					} catch (e) {
						console.warn('[ZuperiorBroker] Could not remove TP bracket:', e);
					}
				}

				// Cancel and remove SL bracket order
				if (this._orderById[slBracketId]) {
					try {
						const slBracket = { ...this._orderById[slBracketId], qty: 0, status: OrderStatus.Canceled };
						if (this._host && typeof this._host.orderUpdate === 'function') {
							this._host.orderUpdate(slBracket);
						}
						delete this._orderById[slBracketId];
						console.log('[ZuperiorBroker] 🗑️ closePosition: Removed SL bracket order:', slBracketId);
					} catch (e) {
						console.warn('[ZuperiorBroker] Could not remove SL bracket:', e);
					}
				}

				// Create closed position object with qty = 0
				const closedPosition: Position = {
					...position,
					qty: 0, // Set qty to 0 to indicate position is closed
				};

				// Remove from cache
				delete this._positionById[positionId];
			const posIndex = this._positions.findIndex(p => p.id === positionId);
			if (posIndex >= 0) {
				this._positions.splice(posIndex, 1);
				}

				console.log('[ZuperiorBroker] 🔄 closePosition: Notifying TradingView of closed position:', {
					id: closedPosition.id,
					symbol: closedPosition.symbol,
					qty: closedPosition.qty,
				});

				// Notify TradingView that position is closed (optimistic update)
				if (this._host && typeof this._host.positionUpdate === 'function') {
					this._host.positionUpdate(closedPosition);
				}

				// Also try to remove the position explicitly (some TradingView versions prefer this)
				try {
					if (this._host && typeof (this._host as any).positionRemove === 'function') {
						(this._host as any).positionRemove(positionId);
						console.log('[ZuperiorBroker] 🗑️ closePosition: Called positionRemove for positionId:', positionId);
					}
				} catch (removeError) {
					// positionRemove might not be available in all TradingView versions
					console.log('[ZuperiorBroker] ℹ️ closePosition: positionRemove not available, using positionUpdate only');
				}
			}

			// ═══════════════════════════════════════════════════════════════════════════════
			// END OPTIMISTIC UPDATE
			// ═══════════════════════════════════════════════════════════════════════════════

			// Get MetaAPI access token from backend
			const accessToken = await this._getMetaApiToken(this._accountId);
			if (!accessToken) {
				throw new Error('Failed to get MetaAPI access token');
			}

			// Get position volume for full close (if volume is 0, we need actual position volume for Trading endpoint)
			// position.qty is in lots format (e.g., 0.01 = 0.01 lot, 1.0 = 1 lot)
			// Trading endpoint expects MT5 format (e.g., 1 = 0.01 lot, 100 = 1 lot)
			// Convert lots to MT5 format: multiply by 100
			const positionVolumeMT5 = position && position.qty ? Math.round(Number(position.qty) * 100) : undefined;

			// Close position directly via MetaAPI using token from backend
			const response = await closePositionDirect({
				positionId: positionId,
				accountId: this._accountId,
				accessToken: accessToken,
				volume: 0, // 0 = full close
				positionVolumeMT5: positionVolumeMT5, // Actual position volume in MT5 format for Trading endpoint fallback
				comment: 'Closed from Chart'
			});

			if (!response.success) {
				throw new Error(response.message || 'Failed to close position');
			}

			console.log('[ZuperiorBroker] ✅ closePosition: Position closed successfully:', {
				positionId,
				symbol: position?.symbol,
			});
		} catch (error) {
			console.error('[ZuperiorBroker] ❌ closePosition error:', {
				error,
				message: error instanceof Error ? error.message : String(error),
				positionId,
				accountId: this._accountId,
				timestamp: new Date().toISOString(),
			});
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
			let position: Position | undefined = this._positionById[positionId];
			if (!position) {
				// Try to get from positions array
				const positions = await this.positions();
				position = positions.find(p => p.id === positionId);
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

			// Call MetaAPI directly using token from backend
			if (!this._getMetaApiToken) {
				console.warn('[ZuperiorBroker] MetaAPI token function not available, attempting to get from context');
				// Try to get token function from window context if available
				if (typeof window !== 'undefined' && (window as any).__GET_METAAPI_TOKEN__) {
					this._getMetaApiToken = (window as any).__GET_METAAPI_TOKEN__;
				} else {
					throw new Error('MetaAPI token function not available. Please ensure you are logged in.');
				}
			}

			if (!this._getMetaApiToken) {
				throw new Error('MetaAPI token function not available');
			}

			const accessToken = await this._getMetaApiToken(this._accountId);
			if (!accessToken) {
				throw new Error('Failed to get MetaAPI access token');
			}

			const METAAPI_BASE_URL = 'https://metaapi.zuperior.com';
			const API_BASE = METAAPI_BASE_URL.endsWith('/api') ? METAAPI_BASE_URL : `${METAAPI_BASE_URL}/api`;
			const modifyUrl = `${API_BASE}/client/position/modify`;

			const payload: any = {
				positionId: parseInt(positionId, 10),
				comment: 'Modified TP/SL from Chart',
			};

			if (finalStopLoss !== undefined && finalStopLoss !== null && Number(finalStopLoss) > 0) {
				payload.stopLoss = Number(finalStopLoss);
			}
			if (finalTakeProfit !== undefined && finalTakeProfit !== null && Number(finalTakeProfit) > 0) {
				payload.takeProfit = Number(finalTakeProfit);
			}

			const response = await fetch(modifyUrl, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					'Authorization': `Bearer ${accessToken}`,
				},
				body: JSON.stringify(payload),
			});

			if (!response.ok) {
				const errorText = await response.text().catch(() => '');
				throw new Error(`Failed to update position brackets: ${response.status} - ${errorText}`);
			}

			// Update local position state
			position.stopLoss = finalStopLoss;
			position.takeProfit = finalTakeProfit;
			this._positionById[positionId] = position;

			// 1. Notify Position Update
			if (this._host && typeof this._host.positionUpdate === 'function') {
				const cleanPosition = this._createCleanPosition(position);
				this._host.positionUpdate(cleanPosition);
			}

			// 2. Handle Take Profit Bracket
			if (finalTakeProfit !== undefined) {
				const tpOrder: Order = {
					id: `tp_${positionId}`,
					symbol: position.symbol,
					qty: position.qty,
					parentId: positionId,
					parentType: ParentType.Position,
					limitPrice: finalTakeProfit,
					side: changeSide(position.side),
					status: OrderStatus.Working, // Must be Working for brackets on position
					type: OrderType.Limit,
				} as Order;

				// Add profit if available (for display on line)
				if ((position as any).pl !== undefined) {
					(tpOrder as any).pl = (position as any).pl;
				}

				this._orderById[tpOrder.id] = tpOrder;
				if (this._host && typeof this._host.orderUpdate === 'function') {
					this._host.orderUpdate(tpOrder);
				}
			} else {
				// If TP removed, we should probably cancel the existing TP bracket if we tracked it
				// For now, we just don't send an update, or we could send Canceled if we knew the ID
				// But since IDs are deterministic (tp_...), we can try to cancel
				const tpId = `tp_${positionId}`;
				if (this._orderById[tpId]) {
					const tpOrder = this._orderById[tpId];
					tpOrder.status = OrderStatus.Canceled;
					if (this._host && typeof this._host.orderUpdate === 'function') {
						this._host.orderUpdate(tpOrder);
					}
					delete this._orderById[tpId];
				}
			}

			// 3. Handle Stop Loss Bracket
			if (finalStopLoss !== undefined) {
				const slOrder: Order = {
					id: `sl_${positionId}`,
					symbol: position.symbol,
					qty: position.qty,
					parentId: positionId,
					parentType: ParentType.Position,
					stopPrice: finalStopLoss,
					price: finalStopLoss, // Required for stop orders sometimes
					side: changeSide(position.side),
					status: OrderStatus.Working, // Must be Working for brackets on position
					type: OrderType.Stop,
				} as Order;

				// Add profit if available
				if ((position as any).pl !== undefined) {
					(slOrder as any).pl = (position as any).pl;
				}

				this._orderById[slOrder.id] = slOrder;
				if (this._host && typeof this._host.orderUpdate === 'function') {
					this._host.orderUpdate(slOrder);
				}
			} else {
				// If SL removed
				const slId = `sl_${positionId}`;
				if (this._orderById[slId]) {
					const slOrder = this._orderById[slId];
					slOrder.status = OrderStatus.Canceled;
					if (this._host && typeof this._host.orderUpdate === 'function') {
						this._host.orderUpdate(slOrder);
					}
					delete this._orderById[slId];
				}
			}

			// Refresh all data to be sure
			this._fetchPositionsAndOrders();

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

	public async editIndividualPositionBrackets(positionId: string, modifiedBrackets: Brackets, customFields?: any): Promise<void> {
		console.log('[ZuperiorBroker] editIndividualPositionBrackets called:', {
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
			// Get current position
			let position: Position | undefined = this._positionById[positionId];
			if (!position) {
				const positions = await this.positions();
				position = positions.find(p => p.id === positionId);
			}

			if (!position) {
				throw new Error('Position not found');
			}

			// Extract bracket values
			const stopLossValue = modifiedBrackets.stopLoss !== undefined && modifiedBrackets.stopLoss !== null && Number(modifiedBrackets.stopLoss) > 0
				? Number(modifiedBrackets.stopLoss)
				: null;
			const takeProfitValue = modifiedBrackets.takeProfit !== undefined && modifiedBrackets.takeProfit !== null && Number(modifiedBrackets.takeProfit) > 0
				? Number(modifiedBrackets.takeProfit)
				: null;

			// Call backend API
			const token = apiClient.getToken();
			const baseURL = process.env.NEXT_PUBLIC_BACKEND_API_URL ||
				(process.env.NEXT_PUBLIC_API_BASE_URL && process.env.NEXT_PUBLIC_API_BASE_URL.includes('localhost')
					? process.env.NEXT_PUBLIC_API_BASE_URL
					: 'http://localhost:5000');

			const response = await fetch(`${baseURL}/api/positions/${positionId}/modify`, {
				method: 'PUT',
				headers: {
					'Content-Type': 'application/json',
					...(token ? { 'Authorization': `Bearer ${token}` } : {}),
				},
				body: JSON.stringify({
					accountId: this._accountId,
					stopLoss: stopLossValue,
					takeProfit: takeProfitValue,
				}),
			});

			if (!response.ok) {
				const errorData = await response.json().catch(() => ({ message: response.statusText }));
				throw new Error(errorData.message || `Failed to update position brackets: ${response.statusText}`);
			}

			// Update position locally
			position.stopLoss = stopLossValue;
			position.takeProfit = takeProfitValue;
			this._positionById[positionId] = position;

			// CRITICAL: Call individualPositionUpdate (not positionUpdate) for individual positions
			if (this._host && typeof this._host.individualPositionUpdate === 'function') {
				const cleanPosition = this._createCleanPosition(position);
				// Convert Position to IndividualPosition by adding required date and price fields
				// IndividualPosition requires: id, date (number), symbol, qty, side, price (number)
				const individualPosition = {
					...cleanPosition,
					date: (position as any).openTime ? new Date((position as any).openTime).getTime() : Date.now(),
					price: cleanPosition.avgPrice,
				} as any; // Type assertion needed as IndividualPosition extends Position with additional fields
				this._host.individualPositionUpdate(individualPosition);
			} else if (this._host && typeof this._host.positionUpdate === 'function') {
				// Fallback to positionUpdate if individualPositionUpdate not available
				const cleanPosition = this._createCleanPosition(position);
				this._host.positionUpdate(cleanPosition);
			}

			// Update bracket orders
			if (takeProfitValue !== null) {
				const tpOrder: Order = {
					id: `tp_${positionId}`,
					symbol: position.symbol,
					qty: position.qty,
					parentId: positionId,
					parentType: ParentType.Position,
					limitPrice: takeProfitValue,
					side: changeSide(position.side),
					status: OrderStatus.Working,
					type: OrderType.Limit,
				} as Order;

				this._orderById[tpOrder.id] = tpOrder;
				if (this._host && typeof this._host.orderUpdate === 'function') {
					this._host.orderUpdate(tpOrder);
				}
			} else {
				// Remove TP bracket
				const tpId = `tp_${positionId}`;
				if (this._orderById[tpId]) {
					const tpOrder = this._orderById[tpId];
					tpOrder.status = OrderStatus.Canceled;
					if (this._host && typeof this._host.orderUpdate === 'function') {
						this._host.orderUpdate(tpOrder);
					}
					delete this._orderById[tpId];
				}
			}

			if (stopLossValue !== null) {
				const slOrder: Order = {
					id: `sl_${positionId}`,
					symbol: position.symbol,
					qty: position.qty,
					parentId: positionId,
					parentType: ParentType.Position,
					stopPrice: stopLossValue,
					price: stopLossValue,
					side: changeSide(position.side),
					status: OrderStatus.Working,
					type: OrderType.Stop,
				} as Order;

				this._orderById[slOrder.id] = slOrder;
				if (this._host && typeof this._host.orderUpdate === 'function') {
					this._host.orderUpdate(slOrder);
				}
			} else {
				// Remove SL bracket
				const slId = `sl_${positionId}`;
				if (this._orderById[slId]) {
					const slOrder = this._orderById[slId];
					slOrder.status = OrderStatus.Canceled;
					if (this._host && typeof this._host.orderUpdate === 'function') {
						this._host.orderUpdate(slOrder);
					}
					delete this._orderById[slId];
				}
			}

		} catch (error) {
			console.error('[ZuperiorBroker] Error editing individual position brackets:', error);
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
		// Define Account Manager columns as per TradingView documentation
		// Using StandardFormatterName and CommonAccountManagerColumnId for consistency
		
		// Order columns - matching documentation example
		const orderColumns = [
			{
				label: 'Symbol',
				formatter: 'symbol' as any,
				id: 'symbol' as any,
				dataFields: ['symbol', 'symbol', 'message'],
			},
			{
				label: 'Side',
				id: 'side',
				dataFields: ['side'],
				formatter: 'side' as any,
			},
			{
				label: 'Type',
				id: 'type',
				dataFields: ['type', 'parentId', 'stopType'],
				formatter: 'type' as any,
			},
			{
				label: 'Qty',
				alignment: 'right' as CellAlignment,
				id: 'qty',
				dataFields: ['qty'],
				formatter: 'formatQuantity' as any,
			},
			{
				label: 'Status',
				id: 'status',
				dataFields: ['status'],
				formatter: 'status' as any,
			},
			{
				label: 'Order ID',
				id: 'id',
				dataFields: ['id'],
			},
		];

		// Position columns - matching documentation example
		const positionColumns = [
			{
				label: 'Symbol',
				formatter: 'symbol' as any,
				id: 'symbol' as any,
				dataFields: ['symbol', 'symbol', 'message'],
			},
			{
				label: 'Side',
				id: 'side',
				dataFields: ['side'],
				formatter: 'side' as any,
			},
			{
				label: 'Qty',
				alignment: 'right' as CellAlignment,
				id: 'qty',
				dataFields: ['qty'],
				formatter: 'formatQuantity' as any,
			},
		];

		const accountInfo: AccountManagerInfo = {
			accountTitle: 'Trading Account',
			summary: [],
			orderColumns: orderColumns,
			positionColumns: positionColumns,
			pages: [], // Required field - empty array if no custom pages
		};

		console.log('[ZuperiorBroker] accountManagerInfo:', {
			accountTitle: accountInfo.accountTitle,
			orderColumnsCount: accountInfo.orderColumns.length,
			positionColumnsCount: accountInfo.positionColumns?.length || 0,
			pagesCount: accountInfo.pages.length,
		});

		return accountInfo;
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
		// Create a clean position object with ALL fields expected by the app's position table
		// This ensures Account Manager displays the same data as the app's position table
		const clean: Position = {
			id: String(position.id),
			symbol: String(position.symbol).toUpperCase(),
			qty: Number(position.qty),
			side: Number(position.side),
			avgPrice: Number(position.avgPrice),
		} as Position;

		// Add ticket field (required by app's position table)
		if ((position as any).ticket !== undefined) {
			(clean as any).ticket = Number((position as any).ticket);
		}

		// Add type field as string (Buy/Sell) - required by app's position table
		if ((position as any).type !== undefined) {
			(clean as any).type = String((position as any).type);
		} else {
			// FIXED: Correct fallback mapping from side to type
			(clean as any).type = position.side === Side.Buy ? 'Buy' : 'Sell';
		}

		// Add volume field (alias for qty) - app uses 'volume'
		(clean as any).volume = Number(position.qty);

		// Add openPrice field (alias for avgPrice) - app uses 'openPrice'
		(clean as any).openPrice = Number(position.avgPrice);

		// Add currentPrice field - required for P&L calculation
		if ((position as any).currentPrice !== undefined) {
			(clean as any).currentPrice = Number((position as any).currentPrice);
		} else if ((position as any).last !== undefined) {
			(clean as any).currentPrice = Number((position as any).last);
		}

		// CRITICAL: Always include takeProfit and stopLoss fields (even if undefined)
		// TradingView needs these fields present to show TP/SL buttons on trade lines
		const takeProfitValue = (position.takeProfit !== undefined && position.takeProfit !== null && typeof position.takeProfit === 'number' && isFinite(position.takeProfit) && position.takeProfit > 0)
			? Number(position.takeProfit)
			: null; // Use null instead of undefined for TradingView brackets
		const stopLossValue = (position.stopLoss !== undefined && position.stopLoss !== null && typeof position.stopLoss === 'number' && isFinite(position.stopLoss) && position.stopLoss > 0)
			? Number(position.stopLoss)
			: null; // Use null instead of undefined for TradingView brackets

		// Explicitly assign to ensure they're enumerable properties
		clean.takeProfit = takeProfitValue;
		clean.stopLoss = stopLossValue;

		// Add profit field - required by app's position table
		if ((position as any).pl !== undefined && (position as any).pl !== null && typeof (position as any).pl === 'number' && isFinite((position as any).pl)) {
			(clean as any).pl = Number((position as any).pl);
			(clean as any).profit = Number((position as any).pl); // App uses 'profit'
		}

		// Add last (current price) field for TradingView
		if ((position as any).last !== undefined && (position as any).last !== null && typeof (position as any).last === 'number' && isFinite((position as any).last)) {
			(clean as any).last = Number((position as any).last);
		}

		// Add swap field - required by app's position table
		if ((position as any).swap !== undefined) {
			(clean as any).swap = Number((position as any).swap || 0);
		}

		// Add commission field - required by app's position table
		if ((position as any).commission !== undefined) {
			(clean as any).commission = Number((position as any).commission || 0);
		}

		// Add comment field - required by app's position table
		if ((position as any).comment !== undefined) {
			(clean as any).comment = String((position as any).comment);
		}

		// Add openTime field - required by app's position table
		if ((position as any).openTime !== undefined) {
			(clean as any).openTime = String((position as any).openTime);
		}

		// Add openTimeInMs field - required by TradingView for proper chart display
		if ((position as any).openTimeInMs !== undefined) {
			(clean as any).openTimeInMs = Number((position as any).openTimeInMs);
		} else if ((position as any).openTime !== undefined) {
			// Convert openTime string to milliseconds if openTimeInMs not available
			try {
				(clean as any).openTimeInMs = new Date((position as any).openTime).getTime();
			} catch (e) {
				(clean as any).openTimeInMs = Date.now();
			}
		}

		// Add positionId field - app uses this
		if ((position as any).positionId !== undefined) {
			(clean as any).positionId = Number((position as any).positionId);
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
			// CRITICAL: First, detect and remove positions that are no longer in openPositions
			// This handles the case when a position is closed from the table
			const currentPositionIds = new Set((openPositions || []).map(p => String(p.ticket ?? p.id ?? '')));
			const positionsToRemove: string[] = [];
			
			// Find positions that exist in our cache but not in the new data
			for (const positionId in this._positionById) {
				if (!currentPositionIds.has(positionId)) {
					positionsToRemove.push(positionId);
				}
			}
			
			// Remove closed positions from chart
			for (const positionId of positionsToRemove) {
				const position = this._positionById[positionId];
				if (position) {
					console.log('[ZuperiorBroker] Removing closed position from chart:', positionId);
					
					// Remove bracket orders (TP/SL)
					const tpBracketId = `tp_${positionId}`;
					const slBracketId = `sl_${positionId}`;
					
					if (this._orderById[tpBracketId]) {
						const tpBracket = { ...this._orderById[tpBracketId], qty: 0, status: OrderStatus.Canceled };
						if (this._host && typeof this._host.orderUpdate === 'function') {
							this._host.orderUpdate(tpBracket);
						}
						delete this._orderById[tpBracketId];
					}
					
					if (this._orderById[slBracketId]) {
						const slBracket = { ...this._orderById[slBracketId], qty: 0, status: OrderStatus.Canceled };
						if (this._host && typeof this._host.orderUpdate === 'function') {
							this._host.orderUpdate(slBracket);
						}
						delete this._orderById[slBracketId];
					}
					
					// Notify TradingView that position is closed
					const closedPosition: Position = {
						...position,
						qty: 0,
					};
					
					if (this._host && typeof this._host.positionUpdate === 'function') {
						this._host.positionUpdate(closedPosition);
					}
					
					// Try positionRemove if available
					try {
						if (this._host && typeof (this._host as any).positionRemove === 'function') {
							(this._host as any).positionRemove(positionId);
						}
					} catch (e) {
						// positionRemove might not be available
					}
					
					// Remove from cache
					delete this._positionById[positionId];
					const posIndex = this._positions.findIndex(p => p.id === positionId);
					if (posIndex >= 0) {
						this._positions.splice(posIndex, 1);
					}
				}
			}

			// 1) Process positions and create bracket orders
			for (const p of openPositions || []) {
				const id = String(p.ticket ?? p.id ?? '');
				if (!id) continue;
				const symbol = String(p.symbol ?? '');

				// FIXED: Correct side mapping to match open positions table
				const typeStr = String(p.type || '');
				const side: Side = typeStr === 'Buy' ? Side.Buy : Side.Sell;

				const rawVolume = Math.abs(Number(p.volume ?? p.qty ?? 0));
				// Divide by 10000 to match open positions table formatting
				const volume = rawVolume / 10000;
				const avgPrice = Number(p.openPrice ?? p.price ?? 0);

				if (volume <= 0 || avgPrice <= 0) continue;

				// FIXED: Extract TP/SL with better validation - only include positive values
				const stopLossRaw = p.stopLoss ?? p.StopLoss ?? p.SL ?? p.sl ??
					p.stop_loss ?? p.Stop_Loss ?? p.stopLossPrice ?? p.StopLossPrice ?? p.PriceSL ?? p.priceSL;
				const stopLossNum = (stopLossRaw !== undefined && stopLossRaw !== null && stopLossRaw !== '' && stopLossRaw !== 0)
					? (typeof stopLossRaw === 'string' ? parseFloat(stopLossRaw) : Number(stopLossRaw))
					: NaN;
				const stopLoss = Number.isFinite(stopLossNum) && stopLossNum > 0 ? stopLossNum : undefined;

				const takeProfitRaw = p.takeProfit ?? p.TakeProfit ?? p.TP ?? p.tp ??
					p.take_profit ?? p.Take_Profit ?? p.takeProfitPrice ?? p.TakeProfitPrice ?? p.PriceTP ?? p.priceTP;
				const takeProfitNum = (takeProfitRaw !== undefined && takeProfitRaw !== null && takeProfitRaw !== '' && takeProfitRaw !== 0)
					? (typeof takeProfitRaw === 'string' ? parseFloat(takeProfitRaw) : Number(takeProfitRaw))
					: NaN;
				const takeProfit = Number.isFinite(takeProfitNum) && takeProfitNum > 0 ? takeProfitNum : undefined;

				// Debug logging to see what we're getting from API
				if (id && (takeProfitRaw !== undefined || stopLossRaw !== undefined)) {
					console.log(`[ZuperiorBroker] syncFromLiveState TP/SL extraction for position ${id}:`, {
						takeProfitRaw,
						takeProfit,
						stopLossRaw,
						stopLoss,
						allPositionKeys: Object.keys(p),
					});
				}

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


				// Set TP/SL fields on position object - use null for TradingView brackets
				position.takeProfit = takeProfit || null;
				position.stopLoss = stopLoss || null;

				// Add all additional fields required by app's position table
				// These fields are extracted from API response to match usePositions hook format

				// ticket field - required by app
				(position as any).ticket = Number(p.ticket) || 0;

				// type field as string (Buy/Sell) - required by app
				(position as any).type = side === Side.Buy ? 'Buy' : 'Sell';

				// volume field (alias for qty) - app uses 'volume'
				(position as any).volume = Number(volume);

				// openPrice field (alias for avgPrice) - app uses 'openPrice'
				(position as any).openPrice = Number(avgPrice);

				// currentPrice field - required for P&L calculation
				(position as any).currentPrice = Number(currentPriceValue);

				// swap field - required by app
				(position as any).swap = Number(p.swap || p.Swap || 0);

				// commission field - required by app
				(position as any).commission = Number(p.commission || p.Commission || 0);

				// comment field - required by app
				(position as any).comment = p.comment || p.Comment || undefined;

				// openTime field - required by app
				const openTime = p.openTime || p.OpenTime || p.TimeCreate || p.timeCreate ||
					p.TimeSetup || p.timeSetup || new Date().toISOString();
				(position as any).openTime = String(openTime);

				// positionId field - app uses this
				(position as any).positionId = Number(p.PositionId || p.positionId || p.ticket) || undefined;

				// Ensure bracket fields are always present (even if null) for TradingView
				if (!('stopLoss' in position)) {
					position.stopLoss = null;
				}
				if (!('takeProfit' in position)) {
					position.takeProfit = null;
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

				// CRITICAL: Update position FIRST with brackets so TradingView can show TP/SL buttons
				// The position must have takeProfit/stopLoss fields set (even if undefined) for buttons to appear
				if (this._isWidgetReady) {
					const cleanPosition = this._createCleanPosition(position);

					// CRITICAL: Store clean position in _positionById BEFORE calling positionUpdate
					// TradingView may call positions() internally during positionUpdate, and it needs
					// to find the position in _positionById with the same structure
					this._positionById[id] = cleanPosition;

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
					// Send bracket orders via orderUpdate() with correct structure
					// According to TradingView docs, bracket orders MUST be sent for chart display and draggability
					// They should have status: Inactive and parentType: ParentType.Position
					if (cleanPosition.takeProfit !== undefined && cleanPosition.takeProfit > 0) {
						try {
							const tpBracket = this._createTakeProfitBracket(cleanPosition);
							// Status is already set correctly by _createTakeProfitBracket (Working for positions, Inactive for orders)
							// Only ensure parentType is set if not already set
							if (tpBracket.parentType === undefined) {
								tpBracket.parentType = ParentType.Position;
							}
							// CRITICAL: Calculate projected P/L at TP price for bracket order
							// TradingView may recalculate P/L based on bracket qty, so we need to set it correctly
							// The bracket order's qty is 0.01 (divided by 10000), but P/L should be calculated using full volume
							// Calculate projected P/L at TP price using FULL volume
							const fullVolume = cleanPosition.qty * 10000; // Get actual volume (qty is divided by 10000)
							const priceDiff = cleanPosition.takeProfit - cleanPosition.avgPrice;
							const plAtTP = priceDiff * fullVolume * (cleanPosition.side === Side.Sell ? -1 : 1);
							
							// CRITICAL: TradingView might recalculate P/L as (priceDiff * qty * pipValue * contractSize)
							// If qty is 0.01 and TradingView divides by 100 somewhere, we need to compensate
							// Since it's showing 0.49 instead of 49 (100x smaller), multiply by 100
							(tpBracket as any).pl = plAtTP * 100;
							
							console.log('[ZuperiorBroker] TP bracket P/L calculation:', {
								bracketId: tpBracket.id,
								limitPrice: cleanPosition.takeProfit,
								avgPrice: cleanPosition.avgPrice,
								priceDiff,
								qty: cleanPosition.qty,
								fullVolume,
								plAtTP,
								plSet: (tpBracket as any).pl,
								positionPL: (cleanPosition as any).pl,
							});
							// CRITICAL: Ensure supportModify is set for draggability
							(tpBracket as any).supportModify = true;
							
							this._orderById[tpBracket.id] = tpBracket;
							// Send via orderUpdate() for chart display
							safeHostCall(this._host, 'orderUpdate', tpBracket);
							console.log('[ZuperiorBroker] Created TP bracket order:', {
								id: tpBracket.id,
								limitPrice: tpBracket.limitPrice,
								status: tpBracket.status,
								parentId: tpBracket.parentId,
								parentType: tpBracket.parentType,
								supportModify: (tpBracket as any).supportModify,
								pl: (tpBracket as any).pl,
							});
						} catch (error) {
							console.error('[ZuperiorBroker] Error creating TP bracket:', error);
						}
					}

					if (cleanPosition.stopLoss !== undefined && cleanPosition.stopLoss > 0) {
						try {
							const slBracket = this._createStopLossBracket(cleanPosition);
							// Status is already set correctly by _createStopLossBracket (Working for positions, Inactive for orders)
							// Only ensure parentType is set if not already set
							if (slBracket.parentType === undefined) {
								slBracket.parentType = ParentType.Position;
							}
							// CRITICAL: Calculate projected P/L at SL price for bracket order
							// TradingView may recalculate P/L based on bracket qty, so we need to set it correctly
							// The bracket order's qty is 0.01 (divided by 10000), but P/L should be calculated using full volume
							// Calculate projected P/L at SL price using FULL volume
							const fullVolume = cleanPosition.qty * 10000; // Get actual volume (qty is divided by 10000)
							const priceDiff = cleanPosition.stopLoss - cleanPosition.avgPrice;
							const plAtSL = priceDiff * fullVolume * (cleanPosition.side === Side.Sell ? -1 : 1);
							
							// CRITICAL: TradingView might recalculate P/L as (priceDiff * qty * pipValue * contractSize)
							// If qty is 0.01 and TradingView divides by 100 somewhere, we need to compensate
							// Since it's showing 0.49 instead of 49 (100x smaller), multiply by 100
							(slBracket as any).pl = plAtSL * 100;
							
							console.log('[ZuperiorBroker] SL bracket P/L calculation:', {
								bracketId: slBracket.id,
								stopPrice: cleanPosition.stopLoss,
								avgPrice: cleanPosition.avgPrice,
								priceDiff,
								qty: cleanPosition.qty,
								fullVolume,
								plAtSL,
								plSet: (slBracket as any).pl,
								positionPL: (cleanPosition as any).pl,
							});
							// CRITICAL: Ensure supportModify is set for draggability
							(slBracket as any).supportModify = true;
							
							this._orderById[slBracket.id] = slBracket;
							// Send via orderUpdate() for chart display
							safeHostCall(this._host, 'orderUpdate', slBracket);
							console.log('[ZuperiorBroker] Created SL bracket order:', {
								id: slBracket.id,
								stopPrice: slBracket.stopPrice,
								status: slBracket.status,
								parentId: slBracket.parentId,
								parentType: slBracket.parentType,
								supportModify: (slBracket as any).supportModify,
								pl: (slBracket as any).pl,
							});
						} catch (error) {
							console.error('[ZuperiorBroker] Error creating SL bracket:', error);
						}
					}
				}
			}

			// 2) Process pending orders
			for (const o of pendingOrders || []) {
				const id = String(o.ticket ?? o.id ?? o.orderId ?? '');
				if (!id || id === '0' || id === 'undefined') continue;

				const symbol = String(o.symbol ?? '');
				if (!symbol) continue;

				// CRITICAL: Detect side and order type from orderType NUMBER, not type string
				// OrderType: 2=Buy Limit, 3=Sell Limit, 4=Buy Stop, 5=Sell Stop
				const orderTypeNum = typeof o.orderType === 'number' ? o.orderType : 
				                     typeof o.Type === 'number' ? o.Type :
				                     typeof o.type === 'number' ? o.type : null;

				// Detect side from orderType number (more reliable than string)
				let side: Side;
				if (orderTypeNum !== null) {
					// OrderType 2,4 = Buy, OrderType 3,5 = Sell
					side = (orderTypeNum === 2 || orderTypeNum === 4) ? Side.Buy : Side.Sell;
				} else {
					// Fallback to type string if orderType number not available
					const typeStr = String(o.type || '').toLowerCase();
					side = (typeStr.includes('sell') || typeStr === '3' || typeStr === '5') ? Side.Sell : Side.Buy;
				}

				// Detect order type (Limit vs Stop)
				let type: OrderType;
				if (orderTypeNum !== null) {
					if (orderTypeNum === 2 || orderTypeNum === 3) {
						type = OrderType.Limit;
					} else if (orderTypeNum === 4 || orderTypeNum === 5) {
						type = OrderType.Stop;
				} else {
					type = OrderType.Market;
					}
				} else {
					// Fallback to type string
					const typeStr = String(o.type || '').toLowerCase();
					if (typeStr.includes('limit')) {
						type = OrderType.Limit;
					} else if (typeStr.includes('stop')) {
						type = OrderType.Stop;
					} else {
						type = OrderType.Market;
					}
				}

				// Convert volume from MT5 format to lots for TradingView
				// MT5 format: 100 = 1 lot, 1 = 0.01 lot
				// TradingView expects volume in lots (e.g., 1.0 = 1 lot)
				// The volume from usePositions hook is in MT5 format (raw from API)
				// So we always divide by 100 to convert to lots
				const rawVolume = Math.abs(Number(o.volume ?? 0));
				const volume = rawVolume / 100; // Always divide by 100 to convert MT5 format to lots

				// Validate volume - must be > 0
				if (volume <= 0 || !isFinite(volume)) {
					console.warn(`[ZuperiorBroker] Invalid volume for pending order ${id}:`, { rawVolume, volume, order: o });
					continue;
				}

				const openPrice = Number(o.openPrice ?? o.price ?? 0);
				if (openPrice <= 0 || !isFinite(openPrice)) {
					console.warn(`[ZuperiorBroker] Invalid price for pending order ${id}:`, { openPrice, order: o });
					continue;
				}

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

				// Debug logging for pending orders to help diagnose issues
				console.log(`[ZuperiorBroker] Processing pending order:`, {
					id,
					symbol,
					orderTypeNum,
					side: side === Side.Buy ? 'Buy' : 'Sell',
					type: type === OrderType.Limit ? 'Limit' : type === OrderType.Stop ? 'Stop' : 'Market',
					rawVolume,
					volume,
					openPrice,
					limitPrice,
					stopPrice,
					originalOrder: o
				});

				this._orderById[id] = order;
				if (this._isWidgetReady) {
					safeHostCall(this._host, 'orderUpdate', order);
				}
			}

			// Update internal arrays
			this._positions.length = 0;
			this._positions.push(...Object.values(this._positionById));
			
			// CRITICAL: Filter out bracket orders (TP/SL) from _orders array
			// _orderById contains ALL orders including brackets for internal tracking,
			// but _orders should only contain real pending orders for Account Manager
			const allOrdersFromMap = Object.values(this._orderById);
			const pendingOrdersOnly = allOrdersFromMap.filter((o: Order) => {
				// PRIMARY FILTER: Only include orders with "Generated-" prefix (real pending orders from backend)
				const orderId = String(o.id);
				if (!orderId.startsWith('Generated-')) {
					return false;
				}
				
				// Additional safety check using helper method
				if (this._isBracketOrder(o)) {
					return false;
				}
				
				return true;
			});
			
			this._orders.length = 0;
			this._orders.push(...pendingOrdersOnly);

			console.log(`[ZuperiorBroker] syncFromLiveState completed: ${this._positions.length} positions, ${pendingOrdersOnly.length} pending orders (filtered from ${allOrdersFromMap.length} total orders)`);
		} catch (error) {
			console.error('[ZuperiorBroker] Error in syncFromLiveState:', error);
		}
	}

	// ============================================================================
	// Bracket Creation Helper Methods
	// ============================================================================

	private _createTakeProfitBracket(entity: Position | Order): Order {
		if (!entity.symbol || typeof entity.symbol !== 'string' || entity.symbol.trim() === '') {
			throw new Error(`Invalid symbol for TP bracket: ${entity.symbol} (entity id: ${entity.id})`);
		}

		// Determine if entity is a Position (has avgPrice) or Order
		// For positions, use ParentType.Position; for orders, use ParentType.Order
		const isPosition = 'avgPrice' in entity;
		
		const bracket: Order = {
			symbol: entity.symbol.trim(),
			qty: entity.qty,
			id: `tp_${entity.id}`,
			parentId: entity.id,
			parentType: isPosition ? ParentType.Position : ParentType.Order,
			limitPrice: entity.takeProfit,
			side: changeSide(entity.side),
			// CRITICAL: Position brackets must use Working status to be draggable
			// Order brackets use Inactive status (correct for pending orders)
			status: isPosition ? OrderStatus.Working : OrderStatus.Inactive,
			type: OrderType.Limit,
		} as Order;

		// CRITICAL: Add supportModify flag to enable dragging bracket lines
		(bracket as any).supportModify = true;

		return bracket;
	}

	private _createStopLossBracket(entity: Position | Order): Order {
		if (!entity.symbol || typeof entity.symbol !== 'string' || entity.symbol.trim() === '') {
			throw new Error(`Invalid symbol for SL bracket: ${entity.symbol} (entity id: ${entity.id})`);
		}

		// Determine if entity is a Position (has avgPrice) or Order
		// For positions, use ParentType.Position; for orders, use ParentType.Order
		const isPosition = 'avgPrice' in entity;
		
		// Reference: stopPrice: entity.stopLoss, price: entity.stopPrice
		// For positions, we set stopPrice = stopLoss before calling this method
		// CRITICAL: Reference uses entity.stopPrice for price field - must match exactly
		// If stopPrice is not set, use stopLoss as fallback to ensure price is always defined
		const stopPriceValue = entity.stopLoss;
		const priceValue = (entity as any).stopPrice !== undefined && (entity as any).stopPrice !== null
			? (entity as any).stopPrice
			: stopPriceValue; // Fallback to stopLoss if stopPrice not set

		const bracket: Order = {
			symbol: entity.symbol.trim(),
			qty: entity.qty,
			id: `sl_${entity.id}`,
			parentId: entity.id,
			parentType: isPosition ? ParentType.Position : ParentType.Order,
			stopPrice: stopPriceValue, // Match reference exactly - no Number() conversion
			price: priceValue, // Match reference exactly - uses entity.stopPrice with fallback to stopLoss
			side: changeSide(entity.side),
			// CRITICAL: Position brackets must use Working status to be draggable
			// Order brackets use Inactive status (correct for pending orders)
			status: isPosition ? OrderStatus.Working : OrderStatus.Inactive,
			type: OrderType.Stop,
		} as Order;

		// CRITICAL FIX: Ensure price is ALWAYS a valid number - TradingView needs this for notifications and chart line
		// Even if entity.stopPrice was set, double-check and ensure price is valid
		if ((bracket as any).price === undefined || (bracket as any).price === null || !Number.isFinite((bracket as any).price)) {
			(bracket as any).price = bracket.stopPrice;
		}

		// CRITICAL: Add supportModify flag to enable dragging bracket lines
		(bracket as any).supportModify = true;

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

		// Update orders array - but only if it's NOT a bracket order
		// Bracket orders should NOT be in _orders array (only in _orderById for internal tracking)
		if (!this._isBracketOrder(order)) {
		const orderIndex = this._orders.findIndex(o => o.id === order.id);
		if (orderIndex >= 0) {
			this._orders[orderIndex] = order;
		} else {
				// Additional validation: only add orders with "Generated-" prefix
				const orderId = String(order.id);
				if (orderId.startsWith('Generated-')) {
			this._orders.push(order);
				} else {
					console.warn('[ZuperiorBroker] Preventing non-Generated order from being added to _orders:', {
						id: order.id,
						symbol: order.symbol,
					});
				}
			}
		} else {
			// If it's a bracket order, remove it from _orders if it exists there
			const orderIndex = this._orders.findIndex(o => o.id === order.id);
			if (orderIndex >= 0) {
				this._orders.splice(orderIndex, 1);
				console.log('[ZuperiorBroker] Removed bracket order from _orders:', {
					id: order.id,
					symbol: order.symbol,
				});
			}
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
					// Update _positionById with clean position before calling positionUpdate
					this._positionById[cleanPosition.id] = cleanPosition;
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
				// Status is already set correctly by _createTakeProfitBracket (Working for positions, Inactive for orders)
				// Only ensure parentType is set if not already set
				if (takeProfitBracket.parentType === undefined) {
				takeProfitBracket.parentType = ParentType.Position;
				}

				if (!takeProfitBracket.symbol || takeProfitBracket.symbol.trim() === '') {
					console.error('[ZuperiorBroker] Cannot create TP bracket - invalid symbol');
					return;
				}

				try {
					this._updateOrder(takeProfitBracket);
					// Update parent position after bracket is created
					if (this._host && typeof this._host.positionUpdate === 'function') {
						const cleanPosition = this._createCleanPosition(parent);
						// Update _positionById with clean position before calling positionUpdate
						this._positionById[cleanPosition.id] = cleanPosition;
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
					// Update _positionById with clean position before calling positionUpdate
					this._positionById[cleanPosition.id] = cleanPosition;
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
				// Status is already set correctly by _createStopLossBracket (Working for positions, Inactive for orders)
				// Only ensure parentType is set if not already set
				if (stopLossBracket.parentType === undefined) {
				stopLossBracket.parentType = ParentType.Position;
				}

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
					// Update _positionById with clean position before calling positionUpdate
					this._positionById[cleanPosition.id] = cleanPosition;
					this._host.positionUpdate(cleanPosition);
				}
			} catch (error) {
				console.error('[ZuperiorBroker] Error updating SL bracket:', error);
			}
			return;
		}
	}
}

