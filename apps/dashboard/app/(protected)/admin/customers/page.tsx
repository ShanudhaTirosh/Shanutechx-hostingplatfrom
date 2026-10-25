'use client';

import { useEffect, useState, useMemo } from 'react';
import { api } from '@/lib/api';
import { Customer, CustomerDetails } from '@/lib/types';
import {
  Card,
  Spinner,
  EmptyState,
  ErrorBanner,
  formatMoney,
  Input,
  Table,
  Tr,
  Td,
  PageHeader,
  Button,
  useToast,
  Badge,
} from '@/components/ui';

export const dynamic = 'force-dynamic';

type RoleFilter = 'all' | 'customer' | 'staff' | 'banned' | 'dev' | 'admin' | 'support';

export default function AdminCustomersPage() {
  const [customers, setCustomers] = useState<Customer[] | null>(null);
  const [totalCount, setTotalCount] = useState<number>(0);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<RoleFilter>('all');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  // 360 Profile drawer/modal
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
  const [customerDetails, setCustomerDetails] = useState<CustomerDetails | null>(null);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [detailsTab, setDetailsTab] = useState<'purchases' | 'infrastructure' | 'tickets' | 'actions'>('purchases');

  // Assign admin modal
  const [assignModalUser, setAssignModalUser] = useState<Customer | null>(null);
  const [staffList, setStaffList] = useState<Array<{ id: string; email: string; displayName: string | null; role: string }>>([]);
  const [selectedAdminId, setSelectedAdminId] = useState<string>('');
  const [assigning, setAssigning] = useState(false);

  // Change role modal
  const [roleModalUser, setRoleModalUser] = useState<Customer | null>(null);
  const [selectedRole, setSelectedRole] = useState<string>('customer');
  const [changingRole, setChangingRole] = useState(false);

  // Ban modal
  const [banModalUser, setBanModalUser] = useState<Customer | null>(null);
  const [banReason, setBanReason] = useState('');
  const [banning, setBanning] = useState(false);

  function loadCustomers() {
    setLoading(true);
    let apiRole: string | undefined = undefined;
    if (roleFilter === 'customer') apiRole = 'customer';
    else if (roleFilter === 'dev') apiRole = 'dev';
    else if (roleFilter === 'admin') apiRole = 'admin';
    else if (roleFilter === 'support') apiRole = 'support';

    api.admin
      .customers({
        take: 100,
        skip: 0,
        search: search.trim() || undefined,
        role: apiRole,
      })
      .then((data) => {
        setCustomers(data.customers);
        setTotalCount(data.total);
        setError(null);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    const timeout = setTimeout(loadCustomers, 250);
    return () => clearTimeout(timeout);
  }, [search, roleFilter]);

  // Load staff list for assignment dropdown
  useEffect(() => {
    api.admin
      .staff()
      .then((data) => setStaffList(data.staff))
      .catch(() => {});
  }, []);

  // Filtered view when selecting "staff" or "banned" tabs client-side
  const filteredCustomers = useMemo(() => {
    if (!customers) return [];
    if (roleFilter === 'staff') {
      return customers.filter((c) => c.role === 'admin' || c.role === 'dev' || c.role === 'support');
    }
    if (roleFilter === 'banned') {
      return customers.filter((c) => c.isBanned);
    }
    return customers;
  }, [customers, roleFilter]);

  // Platform metrics
  const metrics = useMemo(() => {
    if (!customers) return { totalUsers: 0, customersCount: 0, staffCount: 0, totalLtv: 0 };
    const totalUsers = totalCount || customers.length;
    const customersCount = customers.filter((c) => !c.role || c.role === 'customer').length;
    const staffCount = customers.filter((c) => c.role === 'admin' || c.role === 'dev' || c.role === 'support').length;
    const totalLtv = customers.reduce((sum, c) => sum + (c.totalSpent || 0), 0);
    return { totalUsers, customersCount, staffCount, totalLtv };
  }, [customers, totalCount]);

  // Load 360 customer details
  function openCustomerDetails(userId: string) {
    setSelectedCustomerId(userId);
    setLoadingDetails(true);
    setDetailsTab('purchases');
    api.admin
      .customerDetails(userId)
      .then((data) => {
        setCustomerDetails(data.customer);
      })
      .catch((err) => {
        toast(err.message || 'Failed to load customer details', 'error');
        setSelectedCustomerId(null);
      })
      .finally(() => setLoadingDetails(false));
  }

  // Open assign admin modal
  function openAssignModal(cust: Customer) {
    setAssignModalUser(cust);
    setSelectedAdminId(cust.assignedAdminId || '');
  }

  // Handle admin assignment
  async function handleAssignAdmin() {
    if (!assignModalUser) return;
    setAssigning(true);
    try {
      await api.admin.assignCustomer(assignModalUser.id, selectedAdminId ? selectedAdminId : null);
      toast(`Managing admin updated for ${assignModalUser.email}`, 'success');
      setAssignModalUser(null);
      loadCustomers();
      if (selectedCustomerId === assignModalUser.id) {
        openCustomerDetails(assignModalUser.id);
      }
    } catch (err: any) {
      toast(err.message || 'Failed to update admin assignment', 'error');
    } finally {
      setAssigning(false);
    }
  }

  // Open role change modal
  function openRoleModal(cust: Customer) {
    setRoleModalUser(cust);
    setSelectedRole(cust.role || 'customer');
  }

  // Handle role change
  async function handleSetRole() {
    if (!roleModalUser) return;
    setChangingRole(true);
    try {
      await api.admin.setUserRole(roleModalUser.id, selectedRole);
      toast(`Role changed to ${selectedRole} for ${roleModalUser.email}`, 'success');
      setRoleModalUser(null);
      loadCustomers();
      if (selectedCustomerId === roleModalUser.id) {
        openCustomerDetails(roleModalUser.id);
      }
    } catch (err: any) {
      toast(err.message || 'Failed to update user role', 'error');
    } finally {
      setChangingRole(false);
    }
  }

  // Handle impersonation
  async function handleImpersonate(userId: string, email: string) {
    if (!confirm(`Switch to impersonating ${email}? You will see the platform as this user.`)) return;
    try {
      const res = await api.admin.impersonateUser(userId);
      toast(res.message || `Now impersonating ${email}`, 'success');
      window.location.href = '/dashboard';
    } catch (err: any) {
      toast(err.message || 'Failed to impersonate user', 'error');
    }
  }

  // Handle ban user
  async function handleBanUser() {
    if (!banModalUser) return;
    setBanning(true);
    try {
      await api.admin.banUser(banModalUser.id, banReason || 'Suspended by Admin');
      toast(`User ${banModalUser.email} has been banned and resources stopped`, 'success');
      setBanModalUser(null);
      setBanReason('');
      loadCustomers();
      if (selectedCustomerId === banModalUser.id) {
        openCustomerDetails(banModalUser.id);
      }
    } catch (err: any) {
      toast(err.message || 'Failed to ban user', 'error');
    } finally {
      setBanning(false);
    }
  }

  // Handle unban user
  async function handleUnbanUser(cust: Customer) {
    if (!confirm(`Are you sure you want to unban ${cust.email}?`)) return;
    try {
      await api.admin.unbanUser(cust.id);
      toast(`User ${cust.email} unbanned successfully`, 'success');
      loadCustomers();
      if (selectedCustomerId === cust.id) {
        openCustomerDetails(cust.id);
      }
    } catch (err: any) {
      toast(err.message || 'Failed to unban user', 'error');
    }
  }

  return (
    <div className="space-y-6 animate-fade-in pb-16">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <PageHeader
          title="Customer & User Directory"
          description="Manage all customer accounts, assign managing admins, inspect purchases & infrastructure, configure roles, and handle account suspensions."
        />
        <div className="flex items-center gap-2">
          <Button variant="secondary" onClick={loadCustomers} loading={loading}>
            Refresh
          </Button>
        </div>
      </div>

      {/* Metric Overview Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="border border-white/10 p-4 bg-white/[0.02]">
          <div className="text-xs font-semibold text-text-muted uppercase tracking-wider">Total Accounts</div>
          <div className="text-2xl font-bold text-text-primary mt-1">{metrics.totalUsers}</div>
          <div className="text-[11px] text-text-muted mt-0.5">All registered users</div>
        </Card>
        <Card className="border border-white/10 p-4 bg-white/[0.02]">
          <div className="text-xs font-semibold text-emerald-400/90 uppercase tracking-wider">Customers</div>
          <div className="text-2xl font-bold text-emerald-400 mt-1">{metrics.customersCount}</div>
          <div className="text-[11px] text-text-muted mt-0.5">Standard client accounts</div>
        </Card>
        <Card className="border border-white/10 p-4 bg-white/[0.02]">
          <div className="text-xs font-semibold text-purple-400/90 uppercase tracking-wider">Staff &amp; Admins</div>
          <div className="text-2xl font-bold text-purple-400 mt-1">{metrics.staffCount}</div>
          <div className="text-[11px] text-text-muted mt-0.5">Devs, Admins, Support</div>
        </Card>
        <Card className="border border-white/10 p-4 bg-white/[0.02]">
          <div className="text-xs font-semibold text-accent-teal-bright uppercase tracking-wider">Total Spent (LTV)</div>
          <div className="text-2xl font-bold text-accent-teal-bright mt-1">{formatMoney(metrics.totalLtv)}</div>
          <div className="text-[11px] text-text-muted mt-0.5">Paid platform revenue</div>
        </Card>
      </div>

      {/* Filter Tabs & Search Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        {/* Role Tabs */}
        <div className="flex items-center gap-1.5 p-1 bg-white/[0.03] border border-white/10 rounded-xl overflow-x-auto text-xs font-medium">
          <button
            onClick={() => setRoleFilter('all')}
            className={`px-3 py-1.5 rounded-lg transition-all ${
              roleFilter === 'all' ? 'bg-white text-black font-semibold shadow-sm' : 'text-text-muted hover:text-text-primary'
            }`}
          >
            All Accounts ({totalCount || customers?.length || 0})
          </button>
          <button
            onClick={() => setRoleFilter('customer')}
            className={`px-3 py-1.5 rounded-lg transition-all ${
              roleFilter === 'customer' ? 'bg-white text-black font-semibold shadow-sm' : 'text-text-muted hover:text-text-primary'
            }`}
          >
            Customers
          </button>
          <button
            onClick={() => setRoleFilter('staff')}
            className={`px-3 py-1.5 rounded-lg transition-all ${
              roleFilter === 'staff' ? 'bg-white text-black font-semibold shadow-sm' : 'text-text-muted hover:text-text-primary'
            }`}
          >
            Staff &amp; Admins
          </button>
          <button
            onClick={() => setRoleFilter('dev')}
            className={`px-3 py-1.5 rounded-lg transition-all ${
              roleFilter === 'dev' ? 'bg-purple-500 text-white font-semibold shadow-sm' : 'text-text-muted hover:text-text-primary'
            }`}
          >
            Developers
          </button>
          <button
            onClick={() => setRoleFilter('admin')}
            className={`px-3 py-1.5 rounded-lg transition-all ${
              roleFilter === 'admin' ? 'bg-amber-500 text-black font-semibold shadow-sm' : 'text-text-muted hover:text-text-primary'
            }`}
          >
            Admins
          </button>
          <button
            onClick={() => setRoleFilter('banned')}
            className={`px-3 py-1.5 rounded-lg transition-all ${
              roleFilter === 'banned' ? 'bg-rose-500 text-white font-semibold shadow-sm' : 'text-text-muted hover:text-text-primary'
            }`}
          >
            Banned
          </button>
        </div>

        {/* Search Input */}
        <div className="w-full md:w-80">
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search email, name, user ID..."
          />
        </div>
      </div>

      {error && <ErrorBanner message={error} />}

      {customers === null && <Spinner label="Loading customer directory..." />}
      {customers !== null && filteredCustomers.length === 0 && (
        <EmptyState message="No matching user accounts found for the current query." />
      )}

      {/* Customer Directory Table */}
      {filteredCustomers.length > 0 && (
        <div className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.01]">
          <Table headers={['User / Account', 'Role', 'Assigned Admin', 'Lifetime Spent & Orders', 'Infrastructure', 'Status', 'Actions']}>
            {filteredCustomers.map((cust) => {
              const role = cust.role || 'customer';
              return (
                <Tr key={cust.id} className="hover:bg-white/[0.02] transition-colors">
                  {/* User Profile */}
                  <Td>
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full bg-gradient-to-br from-white/10 to-white/5 border border-white/10 flex items-center justify-center font-bold text-sm text-text-primary shrink-0">
                        {cust.displayName ? cust.displayName.charAt(0).toUpperCase() : cust.email.charAt(0).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <button
                          onClick={() => openCustomerDetails(cust.id)}
                          className="font-semibold text-text-primary text-sm hover:underline hover:text-accent-teal-bright text-left block truncate"
                        >
                          {cust.displayName || 'Unset Display Name'}
                        </button>
                        <p className="text-text-muted text-xs font-mono truncate">{cust.email}</p>
                        <p className="text-[10px] text-text-muted font-mono opacity-60">ID: {cust.id}</p>
                      </div>
                    </div>
                  </Td>

                  {/* Role Badge */}
                  <Td>
                    <div className="flex items-center gap-1.5">
                      {role === 'dev' && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-purple-500/20 text-purple-300 border border-purple-500/30">
                          Developer
                        </span>
                      )}
                      {role === 'admin' && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                          Administrator
                        </span>
                      )}
                      {role === 'support' && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-sky-500/20 text-sky-300 border border-sky-500/30">
                          Support Staff
                        </span>
                      )}
                      {role === 'customer' && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                          Customer
                        </span>
                      )}
                      <button
                        onClick={() => openRoleModal(cust)}
                        title="Change role"
                        className="text-[10px] text-text-muted hover:text-white p-1 rounded hover:bg-white/5 transition-colors"
                      >
                        ⚙️
                      </button>
                    </div>
                  </Td>

                  {/* Assigned Admin */}
                  <Td>
                    {cust.assignedAdmin ? (
                      <div className="flex items-center gap-1.5">
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium bg-white/5 border border-white/10 text-text-primary">
                          <span className="text-[10px] text-text-muted">👤</span>
                          <span className="truncate max-w-[120px]">
                            {cust.assignedAdmin.displayName || cust.assignedAdmin.email}
                          </span>
                        </span>
                        <button
                          onClick={() => openAssignModal(cust)}
                          title="Reassign admin"
                          className="text-[10px] text-text-muted hover:text-white p-1 rounded hover:bg-white/5"
                        >
                          ✏️
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => openAssignModal(cust)}
                        className="text-xs text-text-muted hover:text-white px-2 py-1 rounded-md border border-dashed border-white/20 hover:border-white/40 transition-colors"
                      >
                        + Assign Admin
                      </button>
                    )}
                  </Td>

                  {/* Total Spent / Orders ("how much they brought") */}
                  <Td>
                    <div>
                      <div className="font-bold text-accent-teal-bright text-sm">
                        {formatMoney(cust.totalSpent || 0)}
                      </div>
                      <div className="text-xs text-text-muted">
                        <span className="font-semibold text-text-primary">{cust.orderCount || 0}</span> orders paid
                      </div>
                    </div>
                  </Td>

                  {/* Active Infrastructure Counters */}
                  <Td>
                    <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
                      {(cust.vpsCount ?? 0) > 0 && (
                        <span className="px-2 py-0.5 rounded-full bg-blue-500/15 text-blue-300 border border-blue-500/30 font-medium">
                          {cust.vpsCount} VPS
                        </span>
                      )}
                      {(cust.deploymentsCount ?? 0) > 0 && (
                        <span className="px-2 py-0.5 rounded-full bg-violet-500/15 text-violet-300 border border-violet-500/30 font-medium">
                          {cust.deploymentsCount} Apps
                        </span>
                      )}
                      {(cust.databasesCount ?? 0) > 0 && (
                        <span className="px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 font-medium">
                          {cust.databasesCount} DBs
                        </span>
                      )}
                      {!(cust.vpsCount || cust.deploymentsCount || cust.databasesCount) && (
                        <span className="text-text-muted text-xs">No active nodes</span>
                      )}
                    </div>
                  </Td>

                  {/* Contact Channels & Ban Status */}
                  <Td>
                    <div className="space-y-1">
                      {cust.isBanned ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-500/15 text-rose-400 border border-rose-500/30">
                          Banned
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                          Active
                        </span>
                      )}
                      <div className="flex items-center gap-1.5 text-xs">
                        {cust.phoneNumber && (
                          <a
                            href={`https://wa.me/${cust.phoneNumber.replace(/[^0-9]/g, '')}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-emerald-400 hover:underline font-mono text-[11px]"
                            title="Chat on WhatsApp"
                          >
                            WhatsApp
                          </a>
                        )}
                        {cust.discordUserId && (
                          <span className="text-indigo-400 font-mono text-[11px]" title={`Discord UID: ${cust.discordUserId}`}>
                            Discord
                          </span>
                        )}
                      </div>
                    </div>
                  </Td>

                  {/* Actions Column */}
                  <Td className="text-right pr-4">
                    <div className="flex items-center justify-end gap-1.5">
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => openCustomerDetails(cust.id)}
                        className="text-xs"
                      >
                        360° Profile
                      </Button>

                      {cust.role === 'dev' ? (
                        <span className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-amber-500/10 text-amber-300 border border-amber-500/20">
                          🛡️ Dev Immune
                        </span>
                      ) : cust.isBanned ? (
                        <button
                          onClick={() => handleUnbanUser(cust)}
                          className="px-2.5 py-1 text-xs font-medium rounded-lg bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30 transition-colors"
                        >
                          Unban
                        </button>
                      ) : (
                        <button
                          onClick={() => {
                            setBanModalUser(cust);
                            setBanReason('');
                          }}
                          className="px-2.5 py-1 text-xs font-medium rounded-lg bg-rose-500/15 text-rose-300 hover:bg-rose-500/25 transition-colors"
                        >
                          Ban
                        </button>
                      )}
                    </div>
                  </Td>
                </Tr>
              );
            })}
          </Table>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────────────────────
          360° Customer Details Modal / Drawer ("what they bought and etc")
         ───────────────────────────────────────────────────────────────────────────── */}
      {selectedCustomerId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-fade-in overflow-y-auto">
          <div className="w-full max-w-4xl max-h-[90vh] flex flex-col rounded-2xl border border-white/15 bg-[#0a0a0e] shadow-2xl overflow-hidden">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-5 border-b border-white/10 bg-white/[0.02]">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-full bg-gradient-to-br from-accent-violet/30 to-accent-teal/20 border border-white/15 flex items-center justify-center font-bold text-lg text-white">
                  {customerDetails?.displayName
                    ? customerDetails.displayName.charAt(0).toUpperCase()
                    : customerDetails?.email?.charAt(0).toUpperCase() || 'U'}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-base font-bold text-text-primary">
                      {customerDetails?.displayName || customerDetails?.email || 'Customer Profile'}
                    </h2>
                    {customerDetails?.role && (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider bg-white/10 text-white border border-white/15">
                        {customerDetails.role}
                      </span>
                    )}
                    {customerDetails?.isBanned && (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider bg-rose-500/20 text-rose-300 border border-rose-500/30">
                        Banned
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-3 text-xs text-text-muted mt-0.5">
                    <span className="font-mono">{customerDetails?.email}</span>
                    <span>·</span>
                    <span className="font-mono text-[11px] opacity-75">ID: {customerDetails?.id}</span>
                  </div>
                </div>
              </div>

              <button
                onClick={() => {
                  setSelectedCustomerId(null);
                  setCustomerDetails(null);
                }}
                className="text-text-muted hover:text-white transition-colors text-xl p-1"
              >
                ✕
              </button>
            </div>

            {loadingDetails && (
              <div className="p-12 flex justify-center">
                <Spinner label="Loading customer profile, purchases, and infrastructure..." />
              </div>
            )}

            {!loadingDetails && customerDetails && (
              <>
                {/* Quick Financial & Summary Banner */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 p-4 bg-white/[0.02] border-b border-white/10">
                  <div className="p-3 rounded-xl bg-white/[0.02] border border-white/5">
                    <div className="text-[11px] text-text-muted uppercase font-semibold">Total Purchases (LTV)</div>
                    <div className="text-xl font-bold text-accent-teal-bright mt-0.5">
                      {formatMoney(customerDetails.totalSpent)}
                    </div>
                  </div>
                  <div className="p-3 rounded-xl bg-white/[0.02] border border-white/5">
                    <div className="text-[11px] text-text-muted uppercase font-semibold">Total Orders</div>
                    <div className="text-xl font-bold text-text-primary mt-0.5">
                      {customerDetails.orders.length}
                    </div>
                  </div>
                  <div className="p-3 rounded-xl bg-white/[0.02] border border-white/5">
                    <div className="text-[11px] text-text-muted uppercase font-semibold">Active VPS &amp; Apps</div>
                    <div className="text-xl font-bold text-text-primary mt-0.5">
                      {customerDetails.vpsProvisions.length + customerDetails.deployments.length}
                    </div>
                  </div>
                  <div className="p-3 rounded-xl bg-white/[0.02] border border-white/5">
                    <div className="text-[11px] text-text-muted uppercase font-semibold">Assigned Admin</div>
                    <div className="text-sm font-semibold text-text-primary mt-1 truncate">
                      {customerDetails.assignedAdmin ? (
                        customerDetails.assignedAdmin.displayName || customerDetails.assignedAdmin.email
                      ) : (
                        <span className="text-text-muted">Unassigned</span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Tab Navigation */}
                <div className="flex items-center gap-2 px-5 pt-3 border-b border-white/10 bg-white/[0.01]">
                  <button
                    onClick={() => setDetailsTab('purchases')}
                    className={`pb-2.5 text-xs font-semibold border-b-2 transition-all ${
                      detailsTab === 'purchases'
                        ? 'border-accent-teal text-white'
                        : 'border-transparent text-text-muted hover:text-text-primary'
                    }`}
                  >
                    🛍️ Purchases &amp; Orders ({customerDetails.orders.length})
                  </button>
                  <button
                    onClick={() => setDetailsTab('infrastructure')}
                    className={`pb-2.5 text-xs font-semibold border-b-2 transition-all ${
                      detailsTab === 'infrastructure'
                        ? 'border-accent-teal text-white'
                        : 'border-transparent text-text-muted hover:text-text-primary'
                    }`}
                  >
                    🖥️ Infrastructure ({customerDetails.vpsProvisions.length + customerDetails.deployments.length + customerDetails.managedDatabases.length})
                  </button>
                  <button
                    onClick={() => setDetailsTab('tickets')}
                    className={`pb-2.5 text-xs font-semibold border-b-2 transition-all ${
                      detailsTab === 'tickets'
                        ? 'border-accent-teal text-white'
                        : 'border-transparent text-text-muted hover:text-text-primary'
                    }`}
                  >
                    🎫 Tickets ({customerDetails.tickets.length})
                  </button>
                  <button
                    onClick={() => setDetailsTab('actions')}
                    className={`pb-2.5 text-xs font-semibold border-b-2 transition-all ${
                      detailsTab === 'actions'
                        ? 'border-accent-teal text-white'
                        : 'border-transparent text-text-muted hover:text-text-primary'
                    }`}
                  >
                    ⚙️ Admin Actions
                  </button>
                </div>

                {/* Tab Body */}
                <div className="p-5 overflow-y-auto space-y-4 flex-1">
                  {/* TAB 1: PURCHASES & ORDERS */}
                  {detailsTab === 'purchases' && (
                    <div className="space-y-4">
                      {customerDetails.orders.length === 0 ? (
                        <EmptyState message="This user has not placed any orders yet." />
                      ) : (
                        customerDetails.orders.map((order) => {
                          const isPaid = order.status === 'paid';
                          const isAwaiting = order.status === 'awaiting_payment';
                          return (
                            <div
                              key={order.id}
                              className="rounded-xl border border-white/10 bg-white/[0.02] p-4 space-y-3"
                            >
                              <div className="flex flex-col md:flex-row md:items-center justify-between gap-2 border-b border-white/5 pb-2">
                                <div className="flex items-center gap-2">
                                  <span className="font-mono text-xs font-semibold text-text-primary">
                                    Order #{order.id.slice(-8).toUpperCase()}
                                  </span>
                                  <span
                                    className={`px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase ${
                                      isPaid
                                        ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                                        : isAwaiting
                                        ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                                        : 'bg-white/10 text-text-muted border border-white/15'
                                    }`}
                                  >
                                    {order.status}
                                  </span>
                                </div>
                                <div className="flex items-center gap-4 text-xs">
                                  <span className="text-text-muted">
                                    {new Date(order.createdAt).toLocaleString(undefined, {
                                      dateStyle: 'medium',
                                      timeStyle: 'short',
                                    })}
                                  </span>
                                  <span className="font-bold text-accent-teal-bright text-sm">
                                    {formatMoney(order.total)}
                                  </span>
                                </div>
                              </div>

                              {/* Items List */}
                              <div className="space-y-2">
                                {order.items.map((item) => (
                                  <div
                                    key={item.id}
                                    className="flex items-center justify-between p-2 rounded-lg bg-white/[0.01] border border-white/5 text-xs"
                                  >
                                    <div>
                                      <div className="font-semibold text-text-primary">
                                        {item.plan?.name || item.service?.name || 'Hosting Plan / Service'}
                                      </div>
                                      <div className="text-[11px] text-text-muted">
                                        {item.plan?.product?.name && (
                                          <span className="text-white/70 font-medium">
                                            {item.plan.product.name} ·{' '}
                                          </span>
                                        )}
                                        {item.plan?.cpuCores ? `${item.plan.cpuCores} vCPU · ` : ''}
                                        {item.plan?.ramGb ? `${item.plan.ramGb} GB RAM · ` : ''}
                                        {item.plan?.storageGb ? `${item.plan.storageGb} GB NVMe · ` : ''}
                                        Qty: {item.quantity}
                                      </div>
                                    </div>
                                    <div className="font-mono font-medium text-text-primary">
                                      {item.priceLkr ? formatMoney(item.priceLkr * item.quantity) : 'Included'}
                                    </div>
                                  </div>
                                ))}
                              </div>

                              {/* Payments & Receipts */}
                              {order.payments && order.payments.length > 0 && (
                                <div className="pt-2 border-t border-white/5 flex flex-wrap items-center gap-3 text-xs text-text-muted">
                                  <span className="font-medium text-text-primary">Payment:</span>
                                  {order.payments.map((p) => (
                                    <span key={p.id} className="inline-flex items-center gap-1.5 font-mono">
                                      <span>{p.method} ({formatMoney(p.amount)})</span>
                                      <span className="text-emerald-400">[{p.status}]</span>
                                      {p.receiptUrl && (
                                        <a
                                          href={p.receiptUrl}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          className="text-accent-teal hover:underline"
                                        >
                                          View Receipt
                                        </a>
                                      )}
                                    </span>
                                  ))}
                                </div>
                              )}
                            </div>
                          );
                        })
                      )}
                    </div>
                  )}

                  {/* TAB 2: ACTIVE INFRASTRUCTURE */}
                  {detailsTab === 'infrastructure' && (
                    <div className="space-y-5">
                      {/* VPS Provisions */}
                      <div>
                        <h4 className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-2">
                          VPS Virtual Private Servers ({customerDetails.vpsProvisions.length})
                        </h4>
                        {customerDetails.vpsProvisions.length === 0 ? (
                          <p className="text-xs text-text-muted italic">No VPS servers provisioned.</p>
                        ) : (
                          <div className="space-y-2">
                            {customerDetails.vpsProvisions.map((vps) => (
                              <div
                                key={vps.id}
                                className="p-3 rounded-xl border border-white/10 bg-white/[0.02] flex items-center justify-between text-xs"
                              >
                                <div>
                                  <div className="font-semibold text-text-primary flex items-center gap-2">
                                    <span>{vps.ip || 'Pending IP Allocation'}</span>
                                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300 font-medium">
                                      Port {vps.sshPort}
                                    </span>
                                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/10 text-white font-medium uppercase">
                                      {vps.status}
                                    </span>
                                  </div>
                                  <div className="text-text-muted text-[11px] mt-0.5">
                                    Provider: {vps.provider} · User: {vps.username || 'root'} · Plan:{' '}
                                    {vps.orderItem?.plan?.name || 'Dedicated VPS'}
                                  </div>
                                  {vps.notes && (
                                    <div className="text-[10px] text-text-muted mt-1 font-mono">
                                      Notes: {vps.notes}
                                    </div>
                                  )}
                                </div>
                                {vps.panelUrl && (
                                  <a
                                    href={vps.panelUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/15 text-white font-medium text-xs transition-colors"
                                  >
                                    Open Panel ↗
                                  </a>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* App Deployments */}
                      <div>
                        <h4 className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-2">
                          Application Deployments ({customerDetails.deployments.length})
                        </h4>
                        {customerDetails.deployments.length === 0 ? (
                          <p className="text-xs text-text-muted italic">No application deployments found.</p>
                        ) : (
                          <div className="space-y-2">
                            {customerDetails.deployments.map((d) => (
                              <div
                                key={d.id}
                                className="p-3 rounded-xl border border-white/10 bg-white/[0.02] flex items-center justify-between text-xs"
                              >
                                <div>
                                  <div className="font-semibold text-text-primary flex items-center gap-2">
                                    <span>{d.subdomain ? `${d.subdomain}.shanutech.com` : 'Internal Service'}</span>
                                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-medium uppercase">
                                      {d.status}
                                    </span>
                                  </div>
                                  <div className="text-text-muted text-[11px] mt-0.5">
                                    Node: {d.node?.label || 'Auto-selected'} ({d.node?.ip || 'Pending IP'}) · Runtime:{' '}
                                    {d.runtime || 'Container'}
                                  </div>
                                </div>
                                {d.subdomain && (
                                  <a
                                    href={`https://${d.subdomain}.shanutech.com`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-accent-teal hover:underline font-medium text-xs"
                                  >
                                    Visit App ↗
                                  </a>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Managed Databases */}
                      <div>
                        <h4 className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-2">
                          Managed Databases ({customerDetails.managedDatabases.length})
                        </h4>
                        {customerDetails.managedDatabases.length === 0 ? (
                          <p className="text-xs text-text-muted italic">No managed databases provisioned.</p>
                        ) : (
                          <div className="space-y-2">
                            {customerDetails.managedDatabases.map((db) => (
                              <div
                                key={db.id}
                                className="p-3 rounded-xl border border-white/10 bg-white/[0.02] flex items-center justify-between text-xs"
                              >
                                <div>
                                  <div className="font-semibold text-text-primary flex items-center gap-2">
                                    <span>{db.name}</span>
                                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 font-medium uppercase">
                                      {db.engine}
                                    </span>
                                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/10 text-white font-medium uppercase">
                                      {db.status}
                                    </span>
                                  </div>
                                  <div className="text-text-muted text-[11px] mt-0.5">
                                    Host: {db.node?.ip || 'localhost'}:{db.port}
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* TAB 3: TICKETS */}
                  {detailsTab === 'tickets' && (
                    <div className="space-y-3">
                      {customerDetails.tickets.length === 0 ? (
                        <EmptyState message="No support tickets opened by this user." />
                      ) : (
                        customerDetails.tickets.map((t) => (
                          <div
                            key={t.id}
                            className="p-3 rounded-xl border border-white/10 bg-white/[0.02] flex items-center justify-between text-xs"
                          >
                            <div>
                              <div className="font-semibold text-text-primary flex items-center gap-2">
                                <span>{t.subject}</span>
                                <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/10 text-white font-medium uppercase">
                                  {t.status}
                                </span>
                              </div>
                              <div className="text-[11px] text-text-muted mt-0.5">
                                Priority: {t.priority} · Created: {new Date(t.createdAt).toLocaleDateString()}
                              </div>
                            </div>
                            <a
                              href={`/admin/tickets`}
                              className="px-3 py-1 text-xs rounded-lg bg-white/5 hover:bg-white/10 text-text-primary transition-colors"
                            >
                              View in Tickets
                            </a>
                          </div>
                        ))
                      )}
                    </div>
                  )}

                  {/* TAB 4: QUICK ACTIONS */}
                  {detailsTab === 'actions' && (
                    <div className="space-y-4">
                      <div className="p-4 rounded-xl border border-white/10 bg-white/[0.02] space-y-2">
                        <h4 className="text-sm font-semibold text-text-primary">Administrative Assignments</h4>
                        <p className="text-xs text-text-muted">
                          Delegate this customer to a specific managing admin or change their account platform role.
                        </p>
                        <div className="flex flex-wrap gap-2 pt-2">
                          <Button
                            variant="secondary"
                            onClick={() => {
                              openAssignModal(customerDetails);
                            }}
                          >
                            👤 Assign Managing Admin
                          </Button>
                          <Button
                            variant="secondary"
                            onClick={() => {
                              openRoleModal(customerDetails);
                            }}
                          >
                            🛡️ Change Account Role
                          </Button>
                          <Button
                            variant="secondary"
                            onClick={() => handleImpersonate(customerDetails.id, customerDetails.email)}
                          >
                            🎭 Impersonate User
                          </Button>
                        </div>
                      </div>

                      <div className="p-4 rounded-xl border border-white/10 bg-white/[0.02] space-y-2">
                        <h4 className="text-sm font-semibold text-text-primary">Direct Service Provisioning</h4>
                        <p className="text-xs text-text-muted">
                          Allocate new VPS hosting or database projects for this specific customer.
                        </p>
                        <div className="flex flex-wrap gap-2 pt-2">
                          <a
                            href="/admin/vps-plans"
                            className="px-3 py-2 rounded-xl text-xs font-semibold bg-white text-black hover:bg-white/90 transition-colors"
                          >
                            + Provision VPS for User
                          </a>
                          <a
                            href="/dev/projects"
                            className="px-3 py-2 rounded-xl text-xs font-semibold bg-white/10 text-white hover:bg-white/15 transition-colors border border-white/10"
                          >
                            + Managed Database &amp; Supabase
                          </a>
                        </div>
                      </div>

                      {customerDetails.role === 'dev' ? (
                        <div className="p-4 rounded-xl border border-amber-500/20 bg-amber-500/5 space-y-1">
                          <div className="flex items-center gap-2 text-sm font-semibold text-amber-300">
                            <span>🛡️ Protected Developer Superuser</span>
                          </div>
                          <p className="text-xs text-text-muted">
                            This account is the platform developer and superuser. It is permanently immune to bans, demotions, suspensions, and restrictions.
                          </p>
                        </div>
                      ) : (
                        <div className="p-4 rounded-xl border border-rose-500/20 bg-rose-500/5 space-y-2">
                          <h4 className="text-sm font-semibold text-rose-400">Account Suspension / Banning</h4>
                          <p className="text-xs text-text-muted">
                            Banning this account immediately revokes login credentials, stops running containers, and invalidates API tokens.
                          </p>
                          <div className="pt-2">
                            {customerDetails.isBanned ? (
                              <Button variant="secondary" onClick={() => handleUnbanUser(customerDetails)}>
                                Unban Customer Account
                              </Button>
                            ) : (
                              <Button
                                variant="danger"
                                onClick={() => {
                                  setBanModalUser(customerDetails);
                                  setBanReason('');
                                }}
                              >
                                Suspend &amp; Ban Customer Account
                              </Button>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────────────────────
          Assign Admin Modal
         ───────────────────────────────────────────────────────────────────────────── */}
      {assignModalUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-fade-in">
          <div className="w-full max-w-md rounded-2xl border border-white/15 bg-[#0e1017] p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <h3 className="text-sm font-semibold text-text-primary flex items-center gap-2">
                <span>👤</span>
                <span>Assign Managing Admin</span>
              </h3>
              <button
                onClick={() => setAssignModalUser(null)}
                className="text-text-muted hover:text-white transition-colors text-lg"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-text-muted">
              Select an administrator or developer to assign to{' '}
              <strong className="text-text-primary">{assignModalUser.email}</strong>. The assigned admin will be
              responsible for managing this user’s services, deployments, and tickets.
            </p>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-text-muted">Select Staff Member</label>
              <select
                value={selectedAdminId}
                onChange={(e) => setSelectedAdminId(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-text-primary focus:outline-none focus:border-accent-violet/50"
              >
                <option value="" className="bg-[#0a0a14]">
                  None (Unassigned)
                </option>
                {staffList.map((staff) => (
                  <option key={staff.id} value={staff.id} className="bg-[#0a0a14]">
                    {staff.displayName ? `${staff.displayName} (${staff.email})` : staff.email} — {staff.role.toUpperCase()}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-white/10">
              <Button variant="secondary" onClick={() => setAssignModalUser(null)}>
                Cancel
              </Button>
              <Button loading={assigning} onClick={handleAssignAdmin}>
                Save Assignment
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────────────────────
          Change Role Modal
         ───────────────────────────────────────────────────────────────────────────── */}
      {roleModalUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-fade-in">
          <div className="w-full max-w-md rounded-2xl border border-white/15 bg-[#0e1017] p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <h3 className="text-sm font-semibold text-text-primary flex items-center gap-2">
                <span>🛡️</span>
                <span>Change User Role</span>
              </h3>
              <button
                onClick={() => setRoleModalUser(null)}
                className="text-text-muted hover:text-white transition-colors text-lg"
              >
                ✕
              </button>
            </div>

            {roleModalUser.role === 'dev' ? (
              <div className="p-4 rounded-xl border border-amber-500/20 bg-amber-500/5 space-y-2">
                <div className="flex items-center gap-2 text-sm font-semibold text-amber-300">
                  <span>🛡️ Developer Superuser Locked</span>
                </div>
                <p className="text-xs text-text-muted">
                  Developer superuser accounts are permanently locked and cannot be demoted or altered under any circumstances.
                </p>
                <div className="flex justify-end pt-2">
                  <Button variant="secondary" onClick={() => setRoleModalUser(null)}>
                    Close
                  </Button>
                </div>
              </div>
            ) : (
              <>
                <p className="text-xs text-text-muted">
                  Update platform access role for <strong className="text-text-primary">{roleModalUser.email}</strong>.
                </p>

                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-text-muted">New Role</label>
                  <select
                    value={selectedRole}
                    onChange={(e) => setSelectedRole(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-text-primary focus:outline-none focus:border-accent-violet/50"
                  >
                    <option value="customer" className="bg-[#0a0a14]">Customer (Standard client)</option>
                    <option value="support" className="bg-[#0a0a14]">Support Staff (Ticketing &amp; basic triage)</option>
                    <option value="admin" className="bg-[#0a0a14]">Administrator (Assigned users &amp; orders)</option>
                    <option value="dev" className="bg-[#0a0a14]">Developer (Full unrestricted superuser)</option>
                  </select>
                </div>

                <div className="flex items-center justify-end gap-2 pt-3 border-t border-white/10">
                  <Button variant="secondary" onClick={() => setRoleModalUser(null)}>
                    Cancel
                  </Button>
                  <Button loading={changingRole} onClick={handleSetRole}>
                    Update Role
                  </Button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────────────────────
          Suspend / Ban Modal
         ───────────────────────────────────────────────────────────────────────────── */}
      {banModalUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-fade-in">
          <div className="w-full max-w-md rounded-2xl border border-rose-500/30 bg-[#0e1017] p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <div className="flex items-center gap-2 text-rose-400 font-semibold text-sm">
                <svg className="w-4 h-4 text-rose-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                <span>Suspend / Ban User Account</span>
              </div>
              <button
                onClick={() => setBanModalUser(null)}
                className="text-text-muted hover:text-white transition-colors text-lg"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-text-muted">
              Banning <strong className="text-text-primary">{banModalUser.email}</strong> will immediately disable login,
              revoke all API keys, and stop all running container deployments.
            </p>

            <Input
              label="Ban Reason"
              value={banReason}
              onChange={(e) => setBanReason(e.target.value)}
              placeholder="e.g. Policy violation / Payment fraud / Crypto mining"
            />

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-white/10">
              <Button variant="secondary" onClick={() => setBanModalUser(null)}>
                Cancel
              </Button>
              <Button variant="danger" loading={banning} onClick={handleBanUser}>
                Confirm Ban &amp; Stop Containers
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
