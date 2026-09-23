"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { use, useEffect, useState } from "react";
import { apiFetch, errorMessage, formatDate, formatDateTime, formatNumber, formatUSD, useApi } from "@/components/admin/api";
import { toast } from "@/components/admin/toast";
import {
  Badge,
  Button,
  Card,
  ConfirmButton,
  Field,
  KeyValue,
  Loading,
  PageHeader,
  Stat,
  StatusBadge,
  Switch,
  TextArea,
  TextInput,
} from "@/components/admin/ui";

type CustomerOrder = {
  id: string;
  orderNumber: string;
  status: string;
  paymentStatus: string;
  currency: string;
  total: number;
  refundedAmount: number;
  itemCount: number;
  placedAt: string;
};

type CustomerDetail = {
  id: string;
  email: string;
  name: string;
  phone: string | null;
  tags: string[];
  notes: string | null;
  acceptsMarketing: boolean;
  address: {
    line1: string | null;
    line2: string | null;
    city: string | null;
    state: string | null;
    postalCode: string | null;
    country: string | null;
    countryCode: string | null;
  };
  orderCount: number;
  totalSpent: number;
  lastOrderAt: string | null;
  createdAt: string;
  updatedAt: string;
  orders: CustomerOrder[];
};

type FormState = {
  name: string;
  phone: string;
  tags: string;
  notes: string;
  acceptsMarketing: boolean;
  addressLine1: string;
  addressLine2: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
  countryCode: string;
};

function toFormState(customer: CustomerDetail): FormState {
  return {
    name: customer.name,
    phone: customer.phone ?? "",
    tags: customer.tags.join(", "),
    notes: customer.notes ?? "",
    acceptsMarketing: customer.acceptsMarketing,
    addressLine1: customer.address.line1 ?? "",
    addressLine2: customer.address.line2 ?? "",
    city: customer.address.city ?? "",
    state: customer.address.state ?? "",
    postalCode: customer.address.postalCode ?? "",
    country: customer.address.country ?? "",
    countryCode: customer.address.countryCode ?? "",
  };
}

export default function AdminCustomerDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const state = useApi<CustomerDetail>(`/api/admin/customers/${id}`);
  const customer = state.data;

  const [form, setForm] = useState<FormState | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!customer) return;
    setForm(toFormState(customer));
  }, [customer]);

  const setField = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((current) => (current ? { ...current, [key]: value } : current));
  };

  const save = async () => {
    if (!form) return;
    if (!form.name.trim()) {
      toast.error("Name is required");
      return;
    }
    setSaving(true);
    try {
      const updated = await apiFetch<Omit<CustomerDetail, "orders">>(`/api/admin/customers/${id}`, {
        method: "PATCH",
        json: {
          name: form.name.trim(),
          phone: form.phone.trim() || null,
          tags: form.tags
            .split(",")
            .map((tag) => tag.trim())
            .filter(Boolean),
          notes: form.notes.trim() || null,
          acceptsMarketing: form.acceptsMarketing,
          addressLine1: form.addressLine1.trim() || null,
          addressLine2: form.addressLine2.trim() || null,
          city: form.city.trim() || null,
          state: form.state.trim() || null,
          postalCode: form.postalCode.trim() || null,
          country: form.country.trim() || null,
          countryCode: form.countryCode.trim() || null,
        },
      });
      state.setData((current) => (current ? { ...current, ...updated } : { ...updated, orders: [] }));
      toast.success("Customer updated");
    } catch (caught) {
      toast.error(errorMessage(caught));
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    try {
      await apiFetch(`/api/admin/customers/${id}`, { method: "DELETE" });
      toast.success("Customer deleted");
      router.push("/admin/customers");
      router.refresh();
    } catch (caught) {
      toast.error(errorMessage(caught));
    }
  };

  return (
    <>
      <PageHeader
        title={customer ? customer.name : "Customer"}
        subtitle={customer ? customer.email : "Loading customer…"}
        actions={
          <div className="rv-inline">
            <Button size="sm" href="/admin/customers">
              Back to customers
            </Button>
            {customer ? (
              <ConfirmButton
                title="Delete customer?"
                description={`This permanently removes ${customer.name} (${customer.email}) and cannot be undone.`}
                confirmLabel="Delete customer"
                onConfirm={remove}
              >
                Delete
              </ConfirmButton>
            ) : null}
          </div>
        }
      />

      <div className="rv-content">
        {state.loading && !customer ? (
          <Card>
            <Loading label="Loading customer…" />
          </Card>
        ) : null}

        {state.error ? (
          <Card title="Could not load customer">
            <p className="rv-error-text">{state.error}</p>
            <div style={{ marginTop: 14 }}>
              <Button onClick={state.refresh}>Try again</Button>
            </div>
          </Card>
        ) : null}

        {customer ? (
          <>
            <div className="rv-stat-grid">
              <Stat label="Orders" value={formatNumber(customer.orderCount)} hint="Lifetime orders" />
              <Stat label="Total spent" value={formatUSD(customer.totalSpent)} hint="Paid orders, net of refunds" />
              <Stat
                label="Last order"
                value={customer.lastOrderAt ? formatDate(customer.lastOrderAt) : "—"}
                hint="Most recent purchase"
              />
              <Stat
                label="Customer since"
                value={formatDate(customer.createdAt)}
                hint={`Updated ${formatDateTime(customer.updatedAt)}`}
              />
            </div>

            <div className="rv-split">
              <Card title="Customer details" description="Contact, marketing and address information">
                {form ? (
                  <div className="rv-stack">
                    <div className="rv-form-grid">
                      <Field label="Name">
                        <TextInput value={form.name} onChange={(value) => setField("name", value)} />
                      </Field>
                      <Field label="Phone">
                        <TextInput value={form.phone} onChange={(value) => setField("phone", value)} />
                      </Field>
                      <Field label="Email" hint="Email cannot be changed">
                        <TextInput value={customer.email} onChange={() => undefined} disabled />
                      </Field>
                      <Field label="Tags" hint="Separate tags with commas">
                        <TextInput
                          value={form.tags}
                          onChange={(value) => setField("tags", value)}
                          placeholder="VIP, Wholesale"
                        />
                      </Field>
                    </div>

                    <Field label="Notes">
                      <TextArea
                        value={form.notes}
                        onChange={(value) => setField("notes", value)}
                        rows={4}
                        placeholder="Private notes about this customer"
                      />
                    </Field>

                    <Switch
                      checked={form.acceptsMarketing}
                      onChange={(checked) => setField("acceptsMarketing", checked)}
                      label="Accepts marketing emails"
                    />

                    <div className="rv-form-grid">
                      <Field label="Address line 1">
                        <TextInput value={form.addressLine1} onChange={(value) => setField("addressLine1", value)} />
                      </Field>
                      <Field label="Address line 2">
                        <TextInput value={form.addressLine2} onChange={(value) => setField("addressLine2", value)} />
                      </Field>
                      <Field label="City">
                        <TextInput value={form.city} onChange={(value) => setField("city", value)} />
                      </Field>
                      <Field label="State / Province">
                        <TextInput value={form.state} onChange={(value) => setField("state", value)} />
                      </Field>
                      <Field label="Postal code">
                        <TextInput value={form.postalCode} onChange={(value) => setField("postalCode", value)} />
                      </Field>
                      <Field label="Country">
                        <TextInput value={form.country} onChange={(value) => setField("country", value)} />
                      </Field>
                      <Field label="Country code">
                        <TextInput
                          value={form.countryCode}
                          onChange={(value) => setField("countryCode", value)}
                          placeholder="US"
                        />
                      </Field>
                    </div>

                    <div className="rv-inline">
                      <Button variant="primary" loading={saving} onClick={save}>
                        Save changes
                      </Button>
                      <Button disabled={saving} onClick={() => setForm(toFormState(customer))}>
                        Reset
                      </Button>
                    </div>
                  </div>
                ) : (
                  <Loading label="Loading form…" />
                )}
              </Card>

              <div className="rv-stack">
                <Card title="At a glance">
                  <KeyValue
                    entries={[
                      { label: "Email", value: <a href={`mailto:${customer.email}`}>{customer.email}</a> },
                      { label: "Phone", value: customer.phone ?? "—" },
                      {
                        label: "Tags",
                        value: customer.tags.length ? (
                          <div className="rv-inline">
                            {customer.tags.map((tag) => (
                              <Badge key={tag}>{tag}</Badge>
                            ))}
                          </div>
                        ) : (
                          "—"
                        ),
                      },
                      { label: "Marketing", value: customer.acceptsMarketing ? "Opted in" : "Not opted in" },
                      { label: "Country", value: customer.address.country ?? "—" },
                    ]}
                  />
                </Card>

                <Card title="Notes">
                  {customer.notes ? <p>{customer.notes}</p> : <p className="rv-hint">No notes yet.</p>}
                </Card>
              </div>
            </div>

            <Card title="Orders" description={`${formatNumber(customer.orders.length)} order(s)`} flush>
              <div className="rv-table-wrap">
                <table className="rv-table">
                  <thead>
                    <tr>
                      <th>Order</th>
                      <th>Date</th>
                      <th>Items</th>
                      <th>Total</th>
                      <th>Status</th>
                      <th>Payment</th>
                    </tr>
                  </thead>
                  <tbody>
                    {customer.orders.length ? (
                      customer.orders.map((order) => (
                        <tr key={order.id}>
                          <td>
                            <Link href={`/admin/orders/${order.id}`}>{order.orderNumber}</Link>
                          </td>
                          <td>{formatDate(order.placedAt)}</td>
                          <td>{formatNumber(order.itemCount)}</td>
                          <td>{formatUSD(order.total)}</td>
                          <td>
                            <StatusBadge status={order.status} />
                          </td>
                          <td>
                            <StatusBadge status={order.paymentStatus} />
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={6}>
                          <div className="rv-empty">No orders yet</div>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </Card>
          </>
        ) : null}
      </div>
    </>
  );
}
