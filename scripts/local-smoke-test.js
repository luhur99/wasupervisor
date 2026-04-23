require('dotenv').config();
const axios = require('axios');
const { pool } = require('../src/config/database');
const { generateApiKey, hashApiKey } = require('../src/utils/crypto');

async function main() {
  const apiKey = generateApiKey();
  const keyHash = hashApiKey(apiKey);

  await pool.query(
    'INSERT INTO api_keys (name, key_hash, permissions) VALUES ($1, $2, $3)',
    ['Local Test Key', keyHash, JSON.stringify(['read', 'write'])]
  );

  const client = axios.create({
    baseURL: 'http://127.0.0.1:3000',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    timeout: 10000,
  });

  const phone = `62812${Math.floor(10000000 + Math.random() * 89999999)}`;

  const userRes = await client.post('/api/v1/users', {
    full_name: 'PIC Local Test',
    phone_number: phone,
    role: 'pic',
    department: 'QA',
  });

  const user = userRes.data;

  const today = new Date().toISOString().slice(0, 10);
  const taskRes = await client.post('/api/v1/tasks', {
    title: 'Test Tugas Lokal',
    description: 'Uji fungsi dashboard',
    assigned_to: user.id,
    due_date: today,
    priority: 'medium',
    send_reminder: true,
  });

  const task = taskRes.data;

  const tasksRes = await client.get(`/api/v1/tasks?assigned_to=${user.id}&page=1&limit=5`);
  const responsesRes = await client.get('/api/v1/responses?page=1&limit=5');

  const webhookRes = await axios.post('http://127.0.0.1:3000/webhook/cloudchat', {
    event: 'message.received',
    data: {
      from: '628999000111',
      type: 'text',
      text: 'halo test',
      message_id: 'local-test-001',
    },
  });

  console.log(`API_KEY=${apiKey}`);
  console.log(`USER_ID=${user.id}`);
  console.log(`TASK_ID=${task.id}`);
  console.log(`TASK_LIST_COUNT=${tasksRes.data.data.length}`);
  console.log(`RESPONSE_LIST_COUNT=${responsesRes.data.data.length}`);
  console.log(`WEBHOOK_OK=${webhookRes.data.ok}`);

  await pool.end();
}

main().catch(async (err) => {
  console.error('SMOKE_TEST_ERROR:', err.response?.data || err.message);
  try {
    await pool.end();
  } catch (_) {
    // ignore close errors
  }
  process.exit(1);
});
