import express, { Application } from 'express';
// import apiRoutes from './routes/api';

const app: Application = express();

// Middleware para parsear JSON
app.use(express.json());

// // Rutas
// app.use('/api', apiRoutes);

export default app;
