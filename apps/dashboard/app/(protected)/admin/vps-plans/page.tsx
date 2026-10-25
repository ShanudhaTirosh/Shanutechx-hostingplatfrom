'use client';

import { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import { Product, Plan, ProductCategory, PlanBillingType } from '@/lib/types';
import {
  Server as ServerIcon,
  Database as DatabaseIcon,
  Cpu as CpuIcon,
  Sparkles as SparklesIcon,
  ShieldCheck as ShieldCheckIcon,
  Plus as PlusIcon,
  Pencil as PencilIcon,
  Trash2 as TrashIcon,
  Check as CheckIcon,
  Tag as TagIcon,
  Cloud as CloudIcon,
  Activity as ActivityIcon,
  Mail as MailIcon,
  Globe as GlobeIcon,
  Bot as BotIcon,
  Package as PackageIcon,
  GitBranch as GitBranchIcon,
  Layers as LayersIcon,
  HardDrive as HardDriveIcon,
  Zap as ZapIcon,
  Clock as ClockIcon,
  Lock as LockIcon,
  EyeOff as EyeOffIcon,
  Eye as EyeIcon,
} from 'lucide-react';

const CATEGORY_TABS: Array<{ id: string; label: string; icon: any }> = [
  { id: 'all', label: 'All Products & Plans', icon: TagIcon },
  { id: 'vps', label: 'VPS Hosting', icon: ServerIcon },
  { id: 'smtp', label: 'SMTP & Email', icon: MailIcon },
  { id: 'web_hosting', label: 'Web Hosting', icon: GlobeIcon },
  { id: 'database', label: 'Managed Databases', icon: DatabaseIcon },
  { id: 'app_catalog', label: 'App Catalog', icon: PackageIcon },
  { id: 'bot_hosting', label: 'Bot Hosting', icon: BotIcon },
  { id: 'app_deployment', label: 'App Deployment', icon: GitBranchIcon },
];

export default function AdminProductsAndPlansPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Modals state
  const [showProductModal, setShowProductModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);

  const [showPlanModal, setShowPlanModal] = useState(false);
  const [targetProductForPlan, setTargetProductForPlan] = useState<Product | null>(null);
  const [editingPlan, setEditingPlan] = useState<Plan | null>(null);

  const [saving, setSaving] = useState(false);

  // Product Form state (Category is hardcoded and fixed)
  const [prodCategory, setProdCategory] = useState<ProductCategory>('vps');
  const [prodName, setProdName] = useState('');
  const [prodDesc, setProdDesc] = useState('');
  const [prodIconUrl, setProdIconUrl] = useState('');
  const [prodIsPopular, setProdIsPopular] = useState(false);
  const [prodBadge, setProdBadge] = useState('Popular Choice');

  // Plan Core state
  const [planName, setPlanName] = useState('');
  const [planPrice, setPlanPrice] = useState<number>(120000);
  const [planCurrency, setPlanCurrency] = useState<'LKR' | 'USD'>('LKR');
  const [planBillingType, setPlanBillingType] = useState<PlanBillingType>('monthly');
  const [planIsPopular, setPlanIsPopular] = useState(false);
  const [planBadge, setPlanBadge] = useState('Best Value');

  // VPS Specs state
  const [vpsCpuCores, setVpsCpuCores] = useState<number>(2);
  const [vpsRamGb, setVpsRamGb] = useState<number>(4);
  const [vpsStorageGb, setVpsStorageGb] = useState<number>(80);
  const [vpsBandwidth, setVpsBandwidth] = useState('Unmetered 1Gbps');
  const [vpsRegion, setVpsRegion] = useState('Frankfurt, Germany');
  const [vpsProvider, setVpsProvider] = useState('Leaseweb Enterprise');
  const [vpsDedicatedIpv4, setVpsDedicatedIpv4] = useState(false);
  const [vpsRootSsh, setVpsRootSsh] = useState(true);

  // SMTP Specs state
  const [smtpMailboxesCount, setSmtpMailboxesCount] = useState<number>(1);
  const [smtpStorageGb, setSmtpStorageGb] = useState<number>(5);
  const [smtpForwardingRules, setSmtpForwardingRules] = useState<number>(5);
  const [smtpMaxAliases, setSmtpMaxAliases] = useState<number>(5);
  const [smtpDailyQuota, setSmtpDailyQuota] = useState<number>(2500);
  const [smtpMinCommitmentMonths, setSmtpMinCommitmentMonths] = useState<number>(3);

  // Web Hosting Specs state
  const [webStorageGb, setWebStorageGb] = useState<number>(10);
  const [webBandwidthGb, setWebBandwidthGb] = useState<number>(500);
  const [webDomainsCount, setWebDomainsCount] = useState<number>(1);
  const [webGitAutoDeploy, setWebGitAutoDeploy] = useState<boolean>(true);
  const [webAutoSsl, setWebAutoSsl] = useState<boolean>(true);

  // Managed Databases Specs state
  const [dbRamMb, setDbRamMb] = useState<number>(1024);
  const [dbCpuCores, setDbCpuCores] = useState<number>(1.0);
  const [dbStorageGb, setDbStorageGb] = useState<number>(10);
  const [dbEngines, setDbEngines] = useState<string>('PostgreSQL 16, MySQL 8, Redis 7, MongoDB 6');
  const [dbConnectionPooling, setDbConnectionPooling] = useState<boolean>(true);
  const [dbAutoBackups, setDbAutoBackups] = useState<boolean>(true);

  // App Catalog & App Deployment Specs state
  const [appRamMb, setAppRamMb] = useState<number>(1024);
  const [appCpuCores, setAppCpuCores] = useState<number>(1.0);
  const [appStorageGb, setAppStorageGb] = useState<number>(10);
  const [appGitAutoDeploy, setAppGitAutoDeploy] = useState<boolean>(true);
  const [appAutoSsl, setAppAutoSsl] = useState<boolean>(true);
  const [appCustomDomain, setAppCustomDomain] = useState<boolean>(true);

  // Bot Hosting Specs state
  const [botRamMb, setBotRamMb] = useState<number>(1024);
  const [botCpuCores, setBotCpuCores] = useState<number>(1.0);
  const [botStorageGb, setBotStorageGb] = useState<number>(10);
  const [botPlatforms, setBotPlatforms] = useState<string>('Discord (Node/Python), WhatsApp (Baileys QR), Telegram');
  const [botContinuousRuntime, setBotContinuousRuntime] = useState<boolean>(true);
  const [botPersistentSession, setBotPersistentSession] = useState<boolean>(true);

  function fetchCatalog() {
    setLoading(true);
    api.products
      .list(undefined, true)
      .then((data) => setProducts(data.products || []))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    fetchCatalog();
  }, []);

  // Product Modal Handlers
  function openEditProductModal(product: Product) {
    setEditingProduct(product);
    setProdCategory(product.category);
    setProdName(product.name);
    setProdDesc(product.description || '');
    setProdIconUrl(product.iconUrl || '');
    setProdIsPopular(!!product.isPopular);
    setProdBadge(product.badge || '');
    setShowProductModal(true);
  }

  async function handleSaveProduct(e: React.FormEvent) {
    e.preventDefault();
    if (!editingProduct || !prodName.trim()) return;

    setSaving(true);
    try {
      await api.products.updateProduct(editingProduct.id, {
        category: prodCategory,
        name: prodName.trim(),
        description: prodDesc.trim() || null,
        iconUrl: prodIconUrl.trim() || null,
        isPopular: prodIsPopular,
        badge: prodBadge.trim() || null,
      });
      setShowProductModal(false);
      setEditingProduct(null);
      fetchCatalog();
    } catch (err: any) {
      alert(`Failed to save product: ${err.message}`);
    } finally {
      setSaving(false);
    }
  }

  // Plan Modal Handlers
  function openAddPlanModal(product?: Product | null) {
    const target = product || products.find((p) => activeTab !== 'all' && p.category === activeTab) || products[0];
    if (!target) return;

    setTargetProductForPlan(target);
    setEditingPlan(null);
    setPlanName('');
    setPlanCurrency('LKR');
    setPlanIsPopular(false);
    setPlanBadge('Best Value');

    if (target.category === 'vps') {
      setPlanPrice(500000);
      setPlanBillingType('monthly');
      setVpsCpuCores(2);
      setVpsRamGb(4);
      setVpsStorageGb(80);
      setVpsBandwidth('Unmetered 1Gbps');
      setVpsRegion('Frankfurt, Germany');
      setVpsProvider('Leaseweb Enterprise');
      setVpsDedicatedIpv4(false);
      setVpsRootSsh(true);
    } else if (target.category === 'smtp') {
      setPlanPrice(1050000);
      setPlanBillingType('quarterly');
      setSmtpMailboxesCount(1);
      setSmtpStorageGb(5);
      setSmtpForwardingRules(5);
      setSmtpMaxAliases(5);
      setSmtpDailyQuota(2500);
      setSmtpMinCommitmentMonths(3);
    } else {
      // 1-slot unified standard price
      setPlanPrice(120000);
      setPlanBillingType('monthly');
      setWebStorageGb(10);
      setWebBandwidthGb(500);
      setWebDomainsCount(1);
      setDbRamMb(1024);
      setDbCpuCores(1.0);
      setDbStorageGb(10);
      setAppRamMb(1024);
      setAppCpuCores(1.0);
      setAppStorageGb(10);
      setBotRamMb(1024);
      setBotCpuCores(1.0);
      setBotStorageGb(10);
    }

    setShowPlanModal(true);
  }

  function openEditPlanModal(product: Product, plan: Plan) {
    setTargetProductForPlan(product);
    setEditingPlan(plan);
    setPlanName(plan.name);
    setPlanPrice(plan.price);
    setPlanCurrency(plan.currency as 'LKR' | 'USD');
    setPlanBillingType(plan.billingType);
    setPlanIsPopular(!!plan.isPopular);
    setPlanBadge(plan.badge || '');

    const specs = (plan.specsJson as any) || {};

    if (product.category === 'vps') {
      setVpsCpuCores(specs.cpuCores ?? 2);
      setVpsRamGb(specs.ramGb ?? specs.ramGB ?? 4);
      setVpsStorageGb(specs.storageGb ?? specs.storageGB ?? 80);
      setVpsBandwidth(specs.bandwidth ?? 'Unmetered 1Gbps');
      setVpsRegion(specs.region ?? 'Frankfurt, Germany');
      setVpsProvider(specs.provider ?? 'Leaseweb Enterprise');
      setVpsDedicatedIpv4(!!specs.dedicatedIpv4);
      setVpsRootSsh(specs.rootSsh !== false);
    } else if (product.category === 'smtp') {
      setSmtpMailboxesCount(specs.mailboxesCount ?? 1);
      setSmtpStorageGb(specs.storageLimitGb ?? specs.storageGb ?? 5);
      setSmtpForwardingRules(specs.forwardingRules ?? 5);
      setSmtpMaxAliases(specs.maxAliases ?? specs.emailAliases ?? 5);
      setSmtpDailyQuota(specs.dailyQuota ?? 2500);
      setSmtpMinCommitmentMonths(specs.minCommitmentMonths ?? 3);
    } else if (product.category === 'web_hosting') {
      setWebStorageGb(specs.storageGb ?? 10);
      setWebBandwidthGb(specs.bandwidthGb ?? 500);
      setWebDomainsCount(specs.domainsCount ?? 1);
      setWebGitAutoDeploy(specs.gitAutoDeploy !== false);
      setWebAutoSsl(specs.autoSsl !== false);
    } else if (product.category === 'database') {
      setDbRamMb(specs.ramMb ?? 1024);
      setDbCpuCores(specs.cpuCores ?? 1.0);
      setDbStorageGb(specs.storageGb ?? 10);
      setDbEngines(Array.isArray(specs.engines) ? specs.engines.join(', ') : (specs.engines || 'PostgreSQL 16, MySQL 8, Redis 7, MongoDB 6'));
      setDbConnectionPooling(specs.connectionPooling !== false);
      setDbAutoBackups(specs.autoBackups !== false);
    } else if (product.category === 'bot_hosting') {
      setBotRamMb(specs.ramMb ?? specs.memoryMb ?? 1024);
      setBotCpuCores(specs.cpuCores ?? 1.0);
      setBotStorageGb(specs.storageGb ?? 10);
      setBotPlatforms(Array.isArray(specs.platforms) ? specs.platforms.join(', ') : (specs.platforms || 'Discord (Node/Python), WhatsApp (Baileys QR), Telegram'));
      setBotContinuousRuntime(specs.continuousRuntime !== false);
      setBotPersistentSession(specs.persistentSession !== false);
    } else {
      // app_catalog or app_deployment
      setAppRamMb(specs.ramMb ?? specs.memoryMb ?? 1024);
      setAppCpuCores(specs.cpuCores ?? 1.0);
      setAppStorageGb(specs.storageGb ?? 10);
      setAppGitAutoDeploy(specs.gitAutoDeploy !== false);
      setAppAutoSsl(specs.autoSsl !== false);
      setAppCustomDomain(specs.customDomain !== false);
    }

    setShowPlanModal(true);
  }

  async function handleSavePlan(e: React.FormEvent) {
    e.preventDefault();
    if (!targetProductForPlan || !planName.trim()) return;

    setSaving(true);
    let specsJson: any = {};
    const cat = targetProductForPlan.category;

    if (cat === 'vps') {
      specsJson = {
        cpuCores: Number(vpsCpuCores),
        ramGb: Number(vpsRamGb),
        ramGB: Number(vpsRamGb),
        storageGb: Number(vpsStorageGb),
        storageGB: Number(vpsStorageGb),
        bandwidth: vpsBandwidth.trim() || 'Unmetered 1Gbps',
        region: vpsRegion.trim() || 'Frankfurt, Germany',
        provider: vpsProvider.trim() || 'Leaseweb Enterprise',
        dedicatedIpv4: !!vpsDedicatedIpv4,
        rootSsh: !!vpsRootSsh,
        deliveryNotice: 'Delivered within 24 to 72 hours',
        features: [
          `${vpsCpuCores} vCPU Cores`,
          `${vpsRamGb} GB RAM`,
          `${vpsStorageGb} GB NVMe SSD`,
          vpsBandwidth.trim() || 'Unmetered 1Gbps',
          `Region: ${vpsRegion.trim() || 'Frankfurt, Germany'}`,
          `Provider: ${vpsProvider.trim() || 'Leaseweb Enterprise'}`,
          vpsDedicatedIpv4 ? 'Dedicated IPv4 Address' : 'Shared IPv4 with Dedicated Ports',
          'Full Root SSH Access',
          'Delivered within 24 to 72 hours',
        ],
      };
    } else if (cat === 'smtp') {
      specsJson = {
        mailboxesCount: Number(smtpMailboxesCount),
        storageLimitGb: Number(smtpStorageGb),
        storageQuotaMb: Number(smtpStorageGb) === -1 ? -1 : Number(smtpStorageGb) * 1024,
        forwardingRules: Number(smtpForwardingRules),
        emailAliases: Number(smtpMaxAliases),
        maxAliases: Number(smtpMaxAliases),
        dailyQuota: Number(smtpDailyQuota),
        minCommitmentMonths: Number(smtpMinCommitmentMonths) || 3,
        features: [
          `${smtpMailboxesCount === -1 ? 'Unlimited' : smtpMailboxesCount} Mailbox${smtpMailboxesCount !== 1 ? 'es' : ''} Included`,
          `${smtpStorageGb === -1 ? 'Unlimited' : smtpStorageGb} GB Storage`,
          `${smtpForwardingRules === -1 ? 'Unlimited' : smtpForwardingRules} Forwarding Rules`,
          `${smtpMaxAliases === -1 ? 'Unlimited' : smtpMaxAliases} Email Aliases`,
          `${Number(smtpDailyQuota).toLocaleString()} Daily Send Quota`,
          'Webmail & SMTP/IMAP Access',
          `Min ${smtpMinCommitmentMonths || 3}-Month Commitment`,
        ],
      };
    } else if (cat === 'web_hosting') {
      specsJson = {
        storageGb: Number(webStorageGb),
        bandwidthGb: Number(webBandwidthGb),
        domainsCount: Number(webDomainsCount),
        gitAutoDeploy: !!webGitAutoDeploy,
        autoSsl: !!webAutoSsl,
        slotCount: 1,
        features: [
          '1 Website Hosting Slot',
          `${webStorageGb} GB High-Speed NVMe SSD`,
          `${webBandwidthGb} GB Bandwidth`,
          `${webDomainsCount === -1 ? 'Unlimited' : webDomainsCount} Custom Domain`,
          'GitHub Auto-Deploy on Push',
          'Free Auto SSL Certificates',
          'Buy more to host additional sites',
        ],
      };
    } else if (cat === 'database') {
      specsJson = {
        ramMb: Number(dbRamMb),
        cpuCores: Number(dbCpuCores),
        storageGb: Number(dbStorageGb),
        engines: dbEngines.split(',').map((s) => s.trim()).filter(Boolean),
        connectionPooling: !!dbConnectionPooling,
        autoBackups: !!dbAutoBackups,
        slotCount: 1,
        features: [
          '1 Managed Database Container',
          `${dbRamMb >= 1024 ? `${dbRamMb / 1024} GB` : `${dbRamMb} MB`} Dedicated RAM`,
          `${dbCpuCores} vCPU Core`,
          `${dbStorageGb} GB NVMe Storage`,
          dbEngines,
          'PgBouncer Connection Pooling',
          'Automated Daily Backups',
          'Buy more for additional databases',
        ],
      };
    } else if (cat === 'bot_hosting') {
      specsJson = {
        ramMb: Number(botRamMb),
        memoryMb: Number(botRamMb),
        cpuCores: Number(botCpuCores),
        storageGb: Number(botStorageGb),
        continuousRuntime: !!botContinuousRuntime,
        autoRestart: true,
        persistentSession: !!botPersistentSession,
        slotCount: 1,
        platforms: botPlatforms.split(',').map((s) => s.trim()).filter(Boolean),
        features: [
          '1 Dedicated 24/7 Bot Runner Slot',
          `${botRamMb >= 1024 ? `${botRamMb / 1024} GB` : `${botRamMb} MB`} RAM`,
          `${botCpuCores} vCPU Dedicated`,
          `${botStorageGb} GB NVMe Storage`,
          botPlatforms,
          'Automatic Crash Recovery',
          'Buy more to run additional bots',
        ],
      };
    } else {
      // app_catalog or app_deployment
      specsJson = {
        ramMb: Number(appRamMb),
        memoryMb: Number(appRamMb),
        cpuCores: Number(appCpuCores),
        storageGb: Number(appStorageGb),
        gitAutoDeploy: !!appGitAutoDeploy,
        autoSsl: !!appAutoSsl,
        customDomain: !!appCustomDomain,
        slotCount: 1,
        features: [
          cat === 'app_catalog' ? '1 One-Click App Stack Slot' : '1 Container App Deployment Slot',
          `${appRamMb >= 1024 ? `${appRamMb / 1024} GB` : `${appRamMb} MB`} RAM`,
          `${appCpuCores} vCPU Dedicated`,
          `${appStorageGb} GB NVMe Storage`,
          cat === 'app_catalog' ? '15+ Docker Compose Stacks' : 'GitHub Push-to-Deploy Webhooks',
          'Automatic SSL Routing & Custom Subdomain',
          'Buy more for additional instances',
        ],
      };
    }

    try {
      if (editingPlan) {
        await api.products.updatePlan(editingPlan.id, {
          name: planName.trim(),
          price: Number(planPrice),
          currency: planCurrency,
          billingType: planBillingType,
          isPopular: planIsPopular,
          badge: planBadge.trim() || null,
          specsJson,
        });
      } else {
        await api.products.createPlan(targetProductForPlan.id, {
          name: planName.trim(),
          price: Number(planPrice),
          currency: planCurrency,
          billingType: planBillingType,
          isPopular: planIsPopular,
          badge: planBadge.trim() || null,
          specsJson,
        });
      }
      setShowPlanModal(false);
      setEditingPlan(null);
      setTargetProductForPlan(null);
      fetchCatalog();
    } catch (err: any) {
      alert(`Failed to save plan: ${err.message}`);
    } finally {
      setSaving(false);
    }
  }

  async function handleTogglePlan(plan: Plan) {
    try {
      const nextActive = plan.isActive === false;
      await api.products.togglePlan(plan.id, nextActive);
      fetchCatalog();
    } catch (err: any) {
      alert(`Failed to update plan status: ${err.message}`);
    }
  }

  async function handleDeletePlan(plan: Plan) {
    if (!confirm(`Are you sure you want to permanently delete plan "${plan.name}"? If customers have ordered this plan in the past, it will be safely deactivated and hidden from the storefront instead of breaking order history.`)) return;
    try {
      const res = await api.products.deletePlan(plan.id);
      if (res.message) alert(res.message);
      fetchCatalog();
    } catch (err: any) {
      alert(err.message);
    }
  }

  // Filtered list
  const filteredProducts = products.filter((prod) => {
    const matchesTab = activeTab === 'all' || prod.category === activeTab;
    const matchesSearch =
      searchQuery === '' ||
      prod.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      prod.category.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesTab && matchesSearch;
  });

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto space-y-6 animate-fade-in font-sans">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-white/10 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-white/5 text-white border border-white/15 flex items-center gap-1.5 font-mono">
              <ShieldCheckIcon className="h-3.5 w-3.5" /> Admin &amp; Dev Control Center
            </span>
            <span className="text-xs text-text-faint font-mono">• 7 Configured Categories</span>
          </div>
          <h1 className="text-2xl font-bold text-white mt-2.5 flex items-center gap-2 tracking-tight">
            Products &amp; Pricing Plans
          </h1>
          <p className="text-xs text-text-muted mt-1 max-w-2xl">
            Unified catalog manager for VPS, SMTP &amp; Email, Web Hosting, Managed Databases, App Catalog, Bot Hosting, and App Deployment.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          <div className="w-full sm:w-64">
            <input
              type="text"
              placeholder="Search products or plans..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-[#0a0a0c] border border-white/10 rounded-xl px-3.5 py-2 text-xs text-white placeholder-text-muted focus:outline-none focus:border-white/30 font-mono"
            />
          </div>
          <button
            onClick={() => openAddPlanModal(null)}
            className="px-4 py-2 rounded-xl bg-white text-black hover:bg-neutral-200 text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-md shadow-white/10 whitespace-nowrap"
          >
            <PlusIcon className="h-3.5 w-3.5" /> Add Plan
          </button>
        </div>
      </div>

      {/* Category Tabs */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
        {CATEGORY_TABS.map((tab) => {
          const Icon = tab.icon;
          const count = tab.id === 'all'
            ? products.reduce((acc, p) => acc + p.plans.length, 0)
            : (products.find((p) => p.category === tab.id)?.plans.length ?? 0);

          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all flex items-center gap-1.5 cursor-pointer ${
                activeTab === tab.id
                  ? 'bg-white text-black font-bold shadow-md shadow-white/10'
                  : 'bg-white/5 text-white/70 hover:bg-white/10 hover:text-white border border-white/10'
              }`}
            >
              <Icon className="h-3.5 w-3.5" />
              <span>{tab.label}</span>
              <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${activeTab === tab.id ? 'bg-black text-white' : 'bg-white/10 text-white/60'}`}>
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Main Catalog View */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-80 bg-white/5 rounded-2xl animate-pulse border border-white/10" />
          ))}
        </div>
      ) : error ? (
        <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-xs text-red-400 font-mono">
          {error}
        </div>
      ) : filteredProducts.length === 0 ? (
        <div className="bg-[#0a0a0c] border border-white/10 rounded-2xl p-10 text-center space-y-3">
          <ServerIcon className="h-10 w-10 text-text-muted mx-auto" />
          <p className="text-sm font-semibold text-white">No products found in this category.</p>
          <p className="text-xs text-text-muted">Database products will appear automatically once seeded.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {filteredProducts.map((product) => (
            <div
              key={product.id}
              className="bg-[#0a0a0c] border border-white/10 hover:border-white/20 rounded-2xl p-6 space-y-5 transition-all relative overflow-hidden"
            >
              {/* Product Top Header */}
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-white/10 pb-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-white/10 text-white border border-white/20 font-mono">
                      Category: {product.category.replace('_', ' ')}
                    </span>
                    {product.isPopular && (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20 flex items-center gap-1 font-mono">
                        <SparklesIcon className="h-3 w-3" /> {product.badge || 'Popular User Choice'}
                      </span>
                    )}
                  </div>
                  <h2 className="text-lg font-bold text-white tracking-tight">{product.name}</h2>
                  <p className="text-xs text-text-muted max-w-3xl leading-relaxed">{product.description}</p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => openAddPlanModal(product)}
                    className="px-3.5 py-1.5 rounded-xl bg-white text-black hover:bg-neutral-200 text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-md shadow-white/10"
                  >
                    <PlusIcon className="h-3.5 w-3.5" /> Add Plan
                  </button>
                  <button
                    onClick={() => openEditProductModal(product)}
                    className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-text-muted hover:text-white transition-all border border-white/10"
                    title="Edit Product Info"
                  >
                    <PencilIcon className="h-4 w-4" />
                  </button>
                </div>
              </div>

              {/* Nested Pricing Plans Cards */}
              {product.plans.length === 0 ? (
                <div className="p-6 bg-white/[0.02] border border-dashed border-white/10 rounded-xl text-center">
                  <p className="text-xs text-text-muted">No pricing plans configured for this product yet.</p>
                  <button
                    onClick={() => openAddPlanModal(product)}
                    className="mt-2 text-xs text-white hover:underline font-semibold"
                  >
                    + Add standard pricing plan
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                  {product.plans.map((plan) => {
                    const specs = (plan.specsJson as any) || {};
                    const cat = product.category;

                    const isDeactivated = plan.isActive === false;

                    return (
                      <div
                        key={plan.id}
                        className={`bg-[#0c0d12] border rounded-2xl p-5 space-y-4 flex flex-col justify-between transition-all relative ${
                          isDeactivated
                            ? 'border-amber-500/30 bg-[#0c0d12]/75 opacity-80'
                            : plan.isPopular
                            ? 'border-white/30 shadow-lg shadow-white/5'
                            : 'border-white/10 hover:border-white/20'
                        }`}
                      >
                        {plan.isPopular && !isDeactivated && (
                          <div className="absolute -top-2.5 right-3 px-2 py-0.5 rounded-full bg-white text-black text-[9px] font-mono font-bold shadow-md flex items-center gap-1">
                            <SparklesIcon className="h-3 w-3 text-black" /> {plan.badge || 'Popular'}
                          </div>
                        )}

                        <div className="space-y-3">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2 flex-wrap">
                              <h3 className="text-sm font-bold text-white tracking-tight">{plan.name}</h3>
                              {isDeactivated && (
                                <span className="text-[9px] font-mono font-bold px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/30 flex items-center gap-1">
                                  <EyeOffIcon className="h-2.5 w-2.5" /> Deactivated (Hidden)
                                </span>
                              )}
                            </div>
                            <span className="text-[10px] text-white/60 uppercase font-mono bg-white/5 border border-white/10 px-2 py-0.5 rounded-full">
                              {plan.billingType}
                            </span>
                          </div>

                          {/* Direct Price Tag */}
                          <div className="p-3 bg-white/[0.03] border border-white/5 rounded-xl space-y-0.5">
                            <span className="text-[10px] text-white/50 font-mono">Retail Price:</span>
                            <div className="flex items-baseline gap-1">
                              <span className="text-xl font-extrabold text-white font-mono">
                                LKR {(plan.price / 100).toLocaleString()}
                              </span>
                              <span className="text-[11px] text-white/50 font-mono">
                                /{plan.billingType === 'quarterly' ? '3mo' : plan.billingType === 'yearly' ? 'yr' : 'mo'}
                              </span>
                            </div>
                          </div>

                          {/* Category-Tailored Specs Summary */}
                          <div className="space-y-1.5 text-xs text-white/70 font-mono pt-1">
                            {/* VPS SPECS */}
                            {cat === 'vps' && (
                              <>
                                <p className="flex justify-between border-b border-white/5 pb-1">
                                  <span>CPU:</span> <span className="text-white font-bold">{specs.cpuCores ?? 2} vCPU</span>
                                </p>
                                <p className="flex justify-between border-b border-white/5 pb-1">
                                  <span>RAM:</span> <span className="text-white font-bold">{specs.ramGb ?? specs.ramGB ?? 4} GB</span>
                                </p>
                                <p className="flex justify-between border-b border-white/5 pb-1">
                                  <span>Storage:</span> <span className="text-white font-bold">{specs.storageGb ?? specs.storageGB ?? 80} GB NVMe</span>
                                </p>
                                <p className="flex justify-between border-b border-white/5 pb-1">
                                  <span>Bandwidth:</span> <span className="text-white font-bold">{specs.bandwidth ?? '1Gbps'}</span>
                                </p>
                                <p className="flex justify-between border-b border-white/5 pb-1">
                                  <span>Region:</span> <span className="text-white font-bold">{specs.region ?? 'Frankfurt'}</span>
                                </p>
                                <p className="flex justify-between">
                                  <span>Provider:</span> <span className="text-white font-bold">{specs.provider ?? 'Leaseweb'}</span>
                                </p>
                              </>
                            )}

                            {/* SMTP SPECS */}
                            {cat === 'smtp' && (
                              <>
                                <p className="flex justify-between border-b border-white/5 pb-1">
                                  <span>Mailboxes:</span> <span className="text-white font-bold">{specs.mailboxesCount === -1 ? 'Unlimited' : (specs.mailboxesCount ?? 1)}</span>
                                </p>
                                <p className="flex justify-between border-b border-white/5 pb-1">
                                  <span>Storage:</span> <span className="text-white font-bold">{specs.storageLimitGb === -1 ? 'Unlimited' : `${specs.storageLimitGb ?? 5} GB`}</span>
                                </p>
                                <p className="flex justify-between border-b border-white/5 pb-1">
                                  <span>Aliases:</span> <span className="text-white font-bold">{specs.maxAliases === -1 ? 'Unlimited' : (specs.maxAliases ?? 5)}</span>
                                </p>
                                <p className="flex justify-between border-b border-white/5 pb-1">
                                  <span>Rules:</span> <span className="text-white font-bold">{specs.forwardingRules === -1 ? 'Unlimited' : (specs.forwardingRules ?? 5)}</span>
                                </p>
                                <p className="flex justify-between">
                                  <span>Daily Quota:</span> <span className="text-white font-bold">{specs.dailyQuota ?? 2500}/day</span>
                                </p>
                              </>
                            )}

                            {/* WEB HOSTING SPECS */}
                            {cat === 'web_hosting' && (
                              <>
                                <p className="flex justify-between border-b border-white/5 pb-1">
                                  <span>Instance:</span> <span className="text-white font-bold">1 Website Slot</span>
                                </p>
                                <p className="flex justify-between border-b border-white/5 pb-1">
                                  <span>Storage:</span> <span className="text-white font-bold">{specs.storageGb ?? 10} GB NVMe</span>
                                </p>
                                <p className="flex justify-between border-b border-white/5 pb-1">
                                  <span>Bandwidth:</span> <span className="text-white font-bold">{specs.bandwidthGb ?? 500} GB</span>
                                </p>
                                <p className="flex justify-between">
                                  <span>Git Auto-Deploy:</span> <span className="text-white font-bold">Included</span>
                                </p>
                              </>
                            )}

                            {/* MANAGED DATABASES SPECS */}
                            {cat === 'database' && (
                              <>
                                <p className="flex justify-between border-b border-white/5 pb-1">
                                  <span>Container:</span> <span className="text-white font-bold">1 DB Slot</span>
                                </p>
                                <p className="flex justify-between border-b border-white/5 pb-1">
                                  <span>Dedicated RAM:</span> <span className="text-white font-bold">{specs.ramMb ?? 1024} MB</span>
                                </p>
                                <p className="flex justify-between border-b border-white/5 pb-1">
                                  <span>Storage:</span> <span className="text-white font-bold">{specs.storageGb ?? 10} GB NVMe</span>
                                </p>
                                <p className="flex justify-between">
                                  <span>Engines:</span> <span className="text-white font-bold">PG/MySQL/Redis/Mongo</span>
                                </p>
                              </>
                            )}

                            {/* APP CATALOG SPECS */}
                            {cat === 'app_catalog' && (
                              <>
                                <p className="flex justify-between border-b border-white/5 pb-1">
                                  <span>Stack:</span> <span className="text-white font-bold">1 App Stack Slot</span>
                                </p>
                                <p className="flex justify-between border-b border-white/5 pb-1">
                                  <span>RAM:</span> <span className="text-white font-bold">{specs.ramMb ?? 1024} MB</span>
                                </p>
                                <p className="flex justify-between border-b border-white/5 pb-1">
                                  <span>Storage:</span> <span className="text-white font-bold">{specs.storageGb ?? 10} GB NVMe</span>
                                </p>
                                <p className="flex justify-between">
                                  <span>Templates:</span> <span className="text-white font-bold">15+ Docker Stacks</span>
                                </p>
                              </>
                            )}

                            {/* BOT HOSTING SPECS */}
                            {cat === 'bot_hosting' && (
                              <>
                                <p className="flex justify-between border-b border-white/5 pb-1">
                                  <span>Runner:</span> <span className="text-white font-bold">1 Bot Slot (24/7)</span>
                                </p>
                                <p className="flex justify-between border-b border-white/5 pb-1">
                                  <span>RAM:</span> <span className="text-white font-bold">{specs.ramMb ?? 1024} MB</span>
                                </p>
                                <p className="flex justify-between border-b border-white/5 pb-1">
                                  <span>Storage:</span> <span className="text-white font-bold">{specs.storageGb ?? 10} GB NVMe</span>
                                </p>
                                <p className="flex justify-between">
                                  <span>Platforms:</span> <span className="text-white font-bold">Discord/WA/Telegram</span>
                                </p>
                              </>
                            )}

                            {/* APP DEPLOYMENT SPECS */}
                            {cat === 'app_deployment' && (
                              <>
                                <p className="flex justify-between border-b border-white/5 pb-1">
                                  <span>Deployment:</span> <span className="text-white font-bold">1 Container Slot</span>
                                </p>
                                <p className="flex justify-between border-b border-white/5 pb-1">
                                  <span>RAM:</span> <span className="text-white font-bold">{specs.ramMb ?? 1024} MB</span>
                                </p>
                                <p className="flex justify-between border-b border-white/5 pb-1">
                                  <span>Storage:</span> <span className="text-white font-bold">{specs.storageGb ?? 10} GB NVMe</span>
                                </p>
                                <p className="flex justify-between">
                                  <span>Pipeline:</span> <span className="text-white font-bold">GitHub Webhook SSL</span>
                                </p>
                              </>
                            )}
                          </div>
                        </div>

                        {/* Plan Actions */}
                        <div className="pt-3 border-t border-white/10 flex items-center justify-between gap-1.5">
                          <button
                            onClick={() => openEditPlanModal(product, plan)}
                            className="flex-1 py-1.5 px-2 rounded-lg bg-white/5 hover:bg-white/10 text-xs font-semibold text-white transition-all flex items-center justify-center gap-1 cursor-pointer border border-white/10"
                          >
                            <PencilIcon className="h-3.5 w-3.5" /> Edit
                          </button>
                          <button
                            onClick={() => handleTogglePlan(plan)}
                            className={`py-1.5 px-2.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1 cursor-pointer border ${
                              isDeactivated
                                ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30 hover:bg-emerald-500/30'
                                : 'bg-white/5 text-amber-300 border-amber-500/20 hover:bg-amber-500/20'
                            }`}
                            title={isDeactivated ? 'Activate plan (display in storefront)' : 'Deactivate plan (hide from storefront)'}
                          >
                            {isDeactivated ? (
                              <>
                                <CheckIcon className="h-3.5 w-3.5 text-emerald-400" /> Activate
                              </>
                            ) : (
                              <>
                                <EyeOffIcon className="h-3.5 w-3.5 text-amber-400" /> Deactivate
                              </>
                            )}
                          </button>
                          <button
                            onClick={() => handleDeletePlan(plan)}
                            className="p-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 transition-all cursor-pointer border border-red-500/20"
                            title="Delete Plan Permanently"
                          >
                            <TrashIcon className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* EDIT PRODUCT MODAL (Category is fixed/hardcoded) */}
      {showProductModal && editingProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-[#0f1021] border border-white/15 rounded-2xl p-6 max-w-lg w-full space-y-4 shadow-2xl">
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <PencilIcon className="h-5 w-5 text-white" />
              Edit Product Details
            </h3>

            <form onSubmit={handleSaveProduct} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-text-muted mb-1 font-mono">Category (Fixed)</label>
                <input
                  type="text"
                  value={prodCategory.toUpperCase().replace('_', ' ')}
                  disabled
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-3.5 py-2 text-sm text-white/50 font-mono cursor-not-allowed"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-text-muted mb-1 font-mono">Product Title *</label>
                <input
                  type="text"
                  value={prodName}
                  onChange={(e) => setProdName(e.target.value)}
                  required
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-3.5 py-2 text-sm text-white focus:outline-none focus:border-white/30"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-text-muted mb-1 font-mono">Description</label>
                <textarea
                  value={prodDesc}
                  onChange={(e) => setProdDesc(e.target.value)}
                  rows={2}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-white/30 resize-none"
                />
              </div>

              {/* Popular User Badge Toggles */}
              <div className="p-3.5 bg-white/[0.03] border border-white/10 rounded-xl space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-xs font-bold text-white flex items-center gap-1.5 font-mono">
                      <SparklesIcon className="h-4 w-4 text-amber-400" /> Featured Badge
                    </span>
                    <p className="text-[11px] text-text-muted">Highlights product on storefront catalog</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={prodIsPopular}
                    onChange={(e) => setProdIsPopular(e.target.checked)}
                    className="h-4 w-4 rounded bg-white/10 border-white/20 text-white focus:ring-0"
                  />
                </div>

                {prodIsPopular && (
                  <div>
                    <label className="block text-xs font-semibold text-text-muted mb-1 font-mono">Custom Badge Label</label>
                    <input
                      type="text"
                      placeholder="e.g. Popular Choice, Recommended"
                      value={prodBadge}
                      onChange={(e) => setProdBadge(e.target.value)}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none focus:border-white/30"
                    />
                  </div>
                )}
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-white/10">
                <button
                  type="button"
                  onClick={() => setShowProductModal(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-text-muted hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-5 py-2 rounded-xl bg-white hover:bg-neutral-200 text-xs font-bold text-black disabled:opacity-50"
                >
                  {saving ? 'Saving...' : 'Save Product'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CREATE / EDIT PLAN MODAL */}
      {showPlanModal && targetProductForPlan && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-[#0f1021] border border-white/15 rounded-2xl p-6 max-w-lg w-full space-y-4 shadow-2xl max-h-[90vh] overflow-y-auto">
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <TagIcon className="h-5 w-5 text-white" />
              {editingPlan ? `Edit Plan for ${targetProductForPlan.name}` : `Add Plan to ${targetProductForPlan.name}`}
            </h3>

            <form onSubmit={handleSavePlan} className="space-y-4">
              {!editingPlan && (
                <div>
                  <label className="block text-xs font-semibold text-text-muted mb-1 font-mono">Target Category / Product *</label>
                  <select
                    value={targetProductForPlan.id}
                    onChange={(e) => {
                      const prod = products.find((p) => p.id === e.target.value);
                      if (prod) {
                        setTargetProductForPlan(prod);
                        if (prod.category === 'vps') {
                          setPlanPrice(500000);
                          setPlanBillingType('monthly');
                        } else if (prod.category === 'smtp') {
                          setPlanPrice(1050000);
                          setPlanBillingType('quarterly');
                        } else {
                          setPlanPrice(120000);
                          setPlanBillingType('monthly');
                        }
                      }
                    }}
                    className="w-full bg-[#0a0a0c] border border-white/10 rounded-xl px-3.5 py-2 text-sm text-white focus:outline-none focus:border-white/30 font-mono"
                  >
                    {products.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} ({CATEGORY_TABS.find((t) => t.id === p.category)?.label || p.category})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-text-muted mb-1 font-mono">Plan Name *</label>
                <input
                  type="text"
                  placeholder="e.g. VPS Standard, Web Hosting Plan, Pro Email"
                  value={planName}
                  onChange={(e) => setPlanName(e.target.value)}
                  required
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-3.5 py-2 text-sm text-white focus:outline-none focus:border-white/30 font-mono"
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-text-muted mb-1 font-mono">Direct Price (cents) *</label>
                  <input
                    type="number"
                    value={planPrice}
                    onChange={(e) => setPlanPrice(Number(e.target.value))}
                    required
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-white/30 font-mono"
                  />
                  <span className="text-[10px] text-white/50 font-mono mt-0.5 block">
                    = LKR {(planPrice / 100).toLocaleString()}
                  </span>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-text-muted mb-1 font-mono">Currency</label>
                  <select
                    value={planCurrency}
                    onChange={(e: any) => setPlanCurrency(e.target.value)}
                    className="w-full bg-[#0a0a0c] border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-white/30 font-mono"
                  >
                    <option value="LKR">LKR (Rs)</option>
                    <option value="USD">USD ($)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-text-muted mb-1 font-mono">Billing Cycle</label>
                  <select
                    value={planBillingType}
                    onChange={(e: any) => setPlanBillingType(e.target.value)}
                    className="w-full bg-[#0a0a0c] border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-white/30 font-mono"
                  >
                    <option value="monthly">Monthly</option>
                    <option value="quarterly">Quarterly</option>
                    <option value="yearly">Yearly</option>
                    <option value="semiannual">Semi-annual</option>
                    <option value="one_time">One-time</option>
                  </select>
                </div>
              </div>

              {/* ─────────────────────────────────────────────────────────────
                  CATEGORY-SPECIFIC INPUT CONTROLS
              ───────────────────────────────────────────────────────────── */}

              {/* VPS FIELDS */}
              {targetProductForPlan.category === 'vps' && (
                <div className="p-3.5 bg-white/[0.02] border border-white/10 rounded-xl space-y-3 font-mono">
                  <span className="text-xs font-bold text-white uppercase tracking-wider block">VPS Compute &amp; Hardware Specs</span>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] text-text-muted mb-1">RAM (GB)</label>
                      <input
                        type="number"
                        value={vpsRamGb}
                        onChange={(e) => setVpsRamGb(Number(e.target.value))}
                        className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-1.5 text-xs text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] text-text-muted mb-1">CPU Cores</label>
                      <input
                        type="number"
                        value={vpsCpuCores}
                        onChange={(e) => setVpsCpuCores(Number(e.target.value))}
                        className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-1.5 text-xs text-white"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] text-text-muted mb-1">SSD Storage (GB)</label>
                      <input
                        type="number"
                        value={vpsStorageGb}
                        onChange={(e) => setVpsStorageGb(Number(e.target.value))}
                        className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-1.5 text-xs text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] text-text-muted mb-1">Bandwidth</label>
                      <input
                        type="text"
                        value={vpsBandwidth}
                        onChange={(e) => setVpsBandwidth(e.target.value)}
                        className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-1.5 text-xs text-white"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] text-text-muted mb-1">Region / Datacenter</label>
                      <input
                        type="text"
                        value={vpsRegion}
                        onChange={(e) => setVpsRegion(e.target.value)}
                        placeholder="Frankfurt, Germany"
                        className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-1.5 text-xs text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] text-text-muted mb-1">Provider</label>
                      <input
                        type="text"
                        value={vpsProvider}
                        onChange={(e) => setVpsProvider(e.target.value)}
                        placeholder="Leaseweb Enterprise"
                        className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-1.5 text-xs text-white"
                      />
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-1 text-xs">
                    <label className="flex items-center gap-2 text-white">
                      <input
                        type="checkbox"
                        checked={vpsDedicatedIpv4}
                        onChange={(e) => setVpsDedicatedIpv4(e.target.checked)}
                      />
                      Dedicated IPv4
                    </label>
                    <label className="flex items-center gap-2 text-white">
                      <input
                        type="checkbox"
                        checked={vpsRootSsh}
                        onChange={(e) => setVpsRootSsh(e.target.checked)}
                      />
                      Full Root SSH
                    </label>
                  </div>
                </div>
              )}

              {/* SMTP FIELDS */}
              {targetProductForPlan.category === 'smtp' && (
                <div className="p-3.5 bg-white/[0.02] border border-white/10 rounded-xl space-y-3 font-mono">
                  <span className="text-xs font-bold text-white uppercase tracking-wider block">SMTP &amp; Email Quotas</span>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] text-text-muted mb-1">Mailboxes Limit (-1 for unlim)</label>
                      <input
                        type="number"
                        value={smtpMailboxesCount}
                        onChange={(e) => setSmtpMailboxesCount(Number(e.target.value))}
                        className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-1.5 text-xs text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] text-text-muted mb-1">Storage Limit GB (-1 for unlim)</label>
                      <input
                        type="number"
                        value={smtpStorageGb}
                        onChange={(e) => setSmtpStorageGb(Number(e.target.value))}
                        className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-1.5 text-xs text-white"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] text-text-muted mb-1">Email Aliases Limit</label>
                      <input
                        type="number"
                        value={smtpMaxAliases}
                        onChange={(e) => setSmtpMaxAliases(Number(e.target.value))}
                        className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-1.5 text-xs text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] text-text-muted mb-1">Forwarding Rules Limit</label>
                      <input
                        type="number"
                        value={smtpForwardingRules}
                        onChange={(e) => setSmtpForwardingRules(Number(e.target.value))}
                        className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-1.5 text-xs text-white"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] text-text-muted mb-1">Daily Send Quota</label>
                      <input
                        type="number"
                        value={smtpDailyQuota}
                        onChange={(e) => setSmtpDailyQuota(Number(e.target.value))}
                        className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-1.5 text-xs text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] text-text-muted mb-1">Min Commitment Months</label>
                      <input
                        type="number"
                        value={smtpMinCommitmentMonths}
                        onChange={(e) => setSmtpMinCommitmentMonths(Number(e.target.value))}
                        className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-1.5 text-xs text-white"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* WEB HOSTING FIELDS */}
              {targetProductForPlan.category === 'web_hosting' && (
                <div className="p-3.5 bg-white/[0.02] border border-white/10 rounded-xl space-y-3 font-mono">
                  <span className="text-xs font-bold text-white uppercase tracking-wider block">Web Hosting Quotas (1 Slot per Site)</span>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] text-text-muted mb-1">NVMe Storage (GB)</label>
                      <input
                        type="number"
                        value={webStorageGb}
                        onChange={(e) => setWebStorageGb(Number(e.target.value))}
                        className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-1.5 text-xs text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] text-text-muted mb-1">Bandwidth (GB)</label>
                      <input
                        type="number"
                        value={webBandwidthGb}
                        onChange={(e) => setWebBandwidthGb(Number(e.target.value))}
                        className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-1.5 text-xs text-white"
                      />
                    </div>
                  </div>
                  <div className="flex items-center gap-4 pt-1 text-xs">
                    <label className="flex items-center gap-2 text-white">
                      <input
                        type="checkbox"
                        checked={webGitAutoDeploy}
                        onChange={(e) => setWebGitAutoDeploy(e.target.checked)}
                      />
                      GitHub Auto-Deploy
                    </label>
                    <label className="flex items-center gap-2 text-white">
                      <input
                        type="checkbox"
                        checked={webAutoSsl}
                        onChange={(e) => setWebAutoSsl(e.target.checked)}
                      />
                      Free Auto-SSL
                    </label>
                  </div>
                </div>
              )}

              {/* MANAGED DATABASES FIELDS */}
              {targetProductForPlan.category === 'database' && (
                <div className="p-3.5 bg-white/[0.02] border border-white/10 rounded-xl space-y-3 font-mono">
                  <span className="text-xs font-bold text-white uppercase tracking-wider block">Database Quotas (1 Container per Slot)</span>
                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <label className="block text-[11px] text-text-muted mb-1">RAM (MB)</label>
                      <input
                        type="number"
                        value={dbRamMb}
                        onChange={(e) => setDbRamMb(Number(e.target.value))}
                        className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-1.5 text-xs text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] text-text-muted mb-1">CPU Cores</label>
                      <input
                        type="number"
                        value={dbCpuCores}
                        onChange={(e) => setDbCpuCores(Number(e.target.value))}
                        step="0.5"
                        className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-1.5 text-xs text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] text-text-muted mb-1">Storage (GB)</label>
                      <input
                        type="number"
                        value={dbStorageGb}
                        onChange={(e) => setDbStorageGb(Number(e.target.value))}
                        className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-1.5 text-xs text-white"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-[11px] text-text-muted mb-1">Engines Supported</label>
                    <input
                      type="text"
                      value={dbEngines}
                      onChange={(e) => setDbEngines(e.target.value)}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-1.5 text-xs text-white"
                    />
                  </div>
                  <div className="flex items-center gap-4 pt-1 text-xs">
                    <label className="flex items-center gap-2 text-white">
                      <input
                        type="checkbox"
                        checked={dbConnectionPooling}
                        onChange={(e) => setDbConnectionPooling(e.target.checked)}
                      />
                      PgBouncer Pooling
                    </label>
                    <label className="flex items-center gap-2 text-white">
                      <input
                        type="checkbox"
                        checked={dbAutoBackups}
                        onChange={(e) => setDbAutoBackups(e.target.checked)}
                      />
                      Automated Backups
                    </label>
                  </div>
                </div>
              )}

              {/* BOT HOSTING FIELDS */}
              {targetProductForPlan.category === 'bot_hosting' && (
                <div className="p-3.5 bg-white/[0.02] border border-white/10 rounded-xl space-y-3 font-mono">
                  <span className="text-xs font-bold text-white uppercase tracking-wider block">Bot Runner Quotas (1 Bot Runner per Slot)</span>
                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <label className="block text-[11px] text-text-muted mb-1">RAM (MB)</label>
                      <input
                        type="number"
                        value={botRamMb}
                        onChange={(e) => setBotRamMb(Number(e.target.value))}
                        className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-1.5 text-xs text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] text-text-muted mb-1">CPU Cores</label>
                      <input
                        type="number"
                        value={botCpuCores}
                        onChange={(e) => setBotCpuCores(Number(e.target.value))}
                        step="0.5"
                        className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-1.5 text-xs text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] text-text-muted mb-1">Storage (GB)</label>
                      <input
                        type="number"
                        value={botStorageGb}
                        onChange={(e) => setBotStorageGb(Number(e.target.value))}
                        className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-1.5 text-xs text-white"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-[11px] text-text-muted mb-1">Supported Platforms</label>
                    <input
                      type="text"
                      value={botPlatforms}
                      onChange={(e) => setBotPlatforms(e.target.value)}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-1.5 text-xs text-white"
                    />
                  </div>
                  <div className="flex items-center gap-4 pt-1 text-xs">
                    <label className="flex items-center gap-2 text-white">
                      <input
                        type="checkbox"
                        checked={botContinuousRuntime}
                        onChange={(e) => setBotContinuousRuntime(e.target.checked)}
                      />
                      24/7 Process Runner
                    </label>
                    <label className="flex items-center gap-2 text-white">
                      <input
                        type="checkbox"
                        checked={botPersistentSession}
                        onChange={(e) => setBotPersistentSession(e.target.checked)}
                      />
                      Persistent WhatsApp/Discord Session
                    </label>
                  </div>
                </div>
              )}

              {/* APP CATALOG / APP DEPLOYMENT FIELDS */}
              {(targetProductForPlan.category === 'app_catalog' || targetProductForPlan.category === 'app_deployment') && (
                <div className="p-3.5 bg-white/[0.02] border border-white/10 rounded-xl space-y-3 font-mono">
                  <span className="text-xs font-bold text-white uppercase tracking-wider block">App Container Quotas (1 Slot per App)</span>
                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <label className="block text-[11px] text-text-muted mb-1">RAM (MB)</label>
                      <input
                        type="number"
                        value={appRamMb}
                        onChange={(e) => setAppRamMb(Number(e.target.value))}
                        className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-1.5 text-xs text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] text-text-muted mb-1">CPU Cores</label>
                      <input
                        type="number"
                        value={appCpuCores}
                        onChange={(e) => setAppCpuCores(Number(e.target.value))}
                        step="0.5"
                        className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-1.5 text-xs text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] text-text-muted mb-1">Storage (GB)</label>
                      <input
                        type="number"
                        value={appStorageGb}
                        onChange={(e) => setAppStorageGb(Number(e.target.value))}
                        className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-1.5 text-xs text-white"
                      />
                    </div>
                  </div>
                  <div className="flex items-center gap-4 pt-1 text-xs">
                    <label className="flex items-center gap-2 text-white">
                      <input
                        type="checkbox"
                        checked={appGitAutoDeploy}
                        onChange={(e) => setAppGitAutoDeploy(e.target.checked)}
                      />
                      Auto Deploy Pipeline
                    </label>
                    <label className="flex items-center gap-2 text-white">
                      <input
                        type="checkbox"
                        checked={appAutoSsl}
                        onChange={(e) => setAppAutoSsl(e.target.checked)}
                      />
                      Free Auto SSL
                    </label>
                    <label className="flex items-center gap-2 text-white">
                      <input
                        type="checkbox"
                        checked={appCustomDomain}
                        onChange={(e) => setAppCustomDomain(e.target.checked)}
                      />
                      Custom Domain
                    </label>
                  </div>
                </div>
              )}

              {/* Popular Plan Badge Toggle */}
              <div className="p-3 bg-white/[0.03] border border-white/10 rounded-xl space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-xs font-bold text-white flex items-center gap-1.5 font-mono">
                      <SparklesIcon className="h-4 w-4 text-amber-400" /> Featured Badge
                    </span>
                    <p className="text-[11px] text-text-muted">Highlights plan on storefront cards</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={planIsPopular}
                    onChange={(e) => setPlanIsPopular(e.target.checked)}
                    className="h-4 w-4 rounded bg-white/10 border-white/20 text-white focus:ring-0"
                  />
                </div>

                {planIsPopular && (
                  <div>
                    <label className="block text-xs font-semibold text-text-muted mb-1 font-mono">Badge Text</label>
                    <input
                      type="text"
                      placeholder="e.g. Best Value, Recommended, 1 Slot / Site"
                      value={planBadge}
                      onChange={(e) => setPlanBadge(e.target.value)}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none focus:border-white/30"
                    />
                  </div>
                )}
              </div>

              <div className="flex items-center justify-end gap-3 pt-2 border-t border-white/10">
                <button
                  type="button"
                  onClick={() => setShowPlanModal(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-text-muted hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-5 py-2 rounded-xl bg-white hover:bg-neutral-200 text-xs font-bold text-black disabled:opacity-50"
                >
                  {saving ? 'Saving...' : 'Save Plan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
