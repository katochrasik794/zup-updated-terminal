/**
 * Column structure for the "Orders" page
 */
export const ordersPageColumns = [
    {
        label: 'Symbol',
        formatter: 'symbol',
        id: 'symbol',
        dataFields: ['symbol', 'symbol', 'message'],
    },
    {
        label: 'Side',
        id: 'side',
        dataFields: ['side'],
        formatter: 'side',
    },
    {
        label: 'Type',
        id: 'type',
        dataFields: ['type', 'parentId', 'stopType'],
        formatter: 'type',
    },
    {
        label: 'Qty',
        alignment: 'right',
        id: 'qty',
        dataFields: ['qty'],
        help: 'Size in lots',
        formatter: 'formatQuantity',
    },
    {
        label: 'Limit Price',
        alignment: 'right',
        id: 'limitPrice',
        dataFields: ['limitPrice'],
        formatter: 'formatPrice',
    },
    {
        label: 'Stop Price',
        alignment: 'right',
        id: 'stopPrice',
        dataFields: ['stopPrice'],
        formatter: 'formatPrice',
    },
    {
        label: 'Last',
        alignment: 'right',
        id: 'last',
        dataFields: ['last'],
        formatter: 'formatPriceForexSup',
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
        formatter: 'status',
        supportedStatusFilters: [1], // OrderStatusFilter.All
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
export const positionsPageColumns = [
    {
        label: 'Symbol',
        formatter: 'symbol',
        id: 'symbol',
        dataFields: ['symbol', 'symbol', 'message'],
    },
    {
        label: 'Side',
        id: 'side',
        dataFields: ['side'],
        formatter: 'side',
    },
    {
        label: 'Qty',
        alignment: 'right',
        id: 'qty',
        dataFields: ['qty'],
        help: 'Size in lots',
        formatter: 'formatQuantity',
    },
    {
        label: 'Avg Fill Price',
        alignment: 'right',
        id: 'avgPrice',
        dataFields: ['avgPrice'],
        formatter: 'formatPrice',
    },
    {
        label: 'Last',
        alignment: 'right',
        id: 'last',
        dataFields: ['last'],
        formatter: 'formatPriceForexSup',
        highlightDiff: true,
    },
    {
        label: 'Profit',
        alignment: 'right',
        id: 'pl',
        dataFields: ['pl'],
        formatter: 'profit',
    },
    {
        label: 'Stop Loss',
        alignment: 'right',
        id: 'stopLoss',
        dataFields: ['stopLoss'],
        formatter: 'formatPrice',
    },
    {
        label: 'Take Profit',
        alignment: 'right',
        id: 'takeProfit',
        dataFields: ['takeProfit'],
        formatter: 'formatPrice',
    },
];
/**
 * Column structure for the custom "Account Summary" page
 */
export const accountSummaryColumns = [
    {
        label: 'Title',
        notSortable: true,
        id: 'title',
        dataFields: ['title'],
        formatter: 'custom_uppercase',
    },
    {
        label: 'Balance',
        alignment: 'right',
        id: 'balance',
        dataFields: ['balance'],
        formatter: 'fixed',
    },
    {
        label: 'Open PL',
        alignment: 'right',
        id: 'pl',
        dataFields: ['pl'],
        formatter: 'profit',
        notSortable: true,
    },
    {
        label: 'Equity',
        alignment: 'right',
        id: 'equity',
        dataFields: ['equity'],
        formatter: 'fixed',
        notSortable: true,
    },
];
