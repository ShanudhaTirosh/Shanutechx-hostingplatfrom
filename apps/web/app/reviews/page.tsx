'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import Navbar from '../../components/Navbar';
import StxFooter from '../../components/StxFooter';
import GradientMeshOrb from '../../components/GradientMeshOrb';
import { Star, CheckCircle, Shield, MessageSquare, Sparkles, Filter, ChevronLeft, ChevronRight, MessageSquarePlus, AlertCircle, CheckCircle2, X, Lock, ShoppingCart, UserCheck, ShieldAlert } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface Review {
  id: string;
  authorName: string;
  authorRole: string;
  rating: number;
  comment: string;
  productCategory: string;
  productName?: string;
  isVerified: boolean;
  createdAt: string;
}

interface PurchasedItem {
  id: string;
  name: string;
  category: string;
}

export default function ReviewsPage() {
  const dashboardUrl = process.env.NEXT_PUBLIC_DASHBOARD_URL || 'http://localhost:3001';
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [selectedCategory, setSelectedCategory] = useState('all');

  // User & Purchase State
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [purchasedItems, setPurchasedItems] = useState<PurchasedItem[]>([]);
  const [hasPurchases, setHasPurchases] = useState(false);
  const [loadingPurchases, setLoadingPurchases] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);

  // Modal State
  const [modalOpen, setModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitSuccess, setSubmitSuccess] = useState<string | null>(null);

  // Form Fields
  const [selectedItemId, setSelectedItemId] = useState<string>('');
  const [authorName, setAuthorName] = useState('');
  const [authorRole, setAuthorRole] = useState('');
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');
  const [productCategory, setProductCategory] = useState('vps');
  const [productName, setProductName] = useState('');

  const categories = [
    { id: 'all', label: 'All Categories' },
    { id: 'vps', label: 'Cloud VPS' },
    { id: 'app_hosting', label: 'App Hosting' },
    { id: 'bot_hosting', label: 'Bot Hosting' },
    { id: 'database', label: 'Managed Databases' },
    { id: 'catalog', label: '1-Click App Catalog' },
  ];

  // Fetch reviews from backend API with pagination & filter
  const fetchReviews = async (currentPage: number, category: string) => {
    setLoading(true);
    const apiBase = process.env.API_BASE_URL || process.env.NEXT_PUBLIC_API_BASE_URL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
    try {
      const res = await fetch(`${apiBase}/api/reviews?page=${currentPage}&limit=6&category=${category}`);
      if (res.ok) {
        const data = await res.json();
        setReviews(data.reviews || []);
        setTotalPages(data.totalPages || 1);
        setTotalCount(data.total || 0);
      }
    } catch (err) {
      console.error('Failed to fetch reviews:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReviews(page, selectedCategory);
  }, [page, selectedCategory]);

  const handleCategoryChange = (catId: string) => {
    setSelectedCategory(catId);
    setPage(1);
  };

  // Open modal and load user's purchased items
  const handleOpenModal = async () => {
    setModalOpen(true);
    setSubmitError(null);
    setSubmitSuccess(null);

    const token = localStorage.getItem('stx_auth_token') || '';
    const cachedUserStr = localStorage.getItem('stx_auth_user');

    if (!token && !cachedUserStr) {
      setIsLoggedIn(false);
      return;
    }

    setIsLoggedIn(true);
    setLoadingPurchases(true);

    const apiBase = process.env.API_BASE_URL || process.env.NEXT_PUBLIC_API_BASE_URL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

    try {
      const res = await fetch(`${apiBase}/api/reviews/purchased-items`, {
        headers: {
          Authorization: `Bearer ${token || 'verified-session'}`,
        },
      });

      if (res.ok) {
        const data = await res.json();
        setPurchasedItems(data.purchasedItems || []);
        setHasPurchases(data.hasPurchases);
        setIsAdmin(!!data.isAdmin);

        if (data.purchasedItems && data.purchasedItems.length > 0) {
          setSelectedItemId(data.purchasedItems[0].id);
          setProductCategory(data.purchasedItems[0].category);
          setProductName(data.purchasedItems[0].name);
        }
      } else {
        setHasPurchases(false);
      }
    } catch (err) {
      setHasPurchases(false);
    } finally {
      setLoadingPurchases(false);
    }
  };

  const handleSelectItem = (itemId: string) => {
    setSelectedItemId(itemId);
    const item = purchasedItems.find((p) => p.id === itemId);
    if (item) {
      setProductCategory(item.category);
      setProductName(item.name);
    }
  };

  // Submit verified review
  async function handleSubmitReview(e: React.FormEvent) {
    e.preventDefault();
    setSubmitError(null);
    setSubmitSuccess(null);

    const token = localStorage.getItem('stx_auth_token') || '';
    const cachedUser = localStorage.getItem('stx_auth_user');

    if (!token && !cachedUser) {
      setSubmitError('Please sign in to your STX account before writing a review.');
      return;
    }

    let parsedUser;
    try {
      parsedUser = JSON.parse(cachedUser || '{}');
    } catch (err) {
      console.warn('Failed to parse cached user data from localStorage:', err);
    }

    setSubmitting(true);
    const apiBase = process.env.API_BASE_URL || process.env.NEXT_PUBLIC_API_BASE_URL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

    const selectedItem = purchasedItems.find((p) => p.id === selectedItemId);

    try {
      const endpoint = isAdmin ? `${apiBase}/api/admin/reviews` : `${apiBase}/api/reviews`;
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token || 'verified-session'}`,
        },
        body: JSON.stringify({
          authorName: authorName || parsedUser?.name || 'Verified Customer',
          authorRole: authorRole || 'Verified Client',
          rating,
          comment,
          productCategory: selectedItem?.category || productCategory,
          productName: selectedItem?.name || productName || 'Cloud Hosting Service',
          productId: selectedItemId || null,
          isVerified: true,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setSubmitError(data.error || 'Failed to post review.');
        return;
      }

      setSubmitSuccess('Thank you! Your verified client review has been published.');
      fetchReviews(1, selectedCategory);
      setTimeout(() => {
        setModalOpen(false);
        setComment('');
        setAuthorName('');
        setAuthorRole('');
        setSubmitSuccess(null);
      }, 1800);
    } catch (err: any) {
      setSubmitError('Unable to submit review. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#030511] text-white flex flex-col selection:bg-purple-500 selection:text-white relative overflow-hidden font-sans">
      <div className="absolute inset-0 bg-[radial-gradient(#7c3aed26_1px,transparent_1px)] [background-size:32px_32px] opacity-40 pointer-events-none" />
      <Navbar />

      <main className="flex-1 max-w-7xl mx-auto px-6 pt-32 pb-24 space-y-12 relative z-10 w-full">
        {/* Header Hero */}
        <div className="relative text-center space-y-6 pt-4">
          <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none select-none z-0">
            <GradientMeshOrb size={480} opacity={0.8} glowColor="rgba(124, 58, 237, 0.65)" />
          </div>

          <div className="relative z-10 space-y-4 max-w-3xl mx-auto">
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-purple-500/10 border border-purple-500/20 text-purple-300 text-[11px] font-mono font-bold tracking-widest uppercase shadow-glow-violet">
              <Sparkles className="h-3.5 w-3.5 text-purple-400" />
              VERIFIED CLIENT FEEDBACK
            </div>
            <h1 className="text-4xl md:text-6xl font-black tracking-tight text-white leading-tight">
              STX Customer <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-400 via-indigo-300 to-teal-300">Reviews &amp; Ratings</span>
            </h1>
            <p className="text-base text-slate-300 leading-relaxed max-w-2xl mx-auto font-sans">
              Read real client testimonials from verified developers, DevOps teams, and bot creators hosting on STX HOSTING.
            </p>
            <div className="pt-2">
              <button
                onClick={handleOpenModal}
                className="px-6 py-3 rounded-full bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-extrabold text-xs shadow-glow-violet transition-all flex items-center gap-2 mx-auto"
              >
                <MessageSquarePlus className="h-4 w-4" />
                Write a Product Review
              </button>
            </div>
          </div>
        </div>

        {/* Rating Stats Summary */}
        <div className="bg-[#080920]/90 border border-white/10 rounded-3xl p-8 max-w-4xl mx-auto grid sm:grid-cols-3 gap-6 text-center backdrop-blur-xl shadow-2xl">
          <div className="space-y-1 border-r sm:border-r border-white/10 last:border-r-0">
            <div className="text-4xl font-black text-white">4.9 / 5.0</div>
            <div className="flex items-center justify-center gap-1 text-amber-400">
              {Array.from({ length: 5 }).map((_, i) => (
                <Star key={i} className="h-4 w-4 fill-amber-400 text-amber-400" />
              ))}
            </div>
            <p className="text-xs text-slate-400 font-mono">Average Rating</p>
          </div>

          <div className="space-y-1 border-r sm:border-r border-white/10 last:border-r-0">
            <div className="text-4xl font-black text-white">99.9%</div>
            <p className="text-xs text-emerald-400 font-bold flex items-center justify-center gap-1">
              <CheckCircle className="h-3.5 w-3.5" /> Purchase Verified
            </p>
            <p className="text-xs text-slate-400 font-mono">100% Client Authenticity</p>
          </div>

          <div className="space-y-1">
            <div className="text-4xl font-black text-white">{totalCount > 0 ? totalCount : '2,500+'}</div>
            <p className="text-xs text-purple-400 font-bold">Verified Client Reviews</p>
            <p className="text-xs text-slate-400 font-mono">Active Global Deployments</p>
          </div>
        </div>

        {/* Category Filters */}
        <div className="flex items-center justify-center gap-2 flex-wrap pt-4">
          {categories.map((cat) => (
            <button
              key={cat.id}
              onClick={() => handleCategoryChange(cat.id)}
              className={`px-4 py-2 rounded-full text-xs font-bold font-mono transition-all ${
                selectedCategory === cat.id
                  ? 'bg-purple-600 text-white shadow-glow-violet border border-purple-400/50'
                  : 'bg-white/5 text-slate-300 hover:bg-white/10 border border-white/10'
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>

        {/* Reviews Grid */}
        {loading ? (
          <div className="text-center py-16 text-slate-400 font-mono text-sm">
            Loading verified reviews...
          </div>
        ) : reviews.length === 0 ? (
          <div className="text-center py-16 text-slate-400 space-y-3">
            <p className="text-base font-bold text-white">No reviews found in this category yet.</p>
            <p className="text-xs">Be the first verified customer to leave feedback!</p>
          </div>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {reviews.map((rev) => (
              <div
                key={rev.id}
                className="bg-[#080922]/90 border border-white/12 rounded-3xl p-6 flex flex-col justify-between space-y-4 hover:border-purple-500/50 transition-all shadow-xl backdrop-blur-md hover:shadow-purple-950/20"
              >
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-sm font-extrabold text-white">{rev.authorName}</h3>
                      <p className="text-xs text-purple-400 font-mono">{rev.authorRole}</p>
                    </div>
                    <div className="flex items-center gap-1 text-amber-400">
                      {Array.from({ length: rev.rating }).map((_, i) => (
                        <Star key={i} className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                      ))}
                    </div>
                  </div>

                  {rev.productName && (
                    <div className="text-[11px] font-mono text-purple-300 bg-purple-500/10 border border-purple-500/20 px-2.5 py-1 rounded-lg">
                      Item: {rev.productName}
                    </div>
                  )}

                  <p className="text-xs text-slate-300 leading-relaxed font-sans">
                    &ldquo;{rev.comment}&rdquo;
                  </p>
                </div>

                <div className="pt-3 border-t border-white/10 flex items-center justify-between text-[11px] font-mono text-slate-400">
                  <span className="flex items-center gap-1 text-emerald-400 font-bold">
                    <Shield className="h-3.5 w-3.5" /> Verified Client
                  </span>
                  <span className="uppercase text-[9px] px-2 py-0.5 rounded-full bg-white/5 border border-white/10 text-slate-300 font-bold">
                    {rev.productCategory}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Pagination Controls */}
        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-3 pt-6">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="p-2.5 rounded-xl bg-white/5 border border-white/10 text-slate-300 hover:text-white disabled:opacity-30 disabled:hover:text-slate-300 transition-all"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>

            <div className="flex items-center gap-2">
              {Array.from({ length: totalPages }).map((_, i) => {
                const pageNum = i + 1;
                return (
                  <button
                    key={pageNum}
                    onClick={() => setPage(pageNum)}
                    className={`w-9 h-9 rounded-xl font-mono text-xs font-bold transition-all ${
                      page === pageNum
                        ? 'bg-purple-600 text-white shadow-glow-violet border border-purple-400/50'
                        : 'bg-white/5 text-slate-300 hover:bg-white/10 border border-white/10'
                    }`}
                  >
                    {pageNum}
                  </button>
                );
              })}
            </div>

            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="p-2.5 rounded-xl bg-white/5 border border-white/10 text-slate-300 hover:text-white disabled:opacity-30 disabled:hover:text-slate-300 transition-all"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        )}
      </main>

      {/* Write a Review Modal */}
      <AnimatePresence>
        {modalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              className="bg-[#080922] border border-white/20 rounded-3xl w-full max-w-lg p-6 shadow-2xl space-y-5 relative backdrop-blur-2xl"
            >
              <div className="flex items-center justify-between border-b border-white/10 pb-3">
                <div className="flex items-center gap-2">
                  <MessageSquarePlus className="h-5 w-5 text-purple-400" />
                  <h3 className="font-extrabold text-white text-base">Write a Product Review</h3>
                </div>
                <button
                  onClick={() => setModalOpen(false)}
                  className="p-1.5 text-slate-400 hover:text-white rounded-full bg-white/5"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              {/* NOT LOGGED IN STATE */}
              {!isLoggedIn ? (
                <div className="py-6 text-center space-y-4">
                  <div className="w-12 h-12 rounded-full bg-purple-500/10 border border-purple-500/20 flex items-center justify-center mx-auto text-purple-400">
                    <Lock className="h-6 w-6" />
                  </div>
                  <div className="space-y-1">
                    <h4 className="font-extrabold text-white text-base">Authentication Required</h4>
                    <p className="text-xs text-slate-400 max-w-xs mx-auto">
                      Please log in to your STX HOSTING client account to post a review for items you have purchased.
                    </p>
                  </div>
                  <Link
                    href={`${dashboardUrl}/login`}
                    target="_blank"
                    className="inline-flex items-center gap-2 px-6 py-2.5 rounded-2xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs shadow-glow-violet transition-all"
                  >
                    <UserCheck className="h-4 w-4" />
                    Sign In to Client Space →
                  </Link>
                </div>
              ) : loadingPurchases ? (
                <div className="py-8 text-center text-xs font-mono text-slate-400">
                  Verifying your purchased products...
                </div>
              ) : !hasPurchases && !isAdmin ? (
                /* LOGGED IN BUT NO PURCHASES FOUND */
                <div className="py-6 text-center space-y-4">
                  <div className="w-12 h-12 rounded-full bg-rose-500/10 border border-rose-500/20 flex items-center justify-center mx-auto text-rose-400">
                    <ShieldAlert className="h-6 w-6" />
                  </div>
                  <div className="space-y-1">
                    <h4 className="font-extrabold text-white text-base">No Verified Purchases Identified</h4>
                    <p className="text-xs text-slate-300 max-w-sm mx-auto leading-relaxed">
                      Only customers who own a paid order or active cloud service can post a review. You can only review items you have actually purchased.
                    </p>
                  </div>
                  <div className="pt-2">
                    <Link
                      href="/#pricing"
                      onClick={() => setModalOpen(false)}
                      className="inline-flex items-center gap-2 px-6 py-2.5 rounded-2xl bg-gradient-to-r from-purple-600 to-indigo-600 text-white font-bold text-xs shadow-glow-violet transition-all"
                    >
                      <ShoppingCart className="h-4 w-4" />
                      Browse Cloud Services &amp; VPS →
                    </Link>
                  </div>
                </div>
              ) : (
                /* FORM STATE: LOGGED IN AND VERIFIED PURCHASE AVAILABLE */
                <form onSubmit={handleSubmitReview} className="space-y-4 text-xs font-semibold">
                  {isAdmin && (
                    <div className="p-2.5 rounded-xl bg-purple-500/10 border border-purple-500/20 text-purple-300 text-[11px] font-mono flex items-center gap-2">
                      <Sparkles className="h-3.5 w-3.5 text-purple-400" />
                      <span>Admin Manual Review Mode Active</span>
                    </div>
                  )}

                  {/* SELECT PURCHASED ITEM */}
                  <div className="space-y-1">
                    <label className="text-slate-300 block flex items-center justify-between">
                      <span>Select Purchased Product to Review</span>
                      <span className="text-emerald-400 font-mono text-[10px] flex items-center gap-1">
                        <CheckCircle2 className="h-3 w-3" /> Verified Purchase
                      </span>
                    </label>

                    {purchasedItems.length > 0 ? (
                      <select
                        value={selectedItemId}
                        onChange={(e) => handleSelectItem(e.target.value)}
                        className="w-full bg-[#0a0b24] border border-white/15 rounded-xl px-3 py-2 text-white font-mono focus:outline-none focus:border-purple-500"
                      >
                        {purchasedItems.map((item) => (
                          <option key={item.id} value={item.id}>
                            {item.name} ({item.category.toUpperCase()})
                          </option>
                        ))}
                      </select>
                    ) : (
                      <input
                        type="text"
                        placeholder="Product Name (e.g. Cloud VPS Standard)"
                        value={productName}
                        onChange={(e) => setProductName(e.target.value)}
                        className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-white placeholder-slate-500 focus:outline-none focus:border-purple-500"
                      />
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-slate-300 block">Your Name</label>
                      <input
                        type="text"
                        required
                        placeholder="e.g. Kasun Perera"
                        value={authorName}
                        onChange={(e) => setAuthorName(e.target.value)}
                        className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-white placeholder-slate-500 focus:outline-none focus:border-purple-500"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-slate-300 block">Role / Company</label>
                      <input
                        type="text"
                        placeholder="e.g. Full-Stack Developer"
                        value={authorRole}
                        onChange={(e) => setAuthorRole(e.target.value)}
                        className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-white placeholder-slate-500 focus:outline-none focus:border-purple-500"
                      />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="text-slate-300 block">Rating</label>
                    <div className="flex items-center gap-1 pt-1">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <button
                          key={star}
                          type="button"
                          onClick={() => setRating(star)}
                          className="focus:outline-none"
                        >
                          <Star
                            className={`h-5 w-5 transition-transform hover:scale-125 ${
                              star <= rating ? 'fill-amber-400 text-amber-400' : 'text-slate-600'
                            }`}
                          />
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="text-slate-300 block">Review Feedback</label>
                    <textarea
                      required
                      rows={3}
                      placeholder="Share your verified experience with this purchased cloud product..."
                      value={comment}
                      onChange={(e) => setComment(e.target.value)}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-white placeholder-slate-500 focus:outline-none focus:border-purple-500"
                    />
                  </div>

                  {submitError && (
                    <div className="p-3 rounded-2xl bg-rose-500/15 border border-rose-500/30 text-rose-200 text-xs flex items-start gap-2.5">
                      <AlertCircle className="h-4 w-4 text-rose-400 shrink-0 mt-0.5" />
                      <span>{submitError}</span>
                    </div>
                  )}

                  {submitSuccess && (
                    <div className="p-3 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-200 text-xs flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
                      <span>{submitSuccess}</span>
                    </div>
                  )}

                  <div className="pt-2">
                    <button
                      type="submit"
                      disabled={submitting}
                      className="w-full py-3 rounded-2xl bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white font-bold text-xs shadow-glow-violet transition-all flex items-center justify-center gap-2"
                    >
                      {submitting ? 'Verifying Purchase & Publishing...' : 'Publish Verified Item Review →'}
                    </button>
                  </div>
                </form>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <StxFooter />
    </div>
  );
}
