import app from './app.js';
import { startBackgroundScheduler } from './services/scheduler.js';
import { initDatabase } from './services/db.js';

const PORT = Number(process.env.PORT ?? 4000);

app.listen(PORT, '0.0.0.0', async () => {
  console.log(`PingPongBros API is running on http://localhost:${PORT}`);
  // Kết nối cơ sở dữ liệu Microsoft SQL Server
  await initDatabase();
  // Khởi động bộ lập lịch tự động
  startBackgroundScheduler();
});
