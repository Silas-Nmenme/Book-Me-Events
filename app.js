const express = require('express');

const app = express();

app.get('/', (req, res) => {
  res.json({
    success: true,
    message: 'Server Working'
  });
});

module.exports = app;