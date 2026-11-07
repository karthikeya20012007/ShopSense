import React, { useState, useEffect } from 'react';
import { apiClient } from '../api/client';
import type { RecommendationEvaluation } from '../types';
import { Card, CardContent } from './ui/Card';
import { Button } from './ui/Button';

export const RecommendationDiagnosticsView: React.FC = () => {
  const [evaluation, setEvaluation] = useState<RecommendationEvaluation | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [kCutoff, setKCutoff] = useState<number>(5);
  const [trainRatio, setTrainRatio] = useState<number>(0.8);

  const loadEvaluation = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await apiClient.get<RecommendationEvaluation>(
        `/recommendations/evaluation?k=${kCutoff}&train_ratio=${trainRatio}`
      );
      setEvaluation(res.data);
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to execute recommendation offline evaluation.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadEvaluation();
  }, [kCutoff, trainRatio]);

  if (loading && !evaluation) {
    return (
      <div className="space-y-6">
        <div className="h-28 rounded-2xl bg-slate-200 animate-pulse" />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-28 rounded-2xl bg-slate-200 animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  if (error && !evaluation) {
    return (
      <Card className="border-rose-200 bg-rose-50/50 p-6 text-center">
        <CardContent className="space-y-3">
          <p className="font-bold text-rose-800 text-sm">Evaluation Run Failed</p>
          <p className="text-xs text-rose-700">{error}</p>
          <Button variant="danger" size="sm" onClick={loadEvaluation}>
            Retry Evaluation Run
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-8">
      {/* Control Banner */}
      <Card className="border-slate-200/80 shadow-xs">
        <CardContent className="p-6">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <span>🎯</span>
                <span>ML Recommendation Offline Evaluation & Diagnostics</span>
              </h2>
              <p className="text-xs text-slate-500 mt-1">
                Leak-free chronological holdout evaluation: Hybrid Collaborative Filtering vs Popularity Baseline
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-1.5">
                <label htmlFor="k-cutoff-select" className="text-xs font-semibold text-slate-600">
                  Cutoff (K):
                </label>
                <select
                  id="k-cutoff-select"
                  value={kCutoff}
                  onChange={(e) => setKCutoff(Number(e.target.value))}
                  className="px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs font-semibold text-slate-800 bg-white shadow-xs"
                >
                  <option value={3}>K = 3</option>
                  <option value={5}>K = 5</option>
                  <option value={10}>K = 10</option>
                </select>
              </div>

              <div className="flex items-center gap-1.5">
                <label htmlFor="train-split-select" className="text-xs font-semibold text-slate-600">
                  Split:
                </label>
                <select
                  id="train-split-select"
                  value={trainRatio}
                  onChange={(e) => setTrainRatio(Number(e.target.value))}
                  className="px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs font-semibold text-slate-800 bg-white shadow-xs"
                >
                  <option value={0.7}>70% Train / 30% Test</option>
                  <option value={0.8}>80% Train / 20% Test</option>
                  <option value={0.85}>85% Train / 15% Test</option>
                </select>
              </div>

              <Button variant="outline" size="xs" onClick={loadEvaluation}>
                🔄 Re-run
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {evaluation && (
        <>
          {/* Methodology Card */}
          <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 rounded-2xl p-6 text-white shadow-lg space-y-4">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
              <div>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-sky-400/20 text-sky-200 border border-sky-300/30 uppercase tracking-wider">
                  Leak-Free Chronological Holdout
                </span>
                <h3 className="text-lg font-extrabold mt-1">Evaluation Methodology & Cohort Sizing</h3>
              </div>
              <div className="text-xs text-sky-200 bg-white/10 px-3 py-1.5 rounded-xl border border-white/10 font-mono">
                Train Orders: {evaluation.train_orders_count} | Test Orders: {evaluation.test_orders_count}
              </div>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed">{evaluation.methodology}</p>

            <div className="bg-white/5 border border-white/10 rounded-xl p-4 text-xs space-y-1.5">
              <span className="font-bold text-sky-300 block">Cohort Sizing & Exact vs Category Relevance:</span>
              <p className="text-slate-200 leading-relaxed">{evaluation.target_relevance_analysis}</p>
            </div>
          </div>

          {/* Metric Comparison Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card className="border-slate-200/80 shadow-xs">
              <CardContent className="p-5">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 block mb-1">
                  Hybrid Category Hit Rate@{evaluation.k}
                </span>
                <div className="text-2xl sm:text-3xl font-extrabold text-sky-600">
                  {Number(evaluation.hybrid_category_hit_rate).toFixed(1)}%
                </div>
                <p className="text-xs text-slate-500 mt-1">
                  Baseline Popularity: {Number(evaluation.popularity_category_hit_rate).toFixed(1)}%
                </p>
              </CardContent>
            </Card>

            <Card className="border-slate-200/80 shadow-xs">
              <CardContent className="p-5">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 block mb-1">
                  Lift Over Popularity
                </span>
                <div
                  className={`text-2xl sm:text-3xl font-extrabold ${
                    evaluation.lift_over_popularity >= 0 ? 'text-emerald-600' : 'text-slate-900'
                  }`}
                >
                  {evaluation.lift_over_popularity >= 0 ? '+' : ''}
                  {Number(evaluation.lift_over_popularity).toFixed(1)}%
                </div>
                <p className="text-xs text-slate-500 mt-1">Category intent alignment lift</p>
              </CardContent>
            </Card>

            <Card className="border-slate-200/80 shadow-xs">
              <CardContent className="p-5">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 block mb-1">
                  Hybrid Exact Hit Rate@{evaluation.k}
                </span>
                <div className="text-2xl sm:text-3xl font-extrabold text-slate-900">
                  {Number(evaluation.hybrid_exact_hit_rate).toFixed(1)}%
                </div>
                <p className="text-xs text-slate-500 mt-1">
                  Exact SKU precision: {Number(evaluation.hybrid_exact_precision).toFixed(1)}%
                </p>
              </CardContent>
            </Card>

            <Card className="border-slate-200/80 shadow-xs">
              <CardContent className="p-5">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 block mb-1">
                  Evaluated Test Customers
                </span>
                <div className="text-2xl sm:text-3xl font-extrabold text-slate-900">{evaluation.evaluated_customers_count}</div>
                <p className="text-xs text-slate-500 mt-1">Returning buyers with orders in train & test</p>
              </CardContent>
            </Card>
          </div>

          {/* Detailed Metric Breakdown Table */}
          <Card className="border-slate-200/80 shadow-xs overflow-hidden">
            <div className="p-5 border-b border-slate-200">
              <h3 className="text-sm font-bold text-slate-900">
                Offline Algorithm Comparison Matrix (Top-K = {evaluation.k})
              </h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-600">
                <thead className="bg-slate-50 text-[11px] uppercase tracking-wider font-bold text-slate-500 border-b border-slate-200">
                  <tr>
                    <th className="py-3 px-4">Recommendation Algorithm</th>
                    <th className="py-3 px-4 text-center">Category Hit Rate@{evaluation.k}</th>
                    <th className="py-3 px-4 text-center">Exact SKU Hit Rate@{evaluation.k}</th>
                    <th className="py-3 px-4 text-center">Exact SKU Precision@{evaluation.k}</th>
                    <th className="py-3 px-4 text-center">Relative Lift</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  <tr className="bg-sky-50/50">
                    <td className="py-3 px-4 font-bold text-sky-950">
                      ✨ Hybrid Model (Collaborative + Category Affinity)
                    </td>
                    <td className="py-3 px-4 text-center font-bold text-sky-700">
                      {Number(evaluation.hybrid_category_hit_rate).toFixed(1)}%
                    </td>
                    <td className="py-3 px-4 text-center font-bold text-slate-900">
                      {Number(evaluation.hybrid_exact_hit_rate).toFixed(1)}%
                    </td>
                    <td className="py-3 px-4 text-center text-slate-800">
                      {Number(evaluation.hybrid_exact_precision).toFixed(1)}%
                    </td>
                    <td className="py-3 px-4 text-center font-bold text-emerald-600">
                      {evaluation.lift_over_popularity >= 0 ? '+' : ''}
                      {Number(evaluation.lift_over_popularity).toFixed(1)}%
                    </td>
                  </tr>
                  <tr>
                    <td className="py-3 px-4 font-medium text-slate-700">📊 Popularity Baseline (Order Volume Ranking)</td>
                    <td className="py-3 px-4 text-center font-medium text-slate-800">
                      {Number(evaluation.popularity_category_hit_rate).toFixed(1)}%
                    </td>
                    <td className="py-3 px-4 text-center font-medium text-slate-800">
                      {Number(evaluation.popularity_exact_hit_rate).toFixed(1)}%
                    </td>
                    <td className="py-3 px-4 text-center text-slate-600">
                      {(Number(evaluation.popularity_exact_hit_rate) / evaluation.k).toFixed(1)}%
                    </td>
                    <td className="py-3 px-4 text-center text-slate-400">Baseline (0%)</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </Card>
        </>
      )}
    </div>
  );
};
