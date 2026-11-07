import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { apiClient } from '../api/client';
import type { CustomerMySegment } from '../types';
import { RecommendationsSection } from './RecommendationsSection';
import { Card, CardContent } from './ui/Card';
import { Button } from './ui/Button';

export const CustomerMySegmentView: React.FC = () => {
  const [data, setData] = useState<CustomerMySegment | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const loadSegment = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await apiClient.get<CustomerMySegment>('/customer-analytics/my-segment');
      setData(res.data);
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to retrieve your membership profile.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSegment();
  }, []);

  const formatPrice = (val: string | number | undefined | null) => {
    if (val === undefined || val === null) return '0.00';
    const num = typeof val === 'number' ? val : parseFloat(String(val));
    return isNaN(num) ? '0.00' : num.toFixed(2);
  };

  const getTierDetails = (label: string) => {
    const l = (label || '').toLowerCase();
    if (l.includes('champion')) {
      return {
        icon: '👑',
        name: 'Enterprise Champion',
        gradient: 'from-amber-600 via-yellow-500 to-amber-700',
        badgeBg: 'bg-amber-400/20 text-amber-200 border-amber-300/30',
        perkTitle: 'Elite VIP Rewards & Priority Logistics',
        perkDescription:
          'You are in our highest tier of buyers. Enjoy free express courier delivery, early access to new retail sensor arrivals, and direct vendor concierge support.',
        perks: [
          'Zero-cost express pallet & courier delivery',
          'Automated tier-3 volume contract pricing',
          'Direct enterprise vendor SLA & replacement priority',
          'Early procurement access for scarce IoT inventory',
        ],
      };
    }
    if (l.includes('loyal')) {
      return {
        icon: '💎',
        name: 'Loyal Commercial Partner',
        gradient: 'from-sky-700 via-blue-600 to-indigo-800',
        badgeBg: 'bg-sky-400/20 text-sky-200 border-sky-300/30',
        perkTitle: 'Loyal Member Volume Incentives',
        perkDescription:
          'Thank you for your repeat business! You qualify for loyalty volume incentives and priority restock notifications.',
        perks: [
          'Pre-allocated inventory hold during supply shortages',
          'Standard net-30 vendor invoicing eligibility',
          'Priority RMA warranty resolution turnaround',
        ],
      };
    }
    if (l.includes('at-risk') || l.includes('lapsed')) {
      return {
        icon: '🌟',
        name: 'Re-engagement Member',
        gradient: 'from-rose-700 via-orange-600 to-amber-700',
        badgeBg: 'bg-orange-400/20 text-orange-200 border-orange-300/30',
        perkTitle: 'Exclusive Comeback Incentive',
        perkDescription:
          'We miss your enterprise fleet orders. Discover our newly stocked catalog additions and use your dedicated re-engagement tier discount at checkout.',
        perks: [
          'One-click stock replenishments from order history',
          'Special comeback margin discounts on checkout',
          'Personalized catalog feed matching past store equipment',
        ],
      };
    }
    return {
      icon: '🚀',
      name: 'Standard Commerce Tier',
      gradient: 'from-slate-800 via-slate-900 to-slate-950',
      badgeBg: 'bg-slate-700/50 text-slate-200 border-slate-600/50',
      perkTitle: 'Welcome Member Tier',
      perkDescription:
        'Explore verified retail hardware and smart POS sensors. Build your order history to unlock tiered perks and automated volume benefits.',
      perks: [
        'Verified marketplace supplier warranties',
        'Real-time automated inventory tracking',
        'Standard B2B order fulfillment tracking',
      ],
    };
  };

  if (loading) {
    return (
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-6">
        <div className="h-64 rounded-3xl bg-slate-200 animate-pulse" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-28 rounded-2xl bg-slate-200 animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="max-w-xl mx-auto my-16 px-4">
        <Card className="border-rose-200 bg-rose-50/50 text-center p-8">
          <CardContent className="space-y-4">
            <span className="text-4xl block">⚠️</span>
            <h3 className="text-base font-bold text-slate-900">Could Not Retrieve Membership Status</h3>
            <p className="text-sm text-slate-600">{error || 'Unable to load segment profile.'}</p>
            <Button variant="primary" onClick={loadSegment}>
              Retry Loading Profile
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const tier = getTierDetails(data.segment_label);

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8">
      {/* Executive Hero Tier Banner */}
      <div
        className={`bg-gradient-to-br ${tier.gradient} rounded-3xl p-8 sm:p-12 text-white shadow-xl relative overflow-hidden`}
      >
        <div className="relative z-10 max-w-2xl">
          <div className="flex flex-wrap items-center gap-3 mb-4">
            <span className="text-4xl sm:text-5xl drop-shadow-md">{tier.icon}</span>
            <span
              className={`px-3.5 py-1 rounded-full text-xs font-bold backdrop-blur-md border uppercase tracking-wider ${tier.badgeBg}`}
            >
              Account Tier &bull; {data.segment_label}
            </span>
          </div>

          <h1 className="text-2xl sm:text-4xl font-extrabold tracking-tight mb-3">
            {tier.name}
          </h1>
          <p className="text-sm sm:text-base text-white/90 leading-relaxed mb-6 font-normal">
            {data.segment_description}
          </p>

          {/* Tier Benefit Box */}
          <div className="bg-white/10 backdrop-blur-md border border-white/20 rounded-2xl p-5 text-sm space-y-2">
            <div className="font-bold text-white flex items-center gap-2">
              <span>🎁</span>
              <span>{tier.perkTitle}</span>
            </div>
            <p className="text-white/80 text-xs sm:text-sm leading-relaxed">
              {data.recommended_action || tier.perkDescription}
            </p>
          </div>
        </div>

        {/* Decorative backdrop symbol */}
        <div className="absolute -bottom-10 -right-6 text-white/5 text-[180px] font-black select-none pointer-events-none">
          {tier.icon}
        </div>
      </div>

      {/* Snapshot Metric Cards */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-slate-900 tracking-tight">Your Account Activity Snapshot</h2>
          <span className="text-xs text-slate-500 font-medium">Real-time marketplace analytics</span>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {/* Frequency */}
          <Card className="border-slate-200/80 shadow-xs hover:border-slate-300 transition-colors">
            <CardContent className="p-5">
              <div className="flex items-center justify-between text-slate-400 mb-2">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                  Completed Orders
                </span>
                <span className="text-base">📦</span>
              </div>
              <div className="text-2xl sm:text-3xl font-extrabold text-slate-900">
                {data.frequency}
              </div>
              <p className="text-xs text-slate-500 mt-1">Verified checkouts</p>
            </CardContent>
          </Card>

          {/* Monetary Spend */}
          <Card className="border-slate-200/80 shadow-xs hover:border-slate-300 transition-colors">
            <CardContent className="p-5">
              <div className="flex items-center justify-between text-slate-400 mb-2">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                  Lifetime Spend
                </span>
                <span className="text-base text-emerald-600 font-bold">₹</span>
              </div>
              <div className="text-2xl sm:text-3xl font-extrabold text-emerald-600">
                ₹{formatPrice(data.monetary_spend)}
              </div>
              <p className="text-xs text-slate-500 mt-1">Total recognized value</p>
            </CardContent>
          </Card>

          {/* AOV */}
          <Card className="border-slate-200/80 shadow-xs hover:border-slate-300 transition-colors">
            <CardContent className="p-5">
              <div className="flex items-center justify-between text-slate-400 mb-2">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                  Avg Order Value
                </span>
                <span className="text-base">📊</span>
              </div>
              <div className="text-2xl sm:text-3xl font-extrabold text-slate-900">
                ₹{formatPrice(data.average_order_value)}
              </div>
              <p className="text-xs text-slate-500 mt-1">Per transaction average</p>
            </CardContent>
          </Card>

          {/* Recency */}
          <Card className="border-slate-200/80 shadow-xs hover:border-slate-300 transition-colors">
            <CardContent className="p-5">
              <div className="flex items-center justify-between text-slate-400 mb-2">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                  Last Order
                </span>
                <span className="text-base">⏱️</span>
              </div>
              <div className="text-2xl sm:text-3xl font-extrabold text-slate-900">
                {data.recency_days !== null && data.recency_days !== undefined
                  ? `${data.recency_days}d ago`
                  : 'None'}
              </div>
              <p className="text-xs text-slate-500 mt-1">
                {data.recency_days !== null ? 'Order recency' : 'No prior orders'}
              </p>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Tier Perks & Capabilities */}
      <Card className="border-slate-200/80 shadow-xs">
        <CardContent className="p-6 sm:p-8">
          <h3 className="text-base font-bold text-slate-900 mb-4 flex items-center gap-2">
            <span>🛡️</span>
            <span>Unlocked Tier Privileges</span>
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {tier.perks.map((perk, idx) => (
              <div key={idx} className="flex items-start gap-3 p-3 rounded-xl bg-slate-50 border border-slate-100">
                <div className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center text-xs font-bold shrink-0 mt-0.5">
                  ✓
                </div>
                <span className="text-xs sm:text-sm text-slate-700 font-medium leading-relaxed">
                  {perk}
                </span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Personalized AI Recommendations */}
      <RecommendationsSection
        variant="for-me"
        title="Personalized Recommendations for Your Setup"
        limit={4}
      />

      {/* Navigation Footer */}
      <div className="flex flex-col sm:flex-row items-center justify-between p-6 bg-slate-900 text-white rounded-2xl gap-4 shadow-lg">
        <div>
          <h4 className="text-sm font-bold text-white">Need to replenish retail hardware or track ongoing shipments?</h4>
          <p className="text-xs text-slate-400 mt-1">
            Access order fulfillment logs or browse certified suppliers in the marketplace.
          </p>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <Link to="/orders">
            <Button variant="outline" className="text-white border-slate-700 hover:bg-slate-800">
              View Order History
            </Button>
          </Link>
          <Link to="/products">
            <Button variant="primary">
              Browse Catalog →
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
};
