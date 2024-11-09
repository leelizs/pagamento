const https = require("https");
const axios = require("axios");
const fs = require("fs");

require("dotenv").config(); // Carregar variáveis de ambiente
const base64 = process.env.PIX_CERTIFICADO_BASE64; // Vercel Secret
const certificadoBuffer = Buffer.from(base64, "base64");

// Credenciais PIX (do arquivo .env)
const credenciais = {
  client_id: process.env.CLIENT_ID, // Usando variáveis de ambiente
  client_secret: process.env.CLIENT_SECRET, // Usando variáveis de ambiente
};

// Função para obter o token de acesso
async function obterToken() {
  try {
    const data_credentials = `${credenciais.client_id}:${credenciais.client_secret}`;
    const auth = Buffer.from(data_credentials).toString("base64");

    const agent = new https.Agent({
      pfx: certificadoBuffer,
      passphrase: "",
    });

    const configToken = {
      method: "POST",
      url: "https://pix.api.efipay.com.br/oauth/token",
      headers: {
        Authorization: "Basic " + auth,
        "Content-Type": "application/json",
      },
      httpsAgent: agent,
      data: { grant_type: "client_credentials" },
    };

    const tokenResponse = await axios(configToken);
    if (tokenResponse.status !== 200) {
      throw new Error("Erro ao obter token");
    }
    return tokenResponse.data.access_token;
  } catch (error) {
    throw new Error("Erro ao obter token");
  }
}

// Função para gerar o QR Code
async function gerarQRCode(valor) {
  try {
    const token = await obterToken();

    const agent = new https.Agent({
      pfx: certificadoBuffer,
      passphrase: "",
    });

    const qrcodeConfig = {
      method: "POST",
      url: "https://pix.api.efipay.com.br/v2/cob",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      httpsAgent: agent,
      data: {
        calendario: { expiracao: 600 },
        valor: { original: valor },
        chave: "0a2814e9-73ac-4e23-894e-c40ff3f8e0e9",
        solicitacaoPagador: "Pagamento em Família de Ouro",
      },
    };

    // Fazendo a requisição e obtendo a resposta
    const qrcodeResponse = await axios(qrcodeConfig);

    // Log da resposta para debug
    console.log("Resposta da API:", qrcodeResponse);
    console.log("Tipo de conteúdo:", qrcodeResponse.headers["content-type"]);

    // Verifica se o conteúdo retornado é JSON
    if (!qrcodeResponse.headers["content-type"].includes("application/json")) {
      console.error("A resposta não é JSON, tipo encontrado:", qrcodeResponse.headers["content-type"]);
      throw new Error("Resposta da API não é JSON");
    }

    // Retorna o QR Code e informações adicionais
    return {
      qrcodeData: qrcodeResponse.data,
      txid: qrcodeResponse.data.txid,
      copiaECola: qrcodeResponse.data.pixCopiaECola,
    };
  } catch (error) {
    console.error("Erro ao gerar QR Code:", error);
    throw new Error("Erro ao gerar QR Code");
  }
}

// Função serverless para Vercel
module.exports = async (req, res) => {
  if (req.method === "POST") {
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
  } else {
    res.status(405).json({ error: "Método não permitido" });
  }
};
