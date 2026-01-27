/**
 * This file defines the structure of the Account Manager pages: "Orders", "Positions", and "Account Summary".
 * Each Account Manager page is a table, where each column is an `AccountManagerColumnBase` object.
 * These objects are used in the `accountManagerInfo` method which builds the Account Manager.
 */
import {
	AccountManagerColumn,
	OrderTableColumn,
	FormatterName,
} from '../../charting_library/broker-api';

/**
 * Column structure for the "Orders" page
 */
export const ordersPageColumns: OrderTableColumn[] = [
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
		alignment: 'right',
		id: 'qty',
		dataFields: ['qty'],
		help: 'Size in lots',
		formatter: 'formatQuantity' as any,
	},
	{
		label: 'Limit Price',
		alignment: 'right',
		id: 'limitPrice',
		dataFields: ['limitPrice'],
		formatter: 'formatPrice' as any,
	},
	{
		label: 'Stop Price',
		alignment: 'right',
		id: 'stopPrice',
		dataFields: ['stopPrice'],
		formatter: 'formatPrice' as any,
	},
	{
		label: 'Last',
		alignment: 'right',
		id: 'last',
		dataFields: ['last'],
		formatter: 'formatPriceForexSup' as any,
		highlightDiff: true,
	},
	{
		label: 'Execution',
		id: 'execution',
		dataFields: ['execution'],
	},
	{
		label: 'Status',
		id: 'status',
		dataFields: ['status'],
		formatter: 'status' as any,
		supportedStatusFilters: [1 as any], // OrderStatusFilter.All
	},
	{
		label: 'Order ID',
		id: 'id',
		dataFields: ['id'],
	},
];

/**
 * Column structure for the "Positions" page
 */
export const positionsPageColumns: AccountManagerColumn[] = [
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
		alignment: 'right',
		id: 'qty',
		dataFields: ['qty'],
		help: 'Size in lots',
		formatter: 'formatQuantity' as any,
	},
	{
		label: 'Avg Fill Price',
		alignment: 'right',
		id: 'avgPrice',
		dataFields: ['avgPrice'],
		formatter: 'formatPrice' as any,
	},
	{
		label: 'Last',
		alignment: 'right',
		id: 'last',
		dataFields: ['last'],
		formatter: 'formatPriceForexSup' as any,
		highlightDiff: true,
	},
	{
		label: 'Profit',
		alignment: 'right',
		id: 'pl',
		dataFields: ['pl'],
		formatter: 'profit' as any,
	},
	{
		label: 'Stop Loss',
		alignment: 'right',
		id: 'stopLoss',
		dataFields: ['stopLoss'],
		formatter: 'formatPrice' as any,
	},
	{
		label: 'Take Profit',
		alignment: 'right',
		id: 'takeProfit',
		dataFields: ['takeProfit'],
		formatter: 'formatPrice' as any,
	},
];

/**
 * Column structure for the custom "Account Summary" page
 */
export const accountSummaryColumns: AccountManagerColumn[] = [
	{
		label: 'Title',
		notSortable: true,
		id: 'title',
		dataFields: ['title'],
		formatter: 'custom_uppercase' as FormatterName,
	},
	{
		label: 'Balance',
		alignment: 'right',
		id: 'balance',
		dataFields: ['balance'],
		formatter: 'fixed' as any,
	},
	{
		label: 'Open PL',
		alignment: 'right',
		id: 'pl',
		dataFields: ['pl'],
		formatter: 'profit' as any,
		notSortable: true,
	},
	{
		label: 'Equity',
		alignment: 'right',
		id: 'equity',
		dataFields: ['equity'],
		formatter: 'fixed' as any,
		notSortable: true,
	},
];
