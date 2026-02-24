// Ejemplo con Express
const express = require('express');
const path = require('path');
const app = express();
const port = 3000;

// Servir archivos estáticos (imágenes, etc.)
app.use(express.static(__dirname));

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(port, () => {
  console.log(`Servidor Express en http://localhost:${port}`);
});