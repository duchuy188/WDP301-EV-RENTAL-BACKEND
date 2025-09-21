
const swaggerAuth = (req, res, next) => {

  const authHeader = req.headers.authorization;

  if (!authHeader) {
    
    res.setHeader('WWW-Authenticate', 'Basic');
    return res.status(401).send('Authentication required');
  }

  if (!authHeader.startsWith('Basic ')) {
    res.setHeader('WWW-Authenticate', 'Basic');
    return res.status(401).send('Basic authentication required');
  }

  
  const base64Credentials = authHeader.split(' ')[1];
  const credentials = Buffer.from(base64Credentials, 'base64').toString('utf8');
  const [username, password] = credentials.split(':');

 
  const validUsername = process.env.SWAGGER_USERNAME;
  const validPassword = process.env.SWAGGER_PASSWORD;

  
  if (username === validUsername && password === validPassword) {
    return next();
  }

  
  res.setHeader('WWW-Authenticate', 'Basic');
  return res.status(401).send('Invalid credentials');
};

module.exports = swaggerAuth;
