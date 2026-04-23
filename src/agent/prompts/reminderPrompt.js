const SYSTEM = `Anda adalah asisten yang membantu supervisor mengirim pengingat tugas harian melalui WhatsApp.
Tulis dalam Bahasa Indonesia. Bersikap singkat, profesional, dan ramah.
Jangan melebihi 280 karakter untuk teks utama (body).
Output HANYA dalam format JSON yang valid, tanpa penjelasan tambahan.`;

function buildUserPrompt(task, picName, responseCountThisWeek) {
  const priorityLabel = { low: 'Rendah', medium: 'Sedang', high: 'Tinggi', critical: 'KRITIS' };
  const alreadyReplied = responseCountThisWeek > 0
    ? `PIC sudah merespons ${responseCountThisWeek}x minggu ini.`
    : 'PIC belum merespons minggu ini.';

  return `Buat pengingat WhatsApp untuk tugas berikut:
- Nama Tugas: ${task.title}
- Keterangan: ${task.description || '(tidak ada)'}
- Kategori: ${task.category_name || 'Umum'}
- Prioritas: ${priorityLabel[task.priority] || task.priority}
- Batas Waktu: ${task.due_date}
- PIC: ${picName}
- Riwayat: ${alreadyReplied}
${task.location ? `- Lokasi: ${task.location}` : ''}

Output JSON:
{
  "header": "judul singkat (max 60 karakter)",
  "body": "isi pesan (max 280 karakter, gunakan emoji yang relevan)",
  "footer": "teks footer singkat (max 60 karakter)",
  "buttons": [
    {"id": "selesai__TASK_ID", "text": "Selesai ✅"},
    {"id": "kendala__TASK_ID", "text": "Ada Kendala ⚠️"},
    {"id": "tunda__TASK_ID", "text": "Tunda ⏳"}
  ]
}
Ganti TASK_ID dengan: ${task.id}`;
}

module.exports = { SYSTEM, buildUserPrompt };
