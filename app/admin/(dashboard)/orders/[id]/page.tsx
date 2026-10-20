"use client";

import Link from "next/link";
import { use, useEffect, useMemo, useState } from "react";
import { apiFetch, errorMessage, formatCurrency, formatDateTime, formatNumber, useApi } from "@/components/admin/api";
import { allowedOrderStatuses } from "@/components/admin/order-status";
import { toast } from "@/components/admin/toast";
import {
  Badge,
  Button,
  Card,
  Field,
  KeyValue,
  Loading,
  Modal,
  PageHeader,
  Select,
  Stat,
  StatusBadge,
  TextArea,
  TextInput,
} from "@/components/admin/ui";

type OrderItem = {
  id: string;
  productId: string | null;
  variantId: string | null;
  name: string;
  sku: string | null;
  unitPrice: number;
  quantity: number;
  lineTotal: number;
  imageUrl: string | null;
  workshopAllocatedQuantity: number;
};

type OrderEvent = {
  id: string;
  type: string;
  message: string;
  adminId: string | null;
  createdAt: string;
};

type OrderAddress = {
  line1: string | null;
  line2: string | null;
  city: string | null;
  state: string | null;
  postalCode: string | null;
  country: string | null;
  countryCode: string | null;
};

type ReturnRequest = {
  id: string;
  status: "Pending" | "Approved" | "Rejected";
  reason: string;
  details: string;
  hasEvidence: boolean;
  submittedAt: string;
  reviewedAt: string | null;
  adminResponse: string | null;
  reviewedById?: string | null;
  reviewedBy?: { id: string; name: string } | null;
};

type OrderDetail = {
  id: string;
  orderNumber: string;
  customerId: string | null;
  email: string | null;
  customerName: string;
  phone: string | null;
  status: string;
  paymentStatus: string;
  settlementOutcome?: "settled" | "late" | "duplicate" | "review";
  paymentMethod: string | null;
  source: string;
  fulfillmentMethod: string;
  exchangeRate: number | null;
  manualDiscountType: string | null;
  manualDiscountValue: number | null;
  discountReason: string | null;
  paymentRef: string | null;
  paymentProofUploadedAt: string | null;
  currency: string;
  subtotal: number;
  shippingCost: number;
  discountTotal: number;
  taxTotal: number;
  total: number;
  refundedAmount: number;
  discountCode: string | null;
  shippingName: string | null;
  carrier: string | null;
  trackingNumber: string | null;
  trackingUrl: string | null;
  totalWeightGram: number;
  shippingAddress: OrderAddress;
  customerNote: string | null;
  internalNote: string | null;
  placedAt: string;
  paidAt: string | null;
  packedAt: string | null;
  shippedAt: string | null;
  completedAt: string | null;
  cancelledAt: string | null;
  createdAt: string;
  updatedAt: string;
  discount: { id: string; code: string; type: string; value: number } | null;
  customer: { id: string; email: string; name: string; phone: string | null; tags: string[]; acceptsMarketing: boolean } | null;
  items: OrderItem[];
  events: OrderEvent[];
  returnRequests: ReturnRequest[];
};

const eventTypes = [
  { value: "note", label: "Note" },
  { value: "call", label: "Call" },
  { value: "email", label: "Email" },
  { value: "task", label: "Task" },
];

const labelize = (value: string) => value.replace(/([a-z])([A-Z])/g, "$1 $2");

function ShippingAddress({ address }: { address: OrderAddress }) {
  const cityLine = [address.city, address.state, address.postalCode].filter(Boolean).join(", ");
  const countryLine = [address.country, address.countryCode].filter(Boolean).join(" ");
  const lines = [address.line1, address.line2, cityLine, countryLine];
  return (
    <div>
      {lines.map((line, index) =>
        line ? <div key={index}>{line}</div> : null,
      )}
    </div>
  );
}

export default function AdminOrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const state = useApi<OrderDetail>(`/api/admin/orders/${id}`);
  const order = state.data;

  const statusOptions = useMemo(
    () => allowedOrderStatuses(order?.status ?? "New")
      .filter((value) => {
        if (!order || value === order.status) return true;
        if (["Processing", "Packed", "Shipped", "Completed"].includes(value)) return order.paymentStatus === "Paid";
        if (value === "Cancelled" && ["Paid", "PartiallyRefunded"].includes(order.paymentStatus)) return false;
        return true;
      })
      .map((value) => ({ value, label: labelize(value) })),
    [order?.status, order?.paymentStatus],
  );

  const [status, setStatus] = useState("");
  const [carrier, setCarrier] = useState("");
  const [trackingNumber, setTrackingNumber] = useState("");
  const [trackingUrl, setTrackingUrl] = useState("");
  const [internalNote, setInternalNote] = useState("");
  const [savingStatus, setSavingStatus] = useState(false);
  const [confirmingPayment, setConfirmingPayment] = useState(false);
  const [restockingReturnedInventory, setRestockingReturnedInventory] = useState(false);
  const [savingFulfilment, setSavingFulfilment] = useState(false);
  const [eventMessage, setEventMessage] = useState("");
  const [eventType, setEventType] = useState("note");
  const [addingEvent, setAddingEvent] = useState(false);
  const [refundOpen, setRefundOpen] = useState(false);
  const [refundAmount, setRefundAmount] = useState("");
  const [refundReason, setRefundReason] = useState("");
  const [refundExternalReference, setRefundExternalReference] = useState("");
  const [refundError, setRefundError] = useState<string | null>(null);
  const [refunding, setRefunding] = useState(false);
  const [reviewingReturnId, setReviewingReturnId] = useState<string | null>(null);

  useEffect(() => {
    if (!order) return;
    setStatus(order.status);
    setCarrier(order.carrier ?? "");
    setTrackingNumber(order.trackingNumber ?? "");
    setTrackingUrl(order.trackingUrl ?? "");
    setInternalNote(order.internalNote ?? "");
  }, [order]);

  const saveOrder = async (payload: Record<string, unknown>, message: string) => {
    const updated = await apiFetch<OrderDetail>(`/api/admin/orders/${id}`, { method: "PATCH", json: payload });
    state.setData(updated);
    toast.success(message);
  };

  const saveStatus = async () => {
    if (!order || status === order.status) return;
    setSavingStatus(true);
    try {
      const updated =
        status === "Cancelled"
          ? await apiFetch<OrderDetail>("/api/admin/orders/" + id + "/cancel", { method: "POST" })
          : status === "Returned"
            ? await apiFetch<OrderDetail>("/api/admin/orders/" + id + "/return", { method: "POST" })
            : await apiFetch<OrderDetail>("/api/admin/orders/" + id + "/fulfillment", {
                method: "PATCH",
                json: { status },
              });
      state.setData(updated);
      toast.success("Order status updated");
    } catch (caught) {
      toast.error(errorMessage(caught));
    } finally {
      setSavingStatus(false);
    }
  };

  const confirmManualPayment = async () => {
    setConfirmingPayment(true);
    try {
      const updated = await apiFetch<OrderDetail>("/api/admin/orders/" + id + "/confirm-payment", { method: "POST" });
      state.setData(updated);
      if (updated.settlementOutcome === "late" || updated.settlementOutcome === "review") {
        toast.error("Payment needs manual review; check the order timeline");
      } else {
        toast.success("Payment confirmation recorded");
      }
    } catch (caught) {
      toast.error(errorMessage(caught));
    } finally {
      setConfirmingPayment(false);
    }
  };

  const restockReturnedItems = async () => {
    setRestockingReturnedInventory(true);
    try {
      const updated = await apiFetch<OrderDetail>(`/api/admin/orders/${id}/restock-return`, { method: "POST" });
      state.setData(updated);
      toast.success("Inspected returned items added back to inventory");
    } catch (caught) {
      toast.error(errorMessage(caught));
    } finally {
      setRestockingReturnedInventory(false);
    }
  };

  const saveFulfilment = async () => {
    setSavingFulfilment(true);
    try {
      await saveOrder(
        {
          carrier: carrier.trim() || null,
          trackingNumber: trackingNumber.trim() || null,
          trackingUrl: trackingUrl.trim() || null,
          internalNote: internalNote.trim() || null,
        },
        "Fulfilment details saved",
      );
    } catch (caught) {
      toast.error(errorMessage(caught));
    } finally {
      setSavingFulfilment(false);
    }
  };

  const addEvent = async () => {
    if (!eventMessage.trim()) {
      toast.error("Write a message before adding the note");
      return;
    }
    setAddingEvent(true);
    try {
      const created = await apiFetch<OrderEvent>(`/api/admin/orders/${id}/events`, {
        method: "POST",
        json: { message: eventMessage.trim(), type: eventType || undefined },
      });
      state.setData((current) => (current ? { ...current, events: [created, ...current.events] } : current));
      setEventMessage("");
      toast.success("Note added");
    } catch (caught) {
      toast.error(errorMessage(caught));
    } finally {
      setAddingEvent(false);
    }
  };

  const refundable = order ? Math.max(0, order.total - order.refundedAmount) : 0;
  const canConfirmManualPayment =
    Boolean(order && ["BankTransfer", "Manual"].includes(order.paymentMethod ?? "")) &&
    Boolean(
      order &&
        ((order.paymentStatus === "Pending" && !["Cancelled", "Returned"].includes(order.status)) ||
          (order.status === "Cancelled" && order.paymentStatus === "Failed")),
    );

  const openRefund = () => {
    setRefundError(null);
    setRefundAmount(refundable > 0 ? refundable.toFixed(2) : "");
    setRefundReason("");
    setRefundExternalReference("");
    setRefundOpen(true);
  };

  const submitRefund = async () => {
    const amount = Number(refundAmount);
    if (!Number.isFinite(amount) || amount <= 0) {
      setRefundError("Enter an amount greater than zero");
      return;
    }
    setRefunding(true);
    setRefundError(null);
    try {
      const updated = await apiFetch<OrderDetail>(`/api/admin/orders/${id}/refund`, {
        method: "POST",
        json: {
          amount,
          reason: refundReason.trim() || undefined,
          externalReference: refundExternalReference.trim() || undefined,
        },
      });
      state.setData(updated);
      setRefundOpen(false);
      setRefundAmount("");
      setRefundReason("");
      setRefundExternalReference("");
      toast.success(`Refund record added for ${formatCurrency(amount, order?.currency)}`);
    } catch (caught) {
      setRefundError(errorMessage(caught));
    } finally {
      setRefunding(false);
    }
  };

  const reviewReturnRequest = async (request: ReturnRequest, status: "Approved" | "Rejected") => {
    setReviewingReturnId(request.id);
    try {
      const reviewed = await apiFetch<ReturnRequest>(`/api/admin/orders/${id}/return-requests/${request.id}`, {
        method: "PATCH",
        json: { status },
      });
      state.setData((current) => current ? {
        ...current,
        returnRequests: current.returnRequests.map((entry) => entry.id === reviewed.id ? { ...entry, ...reviewed } : entry),
      } : current);
      toast.success(`Return request ${status.toLowerCase()}`);
    } catch (caught) {
      toast.error(errorMessage(caught));
    } finally {
      setReviewingReturnId(null);
    }
  };

  const dateEntries = order
    ? [
        { label: "Placed", value: formatDateTime(order.placedAt) },
        { label: "Paid", value: order.paidAt ? formatDateTime(order.paidAt) : "—" },
        { label: "Packed", value: order.packedAt ? formatDateTime(order.packedAt) : "—" },
        { label: "Shipped", value: order.shippedAt ? formatDateTime(order.shippedAt) : "—" },
        { label: "Completed", value: order.completedAt ? formatDateTime(order.completedAt) : "—" },
        { label: "Cancelled", value: order.cancelledAt ? formatDateTime(order.cancelledAt) : "—" },
      ]
    : [];

  return (
    <>
      <PageHeader
        title={order ? order.orderNumber : "Order"}
        subtitle={order ? `${order.customerName} · placed ${formatDateTime(order.placedAt)}` : "Loading order…"}
        actions={
          <div className="rv-inline">
            <Button size="sm" href="/admin/orders">
              Back to orders
            </Button>
            <Button size="sm" onClick={() => window.open(`/admin/orders/${id}/invoice`, "_blank", "noopener")}>
              {order?.source === "POS" ? "Print receipt" : "Print invoice"}
            </Button>
            <Button size="sm" variant="danger" disabled={!order || refundable <= 0} onClick={openRefund}>
              Refund
            </Button>
          </div>
        }
      />

      <div className="rv-content">
        {state.loading && !order ? (
          <Card>
            <Loading label="Loading order…" />
          </Card>
        ) : null}

        {state.error ? (
          <Card title="Could not load order">
            <p className="rv-error-text">{state.error}</p>
            <div style={{ marginTop: 14 }}>
              <Button onClick={state.refresh}>Try again</Button>
            </div>
          </Card>
        ) : null}

        {order ? (
          <>
            <div className="rv-stat-grid">
              <Stat label="Total" value={formatCurrency(order.total, order.currency)} hint={`${order.items.length} line item(s) · ${order.source === "POS" ? "Workshop POS" : order.source}`} />
              <Stat
                label="Payment"
                value={<StatusBadge status={order.paymentStatus} />}
                hint={order.paymentMethod ?? "Payment method not set"}
              />
              <Stat
                label="Refunded"
                value={formatCurrency(order.refundedAmount, order.currency)}
                hint={refundable > 0 ? `${formatCurrency(refundable, order.currency)} refundable` : "Nothing left to refund"}
              />
              <Stat
                label="Status"
                value={<StatusBadge status={order.status} />}
                hint={order.paidAt ? `Paid ${formatDateTime(order.paidAt)}` : "Not paid yet"}
              />
            </div>

            <div className="rv-split">
              <div className="rv-stack">
                <Card title="Items" flush>
                  <div className="rv-table-wrap">
                    <table className="rv-table">
                      <thead>
                        <tr>
                          <th>Item</th>
                          <th>Qty</th>
                          <th>Unit price</th>
                          <th>Total</th>
                        </tr>
                      </thead>
                      <tbody>
                        {order.items.map((item) => (
                          <tr key={item.id}>
                            <td>
                              <div>{item.name}</div>
                              <div className="rv-hint">{item.sku ?? "—"}</div>
                            </td>
                            <td>{item.quantity}</td>
                            <td>{formatCurrency(item.unitPrice, order.currency)}</td>
                            <td>{formatCurrency(item.lineTotal, order.currency)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </Card>

                <Card title="Cost summary">
                  <KeyValue
                    entries={[
                      { label: "Subtotal", value: formatCurrency(order.subtotal, order.currency) },
                      {
                        label: order.discountCode
                          ? `Discount (${order.discountCode})`
                          : order.manualDiscountType === "Percentage"
                            ? `Manual discount (${formatNumber(order.manualDiscountValue)}%)`
                            : "Discount",
                        value: order.discountTotal ? `-${formatCurrency(order.discountTotal, order.currency)}` : formatCurrency(0, order.currency),
                      },
                      ...(order.discountReason ? [{ label: "Discount reason", value: order.discountReason }] : []),
                      ...(order.source === "POS" && order.exchangeRate ? [{ label: "USD–IDR rate snapshot", value: `1 USD = ${formatNumber(order.exchangeRate)} IDR` }] : []),
                      ...(order.source === "POS" ? [{ label: "Fulfillment", value: "Collected at workshop" }] : []),
                      { label: "Shipping", value: formatCurrency(order.shippingCost, order.currency) },
                      { label: "Total", value: <strong>{formatCurrency(order.total, order.currency)}</strong> },
                      { label: "Refunded", value: order.refundedAmount ? `-${formatCurrency(order.refundedAmount, order.currency)}` : formatCurrency(0, order.currency) },
                    ]}
                  />
                </Card>

                <Card title="Customer note">
                  {order.customerNote ? <p>{order.customerNote}</p> : <p className="rv-hint">No note left by the customer.</p>}
                </Card>

                <Card title="Activity" description="Newest first">
                  <div className="rv-stack">
                    <div className="rv-stack">
                      <TextArea value={eventMessage} onChange={setEventMessage} rows={3} placeholder="Add an internal note…" />
                      <div className="rv-inline">
                        <div style={{ width: 170 }}>
                          <Select value={eventType} onChange={setEventType} options={eventTypes} />
                        </div>
                        <Button variant="primary" size="sm" loading={addingEvent} onClick={addEvent}>
                          Add note
                        </Button>
                      </div>
                    </div>

                    {order.events.length ? (
                      <div className="rv-timeline">
                        {order.events.map((event) => (
                          <div className="rv-timeline__item" key={event.id}>
                            <span className="rv-timeline__dot" />
                            <div>
                              <div className="rv-inline">
                                <Badge>{event.type}</Badge>
                                <span className="rv-hint">{formatDateTime(event.createdAt)}</span>
                              </div>
                              <p>{event.message}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="rv-hint">No activity recorded yet.</p>
                    )}
                  </div>
                </Card>
              </div>

              <div className="rv-stack">
                <Card title="Order status">
                  <div className="rv-stack">
                    <Field label="Status">
                      <Select value={status} onChange={setStatus} options={statusOptions} />
                    </Field>
                    {order.paymentStatus !== "Paid" && !["Cancelled", "Returned"].includes(order.status) ? (
                      <p className="rv-hint">Confirm payment before moving this order into fulfilment.</p>
                    ) : null}
                    {["Paid", "PartiallyRefunded"].includes(order.paymentStatus) && !["Cancelled", "Returned"].includes(order.status) ? (
                      <p className="rv-hint">Record the full refund before cancelling a paid order.</p>
                    ) : null}
                    <Button variant="primary" loading={savingStatus} onClick={saveStatus}>
                      Save status
                    </Button>
                    {canConfirmManualPayment ? (
                      <Button loading={confirmingPayment} onClick={confirmManualPayment}>
                        {order?.status === "Cancelled" ? "Record late payment for review" : "Confirm payment"}
                      </Button>
                    ) : null}
                    {order.status === "Returned" ? (
                      order.events.some((event) => event.type === "inventory-restock") ? (
                        <p className="rv-hint">Returned items were inspected and restocked.</p>
                      ) : (
                        <>
                          <p className="rv-hint">Returned items remain unavailable until they are inspected. Restock only after confirming their condition.</p>
                          <Button loading={restockingReturnedInventory} onClick={restockReturnedItems}>
                            Restock inspected items
                          </Button>
                        </>
                      )
                    ) : null}
                  </div>
                </Card>

                <Card title="Fulfilment">
                  <div className="rv-stack">
                    <Field label="Carrier">
                      <TextInput value={carrier} onChange={setCarrier} placeholder="DHL Express" />
                    </Field>
                    <Field label="Tracking number">
                      <TextInput value={trackingNumber} onChange={setTrackingNumber} placeholder="JD0140…" />
                    </Field>
                    <Field label="Tracking URL">
                      <TextInput value={trackingUrl} onChange={setTrackingUrl} placeholder="https://…" />
                    </Field>
                    <Field label="Internal note">
                      <TextArea value={internalNote} onChange={setInternalNote} rows={4} placeholder="Only visible to the team" />
                    </Field>
                    <Button variant="primary" loading={savingFulfilment} onClick={saveFulfilment}>
                      Save fulfilment
                    </Button>
                  </div>
                </Card>

                {order.paymentMethod === "BankTransfer" && order.paymentProofUploadedAt ? (
                  <Card title="Bank transfer receipt" description={`Uploaded ${formatDateTime(order.paymentProofUploadedAt)}`}>
                    <a
                      href={`/api/payments/admin/orders/${encodeURIComponent(order.id)}/bank-transfer-proof`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      <img
                        src={`/api/payments/admin/orders/${encodeURIComponent(order.id)}/bank-transfer-proof`}
                        alt={`Bank transfer receipt for ${order.orderNumber}`}
                        style={{ display: "block", width: "100%", maxHeight: 460, objectFit: "contain", background: "#f4f4f4" }}
                      />
                    </a>
                  </Card>
                ) : order.paymentMethod === "BankTransfer" ? (
                  <Card title="Bank transfer receipt">
                    <p className="rv-hint">The customer has not uploaded a receipt yet.</p>
                  </Card>
                ) : null}

                {order.returnRequests.length ? (
                  <Card title="Customer return requests" description="Review the customer's reason and evidence before changing the order status.">
                    <div className="rv-stack">
                      {order.returnRequests.map((request) => (
                        <div key={request.id} className="rv-stack" style={{ paddingTop: 12 }}>
                          <div className="rv-inline" style={{ justifyContent: "space-between" }}>
                            <strong>{labelize(request.reason)}</strong>
                            <StatusBadge status={request.status} />
                          </div>
                          <p className="rv-hint">Submitted {formatDateTime(request.submittedAt)}</p>
                          <p style={{ whiteSpace: "pre-wrap" }}>{request.details}</p>
                          {request.adminResponse ? <p className="rv-hint">Admin response: {request.adminResponse}</p> : null}
                          {request.hasEvidence ? (
                            <a href={`/api/admin/orders/${encodeURIComponent(order.id)}/return-requests/${encodeURIComponent(request.id)}/evidence`} target="_blank" rel="noreferrer">
                              View customer evidence
                            </a>
                          ) : null}
                          {request.status === "Pending" ? (
                            <div className="rv-inline" style={{ marginTop: 12 }}>
                              <Button size="sm" variant="primary" loading={reviewingReturnId === request.id} onClick={() => void reviewReturnRequest(request, "Approved")}>Approve</Button>
                              <Button size="sm" variant="danger" disabled={reviewingReturnId === request.id} onClick={() => void reviewReturnRequest(request, "Rejected")}>Reject</Button>
                            </div>
                          ) : null}
                        </div>
                      ))}
                    </div>
                  </Card>
                ) : null}

                <Card title="Customer">
                  <KeyValue
                    entries={[
                      { label: "Name", value: order.customerName },
                      { label: "Email", value: order.email ? <a href={`mailto:${order.email}`}>{order.email}</a> : "—" },
                      { label: "Phone", value: order.phone ?? "—" },
                      {
                        label: "Marketing",
                        value: order.customer?.acceptsMarketing ? "Opted in" : "Not opted in",
                      },
                      {
                        label: "Tags",
                        value: order.customer?.tags.length ? (
                          <div className="rv-inline">
                            {order.customer.tags.map((tag) => (
                              <Badge key={tag}>{tag}</Badge>
                            ))}
                          </div>
                        ) : (
                          "—"
                        ),
                      },
                    ]}
                  />
                  {order.customerId ? (
                    <div style={{ marginTop: 14 }}>
                      <Link className="rv-btn rv-btn--sm" href={`/admin/customers/${order.customerId}`}>
                        View customer
                      </Link>
                    </div>
                  ) : null}
                </Card>

                <Card title="Shipping">
                  <KeyValue
                    entries={[
                      { label: "Rate", value: order.shippingName ?? "—" },
                      { label: "Address", value: <ShippingAddress address={order.shippingAddress} /> },
                    ]}
                  />
                </Card>

                <Card title="Dates">
                  <KeyValue entries={dateEntries} />
                </Card>
              </div>
            </div>
          </>
        ) : null}
      </div>

      <Modal
        open={refundOpen}
        title="Refund order"
        onClose={() => setRefundOpen(false)}
        footer={
          <>
            <Button onClick={() => setRefundOpen(false)}>Cancel</Button>
            <Button variant="danger" loading={refunding} onClick={submitRefund}>
              Refund
            </Button>
          </>
        }
      >
        <div className="rv-stack">
          <p className="rv-hint">This records a refund amount on the order. It does not send money to PayPal or your bank. {formatCurrency(refundable, order?.currency)} remains available to record.</p>
          <Field label="Amount" hint={order?.currency ?? "USD"}>
            <TextInput
              type="number"
              value={refundAmount}
              onChange={setRefundAmount}
              min={order?.currency === "IDR" ? 1 : 0.01}
              max={refundable}
              step={order?.currency === "IDR" ? 1 : 0.01}
            />
          </Field>
          <Field label="Reason">
            <TextArea value={refundReason} onChange={setRefundReason} rows={3} placeholder="Damaged on arrival" />
          </Field>
          <Field label="External transfer reference (optional)">
            <TextInput value={refundExternalReference} onChange={setRefundExternalReference} placeholder="Bank transaction or provider reference" />
          </Field>
          {refundError ? <p className="rv-error-text">{refundError}</p> : null}
        </div>
      </Modal>
    </>
  );
}
