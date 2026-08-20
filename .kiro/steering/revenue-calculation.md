# Revenue Calculation — Single Source of Truth

## Rule
Overview "Total Revenue" must always equal:
```
Total Revenue = InvoicesView Total Amount + Sum of all Customer "Total Business"
```

## How Each Part is Calculated

### 1. Direct Invoices (InvoicesView — no customerId)
- Compute from `items` array (strip "Previous Balance · INV-" lines)
- Use `getVarMult(item)`: inventory items (productId set) → multiplier = 1, manual variants → parse variantLabel
- Deduct `_pastReturns` stored on the invoice document

### 2. Customer Invoices (CustomerDetail — has customerId)
- Use `actualAmount` field (saved at creation = real sold items only, no prev-balance carry-forward)
- If `actualAmount` is null/undefined → fall back to `amount` field
- Deduct returns from `payments` collection (`type === "return"`, matched by `invoiceId`)
- Do NOT compute from items for overview — global `invoices` collection items can be incomplete

## Files That Must Stay in Sync
| File | Where used |
|------|-----------|
| `DashboardPage.js` | Overview "Total Revenue" stat card |
| `InvoicesView.js` | Invoices tab "Total Amount" box (`statsTotalAmount`) |
| `CustomersView.js` → `CustomerDetail` | Customer detail "Total Business" box |
| `AnalyticsView.js` | Analytics "Total Revenue" stat card |

## When You Change the Formula
If you change how `totalBusiness` is calculated in `CustomerDetail`, you MUST update:
1. `DashboardPage.js` → `customerTotalBusiness` calculation
2. `AnalyticsView.js` → `getInvActualAmount` for customer invoices

## Key Fields
- `actualAmount` — real sold items only, no prev-balance. Updated on returns by CustomerDetail.
- `amount` — full invoice total including prev-balance carry-forward. Updated on returns.
- `_pastReturns` — array on direct invoices only (InvoicesView returns)
- `payments` collection `type="return"` — customer invoice returns (CustomerDetail returns)
