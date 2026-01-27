---
name: Fix TradingView Chart Trade Lines Features
overview: Fix TradingView chart to properly display trade lines with lot size, P/L, close button, draggable TP/SL buttons, TP/SL lines with P/L, pending order lines, and open modify modal when dragging TP/SL buttons.
todos:
  - id: add-support-edit-amount-flag
    content: "Add supportEditAmount: true flag to broker_config in TVChartContainer.tsx"
    status: pending
  - id: implement-deferred-promises
    content: Implement deferred promise pattern for dialog results in TVChartContainer.tsx (like reference implementation)
    status: pending
  - id: fix-show-position-brackets-dialog
    content: Fix showPositionBracketsDialog to properly handle TP/SL dragging and open modify modal
    status: pending
    dependencies:
      - implement-deferred-promises
  - id: verify-position-bracket-fields
    content: Verify positions always have takeProfit/stopLoss fields (even if undefined) in ZuperiorBroker.ts
    status: pending
  - id: fix-bracket-order-creation
    content: Ensure bracket orders are created with correct parentType and status in ZuperiorBroker.ts
    status: pending
  - id: fix-pl-display
    content: Fix P/L display on trade lines and TP/SL lines in ZuperiorBroker.ts
    status: pending
  - id: verify-pending-orders
    content: Verify pending orders display correctly with lot size in ZuperiorBroker.ts
    status: pending
---

# Fix TradingView Chart Trade Lines Features

## Analysis

After comparing the reference implementations (`trading.html`, `trading-custom-ui.html`) with the current implementation, the following issues were identified:

1. **Trade lines missing proper display**: Positions need to have proper bracket fields (takeProfit/stopLoss) set, even if undefined, for TradingView to show TP/SL dragging buttons

2. **TP/SL lines not draggable**: Bracket orders need to be created correctly with proper parent relationships
3. **Pending orders not displaying**: Orders need proper formatting and display

4. **Modify modal not opening on drag**: The `showPositionBracketsDialog` callback needs proper implementation

## Key Differences Found

### Reference Implementation (`trading-custom-ui.html`)

- Uses `BrokerDemo` from broker-sample
- Has `supportPositionBrackets: true` flag

- Has `supportEditAmount: true` flag  
- Implements `showPositionDialog` in customUI (not `showPositionBracketsDialog`)

- Uses deferred promises for dialog results

### Current Implementation

- Uses `ZuperiorBroker` (custom implementation)

- Has `supportPositionBrackets: true` but missing `supportEditAmount`

- Implements both `showPositionDialog` and `showPositionBracketsDialog` in customUI
- Uses Promise.resolve(true) immediately instead of deferred promises

## Implementation Plan

### 1. Fix Broker Configuration Flags

**File**: `zup-updated-terminal/src/components/chart/TVChartContainer.tsx`

- Add `supportEditAmount: true` to broker_config configFlags

- Ensure all required flags are present:
- `supportPositionBrackets: true` ✓ (already present)

- `supportEditAmount: true` ✗ (missing)
- `showQuantityInsteadOfAmount: true` ✓ (already present)

- `supportClosePosition: true` ✓ (already present)

- `supportPLUpdate: true` ✓ (already present)

### 2. Fix Position Display (Trade Lines)

**File**: `zup-updated-terminal/src/components/chart/ZuperiorBroker.ts`

- Ensure positions always have `takeProfit` and `stopLoss` fields (even if undefined)

- Verify `_createCleanPosition` method properly sets bracket fields

- Ensure positions are updated with brackets BEFORE bracket orders are created

- Fix P/L display on trade lines (ensure `pl` field is properly set)

### 3. Fix Bracket Orders (TP/SL Lines)

**File**: `zup-updated-terminal/src/components/chart/ZuperiorBroker.ts`

- Ensure bracket orders have correct `parentType: ParentType.Position`

- Ensure bracket orders have correct `status: OrderStatus.Working` for active positions
- Fix P/L display on TP/SL lines (bracket orders should have `pl` field)

- Ensure bracket orders are created AFTER positions are updated

### 4. Fix Pending Order Display

**File**: `zup-updated-terminal/src/components/chart/ZuperiorBroker.ts`

- Ensure orders have proper `qty` field (lot size)
- Ensure orders have proper `status: OrderStatus.Working`
- Ensure orders are properly formatted and displayed

### 5. Fix Modify Modal on TP/SL Drag

**File**: `zup-updated-terminal/src/components/chart/TVChartContainer.tsx`

- Implement deferred promises pattern (like reference implementation)
- Fix `showPositionBracketsDialog` to properly handle bracket dragging

- Ensure modal opens with correct position and bracket data
- Return promise that resolves when modal is closed

### 6. Update Dialog Promise Handling

**File**: `zup-updated-terminal/src/components/chart/TVChartContainer.tsx`

- Create deferred promise helpers (like reference implementation)
- Store promise resolve/reject functions
- Resolve promises when modify modal is closed

- Handle both `showPositionDialog` and `showPositionBracketsDialog` properly

## Files to Modify

1. `zup-updated-terminal/src/components/chart/TVChartContainer.tsx`

- Add `supportEditAmount` flag
- Implement deferred promises for dialogs

- Fix `showPositionBracketsDialog` implementation

2. `zup-updated-terminal/src/components/chart/ZuperiorBroker.ts`

- Verify position bracket fields are always present
- Ensure correct order of position/bracket updates
- Fix P/L display on trade lines and bracket lines
- Ensure pending orders display correctly

## Testing Checklist

- [ ] Trade lines display with lot size
- [ ] Trade lines display P/L

- [ ] Trade lines have close button

- [ ] Trade lines have draggable TP/SL buttons
- [ ] TP/SL lines are draggable
- [ ] TP/SL lines display P/L
- [ ] Pending orders display with lot size

- [ ] Dragging TP/SL button opens modify modal
- [ ] Modify modal shows correct position data