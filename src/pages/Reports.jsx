import React, { useState, useEffect } from 'react';
import api from '../services/api';
import { 
  BarChart3, FileText, Download, TrendingUp, Heart, Star, 
  ArrowUpRight, ArrowDownRight, Award, ChevronDown 
} from 'lucide-react';
import { 
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend,
  BarChart, Bar, XAxis, YAxis, CartesianGrid
} from 'recharts';
import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import 'jspdf-autotable';
import toast from 'react-hot-toast';

const COLORS = ['#22c55e', '#3b82f6', '#f59e0b', '#ec4899', '#8b5cf6', '#06b6d4', '#10b981', '#6366f1', '#64748b'];

const Reports = () => {
  const [reportData, setReportData] = useState(null);
  const [analyticsData, setAnalyticsData] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchReports = async () => {
    try {
      const [reportRes, analyticsRes] = await Promise.all([
        api.get('/reports/monthly'),
        api.get('/reports/analytics')
      ]);

      if (reportRes.data.success) {
        setReportData(reportRes.data.data);
      }
      if (analyticsRes.data.success) {
        setAnalyticsData(analyticsRes.data.data);
      }
    } catch (error) {
      console.error(error);
      toast.error('Failed to load financial reports');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReports();
  }, []);

  // CSV EXPORT
  const handleExportCSV = () => {
    if (!reportData?.expensesList || reportData.expensesList.length === 0) {
      return toast.error('No expense data to export');
    }
    const headers = ['Date', 'Description', 'Category', 'Group', 'Paid By', 'Total Amount', 'Your Share'];
    const rows = reportData.expensesList.map(exp => [
      exp.date,
      `"${exp.description.replace(/"/g, '""')}"`,
      exp.category,
      `"${exp.groupName.replace(/"/g, '""')}"`,
      exp.paidBy,
      exp.totalAmount,
      exp.yourShare
    ]);
    const csvContent = "data:text/csv;charset=utf-8," 
      + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `SmartSplit_Monthly_Report_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // EXCEL EXPORT
  const handleExportExcel = () => {
    if (!reportData?.expensesList || reportData.expensesList.length === 0) {
      return toast.error('No expense data to export');
    }
    const ws = XLSX.utils.json_to_sheet(reportData.expensesList);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "SmartSplit Monthly Expenses");
    XLSX.writeFile(wb, `SmartSplit_Monthly_Report_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  // PDF EXPORT
  const handleExportPDF = () => {
    if (!reportData?.expensesList || reportData.expensesList.length === 0) {
      return toast.error('No expense data to export');
    }
    const doc = new jsPDF();
    
    // Title
    doc.setFont("helvetica", "bold");
    doc.setFontSize(22);
    doc.setTextColor(22, 197, 94); // brand green
    doc.text('SmartSplit Financial Summary', 14, 22);

    // Meta details
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(100, 116, 139);
    doc.text(`Generated on: ${new Date().toLocaleDateString()}`, 14, 28);
    doc.text(`Report Period: Current Calendar Month`, 14, 34);

    // Metrics Box
    doc.setDrawColor(229, 231, 235);
    doc.setFillColor(248, 250, 252);
    doc.rect(14, 40, 182, 32, 'F');
    
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(71, 85, 105);
    doc.text('TOTAL SPENDING', 20, 48);
    doc.text('YOU OWE', 75, 48);
    doc.text('YOU ARE OWED', 135, 48);

    doc.setFontSize(16);
    doc.setTextColor(15, 23, 42);
    doc.text(`Rs. ${reportData.totalSpending}`, 20, 58);
    doc.setTextColor(244, 63, 94); // red
    doc.text(`Rs. ${reportData.totalOwed}`, 75, 58);
    doc.setTextColor(16, 185, 129); // green
    doc.text(`Rs. ${reportData.totalReceivable}`, 135, 58);

    // Detailed spending list starts at Y = 88
    let startTableY = 88;

    // Expense table
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.setTextColor(15, 23, 42);
    doc.text('Detailed Spending List', 14, startTableY - 5);

    const tableHeaders = [['Date', 'Description', 'Category', 'Group', 'Paid By', 'Total (Rs.)', 'Your Share (Rs.)']];
    const tableData = reportData.expensesList.map(exp => [
      exp.date,
      exp.description,
      exp.category,
      exp.groupName,
      exp.paidBy,
      exp.totalAmount,
      exp.yourShare
    ]);

    doc.autoTable({
      head: tableHeaders,
      body: tableData,
      startY: startTableY,
      theme: 'grid',
      headStyles: { fillColor: [34, 197, 94], halign: 'center', fontStyle: 'bold' },
      columnStyles: {
        5: { halign: 'right' },
        6: { halign: 'right' }
      },
      styles: { fontSize: 8.5 }
    });

    doc.save(`SmartSplit_Monthly_Report_${new Date().toISOString().split('T')[0]}.pdf`);
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-96">
        <div className="w-10 h-10 border-4 border-green-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-slate-200 dark:border-slate-800/40 pb-5">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-slate-800 dark:text-slate-100">Financial Reports</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Export transaction logs and view details of monthly category spending.
          </p>
        </div>
        
        {/* Export buttons */}
        <div className="flex flex-wrap gap-2">
          <button
            onClick={handleExportCSV}
            className="flex items-center gap-2 px-3.5 py-2 text-xs font-semibold text-slate-700 bg-white dark:text-slate-300 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-xl transition-all shadow-sm"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export CSV</span>
          </button>
          <button
            onClick={handleExportExcel}
            className="flex items-center gap-2 px-3.5 py-2 text-xs font-semibold text-slate-700 bg-white dark:text-slate-300 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-xl transition-all shadow-sm"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export Excel</span>
          </button>
          <button
            onClick={handleExportPDF}
            className="flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-green-500 hover:bg-green-600 rounded-xl transition-all shadow-md shadow-green-500/10"
          >
            <FileText className="w-3.5 h-3.5" />
            <span>Export PDF</span>
          </button>
        </div>
      </div>

      {/* Main Aggregated Metrics Block */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {/* Spent */}
        <div className="glass-card p-5 border border-slate-200 dark:border-slate-800/80 flex items-center justify-between">
          <div className="flex flex-col gap-1 text-left">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Total Month Spending</span>
            <h3 className="text-2xl font-black text-slate-800 dark:text-slate-100">₹{reportData?.totalSpending}</h3>
          </div>
          <span className="p-3 rounded-2xl bg-green-500/10 text-green-500">
            <TrendingUp className="w-6 h-6" />
          </span>
        </div>

        {/* You owe */}
        <div className="glass-card p-5 border border-slate-200 dark:border-slate-800/80 flex items-center justify-between">
          <div className="flex flex-col gap-1 text-left">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Your Liabilities (You Owe)</span>
            <h3 className="text-2xl font-black text-rose-500">₹{reportData?.totalOwed}</h3>
          </div>
          <span className="p-3 rounded-2xl bg-rose-500/10 text-rose-500">
            <ArrowDownRight className="w-6 h-6" />
          </span>
        </div>

        {/* You are owed */}
        <div className="glass-card p-5 border border-slate-200 dark:border-slate-800/80 flex items-center justify-between">
          <div className="flex flex-col gap-1 text-left">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Your Receivables (Owed to You)</span>
            <h3 className="text-2xl font-black text-emerald-500">₹{reportData?.totalReceivable}</h3>
          </div>
          <span className="p-3 rounded-2xl bg-emerald-500/10 text-emerald-500">
            <ArrowUpRight className="w-6 h-6" />
          </span>
        </div>
      </div>


      {/* Grid of charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Category breakdown (Pie Chart) */}
        <div className="glass-card p-5 border border-slate-200/80 dark:border-slate-800/80 flex flex-col gap-4">
          <h3 className="font-bold text-slate-850 dark:text-slate-100 text-left">Category Wise Breakdown</h3>
          <div className="h-64 w-full">
            {analyticsData?.categorySpending && analyticsData.categorySpending.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={analyticsData.categorySpending}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={3}
                    dataKey="value"
                  >
                    {analyticsData.categorySpending.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip 
                    contentStyle={{ 
                      background: 'rgba(15, 23, 42, 0.9)', 
                      border: '1px solid rgba(255,255,255,0.1)', 
                      borderRadius: '8px',
                      color: '#f8fafc',
                      fontSize: '12px'
                    }}
                  />
                  <Legend 
                    layout="horizontal" 
                    verticalAlign="bottom" 
                    align="center"
                    wrapperStyle={{ fontSize: '10px' }}
                  />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-slate-400 text-xs">
                No category data available for this month.
              </div>
            )}
          </div>
        </div>

        {/* Group Spending comparison (Bar Chart) */}
        <div className="glass-card p-5 border border-slate-200/80 dark:border-slate-800/80 flex flex-col gap-4">
          <h3 className="font-bold text-slate-850 dark:text-slate-100 text-left">Group Wise Breakdown</h3>
          <div className="h-64 w-full">
            {analyticsData?.groupSpending && analyticsData.groupSpending.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={analyticsData.groupSpending} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.05)" />
                  <XAxis dataKey="name" stroke="#64748b" fontSize={11} tickLine={false} axisLine={false} />
                  <YAxis stroke="#64748b" fontSize={11} tickLine={false} axisLine={false} />
                  <Tooltip 
                    contentStyle={{ 
                      background: 'rgba(15, 23, 42, 0.9)', 
                      border: '1px solid rgba(255,255,255,0.1)', 
                      borderRadius: '8px',
                      color: '#f8fafc',
                      fontSize: '12px'
                    }}
                  />
                  <Bar dataKey="value" fill="#22c55e" radius={[4, 4, 0, 0]} barSize={18} name="Spent (Rs)" />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-slate-400 text-xs">
                No group spending data available for this month.
              </div>
            )}
          </div>
        </div>

      </div>

      {/* Meta Analytics & Reliability Section */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        
        {/* Settlements statistics */}
        <div className="glass-card p-5 border border-slate-200/80 dark:border-slate-800/80 flex flex-col gap-4 text-left">
          <h3 className="font-bold text-slate-850 dark:text-slate-100">Settlements Summary</h3>
          <div className="grid grid-cols-2 gap-4">
            <div className="p-4 bg-slate-100 dark:bg-slate-900/40 border border-slate-200/20 rounded-2xl flex flex-col">
              <span className="text-2xl font-black text-slate-800 dark:text-slate-100">
                {reportData?.settlements.completionRate}%
              </span>
              <span className="text-[10px] text-slate-400 uppercase font-semibold mt-1">Completion Rate</span>
            </div>
            <div className="p-4 bg-slate-100 dark:bg-slate-900/40 border border-slate-200/20 rounded-2xl flex flex-col">
              <span className="text-2xl font-black text-slate-800 dark:text-slate-100">
                {reportData?.settlements.pending}
              </span>
              <span className="text-[10px] text-slate-400 uppercase font-semibold mt-1">Pending Payments</span>
            </div>
          </div>
        </div>

        {/* User reliability score */}
        <div className="glass-card p-5 border border-slate-200/80 dark:border-slate-800/80 flex flex-col gap-4 text-left">
          <h3 className="font-bold text-slate-850 dark:text-slate-100">My Payer Score</h3>
          <div className="flex items-center gap-4 bg-green-500/5 p-4 rounded-2xl border border-green-500/10">
            <span className="p-3.5 rounded-2xl bg-green-500/10 text-green-500">
              <Award className="w-7 h-7" />
            </span>
            <div className="flex flex-col">
              <span className="text-2xl font-black text-slate-850 dark:text-slate-150">
                {reportData?.reliabilityScore}/100
              </span>
              <span className="text-xs text-slate-500 font-semibold mt-0.5">
                Rating: <span className="text-green-500 font-bold">{reportData?.reliabilityLabel}</span>
              </span>
            </div>
          </div>
        </div>

      </div>

      {/* Spend detail history list */}
      <div className="glass-card p-5 border border-slate-200/80 dark:border-slate-800/80 flex flex-col gap-4">
        <h3 className="font-bold text-slate-850 dark:text-slate-100 text-left">Detailed Spending List</h3>
        <div className="overflow-x-auto w-full">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-400 uppercase tracking-wider font-semibold">
                <th className="py-2">Date</th>
                <th className="py-2">Description</th>
                <th className="py-2">Category</th>
                <th className="py-2">Group</th>
                <th className="py-2">Paid By</th>
                <th className="py-2 text-right">Total Amount</th>
                <th className="py-2 text-right">Your Share</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/40 text-slate-650 dark:text-slate-350">
              {reportData?.expensesList.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-6 text-slate-400">No expenses recorded for this month.</td>
                </tr>
              ) : (
                reportData?.expensesList.map((exp, idx) => (
                  <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-slate-900/10">
                    <td className="py-3.5">{exp.date}</td>
                    <td className="py-3.5 font-semibold text-slate-800 dark:text-slate-200">{exp.description}</td>
                    <td className="py-3.5">{exp.category}</td>
                    <td className="py-3.5">{exp.groupName}</td>
                    <td className="py-3.5">{exp.paidBy}</td>
                    <td className="py-3.5 text-right">₹{exp.totalAmount}</td>
                    <td className="py-3.5 text-right font-bold text-slate-800 dark:text-slate-200">₹{exp.yourShare}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
};

export default Reports;
