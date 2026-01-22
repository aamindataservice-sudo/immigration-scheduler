const http = require('http');
const { exec } = require('child_process');
const crypto = require('crypto');

// Configuration
const PORT = 9876;
const SECRET = 'immigration-webhook-secret-2026'; // Change this to a secure secret

const server = http.createServer((req, res) => {
  if (req.method === 'POST' && req.url === '/deploy') {
    let body = '';
    
    req.on('data', chunk => {
      body += chunk.toString();
    });
    
    req.on('end', () => {
      // Verify GitHub signature (optional but recommended)
      const signature = req.headers['x-hub-signature-256'];
      if (signature) {
        const hmac = crypto.createHmac('sha256', SECRET);
        const digest = 'sha256=' + hmac.update(body).digest('hex');
        if (signature !== digest) {
          console.log('Invalid signature');
          res.writeHead(401);
          res.end('Invalid signature');
          return;
        }
      }
      
      console.log(`[${new Date().toISOString()}] Webhook received - Starting deployment...`);
      
      // Run deploy script
      exec('bash /var/www/immigration-schedule/scripts/deploy.sh', (error, stdout, stderr) => {
        if (error) {
          console.error('Deploy error:', error);
          console.error('stderr:', stderr);
        }
        console.log('Deploy output:', stdout);
      });
      
      res.writeHead(200);
      res.end('Deployment started');
    });
  } else if (req.method === 'GET' && req.url === '/health') {
    res.writeHead(200);
    res.end('Webhook server is running');
  } else {
    res.writeHead(404);
    res.end('Not found');
  }
});

server.listen(PORT, () => {
  console.log(`Webhook server running on port ${PORT}`);
  console.log(`Deploy endpoint: http://localhost:${PORT}/deploy`);
});
