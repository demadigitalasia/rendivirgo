"use client";

import Link from "next/link";
import { use, useEffect, useState } from "react";
import { apiFetch, errorMessage, formatDateTime, formatUSD, useApi } from "@/components/admin/api";
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

type OrderDetail = {
  id: string;
  orderNumber: string;
  customerId: string | null;
  email: string;
  customerName: string;
  phone: string | null;
  status: string;
  paymentStatus: string;
  paymentMethod: string | null;
  paymentRef: string | null;
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
};

const orderStatuses = ["New", "Processing", "Packed", "Shipped", "Completed", "Cancelled", "Returned"];

const paymentStatuses = ["Pending", "Paid", "Failed", "Refunded", "PartiallyRefunded"];

const eventTypes = [
  { value: "note", label: "Note" },
  { value: "call", label: "Call" },
  { value: "email", label: "Email" },
  { value: "task", label: "Task" },
];

const labelize = (value: string) => value.replace(/([a-z])([A-Z])/g, "$1 $2");

const statusOptions = orderStatuses.map((value) => ({ value, label: labelize(value) }));

const paymentOptions = paymentStatuses.map((value) => ({ value, label: labelize(value) }));

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

  const [status, setStatus] = useState("");
  const [paymentStatus, setPaymentStatus] = useState("");
  const [carrier, setCarrier] = useState("");
  const [trackingNumber, setTrackingNumber] = useState("");
  const [trackingUrl, setTrackingUrl] = useState("");
  const [internalNote, setInternalNote] = useState("");
  const [savingStatus, setSavingStatus] = useState(false);
  const [savingFulfilment, setSavingFulfilment] = useState(false);
  const [eventMessage, setEventMessage] = useState("");
  const [eventType, setEventType] = useState("note");
  const [addingEvent, setAddingEvent] = useState(false);
  const [refundOpen, setRefundOpen] = useState(false);
  const [refundAmount, setRefundAmount] = useState("");
  const [refundReason, setRefundReason] = useState("");
  const [refundError, setRefundError] = useState<string | null>(null);
  const [refunding, setRefunding] = useState(false);

  useEffect(() => {
    if (!order) return;
    setStatus(order.status);
    setPaymentStatus(order.paymentStatus);
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
    setSavingStatus(true);
    try {
      await saveOrder({ status, paymentStatus }, "Order status updated");
    } catch (caught) {
      toast.error(errorMessage(caught));
    } finally {
      setSavingStatus(false);
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

  const openRefund = () => {
    setRefundError(null);
    setRefundAmount(refundable > 0 ? refundable.toFixed(2) : "");
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
        json: { amount, reason: refundReason.trim() || undefined },
      });
      state.setData(updated);
      setRefundOpen(false);
      setRefundAmount("");
      setRefundReason("");
      toast.success(`Refunded ${formatUSD(amount)}`);
    } catch (caught) {
      setRefundError(errorMessage(caught));
    } finally {
      setRefunding(false);
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
              Print invoice
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
              <Stat label="Total" value={formatUSD(order.total)} hint={`${order.items.length} line item(s)`} />
              <Stat
                label="Payment"
                value={<StatusBadge status={order.paymentStatus} />}
                hint={order.paymentMethod ?? "Payment method not set"}
              />
              <Stat
                label="Refunded"
                value={formatUSD(order.refundedAmount)}
                hint={refundable > 0 ? `${formatUSD(refundable)} refundable` : "Nothing left to refund"}
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
                            <td>{formatUSD(item.unitPrice)}</td>
                            <td>{formatUSD(item.lineTotal)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </Card>

                <Card title="Cost summary">
                  <KeyValue
                    entries={[
                      { label: "Subtotal", value: formatUSD(order.subtotal) },
                      {
                        label: order.discountCode ? `Discount (${order.discountCode})` : "Discount",
                        value: order.discountTotal ? `-${formatUSD(order.discountTotal)}` : formatUSD(0),
                      },
                      { label: "Shipping", value: formatUSD(order.shippingCost) },
                      { label: "Total", value: <strong>{formatUSD(order.total)}</strong> },
                      { label: "Refunded", value: order.refundedAmount ? `-${formatUSD(order.refundedAmount)}` : formatUSD(0) },
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
                    <Field label="Payment status">
                      <Select value={paymentStatus} onChange={setPaymentStatus} options={paymentOptions} />
                    </Field>
                    <Button variant="primary" loading={savingStatus} onClick={saveStatus}>
                      Save status
                    </Button>
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

                <Card title="Customer">
                  <KeyValue
                    entries={[
                      { label: "Name", value: order.customerName },
                      { label: "Email", value: <a href={`mailto:${order.email}`}>{order.email}</a> },
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
          <p className="rv-hint">{formatUSD(refundable)} is still refundable on this order.</p>
          <Field label="Amount" hint="USD">
            <TextInput
              type="number"
              value={refundAmount}
              onChange={setRefundAmount}
              min={0.01}
              max={refundable}
              step="0.01"
            />
          </Field>
          <Field label="Reason">
            <TextArea value={refundReason} onChange={setRefundReason} rows={3} placeholder="Damaged on arrival" />
          </Field>
          {refundError ? <p className="rv-error-text">{refundError}</p> : null}
        </div>
      </Modal>
    </>
  );
}
