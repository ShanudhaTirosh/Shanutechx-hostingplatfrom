'use client';

import React, { useState } from 'react';
import { Check, Copy } from 'lucide-react';
import { ClientSupabaseProject } from '@/lib/supabaseAdmin';
import { useToast } from '@/components/ui';


interface ProjectConfigModalProps {
  project: ClientSupabaseProject | null;
  isOpen: boolean;
  onClose: () => void;
}

export function ProjectConfigModal({ project, isOpen, onClose }: ProjectConfigModalProps) {
  const [activeTab, setActiveTab] = useState<'endpoints' | 'keys' | 'env' | 'sdk'>('endpoints');
  const [revealServiceKey, setRevealServiceKey] = useState(false);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [sdkLang, setSdkLang] = useState<keyof typeof sdkSnippets>('nextjs');

  const { toast } = useToast();

  if (!isOpen || !project) return null;

  // Use real per-project URLs from serializeProject() — never hardcoded env vars
  const baseUrl = project.apiUrl || 'http://localhost:8001';
  const studioUrl = project.studioUrl || 'http://localhost:8000';
  const restUrl = `${baseUrl}/rest/v1`;
  const authUrl = `${baseUrl}/auth/v1`;
  const realtimeUrl = baseUrl.replace(/^https?/, 'wss').replace(/^http$/, 'ws') + '/realtime/v1/websocket';
  const storageUrl = `${baseUrl}/storage/v1`;
  const graphqlUrl = `${baseUrl}/graphql/v1`;
  const dbUri = project.dbUrl || `postgres://postgres:[YOUR-PASSWORD]@${project.nodeIp || 'localhost'}:${project.dbPort || 5432}/${project.dbName}`;

  const envContent = `# ===================================================
# ShanuTechX Supabase BaaS Client Environment Config
# Project: ${project.name} (${project.id})
# DB Name: ${project.dbName}
# Region: ${project.region || 'ap-southeast-1 (Local)'}
# Node: ${project.nodeLabel || 'localhost'} ${project.nodeIp ? `(${project.nodeIp})` : ''}
# Studio: ${studioUrl}
# ===================================================

NEXT_PUBLIC_SUPABASE_URL=${baseUrl}
NEXT_PUBLIC_SUPABASE_ANON_KEY=${project.anonKey}
SUPABASE_SERVICE_ROLE_KEY=${project.serviceKey}
SUPABASE_DB_URL=${dbUri}
SUPABASE_REALTIME_URL=${realtimeUrl}
SUPABASE_STORAGE_URL=${storageUrl}
SUPABASE_GRAPHQL_URL=${graphqlUrl}
SUPABASE_STUDIO_URL=${studioUrl}
`;

  const sdkSnippets = {
    nextjs: `// Next.js App Router (Server & Client Components)
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

export async function createClient() {
  const cookieStore = await cookies();
  return createServerClient(
    '${baseUrl}',
    '${project.anonKey}',
    {
      cookies: {
        getAll() { return cookieStore.getAll(); },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
          } catch {}
        },
      },
    }
  );
}`,

    js: `// React / SPA / Web Client
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = '${baseUrl}';
const supabaseAnonKey = '${project.anonKey}';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Query Example:
// const { data, error } = await supabase.from('users').select('*');`,

    vue: `// Vue 3 / Nuxt 3 Composable
import { createClient } from '@supabase/supabase-js'

export const useSupabase = () => {
  return createClient(
    '${baseUrl}',
    '${project.anonKey}'
  )
}`,

    svelte: `// SvelteKit Server Load Function
import { createClient } from '@supabase/supabase-js'

export const load = async () => {
  const supabase = createClient('${baseUrl}', '${project.anonKey}')
  const { data } = await supabase.from('todos').select('*')
  return { todos: data ?? [] }
}`,

    python: `# Python / Flask / FastAPI Client
from supabase import create_client, Client

url: str = "${baseUrl}"
key: str = "${project.anonKey}"
supabase: Client = create_client(url, key)

# Query Example:
# response = supabase.table("users").select("*").execute()
# print(response.data)`,

    flutter: `// Flutter (iOS & Android)
import 'package:supabase_flutter/supabase_flutter.dart';

Future<void> main() async {
  await Supabase.initialize(
    url: '${baseUrl}',
    anonKey: '${project.anonKey}',
  );
  runApp(const MyApp());
}

final supabase = Supabase.instance.client;`,

    swift: `// iOS SwiftUI (Swift SDK)
import Supabase

let supabase = SupabaseClient(
    supabaseURL: URL(string: "${baseUrl}")!,
    supabaseKey: "${project.anonKey}"
)`,

    kotlin: `// Android Kotlin (Jetpack Compose)
import io.github.jan.supabase.createSupabaseClient
import io.github.jan.supabase.postgrest.Postgrest

val supabase = createSupabaseClient(
    supabaseUrl = "${baseUrl}",
    supabaseKey = "${project.anonKey}"
) {
    install(Postgrest)
}`,

    expo: `// Expo React Native with SecureStore
import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';

export const supabase = createClient('${baseUrl}', '${project.anonKey}', {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});`,

    hono: `// Hono Lightweight Web API
import { Hono } from 'hono'
import { createClient } from '@supabase/supabase-js'

const app = new Hono()
const supabase = createClient('${baseUrl}', '${project.anonKey}')

app.get('/api/todos', async (c) => {
  const { data } = await supabase.from('todos').select('*')
  return c.json(data)
})`,

    php: `// Laravel / PHP PDO Direct Database Config (.env)
DB_CONNECTION=pgsql
DB_HOST=db.shanutechx.net
DB_PORT=5432
DB_DATABASE=${project.dbName}
DB_USERNAME=postgres
DB_PASSWORD=YOUR_POSTGRES_PASSWORD`,

    rails: `# Ruby on Rails (config/database.yml)
default: &default
  adapter: postgresql
  encoding: unicode
  pool: <%= ENV.fetch("RAILS_MAX_THREADS") { 5 } %>
  host: db.shanutechx.net
  port: 5432
  database: ${project.dbName}
  username: postgres
  password: <%= ENV["POSTGRES_PASSWORD"] %>`,

    curl: `# Fetch database schema tables over PostgREST API
curl -X GET "${restUrl}/" \\
  -H "apikey: ${project.anonKey}" \\
  -H "Authorization: Bearer ${project.anonKey}"`,
  };


  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(label);
    toast(`Copied ${label} to clipboard!`, 'success');
    setTimeout(() => setCopiedField(null), 2500);
  };

  const handleDownloadEnv = () => {
    const blob = new Blob([envContent], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `.env.local`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    toast(`Downloaded .env.local file for project "${project.name}"`, 'success');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md animate-fade-in p-4 overflow-y-auto">
      <div className="glass rounded-3xl border border-white/[0.1] max-w-3xl w-full space-y-4 shadow-2xl overflow-hidden my-8">
        {/* Modal Header */}
        <div className="p-6 border-b border-white/[0.08] flex items-center justify-between bg-white/[0.02]">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-2xl bg-accent-violet/20 border border-accent-violet/30 flex items-center justify-center text-accent-violet-light shrink-0">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-base font-bold text-text-primary">{project.name}</h3>
                <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase border ${
                  project.status === 'ACTIVE' ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30' :
                  project.status === 'FAILED' ? 'bg-red-500/20 text-red-300 border-red-500/30' :
                  project.status === 'PROVISIONING' ? 'bg-amber-500/20 text-amber-300 border-amber-500/30' :
                  'bg-slate-500/20 text-slate-300 border-slate-500/30'
                }`}>
                  {project.status}
                </span>
                {project.nodeLabel && (
                  <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-white/[0.06] text-text-muted border border-white/[0.06]">
                    {project.nodeLabel}
                  </span>
                )}
              </div>
              <p className="text-xs text-text-muted mt-0.5 font-mono">
                ID: {project.id} • DB: {project.dbName} • Owner: {project.clientEmail}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl text-text-muted hover:text-text-primary hover:bg-white/[0.06] transition-all"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="px-6 border-b border-white/[0.06] flex items-center gap-2 overflow-x-auto">
          {[
            { id: 'endpoints', label: 'API Endpoints' },
            { id: 'keys', label: 'API Keys & Secrets' },
            { id: 'env', label: '.env File Exporter' },
            { id: 'sdk', label: 'Client SDK Snippets' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`px-4 py-2.5 text-xs font-semibold border-b-2 transition-all shrink-0 ${
                activeTab === tab.id
                  ? 'border-accent-violet text-accent-violet-light font-bold'
                  : 'border-transparent text-text-muted hover:text-text-primary'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab Contents */}
        <div className="p-6 space-y-4 max-h-[60vh] overflow-y-auto">
          {/* TAB 1: API Endpoints */}
          {activeTab === 'endpoints' && (
            <div className="space-y-3">
              <p className="text-xs text-text-muted mb-2">
                Use these Gateway endpoints to connect client applications, REST APIs, WebSockets, or S3 Storage SDKs.
              </p>

              {[
                { label: 'Project URL (Kong Gateway)', value: baseUrl, desc: 'Base REST & API Gateway Host — use as SUPABASE_URL' },
                { label: 'Supabase Studio UI', value: studioUrl, desc: 'Open the Studio web interface (Table Editor, Auth, Storage)' },
                { label: 'PostgREST REST API', value: restUrl, desc: 'Auto-generated REST API for PostgreSQL tables' },
                { label: 'GoTrue Auth Endpoint', value: authUrl, desc: 'User authentication & JWT token management' },
                { label: 'Realtime WebSocket URL', value: realtimeUrl, desc: 'PostgreSQL CDC & Broadcast WebSocket stream' },
                { label: 'Storage S3 API URL', value: storageUrl, desc: 'Object Storage Buckets API endpoint' },
                { label: 'GraphQL API URL', value: graphqlUrl, desc: 'pg_graphql endpoint' },
                { label: 'Direct PostgreSQL DSN', value: dbUri, desc: `Direct DB access — port ${project.dbPort ?? 5432}` },
              ].map((item, idx) => (
                <div key={idx} className="p-3 rounded-xl bg-black/40 border border-white/[0.06] space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-text-primary">{item.label}</span>
                    <button
                      onClick={() => copyToClipboard(item.value, item.label)}
                      className="px-2.5 py-1 rounded-lg bg-white/[0.06] hover:bg-white/[0.12] text-xs font-mono text-accent-cyan transition-all flex items-center gap-1"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                      </svg>
                      {copiedField === item.label ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                      <span>{copiedField === item.label ? 'Copied' : 'Copy'}</span>

                    </button>
                  </div>
                  <p className="font-mono text-xs text-emerald-400 break-all">{item.value}</p>
                  <p className="text-[10px] text-text-faint">{item.desc}</p>
                </div>
              ))}
            </div>
          )}

          {/* TAB 2: API Keys & Secrets */}
          {activeTab === 'keys' && (
            <div className="space-y-4">
              {/* Anon Public Key */}
              <div className="p-4 rounded-2xl bg-black/40 border border-white/[0.06] space-y-2">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="font-bold text-xs text-text-primary">anon (Public API Key)</span>
                    <p className="text-[10px] text-text-muted">Safe to embed in public client-side applications (React, Mobile, Web).</p>
                  </div>
                  <button
                    onClick={() => copyToClipboard(project.anonKey, 'anon Public Key')}
                    className="px-3 py-1.5 rounded-lg bg-accent-violet/20 hover:bg-accent-violet/30 text-accent-violet-light border border-accent-violet/30 text-xs font-semibold transition-all flex items-center gap-1"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                    </svg>
                    {copiedField === 'anon Public Key' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedField === 'anon Public Key' ? 'Copied' : 'Copy Key'}</span>
                  </button>
                </div>
                <pre className="font-mono text-xs text-teal-300 break-all bg-black/60 p-3 rounded-xl border border-white/[0.04]">
                  {project.anonKey}
                </pre>
              </div>

              {/* Service Role Secret Key */}
              <div className="p-4 rounded-2xl bg-red-500/[0.05] border border-red-500/20 space-y-2">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-xs text-red-400">service_role (Secret Admin Key)</span>
                      <span className="px-1.5 py-0.5 rounded text-[9px] font-mono font-bold uppercase bg-red-500/20 text-red-300">
                        Bypasses RLS
                      </span>
                    </div>
                    <p className="text-[10px] text-red-300/80">NEVER expose in public client code. Server-side only (Node, Edge Functions).</p>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setRevealServiceKey(!revealServiceKey)}
                      className="px-2.5 py-1.5 rounded-lg bg-white/[0.06] hover:bg-white/[0.12] text-text-muted text-xs font-medium"
                    >
                      {revealServiceKey ? 'Hide' : 'Reveal'}
                    </button>
                    <button
                      onClick={() => copyToClipboard(project.serviceKey, 'service_role Secret Key')}
                      className="px-3 py-1.5 rounded-lg bg-red-500/20 hover:bg-red-500/30 text-red-300 border border-red-500/30 text-xs font-semibold transition-all flex items-center gap-1"
                    >
                      {copiedField === 'service_role Secret Key' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                      <span>{copiedField === 'service_role Secret Key' ? 'Copied' : 'Copy Secret Key'}</span>
                    </button>
                  </div>
                </div>
                <pre className="font-mono text-xs text-red-300 break-all bg-black/60 p-3 rounded-xl border border-red-500/10">
                  {revealServiceKey
                    ? project.serviceKey
                    : '••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••'}
                </pre>
              </div>
            </div>
          )}

          {/* TAB 3: .env Exporter */}
          {activeTab === 'env' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-xs text-text-muted">
                  Pre-formatted `.env.local` configuration for React, Next.js, and Node.js projects.
                </p>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => copyToClipboard(envContent, '.env Content')}
                    className="px-3 py-1.5 rounded-lg bg-accent-violet/20 hover:bg-accent-violet/30 text-accent-violet-light border border-accent-violet/30 text-xs font-semibold transition-all flex items-center gap-1"
                  >
                    {copiedField === '.env Content' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedField === '.env Content' ? 'Copied' : 'Copy .env to Clipboard'}</span>
                  </button>

                  <button
                    onClick={handleDownloadEnv}
                    className="px-3 py-1.5 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/30 text-xs font-semibold transition-all flex items-center gap-1"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                    </svg>
                    Download .env File
                  </button>
                </div>
              </div>

              <pre className="w-full h-64 rounded-xl bg-black/80 border border-white/[0.08] p-4 font-mono text-xs text-emerald-400 overflow-y-auto select-text">
                {envContent}
              </pre>
            </div>
          )}

          {/* TAB 4: SDK Client Snippets */}
          {activeTab === 'sdk' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 overflow-x-auto max-w-lg py-1">
                  {[
                    { id: 'nextjs', name: 'Next.js' },
                    { id: 'js', name: 'React / JS' },
                    { id: 'vue', name: 'Vue / Nuxt' },
                    { id: 'svelte', name: 'SvelteKit' },
                    { id: 'python', name: 'Python' },
                    { id: 'flutter', name: 'Flutter' },
                    { id: 'swift', name: 'iOS Swift' },
                    { id: 'kotlin', name: 'Android Kotlin' },
                    { id: 'expo', name: 'Expo RN' },
                    { id: 'hono', name: 'Hono API' },
                    { id: 'php', name: 'Laravel' },
                    { id: 'rails', name: 'Rails' },
                    { id: 'curl', name: 'cURL' },
                  ].map((framework) => (
                    <button
                      key={framework.id}
                      onClick={() => setSdkLang(framework.id as any)}
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-mono whitespace-nowrap transition-all ${
                        sdkLang === framework.id
                          ? 'bg-accent-violet text-white font-bold shadow-glow-violet'
                          : 'text-text-muted hover:bg-white/[0.04] border border-white/[0.04]'
                      }`}
                    >
                      {framework.name}
                    </button>
                  ))}
                </div>


                <button
                  onClick={() => copyToClipboard(sdkSnippets[sdkLang], `${sdkLang.toUpperCase()} SDK Code`)}
                  className="px-3 py-1.5 rounded-lg bg-accent-violet/20 hover:bg-accent-violet/30 text-accent-violet-light border border-accent-violet/30 text-xs font-semibold transition-all flex items-center gap-1"
                >
                  {copiedField === `${sdkLang.toUpperCase()} SDK Code` ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedField === `${sdkLang.toUpperCase()} SDK Code` ? 'Copied' : 'Copy Code Snippet'}</span>
                </button>

              </div>

              <pre className="w-full h-64 rounded-xl bg-black/80 border border-white/[0.08] p-4 font-mono text-xs text-teal-300 overflow-y-auto select-text">
                {sdkSnippets[sdkLang]}
              </pre>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t border-white/[0.08] flex justify-end bg-white/[0.02]">
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-white/[0.06] hover:bg-white/[0.12] text-xs font-semibold text-text-primary transition-all"
          >
            Close Settings
          </button>
        </div>
      </div>
    </div>
  );
}
