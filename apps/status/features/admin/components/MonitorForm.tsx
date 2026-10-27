"use client";

import { useEffect, useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Input, Field } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";

export interface MonitorFormValues {
  id?: string;
  name: string;
  type: "http" | "tcp" | "ping";
  url: string;
  host: string;
  port: string;
  method: "GET" | "HEAD" | "POST";
  expected_status: string;
  keyword: string;
  interval_seconds: number;
  timeout_ms: number;
  enabled: boolean;
  sort_order: number;
}

const EMPTY: MonitorFormValues = {
  name: "",
  type: "http",
  url: "",
  host: "",
  port: "",
  method: "GET",
  expected_status: "",
  keyword: "",
  interval_seconds: 30,
  timeout_ms: 8000,
  enabled: true,
  sort_order: 0,
};

export function toFormValues(m: any): MonitorFormValues {
  return {
    id: m.id,
    name: m.name ?? "",
    type: m.type ?? "http",
    url: m.url ?? "",
    host: m.host ?? "",
    port: m.port != null ? String(m.port) : "",
    method: m.method ?? "GET",
    expected_status: m.expected_status != null ? String(m.expected_status) : "",
    keyword: m.keyword ?? "",
    interval_seconds: m.interval_seconds ?? 30,
    timeout_ms: m.timeout_ms ?? 8000,
    enabled: m.enabled == null ? true : Boolean(m.enabled),
    sort_order: m.sort_order ?? 0,
  };
}

export function MonitorForm({
  open,
  initial,
  onClose,
  onSaved,
}: {
  open: boolean;
  initial?: MonitorFormValues | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [values, setValues] = useState<MonitorFormValues>(EMPTY);
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setValues(initial ?? EMPTY);
      setErrors({});
      setFormError("");
    }
  }, [open, initial]);

  const set = <K extends keyof MonitorFormValues>(k: K, v: MonitorFormValues[K]) =>
    setValues((prev) => ({ ...prev, [k]: v }));

  async function submit() {
    setSaving(true);
    setErrors({});
    setFormError("");

    const payload = {
      name: values.name,
      type: values.type,
      url: values.type === "http" ? values.url : null,
      host: values.type === "http" ? null : values.host,
      port: values.type === "tcp" ? values.port : null,
      method: values.method,
      expected_status: values.expected_status,
      keyword: values.type === "http" ? values.keyword : null,
      interval_seconds: values.interval_seconds,
      timeout_ms: values.timeout_ms,
      enabled: values.enabled,
      sort_order: values.sort_order,
    };

    const isEdit = Boolean(values.id);
    const res = await fetch(
      isEdit ? `/api/admin/monitors/${values.id}` : "/api/admin/monitors",
      {
        method: isEdit ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      }
    );

    setSaving(false);
    if (res.ok) {
      onSaved();
      return;
    }
    const data = await res.json().catch(() => ({}));
    if (data.issues?.fieldErrors) setErrors(data.issues.fieldErrors);
    setFormError(data.error || "Failed to save monitor");
  }

  const err = (k: string) => errors[k]?.[0];

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={values.id ? "Edit monitor" : "Add monitor"}
      footer={
        <>
          <Button variant="outline" size="sm" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button size="sm" onClick={submit} disabled={saving}>
            {saving ? "Saving…" : "Save"}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {formError && <p className="text-sm text-rose-500">{formError}</p>}

        <Field label="Node / Monitor Name" error={err("name")}>
          <Input value={values.name} onChange={(e) => set("name", e.target.value)} placeholder="e.g. STX Compute VPS Node 01" />
        </Field>

        <Field label="Monitor Type">
          <Select value={values.type} onChange={(e) => set("type", e.target.value as any)}>
            <option value="http">HTTP / HTTPS Website or API</option>
            <option value="tcp">VPS Host Node (TCP Port — SSH 22, Agent 9876, etc.)</option>
            <option value="ping">VPS Host Node (Ping / ICMP)</option>
          </Select>
        </Field>

        {values.type === "http" && (
          <>
            <Field label="URL" error={err("url")}>
              <Input
                value={values.url}
                onChange={(e) => set("url", e.target.value)}
                placeholder="https://example.com"
              />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Method">
                <Select value={values.method} onChange={(e) => set("method", e.target.value as any)}>
                  <option value="GET">GET</option>
                  <option value="HEAD">HEAD</option>
                  <option value="POST">POST</option>
                </Select>
              </Field>
              <Field label="Expected status" error={err("expected_status")}>
                <Input
                  value={values.expected_status}
                  onChange={(e) => set("expected_status", e.target.value)}
                  placeholder="200 (optional)"
                  inputMode="numeric"
                />
              </Field>
            </div>
            <Field label="Keyword in body (optional)">
              <Input
                value={values.keyword}
                onChange={(e) => set("keyword", e.target.value)}
                placeholder="e.g. Welcome"
              />
            </Field>
          </>
        )}

        {values.type === "tcp" && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="sm:col-span-2">
              <Field label="Host IP / Address (Private — Hidden publicly)" error={err("host")}>
                <Input value={values.host} onChange={(e) => set("host", e.target.value)} placeholder="e.g. 192.168.1.100 or node.domain.com" />
              </Field>
            </div>
            <Field label="Port (e.g. 22)" error={err("port")}>
              <Input
                value={values.port}
                onChange={(e) => set("port", e.target.value)}
                placeholder="22"
                inputMode="numeric"
              />
            </Field>
          </div>
        )}

        {values.type === "ping" && (
          <Field label="Host IP / Address (Private — Hidden publicly)" error={err("host")}>
            <Input value={values.host} onChange={(e) => set("host", e.target.value)} placeholder="e.g. 192.168.1.100 or node.domain.com" />
          </Field>
        )}

        <div className="grid grid-cols-2 gap-3">
          <Field label="Interval (seconds)" error={err("interval_seconds")}>
            <Input
              type="number"
              min={5}
              value={values.interval_seconds}
              onChange={(e) => set("interval_seconds", Number(e.target.value))}
            />
          </Field>
          <Field label="Timeout (ms)" error={err("timeout_ms")}>
            <Input
              type="number"
              min={1000}
              value={values.timeout_ms}
              onChange={(e) => set("timeout_ms", Number(e.target.value))}
            />
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-3 items-center">
          <Field label="Sort order">
            <Input
              type="number"
              value={values.sort_order}
              onChange={(e) => set("sort_order", Number(e.target.value))}
            />
          </Field>
          <label className="flex items-center gap-2 mt-5 text-sm font-medium cursor-pointer">
            <input
              type="checkbox"
              checked={values.enabled}
              onChange={(e) => set("enabled", e.target.checked)}
              className="h-4 w-4 accent-black dark:accent-white"
            />
            Enabled
          </label>
        </div>
      </div>
    </Modal>
  );
}
