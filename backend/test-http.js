const http = require('http');

const server = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('Http server alive\n');
});

server.listen(3002, '127.0.0.1', () => {
  console.log('Http server running at http://127.0.0.1:3002/');
});
