import React from 'react';
import { EvaluationReport } from '../types';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import { BarChart3, CheckCircle2, TrendingUp, Award, Layers } from 'lucide-react';

interface IndicadoresViewProps {
  reports: EvaluationReport[];
}

export const IndicadoresView: React.FC<IndicadoresViewProps> = ({ reports }) => {
  const totalReports = reports.length;
  const avgScore =
    totalReports > 0
      ? Math.round((reports.reduce((acc, r) => acc + r.totalScore, 0) / totalReports) * 10) / 10
      : 0;

  const count100 = reports.filter((r) => r.totalScore === 100).length;
  const count90to99 = reports.filter((r) => r.totalScore >= 90 && r.totalScore < 100).length;
  const count75to89 = reports.filter((r) => r.totalScore >= 75 && r.totalScore < 90).length;
  const countBelow75 = reports.filter((r) => r.totalScore < 75).length;

  const totalPassedItems = reports.reduce((acc, r) => acc + (r.passedItems ?? 0), 0);
  const totalFailedItems = reports.reduce((acc, r) => acc + (r.failedItems ?? 0), 0);
  const totalEvaluatedItems = totalPassedItems + totalFailedItems;
  const pctSobre100 = totalEvaluatedItems > 0 ? Math.round((totalPassedItems / totalEvaluatedItems) * 100) : 0;

  // Chart Data: Zone averages
  const zonesList = ['ZUCAMI', 'SALMET', 'GRANJAS PISO', 'EL ROBLE'];
  const zoneChartData = zonesList.map((z) => {
    const zoneReps = reports.filter((r) => r.zone === z);
    const score =
      zoneReps.length > 0
        ? Math.round((zoneReps.reduce((acc, r) => acc + r.totalScore, 0) / zoneReps.length) * 10) /
          10
        : 0;
    return {
      name: z,
      Cumplimiento: score,
      Cantidad: zoneReps.length,
    };
  });

  // Pie Chart Data: Score Distribution Ranges
  const pieData = [
    { name: '100% de Cumplimiento', value: count100, color: '#00796B' },
    { name: '90% a 99%', value: count90to99, color: '#0d9488' },
    { name: '75% a 89%', value: count75to89, color: '#f59e0b' },
    { name: 'Menor a 75%', value: countBelow75, color: '#ef4444' },
  ].filter((d) => d.value > 0);

  // Items below 100% extracted (items with score < 100 or status no_cumple)
  const failedItemsList: { question: string; farm: string; zone: string; obs?: string; score?: number }[] = [];
  reports.forEach((r) => {
    r.sections.forEach((s) => {
      s.items.forEach((item) => {
        if ((item.score !== undefined && item.score < 100) || item.status === 'no_cumple') {
          failedItemsList.push({
            question: item.question,
            farm: r.farm,
            zone: r.zone,
            obs: item.observation,
            score: item.score,
          });
        }
      });
    });
  });

  return (
    <div className="p-4 sm:p-6 max-w-5xl mx-auto space-y-6 pb-24">
      {/* Top Banner */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <span className="text-[10px] font-bold uppercase tracking-wider text-teal-700 bg-teal-50 px-2.5 py-1 rounded-md border border-teal-200">
            DASHBOARD DE GESTIÓN Y CALIDAD
          </span>
          <h2 className="text-xl font-extrabold text-slate-800 mt-1">Indicadores Overhaul Kikes</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Desempeño general de infraestructura y porcentaje numérico de cumplimiento por zonas.
          </p>
        </div>

        <div className="flex items-center space-x-3">
          <div className="bg-teal-50 border border-teal-200 rounded-xl px-4 py-2.5 text-center">
            <span className="text-[10px] font-bold text-teal-800 uppercase block">Promedio General</span>
            <span className="text-2xl font-extrabold text-[#00796B]">{avgScore}%</span>
          </div>

          <div className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-center">
            <span className="text-[10px] font-bold text-slate-500 uppercase block">Total Actas</span>
            <span className="text-2xl font-extrabold text-slate-800">{totalReports}</span>
          </div>
        </div>
      </div>

      {/* KPI Cards Row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm flex items-center space-x-4">
          <div className="w-12 h-12 rounded-xl bg-teal-50 border border-teal-200 flex items-center justify-center text-[#00796B]">
            <Award className="w-6 h-6" />
          </div>
          <div>
            <span className="text-xs font-semibold text-slate-500">Actas al 100%</span>
            <h3 className="text-xl font-bold text-slate-800">{count100}</h3>
            <span className="text-[10px] text-teal-700 font-bold">100% de cumplimiento</span>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm flex items-center space-x-4">
          <div className="w-12 h-12 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-600">
            <CheckCircle2 className="w-6 h-6" />
          </div>
          <div>
            <span className="text-xs font-semibold text-slate-500">Ítems Sobre el 100%</span>
            <h3 className="text-xl font-bold text-slate-800">{totalPassedItems}</h3>
            <span className="text-[10px] text-emerald-600 font-bold">De {totalEvaluatedItems} evaluados</span>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm flex items-center space-x-4">
          <div className="w-12 h-12 rounded-xl bg-teal-50 border border-teal-200 flex items-center justify-center text-[#00796B]">
            <TrendingUp className="w-6 h-6" />
          </div>
          <div>
            <span className="text-xs font-semibold text-slate-500">% Actividades Sobre 100%</span>
            <h3 className="text-xl font-bold text-[#00796B]">
              {pctSobre100}%
            </h3>
            <span className="text-[10px] text-teal-600 font-bold">Tasa global de éxito</span>
          </div>
        </div>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Bar Chart: Compliance by Zone */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <h3 className="font-bold text-slate-800 text-sm uppercase tracking-wide">
              Cumplimiento Promedio por Zona (%)
            </h3>
            <BarChart3 className="w-4 h-4 text-[#00796B]" />
          </div>

          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={zoneChartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} />
                <Tooltip />
                <Bar dataKey="Cumplimiento" fill="#00796B" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Pie Chart: Score Range Breakdown */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <h3 className="font-bold text-slate-800 text-sm uppercase tracking-wide">
              Distribución de Rangos de Calificación (%)
            </h3>
            <Layers className="w-4 h-4 text-teal-600" />
          </div>

          <div className="h-64 flex items-center justify-center">
            {pieData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pieData}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={80}
                    label={({ name, percent }) => `${name.split(' ')[0]}: ${(percent * 100).toFixed(0)}%`}
                  >
                    {pieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="text-slate-400 text-xs">Sin datos registrados</div>
            )}
          </div>
        </div>
      </div>

      {/* Failures List */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <h3 className="font-bold text-slate-800 text-sm uppercase tracking-wide">
            Puntos de Atención / Ítems por debajo del 100% ({failedItemsList.length})
          </h3>
          <span className="text-xs text-red-600 font-bold bg-red-50 px-2 py-0.5 rounded border border-red-200">
            Por debajo del 100%
          </span>
        </div>

        <div className="space-y-2">
          {failedItemsList.map((item, idx) => (
            <div
              key={idx}
              className="p-3 bg-red-50/60 border border-red-200 rounded-lg text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2"
            >
              <div>
                <span className="font-bold text-red-900 block">{item.question}</span>
                {item.obs && <span className="text-slate-600 italic block mt-0.5">"{item.obs}"</span>}
              </div>
              <div className="text-right shrink-0">
                <span className="font-semibold text-red-800 bg-white px-2 py-0.5 rounded border border-red-200">
                  Granja {item.farm} ({item.zone})
                </span>
              </div>
            </div>
          ))}

          {failedItemsList.length === 0 && (
            <div className="p-4 text-center text-slate-500 text-xs">
              No hay observaciones o ítems por debajo del 100% registrados en las evaluaciones recientes.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
