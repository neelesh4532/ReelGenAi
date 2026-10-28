import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import ideasRouter from './routes/ideas.js';
import scriptsRouter from './routes/scripts.js';

const app = express();
const PORT = process.env.PORT || 5000;

app.use(helmet());
app.use(cors({ origin: process.env.CLIENT_URL || 'http://127.0.0.1:5500' }));
app.use(express.json());

app.get('/health', (req, res) => {
  res.json({ status: 'ok', uptime: process.uptime() });
});

app.use('/api/ideas', ideasRouter);
app.use('/api/scripts', scriptsRouter);

// error handler, must come after all routes
app.use((err, req, res, next) => {
  console.error(err.message);
  const status = err.status || 500;
  res.status(status).json({
    error: status === 500 ? 'Something went wrong' : err.message,
    detail: process.env.NODE_ENV === 'production' ? undefined : err.message,
  });
});
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));