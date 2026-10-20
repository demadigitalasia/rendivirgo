"use client";

import { useEffect, useMemo, useState } from "react";
import { apiFetch, errorMessage, formatCurrency, formatDateTime, formatNumber, useApi } from "@/components/admin/api";
import { Button, Card, Field, Loading, PageHeader, Select, TextInput } from "@/components/admin/ui";
import "./pos.css";

type PosSettings = { currency: "IDR"; exchangeRate: number | null };
type PosVariant = { id: string; name: string; sku: string; price: number; availableQuantity: number };
type PosProduct = {
  id: string;
  name: string;
  sku: string;
  price: number;
  currency: string;
  stockModel: string;
  availableQuantity: number;
  imageUrl: string | null;
  variants: PosVariant[];
};
type Customer = { id: string; name: string; email: string; phone: string | null };
type CustomerList = { items: Customer[]; total: number };
type CartLine = {
  key: string;
  productId: string;
  variantId?: string;
  name: string;
  sku: string;
  usdPrice: number;
  unitPriceOverrideIdr: string | null;
  quantity: number;
  availableQuantity: number;
};
type Receipt = {
  id: string;
  orderNumber: string;
  currency: string;
  total: number;
  subtotal: number;
  discountTotal: number;
  exchangeRate: number | null;
  customerName: string;
  paymentMethod: string;
  paymentRef: string | null;
  discountReason: string | null;
  paidAt: string | null;
  items: Array<{ name: string; sku: string; quantity: number; unitPrice: number; lineTotal: number }>;
};

const paymentOptions = [
  { value: "Cash", label: "Cash" },
  { value: "BankTransfer", label: "Bank transfer" },
  { value: "QRIS", label: "QRIS" },
];

const idr = (usd: number, rate: number) => {
  const usdCents = Math.round(usd * 100);
  const rateTenThousandths = Math.round(rate * 10_000);
  return Math.floor((usdCents * rateTenThousandths + 500_000) / 1_000_000);
};

const posUnitPriceIdr = (usdPrice: number, rate: number, overrideIdr: string | null | undefined) => {
  if (overrideIdr == null || overrideIdr.trim() === "") return idr(usdPrice, rate);
  const value = Number(overrideIdr);
  return Number.isFinite(value) ? Math.round(value) : 0;
};

export default function AdminPosPage() {
  const settings = useApi<PosSettings>("/api/admin/pos/settings");
  const [exchangeRateInput, setExchangeRateInput] = useState("");
  const [savingRate, setSavingRate] = useState(false);
  const [rateMessage, setRateMessage] = useState<string | null>(null);
  const [rateError, setRateError] = useState<string | null>(null);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [customerSearch, setCustomerSearch] = useState("");
  const [selectedCustomerId, setSelectedCustomerId] = useState("");
  const [selectedVariants, setSelectedVariants] = useState<Record<string, string>>({});
  const [cart, setCart] = useState<CartLine[]>([]);
  const [paymentMethod, setPaymentMethod] = useState("Cash");
  const [paymentRef, setPaymentRef] = useState("");
  const [discountType, setDiscountType] = useState("Percentage");
  const [discountValue, setDiscountValue] = useState("");
  const [discountReason, setDiscountReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [reserving, setReserving] = useState(false);
  const [refreshingReservation, setRefreshingReservation] = useState(false);
  const [reservationId, setReservationId] = useState("");
  const [reservationExpiresAt, setReservationExpiresAt] = useState<string | null>(null);
  const [saleRequestId, setSaleRequestId] = useState("");
  const [saleError, setSaleError] = useState<string | null>(null);
  const [receipt, setReceipt] = useState<Receipt | null>(null);

  useEffect(() => {
    if (settings.data?.exchangeRate != null) setExchangeRateInput(String(settings.data.exchangeRate));
  }, [settings.data?.exchangeRate]);

  useEffect(() => {
    const timer = setTimeout(() => setSearch(searchInput.trim()), 250);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const catalog = useApi<PosProduct[]>(`/api/admin/pos/catalog?search=${encodeURIComponent(search)}`);
  const customers = useApi<CustomerList>(`/api/admin/customers?page=1&pageSize=50&search=${encodeURIComponent(customerSearch)}`);
  const exchangeRate = settings.data?.exchangeRate ?? 0;
  const selectedCustomer = customers.data?.items.find((customer) => customer.id === selectedCustomerId) ?? null;
  const discountAmountInput = Number(discountValue) || 0;
  const hasInvalidPriceOverride = cart.some((item) => {
    if (item.unitPriceOverrideIdr == null) return false;
    if (item.unitPriceOverrideIdr.trim() === "") return true;
    const value = Number(item.unitPriceOverrideIdr);
    return !Number.isInteger(value) || value < 0 || value > 9_999_999_999;
  });

  const totals = useMemo(() => {
    const subtotal = cart.reduce((sum, item) => sum + posUnitPriceIdr(item.usdPrice, exchangeRate, item.unitPriceOverrideIdr) * item.quantity, 0);
    const rawDiscount = discountAmountInput <= 0
      ? 0
      : discountType === "Percentage"
        ? Math.round(subtotal * discountAmountInput / 100)
        : Math.round(discountAmountInput);
    const discount = Math.min(subtotal, Math.max(0, rawDiscount));
    return { subtotal, discount, total: subtotal - discount };
  }, [cart, discountAmountInput, discountType, exchangeRate]);

  const saveRate = async () => {
    const nextRate = Number(exchangeRateInput);
    if (!Number.isFinite(nextRate) || nextRate <= 0) {
      setRateError("Enter a valid USD–IDR rate.");
      setRateMessage(null);
      return;
    }
    setSavingRate(true);
    if (reservationId) await releaseStockHold();
    setRateError(null);
    setRateMessage(null);
    try {
      const saved = await apiFetch<PosSettings>("/api/admin/pos/settings", { method: "PATCH", json: { exchangeRate: nextRate } });
      settings.setData(saved);
      setExchangeRateInput(String(saved.exchangeRate));
      setSaleRequestId("");
      setRateMessage("Exchange rate saved.");
    } catch (error) {
      setRateError(errorMessage(error));
    } finally {
      setSavingRate(false);
    }
  };

  const releaseStockHold = async () => {
    const currentReservationId = reservationId;
    setReservationId("");
    setReservationExpiresAt(null);
    setSaleRequestId("");
    if (!currentReservationId) return;
    try {
      await apiFetch(`/api/admin/pos/reservations/${encodeURIComponent(currentReservationId)}`, { method: "DELETE" });
      catalog.refresh();
    } catch {
      // Server expiry releases a hold if this request cannot reach the API.
    }
  };

  const refreshStockHold = async () => {
    if (!reservationId || refreshingReservation) return;
    setRefreshingReservation(true);
    setSaleError(null);
    try {
      const result = await apiFetch<{ reservationId: string; expiresAt: string }>(
        `/api/admin/pos/reservations/${encodeURIComponent(reservationId)}/refresh`,
        { method: "PATCH" },
      );
      setReservationExpiresAt(result.expiresAt);
    } catch (error) {
      setSaleError(errorMessage(error));
      if (errorMessage(error).toLowerCase().includes("expired")) {
        setReservationId("");
        setReservationExpiresAt(null);
        setSaleRequestId("");
        catalog.refresh();
      }
    } finally {
      setRefreshingReservation(false);
    }
  };

  const reserveStock = async () => {
    if (!cart.length || !exchangeRate || reservationId || reserving || submitting) return;
    setReserving(true);
    setSaleError(null);
    try {
      const requestId = saleRequestId || crypto.randomUUID();
      setSaleRequestId(requestId);
      const result = await apiFetch<{ reservationId: string; expiresAt: string }>("/api/admin/pos/reservations", {
        json: { requestId, items: cart.map((item) => ({ productId: item.productId, variantId: item.variantId, quantity: item.quantity })) },
      });
      setReservationId(result.reservationId);
      setReservationExpiresAt(result.expiresAt);
      catalog.refresh();
    } catch (error) {
      setSaleError(errorMessage(error));
      catalog.refresh();
    } finally {
      setReserving(false);
    }
  };

  const addProduct = (product: PosProduct) => {
    if (reservationId || reserving || submitting) return;
    setSaleRequestId("");
    const variant = product.variants.length
      ? product.variants.find((item) => item.id === selectedVariants[product.id]) ?? product.variants[0]
      : null;
    const key = `${product.id}:${variant?.id ?? ""}`;
    const availableQuantity = variant?.availableQuantity ?? product.availableQuantity;
    const name = variant ? `${product.name} — ${variant.name}` : product.name;
    const sku = variant?.sku ?? product.sku;
    const usdPrice = variant?.price ?? product.price;
    setCart((current) => {
      const existing = current.find((item) => item.key === key);
      if (existing) {
        if (existing.quantity >= availableQuantity) return current;
        return current.map((item) => item.key === key ? { ...item, quantity: item.quantity + 1 } : item);
      }
      return [...current, { key, productId: product.id, variantId: variant?.id, name, sku, usdPrice, unitPriceOverrideIdr: null, quantity: 1, availableQuantity }];
    });
    setSaleError(null);
  };

  const updateQuantity = (key: string, value: number) => {
    if (reservationId || reserving || submitting) return;
    setSaleRequestId("");
    setCart((current) => current.flatMap((item) => {
      if (item.key !== key) return [item];
      if (value < 1) return [];
      return [{ ...item, quantity: Math.min(item.availableQuantity, Math.floor(value)) }];
    }));
  };

  const updateUnitPrice = (key: string, value: string | null) => {
    setSaleRequestId("");
    setSaleError(null);
    setCart((current) => current.map((item) => item.key === key ? { ...item, unitPriceOverrideIdr: value } : item));
  };

  const completeSale = async () => {
    if (!cart.length) return;
    if (!reservationId) {
      setSaleError("Reserve the stock before confirming payment.");
      return;
    }
    if (!exchangeRate) {
      setSaleError("Set the USD–IDR exchange rate first.");
      return;
    }
    if (hasInvalidPriceOverride) {
      setSaleError("Adjusted item prices must be whole IDR amounts.");
      return;
    }
    if (discountAmountInput > 0 && !discountReason.trim()) {
      setSaleError("A reason is required for a manual discount.");
      return;
    }
    setSubmitting(true);
    setSaleError(null);
    try {
      const requestId = saleRequestId || crypto.randomUUID();
      setSaleRequestId(requestId);
      const payload = {
        requestId,
        reservationId,
        exchangeRate,
        customerId: selectedCustomerId || null,
        paymentMethod,
        paymentRef: paymentRef.trim() || undefined,
        ...(discountAmountInput > 0 ? {
          manualDiscountType: discountType,
          manualDiscountValue: discountAmountInput,
          discountReason: discountReason.trim(),
        } : {}),
        items: cart.map((item) => ({
          productId: item.productId,
          variantId: item.variantId,
          quantity: item.quantity,
          expectedUnitPriceIdr: idr(item.usdPrice, exchangeRate),
          ...(item.unitPriceOverrideIdr != null && item.unitPriceOverrideIdr.trim() !== ""
            ? { unitPriceIdr: Number(item.unitPriceOverrideIdr) }
            : {}),
        })),
      };
      const result = await apiFetch<Receipt>("/api/admin/pos/sales", { method: "POST", json: payload });
      setReceipt(result);
      setReservationId("");
      setReservationExpiresAt(null);
      setSaleRequestId("");
      setCart([]);
      setPaymentRef("");
      setDiscountValue("");
      setDiscountReason("");
      setSelectedCustomerId("");
      catalog.refresh();
    } catch (error) {
      setSaleError(errorMessage(error));
      if (errorMessage(error).toLowerCase().includes("hold expired")) {
        setReservationId("");
        setReservationExpiresAt(null);
        setSaleRequestId("");
      }
      catalog.refresh();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="rv-pos-page">
      <PageHeader
        title="Workshop POS"
        subtitle="Build an in-person order, adjust item prices, and confirm payment."
        actions={(
          <div className="rv-pos-rate-control">
            <div className="rv-pos-rate-control__meta">
              <span>USD–IDR rate</span>
              <strong>{exchangeRate ? `1 USD = ${formatNumber(exchangeRate)} IDR` : "Rate not set"}</strong>
            </div>
            <Field label="IDR per USD" className="rv-pos-rate-control__field">
              <TextInput value={exchangeRateInput} onChange={setExchangeRateInput} type="number" min={0.0001} step="0.01" placeholder="For example, 16000" />
            </Field>
            <Button size="sm" variant="primary" loading={savingRate} onClick={() => void saveRate()}>Save rate</Button>
            {rateMessage ? <span className="rv-pos-success">{rateMessage}</span> : null}
            {rateError ? <span className="rv-error-text">{rateError}</span> : null}
          </div>
        )}
      />

      <div className="rv-content rv-pos-content">
        {settings.error ? <Card title="Could not load POS settings"><p className="rv-error-text">{settings.error}</p><Button onClick={settings.refresh}>Try again</Button></Card> : null}

        <div className="rv-pos-layout">
          <Card title="Workshop catalog" description="Only published products enabled for Workshop POS appear here." flush>
            <div className="rv-pos-catalog-tools">
              <Field label="Search products by name or SKU">
                <TextInput value={searchInput} onChange={setSearchInput} placeholder="Search name or SKU" />
              </Field>
            </div>
            {catalog.error ? <p className="rv-error-text rv-pos-inset">{catalog.error}</p> : null}
            {catalog.loading && !catalog.data ? <div className="rv-pos-inset"><Loading label="Loading workshop catalog…" /></div> : null}
            <div className="rv-pos-products">
              {(catalog.data ?? []).map((product) => {
                const variantId = selectedVariants[product.id] || product.variants[0]?.id || "";
                const variant = product.variants.find((item) => item.id === variantId);
                const price = variant?.price ?? product.price;
                const stock = variant?.availableQuantity ?? product.availableQuantity;
                return (
                  <article className="rv-pos-product" key={product.id}>
                    {product.imageUrl ? <img src={product.imageUrl} alt="" /> : <div className="rv-pos-product__placeholder">RV</div>}
                    <div className="rv-pos-product__info">
                      <strong>{product.name}</strong>
                      <span className="rv-hint">{variant?.sku ?? product.sku} · available {formatNumber(stock)}</span>
                      {product.variants.length ? (
                        <Select
                          value={variantId}
                          onChange={(value) => setSelectedVariants((current) => ({ ...current, [product.id]: value }))}
                          disabled={Boolean(reservationId) || reserving || submitting}
                          compact
                          ariaLabel={`Variant for ${product.name}`}
                          options={product.variants.map((item) => ({ value: item.id, label: `${item.name} (${item.sku}) · ${formatNumber(item.availableQuantity)} available` }))}
                        />
                      ) : null}
                      <span className="rv-pos-product__price">{exchangeRate ? formatCurrency(idr(price, exchangeRate), "IDR") : "Set exchange rate"}</span>
                    </div>
                    <Button size="sm" variant="primary" disabled={!exchangeRate || stock <= 0 || Boolean(reservationId) || reserving || submitting} onClick={() => addProduct(product)}>Add</Button>
                  </article>
                );
              })}
              {!catalog.loading && !catalog.error && catalog.data?.length === 0 ? <div className="rv-empty">No available workshop products found.</div> : null}
            </div>
          </Card>

          <div className="rv-pos-checkout">
            <Card title={`Cart · ${cart.length} line(s)`} flush>
              {cart.length ? (
                <div className="rv-table-wrap">
                  <table className="rv-table">
                    <thead><tr><th>Item</th><th>Qty</th><th className="is-num">Total</th><th /></tr></thead>
                    <tbody>
                      {cart.map((item) => (
                        <tr key={item.key}>
                          <td>
                            <strong>{item.name}</strong>
                            <div className="rv-hint">{item.sku}</div>
                            <div className="rv-pos-unit-price">
                              <Field label="Unit price (IDR)" className="rv-pos-unit-price__field">
                                <TextInput
                                  value={item.unitPriceOverrideIdr ?? String(idr(item.usdPrice, exchangeRate))}
                                  onChange={(value) => updateUnitPrice(item.key, value)}
                                  disabled={Boolean(reservationId) || reserving || submitting}
                                  type="number"
                                  min={0}
                                  max={9_999_999_999}
                                  step={1}
                                />
                              </Field>
                              {item.unitPriceOverrideIdr != null ? <Button size="sm" variant="ghost" disabled={Boolean(reservationId) || reserving || submitting} onClick={() => updateUnitPrice(item.key, null)}>Use converted</Button> : null}
                            </div>
                          </td>
                          <td><TextInput value={item.quantity} onChange={(value) => updateQuantity(item.key, Number(value) || 0)} disabled={Boolean(reservationId) || reserving || submitting} type="number" min={1} max={item.availableQuantity} step={1} /></td>
                          <td className="is-num">{formatCurrency(posUnitPriceIdr(item.usdPrice, exchangeRate, item.unitPriceOverrideIdr) * item.quantity, "IDR")}</td>
                          <td><Button size="sm" variant="danger" disabled={Boolean(reservationId) || reserving || submitting} onClick={() => updateQuantity(item.key, 0)}>Remove</Button></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : <div className="rv-pos-inset rv-empty">Add products from the workshop catalog to start a sale.</div>}

              {hasInvalidPriceOverride ? <div className="rv-pos-error" role="alert">Enter a valid whole IDR amount for every adjusted item price.</div> : null}
              <div className="rv-pos-summary">
                <div><span>Subtotal</span><strong>{formatCurrency(totals.subtotal, "IDR")}</strong></div>
                <div><span>Manual discount</span><strong>−{formatCurrency(totals.discount, "IDR")}</strong></div>
                <div className="rv-pos-summary__total"><span>Total due</span><strong>{formatCurrency(totals.total, "IDR")}</strong></div>
              </div>
            </Card>

            <Card title="Checkout details" description="Customer is optional. Record payment details and any order discount here.">
              <div className="rv-pos-detail-grid">
                <Field label="Find customer (optional)"><TextInput value={customerSearch} onChange={setCustomerSearch} placeholder="Search name, email, or phone" /></Field>
                <Field label="Customer" hint={selectedCustomer ? selectedCustomer.phone ?? "No phone on file" : undefined}>
                  <Select
                    value={selectedCustomerId}
                    onChange={(value) => { setSelectedCustomerId(value); setSaleRequestId(""); }}
                    options={(customers.data?.items ?? []).map((customer) => ({ value: customer.id, label: `${customer.name} · ${customer.email}` }))}
                    placeholder="Walk-in customer"
                  />
                </Field>
                <Field label="Payment method"><Select value={paymentMethod} onChange={(value) => { setPaymentMethod(value); setSaleRequestId(""); }} options={paymentOptions} /></Field>
                <Field label="Payment reference (optional)"><TextInput value={paymentRef} onChange={(value) => { setPaymentRef(value); setSaleRequestId(""); }} placeholder="Bank transfer or QRIS reference" /></Field>
                <Field label="Discount type"><Select value={discountType} onChange={(value) => { setDiscountType(value); setSaleRequestId(""); }} options={[{ value: "Percentage", label: "Percentage (%)" }, { value: "Fixed", label: "Fixed amount (IDR)" }]} /></Field>
                <Field label={discountType === "Percentage" ? "Discount percent" : "Discount amount (IDR)"}><TextInput value={discountValue} onChange={(value) => { setDiscountValue(value); setSaleRequestId(""); }} type="number" min={0} max={discountType === "Percentage" ? 100 : undefined} step={discountType === "Percentage" ? 0.01 : 1} /></Field>
                {discountAmountInput > 0 ? <Field label="Discount reason" className="rv-pos-detail-grid__wide"><TextInput value={discountReason} onChange={(value) => { setDiscountReason(value); setSaleRequestId(""); }} placeholder="Required reason" /></Field> : null}
              </div>
            </Card>

            {saleError ? <div className="rv-pos-error" role="alert">{saleError}</div> : null}
            {reservationId ? (
              <div className="rv-inline">
                <Button disabled={submitting || reserving} onClick={() => void releaseStockHold()}>Release stock hold</Button>
                <Button loading={refreshingReservation} disabled={submitting || reserving || refreshingReservation} onClick={() => void refreshStockHold()}>Extend hold 5 minutes</Button>
                <Button variant="primary" loading={submitting} disabled={!cart.length || !exchangeRate || totals.total < 0 || hasInvalidPriceOverride} onClick={() => void completeSale()}>
                  Confirm full payment · {formatCurrency(totals.total, "IDR")}
                </Button>
              </div>
            ) : (
              <Button variant="primary" loading={reserving} disabled={!cart.length || !exchangeRate || totals.total < 0 || hasInvalidPriceOverride || submitting} onClick={() => void reserveStock()}>
                Reserve stock for 5 minutes
              </Button>
            )}
            <div className="rv-hint">
              {reservationId && reservationExpiresAt
                ? `Stock is held until ${formatDateTime(reservationExpiresAt)}. Confirm only after full payment has been received.`
                : "Reserve stock before taking payment. A hold expires after 5 minutes unless extended."}
            </div>
          </div>
        </div>

        {receipt ? (
          <Card title="Sale completed" actions={<div className="rv-inline"><Button size="sm" href={`/admin/orders/${receipt.id}`}>Open order</Button><Button size="sm" variant="primary" onClick={() => window.print()}>Print receipt</Button><Button size="sm" onClick={() => setReceipt(null)}>Close</Button></div>}>
            <article className="rv-pos-receipt">
              <div className="rv-pos-receipt__brand">RENDI VIRGO</div>
              <div className="rv-pos-receipt__title">Workshop receipt</div>
              <div>{receipt.orderNumber}</div>
              <div>{receipt.paidAt ? formatDateTime(receipt.paidAt) : "Paid"}</div>
              <div>Customer: {receipt.customerName}</div>
              <div>Payment: {receipt.paymentMethod}{receipt.paymentRef ? ` · ${receipt.paymentRef}` : ""}</div>
              <hr />
              {receipt.items.map((item, index) => (
                <div className="rv-pos-receipt__item" key={`${item.sku}-${index}`}>
                  <div>{item.name} ({item.sku})</div>
                  <div>{item.quantity} × {formatCurrency(item.unitPrice, "IDR")} <strong>{formatCurrency(item.lineTotal, "IDR")}</strong></div>
                </div>
              ))}
              <hr />
              <div className="rv-pos-receipt__totals"><div><span>Subtotal</span><span>{formatCurrency(receipt.subtotal, "IDR")}</span></div><div><span>Discount</span><span>−{formatCurrency(receipt.discountTotal, "IDR")}</span></div><div className="rv-pos-receipt__grand"><span>Total paid</span><strong>{formatCurrency(receipt.total, "IDR")}</strong></div></div>
              <small>Exchange rate snapshot: 1 USD = {formatNumber(receipt.exchangeRate)} IDR</small>
              {receipt.discountReason ? <small>Discount reason: {receipt.discountReason}</small> : null}
              <div className="rv-pos-receipt__thanks">Thank you for shopping with us.</div>
            </article>
          </Card>
        ) : null}
      </div>
    </div>
  );
}
