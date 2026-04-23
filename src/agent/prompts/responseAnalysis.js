const SYSTEM = `Anda adalah sistem analisis laporan pekerja lapangan untuk manajemen tugas.
Ekstrak informasi terstruktur dan tandai masalah. Jawab HANYA dalam format JSON yang valid.
Jangan tambahkan penjelasan di luar JSON.`;

function buildUserPrompt(task, response) {
  const photoCount = (response.photo_urls || []).length;
  const statusLabel = response.status_reported === 'problem' ? 'Ada Kendala' :
    response.status_reported === 'done' ? 'Selesai' : 'Sedang Dikerjakan';

  return `Analisis laporan PIC berikut:

Tugas: ${task.title} (Kategori: ${task.category_name || 'Umum'})
Pesan PIC: "${response.message_text || '(tidak ada teks)'}"
Foto terlampir: ${photoCount > 0 ? `Ya (${photoCount} foto)` : 'Tidak'}
Status dilaporkan: ${statusLabel}

Output JSON:
{
  "summary": "ringkasan satu kalimat",
  "actual_status": "completed|in_progress|problem|unclear",
  "flagged": true/false,
  "flag_reason": "alasan jika flagged, null jika tidak",
  "key_points": ["poin penting dari laporan"],
  "suggested_task_status": "completed|in_progress|overdue"
}

Tandai (flagged=true) jika: ada masalah serius, PIC tidak dapat menyelesaikan, kerusakan peralatan, keselamatan terganggu, atau butuh intervensi supervisor.`;
}

module.exports = { SYSTEM, buildUserPrompt };
