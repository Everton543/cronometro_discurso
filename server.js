const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(cors());
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());

// "Banco de memória" com os códigos ativos
const codigosAtivos = new Map();

// Quando o cliente se conecta via Socket.IO
io.on('connection', (socket) => {
  console.log('Cliente conectado:', socket.id);

  // Controle quer criar código
  socket.on('criar-codigo', (codigo, callback) => {
    if (codigosAtivos.has(codigo)) {
      return callback({ sucesso: false, erro: 'Código já está em uso.' });
    }
    const agora = Date.now();
    codigosAtivos.set(codigo, agora);
    socket.join(codigo);
    console.log(`Código ${codigo} criado por ${socket.id}`);
    callback({ sucesso: true });
  });

  // Cronômetro quer entrar num código existente
  socket.on('entrar-codigo', (codigo, callback) => {
    if (!codigosAtivos.has(codigo)) {
      return callback({ sucesso: false, erro: 'Código não existe.' });
    }
    socket.join(codigo);
    console.log(`Cronômetro entrou no código ${codigo}`);
    callback({ sucesso: true });
  });

  socket.on('iniciar-cronometro', ({ tempo, codigo }) => {
    io.to(codigo).emit('iniciar-cronometro', { tempo });
  });

  socket.on('parar-cronometro', ({ codigo }) => {
    io.to(codigo).emit('parar-cronometro');
  });

  socket.on('tempo-final', ({ codigo, tempo }) => {
    io.to(codigo).emit('tempo-final', { tempo });
  });

  socket.on('mensagem', ({ codigo, msg }) => {
    io.to(codigo).emit('mensagem', msg);
  });

  socket.on('disconnect', () => {
    console.log('Cliente desconectado:', socket.id);
  });
});

app.get('/verificar-codigo/:codigo', (req, res) => {
  const codigo = req.params.codigo;
  const existe = codigosAtivos.has(codigo);
  res.json({ existe });
});

// Função para remover códigos com mais de 24h
function limparCodigosExpirados() {
  const agora = Date.now();
  const expiracao = 24 * 60 * 60 * 1000; // 24 horas

  for (const [codigo, criadoEm] of codigosAtivos.entries()) {
    if ((agora - criadoEm) > expiracao) {
      codigosAtivos.delete(codigo);
      console.log(`Código expirado removido: ${codigo}`);
    }
  }
}

// Roda a limpeza a cada 1 hora
setInterval(limparCodigosExpirados, 60 * 60 * 1000);

// Subindo servidor
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});