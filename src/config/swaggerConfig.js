const swaggerJsDoc = require('swagger-jsdoc');

const swaggerOptions = {
  swaggerDefinition: {
    openapi: '3.0.0',
    info: {
      title: 'EV Rental System API',
      version: '1.0.0',
      description: 'API documentation for the EV Rental System',
    },
    servers: [
      {
       url: 'https://wdp301-ev-rental-backend.onrender.com',
        description: 'Production server'
      },
    {
      url: 'http://localhost:5000',
      description: 'Development server'
    }
    ],
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
  ], // Đường dẫn đến các tệp chứa định nghĩa API
};

const swaggerDocs = swaggerJsDoc(swaggerOptions);

module.exports = swaggerDocs;