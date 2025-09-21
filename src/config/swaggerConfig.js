const swaggerJsDoc = require('swagger-jsdoc');

const servers = process.env.NODE_ENV === 'production' 
  ? [
      {
        url: 'https://wdp301-ev-rental-backend.onrender.com',
        description: 'Production server'
      }
    ]
  : [
      {
        url: 'http://localhost:5000',
        description: 'Development server'
      }
    ];

const swaggerOptions = {
  swaggerDefinition: {
    openapi: '3.0.0',
    info: {
      title: 'EV Rental System API',
      version: '1.0.0',
      description: 'API documentation for the EV Rental System',
    },
    servers: servers,
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
        },
      },
    },
    security: [
      {
        bearerAuth: [],
      },
    ],
  },
  apis: [
    './src/routes/*.js',
    './src/config/swagger/api/*.js',
    './src/config/swagger/schemas/*.js'
  ],
};

const swaggerDocs = swaggerJsDoc(swaggerOptions);

module.exports = swaggerDocs;