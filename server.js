"use strict";

const express = require("express");
const path = require("path");
const { gerarQRCode } = require("./api/create-qrcode");
const { verificarStatusPagamento } = require("./api/verificar-status");

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

// Rota para criar o QR Code
app.post("/create-qrcode", async (req, res) => {
  try {
    const { valor } = req.body;
    const valorFormatado = parseFloat(valor).toFixed(2);

    const qrcodeData = await gerarQRCode(valorFormatado);

    if (!qrcodeData) {
      res.status(500).json({ error: "Erro ao gerar QR Code." });
      return;
    }

    res.json({
      qrcode: {
        imagemQrcode: qrcodeData.copiaECola,
        txid: qrcodeData.txid,
        copiaECola: qrcodeData.copiaECola,
      },
    });
  } catch (error) {
    res.status(500).json({ error: "Erro ao gerar QR Code" });
  }
});

// Rota para consultar o status do pagamento
app.get("/verificar-status/:txid", async (req, res) => {
  try {
    const { txid } = req.params;
    const statusData = await verificarStatusPagamento(txid);
    res.json(statusData);
  } catch (error) {
    res.status(500).json({ error: "Erro ao verificar status de pagamento" });
  }
});

// Inicializar o servidor
app.listen(3000, () => {
  console.log("Servidor rodando em http://localhost:3000");
});
