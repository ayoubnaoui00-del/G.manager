import app from './app.js';
import env from './config/env.js';

const startServer = () => {
  app.listen(env.port, () => {
    console.log(`====================================================`);
    console.log(`G.manager API Server running in ${env.nodeEnv} mode`);
    console.log(`Listening on: http://localhost:${env.port}`);
    console.log(`Health check: http://localhost:${env.port}/api/health`);
    console.log(`====================================================`);
  });
};

startServer();
