import express from 'express';
import cors from 'cors';
import { config } from 'dotenv';
import authRouter from './routes/auth.routes';
import router from './routes';

config();

const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Routes
app.use('/api/auth', authRouter);
app.use('/api/v1', router);

// Example usage
app.get('/health', (_req, res) => {
  res.send('OK');
});

// Error handling middleware
app.use((err: Error, _req: express.Request, res: express.Response) => {
  console.error(err.stack);
  res.status(500).json({ message: 'Something went wrong!' });
});

app.listen(port, () => {
  // console.log(`Server is running on port ${port}`);
}); 