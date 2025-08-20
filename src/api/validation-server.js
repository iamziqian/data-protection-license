const express = require('express');
const redis = require('redis');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const helmet = require('helmet');
const compression = require('compression');
const LicenseGenerator = require('../core/license-generator');
const { promisify } = require('util');

/**
 * High-Performance License Validation API
 * Node.js microservices architecture with Redis cluster
 * Handles 10M+ daily verification requests
 */
class ValidationServer {
  constructor(config = {}) {
    this.app = express();
    this.port = config.port || 3000;
    this.redisConfig = config.redis || {
      host: 'localhost',
      port: 6379,
      db: 0
    };
    
    this.licenseGenerator = new LicenseGenerator();
    this.redisClient = null;
    this.metrics = {
      requestCount: 0,
      validationCount: 0,
      cacheHits: 0,
      cacheMisses: 0
    };

    this._setupMiddleware();
    this._setupRoutes();
  }

  /**
   * Initialize Redis connection and start server
   */
  async start() {
    try {
      await this._connectRedis();
      this.server = this.app.listen(this.port, () => {
        console.log(`🚀 Data Protection Validation Server running on port ${this.port}`);
        console.log(`📊 Redis connected: ${this.redisConfig.host}:${this.redisConfig.port}`);
      });
      return this.server;
    } catch (error) {
      console.error('❌ Failed to start server:', error);
      throw error;
    }
  }

  /**
   * Graceful shutdown
   */
  async stop() {
    if (this.redisClient) {
      await this.redisClient.quit();
    }
    if (this.server) {
      this.server.close();
    }
  }

  // Private methods
  _setupMiddleware() {
    // Security middleware
    this.app.use(helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'", "'unsafe-inline'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          imgSrc: ["'self'", "data:", "https:"]
        }
      }
    }));

    // Rate limiting for high-performance handling
    const limiter = rateLimit({
      windowMs: 60 * 1000, // 1 minute
      max: 1000, // 1000 requests per minute per IP
      message: {
        error: 'Rate limit exceeded',
        retryAfter: 60,
        documentation: 'https://data-protection.org/api-docs'
      },
      standardHeaders: true,
      legacyHeaders: false
    });

    this.app.use(limiter);
    this.app.use(compression());
    this.app.use(cors());
    this.app.use(express.json({ limit: '10mb' }));
    this.app.use(express.urlencoded({ extended: true }));

    // Request logging and metrics
    this.app.use((req, res, next) => {
      this.metrics.requestCount++;
      req.startTime = Date.now();
      
      res.on('finish', () => {
        const duration = Date.now() - req.startTime;
        console.log(`${req.method} ${req.path} - ${res.statusCode} - ${duration}ms`);
      });
      
      next();
    });
  }

  _setupRoutes() {
    // Health check
    this.app.get('/health', (req, res) => {
      res.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        metrics: this.metrics
      });
    });

    // License validation endpoint
    this.app.post('/api/v1/validate', async (req, res) => {
      try {
        const { license, hash } = req.body;
        
        if (!license && !hash) {
          return res.status(400).json({
            error: 'License object or hash required',
            code: 'INVALID_REQUEST'
          });
        }

        const validationResult = await this._validateWithCache(license, hash);
        this.metrics.validationCount++;

        res.json({
          valid: validationResult.valid,
          license: validationResult.license,
          verificationTimestamp: new Date().toISOString(),
          cached: validationResult.cached,
          responseTime: Date.now() - req.startTime
        });

      } catch (error) {
        res.status(500).json({
          error: 'Validation failed',
          message: error.message,
          code: 'VALIDATION_ERROR'
        });
      }
    });

    // Bulk validation endpoint
    this.app.post('/api/v1/validate/bulk', async (req, res) => {
      try {
        const { items } = req.body;
        
        if (!Array.isArray(items) || items.length === 0) {
          return res.status(400).json({
            error: 'Items array required',
            code: 'INVALID_REQUEST'
          });
        }

        if (items.length > 100) {
          return res.status(400).json({
            error: 'Maximum 100 items per bulk request',
            code: 'REQUEST_TOO_LARGE'
          });
        }

        const results = await Promise.all(
          items.map(async (item, index) => {
            try {
              const result = await this._validateWithCache(item.license, item.hash);
              return {
                index,
                valid: result.valid,
                license: result.license,
                cached: result.cached
              };
            } catch (error) {
              return {
                index,
                error: error.message,
                valid: false
              };
            }
          })
        );

        res.json({
          results,
          summary: {
            total: items.length,
            valid: results.filter(r => r.valid).length,
            invalid: results.filter(r => !r.valid).length,
            errors: results.filter(r => r.error).length
          },
          verificationTimestamp: new Date().toISOString(),
          responseTime: Date.now() - req.startTime
        });

      } catch (error) {
        res.status(500).json({
          error: 'Bulk validation failed',
          message: error.message,
          code: 'BULK_VALIDATION_ERROR'
        });
      }
    });

    // License lookup by hash
    this.app.get('/api/v1/license/:hash', async (req, res) => {
      try {
        const { hash } = req.params;
        const cachedLicense = await this._getFromCache(`license:${hash}`);
        
        if (cachedLicense) {
          this.metrics.cacheHits++;
          res.json({
            license: JSON.parse(cachedLicense),
            cached: true,
            verificationTimestamp: new Date().toISOString()
          });
        } else {
          this.metrics.cacheMisses++;
          res.status(404).json({
            error: 'License not found',
            hash,
            code: 'LICENSE_NOT_FOUND'
          });
        }
      } catch (error) {
        res.status(500).json({
          error: 'License lookup failed',
          message: error.message,
          code: 'LOOKUP_ERROR'
        });
      }
    });

    // License storage endpoint
    this.app.post('/api/v1/store', async (req, res) => {
      try {
        const { license } = req.body;
        
        if (!license || !license.hash) {
          return res.status(400).json({
            error: 'Valid license object with hash required',
            code: 'INVALID_LICENSE'
          });
        }

        // Validate license before storing
        const isValid = this.licenseGenerator.validateLicense(license);
        if (!isValid) {
          return res.status(400).json({
            error: 'Invalid license signature',
            code: 'INVALID_SIGNATURE'
          });
        }

        // Store in cache with 24 hour expiration
        await this._setInCache(`license:${license.hash}`, JSON.stringify(license), 86400);
        
        res.json({
          stored: true,
          hash: license.hash,
          expiresIn: 86400,
          verificationUrl: `https://data-protection.org/verify/${license.hash}`,
          timestamp: new Date().toISOString()
        });

      } catch (error) {
        res.status(500).json({
          error: 'Storage failed',
          message: error.message,
          code: 'STORAGE_ERROR'
        });
      }
    });

    // Metrics endpoint
    this.app.get('/api/v1/metrics', (req, res) => {
      res.json({
        ...this.metrics,
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        timestamp: new Date().toISOString()
      });
    });

    // API documentation
    this.app.get('/api/docs', (req, res) => {
      res.json({
        name: 'Data Protection License Validation API',
        version: '1.0.0',
        description: 'High-performance license validation with Redis caching',
        endpoints: {
          'POST /api/v1/validate': 'Validate a single license',
          'POST /api/v1/validate/bulk': 'Validate multiple licenses',
          'GET /api/v1/license/:hash': 'Lookup license by hash',
          'POST /api/v1/store': 'Store license in cache',
          'GET /api/v1/metrics': 'API metrics',
          'GET /health': 'Health check'
        },
        rateLimit: '1000 requests per minute',
        documentation: 'https://data-protection.org/api-docs'
      });
    });

    // 404 handler
    this.app.use('*', (req, res) => {
      res.status(404).json({
        error: 'Endpoint not found',
        path: req.originalUrl,
        method: req.method,
        documentation: '/api/docs'
      });
    });

    // Error handler
    this.app.use((error, req, res, next) => {
      console.error('❌ Server error:', error);
      res.status(500).json({
        error: 'Internal server error',
        message: process.env.NODE_ENV === 'development' ? error.message : 'Something went wrong',
        timestamp: new Date().toISOString()
      });
    });
  }

  async _connectRedis() {
    this.redisClient = redis.createClient(this.redisConfig);
    
    this.redisClient.on('error', (err) => {
      console.error('❌ Redis Client Error', err);
    });

    this.redisClient.on('connect', () => {
      console.log('✅ Redis Connected');
    });

    await this.redisClient.connect();
  }

  async _validateWithCache(license, hash) {
    try {
      // If only hash provided, try to get license from cache
      if (!license && hash) {
        const cachedLicense = await this._getFromCache(`license:${hash}`);
        if (cachedLicense) {
          license = JSON.parse(cachedLicense);
          this.metrics.cacheHits++;
        } else {
          this.metrics.cacheMisses++;
          return { valid: false, error: 'License not found in cache' };
        }
      }

      // Validate license
      const isValid = this.licenseGenerator.validateLicense(license);
      
      // Cache the validation result
      if (isValid && license.hash) {
        await this._setInCache(`license:${license.hash}`, JSON.stringify(license), 3600);
        await this._setInCache(`validation:${license.hash}`, 'valid', 300); // 5 min cache
      }

      return {
        valid: isValid,
        license: isValid ? license : null,
        cached: false
      };

    } catch (error) {
      return {
        valid: false,
        error: error.message
      };
    }
  }

  async _getFromCache(key) {
    try {
      return await this.redisClient.get(key);
    } catch (error) {
      console.error('Cache get error:', error);
      return null;
    }
  }

  async _setInCache(key, value, expiration = 3600) {
    try {
      await this.redisClient.setEx(key, expiration, value);
      return true;
    } catch (error) {
      console.error('Cache set error:', error);
      return false;
    }
  }
}

// Export both class and instance factory
module.exports = ValidationServer;

// CLI runner
if (require.main === module) {
  const server = new ValidationServer({
    port: process.env.PORT || 3000,
    redis: {
      host: process.env.REDIS_HOST || 'localhost',
      port: process.env.REDIS_PORT || 6379,
      db: process.env.REDIS_DB || 0
    }
  });

  server.start().catch(console.error);

  // Graceful shutdown
  process.on('SIGTERM', async () => {
    console.log('🛑 SIGTERM received, shutting down gracefully');
    await server.stop();
    process.exit(0);
  });

  process.on('SIGINT', async () => {
    console.log('🛑 SIGINT received, shutting down gracefully');
    await server.stop();
    process.exit(0);
  });
}
