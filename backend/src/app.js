import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import env from './config/env.js';
import apiRoutes from './routes/index.js';
import { notFoundHandler, errorHandler } from './middlewares/errorHandler.js';

const app = express();

// Security & CORS Middlewares
app.use(helmet());
app.use(cors());

// Request Body Parsers
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// HTTP Request Logger
if (env.nodeEnv !== 'test') {
  app.use(morgan('dev'));
}

// Root Welcome Route
app.get('/', (req, res) => {
  res.json({
    success: true,
    message: 'Welcome to G.manager Gym Subscription Management API',
    healthEndpoint: '/api/health',
  });
});

// Mount API Routes
app.use('/api', apiRoutes);

// 404 & Centralized Error Handling Middlewares
app.use(notFoundHandler);
app.use(errorHandler);

export default app;
