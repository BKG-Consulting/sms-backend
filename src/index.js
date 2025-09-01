// index.js
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const cookieParser = require('cookie-parser');
const rateLimit = require('express-rate-limit');
const { connectDB } = require('./services/db');
const errorMiddleware = require('./middleware/errorMiddleware');
const env = require('./config/env');
const AWS = require('aws-sdk');
// --- SUBDOMAIN MULTI-TENANCY MIDDLEWARE ---
const { prisma } = require('../prisma/client'); // Adjust path as needed
// Initialize AWS S3
const s3 = new AWS.S3({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region: process.env.AWS_REGION,
});

const app = express();
const PORT = env.PORT || 4000;

// Connect DB
connectDB();

// Middleware
const allowedRootDomain = '.dualdimension.org';

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (like mobile apps, curl, etc.)
    if (!origin) return callback(null, true);
    // Allow all subdomains and the root domain
    if (origin.endsWith(allowedRootDomain) || origin === `https://${allowedRootDomain}`) {
      return callback(null, true);
    }
    // Allow localhost for development
    if (origin.startsWith('http://localhost')) {
      return callback(null, true);
    }
    // Otherwise, block
    return callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

// Ensure preflight requests are handled
app.options('*', cors());

app.use(express.json());
app.use(cookieParser());
app.use(morgan('dev'));

// Serve local uploads if using local storage
if (process.env.STORAGE_TYPE === 'local' || !process.env.STORAGE_TYPE) {
  app.use('/uploads', express.static('./uploads'));
}

// Rate limit sensitive endpoints
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100,
});
app.use('/api/login', authLimiter);
app.use('/api/refresh-token', authLimiter);
app.use('/api/verifyOTP', authLimiter);
app.use('/api/resendOTP', authLimiter);
app.use('/api/forgotPassword', authLimiter);
app.use('/api/resetPassword', authLimiter);

// Health check
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'OK', service: 'auth-service' });
});

// Root test route to verify server is reachable
app.get('/test-root', (req, res) => {
  res.send('Root route is working!');
});



app.use(async (req, res, next) => {
  const host = req.headers.host;
  const rootDomain = 'dualdimension.org'; // Or process.env.ROOT_DOMAIN
  let subdomain = null;

  if (host && host.endsWith(rootDomain)) {
    const parts = host.split('.');
    if (parts.length > 2) {
      subdomain = parts[0];
    }
  }
  req.subdomain = subdomain;

  if (!subdomain) {
    // No subdomain: root domain, show default/marketing/landing page
    return next();
  }

  try {
    const tenant = await prisma.tenant.findUnique({ where: { domain: subdomain } });
    if (!tenant) {
      return res.status(404).send('Tenant not found');
    }
    req.tenant = tenant;
    res.locals.tenantBranding = {
      name: tenant.name,
      logoUrl: tenant.logoUrl,
      type: tenant.type,
      // Add more branding fields as needed
    };
    next();
  } catch (err) {
    next(err);
  }
});

// Mount routes
const authRoutes = require('./routes/authRoutes');
const userRoutes = require('./routes/userRoutes');
const roleRoutes = require('./routes/roleRoutes');
const tenantRoutes = require('./routes/tenantRoutes');
const departmentRoutes = require('./routes/departmentRoutes');
const campusRoutes = require('./routes/campusRoutes');
const documentRoutes = require('./routes/documentRoutes');
const auditRoutes = require('./routes/auditRoutes');
const auditProgramRoutes = require('./routes/auditProgramRoutes');
const dashboardRoutes = require('./routes/dashboardRoutes');
const auditTeamRoutes = require('./routes/auditTeamRoutes');
const messageRoutes = require('./routes/messageRoutes');
const changeRequestRoutes = require('./routes/changeRequestRoutes');
const checklistRoutes = require('./routes/checklistRoutes');
const findingRoutes = require('./routes/findingRoutes');
const correctiveActionRoutes = require('./routes/correctiveActionRoutes');
const preventiveActionRoutes = require('./routes/preventiveActionRoutes');
const auditAnalysisRoutes = require('./routes/auditAnalysisRoutes');
const auditReportRoutes = require('./routes/auditReportRoutes');
const auditPlanPdfRoutes = require('./routes/auditPlanPdfRoutes');
const feedbackRoutes = require('./routes/feedbackRoutes');
const managementReviewRoutes = require('./routes/managementReviewRoutes');
const planningMeetingRoutes = require('./routes/planningMeetingRoutes');
// Meeting routes are now handled separately by each meeting type
// const meetingRoutes = require('./routes/meetingRoutes');
const testRoutes = require('./routes/testRoutes');
const userPermissionRoutes = require('./routes/userPermissionRoutes');
const rolePermissionRoutes = require('./routes/rolePermissionRoutes');
const permissionRoutes = require('./routes/permissionRoutes');
const uploadRoutes = require('./routes/uploadRoutes'); // Add upload routes

app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/roles', roleRoutes);
app.use('/api/tenants', tenantRoutes);
app.use('/api/departments', departmentRoutes);
app.use('/api/campuses', campusRoutes);
app.use('/api/documents', documentRoutes);
app.use('/api/change-requests', changeRequestRoutes);
app.use('/api/audits', auditRoutes);
app.use('/api/audit-programs', auditProgramRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/audits/:auditId/team', auditTeamRoutes);
app.use('/api/messages', messageRoutes);
app.use('/api/feedback', feedbackRoutes);
app.use('/api/checklists', checklistRoutes);
app.use('/api/findings', findingRoutes);
app.use('/api/corrective-actions', correctiveActionRoutes);
app.use('/api/preventive-actions', preventiveActionRoutes);
app.use('/api/audit-analysis', auditAnalysisRoutes);
app.use('/api/audit-reports', auditReportRoutes);
app.use('/api', auditPlanPdfRoutes);
app.use('/api/management-review', managementReviewRoutes);
app.use('/api/planning-meetings', planningMeetingRoutes);
// Meeting routes are now handled separately by each meeting type
// app.use('/api/meetings', meetingRoutes);
app.use('/api/test', testRoutes);
app.use('/api/user-permissions', userPermissionRoutes);
app.use('/api/role-permissions', rolePermissionRoutes);
app.use('/api/permissions', permissionRoutes);
app.use('/api/upload', uploadRoutes); // Add upload routes


// Mount notification routes
const notificationRoutes = require('./routes/notificationRoutes');
app.use('/api/notifications', notificationRoutes);

// Remove or adjust the local file serving (optional, keep for fallback if needed)
// app.use('/uploads/documents', express.static(path.join(__dirname, '../uploads/documents')));

// Log active routes
app._router.stack.forEach((r) => {
  if (r.route) {
    console.log(`Registered route: ${r.route.path}`);
  } else if (r.handle && r.handle.stack) {
    r.handle.stack.forEach((sub) => {
      if (sub.route) {
        console.log(`Registered sub-route: ${r.regexp} -> ${sub.route.path}`);
      }
    });
  }
});

// Error handler
app.use(errorMiddleware);

// --- SOCKET.IO SETUP ---
const http = require('http');
const server = http.createServer(app);
const { init: initSocket } = require('./services/socketService');
const io = initSocket(server);

// Start server (use server.listen, not app.listen)
if (env.NODE_ENV !== 'test') {
  server.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Auth Service running on http://localhost:${PORT}`);
  });
}

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('Received SIGTERM. Shutting down gracefully...');
  process.exit(0);
});

module.exports = app;
// Export S3 client for use in other modules
module.exports.s3 = s3;
// Optionally export io for use in other modules
module.exports.io = io;