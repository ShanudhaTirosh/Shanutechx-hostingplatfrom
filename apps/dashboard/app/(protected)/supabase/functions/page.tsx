'use client';

import { useState } from 'react';
import Editor from '@monaco-editor/react';
import { PageHeader, Card, Button, Spinner, useToast } from '@/components/ui';

interface EdgeFunction {
  id: string;
  slug: string;
  name: string;
  runtime: 'deno' | 'node';
  invocations: number;
  status: 'active' | 'deploying' | 'error';
  code: string;
  updatedAt: string;
}

const SEEDED_FUNCTIONS: EdgeFunction[] = [
  {
    id: 'fn-1',
    slug: 'hello-world',
    name: 'hello-world',
    runtime: 'deno',
    invocations: 1420,
    status: 'active',
    code: `import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

serve(async (req) => {
  const { name } = await req.json().catch(() => ({ name: "World" }));
  return new Response(
    JSON.stringify({ message: \`Hello \${name} from Deno Edge Function!\`, timestamp: new Date().toISOString() }),
    { headers: { "Content-Type": "application/json" } }
  );
});`,
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'fn-2',
    slug: 'generate-ai-completion',
    name: 'generate-ai-completion',
    runtime: 'deno',
    invocations: 890,
    status: 'active',
    code: `import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

serve(async (req) => {
  const apiKey = Deno.env.get("OPENAI_API_KEY");
  return new Response(
    JSON.stringify({ ok: true, apiKeyConfigured: !!apiKey }),
    { headers: { "Content-Type": "application/json" } }
  );
});`,
    updatedAt: new Date().toISOString(),
  },
];

export default function SupabaseFunctionsPage() {
  const [functions, setFunctions] = useState<EdgeFunction[]>(SEEDED_FUNCTIONS);
  const [selectedFunc, setSelectedFunc] = useState<EdgeFunction>(SEEDED_FUNCTIONS[0]);
  const [code, setCode] = useState(SEEDED_FUNCTIONS[0].code);
  const [saving, setSaving] = useState(false);
  const [invoking, setInvoking] = useState(false);
  const [testPayload, setTestPayload] = useState('{\n  "name": "ShanuTechX User"\n}');
  const [testResult, setTestResult] = useState<string | null>(null);

  // New function modal
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newSlug, setNewSlug] = useState('');

  const { toast } = useToast();

  function handleSelectFunction(fn: EdgeFunction) {
    setSelectedFunc(fn);
    setCode(fn.code);
    setTestResult(null);
  }

  async function handleDeployCode() {
    setSaving(true);
    try {
      setFunctions((prev) =>
        prev.map((f) => (f.id === selectedFunc.id ? { ...f, code, updatedAt: new Date().toISOString() } : f))
      );
      toast(`Deployed edge function "${selectedFunc.slug}"!`, 'success');
    } catch (err: any) {
      toast(err.message || 'Failed to deploy function', 'error');
    } finally {
      setSaving(false);
    }
  }

  async function handleInvokeTest() {
    setInvoking(true);
    setTestResult(null);
    try {
      // Simulate Deno Edge Execution
      await new Promise((r) => setTimeout(r, 600));
      const parsed = JSON.parse(testPayload);
      const res = {
        status: 200,
        ok: true,
        executionTimeMs: 42,
        response: {
          message: `Hello ${parsed.name || 'World'} from Deno Edge Function!`,
          timestamp: new Date().toISOString(),
          region: 'cmbo-us1',
        },
      };
      setTestResult(JSON.stringify(res, null, 2));
      toast('Edge Function executed successfully!', 'success');
    } catch (err: any) {
      setTestResult(JSON.stringify({ error: err.message }, null, 2));
      toast('Invocation error', 'error');
    } finally {
      setInvoking(false);
    }
  }

  function handleCreateFunction(e: React.FormEvent) {
    e.preventDefault();
    if (!newSlug.trim()) return;
    const slug = newSlug.toLowerCase().replace(/[^a-z0-9-]/g, '');
    const newFn: EdgeFunction = {
      id: `fn-${Date.now()}`,
      slug,
      name: slug,
      runtime: 'deno',
      invocations: 0,
      status: 'active',
      code: `import { serve } from "https://deno.land/std@0.168.0/http/server.ts";\n\nserve(async (req) => {\n  return new Response("Hello from ${slug}!");\n});`,
      updatedAt: new Date().toISOString(),
    };
    setFunctions((prev) => [...prev, newFn]);
    setSelectedFunc(newFn);
    setCode(newFn.code);
    setShowCreateModal(false);
    setNewSlug('');
    toast(`Created function "${slug}"!`, 'success');
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title="Supabase Edge Functions (Deno / TypeScript)"
        description="Serverless TypeScript & Deno functions deployed globally at the edge with zero cold starts."
        action={<Button onClick={() => setShowCreateModal(true)}>+ New Edge Function</Button>}
      />

      <div className="grid md:grid-cols-4 gap-6">
        {/* Functions Selector Sidebar */}
        <div className="space-y-3">
          <h3 className="text-xs font-semibold text-text-muted uppercase tracking-wider">
            Deployed Functions ({functions.length})
          </h3>
          <div className="glass rounded-xl p-2 border border-white/[0.06] space-y-1">
            {functions.map((fn) => (
              <button
                key={fn.id}
                type="button"
                onClick={() => handleSelectFunction(fn)}
                className={`w-full text-left px-3 py-2 rounded-lg text-xs font-mono transition-all flex items-center justify-between ${
                  selectedFunc.id === fn.id
                    ? 'bg-accent-cyan/20 text-accent-cyan border border-accent-cyan/30 font-semibold'
                    : 'text-text-muted hover:bg-white/[0.04] hover:text-text-primary'
                }`}
              >
                <span className="truncate">⚡ {fn.slug}</span>
                <span className="text-[10px] text-text-faint">{fn.invocations}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Function IDE & Tester */}
        <div className="md:col-span-3 space-y-4">
          {/* Monaco TypeScript Editor */}
          <Card className="border border-white/[0.06] p-0 overflow-hidden shadow-2xl">
            <div className="p-3 bg-[#0d0f17] border-b border-white/[0.06] flex items-center justify-between">
              <div className="flex items-center gap-2 font-mono text-xs">
                <span className="text-white font-semibold">/functions/v1/{selectedFunc.slug}</span>
                <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300">
                  {selectedFunc.runtime}
                </span>
              </div>
              <Button size="sm" onClick={handleDeployCode} loading={saving}>
                🚀 Deploy Function
              </Button>
            </div>
            <div className="h-64">
              <Editor
                height="100%"
                defaultLanguage="typescript"
                theme="vs-dark"
                value={code}
                onChange={(val) => setCode(val || '')}
                options={{
                  minimap: { enabled: false },
                  fontSize: 12,
                  lineNumbers: 'on',
                  scrollBeyondLastLine: false,
                  automaticLayout: true,
                }}
              />
            </div>
          </Card>

          {/* Test Execution Panel */}
          <div className="grid md:grid-cols-2 gap-4">
            <Card title="Test Payload (JSON)" description="Pass request body JSON for function execution.">
              <textarea
                rows={5}
                value={testPayload}
                onChange={(e) => setTestPayload(e.target.value)}
                className="w-full bg-black/60 border border-white/10 rounded-xl p-3 text-xs font-mono text-white focus:outline-none focus:border-accent-cyan resize-none"
              />
              <div className="flex justify-end mt-2">
                <Button size="sm" onClick={handleInvokeTest} loading={invoking}>
                  ▶ Invoke Test Endpoint
                </Button>
              </div>
            </Card>

            <Card title="Invocation Response" description="HTTP status, payload, and execution metrics.">
              <pre className="bg-black/90 border border-white/10 rounded-xl p-3 font-mono text-xs text-emerald-400 h-[140px] overflow-auto select-text">
                {testResult || '// Click "Invoke Test Endpoint" to view response.'}
              </pre>
            </Card>
          </div>
        </div>
      </div>

      {/* Create Function Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-bg border border-white/10 rounded-3xl p-6 w-full max-w-sm space-y-4 shadow-2xl">
            <h3 className="font-bold text-sm text-white">Create New Edge Function</h3>
            <form onSubmit={handleCreateFunction} className="space-y-4">
              <div>
                <label className="text-xs font-medium text-text-muted block mb-1">Function Slug</label>
                <input
                  required
                  value={newSlug}
                  onChange={(e) => setNewSlug(e.target.value)}
                  placeholder="process-stripe-webhook"
                  className="w-full bg-black/50 border border-white/10 rounded-xl px-3 py-2 text-xs font-mono text-white focus:outline-none focus:border-accent-cyan"
                />
              </div>
              <div className="flex justify-end gap-2">
                <Button type="button" variant="secondary" size="sm" onClick={() => setShowCreateModal(false)}>Cancel</Button>
                <Button type="submit" size="sm">Create Function</Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
