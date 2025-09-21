require('dotenv').config(); 

const express = require('express');
const cors = require('cors');
const swaggerUi = require('swagger-ui-express');
const swaggerDocs = require('./config/swaggerConfig');
const mongoose = require('mongoose');
const authRoutes = require('./routes/auth.routes');
const kycRoutes = require('./routes/kyc.routes');
const stationRoutes = require('./routes/station.routes');
const userRoutes = require('./routes/user.routes');
const { User, RefreshToken, BlacklistToken, KYC } = require('./models');
const swaggerAuth = require('./middlewares/swaggerAuth');
const rateLimit = require('express-rate-limit');

// Import routes
const vehicleRoutes = require('./routes/vehicle.routes');

const app = express();
const PORT = process.env.PORT || 5000; 

// Middleware để phân tích dữ liệu JSON
app.use(express.json());

//  Cấu hình CORS theo environment
if (process.env.NODE_ENV === 'development') {
  // Development: cho phép tất cả origins
  app.use(cors({
    origin: true,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
  }));
} else {
 
  const allowedOrigins = process.env.FRONTEND_URL?.split(',') || [];
  app.use(cors({
    origin: allowedOrigins,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
  }));
}

// Thiết lập Swagger với xác thực cơ bản
app.use('/api-docs', swaggerAuth, swaggerUi.serve, swaggerUi.setup(swaggerDocs));

// Kết nối đến MongoDB
mongoose.connect(process.env.MONGO_URI)
.then(() => console.log('Connected to MongoDB'))
.catch(err => console.error('Could not connect to MongoDB...', err));

// Giới hạn request cho các route xác thực
const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, 
    max: 100, 
    message: 'Quá nhiều yêu cầu từ IP này, vui lòng thử lại sau 15 phút'
});

// Áp dụng rate limiting cho route auth
app.use('/api/auth', authLimiter, authRoutes);

// Route cho KYC
app.use('/api/kyc', kycRoutes);

// Route cho Station
app.use('/api/stations', stationRoutes);

// Route cho User Management
app.use('/api/users', userRoutes);

// Sử dụng routes
app.use('/api/vehicles', vehicleRoutes);

// Định nghĩa một route cơ bản
app.get('/', (req, res) => {
  res.send('Welcome to the EV Rental System API!');
});

// Khởi động server
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
  console.log(`Swagger UI is available at http://localhost:${PORT}/api-docs`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
});
