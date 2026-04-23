-- Seed default task categories
INSERT INTO task_categories (name, description, color_hex, icon) VALUES
  ('Maintenance',    'Perawatan peralatan dan fasilitas',     '#F59E0B', 'wrench'),
  ('Laporan',        'Tugas pelaporan harian/mingguan',       '#3B82F6', 'file-alt'),
  ('Inspeksi',       'Inspeksi lokasi dan keselamatan',       '#10B981', 'search'),
  ('Administrasi',   'Tugas administrasi dan dokumentasi',    '#8B5CF6', 'folder'),
  ('Operasional',    'Tugas operasional sehari-hari',         '#EF4444', 'cogs')
ON CONFLICT (name) DO NOTHING;
