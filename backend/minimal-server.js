const express = require('express');
const app = express();
const port = 3001;

app.get('/', (req, res) => {
    res.send('Minimal server is alive');
});

app.listen(port, '127.0.0.1', () => {
    console.log(`Minimal server running at http://127.0.0.1:${port}`);
});
