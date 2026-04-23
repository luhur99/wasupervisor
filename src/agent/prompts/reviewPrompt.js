const SYSTEM = `Anda adalah asisten HR yang membuat evaluasi kinerja profesional untuk pekerja lapangan.
Tulis dalam Bahasa Indonesia. Bersikap objektif, konstruktif, dan spesifik.
Dasarkan SEMUA observasi pada data yang diberikan — jangan mengarang fakta.
Output HANYA dalam format JSON yang valid.`;

function buildUserPrompt(user, metrics, period, periodStart, periodEnd) {
  const periodLabel = period === 'weekly' ? 'Mingguan' : 'Bulanan';
  const completionRate = metrics.tasks_assigned > 0
    ? ((metrics.tasks_completed / metrics.tasks_assigned) * 100).toFixed(1)
    : '0.0';

  const categoryBreakdown = metrics.by_category && metrics.by_category.length > 0
    ? metrics.by_category.map(c => `${c.name}: ${c.completed}/${c.total}`).join(', ')
    : '(tidak ada data)';

  return `Buat evaluasi kinerja ${periodLabel} untuk:

Nama PIC: ${user.full_name}
Departemen: ${user.department || 'Umum'}
Periode: ${periodStart} s/d ${periodEnd}

Data Kinerja:
- Tugas ditugaskan: ${metrics.tasks_assigned}
- Tugas diselesaikan tepat waktu: ${metrics.tasks_completed} (${completionRate}%)
- Tugas terlambat/overdue: ${metrics.tasks_overdue}
- Tingkat respons (balasan saat diingatkan): ${metrics.response_rate || 0}%
- Rata-rata waktu respons: ${metrics.avg_response_time_hours || 0} jam
- Laporan masalah diajukan: ${metrics.problem_reports}
- Respon yang ditandai masalah oleh AI: ${metrics.flagged_responses || 0}
- Per Kategori: ${categoryBreakdown}

Output JSON:
{
  "quality_score": angka 0.0-10.0,
  "narrative": "2-3 paragraf evaluasi narasi",
  "strengths": ["max 3 poin kekuatan spesifik"],
  "improvements": ["max 3 poin area yang perlu ditingkatkan"],
  "supervisor_summary": "1 kalimat ringkasan untuk supervisor (max 100 karakter)"
}`;
}

module.exports = { SYSTEM, buildUserPrompt };
