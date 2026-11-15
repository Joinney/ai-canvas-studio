require('dotenv').config();
const express = require('express');
const cors = require('cors');
const aiRoutes = require('./routes/ai.routes');

const app = express();
app.use(cors());
app.use(express.json({ limit: '50mb' }));

app.use('/api/ai', aiRoutes);
app.get('/health', (req, res) => res.json({ status: 'OK', service: 'AI Canvas Studio Backend', port: 5001 }));

const PORT = process.env.PORT || 5001;
app.listen(PORT, () => console.log('🚀 Server AI Canvas đang chạy tại http://localhost:' + PORT));
